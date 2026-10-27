/** Splitting a room in two along a line and merging two rooms that touch. Pure operations on a design or an immer draft. */
import type { Draft } from 'immer';
import { clipPolygon, polygonArea } from './geometry';
import { newId, type Design, type Point, type Room } from './model';

type Mutable = Draft<Design> | Design;

const key = (p: Point) => `${Math.round(p.x * 1e4)},${Math.round(p.y * 1e4)}`;

/** Remove points that lie on a straight line between their neighbours, and doubled points. */
export function simplifyPolygon(pts: Point[]): Point[] {
  let out = pts.filter((p, i) => key(p) !== key(pts[(i + 1) % pts.length]));
  for (let changed = true; changed && out.length > 3; ) {
    changed = false;
    for (let i = 0; i < out.length; i++) {
      const a = out[(i + out.length - 1) % out.length];
      const b = out[i];
      const c = out[(i + 1) % out.length];
      if (Math.abs((b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x)) < 1e-7) {
        out = out.filter((_, k) => k !== i);
        changed = true;
        break;
      }
    }
  }
  return out;
}

const signedArea = (pts: Point[]) => pts.reduce((s, p, i) => s + (p.x * pts[(i + 1) % pts.length].y - pts[(i + 1) % pts.length].x * p.y), 0) / 2;

/** The outline of two polygons that share part of their boundary, or null when they only touch at a point or do not touch. */
export function mergePolygons(a: Point[], b: Point[]): Point[] | null {
  const oriented = (pts: Point[]) => (signedArea(pts) >= 0 ? pts : [...pts].reverse());
  let A = oriented(a);
  let B = oriented(b);
  // cut each edge at the corners of the other polygon that lie on it, so that shared stretches have identical ends
  const onEdge = (p: Point, q: Point, r: Point) => {
    const cross = (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
    const len = Math.hypot(q.x - p.x, q.y - p.y) || 1;
    const t = ((r.x - p.x) * (q.x - p.x) + (r.y - p.y) * (q.y - p.y)) / (len * len);
    return Math.abs(cross) / len < 1e-4 && t > 1e-6 && t < 1 - 1e-6;
  };
  const split = (pts: Point[], other: Point[]): Point[] => {
    const out: Point[] = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const q = pts[(i + 1) % pts.length];
      out.push(p);
      const extra = other.filter((r) => onEdge(p, q, r)).sort((r1, r2) => Math.hypot(r1.x - p.x, r1.y - p.y) - Math.hypot(r2.x - p.x, r2.y - p.y));
      out.push(...extra);
    }
    return out;
  };
  A = split(A, B);
  B = split(B, A);
  const edges: [Point, Point][] = [];
  const add = (pts: Point[]) => pts.forEach((p, i) => edges.push([p, pts[(i + 1) % pts.length]]));
  add(A);
  add(B);
  // an edge that is walked in both directions is inside the merged room
  const kept = edges.filter(([p, q]) => !edges.some(([r, s]) => key(r) === key(q) && key(s) === key(p)));
  if (kept.length === edges.length) return null; // nothing shared
  const from = new Map<string, [Point, Point][]>();
  for (const e of kept) from.set(key(e[0]), [...(from.get(key(e[0])) ?? []), e]);
  const used = new Set<[Point, Point]>();
  const loop: Point[] = [];
  let cur = kept[0];
  for (let n = 0; n <= kept.length; n++) {
    loop.push(cur[0]);
    used.add(cur);
    if (key(cur[1]) === key(kept[0][0])) break;
    const next = (from.get(key(cur[1])) ?? []).find((e) => !used.has(e));
    if (!next) return null;
    cur = next;
  }
  if (used.size !== kept.length) return null; // two separate loops (the rooms touch in two places, or one has a hole)
  return simplifyPolygon(loop);
}

/** Merge room `idB` into room `idA` (the result keeps A's name and look). Returns false when they do not share a stretch of boundary. */
export function mergeRooms(d: Mutable, idA: string, idB: string): boolean {
  const A = d.rooms.find((r) => r.id === idA);
  const B = d.rooms.find((r) => r.id === idB);
  if (!A || !B || A.id === B.id || A.floor !== B.floor) return false;
  const merged = mergePolygons(A.points, B.points);
  if (!merged || merged.length < 3) return false;
  A.points = merged;
  delete A.seed; // the merged shape is not what the walls would give any more
  d.rooms = d.rooms.filter((r) => r.id !== B.id) as typeof d.rooms;
  return true;
}

/**
 * Cut a room in two along the line through p1 and p2. The new room is a copy (name "<name> 2"). Returns its id, or null when the line
 * does not cut the room in two worthwhile pieces.
 */
export function splitRoom(d: Mutable, roomId: string, p1: Point, p2: Point): string | null {
  const room = d.rooms.find((r) => r.id === roomId);
  if (!room) return null;
  const u = { x: p2.x - p1.x, y: p2.y - p1.y };
  const len = Math.hypot(u.x, u.y);
  if (len < 0.05) return null;
  const big = 1e4;
  const e = { x: (u.x / len) * big, y: (u.y / len) * big };
  const n = { x: -e.y, y: e.x };
  const half = (sign: number): Point[] => [
    { x: p1.x - e.x, y: p1.y - e.y },
    { x: p1.x + e.x, y: p1.y + e.y },
    { x: p1.x + e.x + sign * n.x, y: p1.y + e.y + sign * n.y },
    { x: p1.x - e.x + sign * n.x, y: p1.y - e.y + sign * n.y },
  ];
  const left = simplifyPolygon(clipPolygon(room.points, half(1)));
  const right = simplifyPolygon(clipPolygon(room.points, half(-1)));
  if (left.length < 3 || right.length < 3 || polygonArea(left) < 0.2 || polygonArea(right) < 0.2) return null;
  const id = newId();
  const copy: Room = { ...JSON.parse(JSON.stringify(room)), id, name: `${room.name} 2`, points: right };
  delete copy.seed;
  room.points = left;
  delete room.seed;
  d.rooms.push(copy);
  return id;
}
