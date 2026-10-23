import { describe, expect, it } from 'vitest';
import { createDesign, type Design, type Point } from './model';
import { pointInPolygon } from './geometry';
import { computeShadows, ellipsePolygon, groundIndex, normalized, sweepPolygon } from './shadows';

const square: Point[] = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
];
const covered = (polys: Point[][], p: Point) => polys.some((q) => pointInPolygon(p, q));
const area = (p: Point[]) => {
  let s = 0;
  for (let i = 0; i < p.length; i++) s += p[i].x * p[(i + 1) % p.length].y - p[(i + 1) % p.length].x * p[i].y;
  return s / 2;
};

describe('sweeping', () => {
  it('covers the object and the strip it is dragged across', () => {
    const polys = sweepPolygon(square, 0, -2); // a unit square, shadow 2 m upwards
    expect(covered(polys, { x: 0.5, y: 0.5 })).toBe(true);
    expect(covered(polys, { x: 0.5, y: -1.5 })).toBe(true);
    expect(covered(polys, { x: 0.5, y: -2.5 })).toBe(false);
    expect(covered(polys, { x: 1.5, y: -1 })).toBe(false);
    // diagonal sweep leaves the corners it should
    const diag = sweepPolygon(square, 2, 2);
    expect(covered(diag, { x: 2, y: 1.5 })).toBe(true);
    expect(covered(diag, { x: 0.2, y: 2.5 })).toBe(false);
  });

  it('winds every polygon the same way, so a merged fill has no holes', () => {
    for (const poly of sweepPolygon(square, 1.3, -0.7)) expect(area(poly)).toBeGreaterThan(0);
    for (const poly of sweepPolygon([...square].reverse(), -2, 1)) expect(area(poly)).toBeGreaterThan(0);
    expect(area(normalized([...square].reverse()))).toBeGreaterThan(0);
  });

  it('handles non-convex outlines', () => {
    const L: Point[] = [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 3 }, { x: 0, y: 3 }];
    const polys = sweepPolygon(L, 0, 2);
    expect(covered(polys, { x: 2, y: 2.5 })).toBe(true); // the notch is shadowed by the arm above it
    expect(covered(polys, { x: 0.5, y: 4.5 })).toBe(true);
    expect(covered(polys, { x: 2.5, y: 4 })).toBe(false);
  });

  it('draws round things as ellipses', () => {
    const e = ellipsePolygon(2, 2, 1, 0.5, 0);
    expect(e).toHaveLength(20);
    expect(Math.abs(area(normalized(e)))).toBeCloseTo(Math.PI * 0.5, 1);
    expect(pointInPolygon({ x: 2, y: 2 }, e)).toBe(true);
    expect(pointInPolygon({ x: 2, y: 2.7 }, e)).toBe(false);
  });
});

function scene(): { d: Design; F: string } {
  const d = createDesign();
  const F = d.floors[0].id;
  const wall = (id: string, ax: number, ay: number, bx: number, by: number) => d.walls.push({ id, floor: F, a: { x: ax, y: ay }, b: { x: bx, y: by }, thickness: 0.2, type: 'interior', height: 2.5 });
  wall('t', 0, 0, 6, 0);
  wall('r', 6, 0, 6, 4);
  wall('b', 6, 4, 0, 4);
  wall('l', 0, 4, 0, 0);
  d.rooms.push({ id: 'r', floor: F, name: 'R', color: '#fff', material: 'plain', living: true, points: [{ x: 0.1, y: 0.1 }, { x: 5.9, y: 0.1 }, { x: 5.9, y: 3.9 }, { x: 0.1, y: 3.9 }] });
  return { d, F };
}

describe('shadows of a design', () => {
  const noonSouth = { azimuth: 180, elevation: 45 };

  it('throws the house shadow to the north at noon (up on the plan), outside the building', () => {
    const { d, F } = scene();
    const { shadows, cutouts } = computeShadows(d, F, noonSouth);
    // house height = 1 storey 2.8 + 0.4 = 3.2 m; at 45 deg the shadow is 3.2 m long
    expect(covered(shadows, { x: 3, y: -2.5 })).toBe(true);
    expect(covered(shadows, { x: 3, y: -3.5 })).toBe(false);
    expect(covered(shadows, { x: 3, y: 5 })).toBe(false); // nothing falls on the south side
    expect(cutouts.length).toBeGreaterThan(0);
    expect(covered(cutouts, { x: 3, y: 2 })).toBe(true); // the inside is cut out of the shadow
    expect(covered(cutouts, { x: 3, y: -2 })).toBe(false);
  });

  it('a taller building (more floors) throws a longer shadow, and only the ground floor view shows it', () => {
    const { d, F } = scene();
    d.floors.push({ id: 'up', name: '1st floor' });
    const long = computeShadows(d, F, noonSouth);
    expect(covered(long.shadows, { x: 3, y: -5.5 })).toBe(true); // 2 storeys = 6 m long
    const upstairs = computeShadows(d, 'up', noonSouth);
    expect(upstairs.cutouts).toHaveLength(0);
    expect(upstairs.shadows).toHaveLength(0); // no walls or furniture on that floor
  });

  it('turns with the sun and with the compass', () => {
    const { d, F } = scene();
    const east = computeShadows(d, F, { azimuth: 90, elevation: 45 }); // morning: shadows go west (left)
    expect(covered(east.shadows, { x: -2, y: 2 })).toBe(true);
    expect(covered(east.shadows, { x: 8, y: 2 })).toBe(false);
    d.site.north = 90; // north now points to the right on screen, so a noon sun shadow points right
    const turned = computeShadows(d, F, noonSouth);
    expect(covered(turned.shadows, { x: 8, y: 2 })).toBe(true);
  });

  it('draws shadows of furniture, trees, fences and hedges, but not rugs or sockets', () => {
    const { d, F } = scene();
    const f = (id: string, type: string, x: number, y: number, w: number, dd: number) =>
      d.furniture.push({ id, floor: F, type, x, y, w, d: dd, rotation: 0, color: '#fff', label: '' });
    f('tree', 'tree', 10, 2, 3, 3);
    f('rug', 'rug', 3, 2, 2, 1.4);
    f('socket', 'socket', 3, 0.15, 0.22, 0.1);
    d.strips.push({ id: 'fence', floor: F, kind: 'fence', width: 0.1, points: [{ x: 8, y: 8 }, { x: 14, y: 8 }] });
    d.strips.push({ id: 'road', floor: F, kind: 'road', width: 6, points: [{ x: 0, y: 12 }, { x: 14, y: 12 }] });
    const { shadows } = computeShadows(d, F, noonSouth);
    expect(covered(shadows, { x: 10, y: -2 })).toBe(true); // 6 m tree: shadow 6 m to the north of (10, 2)
    expect(covered(shadows, { x: 11, y: 4 })).toBe(false); // south of the tree and north of the fence shadow: sunny
    expect(covered(shadows, { x: 11, y: 6.4 })).toBe(true); // 1.8 m fence, shadow 1.8 m north of y = 8
    expect(covered(shadows, { x: 7, y: 11 })).toBe(false); // roads do not cast shadows
  });

  it('no shadows at night; the ground floor skips basements', () => {
    const { d, F } = scene();
    expect(computeShadows(d, F, { azimuth: 0, elevation: -20 }).shadows).toHaveLength(0);
    d.floors.unshift({ id: 'cellar', name: 'Basement' });
    expect(groundIndex(d)).toBe(1);
    expect(computeShadows(d, F, noonSouth).cutouts.length).toBeGreaterThan(0);
    expect(computeShadows(d, 'cellar', noonSouth).cutouts).toHaveLength(0);
  });
});
