import { catalogItem, FURNITURE_COLORS } from '../catalog';
import { deleteSelection, duplicateSelection, isLayerLocked } from '../actions';
import { setWallLength } from '../canvas/editing';
import { FLOOR_COLORS } from '../canvas/style';
import { clampOpeningPos, detectRoom, dist, formatArea, formatLength, openingOverlaps, polygonArea, wallFrame } from '../geometry';
import type { Furniture, ItemRef, Opening, Room, TextLabel } from '../model';
import { useDesign } from '../store/design';
import { useUi } from '../store/ui';
import { ColorField, NumberField, TextField } from './fields';

const TITLES: Record<ItemRef['kind'], string> = {
  wall: 'Wall',
  opening: 'Door / window',
  room: 'Room',
  furniture: 'Furniture',
  label: 'Text label',
  dimension: 'Measurement',
};

export function Properties() {
  const sel = useUi((s) => s.selection);
  const design = useDesign((s) => s.design);

  if (!sel) return <Summary />;
  const locked = isLayerLocked(sel.kind);

  return (
    <div className="panel" data-testid="properties">
      <h3>{TITLES[sel.kind]}</h3>
      {locked && <p className="notice">This layer is locked. Unlock it in Layers to edit.</p>}
      <fieldset disabled={locked}>
        {sel.kind === 'wall' && <WallProps id={sel.id} />}
        {sel.kind === 'opening' && <OpeningProps id={sel.id} />}
        {sel.kind === 'room' && <RoomProps id={sel.id} />}
        {sel.kind === 'furniture' && <FurnitureProps id={sel.id} />}
        {sel.kind === 'label' && <LabelProps id={sel.id} />}
        {sel.kind === 'dimension' && <DimensionProps id={sel.id} />}
        <div className="row actions">
          {sel.kind !== 'opening' && (
            <button onClick={duplicateSelection} title="Ctrl+D" data-testid="duplicate">
              Duplicate
            </button>
          )}
          <button className="danger" onClick={deleteSelection} title="Delete" data-testid="delete">
            Delete
          </button>
        </div>
      </fieldset>
      <span hidden>{design.id}</span>
    </div>
  );
}

function Summary() {
  const rooms = useDesign((s) => s.design.rooms);
  const total = rooms.reduce((sum, r) => sum + polygonArea(r.points), 0);
  return (
    <div className="panel">
      <h3>Properties</h3>
      <p className="muted">Click something on the plan to edit it.</p>
      {rooms.length > 0 && (
        <p className="muted" data-testid="total-area">
          {rooms.length} room{rooms.length > 1 ? 's' : ''} · total {formatArea(total)}
        </p>
      )}
    </div>
  );
}

function WallProps({ id }: { id: string }) {
  const wall = useDesign((s) => s.design.walls.find((w) => w.id === id));
  if (!wall) return null;
  return (
    <>
      <NumberField
        label="Thickness"
        value={wall.thickness}
        scale={100}
        unit="cm"
        min={2}
        max={100}
        testId="wall-thickness"
        onCommit={(v) => useDesign.getState().update((d) => void (d.walls.find((w) => w.id === id)!.thickness = v))}
      />
      <NumberField
        label="Length"
        value={wallFrame(wall).length}
        scale={100}
        unit="cm"
        min={5}
        testId="wall-length"
        onCommit={(v) => setWallLength(id, v)}
      />
    </>
  );
}

function OpeningProps({ id }: { id: string }) {
  const opening = useDesign((s) => s.design.openings.find((o) => o.id === id));
  const wall = useDesign((s) => s.design.walls.find((w) => w.id === opening?.wallId));
  if (!opening || !wall) return null;
  const L = wallFrame(wall).length;
  const edit = (fn: (o: Opening) => void) =>
    useDesign.getState().update((d) => {
      const o = d.openings.find((x) => x.id === id);
      if (o) fn(o);
    });
  return (
    <>
      <p className="muted">{opening.kind === 'door' ? 'Door' : 'Window'} · {formatLength(opening.width)} wide</p>
      <NumberField
        label="Width"
        value={opening.width}
        scale={100}
        unit="cm"
        min={30}
        max={Math.max(30, L * 100)}
        testId="opening-width"
        onCommit={(v) =>
          edit((o) => {
            o.width = v;
            o.pos = clampOpeningPos(o.pos, v, L);
          })
        }
      />
      <NumberField
        label="Distance from wall start"
        value={opening.pos}
        scale={100}
        unit="cm"
        testId="opening-pos"
        onCommit={(v) => {
          const pos = clampOpeningPos(v, opening.width, L);
          const others = useDesign.getState().design.openings.filter((o) => o.wallId === wall.id);
          if (openingOverlaps(others, pos, opening.width, id)) useUi.getState().showToast('That spot is taken.');
          else edit((o) => void (o.pos = pos));
        }}
      />
      {opening.kind === 'door' && (
        <div className="row">
          <button onClick={() => edit((o) => void (o.swing = o.swing === 1 ? -1 : 1))} data-testid="flip-swing">
            Flip swing
          </button>
          <button onClick={() => edit((o) => void (o.hinge = o.hinge === 'a' ? 'b' : 'a'))} data-testid="flip-hinge">
            Flip hinge
          </button>
        </div>
      )}
    </>
  );
}

function RoomProps({ id }: { id: string }) {
  const room = useDesign((s) => s.design.rooms.find((r) => r.id === id));
  if (!room) return null;
  const edit = (fn: (r: Room) => void) =>
    useDesign.getState().update((d) => {
      const r = d.rooms.find((x) => x.id === id);
      if (r) fn(r);
    });
  const refit = () => {
    const poly = room.seed && detectRoom(room.seed, useDesign.getState().design.walls);
    if (poly) edit((r) => void (r.points = poly));
    else useUi.getState().showToast('The walls around this room are no longer closed.');
  };
  return (
    <>
      <TextField label="Name" value={room.name} testId="room-name" onChange={(v) => edit((r) => void (r.name = v))} />
      <ColorField label="Floor color" value={room.color} swatches={FLOOR_COLORS} onChange={(c) => edit((r) => void (r.color = c))} />
      <p className="stat" data-testid="room-area">
        Area <strong>{formatArea(polygonArea(room.points))}</strong>
      </p>
      {room.seed && (
        <button onClick={refit} title="Re-measure the room after moving walls" data-testid="refit-room">
          Refit to walls
        </button>
      )}
    </>
  );
}

function FurnitureProps({ id }: { id: string }) {
  const item = useDesign((s) => s.design.furniture.find((f) => f.id === id));
  if (!item) return null;
  const edit = (fn: (f: Furniture) => void) =>
    useDesign.getState().update((d) => {
      const f = d.furniture.find((x) => x.id === id);
      if (f) fn(f);
    });
  const cat = catalogItem(item.type);
  return (
    <>
      <TextField label="Label" value={item.label} testId="furn-label" placeholder={cat.label} onChange={(v) => edit((f) => void (f.label = v))} />
      <div className="row two">
        <NumberField label="Width" value={item.w} scale={100} unit="cm" min={5} max={5000} testId="furn-w" onCommit={(v) => edit((f) => void (f.w = v))} />
        <NumberField label="Depth" value={item.d} scale={100} unit="cm" min={5} max={5000} testId="furn-d" onCommit={(v) => edit((f) => void (f.d = v))} />
      </div>
      <NumberField
        label="Rotation"
        value={item.rotation}
        unit="°"
        testId="furn-rotation"
        onCommit={(v) => edit((f) => void (f.rotation = ((v % 360) + 360) % 360))}
      />
      <ColorField label="Color" value={item.color} swatches={FURNITURE_COLORS} onChange={(c) => edit((f) => void (f.color = c))} />
      <div className="row">
        <button onClick={() => edit((f) => void (f.rotation = (f.rotation + 90) % 360))} title="R">
          Rotate 90°
        </button>
        <button
          onClick={() => edit((f) => void ([f.w, f.d] = [cat.w, cat.d]))}
          title="Back to the catalog size"
        >
          Reset size
        </button>
      </div>
    </>
  );
}

const LABEL_COLORS = ['#1f2937', '#6b7280', '#2f6fed', '#0f766e', '#b45309', '#d9363e', '#7c3aed'];

function LabelProps({ id }: { id: string }) {
  const label = useDesign((s) => s.design.labels.find((l) => l.id === id));
  const focus = useUi((s) => s.textFocus);
  if (!label) return null;
  const edit = (fn: (l: TextLabel) => void) =>
    useDesign.getState().update((d) => {
      const l = d.labels.find((x) => x.id === id);
      if (l) fn(l);
    });
  return (
    <>
      <TextField label="Text" value={label.text} multiline focusSignal={focus} testId="label-text" onChange={(v) => edit((l) => void (l.text = v))} />
      <div className="row two">
        <NumberField label="Text size" value={label.size} scale={100} unit="cm" min={5} max={500} testId="label-size" onCommit={(v) => edit((l) => void (l.size = v))} />
        <NumberField label="Rotation" value={label.rotation} unit="°" testId="label-rotation" onCommit={(v) => edit((l) => void (l.rotation = ((v % 360) + 360) % 360))} />
      </div>
      <ColorField label="Color" value={label.color} swatches={LABEL_COLORS} onChange={(c) => edit((l) => void (l.color = c))} />
    </>
  );
}

function DimensionProps({ id }: { id: string }) {
  const dim = useDesign((s) => s.design.dimensions.find((m) => m.id === id));
  if (!dim) return null;
  return (
    <p className="stat" data-testid="dimension-length">
      Length <strong>{formatLength(dist(dim.a, dim.b))}</strong>
    </p>
  );
}
