import { describe, expect, it } from 'vitest';
import { faceSpan, wallCorners, wallLength, wallSegmentOutline } from './geometry';
import { createDesign, parseDesign, type Design, type Gate, type Stair, type Strip, type Wall } from './model';
import { gateGeometry, gateSpans, pathMarks, pointAtLength, polylineLength, projectOnPolyline, solidSpans } from './outdoor';
import { RAIL_INSET, flatProfile, guardRuns, railPaths, railProfile, spiralPole, stairColors, stairPlanFill, stairSteps, stairTopAt } from './stairs';
import { buildWalkWorld } from './walk';
import { WINDOW_KINDS, WINDOW_SPEC, windowMarks } from './windows';
import { floorElevations, furnitureChunk, railParts, sceneChunks, stairParts } from './view3d/build';
import { partsBounds, type Part } from './view3d/parts';

const stair = (kind: Stair['kind'], extra: Partial<Stair> = {}): Stair => ({ id: 's', floor: 'f', kind, x: 0, y: 0, w: kind === 'spiral' ? 1.8 : kind === 'straight' ? 1 : 2.4, d: kind === 'spiral' ? 1.8 : kind === 'straight' ? 4 : kind === 'l' ? 2.4 : 3, rotation: 0, steps: 16, rise: 2.8, flip: false, ...extra });

describe('stair rails follow the steps', () => {
  it('a rail is a straight slope from the first tread to the top, level on a landing, with a node at every step', () => {
    for (const kind of ['straight', 'l', 'u'] as const) {
      const s = stair(kind);
      const { a, b } = railPaths(s);
      for (const path of [a, b]) {
        const nodes = railProfile(s, path);
        expect(nodes.length, kind).toBeGreaterThan(8);
        expect(nodes[0].end && nodes[nodes.length - 1].end, kind).toBe(true);
        // heights never go down on the way up (the U comes back down only after its landing)
        const heights = nodes.map((n) => n.h);
        expect(Math.max(...heights), kind).toBeCloseTo(2.8, 2);
        if (kind !== 'u') expect(heights.every((h, i) => !i || h >= heights[i - 1] - 1e-9), kind).toBe(true);
        // the rail never lies outside the stair
        for (const n of nodes) {
          expect(n.x, kind).toBeGreaterThanOrEqual(0);
          expect(n.x, kind).toBeLessThanOrEqual(s.w);
          expect(n.y, kind).toBeGreaterThanOrEqual(0);
          expect(n.y, kind).toBeLessThanOrEqual(s.d);
        }
      }
    }
  });

  it('the slope touches the nosing of every step: no step sticks up through the rail line and none leaves a gap', () => {
    const s = stair('straight');
    const nodes = railProfile(s, railPaths(s).a);
    const steps = stairSteps(s);
    for (let i = 0; i + 1 < nodes.length; i++) {
      // halfway between two nodes the rail line is within one riser above the tread under it
      const mid = { x: (nodes[i].x + nodes[i + 1].x) / 2, y: (nodes[i].y + nodes[i + 1].y) / 2 };
      const line = (nodes[i].h + nodes[i + 1].h) / 2;
      const tread = stairTopAt(s, mid, 0, steps)!;
      expect(line - tread).toBeGreaterThanOrEqual(-1e-6);
      expect(line - tread).toBeLessThanOrEqual(2.8 / 16 + 1e-6);
    }
  });

  it('the rail stands inside the edge of the steps, not in their side', () => {
    const s = stair('straight');
    expect(railPaths(s).a[0].x).toBeCloseTo(RAIL_INSET);
    expect(railPaths(s).b[0].x).toBeCloseTo(1 - RAIL_INSET);
  });

  it('a spiral rail leaves the first and the last tread free so that you can step on and off', () => {
    const s = stair('spiral', { steps: 14 });
    const nodes = railProfile(s, railPaths(s).a);
    expect(nodes[0].h).toBeGreaterThan(2 * (2.8 / 14) - 1e-6); // starts at the second tread
    expect(nodes[nodes.length - 1].h).toBeLessThan(2.8 - 1e-6); // and stops before the last
  });

  it('guard edges join up into runs; a loop is one run', () => {
    expect(guardRuns(stair('straight'))).toHaveLength(1); // three sides, one run
    expect(guardRuns(stair('l')).length).toBeLessThanOrEqual(2);
    const spiral = guardRuns(stair('spiral'));
    expect(spiral).toHaveLength(1);
    expect(spiral[0].length).toBeGreaterThan(15);
    expect(flatProfile([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }], 2.8).map((n) => n.turn)).toEqual([false, true, false]);
  });
});

describe('stair construction, material and color', () => {
  it('the pole of a spiral stops at the floor above and is slim', () => {
    const s = stair('spiral');
    const pole = stairParts(s).find((p) => p.t === 'cyl')!;
    expect(pole.t === 'cyl' && pole.y + pole.h / 2).toBeCloseTo(2.8);
    expect(pole.t === 'cyl' && pole.r).toBeLessThanOrEqual(0.07);
    expect(spiralPole(1.8, 1.8)).toBeLessThanOrEqual(0.07);
  });

  it('solid stairs have blocks, open stairs have treads on beams, floating stairs have treads only', () => {
    const count = (parts: Part[], t: Part['t']) => parts.filter((p) => p.t === t).length;
    const solid = stairParts(stair('straight'));
    const open = stairParts(stair('straight', { build: 'open' }));
    const floating = stairParts(stair('straight', { build: 'floating' }));
    expect(count(solid, 'box')).toBe(16);
    expect(count(open, 'box')).toBe(0);
    expect(count(open, 'beam')).toBeGreaterThanOrEqual(2); // a beam under each side
    expect(count(floating, 'beam') + count(floating, 'box')).toBe(0);
    expect(count(floating, 'prism')).toBe(16);
    // every build reaches the full rise and stays inside the box
    for (const build of [undefined, 'open', 'floating'] as const) for (const kind of ['straight', 'l', 'u'] as const) {
      const b = partsBounds(stairParts(stair(kind, { build })));
      expect(b.maxY, `${kind} ${build}`).toBeCloseTo(2.8, 1);
      // (the bounds of a beam are a little generous: half its width past each end)
      expect(b.minX, `${kind} ${build}`).toBeGreaterThanOrEqual(-stair(kind).w / 2 - 0.03);
      expect(b.maxX, `${kind} ${build}`).toBeLessThanOrEqual(stair(kind).w / 2 + 0.03);
    }
  });

  it('the treads take the color of the material, or the color you chose', () => {
    expect(stairColors({}).tread).toBe('#e5e7eb');
    expect(stairColors({ material: 'darkwood' }).tread).toBe('#6b4a2f');
    expect(stairColors({ material: 'darkwood', color: '#ff0000' }).tread).toBe('#ff0000');
    const tread = (s: Stair) => stairParts(s).find((p) => p.t === 'prism')!;
    expect(tread(stair('straight', { color: '#123456' })).color).toBe('#123456');
    expect(tread(stair('straight', { material: 'wood' })).t === 'prism' && (tread(stair('straight', { material: 'wood' })) as { tex?: unknown }).tex).toBeTruthy();
    // glass treads are see-through, and a glass stair is never a solid block
    const glass = stairParts(stair('straight', { material: 'glass' }));
    expect(glass.some((p) => p.t === 'prism' && p.glass)).toBe(true);
    expect(glass.some((p) => p.t === 'box')).toBe(false);
    expect(stairPlanFill({})).toBe('#f8fafc');
    expect(stairPlanFill({ color: '#000000' })).not.toBe('#f8fafc');
  });

  it('every railing style, height and color builds, at the height asked for', () => {
    for (const style of ['wood', 'metal', 'bars', 'glass', 'cable', 'solid'] as const) for (const kind of ['straight', 'l', 'u', 'spiral'] as const) {
      const parts = railParts(stair(kind, { railing: { style, a: true, b: true } }), false);
      expect(parts.length, `${style} ${kind}`).toBeGreaterThan(5);
    }
    const top = (h?: number) => Math.max(...railParts(stair('straight', { railing: { style: 'metal', a: true, b: false, height: h } }), false).filter((p) => p.t === 'beam').map((p) => (p.t === 'beam' ? Math.max(p.a[1], p.b[1]) : 0)));
    expect(top(1.1) - top(0.9)).toBeCloseTo(0.2, 2);
    const colored = railParts(stair('straight', { railing: { style: 'wood', a: true, b: false, color: '#abcdef' } }), false);
    expect(colored.filter((p) => p.color === '#abcdef').length).toBeGreaterThan(10);
  });

  it('the guard rail can be switched off', () => {
    const on = railParts(stair('straight', { railing: { style: 'wood', a: false, b: false } }), true);
    const off = railParts(stair('straight', { railing: { style: 'wood', a: false, b: false, guard: false } }), true);
    expect(on.length).toBeGreaterThan(10);
    expect(off).toEqual([]);
  });

  it('stair settings are saved, repaired, and old stairs load unchanged', () => {
    const d = createDesign();
    d.stairs.push(stair('l', { floor: d.floors[0].id, build: 'open', material: 'stone', color: '#112233', bodyColor: '#445566', railing: { style: 'bars', a: true, b: false, guard: false, height: 1.05, color: '#778899' } }));
    const back = parseDesign(JSON.parse(JSON.stringify(d))).stairs[0];
    expect(back).toMatchObject({ build: 'open', material: 'stone', color: '#112233', bodyColor: '#445566', railing: { style: 'bars', a: true, b: false, guard: false, height: 1.05, color: '#778899' } });
    const raw = JSON.parse(JSON.stringify(d));
    Object.assign(raw.stairs[0], { build: 'weird', material: 'gold', color: 'red', bodyColor: 12 });
    raw.stairs[0].railing = { style: 'wood', height: 'tall', color: 'blue' };
    const fixed = parseDesign(raw).stairs[0];
    expect(fixed.build).toBeUndefined();
    expect(fixed.material).toBeUndefined();
    expect(fixed.color).toBeUndefined();
    expect(fixed.railing).toEqual({ style: 'wood', a: true, b: true });
  });
});

describe('walking past railings', () => {
  const room = (floor: string, x0: number, y0: number, x1: number, y1: number) => ({ id: floor, floor, name: floor, color: '#eee', material: 'plain' as const, living: true, points: [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }] });
  const twoStoreys = (kind: Stair['kind']) => {
    const d = createDesign();
    const F = d.floors[0].id;
    d.floors.push({ id: 'up', name: 'Up' });
    d.rooms.push(room(F, -3, -3, 3, 3), room('up', -3, -3, 3, 3));
    d.stairs.push(stair(kind, { floor: F, railing: { style: 'metal', a: true, b: true } }));
    return d;
  };
  const world = (d: Design) => buildWalkWorld(d, new Set(), floorElevations(d));

  it('you can step off the top of a spiral stair onto the floor above (the rail does not close the exit)', () => {
    const d = twoStoreys('spiral');
    const w = world(d);
    // the last tread ends at the top of the circle; from there walk straight out
    const y = 2.8;
    let x = 0;
    let z = -0.55;
    for (let i = 0; i < 60; i++) {
      const r = w.move(x, z, y, 0, -0.03);
      x = r.x;
      z = r.z;
    }
    expect(z).toBeLessThan(-1.7); // well outside the 0.9 m radius of the stair
  });

  it('a rail does not stop you at a height it is not at: walking under the high end of a stair rail on the ground floor', () => {
    const d = twoStoreys('straight');
    const w = world(d);
    // standing on the floor (feet at 0) beside the stair at its top end, the rail up there is 2.8 m above you
    const r = w.move(-0.9, -1.9, 0.01, 0.8, 0);
    expect(r.x).toBeGreaterThan(-0.2);
  });

  it('rails still stop you where they are: sideways off a flight', () => {
    const d = twoStoreys('straight');
    const w = world(d);
    const heightHalf = 1.4; // standing on the middle of the flight
    const r = w.move(0, 0, heightHalf, 1.5, 0);
    expect(Math.abs(r.x)).toBeLessThan(0.5);
  });
});

describe('wall corners are mitred', () => {
  const W = (id: string, ax: number, ay: number, bx: number, by: number, t = 0.3): Wall => ({ id, floor: 'f', a: { x: ax, y: ay }, b: { x: bx, y: by }, thickness: t, type: 'exterior', height: 2.5 });

  it('a square corner needs no change: the outer faces meet where the walls already end', () => {
    const a = W('a', 0, 0, 5, 0);
    const b = W('b', 5, 0, 5, 4);
    const c = wallCorners(a, [a, b]);
    expect(c.b).toBeDefined();
    expect(c.b!.s).toBeCloseTo(5 + 0.15); // half a thickness past the end
    expect(c.b!.si).toBeCloseTo(5 - 0.15);
    expect(c.a).toBeUndefined();
  });

  it('an angled corner meets the other wall exactly: no notch outside and no ear sticking out', () => {
    const a = W('a', 0, 0, 5, 0);
    const b = W('b', 5, 0, 8, 3);
    const ca = wallCorners(a, [a, b]);
    const cb = wallCorners(b, [a, b]);
    const pa = wallSegmentOutline(a, -0.15, 5.15, ca);
    const pb = wallSegmentOutline(b, -0.15, wallLength(b) + 0.15, cb);
    // the two ends share the same two points (the mitre line), whichever way round
    const endA = [pa[1], pa[2]];
    const endB = [pb[0], pb[3]];
    for (const p of endA) expect(endB.some((q) => Math.hypot(p.x - q.x, p.y - q.y) < 1e-9)).toBe(true);
  });

  it('a turn, a T-junction and a dead end', () => {
    const a = W('a', 0, 0, 5, 0);
    const c = W('c', 5, 0, 10, 0); // straight on
    const t = W('t', 2, 0, 2, 3); // starts in the middle of a
    expect(wallCorners(a, [a, c])).toEqual({});
    expect(wallCorners(a, [a, t])).toEqual({});
    expect(wallCorners(a, [a])).toEqual({});
    // a face runs to the mitre at a corner and to the end cap at a free end
    const b = W('b', 5, 0, 5, 4);
    const corners = wallCorners(a, [a, b]);
    expect(faceSpan(a, 'l', -0.15, 5.15, {})).toEqual([-0.15, 5.15]);
    const [l0, l1] = faceSpan(a, corners.b!.side, -0.15, 5.15, corners);
    expect(l0).toBeCloseTo(-0.15);
    expect(l1).toBeCloseTo(corners.b!.s);
  });

  it('a painted corner in 3D has paint all the way round', () => {
    const d = createDesign();
    const F = d.floors[0].id;
    const skin = { finish: 'paint' as const, color: '#ff0000' };
    d.walls.push(
      { ...W('a', 0, 0, 5, 0), floor: F, paint: { l: skin, r: skin } },
      { ...W('b', 5, 0, 8, 3), floor: F, paint: { l: skin, r: skin } },
    );
    const make = (id: string) => sceneChunks(d).find((c) => c.key === `wall:${id}`)!.make();
    const skins = (id: string) => make(id).filter((p) => p.t === 'panel' && p.color === '#ff0000');
    expect(skins('a').length).toBeGreaterThanOrEqual(2);
    // the panels of wall a on its outer face run past its end point to the mitre (0.15 x tan 22.5° = 6 cm), the inner ones stop short of it
    const reach = (face: number) => Math.max(...skins('a').filter((p) => p.t === 'panel' && Math.abs(p.facing[2] - face) < 0.5).flatMap((p) => (p.t === 'panel' ? p.pts.map((q) => q[0]) : [])));
    expect(Math.max(reach(1), reach(-1))).toBeCloseTo(5 + 0.15 * Math.tan(Math.PI / 8), 2);
    expect(Math.min(reach(1), reach(-1))).toBeCloseTo(5 - 0.15 * Math.tan(Math.PI / 8), 2);
  });
});

describe('gable ends take the paint of the wall below', () => {
  it('a painted wall paints the triangle above it, outside and in', () => {
    const d = createDesign();
    const F = d.floors[0].id;
    const skin = { finish: 'brick' as const, color: '#b5603f' };
    const inner = { finish: 'paint' as const, color: '#112233' };
    const wall = (id: string, ax: number, ay: number, bx: number, by: number, extra: Partial<Wall> = {}): Wall => ({ id, floor: F, a: { x: ax, y: ay }, b: { x: bx, y: by }, thickness: 0.3, type: 'exterior', height: 2.5, ...extra });
    // clockwise: the right-hand face of the east wall looks into the house, the left-hand one looks out
    d.walls.push(wall('n', 0, 0, 6, 0), wall('e', 6, 0, 6, 4, { paint: { l: skin, r: inner } }), wall('s', 6, 4, 0, 4), wall('w', 0, 4, 0, 0));
    d.roofs.push({ id: 'roof', floor: F, kind: 'gable', x: 3, y: 2, w: 6.3, d: 4.3, rotation: 0, pitch: 35, overhang: 0.3, thickness: 0.15, material: 'tiles', color: '#b5523b', chimney: false, parapet: false });
    const parts = sceneChunks(d).find((c) => c.key === 'roof:roof')!.make();
    const gables = parts.filter((p) => p.t === 'panel' && p.facing[1] === 0);
    expect(gables.some((p) => p.color === '#b5603f' && p.t === 'panel' && !!p.tex)).toBe(true); // brick outside
    expect(gables.some((p) => p.color === '#112233')).toBe(true); // its own coat inside
  });
});

describe('windows', () => {
  it('every window kind has a spec, a plan symbol and builds in 3D with its glass above its sill', () => {
    const d = createDesign();
    const F = d.floors[0].id;
    d.walls.push({ id: 'w', floor: F, a: { x: 0, y: 0 }, b: { x: 12, y: 0 }, thickness: 0.3, type: 'exterior', height: 2.6 });
    WINDOW_KINDS.forEach((kind, i) => d.openings.push({ id: `o${i}`, wallId: 'w', kind, pos: 1.5 + i * 1.6, width: 1.2, swing: 1, hinge: 'a' }));
    const parts = sceneChunks(d).find((c) => c.key === 'wall:w')!.make();
    expect(parts.filter((p) => p.glass).length).toBeGreaterThan(WINDOW_KINDS.length);
    for (const kind of WINDOW_KINDS) {
      expect(WINDOW_SPEC[kind].label).toBeTruthy();
      expect(windowMarks(kind, 1.2, 0.3).fill).toBeTruthy();
    }
    // a high window's glass starts high, a floor-to-ceiling one at the floor
    const lowest = (i: number) => {
      const o = d.openings[i];
      const glass = parts.filter((p) => p.t === 'box' && p.glass && Math.abs(p.x - o.pos) < o.width / 2);
      return Math.min(...glass.map((p) => (p.t === 'box' ? p.y - p.sy / 2 : 9)));
    };
    expect(lowest(WINDOW_KINDS.indexOf('highwin'))).toBeGreaterThanOrEqual(1.65);
    expect(lowest(WINDOW_KINDS.indexOf('floorwin'))).toBeLessThan(0.1);
    expect(lowest(WINDOW_KINDS.indexOf('picture'))).toBeLessThan(0.7);
  });

  it('they are saved, and shut to walkers like any window', () => {
    const d = createDesign();
    const F = d.floors[0].id;
    d.walls.push({ id: 'w', floor: F, a: { x: 0, y: 0 }, b: { x: 6, y: 0 }, thickness: 0.2, type: 'exterior', height: 2.5 });
    d.openings.push({ id: 'o', wallId: 'w', kind: 'casement', pos: 3, width: 1.2, swing: 1, hinge: 'a' });
    expect(parseDesign(JSON.parse(JSON.stringify(d))).openings[0].kind).toBe('casement');
    const w = buildWalkWorld(d, new Set(['o']), floorElevations(d));
    expect(w.move(3, 1, 0.01, 0, -3).z).toBeGreaterThan(0.2);
  });
});

describe('fence gates', () => {
  const fence = (gates: Gate[]): Strip => ({ id: 'f', floor: 'f', kind: 'fence', width: 0.1, points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 6 }], gates });
  const gate = (id: string, pos: number, width = 1.2, extra: Partial<Gate> = {}): Gate => ({ id, pos, width, kind: 'single', swing: 1, hinge: 'a', ...extra });

  it('the fence is cut into solid parts round the gates', () => {
    const f = fence([gate('g', 5)]);
    const spans = solidSpans(f);
    expect(spans).toHaveLength(2);
    expect(spans[0][spans[0].length - 1].x).toBeCloseTo(4.4);
    expect(spans[1][0].x).toBeCloseTo(5.6);
    expect(polylineLength(f.points)).toBe(16);
    // a gate on the corner keeps the corner in the solid part after it
    const onCorner = solidSpans(fence([gate('g', 9)]));
    expect(onCorner[1].length).toBeGreaterThanOrEqual(2);
    // no gates: the whole line
    expect(solidSpans(fence([]))).toHaveLength(1);
  });

  it('overlapping or out-of-range gates are ignored, not drawn on top of each other', () => {
    const f = fence([gate('a', 5), gate('b', 5.5), gate('c', 15.9, 3)]);
    const ids = gateSpans(f).map((g) => g.gate.id);
    expect(ids).toContain('a');
    expect(ids).not.toContain('b');
    expect(gateSpans(f).every((g) => g.s1 <= 16 + 1e-9)).toBe(true);
  });

  it('a single gate swings from its hinge to the side it opens to; a double gate has two leaves; a sliding one rolls along', () => {
    const single = gateGeometry(fence([]), gate('g', 5, 1.2));
    expect(single.leaves).toHaveLength(1);
    expect(single.leaves[0].hinge.x).toBeCloseTo(4.4);
    expect(single.leaves[0].shut.x).toBeCloseTo(5.6);
    expect(Math.abs(single.leaves[0].open.x - 4.4)).toBeLessThan(1e-9);
    expect(single.leaves[0].open.y).toBeCloseTo(1.2); // swing 1: to the right of the way the line runs (down on the plan)
    const left = gateGeometry(fence([]), gate('g', 5, 1.2, { swing: -1 }));
    expect(left.leaves[0].open.y).toBeCloseTo(-1.2);
    const other = gateGeometry(fence([]), gate('g', 5, 1.2, { hinge: 'b' }));
    expect(other.leaves[0].hinge.x).toBeCloseTo(5.6);
    expect(gateGeometry(fence([]), gate('g', 5, 2, { kind: 'double' })).leaves).toHaveLength(2);
    const slide = gateGeometry(fence([]), gate('g', 5, 2, { kind: 'sliding' })).leaves[0];
    expect(slide.open.x).not.toBeCloseTo(slide.shut.x);
    expect(slide.open.y).toBeCloseTo(slide.shut.y);
  });

  it('points along a polyline, and the nearest point to a cursor', () => {
    const pts = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 6 }];
    expect(pointAtLength(pts, 12).p).toEqual({ x: 10, y: 2 });
    expect(pointAtLength(pts, 12).u).toEqual({ x: 0, y: 1 });
    const hit = projectOnPolyline(pts, { x: 4, y: 0.5 });
    expect(hit.s).toBeCloseTo(4);
    expect(hit.dist).toBeCloseTo(0.5);
    expect(hit.side).toBe(1); // below the line = to its right
    expect(projectOnPolyline(pts, { x: 4, y: -0.5 }).side).toBe(-1);
  });

  it('gates are saved with the design, only on fences and hedges, and repaired', () => {
    const d = createDesign();
    d.strips.push({ ...fence([gate('g', 5, 1.4, { kind: 'double', swing: -1, hinge: 'b' })]), floor: d.floors[0].id });
    const back = parseDesign(JSON.parse(JSON.stringify(d))).strips[0];
    expect(back.gates).toEqual([{ id: 'g', pos: 5, width: 1.4, kind: 'double', swing: -1, hinge: 'b' }]);
    const raw = JSON.parse(JSON.stringify(d));
    raw.strips[0].gates = [{ id: 'x', pos: 'far', width: 100, kind: 'portcullis', swing: 7, hinge: 'z' }];
    expect(parseDesign(raw).strips[0].gates).toEqual([{ id: 'x', pos: 1, width: 8, kind: 'single', swing: 1, hinge: 'a' }]);
    raw.strips[0].kind = 'road';
    expect(parseDesign(raw).strips[0].gates).toBeUndefined();
    delete raw.strips[0].gates;
    raw.strips[0].kind = 'fence';
    expect(parseDesign(raw).strips[0].gates).toBeUndefined();
  });

  it('a gate is a fence until it is opened; the 3D leaf opens like a door', () => {
    const d = createDesign();
    const F = d.floors[0].id;
    d.strips.push({ id: 'f', floor: F, kind: 'fence', width: 0.1, points: [{ x: 0, y: 0 }, { x: 10, y: 0 }], gates: [gate('g', 5)] });
    const shut = buildWalkWorld(d, new Set(), floorElevations(d));
    const open = buildWalkWorld(d, new Set(['g']), floorElevations(d));
    expect(shut.move(5, 2, 0.01, 0, -4).z).toBeGreaterThan(0.2);
    expect(open.move(5, 2, 0.01, 0, -4).z).toBeLessThan(-1);
    expect(shut.move(1, 2, 0.01, 0, -4).z).toBeGreaterThan(0.2); // the fence beside it stays shut
    const parts = sceneChunks(d).find((c) => c.key === 'strip:f')!.make();
    const leaves = parts.filter((p) => p.anim?.door === 'g');
    expect(leaves.length).toBeGreaterThan(5);
    expect(leaves.every((p) => p.anim!.kind === 'swing')).toBe(true);
    // a sliding gate slides
    d.strips[0].gates![0].kind = 'sliding';
    expect(sceneChunks(d).find((c) => c.key === 'strip:f')!.make().filter((p) => p.anim?.kind === 'slide').length).toBeGreaterThan(5);
  });
});

describe('garden paths', () => {
  const path = (surface: Strip['surface'], width = 1.2): Strip => ({ id: 'p', floor: 'f', kind: 'path', width, surface, points: [{ x: 0, y: 0 }, { x: 6, y: 0 }] });

  it('each surface marks itself: joints for slabs and bricks, boards along, stones apart, pebbles for gravel, nothing for plain', () => {
    expect(pathMarks(path(undefined))).toEqual([]);
    expect(pathMarks(path('plain'))).toEqual([]);
    const slabs = pathMarks(path('slabs'));
    expect(slabs.filter((m) => m.t === 'line')).toHaveLength(9); // every 60 cm
    expect(pathMarks(path('brick')).length).toBeGreaterThan(slabs.length);
    const boards = pathMarks(path('boards'));
    expect(boards.every((m) => m.t === 'line')).toBe(true);
    expect(boards.length).toBeGreaterThanOrEqual(7);
    const stones = pathMarks(path('stepping'));
    expect(stones.every((m) => m.t === 'stone')).toBe(true);
    expect(stones.length).toBeGreaterThanOrEqual(8);
    const gravel = pathMarks(path('gravel'));
    expect(gravel.length).toBeGreaterThan(30);
    expect(pathMarks(path('gravel'))).toEqual(gravel); // always the same pebbles
  });

  it('the surface is saved, only on footpaths', () => {
    const d = createDesign();
    d.strips.push({ ...path('stepping'), floor: d.floors[0].id });
    expect(parseDesign(JSON.parse(JSON.stringify(d))).strips[0].surface).toBe('stepping');
    const raw = JSON.parse(JSON.stringify(d));
    raw.strips[0].surface = 'lava';
    expect(parseDesign(raw).strips[0].surface).toBeUndefined();
    raw.strips[0].surface = 'gravel';
    raw.strips[0].kind = 'fence';
    expect(parseDesign(raw).strips[0].surface).toBeUndefined();
  });

  it('a path lies above a lawn in 3D, so that it can be seen', () => {
    const d = createDesign();
    const F = d.floors[0].id;
    d.strips.push({ ...path('slabs'), floor: F });
    const parts = sceneChunks(d).find((c) => c.key === 'strip:p')!.make();
    const top = Math.max(...parts.filter((p) => p.t === 'box').map((p) => (p.t === 'box' ? p.y + p.sy / 2 : 0)));
    expect(top).toBeGreaterThan(0.03 + 0.01); // lawns are 3 cm
  });
});

describe('garden furniture', () => {
  const d = createDesign();
  const F = d.floors[0].id;
  const parts = (type: string, w = 2, dd = 2) => furnitureChunk(d, { id: 'x', floor: F, type, x: 0, y: 0, w, d: dd, rotation: 0, color: '#d9c7b0', label: '' }, 0);

  it('every chair of the patio set has its back to the outside and faces the table', () => {
    const backs = parts('patio-set').filter((p) => p.t === 'box' && Math.abs(p.sy - 0.42) < 1e-6 && Math.abs(p.y - 0.69) < 1e-6);
    expect(backs).toHaveLength(4);
    // a chair stands 72 cm from the middle; its back is on the far side of it
    for (const b of backs) expect(Math.hypot(b.t === 'box' ? b.x : 0, b.t === 'box' ? b.z : 0)).toBeGreaterThan(0.85);
    const [north, south, west, east] = [(p: Part) => p.t === 'box' && p.z < -0.8, (p: Part) => p.t === 'box' && p.z > 0.8, (p: Part) => p.t === 'box' && p.x < -0.8, (p: Part) => p.t === 'box' && p.x > 0.8];
    expect([north, south, west, east].map((side) => backs.filter(side).length)).toEqual([1, 1, 1, 1]);
  });

  it('the hot tub is a round tub with a rim, water below the rim and a step, inside its box', () => {
    const tub = parts('hot-tub');
    const b = partsBounds(tub);
    expect(b.minX).toBeGreaterThanOrEqual(-1 - 1e-6);
    expect(b.maxX).toBeLessThanOrEqual(1 + 1e-6);
    expect(b.maxZ).toBeLessThanOrEqual(1 + 1e-6);
    expect(tub.some((p) => p.t === 'ring')).toBe(true); // the rim
    const water = tub.find((p) => p.t === 'cyl' && p.glass)!;
    const rim = tub.find((p) => p.t === 'ring')!;
    expect(water.t === 'cyl' && rim.t === 'ring' && water.y < rim.y).toBe(true);
    expect(tub.filter((p) => p.t === 'box').length).toBeGreaterThan(25); // wooden slats, the step, the control panel
  });
});
