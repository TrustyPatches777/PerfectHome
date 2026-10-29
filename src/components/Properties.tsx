import { useState } from 'react';
import { isGround, isTerrainZone, planeAt, stairBase, zonePlane } from '../terrain';
import { floorElevations } from '../view3d/build';
import { CUSTOM_PREFIX, catalogItem, FURNITURE_COLORS, furnitureHeight } from '../catalog';
import { CHIMNEY_LABEL, CHIMNEY_STYLES, HANDLE_STYLES, type ChimneyStyle, type HandleStyle } from '../model';
import { CEILING_LABEL, CEILING_STYLES, ROOM_TYPES, ROOM_TYPE_LABEL, isSingleDoor, type CeilingStyle, type RoomType } from '../model';
import { deleteSelection, duplicateSelection, isLayerLocked, mirrorSelection, reshapeWall, selectAllLike, spaceWallOpenings, splitWallAt } from '../actions';
import { setWallLength } from '../canvas/editing';
import { FLOOR_COLORS } from '../canvas/style';
import { clampOpeningPos, detectRoom, dist, formatArea, formatLength, openingOverlaps, polygonArea, wallLength } from '../geometry';
import { FINISH_STYLES, PAINT_COLORS, WALL_STYLE } from '../walls';
import { WALL_FINISHES, type WallFinish } from '../model';
import { newId, STRIP_KINDS, type Note, WALL_TYPES, WALL_TYPE_HEIGHT, WALL_TYPE_THICKNESS, ZONE_KINDS, type Wall, type WallType, type Furniture, type ItemRef, type Opening, type OpeningKind, type Room, type Strip, type StripKind, type TextLabel, type Zone, type ZoneKind } from '../model';
import { PATH_SURFACES, STRIP_STYLES, ZONE_STYLES, gateSpans, polylineLength } from '../outdoor';
import { GATE_KINDS, PATH_SURFACE_KINDS, type GateKind, type PathSurface } from '../model';
import { RAIL_HEIGHT_DEFAULT, RAIL_LOOKS, STAIR_BUILD_LABEL, STAIR_DEFAULTS, STAIR_LOOKS, checkStair, flightSplit, stairColors } from '../stairs';
import { OPENING_HEAD, WINDOW_SPEC, isWindowKind } from '../windows';
import { ROOF_KINDS, ROOF_MATERIALS, type Roof, type RoofKind, type RoofMaterial } from '../model';
import { ROOF_MATERIAL_STYLES, ROOF_STYLES } from '../roofs';
import { moveRoofToFloor, refitRoof, setRoofKind, setRoofMaterial, turnRoof } from '../roofActions';
import { SIZES_OF } from '../roofActions';
import { skylightPlacement } from '../roofs';
import type { Skylight } from '../model';
import { RAIL_STYLES, STAIR_BUILDS, STAIR_KINDS, STAIR_MATERIALS, type RailStyle, type Stair, type StairBuild, type StairKind, type StairMaterial } from '../model';
import { useDesign } from '../store/design';
import { useOnFloor } from '../store/floor';
import { useUi } from '../store/ui';
import { ColorField, NumberField, TextField } from './fields';
import { GroupPanel } from './GroupPanel';
import { FacadeBox } from './FacadeBox';
import { FloorExtras, SkinExtras } from './CoveringFields';
import { MATERIAL_COLORS, MaterialPicker } from './MaterialPicker';
import { t, localize, localeOf } from '../i18n';

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
  skylight: 'Skylight',
  note: 'Sticky note',
  guide: 'Guide',
};
localize(TITLES, '*');

const OPENING_TYPES: [OpeningKind, string][] = [
  ['door', 'Interior door'],
  ['main', 'Main (front) door'],
  ['garden', 'Garden door'],
  ['double', 'Double door'],
  ['french', 'French door'],
  ['sliding', 'Sliding door'],
  ['window', 'Window'],
  ['casement', 'Casement window'],
  ['sash', 'Sash window'],
  ['picture', 'Picture window'],
  ['bay', 'Bay window'],
  ['highwin', 'High window'],
  ['floorwin', 'Floor-to-ceiling window'],
  ['garage', 'Garage door'],
  ['gap', 'Open passage'],
];
localize(OPENING_TYPES, ['1']);

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
      {locked && <p className="notice">{t('This layer is locked. Unlock it in Layers to edit.')}</p>}
      <fieldset disabled={locked}>
        {sel.kind === 'wall' && <WallProps id={sel.id} />}
        {sel.kind === 'opening' && <OpeningProps id={sel.id} />}
        {sel.kind === 'room' && <RoomProps id={sel.id} />}
        {sel.kind === 'furniture' && <FurnitureProps id={sel.id} />}
        {sel.kind === 'zone' && <ZoneProps id={sel.id} />}
        {sel.kind === 'stair' && <StairProps id={sel.id} />}
        {sel.kind === 'roof' && <RoofProps id={sel.id} />}
        {sel.kind === 'skylight' && <SkylightProps id={sel.id} />}
        {sel.kind === 'guide' && <GuideProps id={sel.id} />}
        {sel.kind === 'note' && <NoteProps id={sel.id} />}
        {sel.kind === 'strip' && <StripProps id={sel.id} />}
        {sel.kind === 'label' && <LabelProps id={sel.id} />}
        {sel.kind === 'dimension' && <DimensionProps id={sel.id} />}
        <div className="row actions">
          {sel.kind !== 'opening' && sel.kind !== 'guide' && sel.kind !== 'note' && (
            <>
              <button onClick={() => mirrorSelection('x')} title={t('Turn it over left-right (H)')} data-testid="mirror-x">
                {t('Mirror ⇆')}
              </button>
              <button onClick={() => mirrorSelection('y')} title={t('Turn it over top-bottom (Shift+H)')} data-testid="mirror-y">
                {t('Mirror ⇅')}
              </button>
            </>
          )}
          {sel.kind !== 'guide' && (
            <button onClick={() => selectAllLike(sel)} title={t('Select everything of the same kind on this floor')} data-testid="select-like">
              {t('Select all like this')}
            </button>
          )}
        </div>
        <div className="row actions">
          {sel.kind !== 'opening' && sel.kind !== 'guide' && sel.kind !== 'note' && (
            <button onClick={duplicateSelection} title={t('Ctrl+D')} data-testid="duplicate">
              {t('Duplicate')}
            </button>
          )}
          <button className="danger" onClick={deleteSelection} title={t('Delete')} data-testid="delete">
            {t('Delete')}
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
      <h3>{t('Properties')}</h3>
      <p className="muted">{t('Click something on the plan to edit it.')}</p>
      {rooms.length > 0 && (
        <p className="muted" data-testid="total-area">
          {t('{length} room{value} · total {area}', { length: rooms.length, value: rooms.length > 1 ? 's' : '', area: formatArea(total) })}
        </p>
      )}
      <button onClick={() => useUi.getState().setDialog({ type: 'areas' })} data-testid="open-areas">
        {t('Area table & plot figures…')}
      </button>
      <FacadeBox />
    </div>
  );
}

function WallProps({ id }: { id: string }) {
  const wall = useDesign((s) => s.design.walls.find((w) => w.id === id));
  const [keep, setKeep] = useState<'l' | 'r' | 'middle'>('middle');
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
        <span>{t('Type')}</span>
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
        <NumberField label={t('Thickness')} value={wall.thickness} scale={100} unit="cm" min={2} max={100} testId="wall-thickness" onCommit={(v) => reshapeWall(id, { thickness: v, keep })} />
        <NumberField label={t('Height')} value={wall.height} scale={100} unit="cm" min={10} max={3000} testId="wall-height" onCommit={(v) => edit((w) => void (w.height = v))} />
      </div>
      {curved ? (
        <p className="stat" data-testid="wall-length-curved">
          {t('Length along the curve ')} <strong>{formatLength(wallLength(wall))}</strong>
        </p>
      ) : (
        <NumberField label={t('Length')} value={wallLength(wall)} scale={100} unit="cm" min={5} testId="wall-length" onCommit={(v) => setWallLength(id, v)} />
      )}
      <NumberField
        label={t('Curve (sideways bulge)')}
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
          {t('Make straight')}
        </button>
      )}
      <p className="muted">{t('Drag the filled dot in the middle of a selected wall to bend it.')}</p>
      <WallTools wall={wall} keep={keep} setKeep={setKeep} />
      {(['l', 'r'] as const).map((side) => {
        const skin = wall.paint?.[side];
        return (
          <div className="field" key={side}>
            <span>{t('{value} (looking from the start of the wall to its end)', { value: side === 'l' ? t('Left face') : t('Right face') })}</span>
            <select
              value={skin?.finish ?? 'none'}
              data-testid={`wall-finish-${side}`}
              onChange={(e) =>
                edit((w) => {
                  const v = e.target.value;
                  if (v === 'none') {
                    if (w.paint) delete w.paint[side];
                    if (w.paint && !w.paint.l && !w.paint.r) delete w.paint;
                  } else w.paint = { ...w.paint, [side]: { finish: v as WallFinish, color: skin?.color ?? FINISH_STYLES[v as WallFinish].color } };
                })
              }
            >
              <option value="none">{t('Plain')}</option>
              {WALL_FINISHES.map((f) => (
                <option key={f} value={f}>
                  {FINISH_STYLES[f].label}
                </option>
              ))}
            </select>
            {skin && <ColorField label={t('Color')} value={skin.color} swatches={PAINT_COLORS} onChange={(c) => edit((w) => void (w.paint = { ...w.paint, [side]: { ...skin, color: c } }))} />}
            {skin && <SkinExtras skin={skin} side={side} edit={(fn) => edit((w) => { const s = w.paint?.[side]; if (s) fn(s); })} />}
          </div>
        );
      })}
    </>
  );
}

const HANDLE_LABEL: Record<HandleStyle, string> = { lever: 'Lever', knob: 'Round knob', bar: 'Long bar' };
localize(HANDLE_LABEL, '*');
const FRAME_SWATCHES2 = ['#a5835a', '#6b4a2f', '#3b2f27', '#e5e7eb', '#1f2937', '#9ca3af', '#c9a24a', '#7c2d12'];
const FRAME_SWATCHES = ['#f8fafc', '#6b4a2f', '#1f2937', '#9ca3af', '#7c2d12', '#1e3a5f'];

/** The cutting, moving and spacing tools of one wall. */
function WallTools({ wall, keep, setKeep }: { wall: Wall; keep: 'l' | 'r' | 'middle'; setKeep: (k: 'l' | 'r' | 'middle') => void }) {
  const all = useDesign((s) => s.design.openings);
  const openings = all.filter((o) => o.wallId === wall.id);
  const L = wallLength(wall);
  return (
    <>
      <label className="field">
        <span>{t('When the thickness changes, this stays put')}</span>
        <select value={keep} onChange={(e) => setKeep(e.target.value as 'l' | 'r' | 'middle')} data-testid="wall-keep">
          <option value="middle">{t('The middle of the wall')}</option>
          <option value="l">{t('The left face (so the wall grows to the right)')}</option>
          <option value="r">{t('The right face (so the wall grows to the left)')}</option>
        </select>
      </label>
      <NumberField label={t('Move sideways (to the right: +)')} value={0} scale={100} unit="cm" min={-2000} max={2000} testId="wall-offset" onCommit={(v) => v && reshapeWall(wall.id, { offset: v })} />
      <div className="row">
        <button onClick={() => splitWallAt(wall.id, L / 2)} title={t('Cut this wall in two, in the middle')} data-testid="wall-split-mid">
          {t('Cut in two')}
        </button>
        {openings.length > 1 && (
          <button onClick={() => spaceWallOpenings(wall.id)} title={t('Equal gaps between its doors and windows and to the ends of the wall')} data-testid="wall-space">
            {t('Space its openings evenly')}
          </button>
        )}
      </div>
      <NumberField label={t('Cut at (cm from the start)')} value={Math.round(L * 50) / 100} scale={100} unit="cm" min={5} max={Math.max(10, L * 100 - 5)} testId="wall-split-at" onCommit={(v) => splitWallAt(wall.id, v)} />
    </>
  );
}

/** Heights of a door or window (sill and lintel), an arched top and the color of its frame. */
function OpeningHeights({ opening, edit }: { opening: Opening; edit: (fn: (o: Opening) => void) => void }) {
  const window = isWindowKind(opening.kind) && opening.kind !== 'bay';
  const solid = opening.kind !== 'gap' && opening.kind !== 'garage';
  return (
    <>
      {window && <NumberField label={t('Sill height (bottom of the glass)')} value={opening.sill ?? WINDOW_SPEC[opening.kind as keyof typeof WINDOW_SPEC].sill} scale={100} unit="cm" min={0} max={250} testId="opening-sill" onCommit={(v) => edit((o) => void (o.sill = v))} />}
      <NumberField label={t('Top of the opening (lintel)')} value={opening.head ?? OPENING_HEAD[opening.kind]} scale={100} unit="cm" min={60} max={400} testId="opening-head" onCommit={(v) => edit((o) => void (o.head = v))} />
      {(opening.sill !== undefined || opening.head !== undefined) && (
        <button onClick={() => edit((o) => { delete o.sill; delete o.head; })} data-testid="opening-heights-reset">
          {t('Back to the usual heights')}
        </button>
      )}
      {solid && (
        <label className="check">
          <input type="checkbox" checked={!!opening.arch} data-testid="opening-arch" onChange={(e) => edit((o) => (e.target.checked ? void (o.arch = true) : void delete o.arch))} />
          {t('Round-topped (an arch)')}
        </label>
      )}
      {isSingleDoor(opening.kind) && (
        <label className="field">
          <span>{t('Handle')}</span>
          <select value={opening.handle ?? ''} data-testid="opening-handle" onChange={(e) => edit((o) => (e.target.value ? void (o.handle = e.target.value as HandleStyle) : void delete o.handle))}>
            <option value="">{t('The usual')}</option>
            {HANDLE_STYLES.map((h) => (
              <option key={h} value={h}>
                {HANDLE_LABEL[h]}
              </option>
            ))}
          </select>
        </label>
      )}
      {solid && (
        <label className="check" title={t('Boards round the opening on both faces of the wall')}>
          <input type="checkbox" checked={!!opening.trim} data-testid="opening-trim" onChange={(e) => edit((o) => (e.target.checked ? void (o.trim = '#f8fafc') : void delete o.trim))} />
          {t('Trim round the frame')}
        </label>
      )}
      {opening.trim && <ColorField label={t('Trim color')} value={opening.trim} swatches={FRAME_SWATCHES} onChange={(c) => edit((o) => void (o.trim = c))} />}
      {window && opening.kind !== 'highwin' && opening.kind !== 'floorwin' && (
        <label className="check" title={t('Louvered shutters folded back beside the window, on the side it opens to')}>
          <input type="checkbox" checked={!!opening.shutters} data-testid="opening-shutters" onChange={(e) => edit((o) => (e.target.checked ? void (o.shutters = '#3f6b4f') : void delete o.shutters))} />
          {t('Shutters')}
        </label>
      )}
      {opening.shutters && <ColorField label={t('Shutter color')} value={opening.shutters} swatches={['#3f6b4f', '#1f2937', '#6b4a2f', '#f8fafc', '#1e3a5f', '#7c2d12']} onChange={(c) => edit((o) => void (o.shutters = c))} />}
      {solid && <ColorField label={t('Frame color')} value={opening.frame ?? '#f8fafc'} swatches={FRAME_SWATCHES} onChange={(c) => edit((o) => void (o.frame = c))} />}
      {opening.frame && (
        <button onClick={() => edit((o) => void delete o.frame)} data-testid="opening-frame-reset">
          {t('Plain white frame')}
        </button>
      )}
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
        <span>{t('Type')}</span>
        <select value={opening.kind} data-testid="opening-kind" onChange={(e) => edit((o) => void (o.kind = e.target.value as OpeningKind))}>
          {OPENING_TYPES.map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <NumberField
        label={t('Width')}
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
        label={t('Distance from wall start')}
        value={opening.pos}
        scale={100}
        unit="cm"
        testId="opening-pos"
        onCommit={(v) => {
          const pos = clampOpeningPos(v, opening.width, L);
          const others = useDesign.getState().design.openings.filter((o) => o.wallId === wall.id);
          if (openingOverlaps(others, pos, opening.width, id)) useUi.getState().showToast(t('That spot is taken.'));
          else edit((o) => void (o.pos = pos));
        }}
      />
      <OpeningHeights opening={opening} edit={edit} />
      {(isSingleDoor(opening.kind) || opening.kind === 'double') && (
        <div className="row">
          <button onClick={() => edit((o) => void (o.swing = o.swing === 1 ? -1 : 1))} data-testid="flip-swing">
            {t('Flip swing')}
          </button>
          {isSingleDoor(opening.kind) && (
            <button onClick={() => edit((o) => void (o.hinge = o.hinge === 'a' ? 'b' : 'a'))} data-testid="flip-hinge">
              {t('Flip hinge')}
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
    else useUi.getState().showToast(t('The walls around this room are no longer closed.'));
  };
  return (
    <>
      <TextField label={t('Name')} value={t(room.name)} testId="room-name" onChange={(v) => edit((r) => void (r.name = v))} />
      <label className="field">
        <span>{t('What is it for?')}</span>
        <select value={room.type ?? ''} data-testid="room-type" onChange={(e) => edit((r) => (e.target.value ? void (r.type = e.target.value as RoomType) : void delete r.type))}>
          <option value="">{t('Not said')}</option>
          {ROOM_TYPES.map((t) => (
            <option key={t} value={t}>
              {ROOM_TYPE_LABEL[t]}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>{t('Ceiling')}</span>
        <select value={room.ceilingStyle ?? 'flat'} data-testid="room-ceiling-style" onChange={(e) => edit((r) => (e.target.value === 'flat' ? void delete r.ceilingStyle : void (r.ceilingStyle = e.target.value as CeilingStyle)))}>
          {CEILING_STYLES.map((c) => (
            <option key={c} value={c}>
              {CEILING_LABEL[c]}
            </option>
          ))}
        </select>
      </label>
      <NumberField label={t('Ceiling height')} value={room.ceiling ?? 2.5} scale={100} unit="cm" min={150} max={1200} testId="room-ceiling" onCommit={(v) => edit((r) => void (r.ceiling = v))} />
      <NumberField label={t("Floor level (cm above the storey's floor; a dais is +, a sunken area -)")} value={room.level ?? 0} scale={100} unit="cm" min={-300} max={300} testId="room-level" onCommit={(v) => edit((r) => (Math.abs(v) < 0.005 ? void delete r.level : void (r.level = v)))} />
      <button onClick={() => { useUi.getState().setSplitRoomId(id); useUi.getState().setTool('split-room'); useUi.getState().setSplitRoomId(id); }} title={t('Draw a line through the room to cut it in two')} data-testid="room-split">
        {t('Split this room…')}
      </button>
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
      <ColorField label={room.material === 'plain' ? t('Floor color') : t('Tint')} value={room.color} swatches={room.material === 'plain' ? FLOOR_COLORS : MATERIAL_SWATCHES} onChange={(c) => edit((r) => void (r.color = c))} />
      <FloorExtras room={room} edit={edit} />
      <label className="check">
        <input type="checkbox" checked={room.living} data-testid="room-living" onChange={(e) => edit((r) => void (r.living = e.target.checked))} />
        {t('Counts as living area')}
      </label>
      <p className="stat" data-testid="room-area">
        {t('Area ')} <strong>{formatArea(polygonArea(room.points))}</strong>
      </p>
      {room.seed && (
        <button onClick={refit} title={t('Re-measure the room after moving walls')} data-testid="refit-room">
          {t('Refit to walls')}
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
      <TextField label={t('Label')} value={item.label} testId="furn-label" placeholder={cat.label} onChange={(v) => edit((f) => void (f.label = v))} />
      <div className="row two">
        <NumberField label={t('Width')} value={item.w} scale={100} unit="cm" min={5} max={5000} testId="furn-w" onCommit={(v) => edit((f) => void (f.w = v))} />
        <NumberField label={t('Depth')} value={item.d} scale={100} unit="cm" min={5} max={5000} testId="furn-d" onCommit={(v) => edit((f) => void (f.d = v))} />
      </div>
      <NumberField
        label={t('Rotation')}
        value={item.rotation}
        unit="°"
        testId="furn-rotation"
        onCommit={(v) => edit((f) => void (f.rotation = ((v % 360) + 360) % 360))}
      />
      <ColorField label={t('Color')} value={item.color} swatches={FURNITURE_COLORS} onChange={(c) => edit((f) => void (f.color = c))} />
      <ColorField label={t('Frame / second color')} value={item.color2 ?? '#a5835a'} swatches={FRAME_SWATCHES2} onChange={(c) => edit((f) => void (f.color2 = c))} />
      {item.color2 && (
        <button onClick={() => edit((f) => void delete f.color2)} data-testid="furniture-color2-reset">
          {t('Back to the usual frame')}
        </button>
      )}
      <div className="row">
        <button onClick={() => edit((f) => void (f.rotation = (f.rotation + 90) % 360))} title="R">
          {t('Rotate 90°')}
        </button>
        <button
          onClick={() => edit((f) => void ([f.w, f.d] = [cat.w, cat.d]))}
          title={t('Back to the catalog size')}
        >
          {t('Reset size')}
        </button>
      </div>
      <NumberField
        label={t('Height (for shadows)')}
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
          {t('Switched on (glows in the evening)')}
        </label>
      )}
      <div className="row">
        {item.type.startsWith(CUSTOM_PREFIX) ? (
          <button onClick={() => useUi.getState().setDialog({ type: 'custom-item', editId: item.type.slice(CUSTOM_PREFIX.length) })} data-testid="edit-custom">
            {t('Edit this custom item…')}
          </button>
        ) : (
          <button onClick={() => saveAsCustom(item)} title={t('Keep this size, color and look in the palette under My items')} data-testid="save-as-custom">
            {t('Save as my item')}
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
      <TextField label={t('Text')} value={label.text} multiline focusSignal={focus} testId="label-text" onChange={(v) => edit((l) => void (l.text = v))} />
      <div className="row two">
        <NumberField label={t('Text size')} value={label.size} scale={100} unit="cm" min={5} max={500} testId="label-size" onCommit={(v) => edit((l) => void (l.size = v))} />
        <NumberField label={t('Rotation')} value={label.rotation} unit="°" testId="label-rotation" onCommit={(v) => edit((l) => void (l.rotation = ((v % 360) + 360) % 360))} />
      </div>
      <ColorField label={t('Color')} value={label.color} swatches={LABEL_COLORS} onChange={(c) => edit((l) => void (l.color = c))} />
    </>
  );
}

function DimensionProps({ id }: { id: string }) {
  const dim = useDesign((s) => s.design.dimensions.find((m) => m.id === id));
  if (!dim) return null;
  return (
    <p className="stat" data-testid="dimension-length">
      {t('Length ')} <strong>{formatLength(dist(dim.a, dim.b))}</strong>
    </p>
  );
}

function ZoneProps({ id }: { id: string }) {
  const zone = useDesign((s) => s.design.zones.find((z) => z.id === id));
  const design = useDesign((s) => s.design);
  if (!zone) return null;
  const onGround = isTerrainZone(design, zone);
  const plane = zonePlane(design, zone);
  const edit = (fn: (z: Zone) => void) =>
    useDesign.getState().update((d) => {
      const z = d.zones.find((x) => x.id === id);
      if (z) fn(z);
    });
  return (
    <>
      <TextField label={t('Name')} value={t(zone.name)} testId="zone-name" onChange={(v) => edit((z) => void (z.name = v))} />
      <label className="field">
        <span>{t('Type')}</span>
        <select value={zone.kind} data-testid="zone-kind" onChange={(e) => edit((z) => void (z.kind = e.target.value as ZoneKind))}>
          {ZONE_KINDS.map((k) => (
            <option key={k} value={k}>
              {ZONE_STYLES[k].label}
            </option>
          ))}
        </select>
      </label>
      <ColorField label={t('Color')} value={zone.color} swatches={ZONE_STYLES[zone.kind].swatches} onChange={(c) => edit((z) => void (z.color = c))} />
      {(zone.kind === 'balcony' || zone.kind === 'terrace') && (
        <label className="field">
          <span>{t('Railing round the free edges')}</span>
          <select value={zone.railing ?? 'none'} data-testid="zone-railing" onChange={(e) => edit((z) => (e.target.value === 'none' ? void delete z.railing : void (z.railing = e.target.value as RailStyle)))}>
            {RAIL_STYLES.map((r) => (
              <option key={r} value={r}>
                {r === 'none' ? t('None') : RAIL_LOOKS[r].label}
              </option>
            ))}
          </select>
        </label>
      )}
      {zone.kind === 'balcony' && <p className="muted">{t('A balcony lies at the level of the floor it is drawn on, outside the wall. Draw it on the upper floor, against the wall.')}</p>}
      {zone.kind === 'porch' && <NumberField label={t('Raised by')} value={zone.raise ?? 0.3} scale={100} unit="cm" min={0} max={150} testId="zone-raise" onCommit={(v) => edit((z) => void (z.raise = v))} />}
      {isGround(zone.kind) && onGround && (
        <>
          <NumberField
            label={t('Ground height (cm above the plot, below 0 = sunk)')}
            value={zone.height ?? plane.h}
            scale={100}
            unit="cm"
            min={-2000}
            max={4000}
            testId="zone-height"
            onCommit={(v) => edit((z) => void (z.height = v))}
          />
          {zone.height !== undefined && zone.kind !== 'lightwell' && (
            <button onClick={() => edit((z) => void delete z.height)} title={t('Take the level of the terrain under this area')} data-testid="zone-height-reset">
              {t('Same as the ground under it')}
            </button>
          )}
          <NumberField
            label={t('Slope (%)')}
            value={zone.slope?.pct ?? 0}
            min={0}
            max={100}
            testId="zone-slope"
            onCommit={(v) => edit((z) => (v >= 0.5 ? void (z.slope = { dir: z.slope?.dir ?? 90, pct: v }) : void delete z.slope))}
          />
          {zone.slope && (
            <NumberField label={t('Falls towards (° from east, 90 = south)')} value={zone.slope.dir} unit="°" min={0} max={359} testId="zone-slope-dir" onCommit={(v) => edit((z) => void (z.slope && (z.slope.dir = ((Math.round(v) % 360) + 360) % 360)))} />
          )}
          <p className="muted">{t('The ground is {value} cm in the middle of this area. Where two areas are at different levels a retaining wall stands between them.', { value: Math.round(planeAt(plane, plane.ref) * 100) })}</p>
        </>
      )}
      {isGround(zone.kind) && !onGround && <p className="muted">{t('An area on an upper floor lies at the level of that floor (a roof terrace). Ground height and slope are for areas drawn on the ground floor or the basement.')}</p>}
      <p className="stat" data-testid="zone-area">
        {t('Area ')} <strong>{formatArea(polygonArea(zone.points))}</strong>
      </p>
    </>
  );
}

const GATE_TYPE_LABEL: Record<GateKind, string> = { single: 'Single gate', double: 'Double gate', sliding: 'Sliding gate' };
localize(GATE_TYPE_LABEL, '*');

function StripProps({ id }: { id: string }) {
  const strip = useDesign((s) => s.design.strips.find((x) => x.id === id));
  if (!strip) return null;
  const edit = (fn: (s: Strip) => void) =>
    useDesign.getState().update((d) => {
      const x = d.strips.find((i) => i.id === id);
      if (x) fn(x);
    });
  const L = polylineLength(strip.points);
  const hasGates = strip.kind === 'fence' || strip.kind === 'hedge';
  // the first stretch of the line that is free for a new gate
  const freePos = (width: number): number | null => {
    const taken = gateSpans(strip);
    for (let pos = Math.min(L / 2, L - width / 2); pos >= width / 2 - 1e-6; pos -= 0.25) if (!taken.some((t) => pos - width / 2 < t.s1 && pos + width / 2 > t.s0)) return pos;
    for (let pos = L / 2; pos <= L - width / 2; pos += 0.25) if (!taken.some((t) => pos - width / 2 < t.s1 && pos + width / 2 > t.s0)) return pos;
    return null;
  };
  return (
    <>
      <label className="field">
        <span>{t('Type')}</span>
        <select
          value={strip.kind}
          data-testid="strip-kind"
          onChange={(e) =>
            edit((x) => {
              x.kind = e.target.value as StripKind;
              if (x.kind !== 'path') delete x.surface;
              if (x.kind === 'road' || x.kind === 'path') delete x.gates;
            })
          }
        >
          {STRIP_KINDS.map((k) => (
            <option key={k} value={k}>
              {STRIP_STYLES[k].label}
            </option>
          ))}
        </select>
      </label>
      {strip.kind === 'path' && (
        <label className="field">
          <span>{t('Made of')}</span>
          <select
            value={strip.surface ?? 'plain'}
            data-testid="strip-surface"
            onChange={(e) =>
              edit((x) => {
                if (e.target.value === 'plain') delete x.surface;
                else x.surface = e.target.value as PathSurface;
              })
            }
          >
            {PATH_SURFACE_KINDS.map((k) => (
              <option key={k} value={k}>
                {PATH_SURFACES[k].label}
              </option>
            ))}
          </select>
        </label>
      )}
      <NumberField label={t('Width')} value={strip.width} scale={100} unit="cm" min={2} max={5000} testId="strip-width" onCommit={(v) => edit((x) => void (x.width = v))} />
      <p className="stat" data-testid="strip-length">
        {t('Length ')} <strong>{formatLength(L)}</strong>
      </p>
      {hasGates && (
        <>
          {(strip.gates ?? []).map((g, i) => (
            <fieldset key={g.id} className="gate-box" data-testid={`gate-${i}`}>
              <label className="field">
                <span>{t('Gate {value}', { value: i + 1 })}</span>
                <select value={g.kind} data-testid={`gate-kind-${i}`} onChange={(e) => edit((x) => void (x.gates && (x.gates[i].kind = e.target.value as GateKind)))}>
                  {GATE_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {GATE_TYPE_LABEL[k]}
                    </option>
                  ))}
                </select>
              </label>
              <div className="row two">
                <NumberField label={t('Width')} value={g.width} scale={100} unit="cm" min={50} max={800} testId={`gate-width-${i}`} onCommit={(v) => edit((x) => void (x.gates && (x.gates[i].width = v)))} />
                <NumberField label={t('At')} value={g.pos} scale={100} unit="cm" min={0} max={Math.round(L * 100)} testId={`gate-pos-${i}`} onCommit={(v) => edit((x) => void (x.gates && (x.gates[i].pos = v)))} />
              </div>
              <div className="row">
                <button onClick={() => edit((x) => void (x.gates && (x.gates[i].swing = x.gates[i].swing === 1 ? -1 : 1)))} data-testid={`gate-swing-${i}`} title={t('Open to the other side of the fence')}>
                  {t('Opens the other way')}
                </button>
                {g.kind !== 'double' && (
                  <button onClick={() => edit((x) => void (x.gates && (x.gates[i].hinge = x.gates[i].hinge === 'a' ? 'b' : 'a')))} data-testid={`gate-hinge-${i}`} title={t('Hinge on the other post')}>
                    {t('Other hinge')}
                  </button>
                )}
                <button onClick={() => edit((x) => void (x.gates && x.gates.splice(i, 1)))} data-testid={`gate-delete-${i}`}>
                  {t('Remove')}
                </button>
              </div>
            </fieldset>
          ))}
          <button
            onClick={() => {
              const width = useUi.getState().gateWidth;
              const pos = freePos(width);
              if (pos === null) return useUi.getState().showToast(t('There is no room for a gate on this line.'));
              edit((x) => void (x.gates ??= []).push({ id: newId(), pos, width, kind: useUi.getState().gateKind, swing: 1, hinge: 'a' }));
            }}
            data-testid="add-gate"
          >
            {t('+ Add a gate')}
          </button>
        </>
      )}
    </>
  );
}

function RoofProps({ id }: { id: string }) {
  const roof = useDesign((s) => s.design.roofs.find((x) => x.id === id));
  const floors = useDesign((s) => s.design.floors);
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
        <span>{t('Type')}</span>
        <select value={roof.kind} data-testid="roof-kind" title={ROOF_STYLES[roof.kind].hint} onChange={(e) => setRoofKind(id, e.target.value as RoofKind)}>
          {ROOF_KINDS.map((k) => (
            <option key={k} value={k}>
              {ROOF_STYLES[k].label}
            </option>
          ))}
        </select>
      </label>
      <p className="muted">{ROOF_STYLES[roof.kind].hint}.</p>
      <label className="field">
        <span>{t('Sits on the walls of')}</span>
        <select value={roof.floor} data-testid="roof-floor" onChange={(e) => moveRoofToFloor(id, e.target.value)}>
          {floors.filter((f) => !f.attic).map((f) => (
            <option key={f.id} value={f.id}>
              {t(f.name)}
            </option>
          ))}
        </select>
      </label>
      <div className="row two">
        {!flatRoof && <NumberField label={t('Slope')} value={roof.pitch} unit="°" min={3} max={80} testId="roof-pitch" onCommit={(v) => edit((r) => void (r.pitch = v))} />}
        <NumberField label={t('Overhang')} value={roof.overhang} scale={100} unit="cm" min={0} max={300} testId="roof-overhang" onCommit={(v) => edit((r) => void (r.overhang = v))} />
      </div>
      <div className="row two">
        <NumberField label={t('Length (ridge)')} value={roof.w} scale={100} unit="cm" min={50} max={10000} testId="roof-w" onCommit={(v) => edit((r) => void (r.w = v))} />
        <NumberField label={t('Width')} value={roof.d} scale={100} unit="cm" min={50} max={10000} testId="roof-d" onCommit={(v) => edit((r) => void (r.d = v))} />
      </div>
      <div className="row two">
        <NumberField label={t('Rotation')} value={roof.rotation} unit="°" testId="roof-rotation" onCommit={(v) => edit((r) => void (r.rotation = ((v % 360) + 360) % 360))} />
        <NumberField label={t('Thickness')} value={roof.thickness} scale={100} unit="cm" min={3} max={80} testId="roof-thickness" onCommit={(v) => edit((r) => void (r.thickness = v))} />
      </div>
      <label className="field">
        <span>{t('Covering')}</span>
        <select value={roof.material} data-testid="roof-material" onChange={(e) => setRoofMaterial(id, e.target.value as RoofMaterial)}>
          {ROOF_MATERIALS.map((m) => (
            <option key={m} value={m}>
              {ROOF_MATERIAL_STYLES[m].label}
            </option>
          ))}
        </select>
      </label>
      <ColorField label={t('Color')} value={roof.color} swatches={ROOF_SWATCHES} onChange={(c) => edit((r) => void (r.color = c))} />
      {!flatRoof && (
        <label className="check">
          <input type="checkbox" checked={roof.chimney} data-testid="roof-chimney" onChange={(e) => edit((r) => void (r.chimney = e.target.checked))} />
          {t('Chimney')}
        </label>
      )}
      {roof.chimney && (
        <label className="field">
          <span>{t('Chimney style')}</span>
          <select value={roof.chimneyStyle ?? 'brick'} data-testid="roof-chimney-style" onChange={(e) => edit((r) => (e.target.value === 'brick' ? void delete r.chimneyStyle : void (r.chimneyStyle = e.target.value as ChimneyStyle)))}>
            {CHIMNEY_STYLES.map((c) => (
              <option key={c} value={c}>
                {CHIMNEY_LABEL[c]}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="check" title={t('A gutter along the eaves, with a downpipe at the corners')}>
        <input type="checkbox" checked={!!roof.gutters} data-testid="roof-gutters" onChange={(e) => edit((r) => (e.target.checked ? void (r.gutters = true) : void delete r.gutters))} />
        {t('Gutters and downpipes')}
      </label>
      <label className="check" title={t('A board along the edge of the roof')}>
        <input type="checkbox" checked={!!roof.fascia} data-testid="roof-fascia" onChange={(e) => edit((r) => (e.target.checked ? void (r.fascia = '#f1f5f9') : void delete r.fascia))} />
        {t('Fascia board')}
      </label>
      {roof.fascia && <ColorField label={t('Fascia color')} value={roof.fascia} swatches={['#f1f5f9', '#1f2937', '#6b4a2f', '#7c2d12', '#9ca3af', '#1e3a5f']} onChange={(c) => edit((r) => void (r.fascia = c))} />}
      {flatRoof && (
        <label className="check">
          <input type="checkbox" checked={roof.parapet} data-testid="roof-parapet" onChange={(e) => edit((r) => void (r.parapet = e.target.checked))} />
          {t('Low wall around the edge')}
        </label>
      )}
      <div className="row">
        <button onClick={() => refitRoof(id)} title={t('Resize and turn the roof to cover the walls of its floor')} data-testid="roof-fit">
          {t('Fit to walls')}
        </button>
        <button onClick={() => turnRoof(id)} title={t('Turn the ridge a quarter turn')} data-testid="roof-turn">
          {t('Turn ridge 90°')}
        </button>
      </div>
    </>
  );
}

function SkylightProps({ id }: { id: string }) {
  const sky = useDesign((s) => s.design.skylights.find((x) => x.id === id));
  const roofs = useDesign((s) => s.design.roofs);
  if (!sky) return null;
  const edit = (fn: (s: Skylight) => void) =>
    useDesign.getState().update((d) => {
      const x = d.skylights.find((i) => i.id === id);
      if (x) fn(x);
    });
  const spot = skylightPlacement(roofs, sky.floor, sky);
  return (
    <>
      <div className="row two">
        <NumberField label={t('Width')} value={sky.w} scale={100} unit="cm" min={20} max={500} testId="sky-w" onCommit={(v) => edit((s) => void (s.w = v))} />
        <NumberField label={sky.kind === 'dormer' ? t('Height of its front') : t('Length (up the slope)')} value={sky.d} scale={100} unit="cm" min={20} max={500} testId="sky-d" onCommit={(v) => edit((s) => void (s.d = v))} />
      </div>
      <div className="row three">
        {SIZES_OF[sky.kind ?? 'window'].map((s) => (
          <button key={s.label} onClick={() => edit((x) => void ((x.w = s.w), (x.d = s.d)))} data-testid={`sky-size-${s.label.toLowerCase()}`}>
            {s.label}
          </button>
        ))}
      </div>
      <p className={spot ? 'muted' : 'notice'} data-testid="sky-status">
        {spot ? sky.kind === 'dormer' ? spot.flat ? t('A dormer needs a sloping roof: it does not show on a flat one.') : t('A dormer on the slope of the roof.') : spot.flat ? t('On a flat roof: a raised window.') : t('Lies in the slope of the roof.') : t('Not on a roof: drag it onto one, or it will not show in 3D.')}
      </p>
    </>
  );
}

const RAIL_SWATCHES = ['#a5835a', '#6b4a2f', '#374151', '#9ca3af', '#e5e7eb', '#ffffff', '#1f2937', '#b45309'];
const STAIR_SWATCHES = ['#e5e7eb', '#c19a6b', '#6b4a2f', '#a8a29e', '#7b8794', '#bfe3f5', '#9a3b3b', '#f3f0ea', '#3b2f27'];

function StairProps({ id }: { id: string }) {
  const stair = useDesign((s) => s.design.stairs.find((x) => x.id === id));
  const storey = useDesign((s) => s.design.settings.storeyHeight);
  const design = useDesign((s) => s.design);
  if (!stair) return null;
  // steps outside the house start on the ground and can climb up to the floor of the house
  const floorElev = floorElevations(design).get(stair.floor) ?? 0;
  const toFloor = Math.round((floorElev - stairBase(design, stair, floorElev)) * 100) / 100;
  const edit = (fn: (s: Stair) => void) =>
    useDesign.getState().update((d) => {
      const x = d.stairs.find((i) => i.id === id);
      if (x) fn(x);
    });
  const check = checkStair(stair);
  const colors = stairColors(stair);
  const railing = stair.railing;
  return (
    <>
      <label className="field">
        <span>{t('Type')}</span>
        <select value={stair.kind} data-testid="stair-kind" onChange={(e) => edit((s) => void (s.kind = e.target.value as StairKind))}>
          {STAIR_KINDS.map((k) => (
            <option key={k} value={k}>
              {STAIR_DEFAULTS[k].label}
            </option>
          ))}
        </select>
      </label>
      {stair.kind !== 'spiral' && (
        <label className="field">
          <span>{t('Construction')}</span>
          <select
            value={stair.build ?? 'closed'}
            data-testid="stair-build"
            onChange={(e) =>
              edit((s) => {
                if (e.target.value === 'closed') delete s.build;
                else s.build = e.target.value as StairBuild;
              })
            }
          >
            {STAIR_BUILDS.map((b) => (
              <option key={b} value={b}>
                {STAIR_BUILD_LABEL[b]}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="field">
        <span>{t('Material')}</span>
        <select
          value={stair.material ?? 'concrete'}
          data-testid="stair-material"
          onChange={(e) =>
            edit((s) => {
              if (e.target.value === 'concrete') delete s.material;
              else s.material = e.target.value as StairMaterial;
              delete s.color; // a new material brings its own colors
              delete s.bodyColor;
            })
          }
        >
          {STAIR_MATERIALS.map((m) => (
            <option key={m} value={m}>
              {STAIR_LOOKS[m].label}
            </option>
          ))}
        </select>
      </label>
      <ColorField label={t('Tread color')} value={colors.tread} swatches={STAIR_SWATCHES} onChange={(c) => edit((s) => void (s.color = c))} />
      <ColorField label={stair.kind === 'spiral' ? t('Pole color') : t('Risers and beams')} value={colors.body} swatches={STAIR_SWATCHES} onChange={(c) => edit((s) => void (s.bodyColor = c))} />
      {(stair.color || stair.bodyColor) && (
        <button
          onClick={() =>
            edit((s) => {
              delete s.color;
              delete s.bodyColor;
            })
          }
          data-testid="stair-colors-reset"
        >
          {t('Use the material colors')}
        </button>
      )}
      <div className="row two">
        <NumberField label={t('Width')} value={stair.w} scale={100} unit="cm" min={40} max={2000} testId="stair-w" onCommit={(v) => edit((s) => void (s.w = v))} />
        <NumberField label={t('Length')} value={stair.d} scale={100} unit="cm" min={40} max={3000} testId="stair-d" onCommit={(v) => edit((s) => void (s.d = v))} />
      </div>
      <div className="row two">
        <NumberField label={t('Steps')} value={stair.steps} min={2} max={60} testId="stair-steps" onCommit={(v) => edit((s) => void (s.steps = Math.round(v)))} />
        <NumberField label={t('Total rise')} value={stair.rise} scale={100} unit="cm" min={20} max={1000} testId="stair-rise" onCommit={(v) => edit((s) => void (s.rise = v))} />
      </div>
      {(stair.kind === 'l' || stair.kind === 'winder' || stair.kind === 'u' || stair.kind === 'landing') && (
        <NumberField label={t('Steps in the first flight')} value={flightSplit(stair)[0]} min={1} max={58} testId="stair-first-flight" onCommit={(v) => edit((s) => void (s.firstFlight = Math.round(v)))} />
      )}
      <NumberField label={t('Rotation')} value={stair.rotation} unit="°" testId="stair-rotation" onCommit={(v) => edit((s) => void (s.rotation = ((v % 360) + 360) % 360))} />
      <label className="field">
        <span>{t('Railing')}</span>
        <select
          value={railing?.style ?? 'none'}
          data-testid="stair-railing"
          onChange={(e) =>
            edit((s) => {
              const style = e.target.value as RailStyle;
              if (style === 'none') delete s.railing;
              else s.railing = { ...(s.railing ?? { a: true, b: true }), style };
            })
          }
        >
          {RAIL_STYLES.map((r) => (
            <option key={r} value={r}>
              {r === 'none' ? t('None') : RAIL_LOOKS[r].label}
            </option>
          ))}
        </select>
      </label>
      {railing && (
        <>
          <div className="row">
            <label className="check">
              <input type="checkbox" checked={railing.a} data-testid="stair-rail-a" onChange={(e) => edit((s) => void (s.railing && (s.railing.a = e.target.checked)))} />
              {stair.kind === 'straight' ? t('Left rail') : t('Outer rail')}
            </label>
            {stair.kind !== 'spiral' && (
              <label className="check">
                <input type="checkbox" checked={railing.b} data-testid="stair-rail-b" onChange={(e) => edit((s) => void (s.railing && (s.railing.b = e.target.checked)))} />
                {stair.kind === 'straight' ? t('Right rail') : t('Inner rail')}
              </label>
            )}
          </div>
          <label className="check" title={t('The rail round the opening of the stair in the floor above')}>
            <input
              type="checkbox"
              checked={railing.guard !== false}
              data-testid="stair-rail-guard"
              onChange={(e) =>
                edit((s) => {
                  if (!s.railing) return;
                  if (e.target.checked) delete s.railing.guard;
                  else s.railing.guard = false;
                })
              }
            />
            {t('Rail round the stairwell upstairs')}
          </label>
          <NumberField
            label={t('Rail height')}
            value={railing.height ?? RAIL_HEIGHT_DEFAULT}
            scale={100}
            unit="cm"
            min={40}
            max={160}
            testId="stair-rail-height"
            onCommit={(v) => edit((s) => void (s.railing && (s.railing.height = v)))}
          />
          <ColorField label={t('Rail color')} value={railing.color ?? RAIL_LOOKS[railing.style as Exclude<RailStyle, 'none'>].color} swatches={RAIL_SWATCHES} onChange={(c) => edit((s) => void (s.railing && (s.railing.color = c)))} />
          {railing.color && (
            <button
              onClick={() =>
                edit((s) => {
                  if (s.railing) delete s.railing.color;
                })
              }
              data-testid="stair-rail-color-reset"
            >
              {t('Use the style color')}
            </button>
          )}
        </>
      )}
      <p className={check.ok ? 'ok' : 'notice'} data-testid="stair-check">
        {t('Step height {value} cm · tread {value2} cm. {message}', { value: (check.riser * 100).toFixed(1), value2: (check.going * 100).toFixed(0), message: check.message })}
      </p>
      <div className="row">
        {(stair.kind === 'l' || stair.kind === 'u') && (
          <button onClick={() => edit((s) => void (s.flip = !s.flip))} data-testid="stair-flip">
            {t('Flip direction')}
          </button>
        )}
        {toFloor > 0.05 && Math.abs(toFloor - stair.rise) > 0.01 && (
          <button onClick={() => edit((s) => void (s.rise = toFloor))} title={t('Make the steps climb exactly from the ground here up to the floor of the house')} data-testid="stair-reach-door">
            {t('Rise = up to the floor ({value} cm)', { value: Math.round(toFloor * 100) })}
          </button>
        )}
        <button onClick={() => edit((s) => void (s.rise = storey))} title={t('Use the storey height from the design')} data-testid="stair-match">
          {t('Rise = floor height ({value} cm)', { value: Math.round(storey * 100) })}
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
  useUi.getState().showToast(t('Saved “{value}” under My items in the Furniture tab.', { value: f.label || base.label }));
}

function GuideProps({ id }: { id: string }) {
  const guide = useDesign((s) => s.design.guides.find((g) => g.id === id));
  if (!guide) return null;
  return (
    <>
      <NumberField
        label={guide.axis === 'x' ? t('Position from the left (x)') : t('Position from the top (y)')}
        value={guide.pos}
        scale={100}
        unit="cm"
        testId="guide-pos"
        onCommit={(v) => useDesign.getState().update((d) => void (d.guides.find((g) => g.id === id)!.pos = v))}
      />
      <p className="muted">{t('Things you drag snap to guides. Drag a guide back onto the ruler to remove it.')}</p>
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
        {note.author || t('Someone')} · {new Date(note.time).toLocaleString(localeOf(), { dateStyle: 'medium', timeStyle: 'short' })}
      </p>
      <TextField label={t('Note')} value={note.text} multiline focusSignal={focus} testId="note-text" onChange={(v) => edit((n) => void (n.text = v))} />
      <button onClick={() => edit((n) => void (n.done = !n.done))} data-testid="note-done">
        {note.done ? t('Reopen') : t('Mark as done')}
      </button>
    </>
  );
}
