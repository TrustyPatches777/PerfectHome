/**
 * Editing walls after they are drawn: split, join, meet at a corner, offset and thicken, chamfer and round a corner, turn one wall
 * parallel or square to another, and space the openings of a wall evenly. Pure operations on a design or an immer draft.
 */
import type { Draft } from 'immer';
import { clampOpeningPos, dist, wallArc, wallFrame, wallLength } from './geometry';
import { newId, type Design, type Opening, type Point, type Wall } from './model';

type Mutable = Draft<Design> | Design;

const find = <T extends { id: string }>(list: T[], id: string): T | undefined => list.find((x) => x.id === id);
const near = (p: Point, q: Point, eps = 0.02) => Math.abs(p.x - q.x) < eps && Math.abs(p.y - q.y) < eps;

// ---- split ------------------------------------------------------------------------------------------------------------------------

/** The bulge (sagitta) of a piece of an arc from angle t0 to t1 (radians, signed sweep) of a circle of radius r. */
function pieceBulge(r: number, sweep: number, sign: number): number {
  return sign * r * (1 - Math.cos(Math.abs(sweep) / 2));
}

/**
 * Cut a wall in two at distance `s` along it. The new wall (from the cut to `b`) gets a fresh id and the openings beyond the cut.
 * Returns its id, or null when the cut is at an end or in the middle of a door or window.
 */
export function splitWall(d: Mutable, wallId: string, s: number): string | null {
  const w = find(d.walls, wallId);
  if (!w) return null;
  const L = wallLength(w as Wall);
  if (s < 0.05 || s > L - 0.05) return null;
  const ops = d.openings.filter((o) => o.wallId === w.id);
  if (ops.some((o) => o.pos - o.width / 2 < s && o.pos + o.width / 2 > s)) return null;
  const arc = wallArc(w as Wall);
  let cut: Point;
  let bulgeA: number | undefined;
  let bulgeB: number | undefined;
  if (arc) {
    const th = arc.a0 + arc.sweep * (s / arc.length);
    cut = { x: arc.c.x + arc.r * Math.cos(th), y: arc.c.y + arc.r * Math.sin(th) };
    const sign = Math.sign(w.bulge ?? 1);
    bulgeA = pieceBulge(arc.r, arc.sweep * (s / arc.length), sign);
    bulgeB = pieceBulge(arc.r, arc.sweep * (1 - s / arc.length), sign);
  } else {
    const f = wallFrame(w as Wall);
    cut = { x: w.a.x + f.u.x * s, y: w.a.y + f.u.y * s };
  }
  const id = newId();
  const second: Wall = { ...JSON.parse(JSON.stringify(w)), id, a: cut, b: { ...w.b } };
  delete second.bulge;
  if (bulgeB && Math.abs(bulgeB) > 0.001) second.bulge = bulgeB;
  w.b = cut;
  if (bulgeA && Math.abs(bulgeA) > 0.001) w.bulge = bulgeA;
  else delete w.bulge;
  d.walls.splice(d.walls.findIndex((x) => x.id === w.id) + 1, 0, second);
  for (const o of ops) {
    if (o.pos > s) {
      o.wallId = id;
      o.pos -= s;
    }
  }
  return id;
}

// ---- join -------------------------------------------------------------------------------------------------------------------------

/** Make one wall of two straight walls that meet end to end in a straight line. Returns the surviving wall's id or null. */
export function joinWalls(d: Mutable, idA: string, idB: string): string | null {
  const A = find(d.walls, idA);
  const B = find(d.walls, idB);
  if (!A || !B || A.id === B.id || A.floor !== B.floor || wallArc(A as Wall) || wallArc(B as Wall)) return null;
  const aEnd = near(A.b, B.a) ? 'b' : near(A.b, B.b) ? 'b' : near(A.a, B.a) ? 'a' : near(A.a, B.b) ? 'a' : null;
  if (!aEnd) return null;
  const P = aEnd === 'b' ? A.b : A.a;
  const bEnd = near(B.a, P) ? 'a' : 'b';
  const fa = wallFrame(A as Wall);
  const fb = wallFrame(B as Wall);
  // straight on: same direction (or exactly opposite) within a degree
  if (Math.abs(fa.u.x * fb.u.y - fa.u.y * fb.u.x) > 0.02) return null;
  const LA = fa.length;
  const LB = fb.length;
  const farA = aEnd === 'b' ? A.a : A.b;
  const farB = bEnd === 'a' ? B.b : B.a;
  const reverseA = aEnd === 'a'; // A is read from its far end to the joint
  const reverseB = bEnd === 'b'; // B is read from the joint away
  const flipOp = (o: Opening, pos: number) => {
    o.pos = pos;
    o.swing = o.swing === 1 ? -1 : 1;
    o.hinge = o.hinge === 'a' ? 'b' : 'a';
  };
  for (const o of d.openings) {
    if (o.wallId === A.id && reverseA) flipOp(o, LA - o.pos);
    else if (o.wallId === B.id) {
      if (reverseB) flipOp(o, LA + (LB - o.pos));
      else o.pos = LA + o.pos;
      o.wallId = A.id;
    }
  }
  if (reverseA) {
    // A's paint faces swap with its direction
    if (A.paint) A.paint = { ...(A.paint.r ? { l: A.paint.r } : {}), ...(A.paint.l ? { r: A.paint.l } : {}) };
  }
  A.a = { ...farA };
  A.b = { ...farB };
  d.walls = d.walls.filter((x) => x.id !== B.id) as typeof d.walls;
  return A.id;
}

// ---- meet at a corner -------------------------------------------------------------------------------------------------------------

/** Intersection of the infinite lines through two straight walls, or null when they are parallel. */
export function lineIntersection(a: Wall, b: Wall): Point | null {
  const r = { x: a.b.x - a.a.x, y: a.b.y - a.a.y };
  const s = { x: b.b.x - b.a.x, y: b.b.y - b.a.y };
  const den = r.x * s.y - r.y * s.x;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((b.a.x - a.a.x) * s.y - (b.a.y - a.a.y) * s.x) / den;
  return { x: a.a.x + r.x * t, y: a.a.y + r.y * t };
}

/** Move the end of a wall to `to` (along its own line), keeping its openings where they are in the room. */
function moveEnd(d: Mutable, w: Draft<Wall> | Wall, end: 'a' | 'b', to: Point) {
  const before = wallFrame(w as Wall);
  const shift = end === 'a' ? (to.x - w.a.x) * before.u.x + (to.y - w.a.y) * before.u.y : 0; // how far the start moved along the wall
  if (end === 'a') w.a = { ...to };
  else w.b = { ...to };
  const L = wallLength(w as Wall);
  for (const o of d.openings) {
    if (o.wallId !== w.id) continue;
    o.pos -= shift;
    o.pos = clampOpeningPos(o.pos, o.width, L);
  }
}

/** Trim or extend two straight walls so that they meet exactly in a corner. Returns false when they are parallel or curved. */
export function meetWalls(d: Mutable, idA: string, idB: string): boolean {
  const A = find(d.walls, idA);
  const B = find(d.walls, idB);
  if (!A || !B || wallArc(A as Wall) || wallArc(B as Wall)) return false;
  const I = lineIntersection(A as Wall, B as Wall);
  if (!I) return false;
  for (const w of [A, B]) {
    const end = dist(w.a, I) <= dist(w.b, I) ? 'a' : 'b';
    moveEnd(d, w, end, I);
  }
  return true;
}

// ---- offset and thicken -----------------------------------------------------------------------------------------------------------

/** Move a wall sideways by `delta` meters (positive = to the right of a→b). Its openings go with it. */
export function offsetWall(d: Mutable, wallId: string, delta: number) {
  const w = find(d.walls, wallId);
  if (!w) return;
  const f = wallFrame(w as Wall);
  w.a = { x: w.a.x + f.n.x * delta, y: w.a.y + f.n.y * delta };
  w.b = { x: w.b.x + f.n.x * delta, y: w.b.y + f.n.y * delta };
}

/** Change the thickness of a wall while one face stays where it is: `keep` is that face ('l', 'r') or the middle. */
export function setThickness(d: Mutable, wallId: string, thickness: number, keep: 'l' | 'r' | 'middle') {
  const w = find(d.walls, wallId);
  if (!w) return;
  const t = Math.min(1, Math.max(0.02, thickness));
  const delta = (t - w.thickness) / 2;
  if (keep !== 'middle' && delta) offsetWall(d, wallId, keep === 'l' ? delta : -delta); // 'l' face stays: the middle moves away from it, to the right
  w.thickness = t;
}

// ---- chamfer and round a corner -----------------------------------------------------------------------------------------------------

export interface Corner {
  p: Point;
  /** Directions away from the corner along each wall, and which end of each wall is at the corner. */
  dA: Point;
  dB: Point;
  endA: 'a' | 'b';
  endB: 'a' | 'b';
}

/** The corner where two straight walls meet end to end, or null. */
export function cornerOf(A: Wall, B: Wall): Corner | null {
  if (wallArc(A) || wallArc(B) || A.floor !== B.floor) return null;
  for (const endA of ['a', 'b'] as const) {
    for (const endB of ['a', 'b'] as const) {
      const P = A[endA];
      if (!near(P, B[endB])) continue;
      const fa = wallFrame(A);
      const fb = wallFrame(B);
      const dA = endA === 'a' ? fa.u : { x: -fa.u.x, y: -fa.u.y };
      const dB = endB === 'a' ? fb.u : { x: -fb.u.x, y: -fb.u.y };
      if (Math.abs(dA.x * dB.y - dA.y * dB.x) < 0.05) return null; // straight on
      return { p: { ...P }, dA, dB, endA, endB };
    }
  }
  return null;
}

/** Cut a corner. `round` makes the new piece an arc that touches both walls (a fillet) instead of a straight chamfer. Returns the new wall's id. */
export function cutCorner(d: Mutable, idA: string, idB: string, size: number, round: boolean): string | null {
  const A = find(d.walls, idA);
  const B = find(d.walls, idB);
  if (!A || !B) return null;
  const c = cornerOf(A as Wall, B as Wall);
  if (!c) return null;
  const cosT = c.dA.x * c.dB.x + c.dA.y * c.dB.y; // the angle between the walls at the corner
  const theta = Math.acos(Math.max(-1, Math.min(1, cosT)));
  // how far back from the corner the new piece starts on each wall
  const back = round ? size / Math.tan(theta / 2) : size;
  const LA = wallLength(A as Wall);
  const LB = wallLength(B as Wall);
  if (back < 0.05 || back > LA - 0.2 || back > LB - 0.2) return null;
  const tA = { x: c.p.x + c.dA.x * back, y: c.p.y + c.dA.y * back };
  const tB = { x: c.p.x + c.dB.x * back, y: c.p.y + c.dB.y * back };
  const trim = (w: Draft<Wall> | Wall, end: 'a' | 'b', to: Point) => {
    // openings in the part that goes are removed
    const L = wallLength(w as Wall);
    d.openings = d.openings.filter((o) => {
      if (o.wallId !== w.id) return true;
      return end === 'b' ? o.pos + o.width / 2 <= L - back : o.pos - o.width / 2 >= back;
    }) as typeof d.openings;
    moveEnd(d, w, end, to);
  };
  trim(A, c.endA, tA);
  trim(B, c.endB, tB);
  const mid = { x: (tA.x + tB.x) / 2, y: (tA.y + tB.y) / 2 };
  const piece: Wall = { id: newId(), floor: A.floor, a: tA, b: tB, thickness: A.thickness, type: A.type, height: A.height };
  if (A.paint) piece.paint = JSON.parse(JSON.stringify(A.paint));
  if (round) {
    const R = size;
    const h = R * (1 - Math.sin(theta / 2)); // how far the arc bulges towards the corner
    const u = { x: tB.x - tA.x, y: tB.y - tA.y };
    const len = Math.hypot(u.x, u.y) || 1;
    const right = { x: -u.y / len, y: u.x / len };
    const toCorner = (c.p.x - mid.x) * right.x + (c.p.y - mid.y) * right.y;
    piece.bulge = Math.sign(toCorner) * h;
  }
  d.walls.push(piece);
  return piece.id;
}

// ---- parallel and square -------------------------------------------------------------------------------------------------------------

/** Turn wall B about the end that is nearest to A so that it runs parallel to A (`square` false) or at right angles to it. */
export function alignWall(d: Mutable, idA: string, idB: string, square: boolean): boolean {
  const A = find(d.walls, idA);
  const B = find(d.walls, idB);
  if (!A || !B || wallArc(A as Wall) || wallArc(B as Wall)) return false;
  const fa = wallFrame(A as Wall);
  const fb = wallFrame(B as Wall);
  const target = square ? { x: -fa.u.y, y: fa.u.x } : fa.u;
  // keep the way B points: pick the target direction that is closer to its current one
  const sign = fb.u.x * target.x + fb.u.y * target.y >= 0 ? 1 : -1;
  const dir = { x: target.x * sign, y: target.y * sign };
  const pivotEnd = Math.min(dist(B.a, A.a), dist(B.a, A.b)) <= Math.min(dist(B.b, A.a), dist(B.b, A.b)) ? 'a' : 'b';
  const L = fb.length;
  if (pivotEnd === 'a') B.b = { x: B.a.x + dir.x * L, y: B.a.y + dir.y * L };
  else B.a = { x: B.b.x - dir.x * L, y: B.b.y - dir.y * L };
  return true;
}

// ---- spacing -------------------------------------------------------------------------------------------------------------------------

/** Spread the openings of a wall so the gaps between them, and to the ends of the wall, are equal. Returns how many were moved. */
export function spaceOpenings(d: Mutable, wallId: string, ids?: string[]): number {
  const w = find(d.walls, wallId);
  if (!w) return 0;
  const ops = d.openings.filter((o) => o.wallId === wallId && (!ids || ids.includes(o.id))).sort((p, q) => p.pos - q.pos);
  if (ops.length < 1) return 0;
  const L = wallLength(w as Wall);
  const total = ops.reduce((s, o) => s + o.width, 0);
  const gap = (L - total) / (ops.length + 1);
  if (gap < 0) return 0;
  let at = gap;
  for (const o of ops) {
    o.pos = at + o.width / 2;
    at += o.width + gap;
  }
  return ops.length;
}
