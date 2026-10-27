import { describe, expect, it } from 'vitest';
import { CATALOG, furnitureHeight } from '../catalog';
import { createDesign, type Design, type Furniture, type Opening, type Wall } from '../model';
import { buildParts, floorElevations, furnitureChunk, sceneChunks, stairParts, wallStrip } from './build';
import { POOL_DEPTH } from './furniture3d';
import { box, partsBounds, place, type Part } from './parts';

const wall = (id: string, floor: string, ax: number, ay: number, bx: number, by: number, extra: Partial<Wall> = {}): Wall => ({ id, floor, a: { x: ax, y: ay }, b: { x: bx, y: by }, thickness: 0.2, type: 'interior', height: 2.5, ...extra });
const op = (id: string, wallId: string, kind: Opening['kind'], pos: number, width = 1): Opening => ({ id, wallId, kind, pos, width, swing: 1, hinge: 'a' });
const sofa = (id: string, floor: string, extra: Partial<Furniture> = {}): Furniture => ({ id, floor, type: 'sofa', x: 2, y: 2, w: 2, d: 0.9, rotation: 0, color: '#b7c9a8', label: '', ...extra });

function house(): { d: Design; F: string } {
  const d = createDesign();
  const F = d.floors[0].id;
  d.walls.push(wall('n', F, 0, 0, 6, 0), wall('e', F, 6, 0, 6, 4), wall('s', F, 6, 4, 0, 4), wall('w', F, 0, 4, 0, 0));
  return { d, F };
}

const chunkOf = (d: Design, key: string): Part[] => sceneChunks(d).find((c) => c.key === key)!.make();
const prisms = (parts: Part[]) => parts.filter((p): p is Extract<Part, { t: 'prism' }> => p.t === 'prism');

describe('placing parts', () => {
  it('turns a plan rotation clockwise, like the 2D view', () => {
    const local = [box(0.9, 1.1, 0, 1, -0.1, 0.1, '#fff')]; // a box one meter to the right of the item
    const at90 = place(local, 5, 3, Math.PI / 2, 0.5)[0];
    if (at90.t !== 'box') throw new Error('box expected');
    expect(at90.x).toBeCloseTo(5); // +x turned to point down the plan (+y = three's +z)
    expect(at90.z).toBeCloseTo(4);
    expect(at90.y).toBeCloseTo(1); // lifted
    expect(at90.ry).toBeCloseTo(-Math.PI / 2);
  });
});

describe('furniture models', () => {
  it('every catalog item makes parts that stay roughly inside its footprint and below the ceiling', () => {
    const d = createDesign();
    const F = d.floors[0].id;
    for (const item of CATALOG) {
      const f = sofa('x', F, { type: item.type, w: item.w, d: item.d, x: 0, y: 0, color: item.color });
      const parts = furnitureChunk(d, f, 0);
      const real = parts.filter((p) => p.t !== 'light');
      expect(real.length, item.type).toBeGreaterThan(0);
      const b = partsBounds(real);
      const h = furnitureHeight(f);
      expect(b.minX, `${item.type} left`).toBeGreaterThanOrEqual(-item.w / 2 - 0.4);
      expect(b.maxX, `${item.type} right`).toBeLessThanOrEqual(item.w / 2 + 0.4);
      expect(b.minZ, `${item.type} back`).toBeGreaterThanOrEqual(-item.d / 2 - 0.4);
      expect(b.maxZ, `${item.type} front`).toBeLessThanOrEqual(item.d / 2 + 0.4);
      expect(b.minY, `${item.type} below floor`).toBeGreaterThanOrEqual(item.type === 'pool' ? -POOL_DEPTH - 0.2 : -0.02);
      expect(b.maxY, `${item.type} too tall`).toBeLessThanOrEqual(Math.max(h * 1.5, 2.6) + 0.3);
    }
  });

  it('sofas have a back at the rear, arms and cushions; an unknown item is a plain block', () => {
    const d = createDesign();
    const F = d.floors[0].id;
    expect(furnitureChunk(d, sofa('a', F), 0).length).toBeGreaterThan(8);
    const plain = furnitureChunk(d, sofa('b', F, { type: 'something-new', w: 1, d: 1, x: 0, y: 0 }), 0);
    expect(plain.length).toBeLessThanOrEqual(2);
    expect(partsBounds(plain).maxY).toBeCloseTo(0.5, 1); // category default height
  });

  it('lamps only shine when they are on', () => {
    const d = createDesign();
    const F = d.floors[0].id;
    const lamp = (on?: boolean) => furnitureChunk(d, sofa('l', F, { type: 'lamp-ceiling', w: 0.4, d: 0.4, ...(on === false ? { on: false } : {}) }), 0);
    expect(lamp().some((p) => p.t === 'light')).toBe(true);
    expect(lamp(false).some((p) => p.t === 'light')).toBe(false);
    expect(lamp(false).some((p) => 'glow' in p && p.glow)).toBe(false);
    // hangs from the ceiling
    expect(partsBounds(lamp().filter((p) => p.t !== 'light')).maxY).toBeCloseTo(2.5, 1);
  });

  it('puts a table lamp and a plant on the furniture they stand on', () => {
    const { d, F } = house();
    d.furniture.push(sofa('table', F, { type: 'side-table', x: 3, y: 2, w: 0.6, d: 0.6 }), sofa('lamp', F, { type: 'lamp-table', x: 3, y: 2, w: 0.3, d: 0.3 }), sofa('lamp2', F, { type: 'lamp-table', x: 5, y: 3, w: 0.3, d: 0.3 }));
    const parts = buildParts(d);
    const bottomOf = (id: string) => {
      const c = sceneChunks(d).find((s) => s.key === `fur:${id}`)!;
      return partsBounds(c.make().filter((p) => p.t !== 'light')).minY;
    };
    expect(parts.length).toBeGreaterThan(0);
    expect(bottomOf('lamp')).toBeCloseTo(0.5, 1); // the side table is 0.5 m high
    expect(bottomOf('lamp2')).toBeCloseTo(0, 2); // nothing under it: on the floor
  });
});

describe('walls and openings', () => {
  it('a plain wall is one solid, as tall as the wall', () => {
    const { d } = house();
    const parts = sceneChunks(d).find((c) => c.key === 'wall:n')!.make();
    expect(parts).toHaveLength(1);
    const p = prisms(parts)[0];
    expect([p.y0, p.y1]).toEqual([0, 2.5]);
    // 6 m between the end centers plus half a wall thickness at both ends, 0.2 thick
    const xs = p.pts.map((q) => q.x);
    expect(Math.min(...xs)).toBeCloseTo(-0.1);
    expect(Math.max(...xs)).toBeCloseTo(6.1);
    expect(Math.max(...p.pts.map((q) => q.y)) - Math.min(...p.pts.map((q) => q.y))).toBeCloseTo(0.2);
  });

  it('a door leaves a gap with a lintel over it and a door leaf in it', () => {
    const { d } = house();
    d.openings.push(op('d1', 'n', 'door', 2, 0.9));
    const parts = sceneChunks(d).find((c) => c.key === 'wall:n')!.make();
    const solids = prisms(parts).filter((p) => p.y0 === 0);
    expect(solids).toHaveLength(2); // left and right of the door
    const lintel = prisms(parts).find((p) => p.y0 > 1.9)!;
    expect(lintel.y0).toBeCloseTo(2.05);
    expect(lintel.y1).toBe(2.5);
    expect(Math.min(...lintel.pts.map((q) => q.x))).toBeCloseTo(1.55);
    expect(Math.max(...lintel.pts.map((q) => q.x))).toBeCloseTo(2.45);
    expect(parts.some((p) => p.t === 'box' && Math.abs(p.sy - 2.0) < 0.1)).toBe(true); // the leaf
  });

  it('a window has a wall under it, a wall over it and glass in between', () => {
    const { d } = house();
    d.openings.push(op('w1', 's', 'window', 3, 1.4));
    const parts = sceneChunks(d).find((c) => c.key === 'wall:s')!.make();
    const under = prisms(parts).find((p) => p.y0 === 0 && p.y1 === 0.9);
    const over = prisms(parts).find((p) => p.y1 === 2.5 && p.y0 > 2);
    expect(under).toBeTruthy();
    expect(over!.y0).toBeCloseTo(2.1);
    const glass = parts.filter((p) => 'glass' in p && p.glass);
    expect(glass.length).toBeGreaterThan(0);
    expect(Math.min(...glass.map((g) => (g.t === 'box' ? g.y - g.sy / 2 : 9)))).toBeGreaterThanOrEqual(0.9);
  });

  it('open passages, garage doors and bay windows all keep the wall closed above them', () => {
    const { d } = house();
    d.openings.push(op('g', 'n', 'gap', 1, 1.2), op('gd', 'n', 'garage', 4, 2.4), op('b', 'e', 'bay', 2, 1.8));
    for (const id of ['n', 'e']) {
      const parts = sceneChunks(d).find((c) => c.key === `wall:${id}`)!.make();
      expect(prisms(parts).some((p) => p.y1 === 2.5 && p.y0 > 1.9), id).toBe(true);
    }
  });

  it('curved walls follow the curve', () => {
    const w = wall('c', 'f', 0, 0, 4, 0, { bulge: 1 });
    const strip = wallStrip(w, 0, 4.5);
    expect(strip.length).toBeGreaterThan(6);
    const ys = strip.map((q) => q.y);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(0.9);
  });

  it('low railings do not get windows and doors', () => {
    const { d } = house();
    d.walls[0].height = 1.0;
    d.openings.push(op('x', 'n', 'window', 3, 1));
    const parts = sceneChunks(d).find((c) => c.key === 'wall:n')!.make();
    expect(parts.every((p) => !('glass' in p && p.glass))).toBe(true);
  });
});

describe('floors and the rest of the property', () => {
  it('stacks storeys, puts a slab under upper floors and can hide what is above', () => {
    const { d, F } = house();
    d.floors.push({ id: 'up', name: '1st floor' });
    d.walls.push(wall('u', 'up', 0, 0, 6, 0));
    d.rooms.push({ id: 'r', floor: 'up', name: 'Room', color: '#e8eef7', material: 'wood', living: true, points: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 }] });
    const elev = floorElevations(d);
    expect(elev.get(F)).toBe(0);
    expect(elev.get('up')).toBeCloseTo(2.8);
    const upWall = prisms(sceneChunks(d).find((c) => c.key === 'wall:u')!.make())[0];
    expect(upWall.y1).toBeCloseTo(2.8 + 2.5);
    expect(upWall.y0).toBeCloseTo(2.8 - 0.3); // down into the slab
    const room = prisms(sceneChunks(d).find((c) => c.key === 'room:r')!.make())[0];
    expect(room.tex).toEqual({ kind: 'wood', color: '#e8eef7' });
    expect(room.y1).toBeCloseTo(2.81);
    const keys = (hide?: string) => sceneChunks(d, { hideAbove: hide }).map((c) => c.key);
    expect(keys()).toContain('wall:u');
    expect(keys(F)).not.toContain('wall:u');
    expect(keys(F)).toContain('wall:n');
  });

  it('a basement sits below the garden; the ground has a hole over its rooms, and the walls reach up to it', () => {
    const { d } = house();
    d.floors.unshift({ id: 'b', name: 'Basement' });
    d.walls.push(wall('bw', 'b', 0, 0, 6, 0));
    d.rooms.push({ id: 'br', floor: 'b', name: 'Cellar', color: '#ddd', material: 'plain', living: false, points: [{ x: 0.1, y: 0.1 }, { x: 5.9, y: 0.1 }, { x: 5.9, y: 3.9 }, { x: 0.1, y: 3.9 }] });
    const elev = floorElevations(d);
    expect(elev.get('b')).toBeCloseTo(-2.8);
    const ground = chunkOf(d, 'ground')[0];
    if (ground.t !== 'prism') throw new Error();
    expect(ground.holes).toHaveLength(1);
    const wallTop = prisms(chunkOf(d, 'wall:bw'))[0].y1;
    expect(wallTop).toBeCloseTo(-0.03);
    // with the basement switched off the ground is whole again
    const without = sceneChunks(d, { hiddenFloors: ['b'] }).find((c) => c.key === 'ground')!.make()[0];
    if (without.t !== 'prism') throw new Error();
    expect(without.holes).toBeUndefined();
    d.floors.shift();
    expect(sceneChunks(d).some((c) => c.key === 'ground')).toBe(true);
  });

  it('lawns, streets and fences become flat shapes, boxes and posts', () => {
    const { d, F } = house();
    d.zones.push({ id: 'z', floor: F, kind: 'lawn', name: '', color: '#cfe8c4', points: [{ x: -5, y: 5 }, { x: 10, y: 5 }, { x: 10, y: 9 }, { x: -5, y: 9 }] });
    d.strips.push({ id: 's', floor: F, kind: 'road', points: [{ x: -10, y: 12 }, { x: 15, y: 12 }], width: 6 }, { id: 'f', floor: F, kind: 'fence', points: [{ x: -5, y: 5 }, { x: 10, y: 5 }], width: 0.1 });
    const lawn = prisms(sceneChunks(d).find((c) => c.key === 'zone:z')!.make())[0];
    expect(lawn.y1).toBeCloseTo(0.03);
    const road = sceneChunks(d).find((c) => c.key === 'strip:s')!.make();
    expect(road.some((p) => p.t === 'box' && p.sz === 6)).toBe(true);
    const fence = sceneChunks(d).find((c) => c.key === 'strip:f')!.make();
    expect(fence.filter((p) => p.t === 'box' && p.sy >= 1.2).length).toBeGreaterThanOrEqual(7); // posts every 2 m
  });
});

describe('stairs', () => {
  const base = { w: 1, d: 4, steps: 16, rise: 2.8, flip: false };
  const tops = (parts: Part[]) => parts.map((p) => (p.t === 'box' ? p.y + p.sy / 2 : p.t === 'prism' ? p.y1 : 0));

  it('a straight stair has one block per step, each a step higher, up to the full rise', () => {
    const parts = stairParts({ ...base, kind: 'straight' });
    // a solid block and a tread on top of it for every step
    expect(parts.filter((p) => p.t === 'box')).toHaveLength(16);
    const treads = parts.filter((p) => p.t === 'prism');
    expect(treads).toHaveLength(16);
    const sorted = treads.map((p) => (p.t === 'prism' ? p.y1 : 0)).sort((a, b) => a - b);
    expect(sorted[0]).toBeCloseTo(2.8 / 16);
    expect(sorted[15]).toBeCloseTo(2.8);
    // the first step is at the bottom of the box (+z), the top step at the far end (-z)
    const midZ = (p: Part) => (p.t === 'prism' ? p.pts.reduce((a, q) => a + q.y, 0) / p.pts.length : 0);
    const first = treads.find((p) => p.t === 'prism' && Math.abs(p.y1 - 2.8 / 16) < 1e-6)!;
    const last = treads.find((p) => p.t === 'prism' && Math.abs(p.y1 - 2.8) < 1e-6)!;
    expect(midZ(first)).toBeGreaterThan(midZ(last));
  });

  it('L, U and spiral stairs reach the full rise inside their box', () => {
    for (const kind of ['l', 'u', 'spiral'] as const) {
      const s = { ...base, kind, w: kind === 'spiral' ? 1.6 : 2.4, d: kind === 'spiral' ? 1.6 : 3, steps: 16 };
      const parts = stairParts(s);
      const b = partsBounds(parts);
      expect(Math.max(...tops(parts.filter((p) => p.t !== 'cyl'))), kind).toBeGreaterThan(2.6);
      expect(Math.max(...tops(parts.filter((p) => p.t !== 'cyl'))), kind).toBeLessThanOrEqual(2.8 + 1e-6);
      expect(b.minX, kind).toBeGreaterThanOrEqual(-s.w / 2 - 1e-6);
      expect(b.maxX, kind).toBeLessThanOrEqual(s.w / 2 + 1e-6);
      expect(b.minZ, kind).toBeGreaterThanOrEqual(-s.d / 2 - 1e-6);
      expect(b.maxZ, kind).toBeLessThanOrEqual(s.d / 2 + 1e-6);
    }
  });

  it('flipping an L stair mirrors it', () => {
    const s = { ...base, kind: 'l' as const, w: 2.4, d: 2.4 };
    const a = partsBounds(stairParts(s).filter((p) => p.t === 'box' && p.y + p.sy / 2 > 2.7));
    const b = partsBounds(stairParts({ ...s, flip: true }).filter((p) => p.t === 'box' && p.y + p.sy / 2 > 2.7));
    expect(a.minX).toBeCloseTo(-b.maxX);
  });
});

describe('rebuilding only what changed', () => {
  it('moving one sofa changes the dependencies of that sofa only', () => {
    const { d, F } = house();
    d.furniture.push(sofa('a', F), sofa('b', F, { x: 4 }));
    d.openings.push(op('d', 'n', 'door', 2));
    const before = sceneChunks(d);
    const moved: Design = { ...d, furniture: d.furniture.map((f) => (f.id === 'a' ? { ...f, x: 3 } : f)) };
    const after = sceneChunks(moved);
    const changed = after.filter((c) => {
      const old = before.find((o) => o.key === c.key)!;
      return c.deps.length !== old.deps.length || c.deps.some((v, i) => v !== old.deps[i]);
    });
    expect(changed.map((c) => c.key)).toEqual(['fur:a']);
  });
});

describe('roofs in 3D', () => {
  const withRoof = () => {
    const { d, F } = house();
    d.roofs.push({ id: 'r', floor: F, kind: 'gable', x: 3, y: 2, w: 6.6, d: 4.6, rotation: 0, pitch: 35, overhang: 0.4, thickness: 0.15, material: 'tiles', color: '#b5523b', chimney: true, parapet: false });
    return { d, F };
  };

  it('sits on top of the walls, as wide as the roof box plus the overhang, with a chimney above it', () => {
    const { d } = withRoof();
    const parts = sceneChunks(d).find((c) => c.key === 'roof:r')!.make();
    const panels = parts.filter((p) => p.t === 'panel');
    expect(panels.length).toBe(4); // two slopes and two gable ends
    const b = partsBounds(parts);
    expect(b.minX).toBeCloseTo(3 - 3.3 - 0.4, 1);
    expect(b.maxX).toBeCloseTo(3 + 3.3 + 0.4, 1);
    expect(b.minY).toBeLessThan(2.5); // the eaves hang a little below the wall tops
    const ridge = 2.5 + 2.3 * Math.tan((35 * Math.PI) / 180);
    expect(b.maxY).toBeGreaterThan(ridge + 0.8); // chimney
  });

  it('turns with the roof box', () => {
    const { d } = withRoof();
    d.roofs[0].rotation = 90;
    const b = partsBounds(sceneChunks(d).find((c) => c.key === 'roof:r')!.make());
    expect(b.maxX - b.minX).toBeCloseTo(4.6 + 0.8, 1);
    expect(b.maxZ - b.minZ).toBeCloseTo(6.6 + 0.8, 1);
  });

  it('is left out when switched off, hidden by its layer, or cut away with the floor above', () => {
    const { d, F } = withRoof();
    const has = (o?: Parameters<typeof sceneChunks>[1]) => sceneChunks(d, o).some((c) => c.key === 'roof:r');
    expect(has()).toBe(true);
    expect(has({ showRoof: false })).toBe(false);
    d.floors.push({ id: 'up', name: '1st' });
    expect(has({ hideAbove: F })).toBe(false); // a cut-away takes off the roof of the floor you are on
    expect(has({ hideAbove: 'up' })).toBe(true);
    d.layers.roofs.visible = false;
    expect(has()).toBe(false);
  });

  it('follows the height of the walls it sits on', () => {
    const { d } = withRoof();
    const low = partsBounds(sceneChunks(d).find((c) => c.key === 'roof:r')!.make()).maxY;
    for (const w of d.walls) w.height = 3.5;
    const high = partsBounds(sceneChunks(d).find((c) => c.key === 'roof:r')!.make()).maxY;
    expect(high - low).toBeCloseTo(1, 5);
  });
});
