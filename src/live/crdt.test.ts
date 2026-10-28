import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { produce } from 'immer';
import { createDesign, parseDesign, type Design, type Furniture, type Wall } from '../model';
import { LOCAL, SEED, designTypes, hasDesign, readDesign, writeChange } from './crdt';

const wall = (id: string, floor: string, x = 0): Wall => ({ id, floor, a: { x, y: 0 }, b: { x: x + 3, y: 0 }, thickness: 0.15, type: 'interior', height: 2.5 });
const sofa = (id: string, floor: string, x = 1): Furniture => ({ id, floor, type: 'sofa', x, y: 1, w: 2, d: 1, rotation: 0, color: '#cbd5e1', label: '' });

/** Two people with their own document, connected by copying updates (as the network would). */
function pair() {
  const a = new Y.Doc();
  const b = new Y.Doc();
  let online = true;
  a.on('update', (u: Uint8Array, origin: unknown) => online && origin !== 'net' && Y.applyUpdate(b, u, 'net'));
  b.on('update', (u: Uint8Array, origin: unknown) => online && origin !== 'net' && Y.applyUpdate(a, u, 'net'));
  return {
    a,
    b,
    offline: () => (online = false),
    reconnect: () => {
      online = true;
      Y.applyUpdate(b, Y.encodeStateAsUpdate(a), 'net');
      Y.applyUpdate(a, Y.encodeStateAsUpdate(b), 'net');
    },
  };
}

function start() {
  const base = createDesign();
  const F = base.floors[0].id;
  const d = produce(base, (x) => {
    x.walls.push(wall('w1', F), wall('w2', F, 5));
    x.furniture.push(sofa('s1', F));
  });
  const p = pair();
  writeChange(p.a, null, d, SEED);
  return { ...p, d, F };
}

const edit = (doc: Y.Doc, prev: Design, recipe: (d: Design) => void) => {
  const next = produce(prev, recipe);
  writeChange(doc, prev, next, LOCAL);
  return next;
};

describe('design <-> Yjs document', () => {
  it('round-trips a design through the document', () => {
    const { a, d } = start();
    expect(hasDesign(a)).toBe(true);
    expect(readDesign(a, null)).toEqual(parseDesign(d));
  });

  it('is empty until a design is written', () => {
    expect(hasDesign(new Y.Doc())).toBe(false);
    expect(readDesign(new Y.Doc(), null)).toBeNull();
  });

  it('syncs saved 3D views and section lines, and a rename of one reaches the other person', () => {
    const { a, b, d } = start();
    const next = edit(a, d, (x) => {
      x.views.push({ id: 'v1', name: 'Front', pos: [20, 6, 18], target: [4, 1, 3] });
      x.sections.push({ id: 's1', name: 'A', a: { x: 4.5, y: -1 }, b: { x: 4.5, y: 7 } });
    });
    expect(readDesign(b, null)!.views).toEqual(next.views);
    expect(readDesign(b, null)!.sections).toEqual(next.sections);
    edit(b, readDesign(b, null)!, (x) => {
      x.views[0].name = 'From the street';
      x.sections[0].flip = true;
    });
    expect(readDesign(a, null)!.views[0]).toEqual({ id: 'v1', name: 'From the street', pos: [20, 6, 18], target: [4, 1, 3] });
    expect(readDesign(a, null)!.sections[0].flip).toBe(true);
  });

  it('syncs the plan style, and going back to the plain colour plan removes it for the other person too', () => {
    const { a, b, d } = start();
    const next = edit(a, d, (x) => void (x.style = { preset: 'blueprint', lines: 'heavy' }));
    expect(readDesign(b, null)!.style).toEqual({ preset: 'blueprint', lines: 'heavy' });
    edit(a, next, (x) => void delete x.style);
    expect(readDesign(b, null)!.style).toBeUndefined();
  });

  it('shows the same design to the other person', () => {
    const { a, b } = start();
    expect(readDesign(b, null)).toEqual(readDesign(a, null));
  });

  it('writes only what changed: moving one sofa touches one item', () => {
    const { a, d } = start();
    const events: string[] = [];
    a.on('afterTransaction', (t: Y.Transaction) => t.changed.forEach((_set, type) => type instanceof Y.Map && events.push(String((type as Y.Map<unknown>).get('id') ?? 'list'))));
    edit(a, d, (x) => void (x.furniture[0].x = 2.5));
    expect(events).toEqual(['s1']);
  });

  it('merges edits to different fields of the same item', () => {
    const { a, b, d } = start();
    const db = readDesign(b, null)!;
    edit(a, d, (x) => void (x.furniture[0].x = 4));
    edit(b, db, (x) => void (x.furniture[0].color = '#ff0000'));
    const merged = readDesign(a, null)!;
    expect(merged.furniture[0]).toMatchObject({ x: 4, color: '#ff0000' });
    expect(readDesign(b, null)).toEqual(merged);
  });

  it('gives both people the same result when they change the same field at once', () => {
    const { a, b, d, offline, reconnect } = start();
    const db = readDesign(b, null)!;
    offline();
    edit(a, d, (x) => void (x.furniture[0].x = 4));
    edit(b, db, (x) => void (x.furniture[0].x = 7));
    reconnect();
    const ra = readDesign(a, null)!;
    expect(readDesign(b, null)).toEqual(ra);
    expect([4, 7]).toContain(ra.furniture[0].x);
  });

  it('keeps an item deleted by one person deleted even when the other edited it', () => {
    const { a, b, d, offline, reconnect } = start();
    const db = readDesign(b, null)!;
    offline();
    edit(a, d, (x) => void (x.furniture = []));
    edit(b, db, (x) => void (x.furniture[0].x = 9));
    reconnect();
    // the deleted item's map is gone; what is left of the concurrent edit is not an item (no id) and is dropped
    expect(readDesign(a, null)!.furniture).toEqual([]);
    expect(readDesign(b, null)).toEqual(readDesign(a, null));
  });

  it('adds items from both people in the same order everywhere', () => {
    const { a, b, d, F, offline, reconnect } = start();
    const db = readDesign(b, null)!;
    offline();
    edit(a, d, (x) => void x.walls.push(wall('wa', F, 20)));
    edit(b, db, (x) => void x.walls.push(wall('wb', F, 30)));
    reconnect();
    const ids = (doc: Y.Doc) => readDesign(doc, null)!.walls.map((w) => w.id);
    expect(ids(a)).toEqual(ids(b));
    expect(ids(a)).toHaveLength(4);
    expect(ids(a).slice(0, 2)).toEqual(['w1', 'w2']);
  });

  it('keeps a new item between its neighbours (a floor inserted above the ground floor)', () => {
    const { a, d } = start();
    const withTop = edit(a, d, (x) => void x.floors.push({ id: 'top', name: 'Roof' }));
    edit(a, withTop, (x) => void x.floors.splice(1, 0, { id: 'mid', name: '1st floor' }));
    expect(readDesign(a, null)!.floors.map((f) => f.id)).toEqual([d.floors[0].id, 'mid', 'top']);
  });

  it('syncs settings and layer switches, and removed optional fields', () => {
    const { a, b, d } = start();
    const d2 = edit(a, d, (x) => {
      x.layers.furniture.locked = true;
      x.site.north = 40;
      x.name = 'Our house';
      x.walls[0].bulge = 0.5;
    });
    expect(readDesign(b, null)).toMatchObject({ name: 'Our house', site: { north: 40 }, layers: { furniture: { locked: true } } });
    expect(readDesign(b, null)!.walls[0].bulge).toBe(0.5);
    edit(a, d2, (x) => void delete x.walls[0].bulge);
    expect(readDesign(b, null)!.walls[0].bulge).toBeUndefined();
  });

  it('drops a door whose wall was deleted by the other person', () => {
    const { a, b, d, offline, reconnect } = start();
    const db = readDesign(b, null)!;
    offline();
    edit(a, d, (x) => void (x.walls = x.walls.filter((w) => w.id !== 'w1')));
    edit(b, db, (x) => void x.openings.push({ id: 'o1', wallId: 'w1', kind: 'door', pos: 1, width: 0.9, swing: 1, hinge: 'a' }));
    reconnect();
    const merged = readDesign(a, null)!;
    expect(merged.walls.map((w) => w.id)).toEqual(['w2']);
    expect(merged.openings).toEqual([]);
  });

  it('reuses unchanged objects so only changed items are redrawn', () => {
    const { a, d } = start();
    const first = readDesign(a, null)!;
    edit(a, d, (x) => void (x.furniture[0].x = 3));
    const second = readDesign(a, first)!;
    expect(second.walls).toBe(first.walls);
    expect(second.walls[0]).toBe(first.walls[0]);
    expect(second.furniture[0]).not.toBe(first.furniture[0]);
    expect(readDesign(a, second)).toBe(second);
  });

  it('ignores junk from outside: an item with impossible values is repaired like any imported file', () => {
    const { a } = start();
    const m = new Y.Map<unknown>();
    a.getMap<Y.Map<unknown>>('c:walls').set('bad', m);
    m.set('id', 'bad');
    m.set('thickness', 9999);
    m.set('__o', 99);
    const d = readDesign(a, null)!;
    expect(d.walls.find((w) => w.id === 'bad')!.thickness).toBeLessThanOrEqual(1);
  });
});

describe('undo only your own changes', () => {
  it('does not undo the other person', () => {
    const { a, b, d } = start();
    const um = new Y.UndoManager(designTypes(a), { trackedOrigins: new Set([LOCAL]), captureTimeout: 1e9 });
    const db = readDesign(b, null)!;
    um.stopCapturing();
    edit(a, d, (x) => void (x.furniture[0].x = 4)); // mine
    edit(b, db, (x) => void x.walls.push(wall('theirs', d.floors[0].id, 40))); // hers, arrives in my document
    um.undo();
    const now = readDesign(a, null)!;
    expect(now.furniture[0].x).toBe(1);
    expect(now.walls.map((w) => w.id)).toContain('theirs');
    um.redo();
    expect(readDesign(a, null)!.furniture[0].x).toBe(4);
  });

  it('makes a drag of many small writes a single undo step', () => {
    const { a, d } = start();
    const um = new Y.UndoManager(designTypes(a), { trackedOrigins: new Set([LOCAL]), captureTimeout: 1e9 });
    um.stopCapturing();
    let cur = d;
    for (const x of [1.5, 2, 2.5, 3]) cur = edit(a, cur, (n) => void (n.furniture[0].x = x));
    um.stopCapturing();
    cur = edit(a, cur, (n) => void (n.furniture[0].y = 5));
    um.undo();
    expect(readDesign(a, null)!.furniture[0]).toMatchObject({ x: 3, y: 1 });
    um.undo();
    expect(readDesign(a, null)!.furniture[0].x).toBe(1);
  });

  it('does not undo the first write that created the room', () => {
    const { a } = start();
    const um = new Y.UndoManager(designTypes(a), { trackedOrigins: new Set([LOCAL]), captureTimeout: 1e9 });
    um.undo();
    expect(hasDesign(a)).toBe(true);
  });
});
