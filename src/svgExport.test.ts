import { describe, expect, it } from 'vitest';
import { createDesign, type Design } from './model';
import { buildSvg } from './svgExport';

/** Is it well-formed XML (balanced tags, no stray & or <)? A small check, enough to catch generator bugs. */
function wellFormed(xml: string): string | null {
  if (/&(?!(amp|lt|gt|quot|apos|#\d+);)/.test(xml)) return 'unescaped &';
  const tag = /<(\/?)([A-Za-z][\w:-]*)((?:\s+[\w:-]+="[^"]*")*)\s*(\/?)>/g;
  const stack: string[] = [];
  let last = 0;
  for (let m = tag.exec(xml); m; m = tag.exec(xml)) {
    if (/</.test(xml.slice(last, m.index))) return `stray < near ${xml.slice(last, last + 40)}`;
    last = m.index + m[0].length;
    if (m[4]) continue;
    if (m[1]) {
      if (stack.pop() !== m[2]) return `unbalanced </${m[2]}>`;
    } else stack.push(m[2]);
  }
  if (/</.test(xml.slice(last))) return 'trailing <';
  return stack.length ? `unclosed <${stack[stack.length - 1]}>` : null;
}

function house(): { d: Design; F: string } {
  const d = createDesign();
  const F = d.floors[0].id;
  d.name = 'Smith & "Co" <home>';
  const wall = (id: string, ax: number, ay: number, bx: number, by: number, type: 'exterior' | 'interior' = 'exterior', extra = {}) =>
    d.walls.push({ id, floor: F, a: { x: ax, y: ay }, b: { x: bx, y: by }, thickness: 0.25, type, height: 2.5, ...extra });
  wall('t', 0, 0, 8, 0);
  wall('r', 8, 0, 8, 6, 'interior');
  wall('b', 8, 6, 0, 6);
  wall('l', 0, 6, 0, 0, 'exterior', { bulge: 1 }); // a curved wall
  d.openings.push({ id: 'door', wallId: 't', kind: 'door', pos: 2, width: 0.9, swing: 1, hinge: 'a' });
  d.openings.push({ id: 'win', wallId: 't', kind: 'window', pos: 5, width: 1.2, swing: 1, hinge: 'a' });
  d.openings.push({ id: 'gar', wallId: 'b', kind: 'garage', pos: 4, width: 2.5, swing: 1, hinge: 'a' });
  d.openings.push({ id: 'bay', wallId: 'r', kind: 'bay', pos: 3, width: 1.6, swing: -1, hinge: 'a' });
  d.openings.push({ id: 'dbl', wallId: 'b', kind: 'french', pos: 1, width: 1.6, swing: -1, hinge: 'a' });
  d.openings.push({ id: 'sld', wallId: 'b', kind: 'sliding', pos: 7, width: 1.8, swing: -1, hinge: 'a' });
  d.rooms.push({ id: 'r1', floor: F, name: 'Living & dining', color: '#e9d8b8', material: 'wood', living: true, points: [{ x: 0.2, y: 0.2 }, { x: 7.8, y: 0.2 }, { x: 7.8, y: 5.8 }, { x: 0.2, y: 5.8 }] });
  d.furniture.push({ id: 'sofa', floor: F, type: 'sofa', x: 4, y: 4, w: 2, d: 0.9, rotation: 15, color: '#b7c9a8', label: '' });
  d.furniture.push({ id: 'socket', floor: F, type: 'socket', x: 3, y: 0.2, w: 0.22, d: 0.1, rotation: 0, color: '#fecaca', label: '' });
  d.stairs.push({ id: 'st', floor: F, kind: 'l', x: 6.5, y: 4.5, w: 2, d: 2, rotation: 90, steps: 14, rise: 2.8, flip: false });
  d.labels.push({ id: 'lab', floor: F, text: 'Line 1\nLine 2 & more', x: 2, y: 2, size: 0.25, rotation: 0, color: '#1f2937' });
  d.dimensions.push({ id: 'dim', floor: F, a: { x: 0, y: -1 }, b: { x: 8, y: -1 } });
  d.zones.push({ id: 'plot', floor: F, kind: 'plot', name: 'Plot', color: '#fff', points: [{ x: -3, y: -3 }, { x: 11, y: -3 }, { x: 11, y: 9 }, { x: -3, y: 9 }] });
  d.zones.push({ id: 'lawn', floor: F, kind: 'lawn', name: 'Garden', color: '#cfe8c4', points: [{ x: 8.5, y: 0 }, { x: 11, y: 0 }, { x: 11, y: 6 }, { x: 8.5, y: 6 }] });
  d.strips.push({ id: 'road', floor: F, kind: 'road', width: 6, points: [{ x: -3, y: 12 }, { x: 11, y: 12 }] });
  d.strips.push({ id: 'fence', floor: F, kind: 'fence', width: 0.1, points: [{ x: -3, y: -3 }, { x: 11, y: -3 }] });
  d.notes.push({ id: 'n', floor: F, x: 1, y: 1, text: 'secret', author: 'Paul', color: '#facc15', time: 1, done: false });
  d.guides.push({ id: 'g', axis: 'x', pos: 2 });
  return { d, F };
}

describe('SVG export', () => {
  it('is well-formed XML, with the design name escaped', () => {
    const { d, F } = house();
    const plan = buildSvg(d, F)!;
    expect(wellFormed(plan.svg)).toBeNull();
    expect(plan.svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(plan.svg).toContain('Smith &amp; &quot;Co&quot; &lt;home&gt;');
    expect(plan.svg).toContain('Living &amp; dining');
    expect(plan.svg).toContain('Line 2 &amp; more');
    expect(plan.svg).not.toContain('Smith & "Co"');
  });

  it('has a viewBox in meters that covers the plan with a margin, and sizes in pixels', () => {
    const { d, F } = house();
    const plan = buildSvg(d, F, { decorations: false, margin: 1, pixelsPerMeter: 50 })!;
    const m = /viewBox="(\S+) (\S+) (\S+) (\S+)" width="(\S+)" height="(\S+)"/.exec(plan.svg)!;
    expect(Number(m[3])).toBeCloseTo(plan.width, 3);
    expect(Number(m[5])).toBeCloseTo(plan.width * 50, 2);
    expect(Number(m[6])).toBeCloseTo(plan.height * 50, 2);
    expect(plan.width).toBeCloseTo(14 + 2, 3); // from the plot boundary -3 to 11, plus 1 m margin on each side
    expect(Number(m[1])).toBeCloseTo(-4, 3);
  });

  it('draws walls with gaps for doors and curved walls as arcs', () => {
    const { d, F } = house();
    const svg = buildSvg(d, F, { decorations: false })!.svg;
    expect(svg).toContain('fill="#262c3a"'); // exterior walls
    // the top wall has a door and a window cut out: 3 pieces; the bottom wall has 3 openings: 4 pieces
    expect((svg.match(/<polygon points="[^"]*" fill="#262c3a"\/>/g) ?? []).length).toBeGreaterThanOrEqual(3 + 4 + 1);
    const curved = svg.match(/<polygon points="([^"]*)" fill="#262c3a"\/>/g)!.map((p) => p.split(' ').length);
    expect(Math.max(...curved)).toBeGreaterThan(20); // the curved wall has many sample points
  });

  it('draws every kind of opening', () => {
    const { d, F } = house();
    const svg = buildSvg(d, F, { decorations: false })!.svg;
    expect(svg).toContain('stroke-dasharray="4 3"'); // door swing arcs
    expect(svg).toContain('stroke-dasharray="10 5"'); // garage door
    expect(svg).toContain('fill="#dbeafe"'); // window / bay glass
    expect((svg.match(/<polygon[^>]*stroke-linejoin="round"/g) ?? []).length).toBeGreaterThanOrEqual(1); // the bay window bump
  });

  it('draws rooms with their floor material, furniture, stairs, outdoor areas and streets', () => {
    const { d, F } = house();
    const svg = buildSvg(d, F, { decorations: false })!.svg;
    expect(svg).toMatch(/<pattern id="mat-wood-e9d8b8"/);
    expect(svg).toMatch(/fill="url\(#mat-wood-e9d8b8\)"/);
    expect(svg).toContain('rotate(15)'); // the rotated sofa
    expect(svg).toContain('>Sofa<');
    expect(svg).toContain('stroke-dasharray="10 6"'); // plot boundary
    expect(svg).toContain('stroke="#a3a9b3"'); // road
    expect(svg).toContain('stroke-dasharray="0.9 0.7"'); // road markings
    expect(svg).toContain('Garden · 15.00 m²');
    expect(svg).toContain('>42.56 m²<'); // the room's area label: 7.6 x 5.6 m
  });

  it('leaves out what is not part of the picture: sticky notes, guides, wall symbols\' text', () => {
    const { d, F } = house();
    const svg = buildSvg(d, F, { decorations: false })!.svg;
    expect(svg).not.toContain('secret');
    expect(svg).not.toContain('Socket');
    expect(svg).toContain('translate(3 0.2)'); // but the socket symbol itself is drawn
  });

  it('adds title, scale bar and north arrow only when asked', () => {
    const { d, F } = house();
    d.site.north = 30;
    const withDeco = buildSvg(d, F, { decorations: true })!.svg;
    expect(withDeco).toContain('rotate(30)');
    expect(withDeco).toMatch(/>(\d+ m|\d+ cm)<\/text>/); // the scale bar label
    expect(withDeco).toContain('>N</text>');
    const without = buildSvg(d, F, { decorations: false })!.svg;
    expect(without).not.toContain('>N</text>');
    expect(buildSvg(d, F, { decorations: true })!.height).toBeGreaterThan(buildSvg(d, F, { decorations: false })!.height);
  });

  it('can add the automatic dimensions, respects hidden layers, and only draws the given floor', () => {
    const { d, F } = house();
    const plain = buildSvg(d, F, { decorations: false })!.svg;
    const dims = buildSvg(d, F, { decorations: false, dimensions: true })!.svg;
    expect(dims.length).toBeGreaterThan(plain.length);
    expect(dims).toContain('>8</text>'); // a wall length
    d.layers.furniture.visible = false;
    expect(buildSvg(d, F, { decorations: false })!.svg).not.toContain('>Sofa<');
    d.floors.push({ id: 'up', name: '1st floor' });
    expect(buildSvg(d, 'up')).toBeNull(); // nothing on that floor
    d.walls.push({ id: 'uw', floor: 'up', a: { x: 0, y: 0 }, b: { x: 3, y: 0 }, thickness: 0.15, type: 'interior', height: 2.5 });
    const up = buildSvg(d, 'up')!;
    expect(up.svg).toContain('Smith &amp; &quot;Co&quot; &lt;home&gt; – 1st floor');
    expect(up.svg).not.toContain('>Living');
    expect(wellFormed(up.svg)).toBeNull();
  });
});
