import { describe, expect, it } from 'vitest';
import { createDesign, parseDesign, ROOF_KINDS, type Design, type Roof, type Wall } from './model';
import { faceNormal, fitRoofToWalls, roofBaseHeight, roofModel, roofPlan } from './roofs';

const base = { w: 10, d: 6, pitch: 35, overhang: 0.4, chimney: false, parapet: false };
const tan = (deg: number) => Math.tan((deg * Math.PI) / 180);
const ys = (m: ReturnType<typeof roofModel>) => m.faces.flatMap((f) => f.pts.map((p) => p[1]));

describe('roof shapes', () => {
  it('a gable roof rises to half the depth times the slope, with the eaves dropping below the wall top', () => {
    const m = roofModel({ ...base, kind: 'gable' });
    expect(m.height).toBeCloseTo(3 * tan(35));
    expect(Math.max(...ys(m))).toBeCloseTo(3 * tan(35));
    expect(Math.min(...ys(m))).toBeCloseTo(-0.4 * tan(35)); // the overhang follows the slope down
    expect(m.faces.filter((f) => f.kind === 'slope')).toHaveLength(2);
    expect(m.faces.filter((f) => f.kind === 'gable')).toHaveLength(2); // a triangle of wall at each end
    const xs = m.faces.filter((f) => f.kind === 'slope').flatMap((f) => f.pts.map((p) => p[0]));
    expect(Math.max(...xs)).toBeCloseTo(5.4);
    expect(Math.max(...m.faces.flatMap((f) => f.pts.map((p) => Math.abs(p[2]))))).toBeCloseTo(3.4);
  });

  it('a hip roof has a ridge as long as the difference of the sides, and no gable ends', () => {
    const m = roofModel({ ...base, kind: 'hip' });
    expect(m.faces.every((f) => f.kind === 'slope')).toBe(true);
    expect(m.faces).toHaveLength(4);
    const top = m.faces.flatMap((f) => f.pts).filter((p) => Math.abs(p[1] - m.height) < 1e-9);
    expect(Math.max(...top.map((p) => p[0])) - Math.min(...top.map((p) => p[0]))).toBeCloseTo(4); // 10 - 6
    expect(m.height).toBeCloseTo(3 * tan(35));
  });

  it('a hip roof on a square footprint is a pyramid, and on a deep footprint the ridge turns', () => {
    const square = roofModel({ ...base, w: 6, d: 6, kind: 'hip' });
    const tops = square.faces.flatMap((f) => f.pts).filter((p) => Math.abs(p[1] - square.height) < 1e-9);
    expect(new Set(tops.map((p) => `${p[0].toFixed(3)},${p[2].toFixed(3)}`)).size).toBe(1);
    const deep = roofModel({ ...base, w: 6, d: 10, kind: 'hip' });
    const top = deep.faces.flatMap((f) => f.pts).filter((p) => Math.abs(p[1] - deep.height) < 1e-9);
    expect(Math.max(...top.map((p) => p[2])) - Math.min(...top.map((p) => p[2]))).toBeCloseTo(4);
    expect(Math.max(...top.map((p) => p[0])) - Math.min(...top.map((p) => p[0]))).toBeCloseTo(0);
  });

  it('a shed roof is one slope, high at the back', () => {
    const m = roofModel({ ...base, kind: 'shed', pitch: 15 });
    expect(m.faces.filter((f) => f.kind === 'slope')).toHaveLength(1);
    expect(m.height).toBeCloseTo(6 * tan(15));
    const slope = m.faces.find((f) => f.kind === 'slope')!;
    expect(Math.max(...slope.pts.map((p) => p[1])) - Math.min(...slope.pts.map((p) => p[1]))).toBeGreaterThan(6 * tan(15));
  });

  it('flat roofs are level and can have a parapet', () => {
    const plain = roofModel({ ...base, kind: 'flat' });
    expect(new Set(ys(plain))).toEqual(new Set([0]));
    expect(plain.blocks).toHaveLength(0);
    const edged = roofModel({ ...base, kind: 'flat', parapet: true });
    expect(edged.blocks.filter((b) => b.kind === 'parapet')).toHaveLength(4);
    expect(edged.height).toBeCloseTo(0.4);
  });

  it('gambrel and mansard roofs are taller than a plain gable or hip at the same upper slope', () => {
    const gambrel = roofModel({ ...base, kind: 'gambrel', pitch: 20 });
    const gable = roofModel({ ...base, kind: 'gable', pitch: 20 });
    expect(gambrel.height).toBeGreaterThan(gable.height);
    expect(gambrel.faces.filter((f) => f.kind === 'slope')).toHaveLength(4);
    const mansard = roofModel({ ...base, kind: 'mansard', pitch: 20 });
    const hip = roofModel({ ...base, kind: 'hip', pitch: 20 });
    expect(mansard.height).toBeGreaterThan(hip.height);
    expect(mansard.faces.filter((f) => f.kind === 'slope').length).toBeGreaterThanOrEqual(8);
  });

  it('every face of every roof is flat (all corners on one plane) and not edge-on', () => {
    for (const kind of ROOF_KINDS) {
      for (const [w, d] of [[10, 6], [6, 10], [7, 7]]) {
        const m = roofModel({ ...base, w, d, kind, chimney: true });
        for (const f of m.faces) {
          const n = faceNormal(f.pts);
          expect(Math.hypot(...n), `${kind} normal`).toBeCloseTo(1);
          for (const p of f.pts) {
            const off = (p[0] - f.pts[0][0]) * n[0] + (p[1] - f.pts[0][1]) * n[1] + (p[2] - f.pts[0][2]) * n[2];
            expect(Math.abs(off), `${kind} ${w}x${d}`).toBeLessThan(1e-6);
          }
          if (f.kind === 'slope' && kind !== 'flat') expect(Math.abs(n[1]), kind).toBeGreaterThan(0.1);
        }
      }
    }
  });

  it('a chimney rises above the highest point', () => {
    const m = roofModel({ ...base, kind: 'gable', chimney: true });
    const stack = m.blocks.find((b) => b.kind === 'chimney')!;
    expect(stack.y1).toBeGreaterThan(m.height + 0.5);
    expect(stack.x0).toBeLessThan(0);
  });
});

describe('roof on the plan', () => {
  it('shows the outline with the overhang, the ridge and the hips', () => {
    const gable = roofPlan({ ...base, kind: 'gable' });
    expect(gable.outline.map((p) => p.x)).toEqual([-5.4, 5.4, 5.4, -5.4]);
    expect(gable.lines).toHaveLength(1);
    expect(roofPlan({ ...base, kind: 'hip' }).lines).toHaveLength(5); // ridge + four hips
    expect(roofPlan({ ...base, kind: 'flat' }).lines).toHaveLength(0);
    expect(roofPlan({ ...base, kind: 'shed' }).fall).not.toBeNull();
    expect(roofPlan({ ...base, kind: 'mansard' }).lines.length).toBeGreaterThan(8);
  });
});

const wall = (id: string, floor: string, a: number[], b: number[], type: Wall['type'] = 'exterior'): Wall => ({ id, floor, a: { x: a[0], y: a[1] }, b: { x: b[0], y: b[1] }, thickness: 0.3, type, height: 2.5 });
function houseAt(deg: number, w: number, h: number): { d: Design; F: string } {
  const d = createDesign();
  const F = d.floors[0].id;
  const c = Math.cos((deg * Math.PI) / 180);
  const s = Math.sin((deg * Math.PI) / 180);
  const P = (x: number, y: number) => [20 + x * c - y * s, 10 + x * s + y * c];
  d.walls.push(wall('a', F, P(0, 0), P(w, 0)), wall('b', F, P(w, 0), P(w, h)), wall('c', F, P(w, h), P(0, h)), wall('d', F, P(0, h), P(0, 0)));
  return { d, F };
}

describe('fitting a roof to the walls', () => {
  it('finds the box around a straight house, with the ridge along the long side', () => {
    const { d, F } = houseAt(0, 10, 6);
    const box = fitRoofToWalls(d, F)!;
    expect(box.w).toBeCloseTo(10.3);
    expect(box.d).toBeCloseTo(6.3);
    expect(box.rotation).toBeCloseTo(0);
    expect(box.x).toBeCloseTo(25);
    expect(box.y).toBeCloseTo(13);
    const tall = houseAt(0, 5, 9);
    const tallBox = fitRoofToWalls(tall.d, tall.F)!;
    expect(tallBox.w).toBeCloseTo(9.3);
    expect(tallBox.rotation).toBeCloseTo(90);
  });

  it('follows a house that is turned', () => {
    const { d, F } = houseAt(30, 10, 6);
    const box = fitRoofToWalls(d, F)!;
    expect(box.rotation).toBeCloseTo(30, 0);
    expect(box.w).toBeCloseTo(10.3, 1);
    expect(box.d).toBeCloseTo(6.3, 1);
  });

  it('is null for a floor without walls, and uses the walls of that floor only', () => {
    const { d, F } = houseAt(0, 10, 6);
    d.floors.push({ id: 'up', name: '1st' });
    expect(fitRoofToWalls(d, 'up')).toBeNull();
    d.walls.push(wall('u', 'up', [0, 0], [4, 0], 'interior'));
    expect(fitRoofToWalls(d, 'up')!.w).toBeCloseTo(4.3);
    expect(fitRoofToWalls(d, F)!.w).toBeCloseTo(10.3);
  });

  it('sits on the top of the tallest wall', () => {
    const { d, F } = houseAt(0, 10, 6);
    d.walls[0].height = 3.2;
    expect(roofBaseHeight(d, F)).toBe(3.2);
    expect(roofBaseHeight(d, 'nothing')).toBe(2.5);
  });
});

describe('roofs in saved designs', () => {
  it('designs from before roofs load with none, and a bad roof is repaired', () => {
    const old = JSON.parse(JSON.stringify(createDesign()));
    delete old.roofs;
    delete old.layers.roofs;
    const d = parseDesign(old);
    expect(d.roofs).toEqual([]);
    expect(d.layers.roofs).toEqual({ visible: true, locked: false });
    old.roofs = [{ id: 'r', kind: 'weird', x: 1, y: 2, w: -3, d: 'x', pitch: 500, material: 'gold', color: 'nope', floor: 'missing' }];
    const r = parseDesign(old).roofs[0] as Roof;
    expect(r.kind).toBe('gable');
    expect(r.w).toBeGreaterThanOrEqual(0.5);
    expect(r.pitch).toBeLessThanOrEqual(80);
    expect(r.material).toBe('tiles');
    expect(r.floor).toBe(old.floors[0].id);
    expect(r.chimney).toBe(false);
  });
});

describe('roofs as plan items', () => {
  it('can be selected, moved, rotated, copied, pasted and deleted like other items', async () => {
    const { produce } = await import('immer');
    const sel = await import('./selection');
    const { newRoof } = await import('./roofActions');
    const { d, F } = houseAt(0, 10, 6);
    const roof = newRoof(F, { x: 25, y: 13, w: 10.3, d: 6.3, rotation: 0 }, 'gable');
    d.roofs.push(roof);
    const ref = { kind: 'roof' as const, id: roof.id };
    // bounds include the overhang
    const b = sel.itemBounds(d, ref)!;
    expect(b.maxX - b.minX).toBeCloseTo(10.3 + 0.8);
    expect(sel.selectableRefs(d, F)).toContainEqual(ref);
    expect(d.layers[sel.layerOfRef(d, ref)]).toBeDefined();
    expect(sel.layerOfRef(d, ref)).toBe('roofs');
    const copy = sel.copyRefs(d, [ref]);
    expect(copy.roofs).toHaveLength(1);
    const pasted = produce(d, (draft) => void sel.pasteClipboard(draft, copy, 2, 1, F));
    expect(pasted.roofs).toHaveLength(2);
    expect(pasted.roofs[1]).toMatchObject({ x: 27, y: 14, kind: 'gable' });
    expect(pasted.roofs[1].id).not.toBe(roof.id);
    const turned = produce(d, (draft) => void sel.rotateAbout(draft, ref, 90, { x: 25, y: 13 }));
    expect(turned.roofs[0].rotation).toBe(90);
    const gone = produce(pasted, (draft) => void sel.removeRefs(draft, [ref]));
    expect(gone.roofs).toHaveLength(1);
    // an old clipboard without roofs still pastes
    const old = { ...copy } as Partial<typeof copy>;
    delete old.roofs;
    expect(() => produce(d, (draft) => void sel.pasteClipboard(draft, old as typeof copy, 0, 0, F))).not.toThrow();
  });
});
