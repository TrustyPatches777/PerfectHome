import { describe, expect, it } from 'vitest';
import { CATALOG, CATEGORIES, catalogItem, fillColor, shade } from './catalog';

describe('furniture catalog', () => {
  it('has unique ids, known categories, real-world sizes and a symbol for every item', () => {
    const types = CATALOG.map((c) => c.type);
    expect(new Set(types).size).toBe(types.length);
    for (const c of CATALOG) {
      expect(CATEGORIES, c.type).toContain(c.category);
      expect(c.label.length, c.type).toBeGreaterThan(0);
      expect(c.w, c.type).toBeGreaterThan(0.05);
      expect(c.d, c.type).toBeGreaterThan(0.05);
      expect(Math.max(c.w, c.d), c.type).toBeLessThan(12);
      expect(c.color, c.type).toMatch(/^#[0-9a-f]{6}$/i);
      expect(c.shapes.length, c.type).toBeGreaterThan(0);
    }
  });

  it('draws every shape inside (or just on the edge of) the item box', () => {
    for (const c of CATALOG) {
      for (const p of c.shapes) {
        const xs = p.t === 'line' ? p.pts.filter((_, i) => i % 2 === 0) : [p.x, p.x + p.w];
        const ys = p.t === 'line' ? p.pts.filter((_, i) => i % 2 === 1) : [p.y, p.y + p.h];
        for (const v of [...xs, ...ys]) {
          expect(v, `${c.type} has a shape outside its box`).toBeGreaterThanOrEqual(-0.001);
          expect(v, `${c.type} has a shape outside its box`).toBeLessThanOrEqual(1.001);
        }
      }
    }
  });

  it('has every category filled, including cars and garden items', () => {
    for (const cat of CATEGORIES) expect(CATALOG.some((c) => c.category === cat), cat).toBe(true);
    expect(catalogItem('car').w).toBeGreaterThan(4);
    expect(catalogItem('tree').category).toBe('Outdoor');
    expect(catalogItem('does-not-exist').type).toBe('box');
  });

  it('derives fills from the item color', () => {
    expect(shade('#808080', 1)).toBe('#ffffff');
    expect(shade('#808080', -1)).toBe('#000000');
    expect(fillColor('white', '#123456')).toBe('#ffffff');
    expect(fillColor('body', '#123456')).toBe('#123456');
  });
});
