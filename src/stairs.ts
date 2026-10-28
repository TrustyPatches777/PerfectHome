/**
 * Staircases as drawing instructions in METERS in the stair's own box (0..w across, 0..d along), with the climb
 * heading towards y = 0 (the top of the box) when the rotation is 0. Pure, so the canvas, the SVG export and the
 * tests all use the same drawing.
 */
import type { Design, Point, RailStyle, Stair, StairBuild, StairKind, StairMaterial } from './model';

export type StairShape =
  | { t: 'poly'; pts: number[]; fill?: boolean }
  | { t: 'line'; pts: number[] }
  | { t: 'ellipse'; cx: number; cy: number; rx: number; ry: number; fill?: boolean };

/** Starting size and number of steps for each kind (a normal storey of 2.8 m needs about 16 steps of 17.5 cm). */
export const STAIR_DEFAULTS: Record<StairKind, { w: number; d: number; steps: number; label: string }> = {
  straight: { w: 1.0, d: 4.0, steps: 16, label: 'Straight' },
  landing: { w: 1.0, d: 4.6, steps: 16, label: 'Straight with a landing' },
  l: { w: 2.4, d: 2.4, steps: 16, label: 'L-shaped (landing)' },
  winder: { w: 2.4, d: 2.4, steps: 16, label: 'L-shaped (winders)' },
  u: { w: 2.2, d: 3.0, steps: 16, label: 'U-shaped' },
  spiral: { w: 1.6, d: 1.6, steps: 14, label: 'Spiral' },
  ladder: { w: 0.5, d: 0.8, steps: 10, label: 'Ladder / loft hatch' },
};

/** Radius of the pole in the middle of a spiral staircase. */
export const spiralPole = (w: number, d: number): number => Math.min(0.07, Math.min(w, d) * 0.05);

const arrow = (pts: Point[]): StairShape[] => {
  // polyline plus an arrow head at its end
  const flat = pts.flatMap((p) => [p.x, p.y]);
  const a = pts[pts.length - 2];
  const b = pts[pts.length - 1];
  const ang = Math.atan2(b.y - a.y, b.x - a.x);
  const h = 0.13;
  const head = (da: number) => [b.x - Math.cos(ang + da) * h, b.y - Math.sin(ang + da) * h];
  return [
    { t: 'line', pts: flat },
    { t: 'line', pts: [...head(0.45), b.x, b.y, ...head(-0.45)] },
  ];
};

/** Width of one flight in L and U stairs. */
function flightWidth(kind: StairKind, w: number, d: number): number {
  if (kind === 'l' || kind === 'winder') return Math.min(w, d) / 2;
  return Math.min((w - 0.1) / 2, d / 2); // u: two flights with a 10 cm well between them
}

const clampInt = (v: number, lo: number, hi: number) => Math.min(Math.max(lo, hi), Math.max(lo, Math.round(v)));

/**
 * How many steps are in the first and in the second flight of a stair with a turn or a landing. The turn itself (the landing, or the
 * three winders) is not counted. `firstFlight` overrides the share by length.
 */
export function flightSplit(s: Pick<Stair, 'kind' | 'w' | 'd' | 'steps' | 'firstFlight'>): [number, number] {
  const n = Math.max(2, s.steps);
  const turn = s.kind === 'winder' ? 3 : s.kind === 'ladder' ? 0 : 1;
  const total = Math.max(2, n - turn);
  let first: number;
  if (s.kind === 'u' || s.kind === 'landing') first = s.firstFlight ?? Math.floor(total / 2);
  else {
    const f = flightWidth(s.kind, s.w, s.d);
    const legA = s.d - f;
    const legB = s.w - f;
    first = s.firstFlight ?? Math.round((total * legA) / (legA + legB));
  }
  const a = clampInt(first, 1, total - 1);
  return [a, Math.max(1, total - a)];
}

/** The three wedge-shaped steps that turn a winder stair round its inner corner (in the box, climbing towards y = 0). */
function winderWedges(f: number): Point[][] {
  const hit = (deg: number): Point => {
    const c = Math.cos((deg * Math.PI) / 180);
    const sn = Math.sin((deg * Math.PI) / 180);
    const t = Math.min(c < -1e-9 ? f / -c : Infinity, sn < -1e-9 ? f / -sn : Infinity);
    return { x: f + c * t, y: f + sn * t };
  };
  const pivot = { x: f, y: f };
  return [
    [pivot, { x: 0, y: f }, hit(210)],
    [pivot, hit(210), { x: 0, y: 0 }, hit(240)],
    [pivot, hit(240), { x: f, y: 0 }],
  ];
}

export function stairShapes(stair: Pick<Stair, 'kind' | 'w' | 'd' | 'steps' | 'flip' | 'firstFlight'>): StairShape[] {
  const { kind, w, d, steps } = stair;
  const n = Math.max(2, steps);
  const out: StairShape[] = [];
  // mirrored stairs: build for flip = false, then mirror x
  const mirror = (shapes: StairShape[]): StairShape[] =>
    stair.flip && (kind === 'l' || kind === 'u' || kind === 'winder')
      ? shapes.map((s) => {
          if (s.t === 'ellipse') return { ...s, cx: w - s.cx };
          return { ...s, pts: s.pts.map((v, i) => (i % 2 === 0 ? w - v : v)) };
        })
      : shapes;

  if (kind === 'straight') {
    out.push({ t: 'poly', pts: [0, 0, w, 0, w, d, 0, d], fill: true });
    for (let i = 1; i < n; i++) out.push({ t: 'line', pts: [0, (d * i) / n, w, (d * i) / n] });
    out.push(...arrow([{ x: w / 2, y: d - 0.2 }, { x: w / 2, y: 0.25 }]));
    return out;
  }

  if (kind === 'ladder') {
    out.push({ t: 'poly', pts: [0, 0, w, 0, w, d, 0, d], fill: true });
    const rungs = Math.max(3, n);
    for (let i = 1; i < rungs; i++) out.push({ t: 'line', pts: [0.03, (d * i) / rungs, w - 0.03, (d * i) / rungs] });
    out.push(...arrow([{ x: w / 2, y: d - 0.1 }, { x: w / 2, y: 0.12 }]));
    return out;
  }

  if (kind === 'landing') {
    const landing = Math.min(w, d * 0.4);
    const [n1, n2] = flightSplit(stair);
    const g = (d - landing) / (n1 + n2);
    out.push({ t: 'poly', pts: [0, 0, w, 0, w, d, 0, d], fill: true });
    let y = d;
    for (let i = 0; i < n1; i++) {
      y -= g;
      out.push({ t: 'line', pts: [0, y, w, y] });
    }
    out.push({ t: 'line', pts: [0, y - landing, w, y - landing] });
    y -= landing;
    for (let i = 1; i < n2; i++) {
      y -= g;
      out.push({ t: 'line', pts: [0, y, w, y] });
    }
    out.push(...arrow([{ x: w / 2, y: d - 0.2 }, { x: w / 2, y: 0.25 }]));
    return out;
  }

  if (kind === 'spiral') {
    const r = Math.min(w, d) / 2;
    const cx = w / 2;
    const cy = d / 2;
    out.push({ t: 'ellipse', cx, cy, rx: r, ry: r, fill: true });
    const pole = spiralPole(w, d);
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      out.push({ t: 'line', pts: [cx + Math.cos(a) * pole, cy + Math.sin(a) * pole, cx + Math.cos(a) * r, cy + Math.sin(a) * r] });
    }
    out.push({ t: 'ellipse', cx, cy, rx: pole, ry: pole, fill: true });
    const arc: Point[] = [];
    for (let i = 0; i <= 12; i++) {
      const a = Math.PI / 2 + (i / 12) * 1.5 * Math.PI;
      arc.push({ x: cx + Math.cos(a) * r * 0.62, y: cy + Math.sin(a) * r * 0.62 });
    }
    out.push(...arrow(arc));
    return out;
  }

  const f = flightWidth(kind, w, d);
  if (kind === 'l' || kind === 'winder') {
    // enter at the bottom of the left leg, turn right at the top-left corner (on a landing, or on three winders)
    out.push({ t: 'poly', pts: [0, 0, w, 0, w, f, f, f, f, d, 0, d], fill: true });
    const legA = d - f;
    const legB = w - f;
    const [nA, nB] = flightSplit(stair);
    for (let i = 1; i < nA + (nB ? 1 : 0); i++) out.push({ t: 'line', pts: [0, f + (legA * i) / (nA + 1), f, f + (legA * i) / (nA + 1)] });
    for (let i = 1; i <= nB; i++) out.push({ t: 'line', pts: [f + (legB * i) / (nB + 1), 0, f + (legB * i) / (nB + 1), f] });
    out.push({ t: 'line', pts: [0, f, f, f] }); // landing edge
    out.push({ t: 'line', pts: [f, 0, f, f] });
    if (kind === 'winder') for (const wedge of winderWedges(f).slice(0, 2)) out.push({ t: 'line', pts: [wedge[0].x, wedge[0].y, wedge[2].x, wedge[2].y] });
    out.push(...arrow([{ x: f / 2, y: d - 0.2 }, { x: f / 2, y: f / 2 }, { x: w - 0.25, y: f / 2 }]));
    return mirror(out);
  }

  // u: up the left flight, across the landing at the top, and the right flight comes back down
  out.push({ t: 'poly', pts: [0, 0, w, 0, w, d, w - f, d, w - f, f, f, f, f, d, 0, d], fill: true });
  const run = d - f;
  const [up, down] = flightSplit(stair);
  for (let i = 1; i <= up; i++) out.push({ t: 'line', pts: [0, f + (run * i) / (up + 1), f, f + (run * i) / (up + 1)] });
  for (let i = 1; i <= down; i++) out.push({ t: 'line', pts: [w - f, f + (run * i) / (down + 1), w, f + (run * i) / (down + 1)] });
  out.push({ t: 'line', pts: [0, f, w, f] });
  out.push(...arrow([{ x: f / 2, y: d - 0.2 }, { x: f / 2, y: f / 2 }, { x: w - f / 2, y: f / 2 }, { x: w - f / 2, y: d - 0.3 }]));
  return mirror(out);
}

/** Length of the line you walk along (the middle of the stair), used to work out the depth of one step. */
export function walkingLength(stair: Pick<Stair, 'kind' | 'w' | 'd'>): number {
  const { kind, w, d } = stair;
  if (kind === 'straight' || kind === 'landing' || kind === 'ladder') return d;
  if (kind === 'spiral') return Math.PI * Math.min(w, d) * 0.62 * 1.5; // a 270° walk at 62% of the radius
  const f = flightWidth(kind, w, d);
  if (kind === 'l' || kind === 'winder') return d - f / 2 + (w - f / 2);
  return 2 * (d - f / 2) + (w - f);
}

export interface StairCheck {
  /** Height of one step in meters, and depth of one tread at the walking line. */
  riser: number;
  going: number;
  /** Blondel's rule: 2 x riser + going should be about 63 cm (57 to 65 cm is comfortable). */
  blondel: number;
  ok: boolean;
  message: string;
}

export function checkStair(stair: Pick<Stair, 'kind' | 'w' | 'd' | 'steps' | 'rise'>): StairCheck {
  const riser = stair.rise / Math.max(1, stair.steps);
  if (stair.kind === 'ladder') return { riser, going: 0, blondel: 0, ok: riser <= 0.32, message: riser <= 0.32 ? 'A ladder: steep, for lofts and the odd visit only.' : 'The rungs are more than 32 cm apart. Add rungs.' };
  // a stair with n steps has n-1 treads between the first and last riser (the top step is the next floor)
  const going = walkingLength(stair) / Math.max(1, stair.kind === 'spiral' ? stair.steps : stair.steps - 1);
  const blondel = 2 * riser + going;
  let message = 'Comfortable.';
  let ok = true;
  if (riser > 0.2) [ok, message] = [false, 'Each step is higher than 20 cm: steep. Add steps.'];
  else if (riser < 0.14) [ok, message] = [false, 'Each step is lower than 14 cm. Remove steps.'];
  else if (going < 0.22) [ok, message] = [false, 'Treads are shallower than 22 cm. Make the stair longer or use fewer steps.'];
  else if (blondel < 0.57 || blondel > 0.67) [ok, message] = [false, 'Step height and depth do not match well (aim for 2 × height + depth ≈ 63 cm).'];
  return { riser, going, blondel, ok, message };
}

// ---- the solid steps, the stairwell and the railings (used by the 3D view and by walking) ---------------------------------------

type Shape = Pick<Stair, 'kind' | 'w' | 'd' | 'steps' | 'rise' | 'flip' | 'firstFlight'>;

const rectPoly = (x0: number, x1: number, y0: number, y1: number): Point[] => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
const mirrorPts = (pts: Point[], w: number): Point[] => pts.map((p) => ({ x: w - p.x, y: p.y }));
const mirrored = (s: Pick<Stair, 'kind' | 'flip'>) => s.flip && (s.kind === 'l' || s.kind === 'u' || s.kind === 'winder');

/** One step of a staircase seen from above, and how high its top is above the floor the stair starts on. Coordinates are in the stair's box (0..w, 0..d), climbing towards y = 0. */
export interface StairStep {
  poly: Point[];
  top: number;
  /** Spiral treads are thin slabs on a pole, the others are solid blocks down to the floor. */
  thin?: boolean;
}

export function stairSteps(s: Shape): StairStep[] {
  const { kind, w, d, rise } = s;
  const n = Math.max(2, s.steps);
  const out: StairStep[] = [];
  const block = (x0: number, x1: number, y0: number, y1: number, level: number) => out.push({ poly: rectPoly(x0, x1, y0, y1), top: (rise * level) / n });

  if (kind === 'ladder') {
    return []; // nothing to walk on: a ladder is climbed, and the hole above is a hatch
  } else if (kind === 'straight') {
    for (let i = 0; i < n; i++) block(0, w, d - ((i + 1) * d) / n, d - (i * d) / n, i + 1);
  } else if (kind === 'landing') {
    const landing = Math.min(w, d * 0.4);
    const [n1, n2] = flightSplit(s);
    const g = (d - landing) / (n1 + n2);
    let y = d;
    let level = 0;
    for (let i = 0; i < n1; i++) {
      block(0, w, y - g, y, ++level);
      y -= g;
    }
    block(0, w, y - landing, y, ++level);
    y -= landing;
    for (let i = 0; i < n2; i++) {
      block(0, w, y - g, y, ++level);
      y -= g;
    }
  } else if (kind === 'spiral') {
    const r = Math.min(w, d) / 2;
    const pole = spiralPole(w, d);
    for (let i = 0; i < n; i++) {
      const a0 = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      const a1 = a0 + (2 * Math.PI) / n;
      const poly: Point[] = [];
      for (let k = 0; k <= 4; k++) poly.push({ x: w / 2 + Math.cos(a0 + ((a1 - a0) * k) / 4) * r, y: d / 2 + Math.sin(a0 + ((a1 - a0) * k) / 4) * r });
      for (let k = 4; k >= 0; k--) poly.push({ x: w / 2 + Math.cos(a0 + ((a1 - a0) * k) / 4) * pole, y: d / 2 + Math.sin(a0 + ((a1 - a0) * k) / 4) * pole });
      out.push({ poly, top: (rise * (i + 1)) / n, thin: true });
    }
  } else if (kind === 'l' || kind === 'winder') {
    const f = flightWidth(kind, w, d);
    const legA = d - f;
    const legB = w - f;
    const [nA, nB] = flightSplit(s);
    for (let i = 0; i < nA; i++) block(0, f, d - ((i + 1) * legA) / nA, d - (i * legA) / nA, i + 1);
    if (kind === 'l') block(0, f, 0, f, nA + 1);
    else winderWedges(f).forEach((poly, k) => out.push({ poly, top: (rise * (nA + 1 + k)) / n }));
    const first = kind === 'l' ? nA + 2 : nA + 4;
    for (let j = 0; j < nB; j++) block(f + (j * legB) / nB, f + ((j + 1) * legB) / nB, 0, f, first + j);
  } else {
    const f = flightWidth(kind, w, d);
    const [up, down] = flightSplit(s);
    const run = d - f;
    for (let i = 0; i < up; i++) block(0, f, d - ((i + 1) * run) / up, d - (i * run) / up, i + 1);
    block(0, w, 0, f, up + 1);
    for (let j = 0; j < down; j++) block(w - f, w, f + (j * run) / down, f + ((j + 1) * run) / down, up + 2 + j);
  }
  return mirrored(s) ? out.map((st) => ({ ...st, poly: mirrorPts(st.poly, w) })) : out;
}

const inPoly = (p: Point, poly: Point[]): boolean => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
};

/** The height of the stair surface at a point of its box (0..w, 0..d), or null when there is no step there. Points up to `eps` outside a step count (for railings along the edge). */
export function stairTopAt(s: Shape, p: Point, eps = 0, steps: StairStep[] = stairSteps(s)): number | null {
  let best: number | null = null;
  const probes = eps > 0 ? [p, { x: p.x + eps, y: p.y }, { x: p.x - eps, y: p.y }, { x: p.x, y: p.y + eps }, { x: p.x, y: p.y - eps }] : [p];
  for (const st of steps) {
    if (best !== null && st.top <= best) continue;
    if (probes.some((q) => inPoly(q, st.poly))) best = st.top;
  }
  return best;
}

/** The hole a staircase makes in the floor above: its outline in the stair's box. */
export function stairOutline(s: Shape): Point[] {
  const { kind, w, d } = s;
  let pts: Point[];
  if (kind === 'straight' || kind === 'landing' || kind === 'ladder') pts = rectPoly(0, w, 0, d);
  else if (kind === 'spiral') {
    const r = Math.min(w, d) / 2;
    pts = Array.from({ length: 24 }, (_, i) => ({ x: w / 2 + Math.cos((i * 2 * Math.PI) / 24) * r, y: d / 2 + Math.sin((i * 2 * Math.PI) / 24) * r }));
  } else {
    const f = flightWidth(kind, w, d);
    const flat = kind === 'l' || kind === 'winder' ? [0, 0, w, 0, w, f, f, f, f, d, 0, d] : [0, 0, w, 0, w, d, w - f, d, w - f, f, f, f, f, d, 0, d];
    pts = flat.reduce<Point[]>((acc, v, i) => (i % 2 ? acc : [...acc, { x: v, y: flat[i + 1] }]), []);
  }
  return mirrored(s) ? mirrorPts(pts, w) : pts;
}

/** The outline of a staircase as convex pieces (a rectangle for a flight, one for each landing): the L is two, the U three. */
export function stairPieces(s: Shape): Point[][] {
  const { kind, w, d } = s;
  let pieces: Point[][];
  if (kind === 'l' || kind === 'winder') {
    const f = flightWidth(kind, w, d);
    pieces = [rectPoly(0, w, 0, f), rectPoly(0, f, f, d)];
  } else if (kind === 'u') {
    const f = flightWidth(kind, w, d);
    pieces = [rectPoly(0, w, 0, f), rectPoly(0, f, f, d), rectPoly(w - f, w, f, d)];
  } else return [stairOutline(s)];
  return mirrored(s) ? pieces.map((p) => mirrorPts(p, w)) : pieces;
}

/** How far the rails stand in from the edge of the steps, so that they do not sit inside the side of the stair. */
export const RAIL_INSET = 0.04;

/** The two rails of a staircase as lines in its box: `a` the outer side, `b` the inner one (none for a spiral). A spiral's rail leaves the first and the last tread free so that you can step on and off. */
export function railPaths(s: Shape): { a: Point[]; b: Point[] } {
  const { kind, w, d } = s;
  const m = RAIL_INSET;
  const e = 0.01; // stay just inside the first and last step
  const P = (x: number, y: number): Point => ({ x, y });
  let a: Point[];
  let b: Point[] = [];
  if (kind === 'ladder') return { a: [], b: [] };
  if (kind === 'straight' || kind === 'landing') {
    a = [P(m, d - e), P(m, e)];
    b = [P(w - m, d - e), P(w - m, e)];
  } else if (kind === 'l' || kind === 'winder') {
    const f = flightWidth(kind, w, d);
    a = [P(m, d - e), P(m, m), P(w - e, m)];
    b = [P(f - m, d - e), P(f - m, f - m), P(w - e, f - m)];
  } else if (kind === 'u') {
    const f = flightWidth(kind, w, d);
    a = [P(m, d - e), P(m, m), P(w - m, m), P(w - m, d - e)];
    b = [P(f - m, d - e), P(f - m, f - m), P(w - f + m, f - m), P(w - f + m, d - e)];
  } else {
    const n = Math.max(2, s.steps);
    const r = Math.min(w, d) / 2 - m;
    const from = -Math.PI / 2 + (2 * Math.PI) / n;
    const to = (3 * Math.PI) / 2 - (2 * Math.PI) / n;
    const segs = Math.max(8, Math.round(((to - from) / (2 * Math.PI)) * 40));
    a = Array.from({ length: segs + 1 }, (_, i) => P(w / 2 + Math.cos(from + ((to - from) * i) / segs) * r, d / 2 + Math.sin(from + ((to - from) * i) / segs) * r));
  }
  return mirrored(s) ? { a: mirrorPts(a, w), b: mirrorPts(b, w) } : { a, b };
}

/**
 * One point of a railing seen from the side: where it stands (in the stair's box), the height of the walking line there (the
 * nosings of the steps, a straight slope) and whether it is a place for a thick post (an end or a turn).
 */
export interface RailNode {
  x: number;
  y: number;
  h: number;
  turn: boolean;
  end: boolean;
}

/**
 * The railing along a path as a polyline whose heights follow the nosings of the steps: straight along a flight, flat on a landing,
 * with a node at every step edge and at every turn. Pure, so the 3D view and the walking share it.
 */
export function railProfile(s: Shape, path: Point[], steps: StairStep[] = stairSteps(s)): RailNode[] {
  if (path.length < 2) return [];
  const pts: Point[] = [path[0]];
  const vertex = new Set<number>();
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 0.03));
    for (let k = 1; k <= n; k++) pts.push({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n });
    if (i < path.length - 1) vertex.add(pts.length - 1);
  }
  const raw = pts.map((p) => stairTopAt(s, p, 0, steps));
  let last = raw.find((v) => v !== null) ?? 0;
  const hs = raw.map((v) => (last = v ?? last));
  const found: { key: number; node: RailNode }[] = [{ key: 0, node: { ...pts[0], h: hs[0], turn: false, end: true } }];
  for (let i = 1; i < pts.length; i++) {
    const jump = Math.abs(hs[i] - hs[i - 1]) > 1e-4;
    if (jump) {
      const hi = hs[i] >= hs[i - 1] ? i : i - 1; // stand on the higher of the two steps
      found.push({ key: i - 0.5, node: { ...pts[hi], h: Math.max(hs[i], hs[i - 1]), turn: vertex.has(i), end: false } });
    } else if (vertex.has(i)) found.push({ key: i, node: { ...pts[i], h: hs[i], turn: true, end: false } });
  }
  found.push({ key: pts.length, node: { ...pts[pts.length - 1], h: hs[hs.length - 1], turn: false, end: true } });
  found.sort((p, q) => p.key - q.key);
  // nodes closer than 2 cm are one node
  const out: RailNode[] = [];
  for (const { node } of found) {
    const prev = out[out.length - 1];
    if (prev && Math.hypot(prev.x - node.x, prev.y - node.y) < 0.02) {
      prev.h = Math.max(prev.h, node.h);
      prev.turn = prev.turn || node.turn;
      prev.end = prev.end || node.end;
    } else out.push(node);
  }
  return out;
}

/** A rail on a level path (the guard round a stairwell): nodes at the ends and at the turns. */
export function flatProfile(path: Point[], h: number): RailNode[] {
  return path.map((p, i) => ({ x: p.x, y: p.y, h, turn: i > 0 && i < path.length - 1, end: i === 0 || i === path.length - 1 }));
}

/** A stair-box point (0..w, 0..d) on the plan. */
export function stairToPlan(s: Pick<Stair, 'x' | 'y' | 'w' | 'd' | 'rotation'>, p: Point): Point {
  const c = Math.cos((s.rotation * Math.PI) / 180);
  const sn = Math.sin((s.rotation * Math.PI) / 180);
  const lx = p.x - s.w / 2;
  const ly = p.y - s.d / 2;
  return { x: s.x + lx * c - ly * sn, y: s.y + lx * sn + ly * c };
}

/** A plan point in a stair's box. */
export function planToStair(s: Pick<Stair, 'x' | 'y' | 'w' | 'd' | 'rotation'>, p: Point): Point {
  const c = Math.cos((s.rotation * Math.PI) / 180);
  const sn = Math.sin((s.rotation * Math.PI) / 180);
  const dx = p.x - s.x;
  const dy = p.y - s.y;
  return { x: dx * c + dy * sn + s.w / 2, y: -dx * sn + dy * c + s.d / 2 };
}

/**
 * Where the guard rail round a stairwell must not stand: the outlines (in this stair's box) of the stairs on the floor above. A stair that
 * starts up there needs its way in free, and its own rails already guard the edge.
 */
export function guardAvoid(d: Pick<Design, 'floors' | 'stairs'>, s: Pick<Stair, 'floor' | 'x' | 'y' | 'w' | 'd' | 'rotation' | 'id'>): Point[][] {
  const above = d.floors[d.floors.findIndex((f) => f.id === s.floor) + 1];
  if (!above) return [];
  return d.stairs.filter((o) => o.floor === above.id && o.id !== s.id).map((o) => stairOutline(o).map((p) => planToStair(s, stairToPlan(o, p))));
}

const nearPolygon = (p: Point, poly: Point[], margin: number): boolean => {
  if (inPoly(p, poly)) return true;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
    if (Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t)) < margin) return true;
  }
  return false;
};

/** The edges of the stairwell hole that need a guard rail on the floor above: all of them except the one you step off the stair onto (and the stretches `avoid` covers). */
export function guardEdges(s: Shape, avoid: Point[][] = []): [Point, Point][] {
  const { kind, w, d } = s;
  const un: Shape = { ...s, flip: false };
  const outline = stairOutline(un);
  const f = kind === 'l' || kind === 'u' || kind === 'winder' ? flightWidth(kind, w, d) : 0;
  const r = Math.min(w, d) / 2;
  const exit = (m: Point) => {
    if (kind === 'straight' || kind === 'landing' || kind === 'ladder') return m.y < 0.05;
    if (kind === 'l' || kind === 'winder') return m.x > w - 0.05 && m.y < f + 0.05;
    if (kind === 'u') return m.y > d - 0.05 && m.x > w - f - 0.05;
    return m.y < d / 2 - r * 0.9 && Math.abs(m.x - w / 2) < r * 0.5;
  };
  const out: [Point, Point][] = [];
  outline.forEach((p, i) => {
    const q = outline[(i + 1) % outline.length];
    if (exit({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 })) return;
    const [a, b] = mirrored(s) ? [{ x: w - p.x, y: p.y }, { x: w - q.x, y: q.y }] : [p, q];
    if (!avoid.length) return void out.push([a, b]);
    // cut into short pieces and leave out those that stand in the way of a stair above
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 0.25));
    for (let k = 0; k < n; k++) {
      const p0 = { x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n };
      const p1 = { x: a.x + ((b.x - a.x) * (k + 1)) / n, y: a.y + ((b.y - a.y) * (k + 1)) / n };
      const mid = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
      if (!avoid.some((poly) => nearPolygon(mid, poly, 0.4))) out.push([p0, p1]);
    }
  });
  return out;
}

/** The guard edges joined into continuous runs, so that the rail has no seams where two edges meet. */
export function guardRuns(s: Shape, avoid: Point[][] = []): Point[][] {
  const runs: Point[][] = [];
  for (const [p, q] of guardEdges(s, avoid)) {
    const run = runs[runs.length - 1];
    const end = run?.[run.length - 1];
    if (run && end && Math.hypot(end.x - p.x, end.y - p.y) < 1e-6) run.push(q);
    else runs.push([p, q]);
  }
  // the outline is a loop: when the first run starts where the last one ends they are one run
  if (runs.length > 1) {
    const first = runs[0];
    const lastRun = runs[runs.length - 1];
    const end = lastRun[lastRun.length - 1];
    if (Math.hypot(end.x - first[0].x, end.y - first[0].y) < 1e-6) {
      runs[0] = [...lastRun, ...first.slice(1)];
      runs.pop();
    }
  }
  return runs;
}

/** A polyline with extra points so that no piece is longer than `step`. */
export function densify(path: Point[], step: number): Point[] {
  const out: Point[] = [path[0]];
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / step));
    for (let k = 1; k <= n; k++) out.push({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n });
  }
  return out;
}

// ---- construction, materials and colors -----------------------------------------------------------------------------------------

export const STAIR_BUILD_LABEL: Record<StairBuild, string> = { closed: 'Solid with risers', open: 'Open (treads on side beams)', floating: 'Floating treads' };

export interface StairLook {
  label: string;
  /** Default color of the treads and of the risers/beams. */
  tread: string;
  body: string;
  /** A floor texture for the treads in 3D (see FloorMaterial), and see-through treads. */
  tex?: 'wood' | 'parquet' | 'tile' | 'carpet' | 'stone' | 'concrete';
  glass?: boolean;
}

export const STAIR_LOOKS: Record<StairMaterial, StairLook> = {
  concrete: { label: 'Concrete', tread: '#e5e7eb', body: '#e5e7eb' },
  wood: { label: 'Oak', tread: '#c19a6b', body: '#f3f0ea', tex: 'wood' },
  darkwood: { label: 'Dark wood', tread: '#6b4a2f', body: '#3b2f27', tex: 'wood' },
  stone: { label: 'Stone', tread: '#a8a29e', body: '#cfcac4', tex: 'stone' },
  metal: { label: 'Steel', tread: '#7b8794', body: '#4b5563' },
  glass: { label: 'Glass', tread: '#bfe3f5', body: '#9ca3af', glass: true },
  carpet: { label: 'Carpet', tread: '#9a3b3b', body: '#e9e5de', tex: 'carpet' },
};

/** The colors a staircase is drawn with (its own, or its material's). */
export function stairColors(s: Pick<Stair, 'material' | 'color' | 'bodyColor'>): { tread: string; body: string; look: StairLook } {
  const look = STAIR_LOOKS[s.material ?? 'concrete'];
  return { tread: s.color ?? look.tread, body: s.bodyColor ?? look.body, look };
}

export interface RailLook {
  label: string;
  /** Default color of the frame (posts, handrail, solid walls). */
  color: string;
  /** Distance between posts/bars along the rail. */
  gap: number;
}

export const RAIL_LOOKS: Record<Exclude<RailStyle, 'none'>, RailLook> = {
  wood: { label: 'Wooden balusters', color: '#a5835a', gap: 0.12 },
  metal: { label: 'Metal posts and rods', color: '#4b5563', gap: 0.9 },
  bars: { label: 'Fine vertical bars', color: '#374151', gap: 0.11 },
  glass: { label: 'Glass panels', color: '#8b95a1', gap: 1.5 },
  cable: { label: 'Steel cables', color: '#6b7280', gap: 0.9 },
  solid: { label: 'Solid wall', color: '#e5e7eb', gap: 9 },
};
export const RAIL_HEIGHT_DEFAULT = 0.9;

/** Does this stair take you up to the next floor? (Entrance steps and garden steps do not: they leave no hole in a floor above.) */
export const reachesNextFloor = (s: Pick<Stair, 'rise'>, storeyHeight: number): boolean => s.rise > storeyHeight * 0.7;

/** The color a rail is drawn with on the plan. */
export const railPlanColor = (r: { style: RailStyle; color?: string }): string => r.color ?? (r.style === 'glass' ? '#38bdf8' : r.style === 'none' ? '#000' : RAIL_LOOKS[r.style].color);

/** Mix a #rgb / #rrggbb color with white (0 = the color, 1 = white); anything else comes back unchanged. */
export function lighten(hex: string, amount: number): string {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const full = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1];
  const ch = [0, 2, 4].map((i) => Math.round(parseInt(full.slice(i, i + 2), 16) * (1 - amount) + 255 * amount));
  return `#${ch.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** The fill of a stair on the plan: white-ish, or a pale version of its color when it has one of its own. */
export const stairPlanFill = (s: Pick<Stair, 'material' | 'color'>): string => (s.color || (s.material && s.material !== 'concrete') ? lighten(stairColors(s).tread, 0.55) : '#f8fafc');
