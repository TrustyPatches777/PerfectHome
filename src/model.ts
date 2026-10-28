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
export type LayerId = 'structure' | 'rooms' | 'roofs' | 'outdoor' | 'furniture' | 'tech' | 'notes' | 'comments' | 'shadows';
export const LAYER_IDS: LayerId[] = ['structure', 'rooms', 'roofs', 'outdoor', 'furniture', 'tech', 'notes', 'comments', 'shadows'];
export const LAYER_LABELS: Record<LayerId, string> = {
  structure: 'Walls, doors, windows & stairs',
  rooms: 'Rooms',
  roofs: 'Roofs',
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
  /** An attic: the usable space under the roof of the floor below (its ceiling is that roof). */
  attic?: boolean;
  /** A picture to trace on this floor (the picture itself stays on this device; see trace.ts). */
  trace?: Trace;
}

/** Where a tracing picture lies on the plan: its middle, its width in meters (the height follows its shape), turn and see-through-ness. */
export interface Trace {
  x: number;
  y: number;
  w: number;
  rotation: number;
  opacity: number;
  visible: boolean;
}

export interface LayerState {
  visible: boolean;
  locked: boolean;
}

/**
 * exterior / load-bearing (the structural shell and the walls that carry the floors and roof), interior, light partition, or a low
 * railing/parapet. (Designs from before the two were merged have 'load' walls: they load as 'exterior'.)
 */
export type WallType = 'exterior' | 'interior' | 'partition' | 'railing' | 'slats' | 'glass';
export const WALL_TYPES: WallType[] = ['exterior', 'interior', 'partition', 'slats', 'glass', 'railing'];
export const WALL_TYPE_THICKNESS: Record<WallType, number> = { exterior: 0.3, interior: 0.15, partition: 0.1, railing: 0.06, slats: 0.06, glass: 0.1 };
export const WALL_TYPE_HEIGHT: Record<WallType, number> = { exterior: 2.5, interior: 2.5, partition: 2.5, railing: 1.0, slats: 2.5, glass: 2.5 };

/** What the surface of a wall is covered with. */
export type WallFinish = 'paint' | 'plaster' | 'brick' | 'stone' | 'wood' | 'tiles' | 'concrete' | 'wallpaper' | 'marble' | 'custom';
export const WALL_FINISHES: WallFinish[] = ['paint', 'plaster', 'brick', 'stone', 'wood', 'tiles', 'concrete', 'wallpaper', 'marble', 'custom'];
export interface WallSkin {
  finish: WallFinish;
  color: string;
  /** Layout of tiles or pattern of wallpaper (see paintSpec.ts), the second color (grout, pattern color), and a picture you uploaded (finish 'custom'). */
  pattern?: string;
  grout?: string;
  texture?: string;
}

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
  /**
   * The two faces of the wall, seen looking from `a` towards `b`: `l` is the left face, `r` the right one (the side doors swing to when
   * `swing` is +1). A face without a skin is the plain wall color.
   */
  paint?: { l?: WallSkin; r?: WallSkin };
}

/**
 * door = single door with swing arc, double = two leaves, french = double door with glass, sliding = sliding
 * door, window, bay = bay window projecting outwards, garage = wide overhead door, gap = open passage.
 */
export type OpeningKind = 'door' | 'main' | 'garden' | 'double' | 'french' | 'sliding' | 'window' | 'casement' | 'sash' | 'picture' | 'bay' | 'highwin' | 'floorwin' | 'garage' | 'gap';
export const OPENING_KINDS: OpeningKind[] = ['door', 'main', 'garden', 'double', 'french', 'sliding', 'window', 'casement', 'sash', 'picture', 'bay', 'highwin', 'floorwin', 'garage', 'gap'];

/** One leaf, hinged on one side: an interior door, the main (front) door, or a garden door. */
export const isSingleDoor = (k: OpeningKind): boolean => k === 'door' || k === 'main' || k === 'garden';

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
  /** Height of the bottom of the glass above the floor (windows) and of the top of the opening (the lintel), overriding the kind's usual. */
  sill?: number;
  head?: number;
  /** Round-topped (an arch up to the head). */
  arch?: boolean;
  /** Color of the frame. */
  frame?: string;
  /** Shutters on the swing side of a window, in this color. */
  shutters?: string;
  /** The handle of a door (absent = the kind's usual). */
  handle?: HandleStyle;
  /** Trim (architrave) round the opening, in this color. */
  trim?: string;
}

export type HandleStyle = 'lever' | 'knob' | 'bar';
export const HANDLE_STYLES: HandleStyle[] = ['lever', 'knob', 'bar'];

export type FloorMaterial = 'plain' | 'wood' | 'parquet' | 'tile' | 'carpet' | 'stone' | 'concrete' | 'marble' | 'herringbone' | 'checker' | 'subway' | 'custom';
export const FLOOR_MATERIALS: FloorMaterial[] = ['plain', 'wood', 'parquet', 'herringbone', 'tile', 'subway', 'checker', 'marble', 'carpet', 'stone', 'concrete', 'custom'];

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
  /** What the room is for: drives the plan check and shows in the area table. */
  type?: RoomType;
  /** Height of the ceiling in meters (absent = the storey's usual). */
  ceiling?: number;
  /** How the ceiling looks (absent = flat). */
  ceilingStyle?: CeilingStyle;
  /** The floor of this room lies this high above the floor of its storey (meters; a dais is positive, a sunken area negative). */
  level?: number;
  /** The grout between tiles (or the second color of a checkerboard), and a picture you uploaded for a floor of material 'custom'. */
  grout?: string;
  texture?: string;
}

export type CeilingStyle = 'flat' | 'coffered' | 'beams';
export const CEILING_STYLES: CeilingStyle[] = ['flat', 'coffered', 'beams'];
export const CEILING_LABEL: Record<CeilingStyle, string> = { flat: 'Flat', coffered: 'Coffered (a grid of beams)', beams: 'Exposed timber beams' };

export type RoomType = 'bedroom' | 'living' | 'kitchen' | 'dining' | 'bathroom' | 'toilet' | 'hall' | 'office' | 'storage' | 'garage' | 'other';
export const ROOM_TYPES: RoomType[] = ['bedroom', 'living', 'kitchen', 'dining', 'bathroom', 'toilet', 'hall', 'office', 'storage', 'garage', 'other'];
export const ROOM_TYPE_LABEL: Record<RoomType, string> = { bedroom: 'Bedroom', living: 'Living room', kitchen: 'Kitchen', dining: 'Dining room', bathroom: 'Bathroom', toilet: 'Toilet', hall: 'Hall / corridor', office: 'Office', storage: 'Storage', garage: 'Garage', other: 'Other' };

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
  /** A second color for the frame of the piece (the wooden or metal parts: legs, bed frame, table frame) and the darker parts of its plan symbol. */
  color2?: string;
}

/** A staircase. Position is its center; `d` runs along the walking direction. */
export type StairKind = 'straight' | 'landing' | 'l' | 'winder' | 'u' | 'spiral' | 'ladder';
export const STAIR_KINDS: StairKind[] = ['straight', 'landing', 'l', 'winder', 'u', 'spiral', 'ladder'];
/** What the railing of a staircase is made of. */
export type RailStyle = 'none' | 'wood' | 'metal' | 'glass' | 'cable' | 'bars' | 'solid';
export const RAIL_STYLES: RailStyle[] = ['none', 'wood', 'metal', 'bars', 'glass', 'cable', 'solid'];
/** How a staircase is built: solid blocks with risers, treads on side beams (open), or treads sticking out of the wall (floating). */
export type StairBuild = 'closed' | 'open' | 'floating';
export const STAIR_BUILDS: StairBuild[] = ['closed', 'open', 'floating'];
/** What the treads are made of (the color can be changed on top of that). */
export type StairMaterial = 'concrete' | 'wood' | 'darkwood' | 'stone' | 'metal' | 'glass' | 'carpet';
export const STAIR_MATERIALS: StairMaterial[] = ['concrete', 'wood', 'darkwood', 'stone', 'metal', 'glass', 'carpet'];
/**
 * `a` and `b` are the two sides of the staircase (see `railPaths` in stairs.ts): each can have a rail. `guard` is the rail round
 * the stairwell on the floor above. `height` (meters) and `color` change every rail of the staircase.
 */
export interface Railing {
  style: RailStyle;
  a: boolean;
  b: boolean;
  /** Absent = a guard rail round the stairwell on the floor above. */
  guard?: boolean;
  height?: number;
  color?: string;
}

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
  /** Absent = no railing. */
  railing?: Railing;
  /** Absent = closed (solid). */
  build?: StairBuild;
  /** Absent = concrete (the original grey). */
  material?: StairMaterial;
  /** Color of the treads, overriding the material's; `bodyColor` the same for risers and side beams. */
  color?: string;
  bodyColor?: string;
  /** Steps in the first flight of a stair with a turn or a landing (absent = shared out by length). */
  firstFlight?: number;
}

/**
 * A roof sits on top of one floor's walls. It is an oriented box like furniture: (x, y) is the middle of the footprint, `w` runs
 * along the ridge (local x) and `d` across it. `overhang` is how far it sticks out beyond the footprint.
 */
export type RoofKind = 'flat' | 'shed' | 'gable' | 'hip' | 'gambrel' | 'mansard';
export const ROOF_KINDS: RoofKind[] = ['gable', 'hip', 'flat', 'shed', 'gambrel', 'mansard'];
export type RoofMaterial = 'tiles' | 'slate' | 'metal' | 'shingle' | 'thatch' | 'green' | 'gravel' | 'glass';
export const ROOF_MATERIALS: RoofMaterial[] = ['tiles', 'slate', 'metal', 'shingle', 'thatch', 'green', 'gravel', 'glass'];
export interface Roof {
  id: string;
  /** The floor whose walls carry the roof. */
  floor: string;
  kind: RoofKind;
  x: number;
  y: number;
  w: number;
  d: number;
  rotation: number;
  /** Slope in degrees (the upper slope of gambrel and mansard roofs; flat roofs ignore it). */
  pitch: number;
  overhang: number;
  /** Thickness of the roof covering in meters. */
  thickness: number;
  material: RoofMaterial;
  color: string;
  chimney: boolean;
  /** Flat roofs: a low wall around the edge. */
  parapet: boolean;
  /** What the chimney is made of and looks like (absent = brick). */
  chimneyStyle?: ChimneyStyle;
  /** A gutter along the eaves with downpipes at the corners. */
  gutters?: boolean;
  /** A fascia board along the eaves in this color. */
  fascia?: string;
}

export type ChimneyStyle = 'brick' | 'stone' | 'render' | 'steel' | 'pots';
export const CHIMNEY_STYLES: ChimneyStyle[] = ['brick', 'pots', 'stone', 'render', 'steel'];
export const CHIMNEY_LABEL: Record<ChimneyStyle, string> = { brick: 'Brick', pots: 'Brick with chimney pots', stone: 'Stone', render: 'Rendered', steel: 'Steel flue' };

/** What a roof window is: a skylight, a row of solar panels or a dormer (a little house on the roof with a window in its front). */
export type SkylightKind = 'window' | 'solar' | 'dormer';
export const SKYLIGHT_KINDS: SkylightKind[] = ['window', 'solar', 'dormer'];

/**
 * A skylight / roof window. Its position is where it is on the plan; it lies in whichever roof is there (on that floor), turned to
 * the slope. `w` is its width along the eave, `d` its length up the slope.
 */
export interface Skylight {
  id: string;
  floor: string;
  x: number;
  y: number;
  w: number;
  d: number;
  /** Absent = a roof window. For a dormer `d` is the height of its front wall, and its position is the middle of its front. */
  kind?: SkylightKind;
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
/** The weather over the site in the 3D view: the sky, the light and what falls from it. */
export type Weather = 'clear' | 'cloudy' | 'rain' | 'snow' | 'fog';
export const WEATHERS: Weather[] = ['clear', 'cloudy', 'rain', 'snow', 'fog'];

/** The season (trees in leaf or bare, the color of the ground); 'auto' follows the date and the latitude. */
export type Season = 'auto' | 'spring' | 'summer' | 'autumn' | 'winter';
export const SEASONS: Season[] = ['auto', 'spring', 'summer', 'autumn', 'winter'];

/** What lies on the horizon beyond the plot. */
export type Horizon = 'none' | 'hills' | 'mountains' | 'city' | 'forest' | 'sea';
export const HORIZONS: Horizon[] = ['none', 'hills', 'mountains', 'city', 'forest', 'sea'];

export interface Site {
  /** Direction of true north on the plan, in degrees clockwise from "up" on screen. */
  north: number;
  /** Latitude in degrees (north positive). */
  lat: number;
  month: number;
  day: number;
  /** Weather in the 3D view (absent = clear). */
  weather?: Weather;
  /** Season (absent = follows the date). */
  season?: Season;
  /** The horizon (absent = none: the ground fades into the sky). */
  horizon?: Horizon;
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
export type ZoneKind = 'lawn' | 'terrace' | 'balcony' | 'porch' | 'driveway' | 'flowerbed' | 'water' | 'plot' | 'terrain' | 'lightwell';
export const ZONE_KINDS: ZoneKind[] = ['lawn', 'terrace', 'balcony', 'porch', 'driveway', 'flowerbed', 'water', 'plot', 'terrain', 'lightwell'];

/** The fall of a ground area: `dir` is the plan direction the ground falls towards (degrees, 0 = east, 90 = south), `pct` how steep (percent). */
export interface Slope {
  dir: number;
  pct: number;
}

export interface Zone {
  id: string;
  floor: string;
  kind: ZoneKind;
  name: string;
  color: string;
  points: Point[];
  /** A railing round the edges that are not against a wall (terraces and balconies). A balcony lies at the level of the floor it is on. */
  railing?: RailStyle;
  /** A porch: how far it is raised above the ground, in meters. */
  raise?: number;
  /** The height of this ground area above the level of the plot (meters; negative = sunk, like a light well). Absent = the ground under it (see terrain.ts). */
  height?: number;
  /** The fall of the ground in this area (see `Slope`). */
  slope?: Slope;
}

/** A line feature with a width: street, footpath, fence or hedge. */
export type StripKind = 'road' | 'path' | 'fence' | 'hedge';
export const STRIP_KINDS: StripKind[] = ['road', 'path', 'fence', 'hedge'];
export const STRIP_DEFAULT_WIDTH: Record<StripKind, number> = { road: 6, path: 1.2, fence: 0.1, hedge: 0.6 };

/** What a footpath is made of (absent = plain). */
export type PathSurface = 'plain' | 'slabs' | 'gravel' | 'stepping' | 'brick' | 'boards';
export const PATH_SURFACE_KINDS: PathSurface[] = ['plain', 'slabs', 'gravel', 'stepping', 'brick', 'boards'];

/** A gate in a fence or hedge: an opening `width` wide centered `pos` meters along the line, with leaves that swing or slide. */
export type GateKind = 'single' | 'double' | 'sliding';
export const GATE_KINDS: GateKind[] = ['single', 'double', 'sliding'];
export interface Gate {
  id: string;
  pos: number;
  width: number;
  kind: GateKind;
  /** The side it opens to: 1 = the right of the way the line is drawn, -1 = the left. */
  swing: 1 | -1;
  /** Which end of the opening the leaf is hinged at (a sliding gate rolls towards it). */
  hinge: 'a' | 'b';
}

export interface Strip {
  id: string;
  floor: string;
  kind: StripKind;
  /** Centerline, at least two points. */
  points: Point[];
  width: number;
  /** Fences and hedges only. */
  gates?: Gate[];
  /** Footpaths only. */
  surface?: PathSurface;
}

/** Things that move, rotate and copy as one. Openings are never in a group (they belong to their wall). */
export interface Group {
  id: string;
  name: string;
  refs: ItemRef[];
}

/** A camera position of the 3D view that you can come back to (where the camera is and what it looks at, in 3D meters: plan x, up, plan y). */
export interface SavedView {
  id: string;
  name: string;
  pos: [number, number, number];
  target: [number, number, number];
}

/**
 * A line across the plan along which the house is cut for a section drawing. You look from the line towards its LEFT (as you walk from `a` to `b`
 * on the screen), or the other way when `flip` is set.
 */
export interface SectionLine {
  id: string;
  /** The letter on the plan and in the title: "A" for section A-A. */
  name: string;
  a: Point;
  b: Point;
  flip?: boolean;
}

export interface Settings {
  /** Snap step in meters. */
  gridStep: number;
  /** Thickness used for newly drawn walls. */
  wallThickness: number;
  /** Height of one storey in meters (shadows of upper floors). */
  storeyHeight: number;
  /** How high the ground floor lies above the ground outside (meters). A raised ground floor over a semi-basement has the entrance steps up to it. */
  groundLevel?: number;
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
  roofs: Roof[];
  skylights: Skylight[];
  notes: Note[];
  guides: Guide[];
  custom: CustomItem[];
  /** Absent in older designs. */
  groups: Group[];
  /** Saved 3D camera positions and section lines (absent in older designs). */
  views: SavedView[];
  sections: SectionLine[];
  site: Site;
}

export type ItemKind = 'wall' | 'opening' | 'room' | 'furniture' | 'label' | 'dimension' | 'zone' | 'strip' | 'stair' | 'roof' | 'skylight' | 'note' | 'guide';
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
  roof: 'roofs',
  skylight: 'roofs',
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
      roofs: { visible: true, locked: false },
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
    roofs: [],
    skylights: [],
    notes: [],
    guides: [],
    custom: [],
    groups: [],
    views: [],
    sections: [],
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

/** `{ slope }` for a valid fall of the ground (at least half a percent), else nothing. */
function slopeOf(v: unknown): { slope?: Slope } {
  if (!v || typeof v !== 'object') return {};
  const o = v as Record<string, unknown>;
  const pct = num(o.pct, 0, 0, 100);
  if (pct < 0.5) return {};
  return { slope: { dir: ((num(o.dir, 0, -720, 720) % 360) + 360) % 360, pct } };
}

function color(v: unknown, def: string): string {
  return typeof v === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(v) ? v : def;
}

function vec3(v: unknown): [number, number, number] {
  const a = Array.isArray(v) ? v : [];
  return [num(a[0], 0, -1e5, 1e5), num(a[1], 0, -1e5, 1e5), num(a[2], 0, -1e5, 1e5)];
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

function skin(v: unknown): WallSkin | undefined {
  if (!isObj(v) || !WALL_FINISHES.includes(v.finish as WallFinish)) return undefined;
  const hex = (x: unknown) => (typeof x === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(x) ? x : undefined);
  const word = (x: unknown) => (typeof x === 'string' && /^[a-z0-9-]{1,24}$/.test(x) ? x : undefined);
  return {
    finish: v.finish as WallFinish,
    color: color(v.color, '#f5f0e6'),
    ...(word(v.pattern) ? { pattern: word(v.pattern) } : {}),
    ...(hex(v.grout) ? { grout: hex(v.grout) } : {}),
    ...(word(v.texture) ? { texture: word(v.texture) } : {}),
  };
}

function skins(v: unknown): Wall['paint'] | undefined {
  if (!isObj(v)) return undefined;
  const l = skin(v.l);
  const r = skin(v.r);
  return l || r ? { ...(l ? { l } : {}), ...(r ? { r } : {}) } : undefined;
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
  for (const f of list<Floor>(input.floors, (o) => ({
    id: str(o.id, newId(), 20),
    name: str(o.name, 'Floor', 60),
    ...(o.attic === true ? { attic: true } : {}),
    ...(isObj(o.trace) ? { trace: { x: num(o.trace.x, 0), y: num(o.trace.y, 0), w: num(o.trace.w, 10, 0.1, 500), rotation: num(o.trace.rotation, 0, -3600, 3600), opacity: num(o.trace.opacity, 0.5, 0.05, 1), visible: o.trace.visible !== false } } : {}),
  }))) {
    if (!floors.some((x) => x.id === f.id)) floors.push(f);
  }
  if (!floors.length) floors.push({ id: newId(), name: 'Ground floor' });
  const floorIds = new Set(floors.map((f) => f.id));
  const floorOf = (v: unknown) => (typeof v === 'string' && floorIds.has(v) ? v : floors[0].id);

  const walls = list<Wall>(input.walls, (o) => {
    const type = o.type === 'load' ? 'exterior' : WALL_TYPES.includes(o.type as WallType) ? (o.type as WallType) : 'interior';
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
      ...(skins(o.paint) ? { paint: skins(o.paint) } : {}),
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
      ...(typeof settings.groundLevel === 'number' && Math.abs(settings.groundLevel) > 0.001 ? { groundLevel: num(settings.groundLevel, 0, -10, 10) } : {}),
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
            ...(typeof o.sill === 'number' ? { sill: num(o.sill, 0.9, 0, 5) } : {}),
            ...(typeof o.head === 'number' ? { head: num(o.head, 2.1, 0.3, 6) } : {}),
            ...(o.arch === true ? { arch: true } : {}),
            ...(typeof o.frame === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(o.frame) ? { frame: o.frame } : {}),
            ...(typeof o.shutters === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(o.shutters) ? { shutters: o.shutters } : {}),
            ...(typeof o.trim === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(o.trim) ? { trim: o.trim } : {}),
            ...(HANDLE_STYLES.includes(o.handle as HandleStyle) ? { handle: o.handle as HandleStyle } : {}),
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
        ...(ROOM_TYPES.includes(o.type as RoomType) ? { type: o.type as RoomType } : {}),
        ...(typeof o.ceiling === 'number' ? { ceiling: num(o.ceiling, 2.5, 1.5, 12) } : {}),
        ...(CEILING_STYLES.includes(o.ceilingStyle as CeilingStyle) && o.ceilingStyle !== 'flat' ? { ceilingStyle: o.ceilingStyle as CeilingStyle } : {}),
        ...(typeof o.level === 'number' && Math.abs(o.level) > 0.001 ? { level: num(o.level, 0, -3, 3) } : {}),
        ...(typeof o.grout === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(o.grout) ? { grout: o.grout } : {}),
        ...(typeof o.texture === 'string' && /^[a-z0-9-]{1,24}$/.test(o.texture) ? { texture: o.texture } : {}),
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
      ...(typeof o.color2 === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(o.color2) ? { color2: o.color2 } : {}),
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
        ...(RAIL_STYLES.includes(o.railing as RailStyle) && o.railing !== 'none' ? { railing: o.railing as RailStyle } : {}),
        ...(typeof o.raise === 'number' ? { raise: num(o.raise, 0.3, 0, 1.5) } : {}),
        ...(typeof o.height === 'number' ? { height: num(o.height, 0, -20, 40) } : {}),
        ...slopeOf(o.slope),
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
        ...(kind !== 'road' && kind !== 'path' && Array.isArray(o.gates) && o.gates.length
          ? {
              gates: list<Gate>(o.gates, (g) => ({
                id: str(g.id, newId(), 20),
                pos: num(g.pos, 1, 0, 1e5),
                width: num(g.width, 1.2, 0.5, 8),
                kind: GATE_KINDS.includes(g.kind as GateKind) ? (g.kind as GateKind) : 'single',
                swing: g.swing === -1 ? -1 : 1,
                hinge: g.hinge === 'b' ? 'b' : 'a',
              })),
            }
          : {}),
        ...(kind === 'path' && PATH_SURFACE_KINDS.includes(o.surface as PathSurface) && o.surface !== 'plain' ? { surface: o.surface as PathSurface } : {}),
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
      ...(isObj(o.railing) && RAIL_STYLES.includes(o.railing.style as RailStyle) && o.railing.style !== 'none'
        ? {
            railing: {
              style: o.railing.style as RailStyle,
              a: o.railing.a !== false,
              b: o.railing.b !== false,
              ...(o.railing.guard === false ? { guard: false } : {}),
              ...(typeof o.railing.height === 'number' ? { height: num(o.railing.height, 0.9, 0.4, 1.6) } : {}),
              ...(typeof o.railing.color === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(o.railing.color) ? { color: o.railing.color } : {}),
            },
          }
        : {}),
      ...(STAIR_BUILDS.includes(o.build as StairBuild) && o.build !== 'closed' ? { build: o.build as StairBuild } : {}),
      ...(STAIR_MATERIALS.includes(o.material as StairMaterial) && o.material !== 'concrete' ? { material: o.material as StairMaterial } : {}),
      ...(typeof o.color === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(o.color) ? { color: o.color } : {}),
      ...(typeof o.bodyColor === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(o.bodyColor) ? { bodyColor: o.bodyColor } : {}),
      ...(typeof o.firstFlight === 'number' ? { firstFlight: Math.round(num(o.firstFlight, 8, 1, 59)) } : {}),
    })),
    roofs: list<Roof>(input.roofs, (o) => ({
      id: str(o.id, newId(), 20),
      floor: floorOf(o.floor),
      kind: ROOF_KINDS.includes(o.kind as RoofKind) ? (o.kind as RoofKind) : 'gable',
      x: num(o.x, 0),
      y: num(o.y, 0),
      w: num(o.w, 8, 0.5, 100),
      d: num(o.d, 6, 0.5, 100),
      rotation: num(o.rotation, 0, -3600, 3600),
      pitch: num(o.pitch, 35, 3, 80),
      overhang: num(o.overhang, 0.4, 0, 3),
      thickness: num(o.thickness, 0.15, 0.03, 0.8),
      material: ROOF_MATERIALS.includes(o.material as RoofMaterial) ? (o.material as RoofMaterial) : 'tiles',
      color: color(o.color, '#b5523b'),
      chimney: o.chimney === true,
      parapet: o.parapet === true,
      ...(CHIMNEY_STYLES.includes(o.chimneyStyle as ChimneyStyle) && o.chimneyStyle !== 'brick' ? { chimneyStyle: o.chimneyStyle as ChimneyStyle } : {}),
      ...(o.gutters === true ? { gutters: true } : {}),
      ...(typeof o.fascia === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(o.fascia) ? { fascia: o.fascia } : {}),
    })),
    skylights: list<Skylight>(input.skylights, (o) => ({
      id: str(o.id, newId(), 20),
      floor: floorOf(o.floor),
      x: num(o.x, 0),
      y: num(o.y, 0),
      w: num(o.w, 0.78, 0.2, 5),
      d: num(o.d, 1.18, 0.2, 5),
      ...(o.kind === 'solar' || o.kind === 'dormer' ? { kind: o.kind as SkylightKind } : {}),
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
    groups: list<Group>(input.groups, (o) => {
      const refs = (Array.isArray(o.refs) ? o.refs : []).filter((r): r is Json => isObj(r) && typeof r.id === 'string' && typeof r.kind === 'string').map((r) => ({ kind: r.kind as ItemKind, id: r.id as string })).filter((r) => r.kind !== 'opening' && r.kind !== 'guide');
      return refs.length >= 2 ? { id: str(o.id, newId(), 20), name: str(o.name, 'Group', 60), refs } : null;
    }),
    views: list<SavedView>(input.views, (o) => ({
      id: str(o.id, newId(), 20),
      name: str(o.name, 'View', 60),
      pos: vec3(o.pos),
      target: vec3(o.target),
    })),
    sections: list<SectionLine>(input.sections, (o) => {
      const a = point(o.a);
      const b = point(o.b);
      if (Math.hypot(b.x - a.x, b.y - a.y) < 0.05) return null;
      return { id: str(o.id, newId(), 20), name: str(o.name, 'A', 20), a, b, ...(o.flip === true ? { flip: true } : {}) };
    }),
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
        ...(WEATHERS.includes(s.weather as Weather) && s.weather !== 'clear' ? { weather: s.weather as Weather } : {}),
        ...(SEASONS.includes(s.season as Season) && s.season !== 'auto' ? { season: s.season as Season } : {}),
        ...(HORIZONS.includes(s.horizon as Horizon) && s.horizon !== 'none' ? { horizon: s.horizon as Horizon } : {}),
      };
    })(),
  };
}

/** Compact JSON: coordinates rounded to millimetres. Used for links, files and autosave. */
export function serializeDesign(design: Design): string {
  return JSON.stringify(design, (_k, v) => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : v));
}
