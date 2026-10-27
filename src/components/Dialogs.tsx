import { useEffect, useRef, useState } from 'react';
import { copyShareLink } from '../session';
import { IDENTITY_COLORS, saveIdentity } from '../identity';
import { createNote } from '../canvas/tools/NoteTool';
import { CUSTOM_PREFIX, FURNITURE_COLORS, customCatalogItem } from '../catalog';
import { newId, type CustomItem } from '../model';
import { useDesign } from '../store/design';
import { ColorField, NumberField, TextField } from './fields';
import { SymbolIcon } from './FurniturePalette';
import { AreaDialog } from './AreaDialog';
import { PrintDialog } from './PrintDialog';
import { LiveDialog } from './LiveDialog';
import { useUi, type DialogState } from '../store/ui';

/** Renders whichever modal is open (ui.dialog). */
export function Dialogs() {
  const dialog = useUi((s) => s.dialog);
  if (!dialog) return null;
  if (dialog.type === 'share') return <ShareDialog url={dialog.url} copied={dialog.copied} long={dialog.long} />;
  if (dialog.type === 'confirm') return <ConfirmDialog dialog={dialog} />;
  if (dialog.type === 'areas') return <AreaDialog />;
  if (dialog.type === 'print') return <PrintDialog />;
  if (dialog.type === 'live') return <LiveDialog />;
  if (dialog.type === 'floor-roof') return <FloorRoofDialog dialog={dialog} />;
  if (dialog.type === 'identity') return <IdentityDialog then={dialog.then} />;
  if (dialog.type === 'custom-item') return <CustomItemDialog editId={dialog.editId} preset={dialog.preset} />;
  return <ConflictDialog dialog={dialog} />;
}

function ShareDialog({ url, copied, long }: { url: string; copied: boolean; long: boolean }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const close = () => useUi.getState().setDialog(null);
  useEffect(() => ref.current?.select(), []);
  return (
    <div className="modal-backdrop" onMouseDown={close}>
      <div className="modal" role="dialog" aria-label="Share" onMouseDown={(e) => e.stopPropagation()} data-testid="share-dialog">
        <h2>Share your design</h2>
        <p className={copied ? 'ok' : 'muted'} data-testid="share-status">
          {copied ? '✓ Link copied to the clipboard. Paste it into a message.' : 'Copy this link and send it:'}
        </p>
        <textarea ref={ref} className="link-box" readOnly value={url} rows={4} aria-label="Share link" data-testid="share-url" onFocus={(e) => e.currentTarget.select()} />
        <p className="muted">
          The whole design is inside the link ({url.length.toLocaleString()} characters), so nothing is uploaded anywhere. Whoever opens it gets their
          own copy and their changes stay in their browser. For a new version, share a new link.
        </p>
        {long && (
          <p className="notice">
            This link is quite long. Some chat apps may shorten or cut it. If it does not open, use File → Export JSON and send the file instead.
          </p>
        )}
        <div className="row end">
          <button
            onClick={async () => {
              if (await copyShareLink(url)) useUi.getState().showToast('Link copied.');
              else ref.current?.select();
            }}
          >
            Copy again
          </button>
          <button className="primary" onClick={close}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function ConflictDialog({ dialog }: { dialog: Extract<DialogState, { type: 'link-conflict' }> }) {
  const { incoming, current, sameDesign, choose } = dialog;
  return (
    <div className="modal-backdrop">
      <div className="modal" role="dialog" aria-label="Open shared design" data-testid="conflict-dialog">
        <h2>Open the shared design?</h2>
        <p>
          {sameDesign ? (
            <>
              You already have a copy of <strong>“{incoming.name}”</strong> in this browser, and it is different from the one in the link.
            </>
          ) : (
            <>
              This link contains <strong>“{incoming.name}”</strong>. You are currently working on <strong>“{current.name}”</strong>.
            </>
          )}
        </p>
        <p className="muted">Either way nothing is lost: if you open the shared one, your current design is kept under File → Restore previous design.</p>
        <div className="row end">
          <button onClick={() => choose(false)} data-testid="keep-mine">
            Keep my design
          </button>
          <button className="primary" onClick={() => choose(true)} data-testid="open-shared">
            Open the shared design
          </button>
        </div>
      </div>
    </div>
  );
}

/** A new floor above a floor with a roof: the roof is in the way. */
function FloorRoofDialog({ dialog }: { dialog: Extract<DialogState, { type: 'floor-roof' }> }) {
  const close = () => useUi.getState().setDialog(null);
  return (
    <div className="modal-backdrop" onMouseDown={close}>
      <div className="modal" role="dialog" aria-label="Floor above a roof" onMouseDown={(e) => e.stopPropagation()} data-testid="floor-roof-dialog">
        <h2>“{dialog.floorName}” has a roof</h2>
        <p>A new floor above would stand inside that roof. What should happen?</p>
        <div className="column-buttons">
          {dialog.canAttic && (
            <button className="primary" onClick={() => dialog.choose('attic')} data-testid="floor-roof-attic">
              Add an attic under the roof
            </button>
          )}
          <button className={dialog.canAttic ? '' : 'primary'} onClick={() => dialog.choose('move')} data-testid="floor-roof-move">
            Add a full floor and move the roof up onto it
          </button>
          <button onClick={close} data-testid="floor-roof-cancel">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmDialog({ dialog }: { dialog: Extract<DialogState, { type: 'confirm' }> }) {
  const close = () => useUi.getState().setDialog(null);
  return (
    <div className="modal-backdrop" onMouseDown={close}>
      <div className="modal" role="dialog" aria-label={dialog.title} onMouseDown={(e) => e.stopPropagation()} data-testid="confirm-dialog">
        <h2>{dialog.title}</h2>
        <p>{dialog.message}</p>
        <div className="row end">
          <button onClick={close}>Cancel</button>
          <button
            className="primary"
            data-testid="confirm-ok"
            onClick={() => {
              close();
              dialog.onConfirm();
            }}
          >
            {dialog.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

const SHAPES: { value: CustomItem['shape']; label: string }[] = [
  { value: 'rect', label: 'Rectangle' },
  { value: 'round', label: 'Rounded' },
  { value: 'ellipse', label: 'Oval / round' },
];

/** Create or edit a piece of furniture of your own. */
function CustomItemDialog({ editId, preset }: { editId: string | null; preset?: Partial<CustomItem> }) {
  const existing = useDesign((s) => s.design.custom.find((c) => c.id === editId));
  const [item, setItem] = useState<CustomItem>(
    () => existing ?? { id: newId(), label: 'My item', w: 1, d: 0.6, height: 0.8, color: '#cbd5e1', shape: 'rect', ...preset },
  );
  const close = () => useUi.getState().setDialog(null);
  const set = (patch: Partial<CustomItem>) => setItem((c) => ({ ...c, ...patch }));
  const usedBy = useDesign((s) => s.design.furniture.filter((f) => f.type === CUSTOM_PREFIX + item.id).length);

  const save = (place: boolean) => {
    const label = item.label.trim() || 'My item';
    useDesign.getState().update((d) => {
      const i = d.custom.findIndex((c) => c.id === item.id);
      if (i >= 0) d.custom[i] = { ...item, label };
      else d.custom.push({ ...item, label });
    });
    close();
    if (place) {
      const ui = useUi.getState();
      ui.setTool('furniture');
      ui.setPlacing(CUSTOM_PREFIX + item.id);
    }
  };

  const remove = () => {
    if (usedBy) return useUi.getState().showToast(`“${item.label}” is used ${usedBy} time${usedBy > 1 ? 's' : ''} in the plan. Delete those first.`);
    useDesign.getState().update((d) => void (d.custom = d.custom.filter((c) => c.id !== item.id)));
    close();
  };

  return (
    <div className="modal-backdrop" onMouseDown={close}>
      <div className="modal" role="dialog" aria-label="Custom furniture" onMouseDown={(e) => e.stopPropagation()} data-testid="custom-dialog">
        <h2>{existing ? 'Edit your item' : 'New piece of furniture'}</h2>
        <div className="custom-preview">
          <SymbolIcon item={customCatalogItem(item)} size={90} />
        </div>
        <TextField label="Name" value={item.label} testId="custom-name" onChange={(v) => set({ label: v })} />
        {item.shape === 'symbol' ? (
          <p className="muted">Looks like the “{item.base}” symbol.</p>
        ) : (
          <div className="segmented" role="group" aria-label="Shape">
            {SHAPES.map((s) => (
              <button key={s.value} className={item.shape === s.value ? 'active' : ''} onClick={() => set({ shape: s.value })} data-testid={`custom-shape-${s.value}`}>
                {s.label}
              </button>
            ))}
          </div>
        )}
        <div className="row three">
          <NumberField label="Width" value={item.w} scale={100} unit="cm" min={5} max={5000} testId="custom-w" onCommit={(v) => set({ w: v })} />
          <NumberField label="Depth" value={item.d} scale={100} unit="cm" min={5} max={5000} testId="custom-d" onCommit={(v) => set({ d: v })} />
          <NumberField label="Height" value={item.height} scale={100} unit="cm" min={1} max={3000} testId="custom-h" onCommit={(v) => set({ height: v })} />
        </div>
        <ColorField label="Color" value={item.color} swatches={FURNITURE_COLORS} onChange={(c) => set({ color: c })} />
        <div className="row end">
          {existing && (
            <button className="danger" onClick={remove} data-testid="custom-delete" style={{ marginRight: 'auto' }}>
              Delete item
            </button>
          )}
          <button onClick={close}>Cancel</button>
          <button onClick={() => save(false)} data-testid="custom-save">
            Save
          </button>
          {!existing && (
            <button className="primary" onClick={() => save(true)} data-testid="custom-save-place">
              Save and place
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** "Who are you?": a name and a color, so sticky notes show who wrote them. Stays on this device. */
function IdentityDialog({ then }: { then?: { x: number; y: number } }) {
  const me = useUi((s) => s.me);
  const [name, setName] = useState(me?.name ?? '');
  const [color, setColor] = useState(me?.color ?? IDENTITY_COLORS[0]);
  const close = () => useUi.getState().setDialog(null);
  const save = () => {
    const n = name.trim();
    if (!n) return;
    const next = { name: n.slice(0, 40), color };
    saveIdentity(next);
    useUi.getState().setMe(next);
    close();
    if (then) createNote(then.x, then.y);
  };
  return (
    <div className="modal-backdrop" onMouseDown={close}>
      <div className="modal" role="dialog" aria-label="Who are you" onMouseDown={(e) => e.stopPropagation()} data-testid="identity-dialog">
        <h2>Who are you?</h2>
        <p className="muted">Sticky notes are signed with your name and color, so you can tell who wrote what. This stays on this computer.</p>
        <TextField label="Your name" value={name} testId="identity-name" onChange={setName} />
        <div className="field">
          <span>Your color</span>
          <div className="swatches">
            {IDENTITY_COLORS.map((c) => (
              <button key={c} className={`swatch ${c === color ? 'on' : ''}`} style={{ background: c }} aria-label={`Color ${c}`} data-testid={`identity-color-${c}`} onClick={() => setColor(c)} />
            ))}
          </div>
        </div>
        <div className="row end">
          <button onClick={close}>Cancel</button>
          <button className="primary" onClick={save} disabled={!name.trim()} data-testid="identity-save">
            {then ? 'Save and add the note' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
