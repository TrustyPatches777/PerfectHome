import { describe, expect, it } from 'vitest';
import { createDesign } from '../model';
import { floorBelow, isBasement } from './floor';

describe('which floor to line things up with', () => {
  const d = createDesign();
  const ground = d.floors[0].id;
  // lowest first: two basements, the ground floor, a floor above and an attic
  d.floors = [{ id: 'b2', name: 'Basement 2' }, { id: 'b1', name: 'Basement' }, { id: ground, name: 'Ground floor' }, { id: 'up', name: '1st floor' }, { id: 'attic', name: 'Attic', attic: true }];

  it('is the floor below, but for a basement the floor above it (it has nothing below)', () => {
    expect(floorBelow(d, 'up')).toBe(ground);
    expect(floorBelow(d, 'attic')).toBe('up');
    expect(floorBelow(d, ground)).toBe('b1');
    expect(floorBelow(d, 'b1')).toBe(ground);
    expect(floorBelow(d, 'b2')).toBe('b1');
  });

  it('is nothing on a single floor, and recognises basements by name', () => {
    const one = createDesign();
    expect(floorBelow(one, one.floors[0].id)).toBeNull();
    expect(isBasement({ name: 'Basement 2' })).toBe(true);
    expect(isBasement({ name: 'Ground floor' })).toBe(false);
  });
});
