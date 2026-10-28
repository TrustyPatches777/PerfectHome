/**
 * The floor under a doorway. A room's floor stops at the inner faces of its walls, so where a door or an open passage cuts through a wall there
 * is a gap in the floor as wide as the wall is thick. These patches fill it: the floor of the room next to the opening continues through it, and
 * where two rooms meet each side gets its own material up to the middle of the wall.
 */
import { pointInPolygon, wallLength, wallPointAt } from './geometry';
import type { Design, Point, Room, Wall } from './model';
import { isWindowKind } from './windows';

export interface DoorwayPatch {
  openingId: string;
  room: Room;
  pts: Point[];
}

/** A strip along a wall between `s0` and `s1`, from `lo` to `hi` across the wall (positive = the right-hand side), as a polygon. */
function strip(w: Wall, s0: number, s1: number, lo: number, hi: number): Point[] {
  const n = w.bulge ? Math.max(2, Math.ceil((s1 - s0) / 0.25)) : 1;
  const near: Point[] = [];
  const far: Point[] = [];
  for (let i = 0; i <= n; i++) {
    const wp = wallPointAt(w, s0 + ((s1 - s0) * i) / n);
    near.push({ x: wp.p.x + wp.n.x * hi, y: wp.p.y + wp.n.y * hi });
    far.push({ x: wp.p.x + wp.n.x * lo, y: wp.p.y + wp.n.y * lo });
  }
  return [...near, ...far.reverse()];
}

export function doorwayPatches(d: Pick<Design, 'walls' | 'openings' | 'rooms'>): DoorwayPatch[] {
  const out: DoorwayPatch[] = [];
  const walls = new Map(d.walls.map((w) => [w.id, w]));
  for (const o of d.openings) {
    if (isWindowKind(o.kind)) continue;
    const w = walls.get(o.wallId);
    if (!w || w.type === 'railing') continue;
    const L = wallLength(w);
    const s0 = Math.max(0, o.pos - o.width / 2);
    const s1 = Math.min(L, o.pos + o.width / 2);
    if (s1 - s0 < 0.05) continue;
    const rooms = d.rooms.filter((r) => r.floor === w.floor);
    const mid = wallPointAt(w, o.pos);
    const probe = w.thickness / 2 + 0.12;
    const roomAt = (side: 1 | -1) => rooms.find((r) => pointInPolygon({ x: mid.p.x + mid.n.x * probe * side, y: mid.p.y + mid.n.y * probe * side }, r.points)) ?? null;
    const a = roomAt(1);
    const b = roomAt(-1);
    const h = w.thickness / 2 + 0.01; // a hair into the rooms, so that no seam shows
    if (a && b && a.id !== b.id) {
      out.push({ openingId: o.id, room: a, pts: strip(w, s0, s1, 0, h) }, { openingId: o.id, room: b, pts: strip(w, s0, s1, -h, 0) });
    } else {
      const room = a ?? b;
      if (room) out.push({ openingId: o.id, room, pts: strip(w, s0, s1, -h, h) });
    }
  }
  return out;
}
