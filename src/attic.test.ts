import { describe, expect, it } from 'vitest';
import { createDesign, type Design, type Roof, type Wall } from './model';
import { atticClearance, atticFloorPieces, roofModel } from './roofs';
import { floorElevations, sceneChunks } from './view3d/build';

const wall = (id: string, floor: string, ax: number, ay: number, bx: number, by: number): Wall => ({ id, floor, a: { x: ax, y: ay }, b: { x: bx, y: by }, thickness: 0.2, type: 'interior', height: 2.5 });

/** A ground floor with a gable roof (ridge along x) and an attic above it with four walls round its floor. */
function atticHouse(): Design {
  const d = createDesign();
  const F = d.floors[0].id;
  d.floors.push({ id: 'att', name: 'Attic', attic: true });
  d.roofs.push({ id: 'rf', floor: F, kind: 'gable', x: 6, y: 4.5, w: 8.3, d: 5.3, rotation: 0, pitch: 35, overhang: 0.4, thickness: 0.15, material: 'tiles', color: '#b5523b', chimney: false, parapet: false } as Roof);
  const pts = [{ x: 2.15, y: 2.15 }, { x: 9.85, y: 2.15 }, { x: 9.85, y: 6.85 }, { x: 2.15, y: 6.85 }];
  d.rooms.push({ id: 'ar', floor: 'att', name: 'Attic', color: '#e8dcc8', material: 'wood', living: true, points: pts });
  pts.forEach((p, i) => d.walls.push(wall(`aw${i}`, 'att', p.x, p.y, pts[(i + 1) % 4].x, pts[(i + 1) % 4].y)));
  return d;
}

describe('an attic stays under its roof in 3D', () => {
  it('the walls of an attic are cut to the underside of the roof, everywhere along them', () => {
    const d = atticHouse();
    const e = floorElevations(d).get('att')!;
    for (const w of d.walls.filter((x) => x.floor === 'att')) {
      const parts = sceneChunks(d).find((c) => c.key === `wall:${w.id}`)!.make();
      const tops = parts.filter((p) => p.t === 'prism').map((p) => (p.t === 'prism' ? p.y1 : 0));
      // never taller than the wall, and lower than the roof allows (the roof is lower than 2.5 m over the whole of the long walls)
      expect(Math.max(...tops, 0) - e).toBeLessThanOrEqual(w.height + 1e-9);
    }
    // the end walls (under the gable) follow the slope: tall in the middle, short at the sides
    const end = sceneChunks(d).find((c) => c.key === 'wall:aw1')!.make().filter((p) => p.t === 'prism');
    const heights = end.map((p) => (p.t === 'prism' ? p.y1 - e : 0));
    expect(Math.max(...heights)).toBeGreaterThan(Math.min(...heights) + 0.5);
    // and every piece is under the roof at its own place
    const wp = d.walls.find((w) => w.id === 'aw1')!;
    for (const p of end) {
      if (p.t !== 'prism') continue;
      const mid = p.pts.reduce((s, q) => ({ x: s.x + q.x / p.pts.length, y: s.y + q.y / p.pts.length }), { x: 0, y: 0 });
      const room = atticClearance(d, 'att', mid) ?? wp.height;
      expect(p.y1 - e).toBeLessThanOrEqual(room + 0.06);
    }
  });

  it('a wall in the low part under the eaves has nothing to show, and a wall outside any attic is whole', () => {
    const d = atticHouse();
    const e = floorElevations(d).get('att')!;
    // the long wall at y = 2.15 is where the roof still comes down to the floor
    expect(sceneChunks(d).find((c) => c.key === 'wall:aw0')!.make().filter((p) => p.t === 'prism' && p.y1 - e > 0.1)).toHaveLength(0);
    d.floors[1].attic = false; // an ordinary floor
    const whole = sceneChunks(d).find((c) => c.key === 'wall:aw0')!.make().filter((p) => p.t === 'prism');
    expect(Math.max(...whole.map((p) => (p.t === 'prism' ? p.y1 : 0)))).toBeCloseTo(e + 2.5);
  });

  it('the floor is cut back where the roof comes down below it, and whole without a roof', () => {
    const d = atticHouse();
    const room = d.rooms[0];
    const pieces = atticFloorPieces(d, room);
    expect(pieces.length).toBeGreaterThan(0);
    const area = (pts: { x: number; y: number }[]) => Math.abs(pts.reduce((s, p, i) => s + p.x * pts[(i + 1) % pts.length].y - pts[(i + 1) % pts.length].x * p.y, 0)) / 2;
    const total = pieces.reduce((s, p) => s + area(p), 0);
    expect(total).toBeLessThan(area(room.points) - 0.5);
    // everything that is left has headroom above the floor
    for (const piece of pieces) for (const p of piece) expect(atticClearance(d, 'att', p) ?? 1).toBeGreaterThanOrEqual(0);
    for (const piece of pieces) {
      const c = piece.reduce((s, p) => ({ x: s.x + p.x / piece.length, y: s.y + p.y / piece.length }), { x: 0, y: 0 });
      expect(atticClearance(d, 'att', c)!).toBeGreaterThan(0);
    }
    // the floor in 3D is those pieces: none of its slabs reaches the roof
    expect(sceneChunks(d).find((c) => c.key === 'room:ar')!.make()).toHaveLength(pieces.length);
    d.roofs = [];
    expect(atticFloorPieces(d, room)).toEqual([room.points]);
    // not an attic: untouched
    expect(atticFloorPieces(atticHouse(), { floor: atticHouse().floors[0].id, points: room.points })).toEqual([room.points]);
  });

  it('an attic has no ceiling slab of its own (the roof is the ceiling)', () => {
    const d = atticHouse();
    expect(sceneChunks(d, { showCeilings: true }).some((c) => c.key === 'ceil:ar')).toBe(false);
  });
});

describe('a flat roof rests on the walls', () => {
  const base = { kind: 'flat' as const, w: 8, d: 5, pitch: 3, overhang: 0.4, chimney: false, parapet: false };
  it('its top is one thickness above the wall tops, with the edge wall on it', () => {
    const m = roofModel({ ...base, thickness: 0.25 });
    expect(new Set(m.faces.flatMap((f) => f.pts.map((p) => p[1])))).toEqual(new Set([0.25]));
    expect(m.height).toBeCloseTo(0.25);
    const edged = roofModel({ ...base, thickness: 0.25, parapet: true });
    expect(edged.height).toBeCloseTo(0.65);
    expect(edged.blocks.every((b) => Math.abs(b.y0 - 0.25) < 1e-9)).toBe(true);
  });
});
