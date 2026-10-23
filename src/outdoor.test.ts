import { describe, expect, it } from 'vitest';
import { polylineLength, samplePolyline } from './outdoor';

describe('outdoor helpers', () => {
  const l = [
    { x: 0, y: 0 },
    { x: 3, y: 0 },
    { x: 3, y: 4 },
  ];
  it('measures a polyline', () => {
    expect(polylineLength(l)).toBe(7);
    expect(polylineLength([])).toBe(0);
  });
  it('samples evenly along each segment and keeps the corners and ends', () => {
    const pts = samplePolyline(l, 1);
    expect(pts[0]).toEqual({ x: 0, y: 0 });
    expect(pts[pts.length - 1]).toEqual({ x: 3, y: 4 });
    expect(pts).toContainEqual({ x: 3, y: 0 });
    expect(pts).toHaveLength(8); // 3 + 4 segments of 1 m, plus the start
    expect(samplePolyline([{ x: 0, y: 0 }, { x: 0.2, y: 0 }], 1)).toHaveLength(2); // short segment: just both ends
    expect(samplePolyline([], 1)).toEqual([]);
  });
});
