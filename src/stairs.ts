/**
 * Staircases as drawing instructions in METERS in the stair's own box (0..w across, 0..d along), with the climb
 * heading towards y = 0 (the top of the box) when the rotation is 0. Pure, so the canvas, the SVG export and the
 * tests all use the same drawing.
 */
import type { Point, Stair, StairKind } from './model';

export type StairShape =
  | { t: 'poly'; pts: number[]; fill?: boolean }
  | { t: 'line'; pts: number[] }
  | { t: 'ellipse'; cx: number; cy: number; rx: number; ry: number; fill?: boolean };

/** Starting size and number of steps for each kind (a normal storey of 2.8 m needs about 16 steps of 17.5 cm). */
export const STAIR_DEFAULTS: Record<StairKind, { w: number; d: number; steps: number; label: string }> = {
  straight: { w: 1.0, d: 4.0, steps: 16, label: 'Straight' },
  l: { w: 2.4, d: 2.4, steps: 16, label: 'L-shaped' },
  u: { w: 2.2, d: 3.0, steps: 16, label: 'U-shaped' },
  spiral: { w: 1.6, d: 1.6, steps: 14, label: 'Spiral' },
};

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
  if (kind === 'l') return Math.min(w, d) / 2;
  return Math.min((w - 0.1) / 2, d / 2); // u: two flights with a 10 cm well between them
}

export function stairShapes(stair: Pick<Stair, 'kind' | 'w' | 'd' | 'steps' | 'flip'>): StairShape[] {
  const { kind, w, d, steps } = stair;
  const n = Math.max(2, steps);
  const out: StairShape[] = [];
  // mirrored stairs: build for flip = false, then mirror x
  const mirror = (shapes: StairShape[]): StairShape[] =>
    stair.flip && (kind === 'l' || kind === 'u')
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

  if (kind === 'spiral') {
    const r = Math.min(w, d) / 2;
    const cx = w / 2;
    const cy = d / 2;
    out.push({ t: 'ellipse', cx, cy, rx: r, ry: r, fill: true });
    const pole = Math.min(0.12, r * 0.2);
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
  if (kind === 'l') {
    // enter at the bottom of the left leg, turn right on the landing at the top-left corner
    out.push({ t: 'poly', pts: [0, 0, w, 0, w, f, f, f, f, d, 0, d], fill: true });
    const legA = d - f;
    const legB = w - f;
    const nA = Math.max(1, Math.round(((n - 1) * legA) / (legA + legB)));
    const nB = Math.max(1, n - 1 - nA);
    for (let i = 1; i < nA + (nB ? 1 : 0); i++) out.push({ t: 'line', pts: [0, f + (legA * i) / (nA + 1), f, f + (legA * i) / (nA + 1)] });
    for (let i = 1; i <= nB; i++) out.push({ t: 'line', pts: [f + (legB * i) / (nB + 1), 0, f + (legB * i) / (nB + 1), f] });
    out.push({ t: 'line', pts: [0, f, f, f] }); // landing edge
    out.push({ t: 'line', pts: [f, 0, f, f] });
    out.push(...arrow([{ x: f / 2, y: d - 0.2 }, { x: f / 2, y: f / 2 }, { x: w - 0.25, y: f / 2 }]));
    return mirror(out);
  }

  // u: up the left flight, across the landing at the top, and the right flight comes back down
  out.push({ t: 'poly', pts: [0, 0, w, 0, w, d, w - f, d, w - f, f, f, f, f, d, 0, d], fill: true });
  const nFlight = Math.max(1, Math.round((n - 1) / 2));
  const run = d - f;
  for (let i = 1; i <= nFlight; i++) {
    const y = f + (run * i) / (nFlight + 1);
    out.push({ t: 'line', pts: [0, y, f, y] });
    out.push({ t: 'line', pts: [w - f, y, w, y] });
  }
  out.push({ t: 'line', pts: [0, f, w, f] });
  out.push(...arrow([{ x: f / 2, y: d - 0.2 }, { x: f / 2, y: f / 2 }, { x: w - f / 2, y: f / 2 }, { x: w - f / 2, y: d - 0.3 }]));
  return mirror(out);
}

/** Length of the line you walk along (the middle of the stair), used to work out the depth of one step. */
export function walkingLength(stair: Pick<Stair, 'kind' | 'w' | 'd'>): number {
  const { kind, w, d } = stair;
  if (kind === 'straight') return d;
  if (kind === 'spiral') return Math.PI * Math.min(w, d) * 0.62 * 1.5; // a 270° walk at 62% of the radius
  const f = flightWidth(kind, w, d);
  if (kind === 'l') return d - f / 2 + (w - f / 2);
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

type Shape = Pick<Stair, 'kind' | 'w' | 'd' | 'steps' | 'rise' | 'flip'>;

const rectPoly = (x0: number, x1: number, y0: number, y1: number): Point[] => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
const mirrorPts = (pts: Point[], w: number): Point[] => pts.map((p) => ({ x: w - p.x, y: p.y }));
const mirrored = (s: Pick<Stair, 'kind' | 'flip'>) => s.flip && (s.kind === 'l' || s.kind === 'u');

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

  if (kind === 'straight') {
    for (let i = 0; i < n; i++) block(0, w, d - ((i + 1) * d) / n, d - (i * d) / n, i + 1);
  } else if (kind === 'spiral') {
    const r = Math.min(w, d) / 2;
    const pole = Math.min(0.12, r * 0.2);
    for (let i = 0; i < n; i++) {
      const a0 = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      const a1 = a0 + (2 * Math.PI) / n;
      const poly: Point[] = [];
      for (let k = 0; k <= 4; k++) poly.push({ x: w / 2 + Math.cos(a0 + ((a1 - a0) * k) / 4) * r, y: d / 2 + Math.sin(a0 + ((a1 - a0) * k) / 4) * r });
      for (let k = 4; k >= 0; k--) poly.push({ x: w / 2 + Math.cos(a0 + ((a1 - a0) * k) / 4) * pole, y: d / 2 + Math.sin(a0 + ((a1 - a0) * k) / 4) * pole });
      out.push({ poly, top: (rise * (i + 1)) / n, thin: true });
    }
  } else if (kind === 'l') {
    const f = flightWidth(kind, w, d);
    const legA = d - f;
    const legB = w - f;
    const nA = Math.max(1, Math.round(((n - 1) * legA) / (legA + legB)));
    const nB = Math.max(1, n - 1 - nA);
    for (let i = 0; i < nA; i++) block(0, f, d - ((i + 1) * legA) / nA, d - (i * legA) / nA, i + 1);
    block(0, f, 0, f, nA + 1);
    for (let j = 0; j < nB; j++) block(f + (j * legB) / nB, f + ((j + 1) * legB) / nB, 0, f, nA + 2 + j);
  } else {
    const f = flightWidth(kind, w, d);
    const up = Math.max(1, Math.floor((n - 1) / 2));
    const down = Math.max(1, n - 1 - up);
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
  if (kind === 'straight') pts = rectPoly(0, w, 0, d);
  else if (kind === 'spiral') {
    const r = Math.min(w, d) / 2;
    pts = Array.from({ length: 24 }, (_, i) => ({ x: w / 2 + Math.cos((i * 2 * Math.PI) / 24) * r, y: d / 2 + Math.sin((i * 2 * Math.PI) / 24) * r }));
  } else {
    const f = flightWidth(kind, w, d);
    const flat = kind === 'l' ? [0, 0, w, 0, w, f, f, f, f, d, 0, d] : [0, 0, w, 0, w, d, w - f, d, w - f, f, f, f, f, d, 0, d];
    pts = flat.reduce<Point[]>((acc, v, i) => (i % 2 ? acc : [...acc, { x: v, y: flat[i + 1] }]), []);
  }
  return mirrored(s) ? mirrorPts(pts, w) : pts;
}

/** The two rails of a staircase as lines in its box: `a` the outer side, `b` the inner one (none for a spiral). */
export function railPaths(s: Shape): { a: Point[]; b: Point[] } {
  const { kind, w, d } = s;
  const P = (x: number, y: number): Point => ({ x, y });
  let a: Point[];
  let b: Point[] = [];
  if (kind === 'straight') {
    a = [P(0, d), P(0, 0)];
    b = [P(w, d), P(w, 0)];
  } else if (kind === 'l') {
    const f = flightWidth(kind, w, d);
    a = [P(0, d), P(0, 0), P(w, 0)];
    b = [P(f, d), P(f, f), P(w, f)];
  } else if (kind === 'u') {
    const f = flightWidth(kind, w, d);
    a = [P(0, d), P(0, 0), P(w, 0), P(w, d)];
    b = [P(f, d), P(f, f), P(w - f, f), P(w - f, d)];
  } else {
    const r = Math.min(w, d) / 2 - 0.03;
    a = Array.from({ length: 29 }, (_, i) => P(w / 2 + Math.cos(-Math.PI / 2 + (i * 2 * Math.PI) / 28) * r, d / 2 + Math.sin(-Math.PI / 2 + (i * 2 * Math.PI) / 28) * r));
  }
  return mirrored(s) ? { a: mirrorPts(a, w), b: mirrorPts(b, w) } : { a, b };
}

/** The edges of the stairwell hole that need a guard rail on the floor above: all of them except the one you step off the stair onto. */
export function guardEdges(s: Shape): [Point, Point][] {
  const { kind, w, d } = s;
  const un: Shape = { ...s, flip: false };
  const outline = stairOutline(un);
  const f = kind === 'l' || kind === 'u' ? flightWidth(kind, w, d) : 0;
  const r = Math.min(w, d) / 2;
  const exit = (m: Point) => {
    if (kind === 'straight') return m.y < 0.05;
    if (kind === 'l') return m.x > w - 0.05 && m.y < f + 0.05;
    if (kind === 'u') return m.y > d - 0.05 && m.x > w - f - 0.05;
    return m.y < d / 2 - r * 0.9 && Math.abs(m.x - w / 2) < r * 0.5;
  };
  const out: [Point, Point][] = [];
  outline.forEach((p, i) => {
    const q = outline[(i + 1) % outline.length];
    if (!exit({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 })) out.push(mirrored(s) ? [{ x: w - p.x, y: p.y }, { x: w - q.x, y: q.y }] : [p, q]);
  });
  return out;
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
