import { describe, expect, it } from 'vitest';
import LZString from 'lz-string';
import { createDesign, parseDesign, serializeDesign, SCHEMA_VERSION, type Design } from './model';
import { decodeDesign, designFromHash, encodeDesign, fileNameFor, isEmptyDesign, parseDesignJson, sameContent, shareUrl } from './share';

function sample(): Design {
  const d = createDesign();
  d.name = 'Our flat';
  d.layers.structure.locked = true;
  d.walls.push({ id: 'w1', a: { x: 0, y: 0 }, b: { x: 4.123, y: 0 }, thickness: 0.15 });
  d.openings.push({ id: 'o1', wallId: 'w1', kind: 'door', pos: 1, width: 0.9, swing: -1, hinge: 'b' });
  d.rooms.push({ id: 'r1', name: 'Küche ☕', color: '#e1efdc', points: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }], seed: { x: 1, y: 1 } });
  d.furniture.push({ id: 'f1', type: 'sofa', x: 2, y: 2, w: 2, d: 0.9, rotation: 90, color: '#b7c9a8', label: 'Couch' });
  d.labels.push({ id: 'l1', text: 'Hello\nworld', x: 1, y: 1, size: 0.25, rotation: 0, color: '#1f2937' });
  d.dimensions.push({ id: 'm1', a: { x: 0, y: 0 }, b: { x: 3, y: 4 } });
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
    for (let i = 0; i < 60; i++) d.walls.push({ id: `w${i + 10}`, a: { x: i, y: 0 }, b: { x: i, y: 3 }, thickness: 0.15 });
    for (let i = 0; i < 40; i++) d.furniture.push({ id: `f${i + 10}`, type: 'chair', x: i * 0.5, y: 2, w: 0.45, d: 0.45, rotation: 0, color: '#b9a58a', label: '' });
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
