import { describe, expect, it } from 'vitest';
import { formatLength, niceLength, snapPoint } from './geometry';

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
