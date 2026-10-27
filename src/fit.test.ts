import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { exemptFromWalls, footprint, pushOut, settleFurniture, settledPosition, sweepPosition, wallObstacles } from './fit';
import { createDesign, type Design, type Furniture, type Wall } from './model';

const wall = (id: string, floor: string, ax: number, ay: number, bx: number, by: number, extra: Partial<Wall> = {}): Wall => ({ id, floor, a: { x: ax, y: ay }, b: { x: bx, y: by }, thickness: 0.2, type: 'interior', height: 2.5, ...extra });
const item = (id: string, floor: string, x: number, y: number, extra: Partial<Furniture> = {}): Furniture => ({ id, floor, type: 'sofa', x, y, w: 2, d: 0.9, rotation: 0, color: '#b7c9a8', label: '', ...extra });

function room(): { d: Design; F: string } {
  const d = createDesign();
  const F = d.floors[0].id;
  // a 6 x 4 room, walls 20 cm thick (inner faces at 0.1 and 5.9 / 3.9)
  d.walls.push(wall('n', F, 0, 0, 6, 0), wall('e', F, 6, 0, 6, 4), wall('s', F, 6, 4, 0, 4), wall('w', F, 0, 4, 0, 0));
  return { d, F };
}

describe('pushing furniture out of walls', () => {
  it('pushOut finds the shortest way out, and ignores shapes that only touch', () => {
    const a = footprint({ x: 5, y: 0.3, w: 2, d: 0.9, rotation: 0 });
    const b = [{ x: 0, y: -0.1 }, { x: 10, y: -0.1 }, { x: 10, y: 0.1 }, { x: 0, y: 0.1 }];
    const push = pushOut(a, b)!;
    expect(push.x).toBeCloseTo(0, 5);
    expect(push.y).toBeCloseTo(0.25, 2); // bottom side of the sofa to the wall face: 0.1 - (0.3 - 0.45) = 0.25
    expect(pushOut(footprint({ x: 5, y: 0.55, w: 2, d: 0.9, rotation: 0 }), b)).toBeNull(); // exactly touching
    expect(pushOut(footprint({ x: 5, y: 2, w: 2, d: 0.9, rotation: 0 }), b)).toBeNull();
  });

  it('a piece of furniture dropped on a wall ends up against it, on the side it was nearer to', () => {
    const { d, F } = room();
    const fromInside = settledPosition(d, item('a', F, 3, 0.3))!;
    expect(fromInside.y).toBeCloseTo(0.1 + 0.45, 2);
    expect(fromInside.x).toBe(3);
    const fromOutside = settledPosition(d, item('b', F, 3, -0.3))!;
    expect(fromOutside.y).toBeCloseTo(-0.1 - 0.45, 2);
  });

  it('slides along the wall and settles into a corner', () => {
    const { d, F } = room();
    const corner = settledPosition(d, item('c', F, 0.4, 0.4))!;
    expect(corner.x).toBeCloseTo(0.1 + 1, 2); // 2 m wide: its left edge against the west wall
    expect(corner.y).toBeCloseTo(0.1 + 0.45, 2);
    const turned = item('t', F, 5.5, 3.5, { rotation: 90 }); // 0.9 wide, 2 deep when turned
    const spot = settledPosition(d, turned)!;
    expect(spot.x).toBeCloseTo(5.9 - 0.45, 2);
    expect(spot.y).toBeCloseTo(3.9 - 1, 2);
  });

  it('works at any angle: the result never overlaps a wall', () => {
    const { d, F } = room();
    for (let deg = 0; deg < 180; deg += 17) {
      const spot = settledPosition(d, item('r', F, 3, 0.2, { rotation: deg }))!;
      const poly = footprint({ x: spot.x, y: spot.y, w: 2, d: 0.9, rotation: deg });
      for (const o of wallObstacles(d, F)) expect(pushOut(poly, o), `${deg}°`).toBeNull();
    }
  });

  it('follows curved walls', () => {
    const d = createDesign();
    const F = d.floors[0].id;
    d.walls.push(wall('c', F, 0, 0, 6, 0, { bulge: 1.5 })); // bulges to +y
    const spot = settledPosition(d, item('s', F, 3, 1.3, { w: 1, d: 1 }))!; // in the arc's wall
    const poly = footprint({ x: spot.x, y: spot.y, w: 1, d: 1, rotation: 0 });
    for (const o of wallObstacles(d, F)) expect(pushOut(poly, o)).toBeNull();
  });

  it('refuses when it does not fit between two walls', () => {
    const d = createDesign();
    const F = d.floors[0].id;
    d.walls.push(wall('a', F, 0, 0, 10, 0), wall('b', F, 0, 0.8, 10, 0.8)); // a 0.6 m slot
    expect(settledPosition(d, item('x', F, 5, 0.4, { w: 2, d: 1 }))).toBeNull();
    expect(settledPosition(d, item('y', F, 5, 0.4, { w: 2, d: 0.5 }))).not.toBeNull();
  });

  it('lets wall-mounted things, lamps, rugs and tree crowns overlap walls, but not tables and cars', () => {
    const { d, F } = room();
    for (const type of ['socket', 'radiator', 'lamp-ceiling', 'lamp-wall', 'rug', 'tree', 'bush']) {
      expect(exemptFromWalls(item('e', F, 0, 0, { type })), type).toBe(true);
      expect(settledPosition(d, item('e', F, 0.1, 0.1, { type, w: 0.3, d: 0.3 })), type).toEqual({ x: 0.1, y: 0.1 });
    }
    for (const type of ['dining-table', 'car', 'wardrobe', 'pool', 'bed-double', 'shed']) expect(exemptFromWalls(item('n', F, 0, 0, { type })), type).toBe(false);
  });

  it('only walls on the same floor count', () => {
    const { d } = room();
    d.floors.push({ id: 'up', name: '1st' });
    expect(settledPosition(d, item('u', 'up', 3, 0.1))).toEqual({ x: 3, y: 0.1 });
  });
});

describe('moving through walls', () => {
  it('a quick drag cannot jump over a thin wall: the item stops at it', () => {
    const { d, F } = room(); // east wall at x = 6, 20 cm thick; the sofa is 2 m wide
    const from = item('s', F, 3, 2);
    const stop = sweepPosition(d, from, { ...from, x: 9 });
    expect(stop.x).toBeCloseTo(5.9 - 1, 2);
    expect(stop.y).toBeCloseTo(2, 5);
  });

  it('slides along the wall when the drag is diagonal', () => {
    const { d, F } = room();
    const from = item('s', F, 3, 2);
    const stop = sweepPosition(d, from, { ...from, x: 9, y: 3 });
    expect(stop.x).toBeCloseTo(4.9, 2);
    expect(stop.y).toBeCloseTo(3, 1);
    const north = sweepPosition(d, from, { ...from, y: -5 });
    expect(north.y).toBeCloseTo(0.1 + 0.45, 2);
  });

  it('a free move is exactly what was asked for', () => {
    const { d, F } = room();
    const from = item('s', F, 3, 2);
    expect(sweepPosition(d, from, { ...from, x: 4, y: 2.5 })).toEqual({ x: 4, y: 2.5 });
  });

  it('settleFurniture uses it for moved items', () => {
    const { d, F } = room();
    d.furniture.push(item('s', F, 3, 2));
    const edited = produce(d, (x) => void (x.furniture[0].x = 9));
    expect(settleFurniture(d, edited).design.furniture[0].x).toBeCloseTo(4.9, 2);
  });
});

describe('settling after an edit', () => {
  it('pushes the item that was moved, and leaves others (even ones already stuck in a wall) alone', () => {
    const { d, F } = room();
    d.furniture.push(item('old', F, 3, 0.1), item('moving', F, 3, 2));
    const edited = produce(d, (x) => void (x.furniture[1].y = 0.2));
    const { design, refused } = settleFurniture(d, edited);
    expect(refused).toBe(0);
    expect(design.furniture[1].y).toBeCloseTo(0.55, 2);
    expect(design.furniture[0]).toBe(d.furniture[0]); // untouched, although it overlaps the wall
    // only a color changed: no moving at all
    const recolored = produce(d, (x) => void (x.furniture[0].color = '#ff0000'));
    expect(settleFurniture(d, recolored).design.furniture[0].y).toBe(0.1);
  });

  it('puts an item back where it was when a resize or turn leaves no room, and drops a new one', () => {
    const d = createDesign();
    const F = d.floors[0].id;
    d.walls.push(wall('a', F, 0, 0, 10, 0), wall('b', F, 0, 0.8, 10, 0.8));
    d.furniture.push(item('s', F, 5, 0.4, { w: 2, d: 0.5 })); // sits in the slot
    const moved = produce(d, (x) => void (x.furniture[0].d = 1)); // would be too deep for it
    const kept = settleFurniture(d, moved);
    expect(kept.refused).toBe(1);
    expect(kept.design.furniture[0].d).toBe(0.5);
    const added = produce(d, (x) => void x.furniture.push(item('n', F, 5, 0.4, { w: 2, d: 1 })));
    const dropped = settleFurniture(d, added);
    expect(dropped.refused).toBe(1);
    expect(dropped.design.furniture.map((f) => f.id)).toEqual(['s']);
  });

  it('does nothing while the walls are being edited', () => {
    const { d, F } = room();
    d.furniture.push(item('s', F, 3, 2));
    const edited = produce(d, (x) => {
      x.walls[0].a.y = 2;
      x.walls[0].b.y = 2;
      x.furniture[0].x = 3.5;
    });
    expect(settleFurniture(d, edited).design).toBe(edited);
  });
});
