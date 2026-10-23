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
export type LayerId = 'structure' | 'rooms' | 'outdoor' | 'furniture' | 'tech' | 'notes' | 'comments' | 'shadows';
export const LAYER_IDS: LayerId[] = ['structure', 'rooms', 'outdoor', 'furniture', 'tech', 'notes', 'comments', 'shadows'];
export const LAYER_LABELS: Record<LayerId, string> = {
  structure: 'Walls, doors, windows & stairs',
  rooms: 'Rooms',
  outdoor: 'Garden, driveway & street',
  furniture: 'Furniture & vehicles',
  tech: 'Lamps, electrical & plumbing',
  notes: 'Labels, measurements & guides',
  comments: 'Sticky notes',
  shadows: 'Sun & shadows',
};
/** `shadows` only draws; it holds no items, so it can be hidden but not locked. */
export const LAYERS_WITH_ITEMS: LayerId[] = LAYER_IDS.filter((l) => l !== 'shadows');

/** One level of the building. `Design.floors` is ordered from the lowest to the highest. */
export interface Floor {
  id: string;
  name: string;
}

export interface LayerState {
  visible: boolean;
  locked: boolean;
}

/** exterior, interior, load-bearing, light partition, or a low railing/parapet. */
export type WallType = 'exterior' | 'interior' | 'load' | 'partition' | 'railing';
export const WALL_TYPES: WallType[] = ['exterior', 'interior', 'load', 'partition', 'railing'];
export const WALL_TYPE_THICKNESS: Record<WallType, number> = { exterior: 0.3, interior: 0.15, load: 0.24, partition: 0.1, railing: 0.06 };
export const WALL_TYPE_HEIGHT: Record<WallType, number> = { exterior: 2.5, interior: 2.5, load: 2.5, partition: 2.5, railing: 1.0 };

/** A wall between two centerline points; straight, or an arc when `bulge` is set. */
export interface Wall {
  id: string;
  floor: string;
  a: Point;
  b: Point;
  thickness: number;
  type: WallType;
  /** Height in meters (used for shadows). */
  height: number;
  /**
   * Curvature: signed distance in meters from the middle of the chord a→b to the middle of the arc
   * (positive bulges to the right of a→b on screen). 0 or absent = straight.
   */
  bulge?: number;
}

/**
 * door = single door with swing arc, double = two leaves, french = double door with glass, sliding = sliding
 * door, window, bay = bay window projecting outwards, garage = wide overhead door, gap = open passage.
 */
export type OpeningKind = 'door' | 'double' | 'french' | 'sliding' | 'window' | 'bay' | 'garage' | 'gap';
export const OPENING_KINDS: OpeningKind[] = ['door', 'double', 'french', 'sliding', 'window', 'bay', 'garage', 'gap'];

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

export type FloorMaterial = 'plain' | 'wood' | 'parquet' | 'tile' | 'carpet' | 'stone' | 'concrete';
export const FLOOR_MATERIALS: FloorMaterial[] = ['plain', 'wood', 'parquet', 'tile', 'carpet', 'stone', 'concrete'];

/** A named floor area. `points` is a closed polygon (implicitly closed). */
export interface Room {
  id: string;
  floor: string;
  name: string;
  color: string;
  /** Surface pattern drawn in the room's color. */
  material: FloorMaterial;
  /** Counts towards the living area in the area table (turn off for garage, cellar...). */
  living: boolean;
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
  /** Height in meters, overriding the catalog default (used for shadows). */
  height?: number;
  /** Lamps only: switched on (glows at night). Absent = on. */
  on?: boolean;
}

/** A staircase. Position is its center; `d` runs along the walking direction. */
export type StairKind = 'straight' | 'l' | 'u' | 'spiral';
export const STAIR_KINDS: StairKind[] = ['straight', 'l', 'u', 'spiral'];
export interface Stair {
  id: string;
  floor: string;
  kind: StairKind;
  x: number;
  y: number;
  w: number;
  d: number;
  rotation: number;
  steps: number;
  /** Height to climb in meters. */
  rise: number;
  /** L/U stairs: turn the other way. */
  flip: boolean;
}

/** A sticky note pinned on the plan. */
export interface Note {
  id: string;
  floor: string;
  x: number;
  y: number;
  text: string;
  /** Who wrote it, and their color. */
  author: string;
  color: string;
  /** Unix ms. */
  time: number;
  done: boolean;
}

/** An infinite alignment line: axis 'x' = vertical line at x = pos, 'y' = horizontal line at y = pos. */
export interface Guide {
  id: string;
  axis: 'x' | 'y';
  pos: number;
}

/** A piece of furniture you defined yourself. Placed items use type `custom:<id>`. */
export interface CustomItem {
  id: string;
  label: string;
  w: number;
  d: number;
  height: number;
  color: string;
  /** rect, rounded rectangle, ellipse, or the drawing of an existing catalog item (`base`). */
  shape: 'rect' | 'round' | 'ellipse' | 'symbol';
  base?: string;
}

/** Where the building stands: used for the sun. */
export interface Site {
  /** Direction of true north on the plan, in degrees clockwise from "up" on screen. */
  north: number;
  /** Latitude in degrees (north positive). */
  lat: number;
  month: number;
  day: number;
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
  /** Height of one storey in meters (shadows of upper floors). */
  storeyHeight: number;
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
  stairs: Stair[];
  notes: Note[];
  guides: Guide[];
  custom: CustomItem[];
  site: Site;
}

export type ItemKind = 'wall' | 'opening' | 'room' | 'furniture' | 'label' | 'dimension' | 'zone' | 'strip' | 'stair' | 'note' | 'guide';
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
  stair: 'structure',
  note: 'comments',
  guide: 'notes',
};

// ---------------------------------------------------------------------------
// Defaults & factories
// ---------------------------------------------------------------------------

export const DEFAULT_GRID_STEP = 0.1;
export const DEFAULT_WALL_THICKNESS = 0.15;
export const DEFAULT_STOREY_HEIGHT = 2.8;
export const DEFAULT_SITE: Site = { north: 0, lat: 50, month: 6, day: 21 };
export const GRID_STEPS = [0.05, 0.1, 0.25, 0.5];

export function newId(): string {
  return Math.random().toString(36).slice(2, 9).padEnd(7, '0');
}

export function createDesign(): Design {
  return {
    v: SCHEMA_VERSION,
    id: newId() + newId(),
    name: 'My home',
    settings: { gridStep: DEFAULT_GRID_STEP, wallThickness: DEFAULT_WALL_THICKNESS, storeyHeight: DEFAULT_STOREY_HEIGHT },
    layers: {
      structure: { visible: true, locked: false },
      rooms: { visible: true, locked: false },
      outdoor: { visible: true, locked: false },
      furniture: { visible: true, locked: false },
      tech: { visible: true, locked: false },
      notes: { visible: true, locked: false },
      comments: { visible: true, locked: false },
      shadows: { visible: false, locked: false },
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
    stairs: [],
    notes: [],
    guides: [],
    custom: [],
    site: { ...DEFAULT_SITE },
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

  const walls = list<Wall>(input.walls, (o) => {
    const type = WALL_TYPES.includes(o.type as WallType) ? (o.type as WallType) : 'interior';
    const bulge = num(o.bulge, 0, -100, 100);
    return {
      id: str(o.id, newId(), 20),
      floor: floorOf(o.floor),
      a: point(o.a),
      b: point(o.b),
      thickness: num(o.thickness, DEFAULT_WALL_THICKNESS, 0.02, 1),
      type,
      height: num(o.height, WALL_TYPE_HEIGHT[type], 0.1, 30),
      ...(Math.abs(bulge) > 0.001 ? { bulge } : {}),
    };
  });
  const wallIds = new Set(walls.map((w) => w.id));

  return {
    v: SCHEMA_VERSION,
    id: str(input.id, base.id, 40),
    name: str(input.name, base.name, 80),
    settings: {
      gridStep: num(settings.gridStep, DEFAULT_GRID_STEP, 0.01, 5),
      wallThickness: num(settings.wallThickness, DEFAULT_WALL_THICKNESS, 0.02, 1),
      storeyHeight: num(settings.storeyHeight, DEFAULT_STOREY_HEIGHT, 1.8, 6),
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
        material: FLOOR_MATERIALS.includes(o.material as FloorMaterial) ? (o.material as FloorMaterial) : 'plain',
        living: o.living !== false,
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
      ...(typeof o.height === 'number' ? { height: num(o.height, 0.5, 0.01, 30) } : {}),
      ...(o.on === false ? { on: false } : {}),
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
    stairs: list<Stair>(input.stairs, (o) => ({
      id: str(o.id, newId(), 20),
      floor: floorOf(o.floor),
      kind: STAIR_KINDS.includes(o.kind as StairKind) ? (o.kind as StairKind) : 'straight',
      x: num(o.x, 0),
      y: num(o.y, 0),
      w: num(o.w, 1, 0.3, 20),
      d: num(o.d, 3, 0.3, 30),
      rotation: num(o.rotation, 0, -3600, 3600),
      steps: Math.round(num(o.steps, 14, 2, 60)),
      rise: num(o.rise, 2.8, 0.2, 10),
      flip: o.flip === true,
    })),
    notes: list<Note>(input.notes, (o) => ({
      id: str(o.id, newId(), 20),
      floor: floorOf(o.floor),
      x: num(o.x, 0),
      y: num(o.y, 0),
      text: str(o.text, '', 1000),
      author: str(o.author, '', 40),
      color: color(o.color, '#facc15'),
      time: num(o.time, 0, 0, 1e14),
      done: o.done === true,
    })),
    guides: list<Guide>(input.guides, (o) => ({
      id: str(o.id, newId(), 20),
      axis: o.axis === 'y' ? 'y' : 'x',
      pos: num(o.pos, 0),
    })),
    custom: list<CustomItem>(input.custom, (o) => ({
      id: str(o.id, newId(), 20),
      label: str(o.label, 'My item', 60),
      w: num(o.w, 1, 0.05, 50),
      d: num(o.d, 1, 0.05, 50),
      height: num(o.height, 0.5, 0.01, 30),
      color: color(o.color, '#cbd5e1'),
      shape: (['rect', 'round', 'ellipse', 'symbol'] as const).includes(o.shape as 'rect') ? (o.shape as CustomItem['shape']) : 'rect',
      ...(typeof o.base === 'string' ? { base: str(o.base, '', 40) } : {}),
    })),
    site: (() => {
      const s = isObj(input.site) ? input.site : {};
      return {
        north: num(s.north, DEFAULT_SITE.north, -360, 360),
        lat: num(s.lat, DEFAULT_SITE.lat, -66, 66),
        month: Math.round(num(s.month, DEFAULT_SITE.month, 1, 12)),
        day: Math.round(num(s.day, DEFAULT_SITE.day, 1, 31)),
      };
    })(),
  };
}

/** Compact JSON: coordinates rounded to millimetres. Used for links, files and autosave. */
export function serializeDesign(design: Design): string {
  return JSON.stringify(design, (_k, v) => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : v));
}
