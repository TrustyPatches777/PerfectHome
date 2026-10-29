import { useEffect, useMemo, useRef, useState } from 'react';
import { setActiveFloorAndFocus } from '../floors';
import { FIND_KINDS, findItems, type FindKind } from '../find';
import { formatArea, polygonArea } from '../geometry';
import { usualCeiling } from '../storey';
import { FLOOR_MATERIALS, ROOM_TYPES, ROOM_TYPE_LABEL, type FloorMaterial, type Room, type RoomType } from '../model';
import { FLOOR_COLORS } from '../canvas/style';
import { MATERIAL_LABELS } from './MaterialPicker';
import { deleteSnapshot, diffCount, diffDesigns, loadSnapshots, saveSnapshot, snapshotDesign, type Snapshot } from '../snapshots';
import { isLive } from '../live/live';
import { useDesign } from '../store/design';
import { useFloorId } from '../store/floor';
import { useUi } from '../store/ui';
import { t, localeOf, useLang } from '../i18n';

const close = () => useUi.getState().setDialog(null);

/** Edit a value when you leave the field (one undo step), not on every key. */
function CommitInput({ value, onCommit, type = 'text', width, testId, min, max }: { value: string | number; onCommit: (v: string) => void; type?: 'text' | 'number'; width?: number; testId?: string; min?: number; max?: number }) {
  return (
    <input
      key={String(value)}
      type={type}
      defaultValue={value}
      style={width ? { width } : undefined}
      min={min}
      max={max}
      data-testid={testId}
      onBlur={(e) => e.target.value !== String(value) && onCommit(e.target.value)}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
    />
  );
}

// ---- Find -----------------------------------------------------------------------------------------------------------------------------

/** Look for things by name or kind, jump to one, or select all that were found on this floor. */
export function FindDialog() {
  const design = useDesign((s) => s.design);
  const floor = useFloorId();
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<FindKind>('all');
  const [thisFloor, setThisFloor] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);
  const lang = useLang(); // texts worked out here follow the language
  const found = useMemo(() => findItems(design, query, kind, thisFloor ? floor : null), [design, query, kind, thisFloor, floor, lang]);
  const here = found.filter((f) => f.floor === floor);

  return (
    <div className="modal-backdrop" onMouseDown={close}>
      <div className="modal wide" role="dialog" aria-label={t('Find')} onMouseDown={(e) => e.stopPropagation()} data-testid="find-dialog">
        <h2>{t('Find')}</h2>
        <div className="row">
          <input ref={input} type="text" placeholder={t('Name or kind: kitchen, window, sofa, socket…')} value={query} onChange={(e) => setQuery(e.target.value)} style={{ flex: 1 }} aria-label={t('Search')} data-testid="find-query" />
          <select value={kind} onChange={(e) => setKind(e.target.value as FindKind)} aria-label={t('What to look for')} data-testid="find-kind">
            {FIND_KINDS.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label}
              </option>
            ))}
          </select>
        </div>
        <label className="check">
          <input type="checkbox" checked={thisFloor} onChange={(e) => setThisFloor(e.target.checked)} data-testid="find-this-floor" />
          {t('Only on this floor')}
        </label>
        <p className="muted" data-testid="find-count">
          {t('{length} found{value}', { length: found.length, value: found.length >= 300 ? t(' (the first 300)') : '' })}
        </p>
        <ul className="find-list" data-testid="find-results">
          {found.map((f) => (
            <li key={`${f.ref.kind}-${f.ref.id}`}>
              <button
                onClick={() => {
                  close();
                  setActiveFloorAndFocus(f.floor, f.at, f.ref);
                }}
                data-testid="find-item"
              >
                <strong>{f.label}</strong>
                <span className="muted">
                  {f.what} · {f.floorName}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <div className="row end">
          <button
            disabled={!here.length}
            onClick={() => {
              close();
              useUi.getState().setSelected(here.filter((f) => f.ref.kind !== 'guide').map((f) => f.ref));
            }}
            data-testid="find-select-all"
          >
            {t('Select the {length} on this floor', { length: here.length })}
          </button>
          <button className="primary" onClick={close}>
            {t('Close')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Rooms table ---------------------------------------------------------------------------------------------------------------------

/** All the rooms in a table: rename them, say what they are, set ceiling, color and floor for many at once. */
export function RoomsDialog() {
  const design = useDesign((s) => s.design);
  const floor = useFloorId();
  const [thisFloor, setThisFloor] = useState(true);
  const [bulkColor, setBulkColor] = useState('#e8eef7');
  const rooms = design.rooms.filter((r) => !thisFloor || r.floor === floor);
  const floorName = (id: string) => t(design.floors.find((f) => f.id === id)?.name ?? '');
  const usual = usualCeiling(design.settings.storeyHeight);
  const edit = (id: string, fn: (r: Room) => void) =>
    useDesign.getState().update((d) => {
      const r = d.rooms.find((x) => x.id === id);
      if (r) fn(r);
    });
  const editAll = (fn: (r: Room) => void) => {
    const ids = new Set(rooms.map((r) => r.id));
    useDesign.getState().update((d) => {
      for (const r of d.rooms) if (ids.has(r.id)) fn(r);
    });
  };

  return (
    <div className="modal-backdrop" onMouseDown={close}>
      <div className="modal wide" role="dialog" aria-label={t('Rooms')} onMouseDown={(e) => e.stopPropagation()} data-testid="rooms-dialog">
        <h2>{t('Rooms')}</h2>
        <label className="check">
          <input type="checkbox" checked={thisFloor} onChange={(e) => setThisFloor(e.target.checked)} data-testid="rooms-this-floor" />
          {t('Only this floor')}
        </label>
        {rooms.length === 0 ? (
          <p className="muted">{t('No rooms yet.')}</p>
        ) : (
          <>
            <div className="bulk-row" data-testid="rooms-bulk">
              <span className="muted">{t('All {length} listed:', { length: rooms.length })}</span>
              <select value="" aria-label={t('Set the type of all')} data-testid="bulk-type" onChange={(e) => e.target.value && editAll((r) => void (r.type = e.target.value as RoomType))}>
                <option value="">{t('type…')}</option>
                {ROOM_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {ROOM_TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
              <select value="" aria-label={t('Set the floor material of all')} data-testid="bulk-material" onChange={(e) => e.target.value && editAll((r) => void (r.material = e.target.value as FloorMaterial))}>
                <option value="">{t('floor…')}</option>
                {FLOOR_MATERIALS.map((m) => (
                  <option key={m} value={m}>
                    {MATERIAL_LABELS[m]}
                  </option>
                ))}
              </select>
              <input type="color" value={bulkColor} onChange={(e) => setBulkColor(e.target.value)} aria-label={t('Color for all')} />
              <button onClick={() => editAll((r) => void (r.color = bulkColor))} data-testid="bulk-color">
                {t('Set color')}
              </button>
              <CommitInput type="number" value="" width={70} testId="bulk-ceiling" onCommit={(v) => Number(v) > 0 && editAll((r) => void (r.ceiling = Math.min(12, Math.max(1.5, Number(v) / 100))))} />
              <span className="muted">{t('cm ceiling')}</span>
            </div>
            <div className="table-scroll">
              <table className="area-table rooms-table">
                <thead>
                  <tr>
                    <th>{t('Name')}</th>
                    <th>{t('Type')}</th>
                    <th>{t('Floor')}</th>
                    <th>{t('Material')}</th>
                    <th>{t('Color')}</th>
                    <th>{t('Ceiling (cm)')}</th>
                    <th>{t('Area')}</th>
                    <th>{t('Living area')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rooms.map((r, i) => (
                    <tr key={r.id}>
                      <td>
                        <CommitInput value={t(r.name)} testId={`room-name-${i}`} onCommit={(v) => edit(r.id, (x) => void (x.name = v.slice(0, 80) || x.name))} />
                      </td>
                      <td>
                        <select value={r.type ?? ''} aria-label={t('Type of {name}', { name: t(r.name) })} data-testid={`room-type-${i}`} onChange={(e) => edit(r.id, (x) => (e.target.value ? void (x.type = e.target.value as RoomType) : void delete x.type))}>
                          <option value="">–</option>
                          {ROOM_TYPES.map((t) => (
                            <option key={t} value={t}>
                              {ROOM_TYPE_LABEL[t]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="muted">{floorName(r.floor)}</td>
                      <td>
                        <select value={r.material} aria-label={t('Floor of {name}', { name: t(r.name) })} onChange={(e) => edit(r.id, (x) => void (x.material = e.target.value as FloorMaterial))}>
                          {FLOOR_MATERIALS.map((m) => (
                            <option key={m} value={m}>
                              {MATERIAL_LABELS[m]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input type="color" value={/^#[0-9a-f]{6}$/i.test(r.color) ? r.color : FLOOR_COLORS[0]} aria-label={t('Color of {name}', { name: t(r.name) })} onChange={(e) => edit(r.id, (x) => void (x.color = e.target.value))} />
                      </td>
                      <td>
                        <CommitInput type="number" value={Math.round((r.ceiling ?? usual) * 100)} width={70} testId={`room-ceiling-${i}`} onCommit={(v) => edit(r.id, (x) => void (x.ceiling = Math.min(12, Math.max(1.5, Number(v) / 100))))} />
                      </td>
                      <td className="num">{formatArea(polygonArea(r.points))}</td>
                      <td>
                        <input type="checkbox" checked={r.living} aria-label={t('{name} counts as living area', { name: t(r.name) })} onChange={(e) => edit(r.id, (x) => void (x.living = e.target.checked))} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        <div className="row end">
          <button className="primary" onClick={close}>
            {t('Done')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Snapshots -----------------------------------------------------------------------------------------------------------------------------

const when = (t: number) => new Date(t).toLocaleString(localeOf(), { dateStyle: 'medium', timeStyle: 'short' });

/** Named copies of the design, and what changed since each of them. */
export function SnapshotsDialog() {
  const design = useDesign((s) => s.design);
  const compare = useUi((s) => s.compare);
  const [list, setList] = useState<Snapshot[]>(() => loadSnapshots(design.id));
  const [name, setName] = useState('');
  const refresh = () => setList(loadSnapshots(design.id));

  const take = () => {
    if (!saveSnapshot(design, name || t('Snapshot {value}', { value: list.length + 1 }))) useUi.getState().showToast(t('Could not keep the snapshot: the browser storage is full. Delete an old one first.'));
    setName('');
    refresh();
  };
  const restore = (s: Snapshot) => {
    if (isLive()) return useUi.getState().showToast(t('Leave the live session first: going back replaces the whole plan.'));
    const old = snapshotDesign(s);
    if (!old) return useUi.getState().showToast(t('That snapshot cannot be read.'));
    // one undo step brings the present back; the snapshot is replaced into the design item by item
    useDesign.getState().update((d) => {
      const { id: _id, ...rest } = old;
      void _id;
      Object.assign(d, rest);
    });
    useUi.getState().select(null);
    useUi.getState().setCompare(null);
    close();
    useUi.getState().showToast(t('Went back to "{name}". Undo (Ctrl+Z) brings the current plan back.', { name: s.name }));
  };
  const show = (s: Snapshot) => {
    const old = snapshotDesign(s);
    if (!old) return;
    useUi.getState().setCompare({ name: s.name, diff: diffDesigns(old, design) });
  };
  const diff = compare?.diff;

  return (
    <div className="modal-backdrop" onMouseDown={close}>
      <div className="modal wide" role="dialog" aria-label={t('Snapshots')} onMouseDown={(e) => e.stopPropagation()} data-testid="snapshots-dialog">
        <h2>{t('Snapshots')}</h2>
        <p className="muted">{t('A snapshot is a named copy of the plan as it is now, kept in this browser. Compare it with the plan later, or go back to it.')}</p>
        <div className="row">
          <input type="text" placeholder={t('Name, e.g. Before moving the kitchen')} value={name} onChange={(e) => setName(e.target.value)} style={{ flex: 1 }} aria-label={t('Name of the snapshot')} data-testid="snapshot-name" onKeyDown={(e) => e.key === 'Enter' && take()} />
          <button className="primary" onClick={take} data-testid="snapshot-take">
            {t('Keep a snapshot')}
          </button>
        </div>
        {list.length === 0 ? (
          <p className="muted">{t('No snapshots yet.')}</p>
        ) : (
          <ul className="find-list" data-testid="snapshot-list">
            {list.map((s) => (
              <li key={s.id} className="snapshot-row" data-testid="snapshot-row">
                <span>
                  <strong>{s.name}</strong> <span className="muted">{when(s.time)}</span>
                </span>
                <span className="row">
                  <button onClick={() => show(s)} data-testid="snapshot-compare">
                    {t('Compare')}
                  </button>
                  <button onClick={() => restore(s)} data-testid="snapshot-restore">
                    {t('Go back to this')}
                  </button>
                  <button
                    onClick={() => {
                      deleteSnapshot(design.id, s.id);
                      refresh();
                    }}
                    aria-label={t('Delete {name}', { name: s.name })}
                  >
                    ✕
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
        {compare && diff && (
          <div className="compare-box" data-testid="compare-result">
            <h3>{t('Since “{name}”', { name: compare.name })}</h3>
            {diffCount(diff) === 0 ? (
              <p className="ok">{t('Nothing is different.')}</p>
            ) : (
              <p>
                <span className="diff-added">{t('{length} added', { length: diff.added.length })}</span> · <span className="diff-changed">{t('{length} changed', { length: diff.changed.length })}</span> · <span className="diff-removed">{t('{length} removed', { length: diff.removed.length })}</span>{t('. They are marked on the plan (green, orange, red dashed).')}
              </p>
            )}
            <button onClick={() => useUi.getState().setCompare(null)} data-testid="compare-clear">
              {t('Stop showing the differences')}
            </button>
          </div>
        )}
        <div className="row end">
          <button className="primary" onClick={close}>
            {t('Close')}
          </button>
        </div>
      </div>
    </div>
  );
}
