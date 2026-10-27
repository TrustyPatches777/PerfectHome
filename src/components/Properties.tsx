import { CUSTOM_PREFIX, catalogItem, FURNITURE_COLORS, furnitureHeight } from '../catalog';
import { deleteSelection, duplicateSelection, isLayerLocked } from '../actions';
import { setWallLength } from '../canvas/editing';
import { FLOOR_COLORS } from '../canvas/style';
import { clampOpeningPos, detectRoom, dist, formatArea, formatLength, openingOverlaps, polygonArea, wallLength } from '../geometry';
import { WALL_STYLE } from '../walls';
import { newId, STRIP_KINDS, type Note, WALL_TYPES, WALL_TYPE_HEIGHT, WALL_TYPE_THICKNESS, ZONE_KINDS, type Wall, type WallType, type Furniture, type ItemRef, type Opening, type OpeningKind, type Room, type Strip, type StripKind, type TextLabel, type Zone, type ZoneKind } from '../model';
import { STRIP_STYLES, ZONE_STYLES, polylineLength } from '../outdoor';
import { STAIR_DEFAULTS, checkStair } from '../stairs';
import { ROOF_KINDS, ROOF_MATERIALS, type Roof, type RoofKind, type RoofMaterial } from '../model';
import { ROOF_MATERIAL_STYLES, ROOF_STYLES } from '../roofs';
import { refitRoof, setRoofKind, setRoofMaterial, turnRoof } from '../roofActions';
import { STAIR_KINDS, type Stair, type StairKind } from '../model';
import { useDesign } from '../store/design';
import { useOnFloor } from '../store/floor';
import { useUi } from '../store/ui';
import { ColorField, NumberField, TextField } from './fields';
import { GroupPanel } from './GroupPanel';
import { MATERIAL_COLORS, MaterialPicker } from './MaterialPicker';

const ROOF_SWATCHES = ['#b5523b', '#4b5563', '#7b8794', '#6b5b4a', '#c9a86a', '#6d9a5b', '#9ca3af', '#2f3a4a', '#8c3b2c'];

const MATERIAL_SWATCHES = Object.values(MATERIAL_COLORS).concat(['#e8dcc8', '#8d6e4f', '#6b7280']);

const TITLES: Record<ItemRef['kind'], string> = {
  wall: 'Wall',
  opening: 'Door / window',
  room: 'Room',
  furniture: 'Furniture',
  label: 'Text label',
  dimension: 'Measurement',
  zone: 'Outdoor area',
  strip: 'Street / path / fence',
  stair: 'Stairs',
  roof: 'Roof',
  note: 'Sticky note',
  guide: 'Guide',
};

const OPENING_TYPES: [OpeningKind, string][] = [
  ['door', 'Door'],
  ['double', 'Double door'],
  ['french', 'French door'],
  ['sliding', 'Sliding door'],
  ['window', 'Window'],
  ['bay', 'Bay window'],
  ['garage', 'Garage door'],
  ['gap', 'Open passage'],
];

export function Properties() {
  const sel = useUi((s) => s.selection);
  const count = useUi((s) => s.selected.length);
  const design = useDesign((s) => s.design);

  if (count > 1) return <GroupPanel />;
  if (!sel) return <Summary />;
  const locked = isLayerLocked(sel);

  return (
    <div className="panel" data-testid="properties">
      <h3>{TITLES[sel.kind]}</h3>
      {locked && <p className="notice">This layer is locked. Unlock it in Layers to edit.</p>}
      <fieldset disabled={locked}>
        {sel.kind === 'wall' && <WallProps id={sel.id} />}
        {sel.kind === 'opening' && <OpeningProps id={sel.id} />}
        {sel.kind === 'room' && <RoomProps id={sel.id} />}
        {sel.kind === 'furniture' && <FurnitureProps id={sel.id} />}
        {sel.kind === 'zone' && <ZoneProps id={sel.id} />}
        {sel.kind === 'stair' && <StairProps id={sel.id} />}
        {sel.kind === 'roof' && <RoofProps id={sel.id} />}
        {sel.kind === 'guide' && <GuideProps id={sel.id} />}
        {sel.kind === 'note' && <NoteProps id={sel.id} />}
        {sel.kind === 'strip' && <StripProps id={sel.id} />}
        {sel.kind === 'label' && <LabelProps id={sel.id} />}
        {sel.kind === 'dimension' && <DimensionProps id={sel.id} />}
        <div className="row actions">
          {sel.kind !== 'opening' && sel.kind !== 'guide' && sel.kind !== 'note' && (
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
  const rooms = useOnFloor((d) => d.rooms);
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
      <button onClick={() => useUi.getState().setDialog({ type: 'areas' })} data-testid="open-areas">
        Area table &amp; plot figures…
      </button>
    </div>
  );
}

function WallProps({ id }: { id: string }) {
  const wall = useDesign((s) => s.design.walls.find((w) => w.id === id));
  if (!wall) return null;
  const edit = (fn: (w: Wall) => void) =>
    useDesign.getState().update((d) => {
      const w = d.walls.find((x) => x.id === id);
      if (w) fn(w);
    });
  const curved = !!wall.bulge;
  return (
    <>
      <label className="field">
        <span>Type</span>
        <select
          value={wall.type}
          data-testid="wall-type"
          onChange={(e) =>
            edit((w) => {
              const next = e.target.value as WallType;
              // keep a custom thickness/height; switch only when they were the old type's defaults
              if (Math.abs(w.thickness - WALL_TYPE_THICKNESS[w.type]) < 1e-6) w.thickness = WALL_TYPE_THICKNESS[next];
              if (Math.abs(w.height - WALL_TYPE_HEIGHT[w.type]) < 1e-6) w.height = WALL_TYPE_HEIGHT[next];
              w.type = next;
            })
          }
        >
          {WALL_TYPES.map((t) => (
            <option key={t} value={t} title={WALL_STYLE[t].hint}>
              {WALL_STYLE[t].label}
            </option>
          ))}
        </select>
      </label>
      <div className="row two">
        <NumberField label="Thickness" value={wall.thickness} scale={100} unit="cm" min={2} max={100} testId="wall-thickness" onCommit={(v) => edit((w) => void (w.thickness = v))} />
        <NumberField label="Height" value={wall.height} scale={100} unit="cm" min={10} max={3000} testId="wall-height" onCommit={(v) => edit((w) => void (w.height = v))} />
      </div>
      {curved ? (
        <p className="stat" data-testid="wall-length-curved">
          Length along the curve <strong>{formatLength(wallLength(wall))}</strong>
        </p>
      ) : (
        <NumberField label="Length" value={wallLength(wall)} scale={100} unit="cm" min={5} testId="wall-length" onCommit={(v) => setWallLength(id, v)} />
      )}
      <NumberField
        label="Curve (sideways bulge)"
        value={wall.bulge ?? 0}
        scale={100}
        unit="cm"
        min={-5000}
        max={5000}
        testId="wall-curve"
        onCommit={(v) =>
          edit((w) => {
            if (Math.abs(v) < 0.04) delete w.bulge;
            else w.bulge = v;
          })
        }
      />
      {curved && (
        <button onClick={() => edit((w) => void delete w.bulge)} data-testid="wall-straighten">
          Make straight
        </button>
      )}
      <p className="muted">Drag the filled dot in the middle of a selected wall to bend it.</p>
    </>
  );
}

function OpeningProps({ id }: { id: string }) {
  const opening = useDesign((s) => s.design.openings.find((o) => o.id === id));
  const wall = useDesign((s) => s.design.walls.find((w) => w.id === opening?.wallId));
  if (!opening || !wall) return null;
  const L = wallLength(wall);
  const edit = (fn: (o: Opening) => void) =>
    useDesign.getState().update((d) => {
      const o = d.openings.find((x) => x.id === id);
      if (o) fn(o);
    });
  return (
    <>
      <label className="field">
        <span>Type</span>
        <select value={opening.kind} data-testid="opening-kind" onChange={(e) => edit((o) => void (o.kind = e.target.value as OpeningKind))}>
          {OPENING_TYPES.map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
      </label>
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
      {(opening.kind === 'door' || opening.kind === 'double') && (
        <div className="row">
          <button onClick={() => edit((o) => void (o.swing = o.swing === 1 ? -1 : 1))} data-testid="flip-swing">
            Flip swing
          </button>
          {opening.kind === 'door' && (
            <button onClick={() => edit((o) => void (o.hinge = o.hinge === 'a' ? 'b' : 'a'))} data-testid="flip-hinge">
              Flip hinge
            </button>
          )}
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
      <MaterialPicker
        value={room.material}
        color={room.color}
        onChange={(m) =>
          edit((r) => {
            r.material = m;
            // a fresh material starts in a fitting color, unless the room has a color of its own
            if (m !== 'plain' && FLOOR_COLORS.includes(r.color)) r.color = MATERIAL_COLORS[m];
          })
        }
      />
      <ColorField label={room.material === 'plain' ? 'Floor color' : 'Tint'} value={room.color} swatches={room.material === 'plain' ? FLOOR_COLORS : MATERIAL_SWATCHES} onChange={(c) => edit((r) => void (r.color = c))} />
      <label className="check">
        <input type="checkbox" checked={room.living} data-testid="room-living" onChange={(e) => edit((r) => void (r.living = e.target.checked))} />
        Counts as living area
      </label>
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
      <NumberField
        label="Height (for shadows)"
        value={furnitureHeight(item)}
        scale={100}
        unit="cm"
        min={1}
        max={3000}
        testId="furn-height"
        onCommit={(v) => edit((f) => void (f.height = v))}
      />
      {cat.lamp && (
        <label className="check">
          <input type="checkbox" checked={item.on !== false} data-testid="lamp-on" onChange={(e) => edit((f) => void (e.target.checked ? delete f.on : (f.on = false)))} />
          Switched on (glows in the evening)
        </label>
      )}
      <div className="row">
        {item.type.startsWith(CUSTOM_PREFIX) ? (
          <button onClick={() => useUi.getState().setDialog({ type: 'custom-item', editId: item.type.slice(CUSTOM_PREFIX.length) })} data-testid="edit-custom">
            Edit this custom item…
          </button>
        ) : (
          <button onClick={() => saveAsCustom(item)} title="Keep this size, color and look in the palette under My items" data-testid="save-as-custom">
            Save as my item
          </button>
        )}
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

function ZoneProps({ id }: { id: string }) {
  const zone = useDesign((s) => s.design.zones.find((z) => z.id === id));
  if (!zone) return null;
  const edit = (fn: (z: Zone) => void) =>
    useDesign.getState().update((d) => {
      const z = d.zones.find((x) => x.id === id);
      if (z) fn(z);
    });
  return (
    <>
      <TextField label="Name" value={zone.name} testId="zone-name" onChange={(v) => edit((z) => void (z.name = v))} />
      <label className="field">
        <span>Type</span>
        <select value={zone.kind} data-testid="zone-kind" onChange={(e) => edit((z) => void (z.kind = e.target.value as ZoneKind))}>
          {ZONE_KINDS.map((k) => (
            <option key={k} value={k}>
              {ZONE_STYLES[k].label}
            </option>
          ))}
        </select>
      </label>
      <ColorField label="Color" value={zone.color} swatches={ZONE_STYLES[zone.kind].swatches} onChange={(c) => edit((z) => void (z.color = c))} />
      <p className="stat" data-testid="zone-area">
        Area <strong>{formatArea(polygonArea(zone.points))}</strong>
      </p>
    </>
  );
}

function StripProps({ id }: { id: string }) {
  const strip = useDesign((s) => s.design.strips.find((x) => x.id === id));
  if (!strip) return null;
  const edit = (fn: (s: Strip) => void) =>
    useDesign.getState().update((d) => {
      const x = d.strips.find((i) => i.id === id);
      if (x) fn(x);
    });
  return (
    <>
      <label className="field">
        <span>Type</span>
        <select value={strip.kind} data-testid="strip-kind" onChange={(e) => edit((x) => void (x.kind = e.target.value as StripKind))}>
          {STRIP_KINDS.map((k) => (
            <option key={k} value={k}>
              {STRIP_STYLES[k].label}
            </option>
          ))}
        </select>
      </label>
      <NumberField label="Width" value={strip.width} scale={100} unit="cm" min={2} max={5000} testId="strip-width" onCommit={(v) => edit((x) => void (x.width = v))} />
      <p className="stat" data-testid="strip-length">
        Length <strong>{formatLength(polylineLength(strip.points))}</strong>
      </p>
    </>
  );
}

function RoofProps({ id }: { id: string }) {
  const roof = useDesign((s) => s.design.roofs.find((x) => x.id === id));
  const floorName = useDesign((s) => s.design.floors.find((f) => f.id === roof?.floor)?.name ?? '');
  if (!roof) return null;
  const edit = (fn: (r: Roof) => void) =>
    useDesign.getState().update((d) => {
      const x = d.roofs.find((i) => i.id === id);
      if (x) fn(x);
    });
  const flatRoof = roof.kind === 'flat';
  return (
    <>
      <label className="field">
        <span>Type</span>
        <select value={roof.kind} data-testid="roof-kind" title={ROOF_STYLES[roof.kind].hint} onChange={(e) => setRoofKind(id, e.target.value as RoofKind)}>
          {ROOF_KINDS.map((k) => (
            <option key={k} value={k}>
              {ROOF_STYLES[k].label}
            </option>
          ))}
        </select>
      </label>
      <p className="muted">{ROOF_STYLES[roof.kind].hint}. Sits on the walls of: {floorName}.</p>
      <div className="row two">
        {!flatRoof && <NumberField label="Slope" value={roof.pitch} unit="°" min={3} max={80} testId="roof-pitch" onCommit={(v) => edit((r) => void (r.pitch = v))} />}
        <NumberField label="Overhang" value={roof.overhang} scale={100} unit="cm" min={0} max={300} testId="roof-overhang" onCommit={(v) => edit((r) => void (r.overhang = v))} />
      </div>
      <div className="row two">
        <NumberField label="Length (ridge)" value={roof.w} scale={100} unit="cm" min={50} max={10000} testId="roof-w" onCommit={(v) => edit((r) => void (r.w = v))} />
        <NumberField label="Width" value={roof.d} scale={100} unit="cm" min={50} max={10000} testId="roof-d" onCommit={(v) => edit((r) => void (r.d = v))} />
      </div>
      <div className="row two">
        <NumberField label="Rotation" value={roof.rotation} unit="°" testId="roof-rotation" onCommit={(v) => edit((r) => void (r.rotation = ((v % 360) + 360) % 360))} />
        <NumberField label="Thickness" value={roof.thickness} scale={100} unit="cm" min={3} max={80} testId="roof-thickness" onCommit={(v) => edit((r) => void (r.thickness = v))} />
      </div>
      <label className="field">
        <span>Covering</span>
        <select value={roof.material} data-testid="roof-material" onChange={(e) => setRoofMaterial(id, e.target.value as RoofMaterial)}>
          {ROOF_MATERIALS.map((m) => (
            <option key={m} value={m}>
              {ROOF_MATERIAL_STYLES[m].label}
            </option>
          ))}
        </select>
      </label>
      <ColorField label="Color" value={roof.color} swatches={ROOF_SWATCHES} onChange={(c) => edit((r) => void (r.color = c))} />
      {!flatRoof && (
        <label className="check">
          <input type="checkbox" checked={roof.chimney} data-testid="roof-chimney" onChange={(e) => edit((r) => void (r.chimney = e.target.checked))} />
          Chimney
        </label>
      )}
      {flatRoof && (
        <label className="check">
          <input type="checkbox" checked={roof.parapet} data-testid="roof-parapet" onChange={(e) => edit((r) => void (r.parapet = e.target.checked))} />
          Low wall around the edge
        </label>
      )}
      <div className="row">
        <button onClick={() => refitRoof(id)} title="Resize and turn the roof to cover the walls of its floor" data-testid="roof-fit">
          Fit to walls
        </button>
        <button onClick={() => turnRoof(id)} title="Turn the ridge a quarter turn" data-testid="roof-turn">
          Turn ridge 90°
        </button>
      </div>
    </>
  );
}

function StairProps({ id }: { id: string }) {
  const stair = useDesign((s) => s.design.stairs.find((x) => x.id === id));
  const storey = useDesign((s) => s.design.settings.storeyHeight);
  if (!stair) return null;
  const edit = (fn: (s: Stair) => void) =>
    useDesign.getState().update((d) => {
      const x = d.stairs.find((i) => i.id === id);
      if (x) fn(x);
    });
  const check = checkStair(stair);
  return (
    <>
      <label className="field">
        <span>Type</span>
        <select value={stair.kind} data-testid="stair-kind" onChange={(e) => edit((s) => void (s.kind = e.target.value as StairKind))}>
          {STAIR_KINDS.map((k) => (
            <option key={k} value={k}>
              {STAIR_DEFAULTS[k].label}
            </option>
          ))}
        </select>
      </label>
      <div className="row two">
        <NumberField label="Width" value={stair.w} scale={100} unit="cm" min={40} max={2000} testId="stair-w" onCommit={(v) => edit((s) => void (s.w = v))} />
        <NumberField label="Length" value={stair.d} scale={100} unit="cm" min={40} max={3000} testId="stair-d" onCommit={(v) => edit((s) => void (s.d = v))} />
      </div>
      <div className="row two">
        <NumberField label="Steps" value={stair.steps} min={2} max={60} testId="stair-steps" onCommit={(v) => edit((s) => void (s.steps = Math.round(v)))} />
        <NumberField label="Total rise" value={stair.rise} scale={100} unit="cm" min={20} max={1000} testId="stair-rise" onCommit={(v) => edit((s) => void (s.rise = v))} />
      </div>
      <NumberField label="Rotation" value={stair.rotation} unit="°" testId="stair-rotation" onCommit={(v) => edit((s) => void (s.rotation = ((v % 360) + 360) % 360))} />
      <p className={check.ok ? 'ok' : 'notice'} data-testid="stair-check">
        Step height {(check.riser * 100).toFixed(1)} cm · tread {(check.going * 100).toFixed(0)} cm. {check.message}
      </p>
      <div className="row">
        {(stair.kind === 'l' || stair.kind === 'u') && (
          <button onClick={() => edit((s) => void (s.flip = !s.flip))} data-testid="stair-flip">
            Flip direction
          </button>
        )}
        <button onClick={() => edit((s) => void (s.rise = storey))} title="Use the storey height from the design" data-testid="stair-match">
          Rise = floor height ({Math.round(storey * 100)} cm)
        </button>
      </div>
    </>
  );
}

/** Keep a placed (and maybe resized or recolored) piece as a reusable item in the palette. */
function saveAsCustom(f: Furniture) {
  const base = catalogItem(f.type);
  const id = newId();
  useDesign.getState().update((d) => {
    d.custom.push({ id, label: f.label || base.label, w: f.w, d: f.d, height: furnitureHeight(f), color: f.color, shape: 'symbol', base: f.type.startsWith(CUSTOM_PREFIX) ? undefined : f.type });
  });
  useUi.getState().showToast(`Saved “${f.label || base.label}” under My items in the Furniture tab.`);
}

function GuideProps({ id }: { id: string }) {
  const guide = useDesign((s) => s.design.guides.find((g) => g.id === id));
  if (!guide) return null;
  return (
    <>
      <NumberField
        label={guide.axis === 'x' ? 'Position from the left (x)' : 'Position from the top (y)'}
        value={guide.pos}
        scale={100}
        unit="cm"
        testId="guide-pos"
        onCommit={(v) => useDesign.getState().update((d) => void (d.guides.find((g) => g.id === id)!.pos = v))}
      />
      <p className="muted">Things you drag snap to guides. Drag a guide back onto the ruler to remove it.</p>
    </>
  );
}

function NoteProps({ id }: { id: string }) {
  const note = useDesign((s) => s.design.notes.find((n) => n.id === id));
  const focus = useUi((s) => s.textFocus);
  if (!note) return null;
  const edit = (fn: (n: Note) => void) =>
    useDesign.getState().update((d) => {
      const n = d.notes.find((x) => x.id === id);
      if (n) fn(n);
    });
  return (
    <>
      <p className="muted" data-testid="note-author">
        <span className="dot-inline" style={{ background: note.color }} />
        {note.author || 'Someone'} · {new Date(note.time).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
      </p>
      <TextField label="Note" value={note.text} multiline focusSignal={focus} testId="note-text" onChange={(v) => edit((n) => void (n.text = v))} />
      <button onClick={() => edit((n) => void (n.done = !n.done))} data-testid="note-done">
        {note.done ? 'Reopen' : 'Mark as done'}
      </button>
    </>
  );
}
