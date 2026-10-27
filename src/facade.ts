/**
 * The cladding of a whole house: the outside face of every exterior wall is covered with one finish (brick, render, timber...) in one
 * go. Which face is the outside is worked out from the rooms next to the wall (the face with no room is outside).
 */
import type { Draft } from 'immer';
import { pointInPolygon, wallLength, wallPointAt } from './geometry';
import type { Design, Wall, WallSkin } from './model';

type Mutable = Draft<Design> | Design;

/** The face of a wall that looks outside the house: `l` or `r` (looking from its start to its end); null for a wall inside the house. */
export function outerSide(d: Pick<Design, 'rooms' | 'walls'>, w: Wall): 'l' | 'r' | null {
  const mid = wallPointAt(w, wallLength(w) / 2);
  const off = w.thickness / 2 + 0.3;
  const right = { x: mid.p.x + mid.n.x * off, y: mid.p.y + mid.n.y * off };
  const left = { x: mid.p.x - mid.n.x * off, y: mid.p.y - mid.n.y * off };
  const rooms = d.rooms.filter((r) => r.floor === w.floor);
  const inRight = rooms.some((r) => pointInPolygon(right, r.points));
  const inLeft = rooms.some((r) => pointInPolygon(left, r.points));
  if (inRight !== inLeft) return inRight ? 'l' : 'r';
  if (inRight && inLeft) return null; // a room on each side: an inside wall
  // no rooms next to it (a house drawn with walls only): outside is the side away from the middle of the floor's walls
  const walls = d.walls.filter((x) => x.floor === w.floor);
  if (walls.length < 3) return null;
  const pts = walls.flatMap((x) => [x.a, x.b]);
  const c = { x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length };
  const dist = (p: { x: number; y: number }) => Math.hypot(p.x - c.x, p.y - c.y);
  return dist(right) > dist(left) ? 'r' : 'l';
}

/**
 * Cover the outside of the exterior walls of the given floors with `skin` (or take the covering off the outside when it is null).
 * Returns how many walls were changed.
 */
export function coverOutside(d: Mutable, floors: string[], skin: WallSkin | null): number {
  let n = 0;
  for (const w of d.walls) {
    if (w.type !== 'exterior' || !floors.includes(w.floor)) continue;
    const side = outerSide(d, w as Wall);
    if (!side) continue;
    if (skin) w.paint = { ...w.paint, [side]: { ...skin } };
    else if (w.paint) {
      delete w.paint[side];
      if (!w.paint.l && !w.paint.r) delete w.paint;
    }
    n++;
  }
  return n;
}
