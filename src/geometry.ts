/** Pure geometry helpers. No React, no Konva, no state: easy to unit test. All units are meters. */
import type { Point } from './model';

export const dist = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);

export function snapValue(v: number, step: number): number {
  return Math.round(v / step) * step;
}

/** Round away float noise (e.g. 0.30000000000000004) without changing the visible value. */
export const clean = (v: number) => Math.round(v * 1e6) / 1e6 + 0; // `+ 0` turns -0 into 0

export function snapPoint(p: Point, step: number): Point {
  return { x: clean(snapValue(p.x, step)), y: clean(snapValue(p.y, step)) };
}

/** Pick a "nice" 1-2-5 length (meters) whose on-screen size is at least `minPx` at `zoom` px/m. */
export function niceLength(zoom: number, minPx: number): number {
  const raw = minPx / zoom;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  for (const m of [1, 2, 5, 10]) if (m * pow >= raw) return m * pow;
  return 10 * pow;
}

/** "3.20 m" for lengths, "45 cm" for short ones. */
export function formatLength(m: number): string {
  if (m < 1) return `${Math.round(m * 100)} cm`;
  return `${(Math.round(m * 100) / 100).toFixed(2)} m`;
}

export function formatArea(m2: number): string {
  return `${(Math.round(m2 * 100) / 100).toFixed(2)} m²`;
}
