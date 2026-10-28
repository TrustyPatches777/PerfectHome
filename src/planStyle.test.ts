import { describe, expect, it } from 'vitest';
import { createDesign, parseDesign, type Design, type PlanStyle } from './model';
import { lookOf, mix, lightness, normalizeStyle, presetDefault } from './planStyle';
import { buildSvg } from './svgExport';

/** A small plan: four walls, a room, a window, a sofa and a lawn. */
function plan(style?: PlanStyle): Design {
  const d = createDesign();
  const F = d.floors[0].id;
  const pts = [[0, 0], [6, 0], [6, 4], [0, 4]];
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % 4];
    d.walls.push({ id: `w${i}`, floor: F, a: { x: p[0], y: p[1] }, b: { x: q[0], y: q[1] }, thickness: 0.3, type: 'exterior', height: 2.5 });
  });
  d.rooms.push({ id: 'r', floor: F, name: 'Living room', color: '#f1e6d0', material: 'wood', living: true, points: [{ x: 0.15, y: 0.15 }, { x: 5.85, y: 0.15 }, { x: 5.85, y: 3.85 }, { x: 0.15, y: 3.85 }] });
  d.openings.push({ id: 'win', wallId: 'w2', kind: 'window', pos: 3, width: 1.4, swing: 1, hinge: 'a' });
  d.furniture.push({ id: 's', floor: F, type: 'sofa', x: 3, y: 2, w: 2.2, d: 0.95, rotation: 0, color: '#8aa0b8', label: '' });
  d.zones.push({ id: 'z', floor: F, kind: 'lawn', name: '', color: '#7fbf6a', points: [{ x: -4, y: 0 }, { x: -1, y: 0 }, { x: -1, y: 4 }, { x: -4, y: 4 }] });
  if (style) d.style = style;
  return d;
}
const svg = (d: Design) => buildSvg(d, d.floors[0].id, { decorations: false })!.svg;

describe('the colour preset is the plan as it always was', () => {
  it('keeps every color of the design as it is', () => {
    const look = lookOf();
    expect(look.preset).toBe('colour');
    expect(look.tone('#7fbf6a')).toBe('#7fbf6a');
    expect(look.wallFill('#262c3a')).toBe('#262c3a');
    expect(look.furnFill('#8aa0b8')).toBe('#8aa0b8');
    expect(look.paper).toBe('#ffffff');
    expect(look.walls).toBe('solid');
    expect(look.rooms).toBe('material');
    expect(look.roomLabel('Kitchen', '10 m²')).toEqual(['Kitchen', '10 m²']);
    expect(lookOf({ preset: 'colour' }).wallFill('#123456')).toBe('#123456');
  });

  it('draws the same SVG with no style as with the plain colour style, and keeps the room material and the dark walls', () => {
    const a = svg(plan());
    expect(svg(plan({ preset: 'colour' }))).toBe(a);
    expect(a).toContain('fill="#262c3a"'); // exterior walls
    expect(a).toContain('url(#mat-wood');
    expect(a).not.toContain('hatch-');
  });
});

describe('architectural and blueprint', () => {
  it('architectural: black and white, empty rooms, plain furniture, capital letters', () => {
    const look = lookOf({ preset: 'architectural' });
    expect(look.walls).toBe('solid');
    expect(look.rooms).toBe('none');
    expect(look.furniture).toBe('plain');
    expect(look.roomLabel('Living room', '22 m²')).toEqual(['LIVING ROOM', '22 m²']);
    expect(lightness(look.wallFill('#262c3a'))).toBeLessThan(0.25); // the heavy walls stay black
    expect(lightness(look.tone('#7fbf6a'))).toBeGreaterThan(0.7); // the lawn is a light grey
    const out = svg(plan({ preset: 'architectural' }));
    expect(out).not.toContain('url(#mat-');
    expect(out).toContain('LIVING ROOM');
    expect(out).not.toContain('#7fbf6a');
    expect(out).not.toContain('#8aa0b8'); // the sofa has lost its color
  });

  it('blueprint: white lines on blue, walls as an outline in two passes, furniture in outline', () => {
    const look = lookOf({ preset: 'blueprint' });
    expect(look.paper).toBe('#1b4b8f');
    expect(look.walls).toBe('outline');
    expect(look.furnFill('#8aa0b8')).toBe('none');
    const out = svg(plan({ preset: 'blueprint' }));
    expect(out).toContain('fill="#1b4b8f"/>'); // the sheet
    // the thick edge of every wall piece comes first, the fills after it
    const edges = (out.match(/stroke-width="3\.2"/g) ?? []).length;
    expect(edges).toBe(5); // four walls, the window cuts one in two
    expect(out.indexOf('stroke-width="3.2"')).toBeLessThan(out.lastIndexOf('fill="#1b4b8f" stroke="#1b4b8f"'));
    expect(out).toContain('fill="none"'); // the furniture
  });

  it('the line weight scales the edge of the walls and the other lines', () => {
    const w = (lines: 'fine' | 'heavy') => svg(plan({ preset: 'blueprint', lines }));
    expect(w('fine')).toContain('stroke-width="1.92"'); // 3.2 x 0.6
    expect(w('heavy')).toContain('stroke-width="5.76"'); // 3.2 x 1.8
    expect(lookOf({ preset: 'colour', lines: 'heavy' }).lw).toBeGreaterThan(lookOf({ preset: 'colour', lines: 'fine' }).lw);
  });
});

describe('the single choices', () => {
  it('hatched walls get a pattern per ground and line color', () => {
    const out = svg(plan({ preset: 'architectural', walls: 'hatch' }));
    expect(out).toMatch(/<pattern id="hatch-[0-9a-z]+"/);
    expect(out).toContain('fill="url(#hatch-');
  });

  it('floors: their material, a pale tint, or nothing', () => {
    expect(svg(plan({ preset: 'colour', rooms: 'tint' }))).not.toContain('url(#mat-');
    const tint = lookOf({ preset: 'colour', rooms: 'tint' }).roomFlat('#f1e6d0');
    expect(lightness(tint)).toBeGreaterThan(lightness('#f1e6d0'));
    expect(lookOf({ preset: 'colour', rooms: 'none' }).roomFlat('#f1e6d0')).toBe('none');
    expect(svg(plan({ preset: 'architectural', rooms: 'material' }))).toContain('url(#mat-wood');
  });

  it('room labels: name and area, the name alone, or nothing', () => {
    expect(svg(plan({ preset: 'colour', labels: 'name' }))).not.toContain('21.09'); // the area of the room (the lawn keeps its own)
    expect(svg(plan({ preset: 'colour', labels: 'name' }))).toContain('Living room');
    expect(svg(plan({ preset: 'colour', labels: 'none' }))).not.toContain('Living room');
    expect(lookOf({ preset: 'colour', labelSize: 'large' }).labelScale).toBeGreaterThan(1);
    expect(svg(plan({ preset: 'colour', font: 'serif' }))).toContain('Georgia');
  });

  it('furniture can be plain grey or an outline in the colour plan too', () => {
    expect(lookOf({ preset: 'colour', furniture: 'plain' }).furnFill('#8aa0b8')).not.toBe('#8aa0b8');
    expect(svg(plan({ preset: 'colour', furniture: 'outline' }))).not.toContain('#8aa0b8');
  });

  it('colors mix and measure sensibly', () => {
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(lightness('#ffffff')).toBe(1);
    expect(lightness('#000000')).toBe(0);
  });
});

describe('saved and loaded', () => {
  it('normalizing drops what only repeats the preset, and the plain colour plan has no style at all', () => {
    expect(normalizeStyle({ preset: 'colour' })).toBeUndefined();
    expect(normalizeStyle({ preset: 'colour', walls: 'solid', lines: 'normal' })).toBeUndefined();
    expect(normalizeStyle({ preset: 'blueprint', walls: 'outline' })).toEqual({ preset: 'blueprint' });
    expect(normalizeStyle({ preset: 'blueprint', walls: 'solid' })).toEqual({ preset: 'blueprint', walls: 'solid' });
    expect(presetDefault('architectural', 'rooms')).toBe('none');
    expect(presetDefault('colour', 'lines')).toBe('normal');
  });

  it('survives a round trip, repairs junk, and an old design has none', () => {
    const d = plan({ preset: 'architectural', walls: 'hatch', labels: 'name', lines: 'heavy' });
    expect(parseDesign(JSON.parse(JSON.stringify(d))).style).toEqual(d.style);
    const raw = JSON.parse(JSON.stringify(d));
    raw.style = { preset: 'neon', walls: 'sparkly', rooms: 'tint', lines: 5 };
    expect(parseDesign(raw).style).toEqual({ preset: 'colour', rooms: 'tint' });
    raw.style = { preset: 'colour', walls: 'solid' };
    expect(parseDesign(raw).style).toEqual({ preset: 'colour', walls: 'solid' }); // a choice, even if it repeats the default
    raw.style = 'blueprint';
    expect(parseDesign(raw).style).toBeUndefined();
    raw.style = { preset: 'colour' };
    expect(parseDesign(raw).style).toBeUndefined();
    const old = JSON.parse(JSON.stringify(createDesign()));
    expect(parseDesign(old).style).toBeUndefined();
  });
});
