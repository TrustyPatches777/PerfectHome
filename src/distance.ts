/** Distances between shapes: closest points on segments and between polygon outlines. Pure. */
import type { Point } from './model';

const dist = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);

/** The point on segment a–b that is closest to `p`. */
export function closestOnSegment(p: Point, a: Point, b: Point): Point {
  const l2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
  if (l2 === 0) return { ...a };
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2));
  return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
}

/** Where segments a–b and c–e cross, or null when they do not. */
function crossing(a: Point, b: Point, c: Point, e: Point): Point | null {
  const den = (b.x - a.x) * (e.y - c.y) - (b.y - a.y) * (e.x - c.x);
  if (Math.abs(den) < 1e-12) return null; // parallel
  const t = ((c.x - a.x) * (e.y - c.y) - (c.y - a.y) * (e.x - c.x)) / den;
  const u = ((c.x - a.x) * (b.y - a.y) - (c.y - a.y) * (b.x - a.x)) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) } : null;
}

export interface Closest {
  d: number;
  /** Closest point on the first shape and on the second. */
  p: Point;
  q: Point;
}

/** Shortest distance between segments a–b and c–e, with the closest point on each. */
export function segmentDistance(a: Point, b: Point, c: Point, e: Point): Closest {
  const x = crossing(a, b, c, e);
  if (x) return { d: 0, p: x, q: x };
  const options: [Point, Point][] = [
    [a, closestOnSegment(a, c, e)],
    [b, closestOnSegment(b, c, e)],
    [closestOnSegment(c, a, b), c],
    [closestOnSegment(e, a, b), e],
  ];
  let best = options[0];
  for (const o of options) if (dist(o[0], o[1]) < dist(best[0], best[1])) best = o;
  return { d: dist(best[0], best[1]), p: best[0], q: best[1] };
}

/** Closest approach between the outlines of two closed polygons. */
export function polygonOutlineDistance(a: Point[], b: Point[]): Closest | null {
  let best: Closest | null = null;
  for (let i = 0; i < a.length; i++)
    for (let j = 0; j < b.length; j++) {
      const r = segmentDistance(a[i], a[(i + 1) % a.length], b[j], b[(j + 1) % b.length]);
      if (!best || r.d < best.d) best = r;
    }
  return best;
}
