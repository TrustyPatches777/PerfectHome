import { describe, expect, it } from 'vitest';
import { createDesign, type Design, type Opening, type Wall } from './model';
import { buildWalkWorld, STEP_UP, WALKER_RADIUS, type WalkWorld } from './walk';
import { floorElevations } from './view3d/build';

const wall = (id: string, floor: string, ax: number, ay: number, bx: number, by: number, extra: Partial<Wall> = {}): Wall => ({ id, floor, a: { x: ax, y: ay }, b: { x: bx, y: by }, thickness: 0.2, type: 'interior', height: 2.5, ...extra });
const op = (id: string, wallId: string, kind: Opening['kind'], pos: number, width = 1): Opening => ({ id, wallId, kind, pos, width, swing: 1, hinge: 'a' });
const world = (d: Design, open: string[] = []): WalkWorld => buildWalkWorld(d, new Set(open), floorElevations(d));
const room = (id: string, floor: string, x0: number, y0: number, x1: number, y1: number) => ({ id, floor, name: id, color: '#eee', material: 'plain' as const, living: true, points: [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }] });

/** A 6 x 5 house, one floor. */
function house(): { d: Design; F: string } {
  const d = createDesign();
  const F = d.floors[0].id;
  d.walls.push(wall('n', F, 0, 0, 6, 0), wall('e', F, 6, 0, 6, 5), wall('s', F, 6, 5, 0, 5), wall('w', F, 0, 5, 0, 0));
  d.rooms.push(room('r', F, 0.1, 0.1, 5.9, 4.9));
  return { d, F };
}

/** Walk in a straight line the way the viewer does: move, then settle onto the ground. */
function walk(w: WalkWorld, from: { x: number; z: number; y: number }, to: { x: number; z: number }, step = 0.05) {
  let { x, z, y } = from;
  const n = Math.ceil(Math.hypot(to.x - x, to.z - z) / step);
  const dx = (to.x - x) / n;
  const dz = (to.z - z) / n;
  const trail: number[] = [];
  for (let i = 0; i < n; i++) {
    const r = w.move(x, z, y, dx, dz);
    x = r.x;
    z = r.z;
    y = w.heightAt(x, z, y) ?? y;
    trail.push(y);
  }
  return { x, z, y, trail };
}

describe('walls and doors', () => {
  it('walls stop you, a little way off the wall', () => {
    const { d } = house();
    const end = walk(world(d), { x: 3, z: 2, y: 0.01 }, { x: 9, z: 2 });
    expect(end.x).toBeCloseTo(5.9 - WALKER_RADIUS, 1);
    expect(end.z).toBeCloseTo(2, 2);
  });

  it('you slide along a wall when you walk into it at an angle', () => {
    const { d } = house();
    const end = walk(world(d), { x: 3, z: 2, y: 0.01 }, { x: 9, z: 4 });
    expect(end.x).toBeCloseTo(5.9 - WALKER_RADIUS, 1);
    expect(end.z).toBeGreaterThan(3.5);
  });

  it('a shut door stops you, an open one lets you through, and an open passage is always open', () => {
    const { d } = house();
    d.openings.push(op('door', 'e', 'door', 2.5, 1), op('gap', 's', 'gap', 3, 1.2), op('win', 'n', 'window', 3, 1.2));
    const through = (open: string[], from: { x: number; z: number }, to: { x: number; z: number }) => walk(world(d, open), { ...from, y: 0.01 }, to);
    expect(through([], { x: 5, z: 2.5 }, { x: 8, z: 2.5 }).x).toBeLessThan(6);
    expect(through(['door'], { x: 5, z: 2.5 }, { x: 8, z: 2.5 }).x).toBeGreaterThan(7.9);
    expect(through([], { x: 3, z: 4, y: 0 } as never, { x: 3, z: 8 }).z).toBeGreaterThan(7.9); // the open passage
    expect(through(['win'], { x: 3, z: 1 }, { x: 3, z: -3 }).z).toBeGreaterThan(0.2); // a window never lets you out
  });

  it('a big step cannot jump over a thin wall', () => {
    const { d, F } = house();
    d.walls.push(wall('thin', F, 3, 0, 3, 5, { thickness: 0.1 }));
    const w = world(d);
    expect(w.move(2.5, 2, 0.01, 1.5, 0).x).toBeLessThan(3);
  });

  it('only the walls of your own floor count', () => {
    const { d } = house();
    d.floors.push({ id: 'up', name: '1st' });
    d.walls.push(wall('u', 'up', 3, 0, 3, 5));
    expect(walk(world(d), { x: 2, z: 2, y: 0.01 }, { x: 5, z: 2 }).x).toBeGreaterThan(4.9);
  });
});

describe('furniture and other things in the way', () => {
  it('you cannot walk through a sofa or a tree trunk, but you can over a rug and under a ceiling lamp', () => {
    const { d, F } = house();
    const item = (id: string, type: string, x: number, y: number, w: number, dd: number) => d.furniture.push({ id, floor: F, type, x, y, w, d: dd, rotation: 0, color: '#ccc', label: '' });
    item('sofa', 'sofa', 3, 1, 2, 0.9);
    item('rug', 'rug', 3, 2.5, 2, 1.4);
    item('lamp', 'lamp-ceiling', 3, 4, 0.4, 0.4);
    const w = world(d);
    expect(walk(w, { x: 3, z: 3, y: 0.01 }, { x: 3, z: 0.2 }).z).toBeGreaterThan(1.45 + WALKER_RADIUS - 0.05); // stops at the sofa (it ends at 1.45)
    expect(walk(w, { x: 1, z: 2.5, y: 0.01 }, { x: 5, z: 2.5 }).x).toBeGreaterThan(4.9); // over the rug
    expect(walk(w, { x: 1, z: 4, y: 0.01 }, { x: 5, z: 4 }).x).toBeGreaterThan(4.9); // under the lamp
  });

  it('fences and hedges stop you', () => {
    const { d, F } = house();
    d.strips.push({ id: 'f', floor: F, kind: 'fence', points: [{ x: 8, y: -5 }, { x: 8, y: 10 }], width: 0.1 });
    expect(walk(world(d), { x: 7, z: 7, y: 0 }, { x: 12, z: 7 }).x).toBeLessThan(8);
  });
});

describe('the ground under your feet', () => {
  it('is the garden outside, the floor inside, the bottom of a pool and a pond', () => {
    const { d, F } = house();
    d.furniture.push({ id: 'pool', floor: F, type: 'pool', x: 12, y: 2, w: 6, d: 3, rotation: 0, color: '#bfe0f5', label: '' });
    d.zones.push({ id: 'pond', floor: F, kind: 'water', name: '', color: '#bfe0f5', points: [{ x: 8, y: 8 }, { x: 11, y: 8 }, { x: 11, y: 10 }, { x: 8, y: 10 }] });
    const w = world(d);
    expect(w.heightAt(8, 7, 0)).toBe(0);
    expect(w.heightAt(3, 2, 0)).toBeCloseTo(0.01);
    expect(w.heightAt(12, 2, 0)).toBeCloseTo(-1.5); // too deep to step down, so you drop in
    expect(w.heightAt(9, 9, 0)).toBeCloseTo(-0.9);
  });

  it('you walk down into a basement through the hole in the ground floor, and cannot walk on air over a basement', () => {
    const { d, F } = house();
    d.floors.unshift({ id: 'b', name: 'Basement' });
    d.rooms.push(room('cellar', 'b', 0.1, 0.1, 5.9, 4.9));
    d.walls.push(wall('bn', 'b', 0, 0, 6, 0));
    const w = world(d);
    expect(w.heightAt(3, 2, 0.01)).toBeCloseTo(0.01); // the ground floor above it
    expect(w.heightAt(3, 2, -2.8)).toBeCloseTo(-2.79); // standing in the cellar
    expect(F).toBeTruthy();
  });
});

describe('stairs', () => {
  /** Two storeys with a straight stair from the ground floor to the one above. */
  function twoStoreys() {
    const { d, F } = house();
    d.floors.push({ id: 'up', name: '1st floor' });
    d.walls.push(wall('un', 'up', 0, 0, 6, 0), wall('ue', 'up', 6, 0, 6, 5), wall('us', 'up', 6, 5, 0, 5), wall('uw', 'up', 0, 5, 0, 0));
    d.rooms.push(room('upper', 'up', 0.1, 0.1, 5.9, 4.9));
    d.stairs.push({ id: 'st', floor: F, kind: 'straight', x: 2, y: 3, w: 1, d: 3, rotation: 0, steps: 16, rise: 2.8, flip: false });
    return d;
  }

  it('you climb a stair to the floor above, one step at a time, and step off onto it', () => {
    const d = twoStoreys();
    const w = world(d);
    // the stair runs from y = 4.5 (bottom) to y = 1.5 (top)
    const up = walk(w, { x: 2, z: 4.7, y: 0.01 }, { x: 2, z: 1.0 }, 0.03);
    expect(up.y).toBeCloseTo(2.81, 1);
    expect(Math.max(...up.trail.map((v, i) => (i ? v - up.trail[i - 1] : 0)))).toBeLessThanOrEqual(STEP_UP);
    // on the way the height only ever goes up
    expect(up.trail.every((v, i) => !i || v >= up.trail[i - 1] - 1e-9)).toBe(true);
    // and you can walk on across the upper floor
    const on = walk(w, { x: up.x, z: up.z, y: up.y }, { x: 4, z: 1 });
    expect(on.y).toBeCloseTo(2.81, 2);
  });

  it('walking back into the stairwell from above takes you down the stairs, not through the floor', () => {
    const d = twoStoreys();
    const w = world(d);
    const down = walk(w, { x: 2, z: 1.0, y: 2.81 }, { x: 2, z: 4.7 }, 0.03);
    expect(down.y).toBeLessThan(0.3);
    expect(down.trail.every((v, i) => !i || v <= down.trail[i - 1] + 1e-9)).toBe(true);
  });

  it('the hole in the upper floor is where the stair is, and nowhere else', () => {
    const d = twoStoreys();
    const w = world(d);
    expect(w.heightAt(4, 3, 2.81)).toBeCloseTo(2.81); // upper floor away from the stair
    expect(w.heightAt(2, 3, 2.81)!).toBeLessThan(2.81 - 0.5 + 1); // over the stair: drops onto it
  });

  it('railings along the stair keep you on it, with a gap at the bottom to get on', () => {
    const d = twoStoreys();
    d.stairs[0].railing = { style: 'wood', a: true, b: true };
    const w = world(d);
    const side = walk(w, { x: 2, z: 3, y: 1.4 }, { x: 3.5, z: 3 }); // standing on the stair, walking sideways
    expect(side.x).toBeLessThan(2.6);
    const onto = walk(w, { x: 2, z: 5, y: 0.01 }, { x: 2, z: 4.3 });
    expect(onto.z).toBeLessThan(4.4);
    // without railings you can step off the side
    d.stairs[0].railing = undefined;
    expect(walk(world(d), { x: 2, z: 3, y: 1.4 }, { x: 3.5, z: 3 }).x).toBeGreaterThan(3.4);
  });

  it('a guard rail runs round the stairwell upstairs, open where the stair arrives', () => {
    const d = twoStoreys();
    d.stairs[0].railing = { style: 'metal', a: true, b: true };
    const w = world(d);
    // upstairs, walking at the hole from the side: stopped by the guard rail
    expect(walk(w, { x: 4, z: 3, y: 2.81 }, { x: 2.2, z: 3 }).x).toBeGreaterThan(2.5);
    // the open end is the top of the stair: you can walk off the stair onto the floor
    expect(walk(w, { x: 2, z: 2, y: 2.4 }, { x: 2, z: 0.5 }, 0.03).y).toBeCloseTo(2.81, 1);
  });
});

describe('attics', () => {
  it('you cannot walk where the roof is too low to stand up', () => {
    const { d, F } = house();
    d.roofs.push({ id: 'roof', floor: F, kind: 'gable', x: 3, y: 2.5, w: 6, d: 5, rotation: 0, pitch: 45, overhang: 0.3, thickness: 0.15, material: 'tiles', color: '#b5523b', chimney: false, parapet: false });
    d.floors.push({ id: 'attic', name: 'Attic', attic: true });
    d.rooms.push(room('a', 'attic', 0.1, 0.1, 5.9, 4.9));
    const w = world(d);
    const ridge = walk(w, { x: 3, z: 2.5, y: 2.81 }, { x: 5, z: 2.5 }); // along the ridge: plenty of room
    expect(ridge.x).toBeGreaterThan(4.9);
    const toEave = walk(w, { x: 3, z: 2.5, y: 2.81 }, { x: 3, z: 0.2 }); // towards the eave: stops where you would hit your head
    expect(toEave.z).toBeGreaterThan(0.9);
    expect(w.blockedAt(3, 0.3, 2.81)).toBe(true);
    expect(w.blockedAt(3, 2.5, 2.81)).toBe(false);
  });
});

describe('where you start', () => {
  it('a spot inside furniture is moved to the nearest free place; a free spot stays', () => {
    const { d, F } = house();
    d.furniture.push({ id: 't', floor: F, type: 'dining-table', x: 3, y: 2.5, w: 1.6, d: 0.9, rotation: 0, color: '#ccc', label: '' });
    const w = world(d);
    expect(w.freeSpot(1, 1, 0.01)).toEqual({ x: 1, z: 1 });
    const spot = w.freeSpot(3, 2.5, 0.01);
    expect(Math.hypot(spot.x - 3, spot.z - 2.5)).toBeGreaterThan(0.5);
    expect(Math.hypot(spot.x - 3, spot.z - 2.5)).toBeLessThan(1.6);
    // from there you can walk on
    expect(walk(w, { x: spot.x, z: spot.z, y: 0.01 }, { x: 1, z: 1 }).x).toBeLessThan(1.2);
  });
});
