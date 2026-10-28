import { describe, expect, it } from 'vitest';
import { createDesign, parseDesign, type Design, type Zone } from './model';
import { groundAt, groundHeightAt, gradientOf, planeAt, retainingWalls, zonePlane, isPlainLevel } from './terrain';

const square = (x0: number, y0: number, x1: number, y1: number) => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
const zone = (id: string, kind: Zone['kind'], pts: Zone['points'], extra: Partial<Zone> = {}): Zone => ({ id, floor: 'f', kind, name: '', color: '#ccc', points: pts, ...extra });
const base = (): Design => {
  const d = createDesign();
  d.floors[0].id = 'f';
  return d;
};

describe('slopes', () => {
  it('ground that falls towards the east is higher in the west', () => {
    const g = gradientOf({ dir: 0, pct: 10 });
    expect(g.gx).toBeCloseTo(-0.1);
    expect(g.gy).toBeCloseTo(0);
    const south = gradientOf({ dir: 90, pct: 20 });
    expect(south.gy).toBeCloseTo(-0.2);
    expect(gradientOf(undefined)).toEqual({ gx: 0, gy: 0 });
  });

  it('a sloping terrain area has a different height at every point of it', () => {
    const d = base();
    d.zones.push(zone('t', 'terrain', square(0, 0, 10, 10), { height: 2, slope: { dir: 0, pct: 10 } }));
    const pl = zonePlane(d, d.zones[0]); // referenced at the middle (5, 5): 2 m there
    expect(planeAt(pl, { x: 5, y: 5 })).toBeCloseTo(2);
    expect(planeAt(pl, { x: 0, y: 5 })).toBeCloseTo(2.5); // 5 m up the hill
    expect(planeAt(pl, { x: 10, y: 5 })).toBeCloseTo(1.5);
    expect(groundHeightAt(d, { x: 0.5, y: 5 })).toBeCloseTo(2.45);
    expect(groundHeightAt(d, { x: 50, y: 5 })).toBe(0); // outside: the open ground of the plot
  });
});

describe('ground areas take the level of the terrain they lie in', () => {
  it('a lawn without a height follows the terrain under it, one with a height keeps its own', () => {
    const d = base();
    d.zones.push(zone('t', 'terrain', square(0, 0, 20, 20), { height: 1.5 }));
    d.zones.push(zone('lawn', 'lawn', square(2, 2, 8, 8)));
    d.zones.push(zone('patio', 'terrace', square(10, 2, 14, 6), { height: 0.4 }));
    expect(zonePlane(d, d.zones[1]).h).toBeCloseTo(1.5);
    expect(groundHeightAt(d, { x: 5, y: 5 })).toBeCloseTo(1.5 + 0.03); // the lawn lies a little above its ground
    expect(groundHeightAt(d, { x: 12, y: 4 })).toBeCloseTo(0.4 + 0.06);
    expect(groundHeightAt(d, { x: 18, y: 18 })).toBeCloseTo(1.5); // bare terrain
    expect(isPlainLevel(d, d.zones[0])).toBe(false);
    expect(isPlainLevel(base(), zone('x', 'lawn', square(0, 0, 3, 3)))).toBe(true);
  });

  it('an area on a sloping terrain slopes the same way', () => {
    const d = base();
    d.zones.push(zone('t', 'terrain', square(0, 0, 20, 10), { height: 0, slope: { dir: 0, pct: 10 } }));
    d.zones.push(zone('lawn', 'lawn', square(0, 0, 4, 4)));
    const pl = zonePlane(d, d.zones[1]);
    expect(pl.gx).toBeCloseTo(-0.1);
    expect(planeAt(pl, { x: 0, y: 2 })).toBeGreaterThan(planeAt(pl, { x: 4, y: 2 }) + 0.3);
  });

  it('water is not ground to stand on, and a light well is sunk by default', () => {
    const d = base();
    d.zones.push(zone('pond', 'water', square(0, 0, 4, 4)));
    d.zones.push(zone('well', 'lightwell', square(6, 0, 8, 1.2)));
    expect(groundAt(d, { x: 2, y: 2 }).zone).toBeNull();
    expect(groundAt(d, { x: 7, y: 0.6 }).h).toBeCloseTo(-1.2);
  });
});

describe('retaining walls', () => {
  it('a raised area is held up along its edges by walls from the open ground up to its level', () => {
    const d = base();
    d.zones.push(zone('t', 'terrain', square(0, 0, 6, 4), { height: 1.2 }));
    const walls = retainingWalls(d, d.zones[0]);
    expect(walls.length).toBeGreaterThanOrEqual(4);
    for (const w of walls) {
      expect(w.lowA).toBeCloseTo(0);
      expect(w.highA).toBeCloseTo(1.2);
    }
    expect(retainingWalls(d, zone('flat', 'lawn', square(10, 10, 12, 12)))).toHaveLength(0); // at level 0 nothing to hold up
  });

  it('a light well has walls from its floor up to the ground around it', () => {
    const d = base();
    d.zones.push(zone('well', 'lightwell', square(0, 0, 3, 1)));
    const walls = retainingWalls(d, d.zones[0]);
    expect(walls.length).toBeGreaterThanOrEqual(4);
    for (const w of walls) {
      expect(w.lowA).toBeCloseTo(-1.2);
      expect(w.highA).toBeCloseTo(0);
    }
  });

  it('where two areas meet, only one wall stands between them (the higher area holds up its own edge)', () => {
    const d = base();
    d.zones.push(zone('low', 'terrain', square(0, 0, 4, 4), { height: 0.5 }));
    d.zones.push(zone('high', 'terrain', square(4, 0, 8, 4), { height: 1.5 }));
    const shared = (z: Zone) => retainingWalls(d, z).filter((w) => Math.abs(w.a.x - 4) < 0.01 && Math.abs(w.b.x - 4) < 0.01);
    expect(shared(d.zones[0])).toHaveLength(0);
    const w = shared(d.zones[1]);
    expect(w.length).toBeGreaterThan(0);
    expect(w[0].lowA).toBeCloseTo(0.5);
    expect(w[0].highA).toBeCloseTo(1.5);
  });
});

describe('saved and loaded', () => {
  it('keeps heights, slopes, room levels and the ground floor level, and repairs junk', () => {
    const d = base();
    d.settings.groundLevel = 1.4;
    d.zones.push(zone('t', 'terrain', square(0, 0, 5, 5), { height: 1.2, slope: { dir: 90, pct: 8 } }), zone('w', 'lightwell', square(6, 0, 8, 2)));
    d.rooms.push({ id: 'r', floor: 'f', name: 'Dais', color: '#eee', material: 'plain', living: true, points: square(0, 0, 3, 3), level: 0.15 });
    const back = parseDesign(JSON.parse(JSON.stringify(d)));
    expect(back.settings.groundLevel).toBe(1.4);
    expect(back.zones[0]).toMatchObject({ kind: 'terrain', height: 1.2, slope: { dir: 90, pct: 8 } });
    expect(back.zones[1].kind).toBe('lightwell');
    expect(back.rooms[0].level).toBeCloseTo(0.15);
    const raw = JSON.parse(JSON.stringify(d));
    raw.settings.groundLevel = 'high';
    raw.zones[0].height = 'tall';
    raw.zones[0].slope = { dir: 'north', pct: 500 };
    raw.rooms[0].level = 99;
    const fixed = parseDesign(raw);
    expect(fixed.settings.groundLevel).toBeUndefined();
    expect(fixed.zones[0].height).toBeUndefined();
    expect(fixed.zones[0].slope?.pct ?? 0).toBeLessThanOrEqual(100);
    expect(fixed.rooms[0].level).toBe(3);
    // an old design loads as before
    expect(parseDesign(JSON.parse(JSON.stringify(base()))).settings.groundLevel).toBeUndefined();
  });
});
