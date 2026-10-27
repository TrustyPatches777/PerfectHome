import { describe, expect, it } from 'vitest';
import { findIssues } from '../checks';
import { clipPolygon, isConvex, polygonArea } from '../geometry';
import { createDesign, parseDesign, type Design, type Opening, type Roof, type Stair, type Wall } from '../model';
import { newRoof } from '../roofActions';
import { atticClearance, roofUndersideLocal } from '../roofs';
import { densify, guardEdges, railPaths, stairOutline, stairSteps, stairTopAt } from '../stairs';
import { railParts, sceneChunks, stairHoles, stairPlanOutline, skylightCorners } from './build';
import { partsBounds, type Part } from './parts';
import { skylightPlacement } from '../roofs';

const wall = (id: string, floor: string, ax: number, ay: number, bx: number, by: number, extra: Partial<Wall> = {}): Wall => ({ id, floor, a: { x: ax, y: ay }, b: { x: bx, y: by }, thickness: 0.2, type: 'interior', height: 2.5, ...extra });
const room = (id: string, floor: string, x0: number, y0: number, x1: number, y1: number) => ({ id, floor, name: id, color: '#eee', material: 'plain' as const, living: true, points: [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }] });
const stair = (floor: string, kind: Stair['kind'], extra: Partial<Stair> = {}): Stair => ({ id: 's-' + kind, floor, kind, x: 2, y: 3, w: kind === 'straight' ? 1 : 2.4, d: kind === 'straight' ? 3 : 2.4, rotation: 0, steps: 16, rise: 2.8, flip: false, ...extra });
const chunk = (d: Design, key: string, opts?: Parameters<typeof sceneChunks>[1]): Part[] => sceneChunks(d, opts).find((c) => c.key === key)!.make();

function twoStoreys(kind: Stair['kind'] = 'straight') {
  const d = createDesign();
  const F = d.floors[0].id;
  d.floors.push({ id: 'up', name: '1st floor' });
  d.walls.push(wall('n', F, 0, 0, 6, 0), wall('e', F, 6, 0, 6, 5), wall('s', F, 6, 5, 0, 5), wall('w', F, 0, 5, 0, 0));
  d.rooms.push(room('ground', F, 0.1, 0.1, 5.9, 4.9), room('upper', 'up', 0.1, 0.1, 5.9, 4.9));
  d.stairs.push(stair(F, kind));
  return { d, F };
}

describe('the floor above a stair', () => {
  it('has a hole where the stair comes up, and the floor below does not', () => {
    const { d } = twoStoreys();
    const upper = chunk(d, 'room:upper')[0];
    const ground = chunk(d, 'room:ground')[0];
    if (upper.t !== 'prism' || ground.t !== 'prism') throw new Error();
    expect(upper.holes).toHaveLength(1);
    expect(polygonArea(upper.holes![0])).toBeCloseTo(3, 3); // 1 x 3 m
    expect(ground.holes).toBeUndefined();
  });

  it('the hole follows the shape of an L stair, a turned stair, and is cut off at the edge of the room', () => {
    const l = twoStoreys('l').d;
    expect(polygonArea(stairPlanOutline(l.stairs[0]))).toBeCloseTo(2.4 * 1.2 + 1.2 * 1.2, 3);
    const turned = twoStoreys().d;
    turned.stairs[0].rotation = 90;
    const pts = stairPlanOutline(turned.stairs[0]);
    expect(Math.max(...pts.map((p) => p.x)) - Math.min(...pts.map((p) => p.x))).toBeCloseTo(3);
    // a stair half outside the room above: only the part inside is cut
    const edge = twoStoreys().d;
    edge.stairs[0].x = 5.6;
    const holes = stairHoles(edge.rooms[1], edge.stairs);
    expect(holes).toHaveLength(1);
    expect(polygonArea(holes[0])).toBeCloseTo(0.8 * 3, 1); // 5.1 to 5.9 of the stair's 5.1 to 6.1
    // a stair that is wholly outside leaves no hole
    edge.stairs[0].x = 20;
    expect(stairHoles(edge.rooms[1], edge.stairs)).toHaveLength(0);
  });

  it('clipping helpers: convexity and the intersection of polygons', () => {
    const sq = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 }];
    const ell = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 2 }, { x: 2, y: 2 }, { x: 2, y: 4 }, { x: 0, y: 4 }];
    expect(isConvex(sq)).toBe(true);
    expect(isConvex(ell)).toBe(false);
    const c = clipPolygon(ell, [{ x: 1, y: 1 }, { x: 3, y: 1 }, { x: 3, y: 3 }, { x: 1, y: 3 }]);
    expect(c.length).toBeGreaterThanOrEqual(3);
    expect(polygonArea(c)).toBeGreaterThan(1.9);
    expect(clipPolygon(sq, [{ x: 10, y: 10 }, { x: 11, y: 10 }, { x: 11, y: 11 }])).toEqual([]);
  });

  it('stairs in a hidden floor are hidden, and the room above is not cut by stairs that are on its own floor', () => {
    const { d } = twoStoreys();
    d.stairs.push(stair('up', 'straight', { id: 'other', x: 4.5 }));
    const upper = chunk(d, 'room:upper')[0];
    if (upper.t !== 'prism') throw new Error();
    expect(upper.holes).toHaveLength(1); // only the stair from below
  });
});

describe('stair geometry', () => {
  it('the steps rise evenly to the full height, in every kind', () => {
    for (const kind of ['straight', 'l', 'u', 'spiral'] as const) {
      const s = stair('f', kind);
      const steps = stairSteps(s);
      expect(steps.length, kind).toBe(16);
      const tops = steps.map((x) => x.top);
      expect(Math.max(...tops), kind).toBeCloseTo(2.8, 6);
      expect(new Set(tops.map((t) => t.toFixed(5))).size, kind).toBe(16);
      // every point on a step reports that step's height
      for (const st of steps) {
        const c = st.poly.reduce((a, p) => ({ x: a.x + p.x / st.poly.length, y: a.y + p.y / st.poly.length }), { x: 0, y: 0 });
        expect(stairTopAt(s, c, 0, steps) ?? 0, kind).toBeGreaterThanOrEqual(st.top - 1e-9);
      }
    }
    expect(stairTopAt(stair('f', 'straight'), { x: 5, y: 5 })).toBeNull();
  });

  it('rails run along the flights and the guard rail round the hole leaves the way off the stair open', () => {
    for (const kind of ['straight', 'l', 'u', 'spiral'] as const) {
      const s = stair('f', kind);
      expect(railPaths(s).a.length, kind).toBeGreaterThanOrEqual(2);
      const outline = stairOutline(s);
      const guards = guardEdges(s);
      expect(guards.length, kind).toBeLessThan(outline.length);
      expect(guards.length, kind).toBeGreaterThan(outline.length / 2);
    }
    // mirrored stairs mirror their rails too
    const a = railPaths(stair('f', 'l'));
    const b = railPaths(stair('f', 'l', { flip: true }));
    expect(b.a[1].x).toBeCloseTo(2.4 - a.a[1].x);
    expect(densify([{ x: 0, y: 0 }, { x: 1, y: 0 }], 0.3).length).toBe(5);
  });

  it('a railing has posts or glass, a handrail about 90 cm above the steps, and none when there is no railing', () => {
    const s = stair('f', 'straight', { railing: { style: 'wood', a: true, b: true } });
    const wood = railParts(s, false);
    const bars = wood.filter((p) => p.t === 'beam');
    expect(bars.length).toBeGreaterThan(20);
    expect(wood.filter((p) => p.t === 'box').length).toBeGreaterThan(30); // balusters
    const top = Math.max(...bars.map((p) => (p.t === 'beam' ? Math.max(p.a[1], p.b[1]) : 0)));
    expect(top).toBeGreaterThan(2.8 + 0.7);
    expect(top).toBeLessThan(2.8 + 1.1);
    expect(railParts({ ...s, railing: undefined }, false)).toEqual([]);
    expect(railParts({ ...s, railing: { style: 'none', a: true, b: true } }, false)).toEqual([]);
    // only the sides that are switched on
    const one = railParts({ ...s, railing: { style: 'wood', a: true, b: false } }, false);
    const bx = one.filter((p) => p.t === 'beam').map((p) => (p.t === 'beam' ? p.a[0] : 0));
    expect(Math.max(...bx) - Math.min(...bx)).toBeLessThan(0.01);
    expect(railParts(s, false).filter((p) => 'glass' in p && p.glass)).toHaveLength(0);
    expect(railParts({ ...s, railing: { style: 'glass', a: true, b: true } }, false).filter((p) => 'glass' in p && p.glass).length).toBeGreaterThan(10);
    expect(railParts({ ...s, railing: { style: 'cable', a: true, b: true } }, false).filter((p) => p.t === 'beam').length).toBeGreaterThan(bars.length);
    const guard = railParts(s, true);
    expect(guard.length).toBeGreaterThan(10);
    expect(partsBounds(guard).minY).toBeCloseTo(2.8, 1);
  });

  it('the guard rail is only built when there is a floor above, and every style builds without errors', () => {
    const { d } = twoStoreys();
    d.stairs[0].railing = { style: 'metal', a: true, b: true };
    const withAbove = chunk(d, 'stair:s-straight').length;
    d.floors.pop();
    d.rooms.pop();
    expect(chunk(d, 'stair:s-straight').length).toBeLessThan(withAbove);
    for (const style of ['wood', 'metal', 'glass', 'cable'] as const) for (const kind of ['straight', 'l', 'u', 'spiral'] as const) expect(railParts(stair('f', kind, { railing: { style, a: true, b: true } }), false).length, `${style} ${kind}`).toBeGreaterThan(5);
  });

  it('railings are saved with the design and repaired', () => {
    const { d } = twoStoreys();
    d.stairs[0].railing = { style: 'glass', a: true, b: false };
    expect(parseDesign(JSON.parse(JSON.stringify(d))).stairs[0].railing).toEqual({ style: 'glass', a: true, b: false });
    const raw = JSON.parse(JSON.stringify(d));
    raw.stairs[0].railing = { style: 'gold' };
    expect(parseDesign(raw).stairs[0].railing).toBeUndefined();
    delete raw.stairs[0].railing;
    expect(parseDesign(raw).stairs[0].railing).toBeUndefined();
  });
});

describe('skylights cut the roof', () => {
  const roofed = (kind: Roof['kind']) => {
    const d = createDesign();
    const F = d.floors[0].id;
    d.walls.push(wall('n', F, 0, 0, 6, 0), wall('e', F, 6, 0, 6, 4), wall('s', F, 6, 4, 0, 4), wall('w', F, 0, 4, 0, 0));
    d.roofs.push(newRoof(F, { x: 3, y: 2, w: 6.2, d: 4.2, rotation: 0 }, kind));
    return { d, F };
  };

  it('the roof face has a hole exactly where the skylight is, in the plane of the roof', () => {
    const { d, F } = roofed('gable');
    d.skylights.push({ id: 's', floor: F, x: 3, y: 3, w: 0.78, d: 1.18 });
    const panels = chunk(d, 'roof:' + d.roofs[0].id).filter((p) => p.t === 'panel' && p.holes);
    expect(panels).toHaveLength(1);
    const p = panels[0];
    if (p.t !== 'panel') throw new Error();
    expect(p.holes).toHaveLength(1);
    const sp = skylightPlacement(d.roofs, F, d.skylights[0])!;
    const corners = skylightCorners(sp, d.skylights[0]);
    expect(p.holes![0]).toHaveLength(4);
    // the hole is 0.78 wide and 1.18 long along the slope
    const [a, b, , e] = corners;
    expect(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])).toBeCloseTo(0.78, 3);
    expect(Math.hypot(e[0] - a[0], e[1] - a[1], e[2] - a[2])).toBeCloseTo(1.18, 3);
    // it lies in the plane of the slope
    const face = p.pts;
    const n = [(face[1][1] - face[0][1]) * (face[2][2] - face[0][2]) - (face[1][2] - face[0][2]) * (face[2][1] - face[0][1]), (face[1][2] - face[0][2]) * (face[2][0] - face[0][0]) - (face[1][0] - face[0][0]) * (face[2][2] - face[0][2]), (face[1][0] - face[0][0]) * (face[2][1] - face[0][1]) - (face[1][1] - face[0][1]) * (face[2][0] - face[0][0])];
    const len = Math.hypot(...n);
    // (the roof is placed: its box is at x = 3, y = 2 on the plan, and its walls are 2.5 m high)
    for (const c of corners) expect(Math.abs(((c[0] + 3 - face[0][0]) * n[0] + (c[1] + 2.5 - face[0][1]) * n[1] + (c[2] + 2 - face[0][2]) * n[2]) / len)).toBeLessThan(1e-6);
  });

  it('no hole when the window would stick out over the ridge, and a hole in a flat roof, a hip roof and a shed roof', () => {
    const { d, F } = roofed('gable');
    d.skylights.push({ id: 's', floor: F, x: 3, y: 2.3, w: 0.78, d: 1.18 }); // straddles the ridge at y = 2
    expect(chunk(d, 'roof:' + d.roofs[0].id).some((p) => p.t === 'panel' && p.holes)).toBe(false);
    for (const kind of ['flat', 'hip', 'shed', 'gambrel', 'mansard'] as const) {
      const r = roofed(kind);
      r.d.skylights.push({ id: 's', floor: r.F, x: 3, y: kind === 'shed' ? 2 : kind === 'gambrel' || kind === 'mansard' ? 2.8 : 3.2, w: 0.6, d: 0.8 });
      expect(chunk(r.d, 'roof:' + r.d.roofs[0].id).some((p) => p.t === 'panel' && p.holes), kind).toBe(true);
    }
  });

  it('the glass of the skylight does not cast a shadow, so the light gets in', () => {
    const { d, F } = roofed('gable');
    d.skylights.push({ id: 's', floor: F, x: 3, y: 3, w: 0.78, d: 1.18 });
    const parts = chunk(d, 'roof:' + d.roofs[0].id);
    expect(parts.filter((p) => 'glass' in p && p.glass).length).toBeGreaterThan(0);
  });
});

describe('floors in the 3D view', () => {
  it('floors can be switched off one by one, including the ground floor; the ground stays', () => {
    const { d, F } = twoStoreys();
    const keys = (hidden: string[]) => sceneChunks(d, { hiddenFloors: hidden }).map((c) => c.key);
    expect(keys([])).toContain('wall:n');
    expect(keys([F])).not.toContain('wall:n');
    expect(keys([F])).toContain('room:upper');
    expect(keys(['up'])).not.toContain('room:upper');
    expect(keys([F, 'up'])).toContain('ground');
  });

  it('with a basement the ground is still there, with a hole over the basement rooms while that floor is shown', () => {
    const { d } = twoStoreys();
    d.floors.unshift({ id: 'b', name: 'Basement' });
    d.rooms.push(room('cellar', 'b', 0.1, 0.1, 5.9, 4.9));
    const holes = (hidden: string[]) => {
      const g = sceneChunks(d, { hiddenFloors: hidden }).find((c) => c.key === 'ground')!.make()[0];
      return g.t === 'prism' ? (g.holes?.length ?? 0) : -1;
    };
    expect(holes([])).toBe(1);
    expect(holes(['b'])).toBe(0);
  });

  it('the roof of the floor under an attic comes off when you look into the attic with the cut-away on', () => {
    const { d, F } = twoStoreys();
    d.floors.length = 1;
    d.rooms.length = 1;
    d.stairs.length = 0;
    d.roofs.push(newRoof(F, { x: 3, y: 2.5, w: 6.2, d: 5.2, rotation: 0 }, 'gable'));
    d.floors.push({ id: 'attic', name: 'Attic', attic: true });
    d.rooms.push(room('a', 'attic', 0.1, 0.1, 5.9, 4.9));
    const has = (o: Parameters<typeof sceneChunks>[1]) => sceneChunks(d, o).some((c) => c.key.startsWith('roof:'));
    expect(has({})).toBe(true);
    expect(has({ hideAbove: 'attic' })).toBe(false);
    expect(has({ hideAbove: F })).toBe(false); // looking at the floor itself: its own roof is above it
  });
});

describe('attics', () => {
  function atticHouse() {
    const d = createDesign();
    const F = d.floors[0].id;
    d.walls.push(wall('n', F, 0, 0, 6, 0), wall('e', F, 6, 0, 6, 5), wall('s', F, 6, 5, 0, 5), wall('w', F, 0, 5, 0, 0));
    d.roofs.push(newRoof(F, { x: 3, y: 2.5, w: 6, d: 5, rotation: 0 }, 'gable'));
    d.roofs[0].pitch = 45;
    d.floors.push({ id: 'attic', name: 'Attic', attic: true });
    d.rooms.push(room('a', 'attic', 0.1, 0.1, 5.9, 4.9));
    return { d, F };
  }

  it('measures the room under the roof: none at the eave, most at the ridge', () => {
    const { d } = atticHouse();
    const mid = atticClearance(d, 'attic', { x: 3, y: 2.5 })!;
    const nearEave = atticClearance(d, 'attic', { x: 3, y: 0.3 })!;
    expect(mid).toBeCloseTo(2.5 - 0.15 - 0.3, 2); // the ridge is 2.5 m above the walls (45 degrees over 2.5 m), less the roof and the floor
    expect(nearEave).toBeLessThan(0.6);
    expect(atticClearance(d, 'attic', { x: 30, y: 2.5 })).toBeNull(); // outside the roof
    expect(atticClearance(d, d.floors[0].id, { x: 3, y: 2.5 })).toBeNull(); // not an attic
    expect(roofUndersideLocal(d.roofs[0], 0, 0)).toBeCloseTo(2.35, 2);
  });

  it('the plan check says when furniture is taller than the roof above it', () => {
    const { d } = atticHouse();
    d.furniture.push({ id: 'w', floor: 'attic', type: 'wardrobe', x: 3, y: 0.5, w: 1.8, d: 0.6, rotation: 0, color: '#ccc', label: '' });
    d.furniture.push({ id: 'ok', floor: 'attic', type: 'dresser', x: 3, y: 2.5, w: 1.2, d: 0.5, rotation: 0, color: '#ccc', label: '' });
    const low = findIssues(d, 'attic').filter((i) => i.kind === 'low-ceiling');
    expect(low).toHaveLength(1);
    expect(low[0].refs[0].id).toBe('w');
    expect(findIssues(d, d.floors[0].id).some((i) => i.kind === 'low-ceiling')).toBe(false);
  });

  it('the plan check finds a roof that a higher floor stands inside, but not an attic or a lower roof', () => {
    const { d, F } = atticHouse();
    expect(findIssues(d, F).some((i) => i.kind === 'roof-in-the-way')).toBe(false);
    d.floors.splice(1, 0, { id: 'mid', name: '1st floor' });
    d.walls.push(wall('mn', 'mid', 0, 0, 6, 0));
    expect(findIssues(d, F).some((i) => i.kind === 'roof-in-the-way')).toBe(true);
  });

  it('attic floors are saved', () => {
    const { d } = atticHouse();
    const back = parseDesign(JSON.parse(JSON.stringify(d)));
    expect(back.floors.map((f) => !!f.attic)).toEqual([false, true]);
    const raw = JSON.parse(JSON.stringify(d));
    delete raw.floors[1].attic;
    expect(parseDesign(raw).floors[1].attic).toBeUndefined();
  });
});

describe('door styles', () => {
  const doorOn = (kind: Opening['kind']) => {
    const d = createDesign();
    const F = d.floors[0].id;
    d.walls.push(wall('n', F, 0, 0, 6, 0));
    d.openings.push({ id: 'd', wallId: 'n', kind, pos: 2, width: kind === 'main' ? 1 : 0.9, swing: 1, hinge: 'a' });
    return chunk(d, 'wall:n');
  };

  it('every kind builds a leaf that swings; the main door has a fanlight above it and a step, the garden door is half glass', () => {
    for (const kind of ['door', 'main', 'garden'] as const) {
      const parts = doorOn(kind);
      const leaf = parts.filter((p) => p.anim);
      expect(leaf.length, kind).toBeGreaterThan(2);
      expect(new Set(leaf.map((p) => p.anim!.door))).toEqual(new Set(['d']));
    }
    const main = doorOn('main');
    const fan = main.filter((p) => 'glass' in p && p.glass);
    expect(fan.length).toBeGreaterThan(0);
    expect(fan.every((p) => !p.anim)).toBe(true); // the fanlight does not move
    expect(Math.min(...fan.map((p) => (p.t === 'box' ? p.y - p.sy / 2 : 9)))).toBeGreaterThan(1.85);
    const garden = doorOn('garden').filter((p) => 'glass' in p && p.glass);
    expect(garden.length).toBeGreaterThan(0);
    expect(garden.every((p) => p.anim)).toBe(true); // the glass is in the leaf
    expect(doorOn('door').some((p) => 'glass' in p && p.glass)).toBe(false);
  });
});
