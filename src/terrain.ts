/**
 * The lie of the land. The ground outside is flat at level 0 until you draw ground areas ("terrain": earth at a height, optionally sloping) and
 * give the other areas (lawn, terrace, driveway, flower bed...) a height of their own. A ground area without a height of its own takes the plane of
 * the terrain it lies in, so a lawn on a slope is a sloping lawn. Everything is pure: 3D, walking, steps and the plan ask these functions.
 *
 * Levels are meters above the ground of the plot (level 0). The ground floor lies `settings.groundLevel` above it.
 */
import { pointInPolygon } from './geometry';
import type { Design, Point, Slope, Zone, ZoneKind } from './model';
import { plotFirst } from './outdoor';
import { groundIndex } from './shadows';

/** Areas that are ground (everything but the plot boundary and balconies, which hang off a floor). */
export const isGround = (kind: ZoneKind): boolean => kind !== 'plot' && kind !== 'balcony';

/** The level a kind of area has when it does not say (a light well is sunk). */
export const DEFAULT_LEVEL: Partial<Record<ZoneKind, number>> = { lightwell: -1.2 };

/** How far the visible surface of an area lies above its ground plane (the thickness of the lawn, the paving...). */
export const SURFACE_THICKNESS: Record<ZoneKind, number> = { lawn: 0.03, terrace: 0.06, balcony: 0.02, porch: 0.3, driveway: 0.04, flowerbed: 0.08, water: 0, plot: 0, terrain: 0, lightwell: 0 };

/** A flat or sloping plane: the height `h` at `ref`, and how much it rises per meter along x and along y. */
export interface Plane {
  h: number;
  ref: Point;
  gx: number;
  gy: number;
}

export const planeAt = (pl: Plane, p: Point): number => pl.h + pl.gx * (p.x - pl.ref.x) + pl.gy * (p.y - pl.ref.y);
export const flatPlane = (h: number, ref: Point = { x: 0, y: 0 }): Plane => ({ h, ref, gx: 0, gy: 0 });

/** The rise per meter (along x, along y) of ground that falls towards `slope.dir`. */
export function gradientOf(slope?: Slope): { gx: number; gy: number } {
  if (!slope || slope.pct <= 0) return { gx: 0, gy: 0 };
  const a = (slope.dir * Math.PI) / 180;
  const k = slope.pct / 100;
  return { gx: -Math.cos(a) * k, gy: -Math.sin(a) * k };
}

export const centroidOf = (pts: Point[]): Point => ({ x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length });

/** A point that surely lies inside a (maybe concave) polygon: its centroid when that is inside, else the middle of the longest horizontal chord near it. */
export function insidePoint(pts: Point[]): Point {
  const c = centroidOf(pts);
  if (pointInPolygon(c, pts)) return c;
  for (let k = 0; k < 20; k++) {
    const y = Math.min(...pts.map((p) => p.y)) + ((Math.max(...pts.map((p) => p.y)) - Math.min(...pts.map((p) => p.y))) * (k + 0.5)) / 20;
    const xs: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y)) xs.push(a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x));
    }
    xs.sort((p, q) => p - q);
    if (xs.length >= 2) return { x: (xs[0] + xs[1]) / 2, y };
  }
  return pts[0];
}

/** An area that lies on the ground of the plot: ground areas drawn on the ground floor or a basement (areas on upper floors are roof terraces: they lie at the level of their floor). */
export const isTerrainZone = (d: Pick<Design, 'floors'>, z: Pick<Zone, 'kind' | 'floor'>): boolean => {
  if (!isGround(z.kind)) return false;
  const at = d.floors.findIndex((f) => f.id === z.floor);
  return at <= groundIndex(d as Design);
};

/** The ground areas in the order they are drawn (the later one is on top). */
const groundZones = (d: Pick<Design, 'zones' | 'floors'>): Zone[] => plotFirst(d.zones).filter((z) => isTerrainZone(d, z));

/**
 * The plane of an area's ground: its own height and slope when it has them (or the default of its kind), otherwise the plane of the terrain area
 * that its middle lies in (shifted to its own middle, so the surface of the area stays one flat or sloping plane), otherwise level 0.
 */
export function zonePlane(d: Pick<Design, 'zones' | 'floors'>, z: Zone): Plane {
  const ref = insidePoint(z.points);
  const own = z.height ?? DEFAULT_LEVEL[z.kind];
  if (z.kind === 'terrain' || own !== undefined || z.slope) {
    const g = gradientOf(z.slope);
    return { h: own ?? 0, ref, ...g };
  }
  const under = [...groundZones(d)].reverse().find((t) => t.kind === 'terrain' && t !== z && pointInPolygon(ref, t.points));
  if (!under) return flatPlane(0, ref);
  const p = zonePlane(d, under);
  return { h: planeAt(p, ref), ref, gx: p.gx, gy: p.gy };
}

/** True when an area is at level 0 and flat: it is drawn the plain way. */
export function isPlainLevel(d: Pick<Design, 'zones' | 'floors'>, z: Zone): boolean {
  const p = zonePlane(d, z);
  return Math.abs(p.h) < 1e-6 && Math.abs(p.gx) < 1e-9 && Math.abs(p.gy) < 1e-9;
}

/**
 * The ground at a point: the height of what you stand on (`h`), the level of the ground itself without the thin covering of a lawn or paving (`base`; a porch
 * counts as raised ground), and the area it belongs to (null for the open ground of the plot). Water and the plot boundary are not ground to stand on.
 */
export function groundAt(d: Pick<Design, 'zones' | 'floors'>, p: Point): { h: number; base: number; zone: Zone | null } {
  const zones = groundZones(d);
  for (let i = zones.length - 1; i >= 0; i--) {
    const z = zones[i];
    if (z.kind === 'water' || !pointInPolygon(p, z.points)) continue;
    const level = planeAt(zonePlane(d, z), p) + (z.kind === 'porch' ? (z.raise ?? 0.3) : 0);
    return { h: level + (z.kind === 'porch' ? 0 : SURFACE_THICKNESS[z.kind]), base: level, zone: z };
  }
  return { h: 0, base: 0, zone: null };
}

/** The height of the ground outside at a point. */
export const groundHeightAt = (d: Pick<Design, 'zones' | 'floors'>, p: Point): number => groundAt(d, p).h;

/** How far a point is from the outline of a polygon. */
function outlineDistance(p: Point, pts: Point[]): number {
  let best = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
    best = Math.min(best, Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy)));
  }
  return best;
}

/** The sunk areas (a light well, a sunken garden) that lie wholly inside an area and below its ground: the area has a hole there. */
export function pitsIn(d: Pick<Design, 'zones' | 'floors'>, z: Zone): Zone[] {
  if (!isTerrainZone(d, z) || z.kind === 'water') return [];
  const pl = zonePlane(d, z);
  return d.zones.filter((o) => {
    if (o === z || !isTerrainZone(d, o) || o.kind === 'water' || o.kind === 'plot') return false;
    const op = zonePlane(d, o);
    return o.points.every((p) => pointInPolygon(p, z.points)) && planeAt(op, op.ref) < planeAt(pl, op.ref) - 0.05;
  });
}

/** The height at which a staircase starts: the floor it is on, or for steps outside the house (to the front door) the ground there. */
export function stairBase(d: Pick<Design, 'zones' | 'floors' | 'rooms'>, s: { floor: string; x: number; y: number }, floorElev: number): number {
  const at = d.floors.findIndex((f) => f.id === s.floor);
  if (at > groundIndex(d as Design)) return floorElev;
  const inside = d.rooms.some((r) => r.floor === s.floor && pointInPolygon({ x: s.x, y: s.y }, r.points));
  return inside ? floorElev : groundAt(d, { x: s.x, y: s.y }).base;
}

/** The height at which a piece of furniture stands: on the floor of its room (a dais counts), outdoors on the ground. */
export function furnitureBase(d: Pick<Design, 'zones' | 'floors' | 'rooms'>, f: { floor: string; x: number; y: number }, floorElev: number): number {
  const at = d.floors.findIndex((x) => x.id === f.floor);
  const gi = groundIndex(d as Design);
  if (at > gi) return floorElev;
  const room = d.rooms.find((r) => r.floor === f.floor && pointInPolygon({ x: f.x, y: f.y }, r.points));
  if (room) return floorElev + (room.level ?? 0);
  return at === gi ? groundAt(d, { x: f.x, y: f.y }).base : floorElev;
}

/** A piece of the retaining wall along the edge of a ground area: from the lower level up to the higher one, over a stretch of its outline. */
export interface RetainingWall {
  zoneId: string;
  a: Point;
  b: Point;
  /** The way the wall faces (the side people see it from): outwards from a raised area, into a pit. */
  facing: Point;
  /** Heights of the lower and the upper edge at each end. */
  lowA: number;
  lowB: number;
  highA: number;
  highB: number;
}

/**
 * The walls that hold up a ground area against lower ground next to it (and a sunk area, like a light well, against the higher ground around it):
 * the outline is cut into pieces of at most `step` meters and, for each, the ground beside it is looked up.
 */
export function retainingWalls(d: Pick<Design, 'zones' | 'floors'>, z: Zone, step = 1): RetainingWall[] {
  if (!isTerrainZone(d, z) || z.kind === 'water') return [];
  const pl = zonePlane(d, z);
  const lift = z.kind === 'porch' ? (z.raise ?? 0.3) : 0; // the thin covering of a lawn does not count, a porch is a raised platform
  const surface = (p: Point) => planeAt(pl, p) + lift;
  const pts = z.points;
  // the outline's winding decides which side is outside
  const area = pts.reduce((s, p, i) => s + (p.x * pts[(i + 1) % pts.length].y - pts[(i + 1) % pts.length].x * p.y), 0);
  const out: RetainingWall[] = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    const len = Math.hypot(q.x - p.x, q.y - p.y);
    if (len < 0.01) continue;
    const n = Math.max(1, Math.ceil(len / step));
    const nx = ((q.y - p.y) / len) * (area > 0 ? 1 : -1);
    const ny = (-(q.x - p.x) / len) * (area > 0 ? 1 : -1);
    for (let k = 0; k < n; k++) {
      const a = { x: p.x + ((q.x - p.x) * k) / n, y: p.y + ((q.y - p.y) * k) / n };
      const b = { x: p.x + ((q.x - p.x) * (k + 1)) / n, y: p.y + ((q.y - p.y) * (k + 1)) / n };
      const m = { x: (a.x + b.x) / 2 + nx * 0.2, y: (a.y + b.y) / 2 + ny * 0.2 };
      const beside = groundAt(d, m);
      if (beside.zone === z) continue;
      const here = surface({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
      const there = beside.base;
      // the higher of two neighbouring areas holds up its own edge; when the higher ground has no edge here (open ground, or a pit cut into an area) the lower
      // area does it itself, as the walls of a light well
      const higherHasEdge = !!beside.zone && outlineDistance(m, beside.zone.points) < 0.45;
      if (!(there < here - 0.02 || (there > here + 0.02 && !higherHasEdge))) continue;
      const side = (x: Point) => {
        const mine = surface(x);
        const next = beside.zone ? mine - (here - there) : there; // the neighbour's level next to this stretch (flat along it)
        return { mine, next };
      };
      const sa = side(a);
      const sb = side(b);
      const sign = there < here ? 1 : -1;
      out.push({ zoneId: z.id, a, b, facing: { x: nx * sign, y: ny * sign }, lowA: Math.min(sa.mine, sa.next), lowB: Math.min(sb.mine, sb.next), highA: Math.max(sa.mine, sa.next), highB: Math.max(sb.mine, sb.next) });
    }
  }
  return out;
}
