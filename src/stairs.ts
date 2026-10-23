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
