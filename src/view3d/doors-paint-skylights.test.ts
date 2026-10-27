import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { createDesign, parseDesign, type Design, type Opening, type Roof, type Wall } from '../model';
import { newRoof } from '../roofActions';
import { skylightPlacement } from '../roofs';
import { wallFaceLine } from '../walls';
import { sceneChunks, skinPanels, skylightParts, skylightsOn, swingAngle } from './build';
import { partsBounds, type Part } from './parts';

const wall = (id: string, floor: string, ax: number, ay: number, bx: number, by: number, extra: Partial<Wall> = {}): Wall => ({ id, floor, a: { x: ax, y: ay }, b: { x: bx, y: by }, thickness: 0.2, type: 'interior', height: 2.5, ...extra });
const door = (id: string, wallId: string, kind: Opening['kind'], pos: number, width: number, extra: Partial<Opening> = {}): Opening => ({ id, wallId, kind, pos, width, swing: 1, hinge: 'a', ...extra });

function house(): { d: Design; F: string } {
  const d = createDesign();
  const F = d.floors[0].id;
  d.walls.push(wall('n', F, 0, 0, 6, 0), wall('e', F, 6, 0, 6, 4), wall('s', F, 6, 4, 0, 4), wall('w', F, 0, 4, 0, 0));
  return { d, F };
}

const chunk = (d: Design, key: string): Part[] => sceneChunks(d).find((c) => c.key === key)!.make();
const animated = (parts: Part[]) => parts.filter((p) => p.anim);

describe('wall types', () => {
  it('load-bearing walls of older designs load as exterior walls', () => {
    const d = createDesign();
    const raw = JSON.parse(JSON.stringify({ ...d, walls: [wall('a', d.floors[0].id, 0, 0, 3, 0, { type: 'load' as unknown as Wall['type'] })] }));
    expect(parseDesign(raw).walls[0].type).toBe('exterior');
  });
});

describe('painted walls', () => {
  it('skins are kept, bad ones dropped', () => {
    const d = createDesign();
    const raw = JSON.parse(JSON.stringify({ ...d, walls: [wall('a', d.floors[0].id, 0, 0, 3, 0, { paint: { l: { finish: 'brick', color: '#b5603f' }, r: { finish: 'lava', color: 'red' } } as unknown as Wall['paint'] })] }));
    const w = parseDesign(raw).walls[0];
    expect(w.paint).toEqual({ l: { finish: 'brick', color: '#b5603f' } });
    delete raw.walls[0].paint;
    expect(parseDesign(raw).walls[0].paint).toBeUndefined();
  });

  it('the face lines run along the correct side of the wall', () => {
    const w = wall('a', 'f', 0, 0, 4, 0);
    const right = wallFaceLine(w, 0, 4, 'r', 0.05);
    const left = wallFaceLine(w, 0, 4, 'l', 0.05);
    expect(right[0].y).toBeCloseTo(0.05); // 10 cm half thickness minus 5 cm inset: on the +y side of a wall that runs along +x
    expect(left[0].y).toBeCloseTo(-0.05);
    expect(right[right.length - 1].x).toBeCloseTo(4);
    const bent = wallFaceLine({ ...w, bulge: 1 }, 0, 4.2, 'r', 0);
    expect(bent.length).toBeGreaterThan(4);
  });

  it('3D panels cover only the painted faces, a hair outside the wall, facing out', () => {
    const { d } = house();
    d.walls[0].paint = { r: { finish: 'brick', color: '#b5603f' } }; // the right of the north wall (a to b along +x) is +y: into the house
    const panels = chunk(d, 'wall:n').filter((p) => p.t === 'panel');
    expect(panels).toHaveLength(1);
    const p = panels[0];
    if (p.t !== 'panel') throw new Error();
    expect(p.facing.map((v) => v + 0)).toEqual([0, 0, 1]);
    expect(p.pts.every((q) => Math.abs(q[2] - 0.102) < 1e-9)).toBe(true);
    expect(p.tex).toEqual({ kind: 'wall-brick', color: '#b5603f' });
    d.walls[0].paint = { l: { finish: 'paint', color: '#ffffff' } };
    const left = chunk(d, 'wall:n').filter((q) => q.t === 'panel')[0];
    if (left.t !== 'panel') throw new Error();
    expect(left.facing.map((v) => v + 0)).toEqual([0, 0, -1]);
    expect(left.tex).toBeUndefined(); // plain paint is just a color
  });

  it('a window leaves the wall painted above and below it, and a door above it', () => {
    const { d } = house();
    d.walls[0].paint = { r: { finish: 'stone', color: '#a8a29a' } };
    d.openings.push(door('w', 'n', 'window', 3, 1.2, { kind: 'window' }));
    const panels = chunk(d, 'wall:n').filter((p) => p.t === 'panel' && p.tex);
    // left of the window, right of it, under it, over it
    expect(panels).toHaveLength(4);
    expect(skinPanels({ ...d.walls[0], paint: undefined }, 0, 3, 0, 2.5)).toEqual([]);
  });

  it('curved walls get one panel per step', () => {
    const w = wall('c', 'f', 0, 0, 6, 0, { bulge: 1.5, paint: { r: { finish: 'wood', color: '#a47c52' } } });
    expect(skinPanels(w, 0, 6.5, 0, 2.5).length).toBeGreaterThan(3);
  });
});

describe('doors that open', () => {
  it('turns a leaf about its hinge towards the side the door swings to', () => {
    // a wall along +x: the door swings to its right (+y on the plan). Hinged at the start, the closed leaf points along +x.
    expect(swingAngle({ x: 1, y: 0 }, { x: 0, y: 1 })).toBeCloseTo(-Math.PI / 2);
    expect(swingAngle({ x: 1, y: 0 }, { x: 0, y: -1 })).toBeCloseTo(Math.PI / 2);
    expect(swingAngle({ x: -1, y: 0 }, { x: 0, y: 1 })).toBeCloseTo(Math.PI / 2);
  });

  it('a single door leaf hangs from its hinge and opens to the swing side', () => {
    const { d } = house();
    d.openings.push(door('d1', 'n', 'door', 2, 1));
    const leaf = animated(chunk(d, 'wall:n'));
    expect(leaf.length).toBe(2); // the leaf and the handle
    const a = leaf[0].anim!;
    if (a.kind !== 'swing') throw new Error();
    expect(a.door).toBe('d1');
    expect(a.origin[0]).toBeCloseTo(1.5); // hinge 'a': at the start of the opening, 1.5 = 2 - 0.5
    expect(a.origin[2]).toBeCloseTo(0);
    expect(a.angle).toBeCloseTo(-Math.PI / 2);
    // opened, the leaf stands across the wall on the side of +y
    const x = Math.cos(a.angle) * 0.47 + 0; // a point 0.47 along the closed leaf, turned about the hinge
    const z = -Math.sin(a.angle) * 0.47;
    expect(x).toBeCloseTo(0);
    expect(z).toBeCloseTo(0.47);
    // hinged at the other jamb and swinging the other way
    d.openings[0] = door('d1', 'n', 'door', 2, 1, { hinge: 'b', swing: -1 });
    const b = animated(chunk(d, 'wall:n'))[0].anim!;
    if (b.kind !== 'swing') throw new Error();
    expect(b.origin[0]).toBeCloseTo(2.5);
    expect(b.angle).toBeCloseTo(swingAngle({ x: -1, y: 0 }, { x: 0, y: -1 }));
  });

  it('double and French doors have two leaves with opposite hinges; sliding doors slide; garage doors lift', () => {
    const { d } = house();
    d.openings.push(door('dd', 'n', 'double', 2, 1.6), door('fr', 'n', 'french', 4.5, 1.6), door('sl', 's', 'sliding', 3, 2), door('ga', 'e', 'garage', 2, 2.4));
    const hinges = (parts: Part[], id: string) => new Set(animated(parts).filter((p) => p.anim!.door === id).map((p) => (p.anim!.kind === 'swing' ? p.anim!.origin[0].toFixed(2) : 'x')));
    const north = chunk(d, 'wall:n');
    expect([...hinges(north, 'dd')].sort()).toEqual(['1.20', '2.80']);
    expect([...hinges(north, 'fr')].sort()).toEqual(['3.70', '5.30']);
    const sliding = animated(chunk(d, 'wall:s')).filter((p) => p.anim!.door === 'sl');
    expect(sliding.length).toBeGreaterThan(0);
    expect(sliding.every((p) => p.anim!.kind === 'slide')).toBe(true);
    const lift = animated(chunk(d, 'wall:e')).find((p) => p.anim!.door === 'ga')!.anim!;
    if (lift.kind !== 'slide') throw new Error();
    expect(lift.move[1]).toBeGreaterThan(1.8);
  });

  it('windows and the frame of a door stay where they are', () => {
    const { d } = house();
    d.openings.push(door('w', 'n', 'window', 3, 1.2, { kind: 'window' }));
    expect(animated(chunk(d, 'wall:n'))).toHaveLength(0);
  });
});

describe('skylights', () => {
  const withRoof = (kind: Roof['kind'], extra: Partial<Roof> = {}) => {
    const { d, F } = house();
    d.roofs.push({ ...newRoof(F, { x: 3, y: 2, w: 6.2, d: 4.2, rotation: 0 }, kind), ...extra });
    return { d, F };
  };

  it('lies in the slope of a gable roof, up the slope, level along the eave', () => {
    const { d, F } = withRoof('gable', { pitch: 30 });
    const sp = skylightPlacement(d.roofs, F, { x: 3, y: 3 })!; // the front (south, +y) slope
    expect(sp.flat).toBe(false);
    expect(sp.lz).toBeCloseTo(1);
    expect(sp.t[1]).toBe(0);
    expect(Math.abs(sp.t[0])).toBeCloseTo(1); // along the ridge
    expect(sp.u[1]).toBeGreaterThan(0.4); // up the slope
    expect(sp.n[1]).toBeCloseTo(Math.cos(Math.PI / 6));
    // height of the surface there: ridge height minus 1 m of run at 30 degrees
    expect(sp.y).toBeCloseTo((2.1 - 1) * Math.tan(Math.PI / 6), 2);
    // the back slope tilts the other way
    const back = skylightPlacement(d.roofs, F, { x: 3, y: 1 })!;
    expect(back.n[2]).toBeLessThan(0);
    expect(sp.n[2]).toBeGreaterThan(0);
  });

  it('works on the sloping faces of hip, shed, gambrel and mansard roofs, on a flat roof it is raised, and off the roof it does not exist', () => {
    for (const kind of ['hip', 'shed', 'gambrel', 'mansard'] as const) {
      const { d, F } = withRoof(kind);
      const sp = skylightPlacement(d.roofs, F, { x: 3, y: 3.2 });
      expect(sp, kind).not.toBeNull();
      expect(sp!.flat).toBe(false);
      expect(sp!.n[1]).toBeGreaterThan(0.2);
    }
    const flat = withRoof('flat');
    expect(skylightPlacement(flat.d.roofs, flat.F, { x: 3, y: 2 })!.flat).toBe(true);
    expect(skylightPlacement(flat.d.roofs, flat.F, { x: 30, y: 2 })).toBeNull();
    expect(skylightPlacement(flat.d.roofs, 'another', { x: 3, y: 2 })).toBeNull();
  });

  it('follows the rotation of the roof', () => {
    const { d, F } = withRoof('gable', { rotation: 90, w: 4.2, d: 6.2 });
    const sp = skylightPlacement(d.roofs, F, { x: 4, y: 2 })!; // a point to the east of the ridge
    expect(sp.roof.rotation).toBe(90);
    expect(Math.abs(sp.lx)).toBeLessThan(0.01);
    expect(Math.abs(sp.lz)).toBeCloseTo(1);
  });

  it('is part of the roof in 3D: glass in a frame, flush with the slope', () => {
    const { d, F } = withRoof('gable', { pitch: 30 });
    d.skylights.push({ id: 's', floor: F, x: 3, y: 3, w: 0.78, d: 1.18 });
    expect(skylightsOn(d, d.roofs[0])).toHaveLength(1);
    const sp = skylightPlacement(d.roofs, F, d.skylights[0])!;
    const parts = skylightParts(sp, d.skylights[0]);
    expect(parts.filter((p) => 'glass' in p && p.glass)).toHaveLength(1);
    expect(parts.length).toBe(6);
    const b = partsBounds(parts);
    expect(b.maxX - b.minX).toBeCloseTo(0.78 + 0.14, 2);
    // the whole roof chunk contains it, and changes when it moves
    const roofParts = chunk(d, 'roof:' + d.roofs[0].id);
    expect(roofParts.filter((p) => 'glass' in p && p.glass)).toHaveLength(1);
    const before = sceneChunks(d).find((c) => c.key === 'roof:' + d.roofs[0].id)!.deps;
    const moved = produce(d, (x) => void (x.skylights[0].x = 4));
    const after = sceneChunks(moved).find((c) => c.key === 'roof:' + d.roofs[0].id)!.deps;
    expect(after.some((v, i) => v !== before[i])).toBe(true);
  });

  it('a raised window on a flat roof, and none when it is not on a roof', () => {
    const { d, F } = withRoof('flat');
    d.skylights.push({ id: 's', floor: F, x: 3, y: 2, w: 1, d: 1 }, { id: 'lost', floor: F, x: 50, y: 50, w: 1, d: 1 });
    expect(skylightsOn(d, d.roofs[0]).map((s) => s.id)).toEqual(['s']);
    const sp = skylightPlacement(d.roofs, F, d.skylights[0])!;
    const b = partsBounds(skylightParts(sp, d.skylights[0]));
    expect(b.maxY - b.minY).toBeCloseTo(0.33, 2);
  });

  it('are saved and repaired like everything else, and go with their floor', () => {
    const { d, F } = withRoof('gable');
    d.skylights.push({ id: 's', floor: F, x: 3, y: 3, w: 0.78, d: 1.18 });
    const again = parseDesign(JSON.parse(JSON.stringify(d)));
    expect(again.skylights).toEqual(d.skylights);
    const raw = JSON.parse(JSON.stringify(d));
    raw.skylights = [{ id: 'x', w: -2, d: 'big', x: 'no', floor: 'missing' }];
    const fixed = parseDesign(raw).skylights[0];
    expect(fixed.w).toBeGreaterThanOrEqual(0.2);
    expect(fixed.floor).toBe(raw.floors[0].id);
    delete raw.skylights;
    expect(parseDesign(raw).skylights).toEqual([]);
  });
});
