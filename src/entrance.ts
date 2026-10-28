/**
 * Entrance steps: the flight of steps from the ground outside up to the front door. The number of steps follows the height that has to be climbed
 * (the ground floor above the ground at that spot), and next to a door they sit centered on it with their top against the outside of the wall.
 */
import { outerSide } from './facade';
import { wallPointAt } from './geometry';
import type { Design, Point } from './model';
import { groundAt } from './terrain';
import { floorElevations } from './view3d/build';
import { isWindowKind } from './windows';

/** A short default flight (three steps, 45 cm) for when there is nothing to measure. */
export const ENTRANCE_STEPS = { w: 1.4, d: 0.9, steps: 3, rise: 0.45 };

/**
 * Where entrance steps go when the cursor is near a door: centered on the door, turned to climb into it, with their top end against the outside face
 * of the wall (so that they neither float in front of it nor clip through it). Null when no door is within reach.
 */
export function snapEntrance(d: Design, p: Point, floor: string, steps: { d: number }): { x: number; y: number; rotation: number; w: number } | null {
  let best: { dist: number; o: Design['openings'][number]; w: Design['walls'][number] } | null = null;
  for (const o of d.openings) {
    if (isWindowKind(o.kind)) continue;
    const w = d.walls.find((x) => x.id === o.wallId && x.floor === floor);
    if (!w) continue;
    const c = wallPointAt(w, o.pos).p;
    const dist = Math.hypot(c.x - p.x, c.y - p.y);
    if (dist < 3 && (!best || dist < best.dist)) best = { dist, o, w };
  }
  if (!best) return null;
  const wp = wallPointAt(best.w, best.o.pos);
  const side = outerSide(d, best.w);
  // outwards is the side with no room next to it; without rooms, the side the cursor is on
  const toward = (p.x - wp.p.x) * wp.n.x + (p.y - wp.p.y) * wp.n.y >= 0 ? 1 : -1;
  const out = side ? (side === 'r' ? 1 : -1) : toward;
  const ox = wp.n.x * out;
  const oy = wp.n.y * out;
  const reach = best.w.thickness / 2 + steps.d / 2;
  const rotation = ((Math.round((Math.atan2(-ox, oy) * 180) / Math.PI) % 360) + 360) % 360; // the high end of the steps points into the wall
  return { x: wp.p.x + ox * reach, y: wp.p.y + oy * reach, rotation, w: Math.min(2.4, Math.max(1.0, best.o.width + 0.3)) };
}

/** Steps from the ground at `p` up to the floor of the house: as many as the height needs (17 cm each, 30 cm deep), at least one. */
export function entranceSteps(d: Design, p: Point, floor: string): typeof ENTRANCE_STEPS {
  const up = (floorElevations(d).get(floor) ?? 0) - groundAt(d, p).base;
  const rise = up > 0.02 ? Math.round(up * 100) / 100 : 0.15;
  const steps = Math.max(1, Math.round(rise / 0.17));
  return { w: ENTRANCE_STEPS.w, d: Math.max(0.6, steps * 0.3), steps, rise };
}
