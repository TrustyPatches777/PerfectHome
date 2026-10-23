import { describe, expect, it } from 'vitest';
import { findIssues } from './checks';
import { createDesign, type Design } from './model';

function room() {
  const d = createDesign();
  const F = d.floors[0].id;
  const wall = (id: string, ax: number, ay: number, bx: number, by: number) => d.walls.push({ id, floor: F, a: { x: ax, y: ay }, b: { x: bx, y: by }, thickness: 0.2, type: 'interior', height: 2.5 });
  wall('t', 0, 0, 6, 0);
  wall('r', 6, 0, 6, 5);
  wall('b', 6, 5, 0, 5);
  wall('l', 0, 5, 0, 0);
  return { d, F };
}
const furn = (d: Design, id: string, type: string, x: number, y: number, w: number, dd: number, rotation = 0) =>
  d.furniture.push({ id, floor: d.floors[0].id, type, x, y, w, d: dd, rotation, color: '#fff', label: '' });
const door = (d: Design, id: string, pos: number, over: object = {}) =>
  d.openings.push({ id, wallId: 't', kind: 'door', pos, width: 0.9, swing: 1, hinge: 'a', ...over } as Design['openings'][number]);

describe('plan check', () => {
  it('finds nothing wrong with a sensible room', () => {
    const { d, F } = room();
    door(d, 'o', 3);
    furn(d, 'bed', 'bed-double', 0.9, 3.9, 1.6, 2); // against the left and bottom walls
    furn(d, 'sofa', 'sofa', 4.9, 3.7, 2, 0.9); // against the right wall
    furn(d, 'rug', 'rug', 3, 2, 2, 1.4); // flat, never an obstacle
    expect(findIssues(d, F)).toEqual([]);
  });

  it('flags a door that cannot open because furniture is in its swing', () => {
    const { d, F } = room();
    door(d, 'o', 3); // swings to +y, a 90 cm quarter circle from the hinge at x = 2.55
    furn(d, 'wardrobe', 'wardrobe', 3, 0.7, 1.8, 0.6);
    const issues = findIssues(d, F);
    const blocked = issues.filter((i) => i.kind === 'door-blocked');
    expect(blocked).toHaveLength(1);
    expect(blocked[0].message).toMatch(/door cannot open fully: wardrobe/i);
    expect(blocked[0].refs.map((r) => r.kind)).toEqual(['opening', 'furniture']);
    expect(blocked[0].polygon!.length).toBeGreaterThan(5);
  });

  it('flags double doors if either leaf is blocked, and doors that hit each other', () => {
    const { d, F } = room();
    door(d, 'dd', 3, { kind: 'double', width: 1.6 });
    furn(d, 'chest', 'dresser', 3.6, 0.5, 1.2, 0.5);
    expect(findIssues(d, F).some((i) => i.kind === 'door-blocked' && /double door/.test(i.message))).toBe(true);

    const two = room();
    door(two.d, 'a', 2);
    door(two.d, 'b', 2.8); // overlapping swings, hinged to the same side
    expect(findIssues(two.d, two.F).some((i) => i.kind === 'door-collision')).toBe(true);
  });

  it('flags furniture overlapping a wall but not furniture touching it', () => {
    const { d, F } = room();
    furn(d, 'ok', 'sofa', 3, 0.1 + 0.45, 2, 0.9); // exactly against the inner face
    furn(d, 'bad', 'bed-double', 1.2, 0.1, 1.6, 2, 0); // pokes into the top wall
    const inwall = findIssues(d, F).filter((i) => i.kind === 'in-wall');
    expect(inwall).toHaveLength(1);
    expect(inwall[0].refs[0].id).toBe('bad');
  });

  it('flags a passage that is too narrow, honoring the minimum you set', () => {
    const { d, F } = room();
    furn(d, 'a', 'wardrobe', 1.0, 2.5, 1.8, 0.6); // against the left wall
    furn(d, 'b', 'sofa', 1.0, 3.7, 1.8, 0.9); // 45 cm of floor between them: (3.7 - 0.45) - (2.5 + 0.3)
    const found = findIssues(d, F, 0.7).filter((i) => i.kind === 'narrow-gap');
    expect(found).toHaveLength(1);
    expect(found[0].message).toMatch(/Only 45 cm between Wardrobe and Sofa/);
    expect(found[0].line).toBeDefined();
    expect(findIssues(d, F, 0.4).filter((i) => i.kind === 'narrow-gap')).toHaveLength(0); // 45 cm is fine for a 40 cm minimum
    // pieces that touch, or are far apart, are not passages
    furn(d, 'c', 'bookshelf', 5, 2.5, 0.9, 0.3);
    expect(findIssues(d, F, 0.7).filter((i) => i.kind === 'narrow-gap')).toHaveLength(1);
  });

  it('ignores low and small things (coffee tables, chairs) and pieces that are not side by side', () => {
    const { d, F } = room();
    furn(d, 'sofa', 'sofa', 3, 3.4, 2, 0.9);
    furn(d, 'table', 'coffee-table', 3, 2.65, 1.1, 0.6); // 25 cm gap, but low: you can step over it
    furn(d, 'chair', 'chair', 3, 4.3, 0.45, 0.45); // small, 25 cm from the sofa
    furn(d, 'plant', 'plant', 1, 4.6, 0.5, 0.5);
    expect(findIssues(d, F, 0.7).filter((i) => i.kind === 'narrow-gap')).toHaveLength(0);
    // diagonal neighbours do not face each other
    const diag = room();
    furn(diag.d, 'a', 'wardrobe', 1.5, 1.5, 1, 1);
    furn(diag.d, 'b', 'wardrobe', 2.8, 2.8, 1, 1);
    expect(findIssues(diag.d, diag.F, 0.7)).toEqual([]);
  });

  it('only looks at the given floor', () => {
    const { d } = room();
    door(d, 'o', 3);
    furn(d, 'wardrobe', 'wardrobe', 3, 0.7, 1.8, 0.6);
    expect(findIssues(d, 'another-floor')).toEqual([]);
  });
});
