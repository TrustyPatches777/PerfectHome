/** Placing wall-mounted symbols (sockets, switches, taps...) flat against the wall face nearest the cursor. */
import { nearestWall, wallLength, wallPointAt } from './geometry';
import type { Point, Wall } from './model';

export interface Mounted {
  x: number;
  y: number;
  rotation: number;
  wallId: string;
}

/**
 * The position and rotation that puts an item (box `w` wide along the wall, `d` deep out from it) against the wall
 * face on the cursor's side, with its back to the wall. Null when no wall is within `reach` meters.
 */
export function mountOnWall(cursor: Point, walls: Wall[], d: number, reach = 0.6, snapStep = 0): Mounted | null {
  const hit = nearestWall(cursor, walls, reach);
  if (!hit) return null;
  const L = wallLength(hit.wall);
  const s = Math.min(L, Math.max(0, snapStep > 0 ? Math.round(hit.s / snapStep) * snapStep : hit.s));
  const wp = wallPointAt(hit.wall, s);
  const side = hit.d >= 0 ? 1 : -1; // which face of the wall the cursor is on
  const off = hit.wall.thickness / 2 + d / 2;
  return {
    x: wp.p.x + wp.n.x * off * side,
    y: wp.p.y + wp.n.y * off * side,
    rotation: (((wp.angle + (side === 1 ? 0 : 180)) % 360) + 360) % 360,
    wallId: hit.wall.id,
  };
}
