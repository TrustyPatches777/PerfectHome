/**
 * Furniture cannot stand inside walls. When a piece of furniture is placed, moved, resized or turned, it is pushed out of any wall it
 * overlaps (so it slides along the wall while you drag it), and when there is no room for it the change is refused.
 * Pure maths; `store/design.ts` calls `settleFurniture` after every edit.
 */
import { produce } from 'immer';
import { catalogItem } from './catalog';
import { wallPieces } from './geometry';
import type { Design, Furniture, Point } from './model';

/** Things that may overlap walls: they hang on them (sockets, lamps...), hang from the ceiling, lie flat, or are trees whose crowns reach over. */
const FLAT_OK = new Set(['rug', 'parking']);
const CROWNS = new Set(['tree', 'tree-small', 'tree-large', 'bush', 'parasol']);

export function exemptFromWalls(f: Pick<Furniture, 'type' | 'height'>): boolean {
  const item = catalogItem(f.type);
  if (item.layer === 'tech' || item.wallMounted) return true;
  return FLAT_OK.has(f.type) || CROWNS.has(f.type);
}

/** The corners of an item's footprint. */
export function footprint(f: Pick<Furniture, 'x' | 'y' | 'w' | 'd' | 'rotation'>): Point[] {
  const c = Math.cos((f.rotation * Math.PI) / 180);
  const s = Math.sin((f.rotation * Math.PI) / 180);
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => ({ x: f.x + (a * f.w * c - b * f.d * s) / 2, y: f.y + (a * f.w * s + b * f.d * c) / 2 }));
}

/** The walls of a floor as convex pieces (a curved wall is cut into short straight ones). */
export function wallObstacles(d: Design, floor: string): Point[][] {
  return d.walls.filter((w) => w.floor === floor).flatMap(wallPieces);
}

/** Overlap of two convex polygons shorter than this is "touching". */
const TOUCH = 0.002;

/** The smallest move of `a` that gets it out of `b` (both convex), or null when they do not overlap. */
export function pushOut(a: Point[], b: Point[]): Point | null {
  let best: { depth: number; x: number; y: number } | null = null;
  const axes = (poly: Point[]) =>
    poly.map((p, i) => {
      const q = poly[(i + 1) % poly.length];
      const len = Math.hypot(q.x - p.x, q.y - p.y) || 1;
      return { x: -(q.y - p.y) / len, y: (q.x - p.x) / len };
    });
  for (const axis of [...axes(a), ...axes(b)]) {
    let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
    for (const p of a) {
      const v = p.x * axis.x + p.y * axis.y;
      a0 = Math.min(a0, v); a1 = Math.max(a1, v);
    }
    for (const p of b) {
      const v = p.x * axis.x + p.y * axis.y;
      b0 = Math.min(b0, v); b1 = Math.max(b1, v);
    }
    if (Math.min(a1, b1) - Math.max(a0, b0) <= TOUCH) return null; // a gap on this axis: they do not overlap
    // move a up the axis until it is past b, or down the axis until it is before b: whichever is shorter
    const up = b1 - a0;
    const down = a1 - b0;
    const depth = Math.min(up, down);
    if (!best || depth < best.depth) best = { depth, x: axis.x * (up <= down ? 1 : -1), y: axis.y * (up <= down ? 1 : -1) };
  }
  return best && { x: best.x * (best.depth + 0.001), y: best.y * (best.depth + 0.001) };
}

/**
 * Where `f` ends up when it is pushed out of the walls of its floor: the same place when it already fits, nearby when it can be
 * pushed clear, null when it cannot (the walls close in on it).
 */
export function settledPosition(d: Design, f: Furniture, obstacles = wallObstacles(d, f.floor)): { x: number; y: number } | null {
  if (exemptFromWalls(f) || !obstacles.length) return { x: f.x, y: f.y };
  let x = f.x;
  let y = f.y;
  for (let pass = 0; pass < 12; pass++) {
    let moved = false;
    for (const piece of obstacles) {
      const push = pushOut(footprint({ ...f, x, y }), piece);
      if (push) {
        x += push.x;
        y += push.y;
        moved = true;
      }
    }
    if (!moved) return { x, y };
  }
  // still touching something after twelve pushes: it only fits if it is clear now
  const poly = footprint({ ...f, x, y });
  return obstacles.some((o) => pushOut(poly, o)) ? null : { x, y };
}

/**
 * Move an item from where it was to where it is asked to go, in small steps, each one pushed clear of the walls. Walking the path (rather
 * than only looking at the end) is what stops a quick drag from jumping over a thin wall: the item stops at the wall and slides along it.
 */
export function sweepPosition(d: Design, from: Furniture, to: Furniture, obstacles = wallObstacles(d, to.floor)): { x: number; y: number } {
  if (exemptFromWalls(to) || !obstacles.length) return { x: to.x, y: to.y };
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 0.04));
  let cur = { x: from.x, y: from.y };
  let pushed = { x: 0, y: 0 }; // how far the walls have held the item back from the straight path
  for (let i = 1; i <= steps; i++) {
    const onPath = { x: from.x + (dx * i) / steps, y: from.y + (dy * i) / steps };
    const next = settledPosition(d, { ...to, x: onPath.x + pushed.x, y: onPath.y + pushed.y }, obstacles);
    if (!next) break; // squeezed: stay at the last place that fitted
    cur = next;
    pushed = { x: cur.x - onPath.x, y: cur.y - onPath.y };
  }
  return cur;
}

const sameShape = (a: Furniture, b: Furniture) => a.w === b.w && a.d === b.d && a.rotation === b.rotation && a.floor === b.floor;

const geometryChanged = (a: Furniture, b: Furniture) => a.x !== b.x || a.y !== b.y || a.w !== b.w || a.d !== b.d || a.rotation !== b.rotation;

export interface Settled {
  design: Design;
  /** Items that had no room and were put back (or not added). */
  refused: number;
}

/**
 * After an edit: furniture whose place or size changed is moved clear of the walls. An item that has no room goes back to where it was
 * (a new item is dropped). Walls and rooms being edited are left alone: nothing is pushed around when the walls change.
 */
export function settleFurniture(before: Design, after: Design): Settled {
  if (after.furniture === before.furniture || after.walls !== before.walls) return { design: after, refused: 0 };
  const old = new Map(before.furniture.map((f) => [f.id, f]));
  const cache = new Map<string, Point[][]>();
  const obstacles = (floor: string) => cache.get(floor) ?? cache.set(floor, wallObstacles(after, floor)).get(floor)!;
  let refused = 0;
  const next: Furniture[] = [];
  let changed = false;
  for (const f of after.furniture) {
    const was = old.get(f.id);
    if (was === f || (was && !geometryChanged(was, f))) {
      next.push(f);
      continue;
    }
    // an item that only moved is walked from where it was; a new, resized or turned one is looked at where it ends up
    const spot = was && sameShape(was, f) ? sweepPosition(after, was, f, obstacles(f.floor)) : settledPosition(after, f, obstacles(f.floor));
    if (spot) {
      if (spot.x !== f.x || spot.y !== f.y) {
        next.push({ ...f, x: round(spot.x), y: round(spot.y) });
        changed = true;
      } else next.push(f);
    } else {
      refused++;
      changed = true;
      if (was) next.push(was);
    }
  }
  if (!changed) return { design: after, refused: 0 };
  return { design: produce(after, (draft) => void (draft.furniture = next as typeof draft.furniture)), refused };
}

const round = (v: number) => Math.round(v * 1000) / 1000;
