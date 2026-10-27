import { describe, expect, it } from 'vitest';
import { dist, polygonArea, wallArc, wallLength } from './geometry';
import { allRefsOnFloor, mirrorRefs, mirroredRotation } from './mirror';
import { createDesign, parseDesign, type Design, type Opening, type Stair, type Wall } from './model';
import { mergePolygons, mergeRooms, splitRoom } from './roomEdit';
import { floorCenter, scaleFloor, stretchFromBase } from './resize';
import { checkStair, flightSplit, stairOutline, stairShapes, stairSteps, stairTopAt } from './stairs';
import { alignWall, cornerOf, cutCorner, joinWalls, lineIntersection, meetWalls, offsetWall, setThickness, spaceOpenings, splitWall } from './wallEdit';

const wall = (id: string, ax: number, ay: number, bx: number, by: number, extra: Partial<Wall> = {}): Wall => ({ id, floor: 'f', a: { x: ax, y: ay }, b: { x: bx, y: by }, thickness: 0.2, type: 'interior', height: 2.5, ...extra });
const op = (id: string, wallId: string, pos: number, width = 1, extra: Partial<Opening> = {}): Opening => ({ id, wallId, kind: 'door', pos, width, swing: 1, hinge: 'a', ...extra });
const rect = (id: string, x0: number, y0: number, x1: number, y1: number) => ({ id, floor: 'f', name: id, color: '#eee', material: 'plain' as const, living: true, points: [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }] });
function base(): Design {
  const d = createDesign();
  d.floors[0].id = 'f';
  return d;
}

describe('mirror', () => {
  it('turns a floor over left to right and back again', () => {
    const d = base();
    d.walls.push(wall('w', 0, 0, 4, 0, { bulge: 0.5, paint: { l: { finish: 'brick', color: '#a00' } } }), wall('v', 4, 0, 4, 3));
    d.openings.push(op('o', 'w', 2, 1, { swing: 1 }));
    d.rooms.push({ ...rect('r', 0, 0, 4, 3), seed: { x: 1, y: 1 } });
    d.furniture.push({ id: 'b', floor: 'f', type: 'bed-double', x: 1, y: 1, w: 1.6, d: 2, rotation: 30, color: '#ccc', label: '' });
    d.stairs.push({ id: 's', floor: 'f', kind: 'l', x: 3, y: 2, w: 2, d: 2, rotation: 0, steps: 16, rise: 2.8, flip: false });
    const before = JSON.parse(JSON.stringify(d)) as Design;
    mirrorRefs(d, allRefsOnFloor(d, 'f'), 'x', 2);
    expect(d.walls[0].a).toEqual({ x: 4, y: 0 });
    expect(d.walls[0].b).toEqual({ x: 0, y: 0 });
    expect(d.walls[0].bulge).toBe(-0.5);
    expect(d.walls[0].paint).toEqual({ r: { finish: 'brick', color: '#a00' } }); // the left face became the right face
    expect(d.openings[0].swing).toBe(-1);
    expect(polygonArea(d.rooms[0].points)).toBeCloseTo(12);
    expect(d.rooms[0].seed).toEqual({ x: 3, y: 1 });
    expect(d.furniture[0]).toMatchObject({ x: 3, y: 1, rotation: 330 });
    expect(d.stairs[0]).toMatchObject({ x: 1, flip: true });
    mirrorRefs(d, allRefsOnFloor(d, 'f'), 'x', 2); // twice is the same as not at all
    expect(JSON.parse(JSON.stringify(d.walls))).toEqual(before.walls);
    expect(d.furniture[0].rotation).toBeCloseTo(30);
    expect(d.stairs[0].flip).toBe(false);
    expect(d.openings[0].swing).toBe(1);
  });

  it('top to bottom, with the rotations that go with it', () => {
    expect(mirroredRotation(0, 'x')).toBe(0);
    expect(mirroredRotation(90, 'x')).toBe(270);
    expect(mirroredRotation(0, 'y')).toBe(180);
    expect(mirroredRotation(90, 'y')).toBe(90);
    const d = base();
    d.furniture.push({ id: 'b', floor: 'f', type: 'sofa', x: 1, y: 1, w: 2, d: 1, rotation: 0, color: '#ccc', label: '' });
    mirrorRefs(d, [{ kind: 'furniture', id: 'b' }], 'y', 2);
    expect(d.furniture[0]).toMatchObject({ x: 1, y: 3, rotation: 180 });
  });

  it('only what is selected turns over', () => {
    const d = base();
    d.walls.push(wall('a', 0, 0, 2, 0), wall('b', 5, 0, 7, 0));
    mirrorRefs(d, [{ kind: 'wall', id: 'a' }], 'x', 1);
    expect(d.walls[0].a.x).toBe(2);
    expect(d.walls[1].a.x).toBe(5);
  });
});

describe('splitting and joining walls', () => {
  it('a straight wall splits in two and the openings go to the right piece; joining puts it back', () => {
    const d = base();
    d.walls.push(wall('w', 0, 0, 10, 0, { paint: { r: { finish: 'paint', color: '#fff' } } }));
    d.openings.push(op('d1', 'w', 2), op('d2', 'w', 8));
    const id = splitWall(d, 'w', 5)!;
    expect(id).toBeTruthy();
    expect(d.walls).toHaveLength(2);
    expect(d.walls[0].b).toEqual({ x: 5, y: 0 });
    expect(d.walls[1]).toMatchObject({ a: { x: 5, y: 0 }, b: { x: 10, y: 0 } });
    expect(d.walls[1].paint).toEqual(d.walls[0].paint);
    expect(d.openings.find((o) => o.id === 'd1')).toMatchObject({ wallId: 'w', pos: 2 });
    expect(d.openings.find((o) => o.id === 'd2')).toMatchObject({ wallId: id, pos: 3 });
    expect(joinWalls(d, 'w', id)).toBe('w');
    expect(d.walls).toHaveLength(1);
    expect(d.walls[0]).toMatchObject({ a: { x: 0, y: 0 }, b: { x: 10, y: 0 } });
    expect(d.openings.find((o) => o.id === 'd2')).toMatchObject({ wallId: 'w', pos: 8 });
  });

  it('it will not cut in the middle of a door, at an end, or join walls that do not line up', () => {
    const d = base();
    d.walls.push(wall('w', 0, 0, 10, 0), wall('v', 10, 0, 10, 5), wall('u', 10, 0, 14, 0));
    d.openings.push(op('d', 'w', 5, 1));
    expect(splitWall(d, 'w', 5.2)).toBeNull();
    expect(splitWall(d, 'w', 0.01)).toBeNull();
    expect(joinWalls(d, 'w', 'v')).toBeNull(); // a corner, not a straight run
    expect(joinWalls(d, 'w', 'u')).toBe('w'); // reading the second one the other way round works too
    expect(d.walls.find((w) => w.id === 'w')!.b.x).toBe(14);
  });

  it('a curved wall splits into two arcs that make the same curve', () => {
    const d = base();
    d.walls.push(wall('w', 0, 0, 6, 0, { bulge: 1 }));
    const L = wallLength(d.walls[0]);
    const arc = wallArc(d.walls[0])!;
    const id = splitWall(d, 'w', L / 3)!;
    const [p, q] = d.walls;
    expect(wallLength(p) + wallLength(q)).toBeCloseTo(L, 1);
    expect(wallArc(p)!.r).toBeCloseTo(arc.r, 1);
    expect(wallArc(q)!.r).toBeCloseTo(arc.r, 1);
    expect(dist(p.b, { x: arc.c.x, y: arc.c.y })).toBeCloseTo(arc.r, 2); // the cut is on the circle
    expect(q.id).toBe(id);
    expect(Math.sign(p.bulge!)).toBe(Math.sign(q.bulge!));
  });
});

describe('meeting, offsetting, thickening', () => {
  it('two walls that do not quite meet are trimmed or extended to the corner', () => {
    const d = base();
    d.walls.push(wall('a', 0, 0, 4, 0), wall('b', 5, 1, 5, 6));
    expect(lineIntersection(d.walls[0], d.walls[1])).toEqual({ x: 5, y: 0 });
    d.openings.push(op('d', 'a', 2, 1));
    expect(meetWalls(d, 'a', 'b')).toBe(true);
    expect(d.walls[0].b).toEqual({ x: 5, y: 0 });
    expect(d.walls[1].a).toEqual({ x: 5, y: 0 });
    expect(d.openings[0].pos).toBe(2); // the door stays where it is
    d.walls.push(wall('p', 0, 3, 4, 3));
    expect(meetWalls(d, 'a', 'p')).toBe(false); // parallel
  });

  it('moving the start of a wall keeps its openings in the same place in the room', () => {
    const d = base();
    d.walls.push(wall('a', 2, 0, 8, 0), wall('b', 0, -3, 0, 3));
    d.openings.push(op('d', 'a', 3, 1)); // at x = 5
    meetWalls(d, 'a', 'b'); // the start of a is extended to x = 0
    expect(d.walls[0].a).toEqual({ x: 0, y: 0 });
    expect(d.openings[0].pos).toBe(5);
  });

  it('offset moves a wall sideways; thickening keeps one face where it is', () => {
    const d = base();
    d.walls.push(wall('a', 0, 0, 4, 0, { thickness: 0.2 }));
    offsetWall(d, 'a', 0.5);
    expect(d.walls[0].a.y).toBeCloseTo(0.5); // to the right of a→b is down on the plan
    d.walls[0].a.y = d.walls[0].b.y = 0;
    setThickness(d, 'a', 0.4, 'l'); // the left face (y = -0.1) stays
    expect(d.walls[0].thickness).toBe(0.4);
    expect(d.walls[0].a.y - 0.2).toBeCloseTo(0.1 - 0.2 + 0.2 - 0.2 + 0); // centre at y = 0.1: faces at -0.1 and 0.3
    expect(d.walls[0].a.y).toBeCloseTo(0.1);
    setThickness(d, 'a', 0.2, 'middle');
    expect(d.walls[0].a.y).toBeCloseTo(0.1);
  });
});

describe('corners', () => {
  const corner = () => {
    const d = base();
    d.walls.push(wall('a', 0, 0, 5, 0), wall('b', 5, 0, 5, 5));
    return d;
  };

  it('a chamfer cuts both walls back and puts a straight wall across the corner', () => {
    const d = corner();
    const id = cutCorner(d, 'a', 'b', 1, false)!;
    expect(d.walls[0].b).toEqual({ x: 4, y: 0 });
    expect(d.walls[1].a).toEqual({ x: 5, y: 1 });
    const piece = d.walls.find((w) => w.id === id)!;
    expect(piece.a).toEqual({ x: 4, y: 0 });
    expect(piece.b).toEqual({ x: 5, y: 1 });
    expect(piece.bulge).toBeUndefined();
  });

  it('a rounded corner is an arc of the radius asked for that touches both walls', () => {
    const d = corner();
    const id = cutCorner(d, 'a', 'b', 1, true)!;
    // a right angle: the arc starts one radius back from the corner
    expect(d.walls[0].b.x).toBeCloseTo(4);
    expect(d.walls[1].a.y).toBeCloseTo(1);
    const piece = d.walls.find((w) => w.id === id)!;
    const arc = wallArc(piece)!;
    expect(arc.r).toBeCloseTo(1, 2);
    expect(arc.c.x).toBeCloseTo(4, 2); // the centre is inside the corner, one radius from each wall
    expect(arc.c.y).toBeCloseTo(1, 2);
    expect(Math.abs(arc.sweep)).toBeCloseTo(Math.PI / 2, 2);
  });

  it('it refuses a cut bigger than the walls, and walls that are not a corner', () => {
    const d = corner();
    expect(cutCorner(d, 'a', 'b', 9, false)).toBeNull();
    d.walls.push(wall('c', 0, 4, 3, 4));
    expect(cornerOf(d.walls[0], d.walls[2])).toBeNull();
    expect(cutCorner(d, 'a', 'c', 1, false)).toBeNull();
  });

  it('a wall can be turned parallel or square to another', () => {
    const d = base();
    d.walls.push(wall('a', 0, 0, 6, 0), wall('b', 0, 1, 3, 4));
    expect(alignWall(d, 'a', 'b', false)).toBe(true);
    expect(d.walls[1].b.y - d.walls[1].a.y).toBeCloseTo(0);
    expect(wallLength(d.walls[1])).toBeCloseTo(Math.hypot(3, 3));
    d.walls[1].b = { x: 3, y: 4 };
    alignWall(d, 'a', 'b', true);
    expect(d.walls[1].b.x - d.walls[1].a.x).toBeCloseTo(0);
    expect(d.walls[1].b.y).toBeGreaterThan(d.walls[1].a.y); // still points the way it did
  });

  it('openings are spread with equal gaps', () => {
    const d = base();
    d.walls.push(wall('a', 0, 0, 10, 0));
    d.openings.push(op('w1', 'a', 1, 1), op('w2', 'a', 2, 2), op('w3', 'a', 9.5, 1));
    expect(spaceOpenings(d, 'a')).toBe(3);
    const gap = (10 - 4) / 4;
    expect(d.openings[0].pos).toBeCloseTo(gap + 0.5);
    expect(d.openings[1].pos).toBeCloseTo(gap * 2 + 1 + 1);
    expect(d.openings[2].pos).toBeCloseTo(10 - gap - 0.5);
    d.openings.push(op('big', 'a', 5, 20));
    expect(spaceOpenings(d, 'a')).toBe(0); // they do not fit
  });
});

describe('resizing', () => {
  it('scaling a floor spreads everything out but keeps things their size', () => {
    const d = base();
    d.walls.push(wall('a', 0, 0, 4, 0), wall('b', 4, 0, 4, 3));
    d.openings.push(op('d', 'a', 2, 1));
    d.rooms.push(rect('r', 0, 0, 4, 3));
    d.furniture.push({ id: 'f', floor: 'f', type: 'sofa', x: 2, y: 1, w: 2, d: 1, rotation: 0, color: '#ccc', label: '' });
    const c = floorCenter(d, 'f')!;
    scaleFloor(d, 'f', 2, { x: 0, y: 0 });
    expect(c.x).toBeGreaterThan(0);
    expect(d.walls[0].b).toEqual({ x: 8, y: 0 });
    expect(d.walls[0].thickness).toBe(0.2);
    expect(d.openings[0]).toMatchObject({ pos: 4, width: 1 });
    expect(polygonArea(d.rooms[0].points)).toBeCloseTo(48);
    expect(d.furniture[0]).toMatchObject({ x: 4, y: 2, w: 2, d: 1 });
    scaleFloor(d, 'f', 0, { x: 0, y: 0 }); // nonsense factors are ignored
    expect(d.walls[0].b).toEqual({ x: 8, y: 0 });
  });

  it('stretching moves what is in the box and lets the walls that join it follow', () => {
    const d = base();
    d.walls.push(wall('n', 0, 0, 6, 0), wall('e', 6, 0, 6, 4), wall('s', 6, 4, 0, 4), wall('w', 0, 4, 0, 0));
    d.openings.push(op('d', 's', 3, 1));
    d.rooms.push(rect('r', 0.1, 0.1, 5.9, 3.9));
    d.furniture.push({ id: 'f', floor: 'f', type: 'sofa', x: 5, y: 2, w: 1, d: 1, rotation: 0, color: '#ccc', label: '' }, { id: 'g', floor: 'f', type: 'sofa', x: 1, y: 2, w: 1, d: 1, rotation: 0, color: '#ccc', label: '' });
    const snapshot = JSON.parse(JSON.stringify(d)) as Design;
    // a box round the east side of the house, pulled 2 m to the right
    stretchFromBase(d, snapshot, 'f', { minX: 5, minY: -1, maxX: 7, maxY: 5 }, 2, 0);
    expect(d.walls.find((w) => w.id === 'e')!.a.x).toBe(8);
    expect(d.walls.find((w) => w.id === 'n')!.b).toEqual({ x: 8, y: 0 });
    expect(d.walls.find((w) => w.id === 'n')!.a).toEqual({ x: 0, y: 0 });
    expect(d.walls.find((w) => w.id === 's')!.a).toEqual({ x: 8, y: 4 });
    expect(Math.max(...d.rooms[0].points.map((p) => p.x))).toBeCloseTo(7.9);
    expect(d.furniture.find((f) => f.id === 'f')!.x).toBe(7);
    expect(d.furniture.find((f) => f.id === 'g')!.x).toBe(1);
    // from the untouched copy every time: pulling back to 0 puts everything back
    stretchFromBase(d, snapshot, 'f', { minX: 5, minY: -1, maxX: 7, maxY: 5 }, 0, 0);
    expect(d.walls.find((w) => w.id === 'e')!.a.x).toBe(6);
  });
});

describe('rooms', () => {
  it('two rooms side by side merge into one; rooms that do not touch do not', () => {
    const a = rect('a', 0, 0, 3, 3).points;
    const b = rect('b', 3, 0, 6, 3).points;
    const merged = mergePolygons(a, b)!;
    expect(polygonArea(merged)).toBeCloseTo(18);
    expect(merged).toHaveLength(4);
    expect(mergePolygons(a, rect('c', 5, 0, 8, 3).points)).toBeNull();
    // sharing only part of an edge (an L shape)
    const l = mergePolygons(a, rect('d', 3, 1, 5, 2).points)!;
    expect(polygonArea(l)).toBeCloseTo(11);
    expect(l).toHaveLength(8); // the square with a bump on one side
  });

  it('merging and splitting a room in the design', () => {
    const d = base();
    d.rooms.push({ ...rect('a', 0, 0, 3, 3), seed: { x: 1, y: 1 } }, rect('b', 3, 0, 6, 3));
    expect(mergeRooms(d, 'a', 'b')).toBe(true);
    expect(d.rooms).toHaveLength(1);
    expect(d.rooms[0].seed).toBeUndefined();
    expect(polygonArea(d.rooms[0].points)).toBeCloseTo(18);
    const id = splitRoom(d, 'a', { x: 4, y: -1 }, { x: 4, y: 5 })!;
    expect(d.rooms).toHaveLength(2);
    expect(d.rooms[1].id).toBe(id);
    expect(d.rooms[1].name).toBe('a 2');
    expect(polygonArea(d.rooms[0].points) + polygonArea(d.rooms[1].points)).toBeCloseTo(18);
    expect(Math.min(polygonArea(d.rooms[0].points), polygonArea(d.rooms[1].points))).toBeCloseTo(12 > 9 ? 6 : 0, 5);
    expect(splitRoom(d, 'a', { x: 40, y: -1 }, { x: 40, y: 5 })).toBeNull(); // misses the room
  });
});

describe('stairs: landing, winder, steps per flight, ladder', () => {
  const stair = (kind: Stair['kind'], extra: Partial<Stair> = {}): Stair => ({ id: 's', floor: 'f', kind, x: 0, y: 0, w: kind === 'landing' ? 1 : 2.4, d: kind === 'landing' ? 4.6 : 2.4, rotation: 0, steps: 16, rise: 2.8, flip: false, ...extra });

  it('every stair gets to the full rise in exactly its steps, and stays inside its box', () => {
    for (const kind of ['straight', 'landing', 'l', 'winder', 'u'] as const) {
      const s = stair(kind, kind === 'u' ? { d: 3, w: 2.2 } : kind === 'straight' ? { w: 1, d: 4 } : {});
      const steps = stairSteps(s);
      expect(steps.length, kind).toBe(16);
      expect(Math.max(...steps.map((x) => x.top)), kind).toBeCloseTo(2.8);
      expect(new Set(steps.map((x) => Math.round(x.top * 1e6))).size, kind).toBe(16); // each step is a step higher
      for (const st of steps) for (const p of st.poly) {
        expect(p.x, kind).toBeGreaterThanOrEqual(-1e-6);
        expect(p.x, kind).toBeLessThanOrEqual(s.w + 1e-6);
        expect(p.y, kind).toBeGreaterThanOrEqual(-1e-6);
        expect(p.y, kind).toBeLessThanOrEqual(s.d + 1e-6);
      }
    }
  });

  it('a landing stair is level in the middle and has a deep step there', () => {
    const s = stair('landing');
    const steps = stairSteps(s);
    const depths = steps.map((st) => Math.max(...st.poly.map((p) => p.y)) - Math.min(...st.poly.map((p) => p.y)));
    expect(Math.max(...depths)).toBeCloseTo(1); // the landing is as deep as the stair is wide
    expect(depths.filter((x) => x > 0.9)).toHaveLength(1);
    expect(stairShapes(s).length).toBeGreaterThan(10);
  });

  it('a winder turns on three wedges that fill the corner square, and the steps before and after are ordinary', () => {
    const s = stair('winder');
    const steps = stairSteps(s);
    const [nA, nB] = flightSplit(s);
    expect(nA + nB).toBe(13);
    const wedges = steps.filter((st) => st.poly.length !== 4 || st.poly.some((p, i) => Math.abs(p.x - st.poly[(i + 1) % st.poly.length].x) > 1e-6 && Math.abs(p.y - st.poly[(i + 1) % st.poly.length].y) > 1e-6));
    expect(wedges).toHaveLength(3);
    const area = wedges.reduce((a, st) => a + polygonArea(st.poly), 0);
    expect(area).toBeCloseTo(1.2 * 1.2, 5);
    expect(stairOutline(s)).toEqual(stairOutline({ ...s, kind: 'l' }));
  });

  it('you choose how many steps are in the first flight', () => {
    expect(flightSplit(stair('l'))).toEqual([8, 7]);
    expect(flightSplit(stair('l', { firstFlight: 4 }))).toEqual([4, 11]);
    expect(flightSplit(stair('u', { d: 3, w: 2.2, firstFlight: 3 }))).toEqual([3, 12]);
    expect(flightSplit(stair('l', { firstFlight: 99 }))[0]).toBe(14);
    expect(flightSplit(stair('l', { firstFlight: 0 }))[0]).toBe(1);
    const steps = stairSteps(stair('l', { firstFlight: 4 }));
    const first = steps.slice(0, 4);
    expect(first.every((st) => Math.min(...st.poly.map((p) => p.x)) < 1e-6 && Math.max(...st.poly.map((p) => p.x)) < 1.3)).toBe(true);
  });

  it('a ladder is climbed, not walked: no steps to stand on, a small hatch above, and a check that says so', () => {
    const s = stair('ladder', { w: 0.5, d: 0.8, steps: 10 });
    expect(stairSteps(s)).toEqual([]);
    expect(stairTopAt(s, { x: 0.25, y: 0.4 })).toBeNull();
    expect(stairOutline(s)).toHaveLength(4);
    const check = checkStair(s);
    expect(check.ok).toBe(true);
    expect(check.message).toMatch(/ladder/i);
    expect(checkStair({ ...s, steps: 5 }).ok).toBe(false);
  });

  it('the new fields survive a round trip and old stairs are fine', () => {
    const d = createDesign();
    d.stairs.push({ ...stair('winder', { firstFlight: 5 }), floor: d.floors[0].id });
    const back = parseDesign(JSON.parse(JSON.stringify(d))).stairs[0];
    expect(back).toMatchObject({ kind: 'winder', firstFlight: 5 });
    const raw = JSON.parse(JSON.stringify(d));
    raw.stairs[0].kind = 'escalator';
    delete raw.stairs[0].firstFlight;
    expect(parseDesign(raw).stairs[0]).toMatchObject({ kind: 'straight' });
  });
});
