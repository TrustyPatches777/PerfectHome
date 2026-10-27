import { describe, expect, it } from 'vitest';
import { atticOutlines } from './floors';
import { polygonArea } from './geometry';
import { createDesign, type Design, type Stair, type Zone } from './model';
import { plotFirst } from './outdoor';
import { guardAvoid, guardRuns } from './stairs';
import { sceneChunks } from './view3d/build';

const stair = (id: string, floor: string, x: number, y: number, extra: Partial<Stair> = {}): Stair => ({ id, floor, kind: 'straight', x, y, w: 1, d: 4, rotation: 0, steps: 16, rise: 2.8, flip: false, railing: { style: 'wood', a: true, b: true }, ...extra });
const rect = (id: string, floor: string, x0: number, y0: number, x1: number, y1: number) => ({ id, floor, name: id, color: '#eee', material: 'plain' as const, living: true, points: [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }] });

describe('the attic is built from the house', () => {
  it('the rooms of the floor below, joined where they touch, are the floor of the attic', () => {
    const d = createDesign();
    const F = d.floors[0].id;
    d.rooms.push(rect('a', F, 0, 0, 4, 3), rect('b', F, 4, 0, 8, 3), rect('far', F, 20, 0, 24, 3));
    const outlines = atticOutlines(d, F);
    expect(outlines).toHaveLength(2); // the two that touch are one, the one far away stays apart
    expect(outlines.map((p) => polygonArea(p)).sort((x, y) => x - y)).toEqual([12, 24]);
  });

  it('with no rooms it is the area under the roof; with neither it is nothing', () => {
    const d = createDesign();
    const F = d.floors[0].id;
    expect(atticOutlines(d, F)).toEqual([]);
    d.roofs.push({ id: 'r', floor: F, kind: 'gable', x: 3, y: 2, w: 6, d: 4, rotation: 0, pitch: 35, overhang: 0.4, thickness: 0.15, material: 'tiles', color: '#b5523b', chimney: false, parapet: false });
    const [outline] = atticOutlines(d, F);
    expect(polygonArea(outline)).toBeCloseTo(24);
    d.roofs[0].kind = 'flat';
    expect(atticOutlines(d, F)).toEqual([]);
  });
});

describe('the plot boundary is at the back', () => {
  it('whichever order the areas were drawn in', () => {
    const z = (id: string, kind: Zone['kind']) => ({ id, kind }) as Zone;
    expect(plotFirst([z('lawn', 'lawn'), z('plot', 'plot'), z('pool', 'water'), z('plot2', 'plot')]).map((x) => x.id)).toEqual(['plot', 'plot2', 'lawn', 'pool']);
    expect(plotFirst([])).toEqual([]);
  });
});

describe('two stairs on top of each other', () => {
  const design = (): Design => {
    const d = createDesign();
    const [F] = d.floors.map((f) => f.id);
    d.floors.push({ id: 'one', name: '1st floor' }, { id: 'two', name: '2nd floor' });
    d.rooms.push(rect('g', F, -4, -4, 4, 4), rect('o', 'one', -4, -4, 4, 4), rect('t', 'two', -4, -4, 4, 4));
    d.stairs.push(stair('A', F, 0, 0)); // hole: x -0.5..0.5, y -2..2; you step off at its top end (y = -2)
    // B starts on the first floor right beside the hole of A, at its bottom end
    d.stairs.push(stair('B', 'one', -1, 2.4, { rotation: 0 }));
    return d;
  };
  const length = (runs: { x: number; y: number }[][]) => runs.reduce((s, r) => s + r.slice(1).reduce((a, p, i) => a + Math.hypot(p.x - r[i].x, p.y - r[i].y), 0), 0);

  it('the guard rail round the lower stairwell leaves out the stretch where the other stair starts', () => {
    const d = design();
    const A = d.stairs[0];
    const avoid = guardAvoid(d, A);
    expect(avoid).toHaveLength(1);
    const full = length(guardRuns(A));
    const open = length(guardRuns(A, avoid));
    expect(open).toBeLessThan(full - 0.5);
    // nothing is left of the rail along the side and the end that B stands beside (in A's own box: x 0..1, y 0..4)
    for (const run of guardRuns(A, avoid)) for (const p of run) {
      expect(p.x < 0.01 && p.y > 2.1).toBe(false);
      expect(p.y > 3.99 && p.x < 0.3).toBe(false);
    }
    // a stair with nothing above, or the one on the top floor, has nothing to leave out
    expect(guardAvoid(d, d.stairs[1])).toEqual([]);
    d.stairs.pop();
    expect(guardAvoid(d, A)).toEqual([]);
    expect(length(guardRuns(A, guardAvoid(d, A)))).toBeCloseTo(full);
  });

  it('in 3D too: the guard rail along that stretch is gone', () => {
    const d = design();
    // the handrails at floor level of the upper floor: their length along the plan
    const handrail = () => sceneChunks(d).find((c) => c.key === 'stair:A')!.make().reduce((sum, p) => (p.t === 'beam' && Math.abs(p.a[1] - p.b[1]) < 1e-6 && p.a[1] > 3.5 ? sum + Math.hypot(p.a[0] - p.b[0], p.a[2] - p.b[2]) : sum), 0);
    const withB = handrail();
    d.stairs.pop();
    const withoutB = handrail();
    expect(withoutB).toBeGreaterThan(5);
    expect(withB).toBeLessThan(withoutB - 0.5);
  });
});
