import { describe, expect, it } from 'vitest';
import LZString from 'lz-string';
import { createDesign, parseDesign, serializeDesign, SCHEMA_VERSION, type Design } from './model';
import { decodeDesign, designFromHash, encodeDesign, fileNameFor, isEmptyDesign, parseDesignJson, sameContent, shareUrl } from './share';

function sample(): Design {
  const d = createDesign();
  const F = d.floors[0].id;
  d.name = 'Our flat';
  d.layers.structure.locked = true;
  d.walls.push({ id: 'w1', floor: F, a: { x: 0, y: 0 }, b: { x: 4.123, y: 0 }, thickness: 0.15, type: 'interior' as const, height: 2.5 });
  d.openings.push({ id: 'o1', wallId: 'w1', kind: 'door', pos: 1, width: 0.9, swing: -1, hinge: 'b' });
  d.rooms.push({ id: 'r1', floor: F, name: 'Küche ☕', color: '#e1efdc', material: 'plain' as const, living: true, points: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }], seed: { x: 1, y: 1 } });
  d.furniture.push({ id: 'f1', floor: F, type: 'sofa', x: 2, y: 2, w: 2, d: 0.9, rotation: 90, color: '#b7c9a8', label: 'Couch' });
  d.labels.push({ id: 'l1', floor: F, text: 'Hello\nworld', x: 1, y: 1, size: 0.25, rotation: 0, color: '#1f2937' });
  d.dimensions.push({ id: 'm1', floor: F, a: { x: 0, y: 0 }, b: { x: 3, y: 4 } });
  return d;
}

describe('share links', () => {
  it('round-trips a design through the URL hash exactly (to the millimeter)', () => {
    const d = sample();
    const url = shareUrl(d, 'https://example.github.io/perfect-home/?x=1#old');
    expect(url.startsWith('https://example.github.io/perfect-home/?x=1#d=')).toBe(true);
    const back = designFromHash(url.slice(url.indexOf('#')))!;
    expect(back).toEqual(parseDesign(JSON.parse(serializeDesign(d))));
    expect(back.walls[0].b.x).toBe(4.123);
    expect(back.layers.structure.locked).toBe(true);
    expect(back.rooms[0].name).toBe('Küche ☕');
    expect(back.labels[0].text).toBe('Hello\nworld');
  });

  it('only uses URL-safe characters and is much smaller than the raw JSON for a bigger design', () => {
    const d = sample();
    const F = d.floors[0].id;
    for (let i = 0; i < 60; i++) d.walls.push({ id: `w${i + 10}`, floor: F, a: { x: i, y: 0 }, b: { x: i, y: 3 }, thickness: 0.15, type: 'interior' as const, height: 2.5 });
    for (let i = 0; i < 40; i++) d.furniture.push({ id: `f${i + 10}`, floor: F, type: 'chair', x: i * 0.5, y: 2, w: 0.45, d: 0.45, rotation: 0, color: '#b9a58a', label: '' });
    const enc = encodeDesign(d);
    expect(enc).toMatch(/^[A-Za-z0-9+\-$]+$/);
    expect(enc.length).toBeLessThan(serializeDesign(d).length / 2.5);
    expect(enc.length).toBeLessThan(8000);
  });

  it('survives "+" being turned into spaces by a chat app', () => {
    const enc = encodeDesign(sample());
    expect(decodeDesign(enc.replace(/\+/g, ' ')).name).toBe('Our flat');
  });

  it('has no design when the hash is something else, and rejects broken or truncated links', () => {
    expect(designFromHash('')).toBeNull();
    expect(designFromHash('#something')).toBeNull();
    expect(() => designFromHash('#d=garbage!!')).toThrow(/damaged/);
    const enc = encodeDesign(sample());
    expect(() => decodeDesign(enc.slice(0, enc.length - 40))).toThrow();
    expect(() => decodeDesign(LZString.compressToEncodedURIComponent('not json'))).toThrow(/does not contain/);
    expect(() => decodeDesign(LZString.compressToEncodedURIComponent('[1,2]'))).toThrow();
  });
});

describe('validation', () => {
  it('rejects designs from a newer app version and non-designs', () => {
    expect(() => parseDesign({ v: SCHEMA_VERSION + 1, walls: [] })).toThrow(/newer version/);
    expect(() => parseDesign(null)).toThrow();
    expect(() => parseDesign({ walls: [] })).toThrow(/Not a design/);
    expect(() => parseDesign({ hello: 'world' })).toThrow(/Not a design/);
    expect(() => parseDesignJson('{nope')).toThrow(/not valid JSON/);
  });

  it('repairs bad values instead of crashing', () => {
    const d = parseDesign({
      v: 1,
      walls: [{ id: 'a', a: { x: 'oops' }, b: { x: 1, y: 1 }, thickness: -5 }, 'junk', null],
      openings: [{ wallId: 'missing', kind: 'door' }, { wallId: 'a', kind: 'window', pos: 'x', width: 99 }],
      rooms: [{ points: [{ x: 0, y: 0 }] }, { name: 5, color: 'javascript:alert(1)', points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }] }],
      furniture: [{ type: 'unknown-thing', w: 'wide', color: 'red' }],
      labels: [{ text: 'x'.repeat(5000) }],
    });
    expect(d.walls).toHaveLength(1);
    expect(d.walls[0].a).toEqual({ x: 0, y: 0 });
    expect(d.walls[0].thickness).toBe(0.02);
    expect(d.openings).toHaveLength(1);
    expect(d.openings[0]).toMatchObject({ kind: 'window', pos: 0, width: 5 });
    expect(d.rooms).toHaveLength(1);
    expect(d.rooms[0].color).toBe('#e8eef7');
    expect(d.furniture[0]).toMatchObject({ type: 'unknown-thing', w: 1, color: '#cbd5e1' });
    expect(d.labels[0].text).toHaveLength(500);
    expect(d.layers.furniture).toEqual({ visible: true, locked: false });
  });

  it('describes emptiness and equality', () => {
    expect(isEmptyDesign(createDesign())).toBe(true);
    expect(isEmptyDesign(sample())).toBe(false);
    const d = sample();
    expect(sameContent(d, JSON.parse(JSON.stringify(d)))).toBe(true);
    expect(sameContent(d, { ...d, name: "Other" })).toBe(false);
    expect(fileNameFor({ ...createDesign(), name: ' Our Flat #2! ' }, 'json')).toBe('our-flat-2.json');
    expect(fileNameFor({ ...createDesign(), name: '***' }, 'png')).toBe('design.png');
  });
});

describe('floors, outdoor items and older designs', () => {
  it('opens a design saved before floors existed: everything lands on one Ground floor', () => {
    const old = {
      v: 1,
      id: 'abc',
      name: 'Old design',
      walls: [{ id: 'w', a: { x: 0, y: 0 }, b: { x: 3, y: 0 }, thickness: 0.15, type: 'interior' as const, height: 2.5 }],
      openings: [{ id: 'o', wallId: 'w', kind: 'window', pos: 1, width: 1, swing: 1, hinge: 'a' }],
      rooms: [{ id: 'r', name: 'Hall', color: '#e9d8b8', points: [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 2 }] }],
      furniture: [{ id: 'f', type: 'sofa', x: 1, y: 1, w: 2, d: 0.9, rotation: 0, color: '#b7c9a8', label: '' }],
      layers: { structure: { visible: true, locked: true }, rooms: {}, furniture: {}, notes: {} },
    };
    // as a shared link, too
    const d = decodeDesign(LZString.compressToEncodedURIComponent(JSON.stringify(old)));
    expect(d.floors).toHaveLength(1);
    expect(d.floors[0].name).toBe('Ground floor');
    const ground = d.floors[0].id;
    expect([d.walls[0].floor, d.rooms[0].floor, d.furniture[0].floor]).toEqual([ground, ground, ground]);
    expect(d.zones).toEqual([]);
    expect(d.strips).toEqual([]);
    expect(d.layers.structure.locked).toBe(true);
    expect(d.layers.outdoor).toEqual({ visible: true, locked: false });
  });

  it('keeps multiple floors, repairs unknown floor ids, and round-trips zones and strips', () => {
    const d = createDesign();
    d.floors.push({ id: 'up', name: '1st floor' });
    d.walls.push({ id: 'w1', floor: 'up', a: { x: 0, y: 0 }, b: { x: 2, y: 0 }, thickness: 0.15, type: 'interior' as const, height: 2.5 });
    d.zones.push({ id: 'z1', floor: d.floors[0].id, kind: 'lawn', name: 'Garden', color: '#cfe8c4', points: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 4 }] });
    d.strips.push({ id: 's1', floor: d.floors[0].id, kind: 'road', width: 6, points: [{ x: -5, y: 8 }, { x: 15, y: 8 }] });
    d.openings.push({ id: 'o1', wallId: 'w1', kind: 'garage', pos: 1, width: 2.5, swing: 1, hinge: 'a' });
    const back = decodeDesign(encodeDesign(d));
    expect(back.floors.map((f) => f.name)).toEqual(['Ground floor', '1st floor']);
    expect(back.walls[0].floor).toBe('up');
    expect(back.zones[0]).toMatchObject({ kind: 'lawn', name: 'Garden' });
    expect(back.strips[0]).toMatchObject({ kind: 'road', width: 6 });
    expect(back.openings[0].kind).toBe('garage');

    const broken = parseDesign({
      v: 1,
      walls: [{ id: 'w', floor: 'does-not-exist', a: { x: 0, y: 0 }, b: { x: 1, y: 0 } }],
      zones: [{ kind: 'volcano', points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }] }, { kind: 'lawn', points: [{ x: 0, y: 0 }] }],
      strips: [{ kind: 'road', points: [{ x: 0, y: 0 }] }, { kind: 'laser', points: [{ x: 0, y: 0 }, { x: 1, y: 1 }], width: -3 }],
      openings: [{ wallId: 'w', kind: 'portal' }],
    });
    expect(broken.walls[0].floor).toBe(broken.floors[0].id);
    expect(broken.zones).toHaveLength(1);
    expect(broken.zones[0].kind).toBe('lawn');
    expect(broken.strips).toHaveLength(1);
    expect(broken.strips[0]).toMatchObject({ kind: 'path', width: 0.02 });
    expect(broken.openings[0].kind).toBe('door');
  });
});

describe('new item types and defaults', () => {
  it('fills defaults for designs that predate wall types, materials, stairs, notes and the sun', () => {
    const d = parseDesign({
      v: 1,
      walls: [{ id: 'w', a: { x: 0, y: 0 }, b: { x: 2, y: 0 }, thickness: 0.2 }],
      rooms: [{ id: 'r', name: 'Hall', color: '#e9d8b8', points: [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }] }],
    });
    expect(d.walls[0]).toMatchObject({ type: 'interior', height: 2.5, thickness: 0.2 });
    expect(d.walls[0].bulge).toBeUndefined();
    expect(d.rooms[0]).toMatchObject({ material: 'plain', living: true });
    expect(d.stairs).toEqual([]);
    expect(d.notes).toEqual([]);
    expect(d.guides).toEqual([]);
    expect(d.custom).toEqual([]);
    expect(d.site).toEqual({ north: 0, lat: 50, month: 6, day: 21 });
    expect(d.settings.storeyHeight).toBe(2.8);
    expect(d.layers.tech).toEqual({ visible: true, locked: false });
    expect(d.layers.comments).toEqual({ visible: true, locked: false });
  });

  it('round-trips curved walls, stairs, notes, guides, custom items, materials and the site through a link', () => {
    const d = createDesign();
    const F = d.floors[0].id;
    d.walls.push({ id: 'c', floor: F, a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, thickness: 0.3, type: 'exterior', height: 6, bulge: -0.8 });
    d.openings.push({ id: 'o', wallId: 'c', kind: 'bay', pos: 2, width: 1.6, swing: -1, hinge: 'a' });
    d.rooms.push({ id: 'r', floor: F, name: 'Bad', color: '#d9eceb', material: 'tile', living: false, points: [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }] });
    d.furniture.push({ id: 'f', floor: F, type: 'custom:c1', x: 1, y: 1, w: 0.8, d: 0.4, rotation: 0, color: '#cbd5e1', label: '', height: 1.9, on: false });
    d.stairs.push({ id: 's', floor: F, kind: 'u', x: 3, y: 3, w: 2, d: 3, rotation: 90, steps: 16, rise: 2.85, flip: true });
    d.notes.push({ id: 'n', floor: F, x: 1, y: 2, text: 'Window here?', author: 'Paul', color: '#facc15', time: 1700000000000, done: true });
    d.guides.push({ id: 'g', axis: 'y', pos: 3.25 });
    d.custom.push({ id: 'c1', label: 'My shelf', w: 0.8, d: 0.4, height: 1.9, color: '#cbd5e1', shape: 'round' });
    d.site = { north: 35, lat: 52.5, month: 12, day: 21 };
    const back = decodeDesign(encodeDesign(d));
    expect(back.walls[0]).toMatchObject({ type: 'exterior', height: 6, bulge: -0.8 });
    expect(back.openings[0].kind).toBe('bay');
    expect(back.rooms[0]).toMatchObject({ material: 'tile', living: false });
    expect(back.furniture[0]).toMatchObject({ height: 1.9, on: false });
    expect(back.stairs[0]).toMatchObject({ kind: 'u', steps: 16, rise: 2.85, flip: true });
    expect(back.notes[0]).toMatchObject({ author: 'Paul', done: true, time: 1700000000000 });
    expect(back.guides[0]).toEqual({ id: 'g', axis: 'y', pos: 3.25 });
    expect(back.custom[0]).toMatchObject({ label: 'My shelf', shape: 'round' });
    expect(back.site).toEqual({ north: 35, lat: 52.5, month: 12, day: 21 });
  });

  it('repairs invalid new values', () => {
    const d = parseDesign({
      v: 1,
      walls: [{ id: 'w', a: { x: 0, y: 0 }, b: { x: 1, y: 0 }, type: 'adamantium', height: -4, bulge: 'lots' }],
      rooms: [{ points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }], material: 'lava' }],
      stairs: [{ kind: 'escalator', steps: 9999, rise: 'tall' }],
      guides: [{ axis: 'z', pos: 'x' }],
      custom: [{ shape: 'blob', w: -1 }],
      site: { lat: 400, month: 99 },
    });
    expect(d.walls[0]).toMatchObject({ type: 'interior', height: 0.1 });
    expect(d.walls[0].bulge).toBeUndefined();
    expect(d.rooms[0].material).toBe('plain');
    expect(d.stairs[0]).toMatchObject({ kind: 'straight', steps: 60, rise: 2.8 });
    expect(d.guides[0]).toEqual(expect.objectContaining({ axis: 'x', pos: 0 }));
    expect(d.custom[0]).toMatchObject({ shape: 'rect', w: 0.05 });
    expect(d.site.lat).toBe(66);
    expect(d.site.month).toBe(12);
  });
});
