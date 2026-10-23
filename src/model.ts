/**
 * The whole data model. A design is ONE plain JSON object (`Design`).
 * Everything else (undo history, selection, viewport, active tool) is UI state and is never shared.
 *
 * Conventions
 *  - All lengths are in METERS. Angles are in DEGREES (clockwise, since the y axis points down).
 *  - World origin (0,0) is arbitrary; +x is right, +y is down (screen orientation).
 *  - Furniture/labels are positioned by their CENTER.
 *  - Everything you draw belongs to a floor (`floor` = Floor.id). Doors/windows belong to their wall's floor.
 *  - Bump SCHEMA_VERSION and extend `parseDesign` when the shape changes in a breaking way.
 */

export const SCHEMA_VERSION = 1;

export interface Point {
  x: number;
  y: number;
}

/** Layers can be hidden and locked. Locked layers cannot be selected or moved. */
export type LayerId = 'structure' | 'rooms' | 'outdoor' | 'furniture' | 'notes';
export const LAYER_IDS: LayerId[] = ['structure', 'rooms', 'outdoor', 'furniture', 'notes'];
export const LAYER_LABELS: Record<LayerId, string> = {
  structure: 'Walls, doors & windows',
  rooms: 'Rooms',
  outdoor: 'Garden, driveway & street',
  furniture: 'Furniture & vehicles',
  notes: 'Labels & measurements',
};

/** One level of the building. `Design.floors` is ordered from the lowest to the highest. */
export interface Floor {
  id: string;
  name: string;
}

export interface LayerState {
  visible: boolean;
  locked: boolean;
}

/** A straight wall segment between two centerline points. */
export interface Wall {
  id: string;
  floor: string;
  a: Point;
  b: Point;
  thickness: number;
}

/**
 * door = single door with swing arc, double = two leaves, window, garage = wide overhead/sliding door,
 * gap = open passage without a door.
 */
export type OpeningKind = 'door' | 'double' | 'window' | 'garage' | 'gap';
export const OPENING_KINDS: OpeningKind[] = ['door', 'double', 'window', 'garage', 'gap'];

/** A door, window or other opening cut into a wall. */
export interface Opening {
  id: string;
  wallId: string;
  kind: OpeningKind;
  /** Distance of the opening's center from wall point `a`, along the wall. */
  pos: number;
  width: number;
  /** Which side of the wall a door swings to: +1 = right of a→b direction (screen), -1 = left. */
  swing: 1 | -1;
  /** Which jamb the door is hinged on. */
  hinge: 'a' | 'b';
}

/** A named floor area. `points` is a closed polygon (implicitly closed). */
export interface Room {
  id: string;
  floor: string;
  name: string;
  color: string;
  points: Point[];
  /** A point inside the room, used to re-detect the outline from the walls. Absent for hand-drawn rooms. */
  seed?: Point;
}

export interface Furniture {
  id: string;
  floor: string;
  /** Key into the catalog (`catalog.ts`). Unknown keys render as a generic box. */
  type: string;
  x: number;
  y: number;
  /** Width (local x) and depth (local y), before rotation. */
  w: number;
  d: number;
  rotation: number;
  color: string;
  /** Overrides the catalog label when non-empty. */
  label: string;
}

export interface TextLabel {
  id: string;
  floor: string;
  text: string;
  x: number;
  y: number;
  /** Text height in meters. */
  size: number;
  rotation: number;
  color: string;
}

/** A measured distance, shown as a dimension line. */
export interface Dimension {
  id: string;
  floor: string;
  a: Point;
  b: Point;
}

/** A ground-surface area outside (or around) the house: lawn, terrace, driveway... drawn as a polygon. */
export type ZoneKind = 'lawn' | 'terrace' | 'driveway' | 'flowerbed' | 'water' | 'plot';
export const ZONE_KINDS: ZoneKind[] = ['lawn', 'terrace', 'driveway', 'flowerbed', 'water', 'plot'];

export interface Zone {
  id: string;
  floor: string;
  kind: ZoneKind;
  name: string;
  color: string;
  points: Point[];
}

/** A line feature with a width: street, footpath, fence or hedge. */
export type StripKind = 'road' | 'path' | 'fence' | 'hedge';
export const STRIP_KINDS: StripKind[] = ['road', 'path', 'fence', 'hedge'];
export const STRIP_DEFAULT_WIDTH: Record<StripKind, number> = { road: 6, path: 1.2, fence: 0.1, hedge: 0.6 };

export interface Strip {
  id: string;
  floor: string;
  kind: StripKind;
  /** Centerline, at least two points. */
  points: Point[];
  width: number;
}

export interface Settings {
  /** Snap step in meters. */
  gridStep: number;
  /** Thickness used for newly drawn walls. */
  wallThickness: number;
}

export interface Design {
  v: typeof SCHEMA_VERSION;
  /** Stable identity of the design across edits and shares. */
  id: string;
  name: string;
  settings: Settings;
  layers: Record<LayerId, LayerState>;
  /** Lowest floor first. Always at least one. */
  floors: Floor[];
  walls: Wall[];
  openings: Opening[];
  rooms: Room[];
  furniture: Furniture[];
  labels: TextLabel[];
  dimensions: Dimension[];
  zones: Zone[];
  strips: Strip[];
}

export type ItemKind = 'wall' | 'opening' | 'room' | 'furniture' | 'label' | 'dimension' | 'zone' | 'strip';
export interface ItemRef {
  kind: ItemKind;
  id: string;
}

export const LAYER_OF: Record<ItemKind, LayerId> = {
  wall: 'structure',
  opening: 'structure',
  room: 'rooms',
  furniture: 'furniture',
  label: 'notes',
  dimension: 'notes',
  zone: 'outdoor',
  strip: 'outdoor',
};

// ---------------------------------------------------------------------------
// Defaults & factories
// ---------------------------------------------------------------------------

export const DEFAULT_GRID_STEP = 0.1;
export const DEFAULT_WALL_THICKNESS = 0.15;
export const GRID_STEPS = [0.05, 0.1, 0.25, 0.5];

export function newId(): string {
  return Math.random().toString(36).slice(2, 9).padEnd(7, '0');
}

export function createDesign(): Design {
  return {
    v: SCHEMA_VERSION,
    id: newId() + newId(),
    name: 'My home',
    settings: { gridStep: DEFAULT_GRID_STEP, wallThickness: DEFAULT_WALL_THICKNESS },
    layers: {
      structure: { visible: true, locked: false },
      rooms: { visible: true, locked: false },
      outdoor: { visible: true, locked: false },
      furniture: { visible: true, locked: false },
      notes: { visible: true, locked: false },
    },
    floors: [{ id: newId(), name: 'Ground floor' }],
    walls: [],
    openings: [],
    rooms: [],
    furniture: [],
    labels: [],
    dimensions: [],
    zones: [],
    strips: [],
  };
}

// ---------------------------------------------------------------------------
// Validation (used for shared links, JSON import and autosave). Lenient: fixes
// what it can, throws only when the input clearly is not a design.
// ---------------------------------------------------------------------------

type Json = Record<string, unknown>;

const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);

function num(v: unknown, def: number, min = -1e6, max = 1e6): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : def;
}

function str(v: unknown, def: string, maxLen = 200): string {
  return typeof v === 'string' ? v.slice(0, maxLen) : def;
}

function color(v: unknown, def: string): string {
  return typeof v === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(v) ? v : def;
}

function point(v: unknown): Point {
  const o = isObj(v) ? v : {};
  return { x: num(o.x, 0), y: num(o.y, 0) };
}

function list<T>(v: unknown, map: (o: Json) => T | null): T[] {
  if (!Array.isArray(v)) return [];
  const out: T[] = [];
  for (const item of v) {
    if (!isObj(item)) continue;
    const r = map(item);
    if (r) out.push(r);
  }
  return out;
}

export function parseDesign(input: unknown): Design {
  if (!isObj(input) || typeof input.v !== 'number' || !Array.isArray(input.walls)) {
    throw new Error('Not a design: this is not a Perfect Home design.');
  }
  if (input.v > SCHEMA_VERSION) throw new Error('This design was made with a newer version of the app.');
  const base = createDesign();
  const settings = isObj(input.settings) ? input.settings : {};
  const layers = isObj(input.layers) ? input.layers : {};
  const outLayers = { ...base.layers };
  for (const id of LAYER_IDS) {
    const l = layers[id];
    if (isObj(l)) outLayers[id] = { visible: l.visible !== false, locked: l.locked === true };
  }

  // Floors: designs made before floors existed have none; everything then lives on one "Ground floor".
  const floors: Floor[] = [];
  for (const f of list<Floor>(input.floors, (o) => ({ id: str(o.id, newId(), 20), name: str(o.name, 'Floor', 60) }))) {
    if (!floors.some((x) => x.id === f.id)) floors.push(f);
  }
  if (!floors.length) floors.push({ id: newId(), name: 'Ground floor' });
  const floorIds = new Set(floors.map((f) => f.id));
  const floorOf = (v: unknown) => (typeof v === 'string' && floorIds.has(v) ? v : floors[0].id);

  const walls = list<Wall>(input.walls, (o) => ({
    id: str(o.id, newId(), 20),
    floor: floorOf(o.floor),
    a: point(o.a),
    b: point(o.b),
    thickness: num(o.thickness, DEFAULT_WALL_THICKNESS, 0.02, 1),
  }));
  const wallIds = new Set(walls.map((w) => w.id));

  return {
    v: SCHEMA_VERSION,
    id: str(input.id, base.id, 40),
    name: str(input.name, base.name, 80),
    settings: {
      gridStep: num(settings.gridStep, DEFAULT_GRID_STEP, 0.01, 5),
      wallThickness: num(settings.wallThickness, DEFAULT_WALL_THICKNESS, 0.02, 1),
    },
    layers: outLayers,
    floors,
    walls,
    openings: list<Opening>(input.openings, (o) =>
      wallIds.has(o.wallId as string)
        ? {
            id: str(o.id, newId(), 20),
            wallId: o.wallId as string,
            kind: OPENING_KINDS.includes(o.kind as OpeningKind) ? (o.kind as OpeningKind) : 'door',
            pos: num(o.pos, 0, 0),
            width: num(o.width, 0.9, 0.2, 5),
            swing: o.swing === -1 ? -1 : 1,
            hinge: o.hinge === 'b' ? 'b' : 'a',
          }
        : null,
    ),
    rooms: list<Room>(input.rooms, (o) => {
      const pts = Array.isArray(o.points) ? o.points.map(point) : [];
      if (pts.length < 3) return null;
      return {
        id: str(o.id, newId(), 20),
        floor: floorOf(o.floor),
        name: str(o.name, 'Room', 80),
        color: color(o.color, '#e8eef7'),
        points: pts,
        seed: isObj(o.seed) ? point(o.seed) : undefined,
      };
    }),
    furniture: list<Furniture>(input.furniture, (o) => ({
      id: str(o.id, newId(), 20),
      floor: floorOf(o.floor),
      type: str(o.type, 'box', 40),
      x: num(o.x, 0),
      y: num(o.y, 0),
      w: num(o.w, 1, 0.05, 50),
      d: num(o.d, 1, 0.05, 50),
      rotation: num(o.rotation, 0, -3600, 3600),
      color: color(o.color, '#cbd5e1'),
      label: str(o.label, '', 60),
    })),
    labels: list<TextLabel>(input.labels, (o) => ({
      id: str(o.id, newId(), 20),
      floor: floorOf(o.floor),
      text: str(o.text, 'Text', 500),
      x: num(o.x, 0),
      y: num(o.y, 0),
      size: num(o.size, 0.25, 0.05, 5),
      rotation: num(o.rotation, 0, -3600, 3600),
      color: color(o.color, '#1f2937'),
    })),
    dimensions: list<Dimension>(input.dimensions, (o) => ({
      id: str(o.id, newId(), 20),
      floor: floorOf(o.floor),
      a: point(o.a),
      b: point(o.b),
    })),
    zones: list<Zone>(input.zones, (o) => {
      const pts = Array.isArray(o.points) ? o.points.map(point) : [];
      if (pts.length < 3) return null;
      return {
        id: str(o.id, newId(), 20),
        floor: floorOf(o.floor),
        kind: ZONE_KINDS.includes(o.kind as ZoneKind) ? (o.kind as ZoneKind) : 'lawn',
        name: str(o.name, '', 80),
        color: color(o.color, '#cfe8c4'),
        points: pts,
      };
    }),
    strips: list<Strip>(input.strips, (o) => {
      const pts = Array.isArray(o.points) ? o.points.map(point) : [];
      if (pts.length < 2) return null;
      const kind = STRIP_KINDS.includes(o.kind as StripKind) ? (o.kind as StripKind) : 'path';
      return {
        id: str(o.id, newId(), 20),
        floor: floorOf(o.floor),
        kind,
        points: pts,
        width: num(o.width, STRIP_DEFAULT_WIDTH[kind], 0.02, 50),
      };
    }),
  };
}

/** Compact JSON: coordinates rounded to millimetres. Used for links, files and autosave. */
export function serializeDesign(design: Design): string {
  return JSON.stringify(design, (_k, v) => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : v));
}
