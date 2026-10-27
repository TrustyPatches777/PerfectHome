/**
 * Staircases and their railings as 3D parts, in the stair's own centered box (climbing towards -z when unrotated, the same
 * orientation as the plan symbol). The heights of the rails come from `railProfile` (stairs.ts), which the walking code uses too.
 */
import type { Point, Stair } from '../model';
import { RAIL_HEIGHT_DEFAULT, RAIL_LOOKS, flatProfile, guardRuns, railPaths, railProfile, spiralPole, stairColors, stairSteps, stairTopAt, type RailNode, type StairStep } from '../stairs';
import { ball, beam, box, cyl, prism, type Part } from './parts';

type Shape = Pick<Stair, 'kind' | 'w' | 'd' | 'steps' | 'rise' | 'flip' | 'build' | 'material' | 'color' | 'bodyColor'>;
type V = [number, number, number];

const bboxOf = (poly: Point[]) => {
  const xs = poly.map((p) => p.x);
  const ys = poly.map((p) => p.y);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
};

/** A rectangle with its sides along the axes (a block of steps is one; a wedge of a winder is not). */
const isRect = (poly: Point[]) => poly.length === 4 && poly.every((p, i) => Math.abs(p.x - poly[(i + 1) % 4].x) < 1e-9 || Math.abs(p.y - poly[(i + 1) % 4].y) < 1e-9);

/** A ladder leaning through the hatch: two rails that stand a little above the floor upstairs, and rungs. */
function ladderParts(s: Shape, color: string): Part[] {
  const { w, d, rise } = s;
  const n = Math.max(3, s.steps);
  const x = w / 2 - 0.04;
  const top = rise + 0.8;
  const zAt = (h: number) => d / 2 - (d * h) / rise;
  const out: Part[] = [-x, x].map((px) => beam([px, 0, zAt(0)], [px, top, zAt(top)], 0.04, 0.05, color));
  for (let i = 1; i <= n; i++) {
    const h = (rise * i) / n - 0.05;
    out.push(box(-x, x, h - 0.015, h + 0.015, zAt(h) - 0.015, zAt(h) + 0.015, color));
  }
  return out;
}

/** A step that is a landing (wide both ways) rather than a tread of a flight. */
const isLanding = (poly: Point[]) => {
  const b = bboxOf(poly);
  return Math.min(b.x1 - b.x0, b.y1 - b.y0) > 0.45;
};

/** The pitch line of a flight with a riser's drop, used as the top of the side beams of open stairs. */
const BEAM_DEPTH = 0.22;

/** A staircase: solid steps (closed), treads on side beams (open) or treads sticking out of the wall (floating). */
export function stairParts(s: Shape): Part[] {
  const { w, d, rise } = s;
  const { tread, body, look } = stairColors(s);
  const out: Part[] = [];
  const riser = rise / Math.max(2, s.steps);
  const build = look.glass && (s.build ?? 'closed') === 'closed' ? 'open' : (s.build ?? 'closed');
  const tex = look.tex ? { kind: look.tex, color: tread } : undefined;
  const lookOpt = look.glass ? { glass: true } : {};
  const centered = (poly: Point[]) => poly.map((p) => ({ x: p.x - w / 2, y: p.y - d / 2 }));
  const steps = stairSteps(s);
  if (s.kind === 'ladder') return ladderParts(s, tread === '#e5e7eb' ? '#a5835a' : tread);

  for (const st of steps) {
    const poly = centered(st.poly);
    if (st.thin) {
      out.push(prism(poly, st.top - 0.06, st.top, tread, tex, lookOpt));
      continue;
    }
    if (build === 'closed') {
      const b = bboxOf(poly);
      out.push(isRect(poly) ? box(b.x0, b.x1, 0, st.top - 0.04, b.y0, b.y1, body) : prism(poly, 0, st.top - 0.04, body));
      out.push(prism(poly, st.top - 0.04, st.top, tread, tex, lookOpt));
    } else if (isLanding(poly)) {
      out.push(prism(poly, st.top - riser, st.top - 0.04, body));
      out.push(prism(poly, st.top - 0.04, st.top, tread, tex, lookOpt));
    } else out.push(prism(poly, st.top - (build === 'floating' ? 0.07 : 0.05), st.top, tread, tex, lookOpt));
  }

  if (s.kind === 'spiral') {
    // the pole stops where the top step is level with the floor above
    out.push(cyl(0, 0, 0, rise, spiralPole(w, d), body));
    return out;
  }
  if (build === 'open') out.push(...sideBeams(s, steps, riser, body));
  return out;
}

/** The beams under the edges of an open stair, and a leg under every landing corner. */
function sideBeams(s: Shape, steps: StairStep[], riser: number, color: string): Part[] {
  const out: Part[] = [];
  const paths = railPaths(s);
  const c = (n: RailNode) => ({ x: n.x - s.w / 2, y: n.y - s.d / 2 });
  for (const path of [paths.a, paths.b]) {
    const nodes = railProfile(s, path, steps);
    // the top of a beam is a riser below the nosing line on a flight, and the landing's underside on the flat
    for (let i = 0; i + 1 < nodes.length; i++) {
      const A = nodes[i];
      const B = nodes[i + 1];
      const pa = c(A);
      const pb = c(B);
      out.push(beam([pa.x, A.h - riser - BEAM_DEPTH / 2, pa.y], [pb.x, B.h - riser - BEAM_DEPTH / 2, pb.y], 0.05, BEAM_DEPTH, color));
    }
    for (const n of nodes) {
      if (!n.turn || n.h - riser < 0.4) continue;
      const p = c(n);
      out.push(box(p.x - 0.035, p.x + 0.035, 0, n.h - riser, p.y - 0.035, p.y + 0.035, color));
    }
  }
  return out;
}

// ---- railings -------------------------------------------------------------------------------------------------------------------

/** Where along the nodes (by distance from the start) a post stands, and the point on the rail there. */
function pointsAlong(nodes: RailNode[], gap: number): { x: number; y: number; h: number; thick: boolean }[] {
  const out: { x: number; y: number; h: number; thick: boolean }[] = [];
  const lens = nodes.slice(1).map((n, i) => Math.hypot(n.x - nodes[i].x, n.y - nodes[i].y));
  const total = lens.reduce((a, b) => a + b, 0);
  const at = (dist: number) => {
    let acc = 0;
    for (let i = 0; i < lens.length; i++) {
      if (dist <= acc + lens[i] + 1e-9 || i === lens.length - 1) {
        const t = lens[i] > 0 ? Math.min(1, Math.max(0, (dist - acc) / lens[i])) : 0;
        const A = nodes[i];
        const B = nodes[i + 1];
        return { x: A.x + (B.x - A.x) * t, y: A.y + (B.y - A.y) * t, h: A.h + (B.h - A.h) * t };
      }
      acc += lens[i];
    }
    return { x: nodes[0].x, y: nodes[0].y, h: nodes[0].h };
  };
  // the thick posts first (ends and turns), then the regular ones that are not right next to one
  let acc = 0;
  const thickAt: number[] = [];
  nodes.forEach((n, i) => {
    if (i > 0) acc += lens[i - 1];
    if (n.end || n.turn) {
      thickAt.push(acc);
      out.push({ x: n.x, y: n.y, h: n.h, thick: true });
    }
  });
  for (let dist = gap; dist < total - gap * 0.35; dist += gap) {
    if (thickAt.some((t) => Math.abs(t - dist) < gap * 0.35)) continue;
    out.push({ ...at(dist), thick: false });
  }
  return out;
}

interface RunOptions {
  nodes: RailNode[];
  style: Exclude<NonNullable<Stair['railing']>['style'], 'none'>;
  frame: string;
  height: number;
  /** Height of the walking surface at a point of the run (centered coordinates). */
  floorAt: (x: number, y: number, fallback: number) => number;
}

const WIRE = '#c2c8d0';
const GLASS = '#bfe3f5';

/** One continuous railing along a run of nodes: posts or bars, the infill and a handrail on top. */
export function railRun({ nodes, style, frame, height: H, floorAt }: RunOptions): Part[] {
  const out: Part[] = [];
  if (nodes.length < 2) return out;
  const at = (n: { x: number; y: number }, y: number): V => [n.x, y, n.y];
  const handW = style === 'wood' ? 0.06 : style === 'solid' ? 0.13 : 0.04;
  const handH = style === 'wood' ? 0.045 : style === 'solid' ? 0.04 : 0.03;

  for (let i = 0; i + 1 < nodes.length; i++) {
    const A = nodes[i];
    const B = nodes[i + 1];
    const dx = B.x - A.x;
    const dz = B.y - A.y;
    const len = Math.hypot(dx, dz);
    if (len < 0.01) continue;
    const low = Math.min(A.h, B.h);
    out.push(beam(at(A, A.h + H), at(B, B.h + H), handW, handH, frame));
    if (style === 'glass') {
      out.push({ t: 'panel', pts: [at(A, low + 0.05), at(B, low + 0.05), at(B, B.h + H - 0.03), at(A, A.h + H - 0.03)], thick: 0.012, facing: [-dz / len, 0, dx / len], color: GLASS, glass: true });
      out.push(beam(at(A, low + 0.04), at(B, low + 0.04), 0.04, 0.03, frame));
    } else if (style === 'solid') {
      out.push({ t: 'panel', pts: [at(A, low), at(B, low), at(B, B.h + H), at(A, A.h + H)], thick: 0.09, facing: [-dz / len, 0, dx / len], color: frame });
    } else if (style === 'cable') {
      for (const f of [0.28, 0.52, 0.76]) out.push(beam(at(A, A.h + H * f), at(B, B.h + H * f), 0.008, 0.008, WIRE));
    } else if (style === 'metal') {
      for (const f of [0.35, 0.68]) out.push(beam(at(A, A.h + H * f), at(B, B.h + H * f), 0.022, 0.022, frame));
    } else if (style === 'bars' || style === 'wood') {
      out.push(beam(at(A, A.h + 0.07), at(B, B.h + 0.07), style === 'wood' ? 0.045 : 0.03, 0.03, frame)); // the bottom rail
    }
    // a round cap where two pieces of handrail meet at an angle, so that the joint has no gap
    if (i > 0) {
      const P = nodes[i - 1];
      const ax = A.x - P.x;
      const az = A.y - P.y;
      const al = Math.hypot(ax, az) || 1;
      const bent = Math.abs(ax / al - dx / len) + Math.abs(az / al - dz / len) > 0.02 || Math.abs((A.h - P.h) / al - (B.h - A.h) / len) > 0.02;
      if (bent) out.push(ball(A.x, A.h + H, A.y, handW * 0.62, handW * 0.62, handW * 0.62, frame));
    }
  }

  // posts and bars
  const gap = RAIL_LOOKS[style].gap;
  const infillStyle = style === 'wood' || style === 'bars';
  const posts = style === 'glass' || style === 'solid' ? nodes.filter((n) => n.end || n.turn).map((n) => ({ x: n.x, y: n.y, h: n.h, thick: true })) : pointsAlong(nodes, gap);
  for (const p of posts) {
    const base = floorAt(p.x, p.y, p.h);
    const top = p.h + H;
    if (p.thick && style !== 'solid') {
      const t = style === 'wood' ? 0.035 : 0.022;
      out.push(box(p.x - t, p.x + t, base, top + 0.02, p.y - t, p.y + t, frame));
    } else if (p.thick) {
      out.push(box(p.x - 0.07, p.x + 0.07, base, top + 0.02, p.y - 0.07, p.y + 0.07, frame));
    } else if (style === 'wood') out.push(box(p.x - 0.016, p.x + 0.016, base, top, p.y - 0.016, p.y + 0.016, frame));
    else if (infillStyle) out.push(cyl(p.x, p.y, base, top, 0.007, frame));
    else out.push(cyl(p.x, p.y, base, top, 0.013, frame));
  }
  return out;
}

/** The railings of a staircase (`guard` false: along its flights) or the guard rail round its opening in the floor above (`guard` true), in the stair's centered box. */
export function railParts(s: Pick<Stair, 'kind' | 'w' | 'd' | 'steps' | 'rise' | 'flip' | 'railing'>, guard: boolean, avoid: Point[][] = []): Part[] {
  const r = s.railing;
  if (!r || r.style === 'none') return [];
  const { w, d } = s;
  const height = r.height ?? RAIL_HEIGHT_DEFAULT;
  const frame = r.color ?? RAIL_LOOKS[r.style].color;
  const shift = (n: RailNode): RailNode => ({ ...n, x: n.x - w / 2, y: n.y - d / 2 });
  const out: Part[] = [];
  if (guard) {
    if (r.guard === false) return [];
    for (const run of guardRuns(s, avoid)) out.push(...railRun({ nodes: flatProfile(run, s.rise).map(shift), style: r.style, frame, height, floorAt: () => s.rise }));
    return out;
  }
  const steps = stairSteps(s);
  const paths = railPaths(s);
  for (const [on, path] of [[r.a, paths.a], [r.b, paths.b]] as const) {
    if (!on || path.length < 2) continue;
    const nodes = railProfile(s, path, steps).map(shift);
    out.push(...railRun({ nodes, style: r.style, frame, height, floorAt: (x, y, fb) => stairTopAt(s, { x: x + w / 2, y: y + d / 2 }, 0, steps) ?? fb }));
  }
  return out;
}
