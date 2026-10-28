import { describe, expect, it } from 'vitest';
import { entranceSteps, snapEntrance } from './entrance';
import { createDesign, type Design, type Furniture, type Opening, type Room, type Stair, type Wall, type Zone } from './model';
import { buildWalkWorld } from './walk';
import { floorElevations, sceneChunks } from './view3d/build';
import { partsBounds, type Part } from './view3d/parts';
import { furnitureBase, stairBase } from './terrain';

const square = (x0: number, y0: number, x1: number, y1: number) => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
const zone = (id: string, kind: Zone['kind'], pts: Zone['points'], extra: Partial<Zone> = {}, floor = 'g'): Zone => ({ id, floor, kind, name: '', color: '#ccc', points: pts, ...extra });
const wall = (id: string, floor: string, ax: number, ay: number, bx: number, by: number, extra: Partial<Wall> = {}): Wall => ({ id, floor, a: { x: ax, y: ay }, b: { x: bx, y: by }, thickness: 0.3, type: 'exterior', height: 2.5, ...extra });
const room = (id: string, floor: string, pts: Zone['points'], extra: Partial<Room> = {}): Room => ({ id, floor, name: id, color: '#eee', material: 'plain', living: true, points: pts, ...extra });

/** A house with a semi-basement: a basement floor and a ground floor lying 1.4 m above the ground outside. */
function house(): Design {
  const d = createDesign();
  d.floors = [{ id: 'b', name: 'Basement' }, { id: 'g', name: 'Ground floor' }];
  d.settings.groundLevel = 1.4;
  for (const f of ['b', 'g']) {
    d.walls.push(wall(`${f}n`, f, 4, 2, 12, 2), wall(`${f}e`, f, 12, 2, 12, 8), wall(`${f}s`, f, 12, 8, 4, 8), wall(`${f}w`, f, 4, 8, 4, 2));
    d.rooms.push(room(`r${f}`, f, square(4.15, 2.15, 11.85, 7.85)));
  }
  return d;
}
const chunk = (d: Design, key: string): Part[] => sceneChunks(d).find((c) => c.key === key)!.make();

describe('a raised ground floor', () => {
  it('lifts every floor by the ground level, the basement being half sunk', () => {
    const d = house();
    const e = floorElevations(d);
    expect(e.get('g')).toBeCloseTo(1.4);
    expect(e.get('b')).toBeCloseTo(1.4 - 2.8);
    const plain = createDesign();
    expect(floorElevations(plain).get(plain.floors[0].id)).toBe(0);
  });

  it('basement walls climb to the floor above (a semi-basement shows above the ground), and the ground floor walls stand on them', () => {
    const d = house();
    const basement = partsBounds(chunk(d, 'wall:bn'));
    expect(basement.minY).toBeCloseTo(-1.4);
    expect(basement.maxY).toBeCloseTo(-1.4 + 2.5);
    const upper = partsBounds(chunk(d, 'wall:gn'));
    expect(upper.minY).toBeLessThanOrEqual(basement.maxY + 0.01);
    expect(upper.maxY).toBeCloseTo(1.4 + 2.5);
  });

  it('a raised lowest floor with nothing below stands on a plinth down to the ground', () => {
    const d = house();
    d.floors = [d.floors[1]];
    d.walls = d.walls.filter((w) => w.floor === 'g');
    d.rooms = d.rooms.filter((r) => r.floor === 'g');
    expect(partsBounds(chunk(d, 'wall:gn')).minY).toBeLessThan(0);
    const roomParts = chunk(d, 'room:rg');
    expect(roomParts.length).toBe(2); // the floor and its plinth
    expect(Math.min(...roomParts.map((p) => (p.t === 'prism' ? p.y0 : 9)))).toBeLessThan(0);
  });
});

describe('terrain in 3D', () => {
  it('a raised area is a sloping top with retaining walls round it, and nothing special when it is at level 0', () => {
    const d = createDesign();
    d.floors[0].id = 'g';
    d.zones.push(zone('t', 'terrain', square(0, 0, 8, 6), { height: 1.2 }));
    const parts = chunk(d, 'zone:t');
    expect(parts.filter((p) => p.t === 'panel').length).toBeGreaterThanOrEqual(5); // the top and the walls
    expect(partsBounds(parts).maxY).toBeGreaterThan(1.2);
    expect(partsBounds(parts).minY).toBeGreaterThanOrEqual(-0.2); // the walls stand on the ground (bounds count a panel's thickness downwards)
    const flat = createDesign();
    flat.floors[0].id = 'g';
    flat.zones.push(zone('l', 'lawn', square(0, 0, 4, 4)));
    expect(chunk(flat, 'zone:l').some((p) => p.t === 'prism')).toBe(true);
  });

  it('a lawn on a sloping terrain follows its slope: higher at the high end', () => {
    const d = createDesign();
    d.floors[0].id = 'g';
    d.zones.push(zone('t', 'terrain', square(0, 0, 20, 10), { height: 0, slope: { dir: 0, pct: 10 } }), zone('lawn', 'lawn', square(0, 0, 10, 4)));
    const top = chunk(d, 'zone:lawn').find((p) => p.t === 'panel' && p.facing[1] === 1) as Extract<Part, { t: 'panel' }>;
    const west = Math.max(...top.pts.filter((q) => q[0] < 1).map((q) => q[1]));
    const east = Math.max(...top.pts.filter((q) => q[0] > 9).map((q) => q[1]));
    expect(west - east).toBeGreaterThan(0.8); // 10 m at 10 percent
  });

  it('a light well cuts the ground and the terrain over it open, with walls that go down to its floor', () => {
    const d = house();
    d.zones.push(zone('t', 'terrain', square(-5, -5, 20, 15), { height: 0.3 }, 'g'));
    d.zones.push(zone('well', 'lightwell', square(5, 8.2, 9, 9.4), {}, 'b'));
    const terrain = chunk(d, 'zone:t').find((p) => p.t === 'panel' && p.facing[1] === 1) as Extract<Part, { t: 'panel' }>;
    expect(terrain.holes).toHaveLength(1);
    const well = chunk(d, 'zone:well');
    expect(partsBounds(well).minY).toBeLessThan(-1.15);
    expect(partsBounds(well).minY).toBeGreaterThan(-1.5);
    expect(well.filter((p) => p.t === 'panel').length).toBeGreaterThanOrEqual(5);
    // the ground slab has a hole there too
    const ground = chunk(d, 'ground')[0];
    expect(ground.t === 'prism' && ground.holes!.length).toBeGreaterThanOrEqual(2); // the cellar and the well
  });
});

describe('what stands on the terrain, on a dais or under the steps', () => {
  it('outdoor furniture stands on the ground there, indoor furniture on the floor of its room, on a dais higher', () => {
    const d = house();
    d.zones.push(zone('t', 'terrain', square(-5, -5, 20, 15), { height: 0.5 }, 'g'));
    d.rooms.find((r) => r.id === 'rg')!.level = 0.15;
    const tree: Furniture = { id: 't1', floor: 'g', type: 'tree', x: 16, y: 5, w: 3, d: 3, rotation: 0, color: '#4f9d5d', label: '' };
    const sofa: Furniture = { id: 's1', floor: 'g', type: 'sofa', x: 8, y: 5, w: 2, d: 0.9, rotation: 0, color: '#b7c9a8', label: '' };
    d.furniture.push(tree, sofa);
    const e = floorElevations(d).get('g')!;
    expect(furnitureBase(d, tree, e)).toBeCloseTo(0.5);
    expect(furnitureBase(d, sofa, e)).toBeCloseTo(1.4 + 0.15);
    expect(partsBounds(chunk(d, 'fur:s1')).minY).toBeGreaterThanOrEqual(1.55 - 0.001);
  });

  it('a dais is a block above the floor of the storey, a sunken part lower', () => {
    const d = createDesign();
    d.floors[0].id = 'g';
    d.rooms.push(room('a', 'g', square(0, 0, 3, 3), { level: 0.2 }), room('b', 'g', square(3, 0, 6, 3), { level: -0.25 }));
    const up = chunk(d, 'room:a')[0] as Extract<Part, { t: 'prism' }>;
    const down = chunk(d, 'room:b')[0] as Extract<Part, { t: 'prism' }>;
    expect(up.y1).toBeCloseTo(0.21);
    expect(down.y1).toBeCloseTo(-0.24);
    expect(down.y0).toBeLessThan(-0.3);
  });

  it('steps outside start on the ground, steps inside the house on the floor', () => {
    const d = house();
    d.zones.push(zone('t', 'terrain', square(-5, -5, 20, 15), { height: 0.2 }, 'g'));
    const e = floorElevations(d).get('g')!;
    expect(stairBase(d, { floor: 'g', x: 8, y: 9.3 }, e)).toBeCloseTo(0.2);
    expect(stairBase(d, { floor: 'g', x: 8, y: 5 }, e)).toBeCloseTo(1.4);
  });
});

describe('walking on the land', () => {
  it('you stand on the terrain, on a dais and at the bottom of a light well, and climb the entrance steps to the door', () => {
    const d = house();
    d.zones.push(zone('t', 'terrain', square(-5, -5, 20, 15), { height: 0.3 }, 'g'), zone('well', 'lightwell', square(5, 8.2, 9, 9.4), {}, 'b'));
    d.rooms.find((r) => r.id === 'rg')!.level = 0.15;
    const steps: Stair = { id: 'st', floor: 'g', kind: 'straight', x: 11, y: 9.3, w: 1.4, d: 2.2, rotation: 0, steps: 7, rise: 1.1, flip: false };
    d.stairs.push(steps);
    const w = buildWalkWorld(d, new Set(), floorElevations(d));
    expect(w.heightAt(16, 5, 0.3)).toBeCloseTo(0.3); // the plot
    expect(w.heightAt(7, 8.8, 0.3)).toBeLessThan(-1); // the bottom of the well
    expect(w.heightAt(8, 5, 1.4)).toBeCloseTo(1.4 + 0.01 + 0.15); // inside, on the dais
    // the foot of the steps is on the terrain, the top at the floor of the house
    expect(w.heightAt(11, 10.3, 0.3)).toBeGreaterThan(0.3);
    expect(w.heightAt(11, 8.3, 1.2)).toBeGreaterThan(1.3);
  });

  it('a tree outside stops you on the ground even when the ground floor is raised', () => {
    const d = house();
    d.furniture.push({ id: 't1', floor: 'g', type: 'tree', x: 16, y: 5, w: 3, d: 3, rotation: 0, color: '#4f9d5d', label: '' });
    const w = buildWalkWorld(d, new Set(), floorElevations(d));
    const r = w.move(14, 5, 0, 2, 0);
    expect(r.x).toBeLessThan(15.6);
  });
});

describe('entrance steps', () => {
  const door = (): Opening => ({ id: 'door', wallId: 'gs', kind: 'main', pos: 4, width: 1, swing: 1, hinge: 'a' });

  it('have as many steps as the height needs, one low step at least', () => {
    const d = house();
    const s = entranceSteps(d, { x: 8, y: 9.5 }, 'g');
    expect(s.rise).toBeCloseTo(1.4);
    expect(s.steps).toBe(8);
    expect(s.d).toBeCloseTo(2.4);
    const flat = createDesign();
    expect(entranceSteps(flat, { x: 0, y: 0 }, flat.floors[0].id).rise).toBeCloseTo(0.15);
  });

  it('snap to the nearest door: centered on it, climbing into it, the top end against the outside of the wall', () => {
    const d = house();
    d.openings.push(door());
    const snap = snapEntrance(d, { x: 8.3, y: 9.6 }, 'g', { d: 2.4 })!;
    // the south wall runs from (12, 8) to (4, 8): the door at 4 m from its start is at x = 8
    expect(snap.x).toBeCloseTo(8, 1);
    expect(snap.y).toBeCloseTo(8 + 0.15 + 1.2, 1);
    expect(snap.rotation).toBe(0); // the high end points north, into the wall
    expect(snapEntrance(d, { x: 30, y: 30 }, 'g', { d: 2.4 })).toBeNull();
  });
});
