/** How each wall type looks. (Default thicknesses and heights live in model.ts, next to the data.) */
import { wallPointAt } from './geometry';

export { faceSpan } from './geometry';
import type { Point, Wall, WallFinish, WallType } from './model';

export const WALL_STYLE: Record<WallType, { label: string; fill: string; hint: string; hatch?: boolean }> = {
  exterior: { label: 'Exterior / load-bearing', fill: '#262c3a', hint: 'The outer shell and any wall that carries the floors or roof above: thick, solid. Roofs are fitted to these.' },
  interior: { label: 'Interior', fill: '#3b4252', hint: 'An ordinary wall between rooms.' },
  partition: { label: 'Partition', fill: '#7b8499', hint: 'A thin, light wall that only divides a space and carries nothing.' },
  railing: { label: 'Railing / low wall', fill: '#b9c0cc', hint: 'A balustrade or low wall, 1 m high.' },
};

export const FINISH_STYLES: Record<WallFinish, { label: string; color: string }> = {
  paint: { label: 'Paint', color: '#f5f0e6' },
  plaster: { label: 'Plaster', color: '#e9e2d6' },
  brick: { label: 'Brick', color: '#b5603f' },
  stone: { label: 'Stone', color: '#a8a29a' },
  wood: { label: 'Wood cladding', color: '#a47c52' },
  tiles: { label: 'Tiles', color: '#d3e0e8' },
  concrete: { label: 'Concrete', color: '#a3a7ab' },
};

/** Colors offered for walls. */
export const PAINT_COLORS = ['#ffffff', '#f5f0e6', '#e9d8b8', '#f2c9b0', '#e6c9c9', '#c7d7ee', '#b7c9a8', '#cdd6a0', '#f2e2a8', '#9db4d6', '#6b7280', '#374151'];

/**
 * The line along one face of a wall between two distances along it, pulled `inset` meters into the wall: where the colored stripe
 * of a painted face is drawn on the plan. Follows curved walls. `side` r = the right face looking from a to b, l = the left one.
 */
export function wallFaceLine(w: Wall, s0: number, s1: number, side: 'l' | 'r', inset = 0): Point[] {
  const off = (w.thickness / 2 - inset) * (side === 'r' ? 1 : -1);
  const steps = w.bulge ? Math.max(2, Math.ceil(Math.abs(w.bulge) * 6)) + Math.ceil((s1 - s0) / 0.5) : 1;
  const out: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    const wp = wallPointAt(w, s0 + ((s1 - s0) * i) / steps);
    out.push({ x: wp.p.x + wp.n.x * off, y: wp.p.y + wp.n.y * off });
  }
  return out;
}
