import { describe, expect, it } from 'vitest';
import {
  detectRoom,
  pointOnWall,
  projectOnWall,
  wallArc,
  wallLength,
  wallOutlinePoints,
  wallPointAt,
  doorGeometry,
  formatLength,
  labelPoint,
  niceLength,
  nearestWall,
  pointInPolygon,
  polygonArea,
  polygonsOverlap,
  snapPoint,
  wallSolidSegments,
} from './geometry';
import type { Opening, Wall } from './model';

const wall = (id: string, ax: number, ay: number, bx: number, by: number, thickness = 0.2): Wall => ({
  id,
  floor: 'f',
  type: 'interior',
  height: 2.5,
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

describe('polygonsOverlap', () => {
  const rect = (x0: number, y0: number, x1: number, y1: number) => [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ];
  it('detects partial overlap, containment and identical shapes', () => {
    expect(polygonsOverlap(rect(0, 0, 4, 3), rect(3, 2, 6, 5))).toBe(true);
    expect(polygonsOverlap(rect(0, 0, 10, 10), rect(2, 2, 4, 4))).toBe(true);
    expect(polygonsOverlap(rect(2, 2, 4, 4), rect(0, 0, 10, 10))).toBe(true);
    expect(polygonsOverlap(rect(0, 0, 4, 3), rect(0, 0, 4, 3))).toBe(true);
    // cross-shaped: no vertex of either lies inside the other
    expect(polygonsOverlap(rect(0, 1, 6, 2), rect(2, 0, 3, 4))).toBe(true);
  });
  it('allows rooms that only touch or are apart', () => {
    expect(polygonsOverlap(rect(0, 0, 4, 3), rect(4, 0, 8, 3))).toBe(false); // shared edge
    expect(polygonsOverlap(rect(0, 0, 4, 3), rect(4, 3, 8, 6))).toBe(false); // shared corner
    expect(polygonsOverlap(rect(0, 0, 4, 3), rect(5, 0, 8, 3))).toBe(false);
  });
});

describe('curved walls', () => {
  const curved = (bulge: number): Wall => ({ ...wall('c', 0, 0, 4, 0), bulge });

  it('has the arc length of the circle through the end points and the apex', () => {
    const w = curved(1); // chord 4, rise 1 -> radius 2.5, angle 2*asin(0.8)
    const arc = wallArc(w)!;
    expect(arc.r).toBeCloseTo(2.5, 9);
    expect(wallLength(w)).toBeCloseTo(2.5 * 2 * Math.asin(0.8), 9);
    expect(wallLength(curved(0))).toBe(4);
    expect(wallArc(curved(0.0004))).toBeNull(); // practically straight
    // a half circle: chord 4, rise 2 -> length pi * 2
    expect(wallLength(curved(2))).toBeCloseTo(Math.PI * 2, 9);
  });

  it('bulges to the right of a→b for positive values and to the left for negative ones', () => {
    const L = wallLength(curved(1));
    const apex = pointOnWall(curved(1), L / 2);
    expect(apex.x).toBeCloseTo(2, 9);
    expect(apex.y).toBeCloseTo(1, 9); // +y is the right-hand side of a left-to-right wall on screen
    expect(pointOnWall(curved(-1), L / 2).y).toBeCloseTo(-1, 9);
    // both ends stay put
    expect(pointOnWall(curved(1), 0).x).toBeCloseTo(0, 9);
    const end = pointOnWall(curved(1), L);
    expect(end.x).toBeCloseTo(4, 9);
    expect(end.y).toBeCloseTo(0, 9);
  });

  it('has a tangent that follows the curve and a normal on the right', () => {
    const w = curved(1);
    const start = wallPointAt(w, 0);
    const mid = wallPointAt(w, wallLength(w) / 2);
    expect(mid.u.x).toBeCloseTo(1, 9); // heading along +x at the apex
    expect(mid.n.y).toBeCloseTo(1, 9);
    expect(start.u.y).toBeGreaterThan(0.5); // bulging right (down): it starts out heading down-right
    expect(start.u.x).toBeGreaterThan(0);
  });

  it('projects points back to the same position (round trip), also for bulging left and beyond the ends', () => {
    for (const bulge of [1, -1, 2, -0.5]) {
      const w = curved(bulge);
      const L = wallLength(w);
      for (const s of [0, 0.3 * L, 0.5 * L, 0.9 * L, L]) {
        for (const d of [-0.2, 0, 0.3]) {
          const back = projectOnWall(w, pointOnWall(w, s, d));
          expect(back.s, `bulge ${bulge} s ${s}`).toBeCloseTo(s, 6);
          expect(back.d, `bulge ${bulge} d ${d}`).toBeCloseTo(d, 6);
        }
      }
    }
    const w = curved(1);
    expect(projectOnWall(w, pointOnWall(w, -0.5)).s).toBeCloseTo(-0.5, 6); // before the start
    expect(projectOnWall(w, pointOnWall(w, wallLength(w) + 0.5)).s).toBeCloseTo(wallLength(w) + 0.5, 6);
  });

  it('finds the nearest curved wall and the side of the cursor', () => {
    const w = curved(1);
    const hit = nearestWall({ x: 2, y: 1.2 }, [w], 0.5)!; // just outside the apex
    expect(hit.d).toBeGreaterThan(0);
    expect(hit.s).toBeCloseTo(wallLength(w) / 2, 1);
    expect(nearestWall({ x: 2, y: 0 }, [w], 0.5)).toBeNull(); // on the chord: not near the arc
  });

  it('cuts doors out along the curve and draws them tangent to it', () => {
    const w = curved(1);
    const L = wallLength(w);
    const segs = wallSolidSegments(w, [door({ wallId: 'c', pos: L / 2, width: 1 })]);
    expect(segs).toHaveLength(2);
    expect(segs[0][1]).toBeCloseTo(L / 2 - 0.5, 9);
    const g = doorGeometry(w, door({ wallId: 'c', pos: L / 2, width: 1, hinge: 'a', swing: 1 }));
    expect(g.hinge.x).toBeCloseTo(1.5, 6); // at the apex the tangent is horizontal
    expect(g.hinge.y).toBeCloseTo(1, 6);
    expect(g.leafEnd.y).toBeCloseTo(2, 6); // swings to the right (down)
  });

  it('has an outline polygon around the curve', () => {
    const w = curved(1);
    const pts = wallOutlinePoints(w);
    expect(pts.length).toBeGreaterThan(8);
    const ys = pts.map((p) => p.y);
    expect(Math.max(...ys)).toBeCloseTo(1.1, 1); // apex + half the 0.2 thickness (a sampled polygon, so not exact)
    expect(polygonArea(pts)).toBeCloseTo((wallLength(w) + 0.2) * 0.2, 1);
  });

  it('detects a D-shaped room closed by a straight wall and an arc', () => {
    const walls = [wall('s', 0, 0, 4, 0), { ...wall('c', 4, 0, 0, 0), bulge: 2 }]; // half circle below... or above
    const above = detectRoom({ x: 2, y: -1 }, walls);
    const below = detectRoom({ x: 2, y: 1 }, walls);
    const room = above ?? below;
    expect(room).not.toBeNull();
    // inner radius 1.9, minus the straight wall's half thickness
    expect(Math.abs(polygonArea(room!) - (Math.PI * 1.9 * 1.9) / 2 + 0.1 * 3.8)).toBeLessThan(0.25);
    expect(above === null || below === null).toBe(true); // only one side is enclosed
  });
});
