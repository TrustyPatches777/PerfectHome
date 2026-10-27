import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { detectRoom, polygonArea } from './geometry';
import { createDesign, type Design } from './model';
import { addRoomTo, boxCorners, edgeNormal, rectWalls, refitRooms, shiftEdge } from './shapes';

const box = (): { d: Design; F: string } => {
  const d = createDesign();
  const F = d.floors[0].id;
  d.walls.push(...rectWalls({ x: 0, y: 0 }, { x: 4, y: 3 }, F, 0.2, 'interior', 2.5));
  return { d, F };
};

describe('rectangles of walls', () => {
  it('four walls that join up around the box, whichever way the corners were given', () => {
    const F = 'f';
    for (const [a, b] of [[{ x: 0, y: 0 }, { x: 4, y: 3 }], [{ x: 4, y: 3 }, { x: 0, y: 0 }], [{ x: 4, y: 0 }, { x: 0, y: 3 }]]) {
      const walls = rectWalls(a, b, F, 0.2, 'exterior', 2.5);
      expect(walls).toHaveLength(4);
      walls.forEach((w, i) => expect(w.b).toEqual(walls[(i + 1) % 4].a)); // a closed loop
      const xs = walls.flatMap((w) => [w.a.x, w.b.x]);
      expect([Math.min(...xs), Math.max(...xs)]).toEqual([0, 4]);
      expect(new Set(walls.map((w) => w.id)).size).toBe(4);
    }
    expect(boxCorners({ x: 3, y: 5 }, { x: 1, y: 2 })).toEqual([{ x: 1, y: 2 }, { x: 3, y: 2 }, { x: 3, y: 5 }, { x: 1, y: 5 }]);
  });

  it('the room inside them is found from the middle, and added once', () => {
    const { d, F } = box();
    const poly = detectRoom({ x: 2, y: 1.5 }, d.walls)!;
    expect(polygonArea(poly)).toBeCloseTo((4 - 0.2) * (3 - 0.2), 1);
    const next = produce(d, (x) => {
      expect(addRoomTo(x, F, poly, { x: 2, y: 1.5 }, '#e8eef7')).toBeTruthy();
      expect(addRoomTo(x, F, poly, { x: 2, y: 1.5 }, '#e8eef7')).toBeNull(); // would overlap
    });
    expect(next.rooms).toHaveLength(1);
    expect(next.rooms[0].name).toBe('Room 1');
  });
});

describe('pushing an edge sideways', () => {
  const rect = boxCorners({ x: 0, y: 0 }, { x: 4, y: 3 });

  it('moves the two corners of that edge along its normal and leaves the others', () => {
    // edge 1 is the right side (4,0)->(4,3); its normal points along +x
    const n = edgeNormal(rect, 1);
    expect(Math.abs(n.x)).toBeCloseTo(1);
    const out = shiftEdge(rect, 1, 2 * Math.sign(n.x));
    expect(out.map((p) => p.x)).toEqual([0, 6, 6, 0]);
    expect(out.map((p) => p.y)).toEqual([0, 0, 3, 3]);
    expect(shiftEdge(rect, 2, -1 * Math.sign(edgeNormal(rect, 2).y)).map((p) => p.y)).toEqual([0, 0, 2, 2]); // the bottom edge moved up
    expect(polygonArea(shiftEdge(rect, 1, 1 * Math.sign(n.x)))).toBeCloseTo(15);
  });

  it('wraps around: the last edge joins the last point to the first', () => {
    const out = shiftEdge(rect, 3, 0.5 * Math.sign(edgeNormal(rect, 3).x)); // left side
    expect(out[3].x).toBeCloseTo(0.5, 5);
    expect(out[0].x).toBeCloseTo(0.5, 5);
    expect(out[1].x).toBe(4);
  });
});

describe('rooms follow their walls', () => {
  const grown = (d: Design, dx: number) =>
    produce(d, (x) => {
      // drag the right wall and the ends of the walls joined to it
      for (const w of x.walls) {
        if (w.a.x === 4) w.a.x += dx;
        if (w.b.x === 4) w.b.x += dx;
      }
    });

  it('a room found from its walls grows when the wall is moved', () => {
    const { d, F } = box();
    const start = produce(d, (x) => void addRoomTo(x, F, detectRoom({ x: 2, y: 1.5 }, x.walls)!, { x: 2, y: 1.5 }, '#fff'));
    const before = polygonArea(start.rooms[0].points);
    const moved = grown(start, 2);
    expect(polygonArea(moved.rooms[0].points)).toBeCloseTo(before); // not yet
    const refit = produce(moved, (x) => void expect(refitRooms(x, F)).toBe(1));
    expect(polygonArea(refit.rooms[0].points)).toBeCloseTo((6 - 0.2) * (3 - 0.2), 1);
  });

  it('a room drawn by hand (no seed) is left alone', () => {
    const { d, F } = box();
    const drawn = produce(d, (x) => void addRoomTo(x, F, [{ x: 0.1, y: 0.1 }, { x: 3.9, y: 0.1 }, { x: 3.9, y: 2.9 }, { x: 0.1, y: 2.9 }], undefined, '#fff'));
    const refit = produce(grown(drawn, 2), (x) => void expect(refitRooms(x, F)).toBe(0));
    expect(refit.rooms[0].points).toEqual(drawn.rooms[0].points);
  });

  it('does not grow into a neighbouring room', () => {
    const { d, F } = box();
    const two = produce(d, (x) => {
      addRoomTo(x, F, detectRoom({ x: 2, y: 1.5 }, x.walls)!, { x: 2, y: 1.5 }, '#fff');
      addRoomTo(x, F, [{ x: 4.5, y: 0.1 }, { x: 7, y: 0.1 }, { x: 7, y: 2.9 }, { x: 4.5, y: 2.9 }], undefined, '#eee');
    });
    const refit = produce(grown(two, 3), (x) => void expect(refitRooms(x, F)).toBe(0));
    expect(refit.rooms[0].points).toEqual(two.rooms[0].points);
  });

  it('only looks at the walls and rooms of its floor', () => {
    const { d, F } = box();
    const start = produce(d, (x) => void addRoomTo(x, F, detectRoom({ x: 2, y: 1.5 }, x.walls)!, { x: 2, y: 1.5 }, '#fff'));
    const refit = produce(grown(start, 2), (x) => void expect(refitRooms(x, 'another-floor')).toBe(0));
    expect(refit.rooms).toHaveLength(1);
  });
});
