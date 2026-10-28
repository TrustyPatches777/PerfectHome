import { describe, expect, it } from 'vitest';
import { CATALOG, CATEGORIES, catalogItem, furnitureHeight } from './catalog';
import { MORE_ITEMS } from './catalogMore';
import { createDesign } from './model';
import { exemptFromWalls } from './fit';
import { furnitureChunk } from './view3d/build';
import { COUNTERTOP } from './view3d/furniture3d2';
import { partsBounds } from './view3d/parts';

const d = createDesign();
const F = d.floors[0].id;
const fur = (id: string, type: string, x = 0, y = 0) => {
  const c = catalogItem(type);
  return { id, floor: F, type, x, y, w: c.w, d: c.d, rotation: 0, color: c.color, label: '' };
};

describe('the larger catalog', () => {
  it('every new item is in the catalog under a category the palette lists', () => {
    const types = new Set(CATALOG.map((c) => c.type));
    for (const it of MORE_ITEMS) {
      expect(types.has(it.type), it.type).toBe(true);
      expect(CATEGORIES.includes(it.category), `${it.type}: ${it.category}`).toBe(true);
    }
    expect(new Set(CATALOG.map((c) => c.type)).size).toBe(CATALOG.length); // no duplicates
    for (const cat of ['Built-in', 'Heating & cooling', 'People & pets', 'Window dressing']) expect(MORE_ITEMS.some((i) => i.category === cat), cat).toBe(true);
  });

  it('has the kitchen run, appliances, bedroom, living, bathroom, garden, climate, people and curtain items that were asked for', () => {
    const want = [
      'unit-base', 'unit-wall', 'unit-tall', 'unit-hob', 'unit-corner', 'worktop', 'range-hood', 'microwave', 'oven', 'cooktop', 'coffee-machine', 'rice-cooker', 'thermomix',
      'wardrobe-walkin', 'wardrobe-sliding', 'headboard-padded', 'changing-table', 'mirror-wall',
      'sofa-u', 'sofa-chaise', 'recliner', 'ottoman', 'console-table', 'tv-stand', 'bar-cart', 'fireplace-surround', 'bench', 'banquette', 'breakfast-nook',
      'bath-corner', 'bath-freestanding', 'shower-walkin', 'towel-rail', 'towel-rail-heated', 'vanity-mirror',
      'column-round', 'column-square', 'beam', 'wardrobe-fitted', 'wall-niche', 'wall-shelf',
      'pergola', 'gazebo', 'carport', 'awning', 'gate-garden', 'retaining-wall', 'garden-steps', 'paving-grid', 'tree-oak', 'tree-pine', 'tree-birch',
      'underfloor', 'heat-pump', 'ac-split', 'duct', 'flue', 'wood-stove',
      'person', 'person-child', 'dog', 'cat', 'curtain', 'blind-roller',
    ];
    const types = new Set(CATALOG.map((c) => c.type));
    for (const t of want) expect(types.has(t), t).toBe(true);
  });

  it('units, wardrobes and curtains snap to a wall and may stand against it; columns and beams are structure', () => {
    for (const t of ['unit-base', 'unit-wall', 'unit-tall', 'worktop', 'wardrobe-fitted', 'curtain', 'blind-roller', 'range-hood', 'mirror-wall']) {
      expect(catalogItem(t).wallMounted, t).toBe(true);
      expect(exemptFromWalls({ type: t }), t).toBe(true);
    }
    for (const t of ['column-round', 'column-square', 'beam']) expect(catalogItem(t).layer, t).toBe('structure');
    for (const t of ['duct', 'vent', 'flue', 'underfloor', 'ceiling-fan']) expect(catalogItem(t).layer, t).toBe('tech');
  });

  it('countertop appliances stand on the worktop under them, and on the floor when there is none', () => {
    for (const t of COUNTERTOP) {
      const on = { ...d, furniture: [fur('c', 'counter'), fur('a', t)] };
      const alone = { ...d, furniture: [fur('a', t)] };
      const lifted = partsBounds(furnitureChunk(on, on.furniture[1], 0)).minY;
      const ground = partsBounds(furnitureChunk(alone, alone.furniture[0], 0)).minY;
      expect(lifted, t).toBeGreaterThanOrEqual(0.85);
      expect(ground, t).toBeLessThan(0.05);
    }
  });

  it('a wall unit hangs above a base unit, a hob stands on the floor level of the run, columns reach the ceiling', () => {
    const wall = partsBounds(furnitureChunk(d, fur('w', 'unit-wall'), 0));
    expect(wall.minY).toBeGreaterThan(1.3);
    expect(wall.maxY).toBeLessThan(2.4);
    const col = partsBounds(furnitureChunk(d, fur('c', 'column-round'), 0));
    expect(col.minY).toBeCloseTo(0);
    expect(col.maxY).toBeCloseTo(furnitureHeight(fur('c', 'column-round')));
    const beam = partsBounds(furnitureChunk(d, fur('b', 'beam'), 0));
    expect(beam.maxY).toBeCloseTo(2.5); // the ceiling
  });

  it('people are the right size, to judge a room by', () => {
    expect(furnitureHeight(fur('p', 'person'))).toBeCloseTo(1.75);
    const p = partsBounds(furnitureChunk(d, fur('p', 'person'), 0));
    expect(p.maxY).toBeGreaterThan(1.6);
    expect(p.maxY).toBeLessThan(1.9);
    expect(partsBounds(furnitureChunk(d, fur('k', 'person-child'), 0)).maxY).toBeLessThan(1.25);
  });
});
