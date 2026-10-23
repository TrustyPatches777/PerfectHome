import { describe, expect, it } from 'vitest';
import {
  detectRoom,
  doorGeometry,
  formatLength,
  labelPoint,
  niceLength,
  nearestWall,
  pointInPolygon,
  polygonArea,
  snapPoint,
  wallSolidSegments,
} from './geometry';
import type { Opening, Wall } from './model';

const wall = (id: string, ax: number, ay: number, bx: number, by: number, thickness = 0.2): Wall => ({
  id,
  a: { x: ax, y: ay },
  b: { x: bx, y: by },
  thickness,
});
const box = (x0: number, y0: number, x1: number, y1: number, t = 0.2): Wall[] => [
  wall('t', x0, y0, x1, y0, t),
  wall('r', x1, y0, x1, y1, t),
  wall('b', x1, y1, x0, y1, t),
  wall('l', x0, y1, x0, y0, t),
];
const door = (over: Partial<Opening> = {}): Opening => ({
  id: 'd',
  wallId: 't',
  kind: 'door',
  pos: 2,
  width: 1,
  swing: 1,
  hinge: 'a',
  ...over,
});

describe('walls and openings', () => {
  it('cuts openings out of the solid wall and extends the ends by half the thickness', () => {
    const segs = wallSolidSegments(wall('t', 0, 0, 4, 0), [door()]);
    expect(segs).toEqual([
      [-0.1, 1.5],
      [2.5, 4.1],
    ]);
  });

  it('door arc starts at the far jamb and ends perpendicular to the wall on the swing side', () => {
    const w = wall('t', 0, 0, 4, 0);
    const g = doorGeometry(w, door());
    expect(g.hinge).toEqual({ x: 1.5, y: 0 });
    expect(g.arc[0].x).toBeCloseTo(2.5);
    expect(g.arc[0].y).toBeCloseTo(0);
    expect(g.leafEnd.x).toBeCloseTo(1.5);
    expect(g.leafEnd.y).toBeCloseTo(1); // swing +1 = screen-right of a→b = +y here
    const flipped = doorGeometry(w, door({ swing: -1, hinge: 'b' }));
    expect(flipped.hinge.x).toBeCloseTo(2.5);
    expect(flipped.leafEnd.y).toBeCloseTo(-1);
  });

  it('finds the nearest wall and which side the point is on', () => {
    const walls = box(0, 0, 4, 3);
    const hit = nearestWall({ x: 2, y: 0.3 }, walls, 0.5)!;
    expect(hit.wall.id).toBe('t');
    expect(hit.s).toBeCloseTo(2);
    expect(hit.d).toBeGreaterThan(0);
    expect(nearestWall({ x: 2, y: 1.5 }, walls, 0.5)).toBeNull();
  });
});

describe('rooms', () => {
  it('computes polygon area and label point', () => {
    const sq = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 3 },
      { x: 0, y: 3 },
    ];
    expect(polygonArea(sq)).toBe(12);
    expect(labelPoint(sq)).toEqual({ x: 2, y: 1.5 });
    const L = [
      { x: 0, y: 0 },
      { x: 6, y: 0 },
      { x: 6, y: 1 },
      { x: 1, y: 1 },
      { x: 1, y: 6 },
      { x: 0, y: 6 },
    ];
    expect(pointInPolygon(labelPoint(L), L)).toBe(true);
  });

  it('detects a rectangular room measured to the inner wall faces', () => {
    const poly = detectRoom({ x: 2, y: 1.5 }, box(0, 0, 4, 3))!;
    expect(poly).not.toBeNull();
    expect(poly).toHaveLength(4);
    // inner size = 4 - 0.2 by 3 - 0.2
    expect(polygonArea(poly)).toBeCloseTo(3.8 * 2.8, 1);
  });

  it('detects an L-shaped room', () => {
    const walls = [
      wall('1', 0, 0, 6, 0),
      wall('2', 6, 0, 6, 3),
      wall('3', 6, 3, 3, 3),
      wall('4', 3, 3, 3, 6),
      wall('5', 3, 6, 0, 6),
      wall('6', 0, 6, 0, 0),
    ];
    const poly = detectRoom({ x: 1, y: 1 }, walls)!;
    expect(poly).toHaveLength(6);
    // inner faces: 5.8 x 2.8 on top plus 2.8 x 3.0 below
    expect(Math.abs(polygonArea(poly) - 24.64)).toBeLessThan(0.15);
  });

  it('detects a room bounded by a diagonal wall', () => {
    const walls = [wall('1', 0, 0, 4, 0), wall('2', 4, 0, 0, 4), wall('3', 0, 4, 0, 0)];
    const poly = detectRoom({ x: 1, y: 1 }, walls)!;
    expect(poly).not.toBeNull();
    expect(poly.length).toBeLessThanOrEqual(5);
  });

  it('returns null when not enclosed or when clicking inside a wall', () => {
    const open = box(0, 0, 4, 3).slice(0, 3); // missing left wall
    expect(detectRoom({ x: 2, y: 1.5 }, open)).toBeNull();
    expect(detectRoom({ x: 2, y: 0 }, box(0, 0, 4, 3))).toBeNull();
    expect(detectRoom({ x: 9, y: 9 }, box(0, 0, 4, 3))).toBeNull();
    expect(detectRoom({ x: 1, y: 1 }, [])).toBeNull();
  });
});

describe('snapping', () => {
  it('snaps to the grid step without float noise', () => {
    expect(snapPoint({ x: 0.34, y: 1.06 }, 0.1)).toEqual({ x: 0.3, y: 1.1 });
    expect(snapPoint({ x: -0.2, y: 0.26 }, 0.25)).toEqual({ x: -0.25, y: 0.25 });
    expect(snapPoint({ x: -0.01, y: 0 }, 0.1)).toEqual({ x: 0, y: 0 });
  });
});

describe('scale bar helpers', () => {
  it('picks 1-2-5 lengths that are wide enough', () => {
    for (const zoom of [5, 17, 60, 140, 500]) {
      const len = niceLength(zoom, 70);
      expect(len * zoom).toBeGreaterThanOrEqual(70);
      expect(len * zoom).toBeLessThan(70 * 2.6);
      expect([1, 2, 5]).toContain(Number((len / 10 ** Math.floor(Math.log10(len))).toFixed(6)));
    }
  });
  it('formats lengths', () => {
    expect(formatLength(0.45)).toBe('45 cm');
    expect(formatLength(3.2)).toBe('3.20 m');
  });
});
