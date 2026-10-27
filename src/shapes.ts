/**
 * Rectangular building blocks: four walls from two corners, a room added to a design, an edge of a polygon pushed sideways, and
 * rooms re-measured after their walls moved. Pure (they work on a design or a draft of it), so they are easy to test.
 */
import type { Draft } from 'immer';
import { detectRoom, polygonsOverlap } from './geometry';
import { newId, type Design, type Point, type Room, type Wall, type WallType } from './model';

/** The four corners of the box between two opposite corners, clockwise on screen starting at the top-left. */
export function boxCorners(a: Point, b: Point): Point[] {
  const x0 = Math.min(a.x, b.x);
  const x1 = Math.max(a.x, b.x);
  const y0 = Math.min(a.y, b.y);
  const y1 = Math.max(a.y, b.y);
  return [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
}

/** Four joined walls around the box between two corners (their center lines run along the box edges). */
export function rectWalls(a: Point, b: Point, floor: string, thickness: number, type: WallType, height: number): Wall[] {
  const c = boxCorners(a, b);
  return c.map((p, i) => ({ id: newId(), floor, a: { ...p }, b: { ...c[(i + 1) % 4] }, thickness, type, height }));
}

/** Add a room with the next free name ("Room 3") unless it would overlap another room on its floor. Returns its id, or null. */
export function addRoomTo(d: Draft<Design>, floor: string, points: Point[], seed: Point | undefined, color: string): string | null {
  if (d.rooms.some((r) => r.floor === floor && polygonsOverlap(points, r.points))) return null;
  const used = d.rooms.filter((r) => r.floor === floor).map((r) => /^Room (\d+)$/.exec(r.name)).map((m) => (m ? Number(m[1]) : 0));
  const id = newId();
  const room: Room = { id, floor, name: `Room ${Math.max(0, ...used) + 1}`, color, material: 'plain', living: true, points, seed };
  d.rooms.push(room);
  return id;
}

/** Move edge `i` (from point i to point i+1) sideways, along its own normal, by `delta` meters. The neighbouring edges stretch with it. */
export function shiftEdge(points: Point[], i: number, delta: number): Point[] {
  const a = points[i];
  const b = points[(i + 1) % points.length];
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  if (len < 1e-9) return points;
  const nx = -(b.y - a.y) / len;
  const ny = (b.x - a.x) / len;
  return points.map((p, k) => (k === i || k === (i + 1) % points.length ? { x: p.x + nx * delta, y: p.y + ny * delta } : p));
}

/** The unit normal that `shiftEdge` moves along (its sign is arbitrary but fixed). */
export function edgeNormal(points: Point[], i: number): Point {
  const a = points[i];
  const b = points[(i + 1) % points.length];
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  return { x: -(b.y - a.y) / len, y: (b.x - a.x) / len };
}

const sameOutline = (a: Point[], b: Point[]) => a.length === b.length && a.every((p, i) => Math.abs(p.x - b[i].x) < 1e-4 && Math.abs(p.y - b[i].y) < 1e-4);

/**
 * Rooms that were found from their walls (they remember a seed point inside) follow the walls: when a wall has moved, the room is
 * measured again. A room stays as it is when the walls no longer close around its seed or when the new shape would overlap another room.
 * Returns how many rooms changed.
 */
export function refitRooms(d: Draft<Design>, floor: string): number {
  let changed = 0;
  const walls = d.walls.filter((w) => w.floor === floor);
  for (const room of d.rooms) {
    if (room.floor !== floor || !room.seed) continue;
    const poly = detectRoom(room.seed, walls as Wall[]);
    if (!poly || poly.length < 3 || sameOutline(poly, room.points)) continue;
    if (d.rooms.some((o) => o.id !== room.id && o.floor === floor && polygonsOverlap(o.points, poly))) continue;
    room.points = poly;
    changed++;
  }
  return changed;
}
