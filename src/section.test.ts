import { describe, expect, it } from 'vitest';
import { createDesign, parseDesign, type Design } from './model';
import { buildDrawing, elevationDirection, prepareDrawing, renderDrawing, sectionDirection, shade, type DrawingSpec } from './section';
import { clipAbove, explodedElevations, floorElevations, sceneChunks } from './view3d/build';
import { box, type Part } from './view3d/parts';

/** A 8 x 6 m house of two storeys with a gable roof, a window in the south wall and a door in the north wall. */
function house(): Design {
  const d = createDesign();
  d.floors = [{ id: 'g', name: 'Ground floor' }, { id: 'u', name: 'First floor' }];
  const walls = (floor: string, pre: string) => {
    const pts = [[0, 0], [8, 0], [8, 6], [0, 6]];
    pts.forEach((p, i) => {
      const q = pts[(i + 1) % 4];
      d.walls.push({ id: pre + i, floor, a: { x: p[0], y: p[1] }, b: { x: q[0], y: q[1] }, thickness: 0.3, type: 'exterior', height: 2.5 });
    });
    d.rooms.push({ id: pre + 'r', floor, name: 'Room', color: '#f1e6d0', material: 'wood', living: true, points: [{ x: 0.15, y: 0.15 }, { x: 7.85, y: 0.15 }, { x: 7.85, y: 5.85 }, { x: 0.15, y: 5.85 }] });
  };
  walls('g', 'a');
  walls('u', 'b');
  d.openings.push({ id: 'win', wallId: 'a2', kind: 'window', pos: 3, width: 1.4, swing: 1, hinge: 'a' }); // the south wall (y = 6) runs from (8,6) to (0,6)
  d.openings.push({ id: 'door', wallId: 'a0', kind: 'door', pos: 4, width: 0.9, swing: 1, hinge: 'a' });
  d.roofs.push({ id: 'rf', floor: 'u', kind: 'gable', x: 4, y: 3, w: 8, d: 6, rotation: 0, pitch: 35, overhang: 0.4, thickness: 0.15, material: 'tiles', color: '#b5523b', chimney: false, parapet: false });
  return d;
}

const elevation = (side: 'N' | 'E' | 'S' | 'W', extra: Partial<DrawingSpec> = {}): DrawingSpec => ({ kind: 'elevation', side, furniture: true, colour: false, ...extra });

describe('which way you look', () => {
  it('stands on the named side and looks at the house, turned with the compass', () => {
    expect(elevationDirection('S', 0)).toMatchObject({ x: 0, y: -1 }); // north is up the plan, so you look up it
    expect(elevationDirection('N', 0)).toMatchObject({ x: -0, y: 1 });
    const west = elevationDirection('W', 0);
    expect(west.x).toBeCloseTo(1);
    expect(west.y).toBeCloseTo(0);
    const turned = elevationDirection('S', 90); // north points right on the plan
    expect(turned.x).toBeCloseTo(1);
    expect(turned.y).toBeCloseTo(0);
  });

  it('a section looks to the left of the line, or the right when flipped', () => {
    const line = { id: 's', name: 'A', a: { x: 0, y: 3 }, b: { x: 8, y: 3 } };
    expect(sectionDirection(line)).toEqual({ x: 0, y: -1 }); // walking right, left is up the screen
    expect(sectionDirection({ ...line, flip: true })).toEqual({ x: -0, y: 1 });
  });
});

describe('elevations', () => {
  it('are as wide as the house and as tall as its ridge, with the floor levels marked', () => {
    const d = house();
    const p = prepareDrawing(d, elevation('S'))!;
    expect(p.box.u1 - p.box.u0).toBeGreaterThan(8.7); // 8 m of wall and the eaves
    expect(p.box.u1 - p.box.u0).toBeLessThan(9.2);
    expect(p.top).toBeGreaterThan(2 * d.settings.storeyHeight + 1.5); // two storeys and the roof
    expect(p.levels.map((l) => l.h)).toEqual([0, d.settings.storeyHeight]);
    expect(p.title).toBe('South elevation');
    expect(p.caps).toEqual([]); // nothing is cut in an elevation
  });

  it('show the window of the south wall in front from the south and far away (behind the north wall) from the north', () => {
    const d = house();
    // how far the nearest pane of glass lies behind the nearest thing of the picture
    const behind = (side: 'N' | 'S') => {
      const p = prepareDrawing(d, elevation(side, { furniture: false }))!;
      const near = Math.min(...p.shapes.map((s) => s.depth));
      return Math.min(...p.shapes.filter((s) => s.glass).map((s) => s.depth)) - near;
    };
    expect(behind('S')).toBeLessThan(0.6);
    expect(behind('N')).toBeGreaterThan(5);
  });

  it('draw the near wall over the far one', () => {
    const p = prepareDrawing(house(), elevation('S', { furniture: false }))!;
    const depths = p.shapes.map((s) => s.depth);
    expect([...depths].sort((a, b) => b - a)).toEqual(depths); // painted from far to near
  });

  it('become an SVG whose line weights follow the scale and whose size is the house on the paper', () => {
    const d = house();
    const a = buildDrawing(d, elevation('S'), 100)!;
    const b = buildDrawing(d, elevation('S'), 200)!;
    expect(a.svg.startsWith('<svg')).toBe(true);
    expect(a.svg).toContain('South elevation');
    expect(a.svg).toContain('±0.00');
    expect(a.width).toBeGreaterThan(8.7);
    // the same house is bigger in meters of house per paper at 1:200, because the margins are millimeters of paper
    expect(b.width).toBeGreaterThan(a.width);
    expect(a.svg).toMatch(/stroke-width="0\.018"/); // 0.18 mm at 1:100
    expect(b.svg).toMatch(/stroke-width="0\.036"/);
  });

  it('can be drawn in colour', () => {
    const d = house();
    const lines = buildDrawing(d, elevation('S'), 100)!.svg;
    const colour = buildDrawing(d, elevation('S', { colour: true }), 100)!.svg;
    expect(lines).not.toContain('#b5523b');
    expect(colour.match(/fill="#[0-9a-f]{6}"/g)!.length).toBeGreaterThan(5);
    expect(shade('#ffffff', 0.5)).toBe('#808080');
  });

  it('are nothing for an empty design', () => {
    expect(prepareDrawing(createDesign(), elevation('S'))).toBeNull();
  });
});

describe('sections', () => {
  const line = { id: 's', name: 'A', a: { x: 4, y: -1 }, b: { x: 4, y: 7 } };
  const spec = (flip = false, extra: Partial<DrawingSpec> = {}): DrawingSpec => ({ kind: 'section', line: { ...line, flip }, furniture: true, colour: false, ...extra });

  it('cut the walls and the floors on the line and hatch them', () => {
    const d = house();
    const p = prepareDrawing(d, spec())!;
    expect(p.title).toBe('Section A–A');
    // the line runs down the plan (a to b = +y), so the left side is +x... the cut passes the north and south walls of both floors, and every floor
    const tall = p.caps.filter((c) => c.pts.some((q) => Math.abs(q[1] - 2.5) < 0.01 || Math.abs(q[1] - 5.25) < 0.01));
    expect(tall.length).toBeGreaterThanOrEqual(4);
    const svg = renderDrawing(p, 100).svg;
    expect(svg).toContain('url(#cut)');
    expect(svg).toContain('Section A–A');
  });

  it('only show what lies between the ends of the line', () => {
    const d = house();
    const p = prepareDrawing(d, spec())!;
    expect(p.box.u1 - p.box.u0).toBeCloseTo(8, 5); // the line is 8 m long, the house 6 m deep
  });

  it('show the ground as earth under the profile, cut through a basement', () => {
    const d = house();
    const flat = prepareDrawing(d, spec())!;
    expect(flat.earth).not.toBeNull();
    expect(flat.earth!.slice(0, -2).every((q) => Math.abs(q[1] - 0) < 1e-6)).toBe(true); // level ground
    d.settings.groundLevel = 0.5;
    const raised = prepareDrawing(d, spec())!;
    expect(raised.levels[0].h).toBeCloseTo(0.5);
  });

  it('look the other way when flipped: the cut is the same, what lies behind it is not', () => {
    const d = house();
    d.furniture.push({ id: 'sofa', floor: 'g', type: 'sofa', x: 1.5, y: 3, w: 2, d: 1, rotation: 0, color: '#8aa0b8', label: '' });
    const a = prepareDrawing(d, spec(false))!;
    const b = prepareDrawing(d, spec(true))!;
    expect(a.caps.length).toBeGreaterThan(0);
    expect(b.caps.length).toBeGreaterThan(0);
    const fine = (p: typeof a) => p.shapes.filter((s) => s.fine).length;
    expect(fine(a)).not.toBe(fine(b)); // the sofa is on one side of the cut only
  });

  it('cut a thing with a hole (a stairwell) into two pieces', () => {
    const d = createDesign();
    d.floors = [{ id: 'g', name: 'G' }];
    d.rooms.push({ id: 'r', floor: 'g', name: 'R', color: '#eee', material: 'plain', living: true, points: [{ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 8, y: 6 }, { x: 0, y: 6 }] });
    const s: DrawingSpec = { kind: 'section', line: { id: 's', name: 'B', a: { x: 4, y: -1 }, b: { x: 4, y: 7 } }, furniture: false, colour: false };
    const p = prepareDrawing(d, s)!;
    expect(p.caps.length).toBeGreaterThan(0);
  });
});

describe('saved with the design', () => {
  it('views and section lines survive a round trip and junk is repaired', () => {
    const d = createDesign();
    d.views.push({ id: 'v', name: 'Front', pos: [1, 2, 3], target: [4, 5, 6] });
    d.sections.push({ id: 's', name: 'A', a: { x: 0, y: 0 }, b: { x: 5, y: 0 }, flip: true });
    const back = parseDesign(JSON.parse(JSON.stringify(d)));
    expect(back.views).toEqual(d.views);
    expect(back.sections).toEqual(d.sections);
    const raw = JSON.parse(JSON.stringify(d));
    raw.views.push({ name: 5, pos: 'x', target: [1] });
    raw.sections.push({ id: 'z', a: { x: 1, y: 1 }, b: { x: 1, y: 1 } }); // no length
    const fixed = parseDesign(raw);
    expect(fixed.views).toHaveLength(2);
    expect(fixed.views[1].pos).toEqual([0, 0, 0]);
    expect(fixed.views[1].target).toEqual([1, 0, 0]);
    expect(fixed.sections).toHaveLength(1);
    // an old design has neither
    const old = JSON.parse(JSON.stringify(createDesign()));
    delete old.views;
    delete old.sections;
    expect(parseDesign(old).views).toEqual([]);
    expect(parseDesign(old).sections).toEqual([]);
  });
});

describe('exploded floors and the dollhouse', () => {
  it('push each floor further from the one below, and keep the ground floor where it is', () => {
    const d = house();
    const flat = floorElevations(d);
    const apart = explodedElevations(d, 3);
    expect(apart.get('g')).toBe(flat.get('g'));
    expect(apart.get('u')! - flat.get('u')!).toBeCloseTo(3);
    d.floors.unshift({ id: 'b', name: 'Basement' });
    expect(explodedElevations(d, 3).get('b')! - floorElevations(d).get('b')!).toBeCloseTo(-3);
  });

  it('move the walls of a floor and its roof with it', () => {
    const d = house();
    const top = (opts: { explode?: number }, key: string) => {
      const parts = sceneChunks(d, opts).find((c) => c.key === key)!.make();
      return Math.max(...parts.map((p) => (p.t === 'prism' ? p.y1 : p.t === 'box' ? p.y + p.sy / 2 : p.t === 'panel' ? Math.max(...p.pts.map((q) => q[1])) : -Infinity)));
    };
    expect(top({ explode: 2 }, 'wall:b0') - top({}, 'wall:b0')).toBeCloseTo(2);
    expect(top({ explode: 2 }, 'roof:rf') - top({}, 'roof:rf')).toBeCloseTo(2);
    expect(top({ explode: 2 }, 'wall:a0')).toBeCloseTo(top({}, 'wall:a0'));
    // the chunk is built again when the gap changes
    const deps = (gap: number) => sceneChunks(d, { explode: gap }).find((c) => c.key === 'wall:b0')!.deps;
    expect(deps(1)).not.toEqual(deps(2));
  });

  it('cut the walls of the floor shown as a dollhouse, with their windows, and drop what is above', () => {
    const d = house();
    const wallTop = (opts: Parameters<typeof sceneChunks>[1]) => {
      const parts = sceneChunks(d, opts).find((c) => c.key === 'wall:a2')!.make();
      return Math.max(...parts.map((p) => (p.t === 'prism' ? p.y1 : p.t === 'box' ? p.y + p.sy / 2 : -Infinity)));
    };
    expect(wallTop({})).toBeCloseTo(2.5);
    expect(wallTop({ dollhouse: { floor: 'g', height: 1.3 } })).toBeCloseTo(1.3);
    // the other floor's walls are not touched
    const other = sceneChunks(d, { dollhouse: { floor: 'g', height: 1.3 } }).find((c) => c.key === 'wall:b0')!.make();
    expect(Math.max(...other.map((p) => (p.t === 'prism' ? p.y1 : -Infinity)))).toBeGreaterThan(5);
  });

  it('clip parts at a height: drop what is above, shorten what crosses', () => {
    const parts: Part[] = [box(0, 1, 0, 3, 0, 1, '#fff'), box(0, 1, 2, 3, 0, 1, '#fff'), box(0, 1, 0, 1, 0, 1, '#fff')];
    const out = clipAbove(parts, 1.5);
    expect(out).toHaveLength(2);
    const first = out[0] as Extract<Part, { t: 'box' }>;
    expect(first.sy).toBeCloseTo(1.5);
    expect(first.y).toBeCloseTo(0.75);
    expect(out[1]).toBe(parts[2]);
  });
});
