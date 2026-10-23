import { describe, expect, it } from 'vitest';
import { areaReport, reportToCsv, reportToText, unionArea } from './areas';
import { closestOnSegment, polygonOutlineDistance, segmentDistance } from './distance';
import { createDesign, type Design } from './model';

const rect = (x0: number, y0: number, x1: number, y1: number) => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];

describe('distances', () => {
  it('finds the closest point on a segment', () => {
    expect(closestOnSegment({ x: 2, y: 3 }, { x: 0, y: 0 }, { x: 4, y: 0 })).toEqual({ x: 2, y: 0 });
    expect(closestOnSegment({ x: -3, y: 1 }, { x: 0, y: 0 }, { x: 4, y: 0 })).toEqual({ x: 0, y: 0 });
    expect(closestOnSegment({ x: 1, y: 1 }, { x: 2, y: 2 }, { x: 2, y: 2 })).toEqual({ x: 2, y: 2 });
  });
  it('measures between segments, including crossing and parallel ones', () => {
    expect(segmentDistance({ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 0, y: 3 }, { x: 4, y: 3 }).d).toBe(3);
    expect(segmentDistance({ x: 0, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 }, { x: 4, y: 0 }).d).toBe(0);
    const r = segmentDistance({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 3, y: 4 }, { x: 4, y: 4 });
    expect(r.d).toBeCloseTo(Math.hypot(2, 4), 9);
    expect(r.p).toEqual({ x: 1, y: 0 });
    expect(r.q).toEqual({ x: 3, y: 4 });
  });
  it('measures between polygon outlines', () => {
    const r = polygonOutlineDistance(rect(0, 0, 2, 2), rect(5, 0, 8, 2))!;
    expect(r.d).toBe(3);
    expect(polygonOutlineDistance(rect(0, 0, 4, 4), rect(1, 1, 2, 2))!.d).toBe(1); // one inside the other
  });
});

describe('union area', () => {
  it('does not count overlaps twice', () => {
    expect(unionArea([rect(0, 0, 4, 3)])).toBeCloseTo(12, 0);
    expect(unionArea([rect(0, 0, 4, 3), rect(2, 0, 6, 3)])).toBeCloseTo(18, 0);
    expect(unionArea([rect(0, 0, 4, 3), rect(1, 1, 2, 2)])).toBeCloseTo(12, 0);
    expect(unionArea([])).toBe(0);
  });
});

function property(): Design {
  const d = createDesign();
  const F = d.floors[0].id;
  const wall = (id: string, ax: number, ay: number, bx: number, by: number) => d.walls.push({ id, floor: F, a: { x: ax, y: ay }, b: { x: bx, y: by }, thickness: 0.2, type: 'exterior', height: 2.5 });
  // a 10 x 8 m house (centerlines) on a 20 x 30 m plot, 5 m from the left, top and right edges
  wall('t', 5, 5, 15, 5);
  wall('r', 15, 5, 15, 13);
  wall('b', 15, 13, 5, 13);
  wall('l', 5, 13, 5, 5);
  d.rooms.push({ id: 'living', floor: F, name: 'Living room', color: '#fff', material: 'plain', living: true, points: rect(5.1, 5.1, 14.9, 9) });
  d.rooms.push({ id: 'garage', floor: F, name: 'Garage, double', color: '#fff', material: 'plain', living: false, points: rect(5.1, 9, 14.9, 12.9) });
  d.floors.push({ id: 'up', name: '1st floor' });
  d.rooms.push({ id: 'bed', floor: 'up', name: 'Bedroom', color: '#fff', material: 'plain', living: true, points: rect(5.1, 5.1, 10, 9) });
  d.zones.push({ id: 'plot', floor: F, kind: 'plot', name: '', color: '#fff', points: rect(0, 0, 20, 30) });
  d.zones.push({ id: 'lawn', floor: F, kind: 'lawn', name: '', color: '#cfc', points: rect(0, 14, 20, 24) });
  d.zones.push({ id: 'drive', floor: F, kind: 'driveway', name: '', color: '#ccc', points: rect(5, 13, 15, 18) });
  d.zones.push({ id: 'terrace', floor: F, kind: 'terrace', name: '', color: '#ccc', points: rect(15, 5, 18, 10) });
  return d;
}

describe('area report', () => {
  it('sums rooms per floor (top floor first) and the living area', () => {
    const r = areaReport(property());
    expect(r.floors.map((f) => f.name)).toEqual(['1st floor', 'Ground floor']);
    const ground = r.floors[1];
    expect(ground.rooms.map((x) => [x.name, Math.round(x.area * 100) / 100])).toEqual([['Living room', 38.22], ['Garage, double', 38.22]].map(([n]) => [n, 9.8 * (n === 'Living room' ? 3.9 : 3.9)]));
    expect(ground.total).toBeCloseTo(9.8 * 3.9 * 2, 6);
    expect(ground.living).toBeCloseTo(9.8 * 3.9, 6); // the garage does not count
    expect(r.floors[0].total).toBeCloseTo(4.9 * 3.9, 6);
    expect(r.totalRooms).toBeCloseTo(9.8 * 3.9 * 2 + 4.9 * 3.9, 6);
    expect(r.totalLiving).toBeCloseTo(9.8 * 3.9 + 4.9 * 3.9, 6);
  });

  it('sums outdoor areas by kind without the plot', () => {
    const r = areaReport(property());
    expect(Object.fromEntries(r.outdoor.map((o) => [o.kind, o.area]))).toEqual({ lawn: 200, driveway: 50, terrace: 15 });
    expect(r.outdoor.find((o) => o.kind === 'lawn')!.label).toBe('Lawn');
  });

  it('works out plot coverage and the distance to every boundary', () => {
    const p = areaReport(property()).plot!;
    expect(p.plotArea).toBe(600);
    expect(p.footprint).toBeCloseTo(10.2 * 8.2, 0); // outer size of the walls
    expect(p.coverage).toBeCloseTo((10.2 * 8.2) / 600, 2);
    expect(p.sealed).toBeCloseTo((10.2 * 8.2 + 50 + 15) / 600, 2);
    expect(p.floorAreaRatio).toBeCloseTo((9.8 * 3.9 * 2 + 4.9 * 3.9) / 600, 3);
    expect(p.outside).toBe(false);
    // plot sides in the order drawn: top, right, bottom, left
    expect(p.edges.map((e) => Math.round(e.distance * 100) / 100)).toEqual([4.9, 4.9, 16.9, 4.9]);
    expect(p.edges.map((e) => e.length)).toEqual([20, 30, 20, 30]);
    expect(p.nearest!.distance).toBeCloseTo(4.9, 6);
  });

  it('warns when the building is not inside the plot, and works without a plot or a building', () => {
    const d = property();
    d.zones.find((z) => z.id === 'plot')!.points = rect(0, 0, 10, 10);
    expect(areaReport(d).plot!.outside).toBe(true);
    const empty = createDesign();
    expect(areaReport(empty).plot).toBeNull();
    expect(areaReport(empty).totalRooms).toBe(0);
    empty.zones.push({ id: 'p', floor: empty.floors[0].id, kind: 'plot', name: '', color: '#fff', points: rect(0, 0, 10, 10) });
    const p = areaReport(empty).plot!;
    expect(p.footprint).toBe(0);
    expect(p.nearest).toBeNull();
  });

  it('formats as text and as CSV with proper quoting', () => {
    const r = areaReport(property());
    const text = reportToText(r, 'Our house');
    expect(text).toContain('Our house: areas');
    expect(text).toContain('Garage, double: 38.22 m² (not counted as living area)');
    expect(text).toContain('Living area: 57.33 m²');
    expect(text).toContain('Side 4 (30.00 m long): house is 4.90 m away');
    const csv = reportToCsv(r);
    expect(csv.split('\r\n')[0]).toBe('Floor,Room,Area (m2),Living area');
    expect(csv).toContain('Ground floor,"Garage, double",38.22,no');
    expect(csv).toContain('1st floor,Bedroom,19.11,yes');
  });
});
