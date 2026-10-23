import { describe, expect, it } from 'vitest';
import { produce } from 'immer';
import { createDesign, type Design, type ItemRef } from './model';
import {
  alignRefs,
  clipboardBounds,
  clipboardSize,
  copyRefs,
  distributeRefs,
  itemBounds,
  moveFromBase,
  pasteClipboard,
  refsInRect,
  removeRefs,
  rotateAbout,
  selectableRefs,
} from './selection';

function scene() {
  const d = createDesign();
  const F = d.floors[0].id;
  d.walls.push({ id: 'w1', floor: F, a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, thickness: 0.2, type: 'interior', height: 2.5 });
  d.walls.push({ id: 'w2', floor: F, a: { x: 4, y: 0 }, b: { x: 4, y: 3 }, thickness: 0.2, type: 'interior', height: 2.5 });
  d.openings.push({ id: 'o1', wallId: 'w1', kind: 'door', pos: 2, width: 0.9, swing: 1, hinge: 'a' });
  d.furniture.push({ id: 'a', floor: F, type: 'chair', x: 1, y: 5, w: 0.5, d: 0.5, rotation: 0, color: '#fff', label: '' });
  d.furniture.push({ id: 'b', floor: F, type: 'chair', x: 3, y: 6, w: 1, d: 0.5, rotation: 0, color: '#fff', label: '' });
  d.furniture.push({ id: 'c', floor: F, type: 'chair', x: 8, y: 5.5, w: 0.5, d: 1, rotation: 90, color: '#fff', label: '' });
  d.labels.push({ id: 'l', floor: F, text: 'Hi', x: 6, y: 2, size: 0.25, rotation: 0, color: '#000' });
  return { d, F };
}
const ref = (kind: ItemRef['kind'], id: string): ItemRef => ({ kind, id });

describe('bounds', () => {
  it('uses the rotated outline of furniture', () => {
    const { d } = scene();
    expect(itemBounds(d, ref('furniture', 'a'))).toEqual({ minX: 0.75, maxX: 1.25, minY: 4.75, maxY: 5.25 });
    const c = itemBounds(d, ref('furniture', 'c'))!; // 0.5 x 1 rotated by 90 deg is 1 x 0.5
    expect(c.maxX - c.minX).toBeCloseTo(1);
    expect(c.maxY - c.minY).toBeCloseTo(0.5);
  });
  it('wall bounds include the thickness', () => {
    const { d } = scene();
    const b = itemBounds(d, ref('wall', 'w1'))!;
    expect(b.minX).toBeCloseTo(-0.1);
    expect(b.maxX).toBeCloseTo(4.1);
    expect(b.minY).toBeCloseTo(-0.1);
    expect(b.maxY).toBeCloseTo(0.1);
    expect(itemBounds(d, ref('opening', 'o1'))).toBeNull();
  });
});

describe('selecting', () => {
  it('select-all and box selection only offer visible, unlocked items of the floor', () => {
    const { d, F } = scene();
    expect(selectableRefs(d, F)).toHaveLength(6);
    const locked = produce(d, (x) => void (x.layers.structure.locked = true));
    expect(selectableRefs(locked, F).some((r) => r.kind === 'wall')).toBe(false);
    const hidden = produce(d, (x) => void (x.layers.furniture.visible = false));
    expect(selectableRefs(hidden, F).some((r) => r.kind === 'furniture')).toBe(false);
    expect(selectableRefs(d, 'another-floor')).toHaveLength(0);
    // a box that touches the two chairs on the left only
    const hit = refsInRect(d, F, { minX: 0, minY: 4, maxX: 4, maxY: 7 }).map((r) => r.id).sort();
    expect(hit).toEqual(['a', 'b']);
  });
});

describe('moving, rotating, aligning', () => {
  it('moves from the original positions, so repeated moves never drift; walls keep their openings', () => {
    const { d } = scene();
    const refs = [ref('wall', 'w1'), ref('furniture', 'a')];
    let cur = d;
    for (let i = 1; i <= 7; i++) cur = produce(cur, (x) => refs.forEach((r) => moveFromBase(x, d, r, 0.1 * i, 0)));
    expect(cur.furniture[0].x).toBeCloseTo(1.7, 10);
    expect(cur.walls[0].a.x).toBeCloseTo(0.7, 10);
    expect(cur.walls[0].b.x).toBeCloseTo(4.7, 10);
    expect(cur.openings[0].wallId).toBe('w1');
    expect(cur.furniture[1].x).toBe(3); // untouched
  });

  it('rotates a group 90 degrees about a point, including each item\'s own rotation', () => {
    const { d } = scene();
    const out = produce(d, (x) => {
      rotateAbout(x, ref('furniture', 'a'), 90, { x: 0, y: 5 });
      rotateAbout(x, ref('wall', 'w1'), 90, { x: 0, y: 0 });
    });
    expect(out.furniture[0].x).toBeCloseTo(0, 9);
    expect(out.furniture[0].y).toBeCloseTo(6, 9);
    expect(out.furniture[0].rotation).toBe(90);
    expect(out.walls[0].b.x).toBeCloseTo(0, 9);
    expect(out.walls[0].b.y).toBeCloseTo(4, 9);
  });

  it('aligns to the selection edges and centers', () => {
    const { d } = scene();
    const refs = [ref('furniture', 'a'), ref('furniture', 'b'), ref('furniture', 'c')];
    const left = produce(d, (x) => alignRefs(x, refs, 'left'));
    const lefts = left.furniture.map((f) => itemBounds(left, ref('furniture', f.id))!.minX);
    expect(lefts.every((v) => Math.abs(v - 0.75) < 1e-9)).toBe(true);
    const middle = produce(d, (x) => alignRefs(x, refs, 'middle'));
    const cy = middle.furniture.map((f) => f.y);
    expect(cy.every((v) => Math.abs(v - cy[0]) < 1e-9)).toBe(true);
    const top = produce(d, (x) => alignRefs(x, refs, 'top'));
    expect(Math.min(...top.furniture.map((f) => itemBounds(top, ref('furniture', f.id))!.minY))).toBeCloseTo(4.75);
    // one item cannot be aligned to itself
    expect(produce(d, (x) => alignRefs(x, [refs[0]], 'right'))).toBe(d);
  });

  it('distributes with equal gaps and keeps the outer two in place', () => {
    const { d } = scene();
    const refs = [ref('furniture', 'a'), ref('furniture', 'b'), ref('furniture', 'c')];
    const out = produce(d, (x) => distributeRefs(x, refs, 'x'));
    const bs = ['a', 'b', 'c'].map((id) => itemBounds(out, ref('furniture', id))!);
    expect(bs[0].minX).toBeCloseTo(0.75);
    expect(bs[2].maxX).toBeCloseTo(itemBounds(d, ref('furniture', 'c'))!.maxX);
    expect(bs[1].minX - bs[0].maxX).toBeCloseTo(bs[2].minX - bs[1].maxX, 9);
  });
});

describe('copy, paste, delete', () => {
  it('pastes copies with fresh ids on the target floor, remapping door and window ownership', () => {
    const { d } = scene();
    const clip = copyRefs(d, [ref('wall', 'w1'), ref('furniture', 'a'), ref('label', 'l')]);
    expect(clipboardSize(clip)).toBe(3);
    expect(clip.openings).toHaveLength(1); // the door travels with its wall
    expect(clipboardBounds(clip)).not.toBeNull();

    let added: ItemRef[] = [];
    const out = produce(d, (x) => {
      x.floors.push({ id: 'up', name: '1st floor' });
      added = pasteClipboard(x, clip, 1, 2, 'up');
    });
    expect(added).toHaveLength(3);
    const w = out.walls.find((x) => x.floor === 'up')!;
    expect(w.id).not.toBe('w1');
    expect(w.a).toEqual({ x: 1, y: 2 });
    const o = out.openings.find((x) => x.wallId === w.id)!;
    expect(o.id).not.toBe('o1');
    expect(out.furniture.filter((f) => f.floor === 'up')[0]).toMatchObject({ x: 2, y: 7 });
    expect(out.walls).toHaveLength(3);
    // the original is untouched
    expect(out.walls[0].a).toEqual({ x: 0, y: 0 });
    // pasting twice makes two independent copies
    const twice = produce(out, (x) => void pasteClipboard(x, clip, 0.5, 0.5, 'up'));
    expect(new Set(twice.walls.map((x) => x.id)).size).toBe(twice.walls.length);
  });

  it('brings custom furniture definitions along', () => {
    const { d, F } = scene();
    const withCustom = produce(d, (x) => {
      x.custom.push({ id: 'k', label: 'Shelf', w: 1, d: 0.3, height: 2, color: '#ccc', shape: 'rect' });
      x.furniture.push({ id: 'cf', floor: F, type: 'custom:k', x: 0, y: 0, w: 1, d: 0.3, rotation: 0, color: '#ccc', label: '' });
    });
    const clip = copyRefs(withCustom, [ref('furniture', 'cf')]);
    expect(clip.custom).toHaveLength(1);
    const other: Design = createDesign();
    const pasted = produce(other, (x) => void pasteClipboard(x, clip, 0, 0, other.floors[0].id));
    expect(pasted.custom[0].id).toBe('k');
    // pasting into a design that already has it does not duplicate the definition
    expect(produce(pasted, (x) => void pasteClipboard(x, clip, 0, 0, other.floors[0].id)).custom).toHaveLength(1);
  });

  it('deletes several items at once; deleting a wall deletes its doors', () => {
    const { d } = scene();
    const out = produce(d, (x) => removeRefs(x, [ref('wall', 'w1'), ref('furniture', 'a'), ref('furniture', 'b')]));
    expect(out.walls.map((w) => w.id)).toEqual(['w2']);
    expect(out.openings).toHaveLength(0);
    expect(out.furniture.map((f) => f.id)).toEqual(['c']);
  });
});
