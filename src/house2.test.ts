import { describe, expect, it } from 'vitest';
import { CATALOG, CATEGORIES, catalogItem } from './catalog';
import { doorwayPatches } from './doorways';
import { createDesign, parseDesign, WALL_TYPES, WALL_TYPE_HEIGHT, type Design, type Opening, type Room, type Stair, type Wall } from './model';
import { roofModel } from './roofs';
import { applyStoreyHeight, fullWallHeight, slabFor, usualCeiling, wallHeightFor } from './storey';
import { sceneChunks, stairHoles } from './view3d/build';
import { partsBounds, type Part } from './view3d/parts';

const wall = (id: string, ax: number, ay: number, bx: number, by: number, extra: Partial<Wall> = {}): Wall => ({ id, floor: 'f', a: { x: ax, y: ay }, b: { x: bx, y: by }, thickness: 0.2, type: 'interior', height: 2.5, ...extra });
const room = (id: string, x0: number, y0: number, x1: number, y1: number, extra: Partial<Room> = {}): Room => ({ id, floor: 'f', name: id, color: '#eee', material: 'plain', living: true, points: [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }], ...extra });
const door = (id: string, wallId: string, pos: number, kind: Opening['kind'] = 'door', width = 0.9): Opening => ({ id, wallId, kind, pos, width, swing: 1, hinge: 'a' });
const base = (): Design => {
  const d = createDesign();
  d.floors[0].id = 'f';
  return d;
};

describe('storey height', () => {
  it('a full-height wall is the storey minus the floor between storeys', () => {
    expect(fullWallHeight(2.8)).toBeCloseTo(2.5);
    expect(slabFor(2.8)).toBeCloseTo(0.3);
    expect(fullWallHeight(3.2)).toBeCloseTo(2.8);
    expect(usualCeiling(3.2)).toBeCloseTo(2.8);
    expect(wallHeightFor('exterior', 3.2)).toBeCloseTo(2.8);
    expect(wallHeightFor('railing', 3.2)).toBe(1);
  });

  it('changing it brings along the walls that fill a storey and the stairs that climb one, and nothing else', () => {
    const d = base();
    d.walls.push(wall('a', 0, 0, 5, 0), wall('b', 5, 0, 5, 4, { height: 2.0 }), wall('r', 0, 4, 5, 4, { type: 'railing', height: 1.0 }), wall('c', 0, 0, 0, 4, { type: 'exterior', height: 2.5 }));
    d.stairs.push({ id: 's1', floor: 'f', kind: 'straight', x: 1, y: 1, w: 1, d: 4, rotation: 0, steps: 16, rise: 2.8, flip: false } as Stair);
    d.stairs.push({ id: 's2', floor: 'f', kind: 'straight', x: 3, y: 1, w: 1.4, d: 0.9, rotation: 0, steps: 3, rise: 0.45, flip: false } as Stair);
    const change = applyStoreyHeight(d, 3.2);
    expect(d.settings.storeyHeight).toBe(3.2);
    expect(change).toEqual({ walls: 2, stairs: 1 });
    expect(d.walls.map((w) => w.height)).toEqual([2.8, 2.0, 1.0, 2.8]);
    expect(d.stairs.map((s) => s.rise)).toEqual([3.2, 0.45]);
    // and back again
    expect(applyStoreyHeight(d, 2.8)).toEqual({ walls: 2, stairs: 1 });
    expect(d.walls.map((w) => w.height)).toEqual([2.5, 2.0, 1.0, 2.5]);
  });

  it('floors stand one storey apart in 3D', () => {
    const d = base();
    d.floors.push({ id: 'up', name: 'Up' });
    d.settings.storeyHeight = 3.2;
    d.rooms.push(room('u', 0, 0, 3, 3, { floor: 'up' }));
    const chunk = sceneChunks(d).find((c) => c.key === 'room:u')!.make()[0];
    expect(chunk.t === 'prism' && chunk.y1).toBeCloseTo(3.21);
  });
});

describe('the floor goes on through the doorways', () => {
  const two = () => {
    const d = base();
    d.walls.push(wall('mid', 4, 0, 4, 5), wall('s', 8, 5, 0, 5, { type: 'exterior', thickness: 0.3 }));
    d.rooms.push(room('a', 0.1, 0.1, 3.9, 4.85, { material: 'wood' }), room('b', 4.1, 0.1, 7.9, 4.85, { material: 'tile' }));
    return d;
  };

  it('a door between two rooms gets one patch for each room, up to the middle of the wall', () => {
    const d = two();
    d.openings.push(door('d1', 'mid', 2.5));
    const p = doorwayPatches(d);
    expect(p).toHaveLength(2);
    expect(new Set(p.map((x) => x.room.id))).toEqual(new Set(['a', 'b']));
    const xs = (id: string) => p.find((x) => x.room.id === id)!.pts.map((q) => q.x);
    expect(Math.max(...xs('a'))).toBeCloseTo(4.0, 1);
    expect(Math.min(...xs('b'))).toBeCloseTo(4.0, 1);
    expect(Math.min(...xs('a'))).toBeLessThan(3.95); // a hair into the room
  });

  it('an outside door continues the floor of the room inside, a window gets nothing', () => {
    const d = two();
    d.openings.push(door('front', 's', 2, 'double', 1.6), door('w', 's', 5, 'window', 1.2));
    const p = doorwayPatches(d);
    expect(p).toHaveLength(1);
    expect(p[0].openingId).toBe('front');
    expect(p[0].room.material).toBeDefined();
    const ys = p[0].pts.map((q) => q.y);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(0.3); // as thick as the wall
  });

  it('shows in 3D as floor of the room next to it', () => {
    const d = two();
    d.openings.push(door('d1', 'mid', 2.5));
    const chunks = sceneChunks(d).filter((c) => c.key.startsWith('doorway:'));
    expect(chunks).toHaveLength(2);
    const parts = chunks.flatMap((c) => c.make());
    expect(parts.some((q) => q.t === 'prism' && q.tex?.kind === 'wood')).toBe(true);
    expect(parts.some((q) => q.t === 'prism' && q.tex?.kind === 'tile')).toBe(true);
  });
});

describe('stairs and the floor above', () => {
  const u = (x: number): Stair => ({ id: 's', floor: 'f', kind: 'u', x, y: 3.5, w: 2.2, d: 3, rotation: 0, steps: 16, rise: 2.8, flip: false }) as Stair;
  const area = (pts: { x: number; y: number }[]) => Math.abs(pts.reduce((s, p, i) => s + p.x * pts[(i + 1) % pts.length].y - pts[(i + 1) % pts.length].x * p.y, 0)) / 2;

  it('cuts the part of U-shaped stairs that is inside an L-shaped room, not nothing', () => {
    const lroom = [{ x: 0.15, y: 0.15 }, { x: 7.85, y: 0.15 }, { x: 7.85, y: 3.2 }, { x: 3.5, y: 3.2 }, { x: 3.5, y: 6.85 }, { x: 0.15, y: 6.85 }];
    const holes = stairHoles({ points: lroom }, [u(4)]);
    expect(holes.length).toBeGreaterThan(0);
    // the stairs cover x 2.9..5.1, y 2..5: inside the room are the strip above y = 3.2 and the part left of x = 3.5
    const total = holes.reduce((s, h) => s + area(h), 0);
    expect(total).toBeGreaterThan(1.5);
    expect(total).toBeLessThan(2.2 * 3);
    for (const h of holes) for (const p of h) expect(p.y < 3.21 || p.x < 3.51).toBe(true);
  });

  it('still cuts the whole outline when it is inside, and the part that is inside when it reaches over an edge', () => {
    const rect = [{ x: 0.15, y: 0.15 }, { x: 7.85, y: 0.15 }, { x: 7.85, y: 6.85 }, { x: 0.15, y: 6.85 }];
    expect(stairHoles({ points: rect }, [u(4)])).toHaveLength(1);
    const over = stairHoles({ points: rect }, [u(7.2)]);
    expect(over).toHaveLength(1);
    for (const p of over[0]) expect(p.x).toBeLessThanOrEqual(7.851);
    expect(stairHoles({ points: rect }, [u(30)])).toHaveLength(0);
  });
});

describe('double doors', () => {
  it('the two leaves meet in the middle', () => {
    const d = base();
    d.walls.push(wall('w', 0, 0, 6, 0, { height: 2.6 }));
    d.openings.push(door('dd', 'w', 3, 'double', 1.6));
    const parts = sceneChunks(d).find((c) => c.key === 'wall:w')!.make();
    const leaves = parts.filter((p): p is Extract<Part, { t: 'box' }> => p.t === 'box' && !!p.anim && p.sy > 1.5);
    expect(leaves).toHaveLength(2);
    const [a, b] = leaves.sort((p, q) => p.x - q.x);
    expect(b.x - b.sx / 2 - (a.x + a.sx / 2)).toBeLessThan(0.012);
  });
});

describe('wooden slats, glass walls and the winter garden', () => {
  it('the new wall types are known, parsed and have heights', () => {
    expect(WALL_TYPES).toContain('slats');
    expect(WALL_TYPES).toContain('glass');
    expect(WALL_TYPE_HEIGHT.slats).toBe(2.5);
    const d = base();
    d.walls.push(wall('a', 0, 0, 4, 0, { type: 'slats', thickness: 0.06 }), wall('b', 4, 0, 4, 3, { type: 'glass', thickness: 0.1 }));
    const back = parseDesign(JSON.parse(JSON.stringify(d)));
    expect(back.walls.map((w) => w.type)).toEqual(['slats', 'glass']);
  });

  it('a slat wall is many upright boards with gaps, a glass wall is panes in a frame', () => {
    const d = base();
    d.walls.push(wall('a', 0, 0, 4, 0, { type: 'slats', thickness: 0.06 }), wall('b', 0, 3, 4, 3, { type: 'glass', thickness: 0.1 }));
    const slats = sceneChunks(d).find((c) => c.key === 'wall:a')!.make();
    expect(slats.length).toBeGreaterThan(40);
    const boards = slats.filter((p) => p.t === 'box' && p.sx < 0.05 && p.sy > 2);
    expect(boards.length).toBeGreaterThan(40);
    // there is air between the boards: their widths add up to well under the length of the wall
    expect(boards.reduce((s, p) => s + (p.t === 'box' ? p.sx : 0), 0)).toBeLessThan(4 * 0.75);
    const glass = sceneChunks(d).find((c) => c.key === 'wall:b')!.make();
    expect(glass.filter((p) => p.glass).length).toBeGreaterThanOrEqual(3);
    expect(partsBounds(glass).maxY).toBeCloseTo(2.5);
  });

  it('a glass roof is made of glass panels with glazing bars, and glass walls cast no shadow', () => {
    const d = base();
    d.roofs.push({ id: 'r', floor: 'f', kind: 'gable', x: 3, y: 2, w: 6, d: 4, rotation: 0, pitch: 25, overhang: 0.2, thickness: 0.05, material: 'glass', color: '#bfe3f5', chimney: false, parapet: false });
    const parts = sceneChunks(d).find((c) => c.key === 'roof:r')!.make();
    expect(parts.filter((p) => p.t === 'panel' && p.glass).length).toBe(2);
    expect(parts.filter((p) => p.t === 'beam').length).toBeGreaterThan(8);
    expect(roofModel({ kind: 'gable', w: 6, d: 4, pitch: 25, overhang: 0.2, chimney: false, parapet: false }).faces.length).toBeGreaterThan(0);
    expect(parseDesign(JSON.parse(JSON.stringify(d))).roofs[0].material).toBe('glass');
  });
});

describe('the Korean and winter garden furniture', () => {
  it('has its own categories and the pieces that were asked for', () => {
    expect(CATEGORIES).toContain('Korean');
    expect(CATEGORIES).toContain('Winter garden');
    const have = new Set(CATALOG.map((c) => c.type));
    for (const t of ['kr-soban', 'kr-floor-cushion', 'kr-yo', 'kr-chest', 'kr-screen', 'kr-hanji-door', 'kr-kimchi-fridge', 'kr-onggi', 'kr-rice-cooker', 'kr-ondol', 'wg-rattan-sofa', 'wg-palm', 'wg-planter', 'wg-fountain', 'wg-bistro-set']) expect(have.has(t), t).toBe(true);
    expect(CATALOG.filter((c) => c.category === 'Korean').length).toBeGreaterThanOrEqual(15);
    expect(CATALOG.filter((c) => c.category === 'Winter garden').length).toBeGreaterThanOrEqual(10);
    expect(catalogItem('kr-ondol').layer).toBe('tech');
    expect(catalogItem('kr-lantern').lamp).toBeTruthy();
  });
});
