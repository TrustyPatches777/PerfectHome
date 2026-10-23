import { describe, expect, it } from 'vitest';
import { createDesign, type Design } from './model';
import { DEFAULT_PRINT, buildPrintLayout, fitScale, floorsToPrint, paperSize } from './printLayout';

function plan(): { d: Design; F: string } {
  const d = createDesign();
  const F = d.floors[0].id;
  d.name = 'Our <house>';
  // a 12 x 8 m building
  for (const [id, ax, ay, bx, by] of [['t', 0, 0, 12, 0], ['r', 12, 0, 12, 8], ['b', 12, 8, 0, 8], ['l', 0, 8, 0, 0]] as const)
    d.walls.push({ id, floor: F, a: { x: ax, y: ay }, b: { x: bx, y: by }, thickness: 0.2, type: 'interior', height: 2.5 });
  return { d, F };
}

describe('paper', () => {
  it('knows paper sizes and orientation', () => {
    expect(paperSize({ paper: 'A4', landscape: true })).toEqual({ w: 297, h: 210 });
    expect(paperSize({ paper: 'A4', landscape: false })).toEqual({ w: 210, h: 297 });
    expect(paperSize({ paper: 'A3', landscape: true })).toEqual({ w: 420, h: 297 });
    expect(paperSize({ paper: 'Letter', landscape: false }).w).toBeCloseTo(215.9);
  });
});

describe('scale', () => {
  it('picks the smallest standard scale at which the plan fits', () => {
    // 13.2 x 9.2 m (with margin) on an area of 277 x 166 mm: needs 1:55.4 -> the next standard scale is 1:75
    expect(fitScale([{ w: 13.2, h: 9.2 }], { w: 277, h: 166 })).toBe(75);
    expect(fitScale([{ w: 5, h: 4 }], { w: 277, h: 166 })).toBe(25); // 4 m on 166 mm needs 1:24.1
    expect(fitScale([{ w: 5, h: 3 }, { w: 40, h: 30 }], { w: 277, h: 166 })).toBe(200); // the biggest page decides: 30 m on 166 mm needs 1:181
    expect(fitScale([{ w: 1000, h: 1000 }], { w: 277, h: 166 })).toBe(6025); // beyond the list: still a number
  });
});

describe('print layout', () => {
  it('prints the plan at true size: 1 m is 1000/scale mm', () => {
    const { d, F } = plan();
    const layout = buildPrintLayout(d, F, { ...DEFAULT_PRINT, scale: 100, paper: 'A3' });
    expect(layout.scale).toBe(100);
    expect(layout.pages).toHaveLength(1);
    // 12 m between the wall centerlines + 2 x 0.6 m margin = 13.2 m wide -> 132 mm at 1:100
    expect(layout.pages[0].widthMm).toBeCloseTo(13.2 * 10, 0);
    expect(layout.pages[0].heightMm).toBeCloseTo(9.2 * 10, 0);
    expect(layout.pages[0].fits).toBe(true);
    expect(layout.html).toContain('size: 420mm 297mm');
    expect(layout.html).toMatch(/class="frame" style="width:132mm;height:92mm"/);
    expect(layout.html).toContain('Scale 1:100');
    expect(layout.html).toContain('A3 landscape');
  });

  it('shows a scale bar of the right length, and rotates the north arrow with the compass', () => {
    const { d, F } = plan();
    d.site.north = 40;
    const html = buildPrintLayout(d, F, { ...DEFAULT_PRINT, scale: 50 }).html!;
    // at 1:50, 1 m = 20 mm; the first bar step of at least 20 mm is 1 m
    expect(html).toMatch(/class="bar" style="width:20mm"/);
    expect(html).toContain('<span>1 m</span>');
    expect(html).toContain('rotate(40deg)');
    const coarse = buildPrintLayout(d, F, { ...DEFAULT_PRINT, scale: 200 }).html!;
    expect(coarse).toMatch(/class="bar" style="width:25mm"/); // 5 m at 1:200
  });

  it('chooses a scale itself for "fit", warns when a chosen scale is too big, and escapes the title', () => {
    const { d, F } = plan();
    const fit = buildPrintLayout(d, F, { ...DEFAULT_PRINT, scale: 'fit' });
    expect(fit.scale).toBe(75); // 13.2 x 9.2 m on 277 x 166 mm
    expect(fit.pages[0].fits).toBe(true);
    const tooBig = buildPrintLayout(d, F, { ...DEFAULT_PRINT, scale: 20 });
    expect(tooBig.pages[0].fits).toBe(false);
    expect(fit.html).toContain('Our &lt;house&gt;');
    expect(fit.html).not.toContain('Our <house>');
    const portrait = buildPrintLayout(d, F, { ...DEFAULT_PRINT, landscape: false, scale: 'fit' });
    expect(portrait.availableMm.w).toBe(190);
    expect(portrait.scale).toBeLessThanOrEqual(75);
  });

  it('prints one page per floor that has something on it, top floor first, or only the current floor', () => {
    const { d, F } = plan();
    d.floors.push({ id: 'up', name: '1st floor' }, { id: 'empty', name: 'Attic' });
    d.walls.push({ id: 'u', floor: 'up', a: { x: 0, y: 0 }, b: { x: 6, y: 0 }, thickness: 0.15, type: 'interior', height: 2.5 });
    expect(floorsToPrint(d, F, 'current').map((f) => f.name)).toEqual(['Ground floor']);
    expect(floorsToPrint(d, F, 'all').map((f) => f.name)).toEqual(['1st floor', 'Ground floor']); // the empty attic is skipped
    const all = buildPrintLayout(d, F, { ...DEFAULT_PRINT, floors: 'all', scale: 'fit' });
    expect(all.pages.map((p) => p.floorName)).toEqual(['1st floor', 'Ground floor']);
    expect((all.html!.match(/<section class="page">/g) ?? []).length).toBe(2);
    expect(all.html).toContain('Our &lt;house&gt; – 1st floor');
    // all pages share the scale, chosen so the biggest fits
    expect(all.scale).toBe(75);
  });

  it('returns nothing to print for an empty design', () => {
    const d = createDesign();
    const layout = buildPrintLayout(d, d.floors[0].id, DEFAULT_PRINT);
    expect(layout.html).toBeNull();
    expect(layout.pages).toEqual([]);
  });
});
