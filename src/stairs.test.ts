import { describe, expect, it } from 'vitest';
import { STAIR_DEFAULTS, checkStair, stairShapes, walkingLength } from './stairs';
import type { StairKind } from './model';

const stair = (kind: StairKind, over: object = {}) => ({ kind, ...STAIR_DEFAULTS[kind], flip: false, rise: 2.8, ...over });

const lines = (kind: StairKind, over: object = {}) => stairShapes(stair(kind, over)).filter((s) => s.t === 'line');
const allPoints = (kind: StairKind, over: object = {}) =>
  stairShapes(stair(kind, over)).flatMap((s) => (s.t === 'ellipse' ? [s.cx - s.rx, s.cy - s.ry, s.cx + s.rx, s.cy + s.ry] : s.pts));

describe('stair drawings', () => {
  it('draws a straight stair with one line between every two steps, and an arrow', () => {
    const shapes = stairShapes(stair('straight'));
    expect(shapes[0]).toMatchObject({ t: 'poly' });
    const treads = shapes.filter((s) => s.t === 'line' && s.pts.length === 4 && s.pts[1] === s.pts[3]);
    expect(treads).toHaveLength(15); // 16 steps -> 15 lines
    expect(shapes.filter((s) => s.t === 'line').length).toBe(15 + 2); // + arrow shaft and head
  });

  it('keeps every drawing inside the stair\'s box, for all kinds, flipped or not', () => {
    for (const kind of ['straight', 'l', 'u', 'spiral'] as const) {
      for (const flip of [false, true]) {
        const { w, d } = STAIR_DEFAULTS[kind];
        const pts = allPoints(kind, { flip });
        for (let i = 0; i < pts.length; i += 2) {
          expect(pts[i], `${kind} x`).toBeGreaterThanOrEqual(-0.2);
          expect(pts[i], `${kind} x`).toBeLessThanOrEqual(w + 0.001);
          expect(pts[i + 1], `${kind} y`).toBeGreaterThanOrEqual(-0.2);
          expect(pts[i + 1], `${kind} y`).toBeLessThanOrEqual(d + 0.001);
        }
      }
    }
  });

  it('mirrors L and U stairs when flipped, and not straight ones', () => {
    const a = stairShapes(stair('l'));
    const b = stairShapes(stair('l', { flip: true }));
    const pa = a[0].t === 'poly' ? a[0].pts : [];
    const pb = b[0].t === 'poly' ? b[0].pts : [];
    expect(pb[0]).toBeCloseTo(2.4 - pa[0], 9);
    expect(pb[1]).toBe(pa[1]);
    expect(stairShapes(stair('straight', { flip: true }))).toEqual(stairShapes(stair('straight')));
  });

  it('spiral has one tread line per step', () => {
    const treads = lines('spiral').filter((s) => s.t === 'line' && s.pts.length === 4);
    expect(treads).toHaveLength(14);
  });

  it('measures the walking line', () => {
    expect(walkingLength(stair('straight'))).toBe(4);
    expect(walkingLength(stair('l'))).toBeCloseTo(2.4 - 0.6 + (2.4 - 0.6), 9);
    expect(walkingLength(stair('u'))).toBeGreaterThan(5);
  });
});

describe('stair comfort check', () => {
  it('accepts a normal stair', () => {
    const c = checkStair(stair('straight', { d: 4.2, steps: 16 })); // 17.5 cm risers, 28 cm treads
    expect(c.riser).toBeCloseTo(0.175, 9);
    expect(c.going).toBeCloseTo(0.28, 9);
    expect(c.blondel).toBeCloseTo(0.63, 9);
    expect(c.ok).toBe(true);
  });
  it('warns about steep, shallow and badly matched stairs', () => {
    expect(checkStair(stair('straight', { steps: 10, d: 3 })).ok).toBe(false); // 28 cm risers
    expect(checkStair(stair('straight', { steps: 26, d: 3 })).message).toMatch(/lower than 14/);
    expect(checkStair(stair('straight', { steps: 16, d: 2.5 })).message).toMatch(/shallower/);
    expect(checkStair(stair('straight', { steps: 16, d: 6 })).ok).toBe(false); // going too long for the riser
  });
});
