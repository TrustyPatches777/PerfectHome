/**
 * The design as a 3D scene: a list of "chunks" (one per wall, room, piece of furniture, ...), each of which makes its parts only
 * when asked. The viewer asks for a chunk again only when something in its `deps` changed (immer keeps untouched items
 * identical), so dragging a sofa rebuilds one sofa, not the house.
 */
import { CUSTOM_PREFIX, catalogLayer, furnitureHeight } from '../catalog';
import { contentBounds } from '../bounds';
import { clipPolygon, isConvex, pointInPolygon, wallArc, wallLength, wallPointAt, wallSolidSegments, type WallPoint } from '../geometry';
import type { Design, Furniture, Opening, OpeningKind, Point, Roof, Skylight, Stair, Wall, WallType, Zone } from '../model';
import { STRIP_STYLES } from '../outdoor';
import { inFace, roofBaseHeight, roofModel, skylightPlacement, type SkylightPlacement, type V3 } from '../roofs';
import { densify, guardEdges, railPaths, stairOutline, stairSteps, stairTopAt } from '../stairs';
import { groundIndex } from '../shadows';
import { beam, box, cyl, place, prism, type Anim, type Look, type Part } from './parts';
import { SITS_ON_FURNITURE, furnitureParts } from './furniture3d';

export interface ChunkSpec {
  key: string;
  /** The chunk is rebuilt when any of these changes (compared with ===). */
  deps: unknown[];
  make: () => Part[];
}

export interface BuildOptions {
  /** Hide every floor above this one (a cut-away view). */
  hideAbove?: string | null;
  /** Show the roofs (default). */
  showRoof?: boolean;
  /** Floors switched off in the 3D view (they and everything on them are left out). */
  hiddenFloors?: string[];
}

const rad = (deg: number) => (deg * Math.PI) / 180;

/** Height of each floor's level above the garden (basements are negative). */
export function floorElevations(d: Design): Map<string, number> {
  const g = groundIndex(d);
  return new Map(d.floors.map((f, i) => [f.id, (i - g) * d.settings.storeyHeight]));
}

/** Thickness of the floor slab between two storeys. */
export const slabThickness = (d: Design) => Math.min(0.4, Math.max(0.12, d.settings.storeyHeight - 2.5));

/** Where the ceiling of a storey is, above its floor. */
export const ceilingHeight = (d: Design) => (d.settings.storeyHeight >= 2.5 ? 2.5 : d.settings.storeyHeight - 0.05);

const WALL_COLOR: Record<WallType, string> = { exterior: '#f3efe7', interior: '#ece8e0', partition: '#f4f1ea', railing: '#8a6f55' };
const FRAME = '#f8fafc';
const GLASS = '#bfe3f5';
const WOOD = '#b08968';

/** Heights of the top of each opening above the floor, in meters. */
export const OPENING_HEAD: Record<OpeningKind, number> = { door: 2.05, main: 2.3, garden: 2.1, double: 2.1, french: 2.15, sliding: 2.15, garage: 2.2, gap: 2.1, window: 2.1, bay: 2.1 };
export const WINDOW_SILL = 0.9;

// ---- walls ----------------------------------------------------------------------------------------------------------

/** Outline of the part of a wall between distances s0 and s1 along it (full thickness, following the curve). */
export function wallStrip(w: Wall, s0: number, s1: number): Point[] {
  const h = w.thickness / 2;
  const arc = wallArc(w);
  const steps = arc ? Math.max(1, Math.ceil((Math.abs(arc.sweep) * ((s1 - s0) / arc.length)) / (Math.PI / 24))) : 1;
  const outer: Point[] = [];
  const inner: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    const wp = wallPointAt(w, s0 + ((s1 - s0) * i) / steps);
    outer.push({ x: wp.p.x + wp.n.x * h, y: wp.p.y + wp.n.y * h });
    inner.push({ x: wp.p.x - wp.n.x * h, y: wp.p.y - wp.n.y * h });
  }
  return [...outer, ...inner.reverse()];
}

const yaw = (u: Point) => -Math.atan2(u.y, u.x);

/** A flat panel lying along the wall at `off` along it and `noff` out from its centerline (all in meters). */
function slab(wp: WallPoint, off: number, noff: number, len: number, thick: number, y0: number, y1: number, color: string, o: Partial<Look> = {}): Part {
  return { t: 'box', x: wp.p.x + wp.u.x * off + wp.n.x * noff, y: (y0 + y1) / 2, z: wp.p.y + wp.u.y * off + wp.n.y * noff, sx: len, sy: y1 - y0, sz: thick, ry: yaw(wp.u), color, ...o };
}

/** A glass pane in a white frame. `look` is added to every piece (a moving leaf carries its animation). */
function glazed(wp: WallPoint, off: number, width: number, y0: number, y1: number, noff = 0, look: Partial<Look> = {}): Part[] {
  const t = 0.06;
  return [
    slab(wp, off, noff, width - 0.04, 0.02, y0 + 0.03, y1 - 0.03, GLASS, { glass: true, ...look }),
    slab(wp, off, noff, width, t, y0, y0 + 0.05, FRAME, look),
    slab(wp, off, noff, width, t, y1 - 0.05, y1, FRAME, look),
    slab(wp, off - width / 2 + 0.025, noff, 0.05, t, y0, y1, FRAME, look),
    slab(wp, off + width / 2 - 0.025, noff, 0.05, t, y0, y1, FRAME, look),
  ];
}

/** The angle (three.js sense, about the vertical axis) that swings a leaf from pointing along `closed` to pointing along `open` (plan directions). */
export function swingAngle(closed: Point, open: Point): number {
  let d = Math.atan2(open.y, open.x) - Math.atan2(closed.y, closed.x);
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d <= -Math.PI) d += 2 * Math.PI;
  return -d;
}

/** The swinging leaf of a double door: `side` -1 is hinged at the start of the opening, +1 at its end. Both open towards the swing side. */
function leafAnim(wp: WallPoint, o: Opening, side: -1 | 1, width: number, base: number): Anim {
  const hinge = { x: wp.p.x + wp.u.x * (width / 2) * side, y: wp.p.y + wp.u.y * (width / 2) * side };
  const closed = side === -1 ? wp.u : { x: -wp.u.x, y: -wp.u.y };
  return { door: o.id, kind: 'swing', origin: [hinge.x, base, hinge.y], angle: swingAngle(closed, { x: wp.n.x * o.swing, y: wp.n.y * o.swing }) };
}

/** Thin covering panels on the painted faces of a wall between two distances along it and two heights (a hair outside the wall). */
export function skinPanels(w: Wall, s0: number, s1: number, y0: number, y1: number): Part[] {
  if (!w.paint || y1 - y0 < 0.01) return [];
  const out: Part[] = [];
  const steps = wallArc(w) ? Math.max(1, Math.ceil(((s1 - s0) * 8) / 4)) : 1;
  for (const side of ['l', 'r'] as const) {
    const skin = w.paint[side];
    if (!skin) continue;
    const sign = side === 'r' ? 1 : -1;
    const off = w.thickness / 2 + 0.002;
    for (let i = 0; i < steps; i++) {
      const a = wallPointAt(w, s0 + ((s1 - s0) * i) / steps);
      const b = wallPointAt(w, s0 + ((s1 - s0) * (i + 1)) / steps);
      const A: [number, number] = [a.p.x + a.n.x * off * sign, a.p.y + a.n.y * off * sign];
      const B: [number, number] = [b.p.x + b.n.x * off * sign, b.p.y + b.n.y * off * sign];
      const quad: [number, number, number][] = [[A[0], y0, A[1]], [B[0], y0, B[1]], [B[0], y1, B[1]], [A[0], y1, A[1]]];
      out.push({ t: 'panel', pts: sign === 1 ? quad : [quad[1], quad[0], quad[3], quad[2]], thick: 0.004, facing: [a.n.x * sign, 0, a.n.y * sign], color: skin.color, tex: skin.finish === 'paint' ? undefined : { kind: `wall-${skin.finish}`, color: skin.color } });
    }
  }
  return out;
}

/** One hinged leaf in its frame: a paneled interior door, a solid front door with a fanlight, or a half-glazed garden door. */
function singleDoor(w: Wall, o: Opening, wp: WallPoint, base: number, head: number, width: number): Part[] {
  const t = w.thickness;
  const sgn = o.hinge === 'a' ? -1 : 1;
  const hinge = { x: wp.p.x + wp.u.x * (width / 2) * sgn, y: wp.p.y + wp.u.y * (width / 2) * sgn };
  const closed = o.hinge === 'a' ? wp.u : { x: -wp.u.x, y: -wp.u.y };
  const anim: Anim = { door: o.id, kind: 'swing', origin: [hinge.x, base, hinge.y], angle: swingAngle(closed, { x: wp.n.x * o.swing, y: wp.n.y * o.swing }) };
  const A: Partial<Look> = { anim };
  const free = o.hinge === 'a' ? 1 : -1; // towards the free edge of the leaf
  const lw = width - 0.07;
  const out: Part[] = [];
  const frame = (jamb: number) => [slab(wp, 0, 0, width, t, head - 0.05, head, FRAME), slab(wp, -width / 2 + jamb / 2, 0, jamb, t + 0.02, base, head, FRAME), slab(wp, width / 2 - jamb / 2, 0, jamb, t + 0.02, base, head, FRAME)];
  const handle = (y: number, len: number, color: string) => [
    slab(wp, free * (lw / 2 - 0.09), 0, 0.03, 0.12 + 0.045, y, y + len, color, A),
    slab(wp, free * (lw / 2 - 0.09), 0, 0.03, 0.12 + 0.045, y, y + len, color, A),
  ];

  if (o.kind === 'door') {
    // interior: a light wooden door with two recessed panels and a lever handle
    const top = head - 0.05;
    out.push(slab(wp, 0, 0, lw, 0.04, base, top, '#e2d3b8', A));
    for (const [y0, y1] of [[base + 0.15, base + 0.95], [base + 1.1, top - 0.15]]) out.push(slab(wp, 0, 0, lw - 0.3, 0.052, y0, y1, '#d3c3a4', A));
    out.push(slab(wp, free * (lw / 2 - 0.07), 0, 0.12, 0.09, base + 0.99, base + 1.02, '#9ca3af', A), slab(wp, free * (lw / 2 - 0.05), 0, 0.04, 0.07, base + 0.95, base + 1.06, '#9ca3af', A));
    out.push(...frame(0.04));
  } else if (o.kind === 'main') {
    // the front door: a heavy dark door with raised panels, a long handle, a letterbox and a number, and a fanlight over it
    const top = head - 0.3;
    out.push(slab(wp, 0, 0, lw, 0.06, base, top, '#274a5e', A));
    const colW = (lw - 0.36) / 2;
    for (const cx of [-1, 1]) for (const [y0, y1] of [[base + 0.2, base + 0.95], [base + 1.1, top - 0.2]]) out.push(slab(wp, (cx * (colW + 0.12)) / 2 + cx * 0.02, 0, colW, 0.078, y0, y1, '#2f5b73', A));
    out.push(slab(wp, free * (lw / 2 - 0.08), 0, 0.03, 0.2, base + 0.85, base + 1.4, '#c9a24a', A));
    out.push(slab(wp, 0, 0, 0.2, 0.085, base + 1.05, base + 1.12, '#c9a24a', A), slab(wp, 0, 0, 0.1, 0.085, base + 1.45, base + 1.55, '#e5e7eb', A));
    out.push(...glazed(wp, 0, width - 0.1, top, head - 0.03), slab(wp, 0, 0, 0.04, 0.07, top, head - 0.03, FRAME));
    out.push(...frame(0.08), slab(wp, 0, 0, width + 0.1, t + 0.25, base, base + 0.05, '#cbd5e1'));
  } else {
    // garden door: white frame, glass in the upper part with bars, a solid panel below
    const top = head - 0.04;
    const rail = base + 0.8;
    out.push(slab(wp, 0, 0, lw, 0.05, base, rail, '#f1f5f9', A), slab(wp, 0, 0, lw - 0.3, 0.062, base + 0.12, rail - 0.12, '#e2e8f0', A));
    out.push(...glazed(wp, 0, lw, rail, top, 0, A));
    out.push(slab(wp, 0, 0, 0.035, 0.06, rail, top, FRAME, A), slab(wp, 0, 0, lw, 0.06, (rail + top) / 2, (rail + top) / 2 + 0.035, FRAME, A));
    out.push(slab(wp, free * (lw / 2 - 0.07), 0, 0.03, 0.12, base + 0.95, base + 1.15, '#9ca3af', A));
    out.push(...frame(0.06));
  }
  void handle;
  return out;
}

function openingParts(w: Wall, o: Opening, base: number, top: number, wy0: number): Part[] {
  const L = wallLength(w);
  const wp = wallPointAt(w, o.pos);
  const s0 = Math.max(0, o.pos - o.width / 2);
  const s1 = Math.min(L, o.pos + o.width / 2);
  const width = s1 - s0;
  if (width < 0.1) return [];
  const tall = top - base;
  const head = base + Math.min(OPENING_HEAD[o.kind], tall - 0.1);
  const wallColor = WALL_COLOR[w.type];
  const out: Part[] = [];
  const lintel = (y0: number) => y0 < top - 0.005 && out.push(prism(wallStrip(w, s0, s1), y0, top, wallColor), ...skinPanels(w, s0, s1, y0, top));
  const sill = (y1: number) => y1 > wy0 + 0.005 && out.push(prism(wallStrip(w, s0, s1), wy0, y1, wallColor), ...skinPanels(w, s0, s1, wy0, y1));
  const t = w.thickness;

  if (tall < 1.3) return out; // low railings: a gap is a gap
  switch (o.kind) {
    case 'gap':
      lintel(head);
      break;
    case 'door':
    case 'main':
    case 'garden': {
      lintel(head);
      out.push(...singleDoor(w, o, wp, base, head, width));
      break;
    }
    case 'double': {
      lintel(head);
      for (const sgn of [-1, 1] as const) out.push(slab(wp, (sgn * width) / 4, 0, width / 2 - 0.05, 0.045, base, head - 0.03, WOOD, { anim: leafAnim(wp, o, sgn, width, base) }));
      out.push(slab(wp, 0, 0, width, t, head - 0.04, head, FRAME));
      break;
    }
    case 'french': {
      lintel(head);
      for (const sgn of [-1, 1] as const) out.push(...glazed(wp, (sgn * width) / 4, width / 2, base, head - 0.02, 0, { anim: leafAnim(wp, o, sgn, width, base) }));
      break;
    }
    case 'sliding': {
      lintel(head);
      const slide: Anim = { door: o.id, kind: 'slide', move: [wp.u.x * width * 0.44, 0, wp.u.y * width * 0.44] };
      out.push(...glazed(wp, -width * 0.22, width * 0.56, base, head - 0.02, 0.03, { anim: slide }), ...glazed(wp, width * 0.22, width * 0.56, base, head - 0.02, -0.03));
      break;
    }
    case 'window':
    case 'bay': {
      const y0 = base + WINDOW_SILL;
      const y1 = Math.max(y0 + 0.4, head);
      sill(y0);
      lintel(y1);
      if (o.kind === 'window') {
        out.push(...glazed(wp, 0, width, y0, y1));
        if (width > 1.3) out.push(slab(wp, 0, 0, 0.05, 0.06, y0, y1, FRAME));
        out.push(slab(wp, 0, t / 2 + 0.03, width + 0.08, 0.1, y0 - 0.03, y0, '#e5e7eb'));
      } else {
        const side = o.swing;
        const bay = Math.min(0.6, width * 0.35);
        const inset = bay * 0.7;
        const local = (a: number, b: number): Point => ({ x: wp.p.x + wp.u.x * a + wp.n.x * b, y: wp.p.y + wp.u.y * a + wp.n.y * b });
        const pts = [local(-width / 2, (side * t) / 2), local(-width / 2 + inset, side * (t / 2 + bay)), local(width / 2 - inset, side * (t / 2 + bay)), local(width / 2, (side * t) / 2)];
        out.push(prism(pts, wy0, y0, wallColor), prism(pts, y1, y1 + 0.08, '#e5e7eb'));
        for (let i = 0; i < 3; i++) {
          const a = pts[i];
          const b = pts[i + 1];
          out.push({ t: 'box', x: (a.x + b.x) / 2, y: (y0 + y1) / 2, z: (a.y + b.y) / 2, sx: Math.hypot(b.x - a.x, b.y - a.y), sy: y1 - y0, sz: 0.03, ry: yaw({ x: b.x - a.x, y: b.y - a.y }), color: GLASS, glass: true });
        }
      }
      break;
    }
    case 'garage': {
      lintel(head);
      const lift: Anim = { door: o.id, kind: 'slide', move: [0, (head - base) * 0.97, 0] };
      out.push(slab(wp, 0, 0, width - 0.04, 0.05, base, head - 0.02, '#e7e5e4', { anim: lift }));
      for (let y = base + 0.4; y < head - 0.1; y += 0.4) out.push(slab(wp, 0, 0, width - 0.04, 0.056, y, y + 0.014, '#a8a29e', { anim: lift }));
      break;
    }
  }
  return out;
}

function wallChunk(d: Design, w: Wall, ops: Opening[], elev: number): Part[] {
  const above = elev > 0.01;
  const wy0 = above ? elev - slabThickness(d) : elev;
  // the walls of a basement reach up to the ground (a hair under it, so they do not fight with its top)
  const top = elev < -0.01 ? Math.max(elev + w.height, -0.03) : elev + w.height;
  const color = WALL_COLOR[w.type];
  const out: Part[] = [];
  for (const [a, b] of wallSolidSegments(w, ops)) {
    if (b - a <= 0.005) continue;
    out.push(prism(wallStrip(w, a, b), wy0, top, color), ...skinPanels(w, Math.max(0, a), Math.min(wallLength(w), b), wy0, top));
  }
  for (const o of ops) out.push(...openingParts(w, o, elev, top, wy0));
  return out;
}

// ---- stairs ------------------------------------------------------------------------------------------------------------

/** A staircase around its own center, climbing towards -z when unrotated (the same orientation as the plan symbol). */
export function stairParts(s: Pick<Stair, 'kind' | 'w' | 'd' | 'steps' | 'rise' | 'flip'>): Part[] {
  const { w, d, rise } = s;
  const color = '#e5e7eb';
  const out: Part[] = [];
  for (const st of stairSteps(s)) {
    const centered = st.poly.map((p) => ({ x: p.x - w / 2, y: p.y - d / 2 }));
    if (st.thin) out.push(prism(centered, st.top - 0.06, st.top, color));
    else {
      const xs = centered.map((p) => p.x);
      const ys = centered.map((p) => p.y);
      out.push(box(Math.min(...xs), Math.max(...xs), 0, st.top, Math.min(...ys), Math.max(...ys), color));
    }
  }
  if (s.kind === 'spiral') out.push(cyl(0, 0, 0, rise + 0.9, Math.min(0.12, Math.min(w, d) * 0.1), '#9ca3af'));
  return out;
}

const RAIL_HEIGHT = 0.9;
const RAIL_COLORS = { wood: '#a5835a', metal: '#6b7280', glass: '#bfe3f5', cable: '#9ca3af' } as const;

/** A moving average, to turn the zig-zag of step tops into a smooth slope for a handrail. */
const smooth = (ys: number[], r: number) => ys.map((_, i) => {
  let sum = 0;
  let n = 0;
  for (let k = Math.max(0, i - r); k <= Math.min(ys.length - 1, i + r); k++) {
    sum += ys[k];
    n++;
  }
  return sum / n;
});

/** One run of railing along a path (stair-box coordinates, already centered): posts or glass, and a handrail on top. `floorY` is the height of the walking surface at each point. */
function railRun(path: { x: number; y: number }[], floorY: number[], style: Exclude<Stair['railing'], undefined>['style']): Part[] {
  const out: Part[] = [];
  if (style === 'none' || path.length < 2) return out;
  const top = smooth(floorY, 2).map((y) => y + RAIL_HEIGHT);
  const at = (i: number, y: number): [number, number, number] => [path[i].x, y, path[i].y];
  const color = RAIL_COLORS[style];
  for (let i = 0; i + 1 < path.length; i++) {
    const dx = path[i + 1].x - path[i].x;
    const dz = path[i + 1].y - path[i].y;
    const len = Math.hypot(dx, dz) || 1;
    if (style === 'glass') out.push({ t: 'panel', pts: [at(i, floorY[i] + 0.06), at(i + 1, floorY[i + 1] + 0.06), at(i + 1, top[i + 1] - 0.04), at(i, top[i] - 0.04)], thick: 0.012, facing: [-dz / len, 0, dx / len], color, glass: true });
    if (style === 'cable') for (const f of [0.28, 0.52, 0.76]) out.push(beam(at(i, floorY[i] + RAIL_HEIGHT * f), at(i + 1, floorY[i + 1] + RAIL_HEIGHT * f), 0.008, 0.008, '#c2c8d0'));
    out.push(beam(at(i, top[i]), at(i + 1, top[i + 1]), style === 'wood' ? 0.06 : 0.04, style === 'wood' ? 0.05 : 0.035, style === 'glass' ? '#9ca3af' : style === 'metal' ? '#374151' : '#a5835a'));
  }
  const every = style === 'wood' ? 1 : style === 'metal' ? 2 : style === 'glass' ? 6 : 6;
  path.forEach((p, i) => {
    if (i % every !== 0 && i !== path.length - 1) return;
    if (style === 'wood') out.push(box(p.x - 0.018, p.x + 0.018, floorY[i], top[i], p.y - 0.018, p.y + 0.018, '#b08968'));
    else if (style === 'metal') out.push(cyl(p.x, p.y, floorY[i], top[i], 0.011, '#9ca3af'));
    else out.push(cyl(p.x, p.y, floorY[i], top[i], style === 'glass' ? 0.016 : 0.014, '#9ca3af'));
  });
  return out;
}

/** The railings of a staircase (`guard` false: along its flights) or the guard rail around its opening in the floor above (`guard` true), in the stair's centered box. */
export function railParts(s: Pick<Stair, 'kind' | 'w' | 'd' | 'steps' | 'rise' | 'flip' | 'railing'>, guard: boolean): Part[] {
  const r = s.railing;
  if (!r || r.style === 'none') return [];
  const { w, d } = s;
  const c = (p: { x: number; y: number }) => ({ x: p.x - w / 2, y: p.y - d / 2 });
  const out: Part[] = [];
  if (guard) {
    for (const [p, q] of guardEdges(s)) {
      const path = densify([p, q], 0.14).map(c);
      out.push(...railRun(path, path.map(() => s.rise), r.style));
    }
    return out;
  }
  const steps = stairSteps(s);
  const paths = railPaths(s);
  for (const [on, path] of [[r.a, paths.a], [r.b, paths.b]] as const) {
    if (!on || path.length < 2) continue;
    const dense = densify(path, 0.14);
    let last = 0;
    const ys = dense.map((p) => (last = stairTopAt(s, p, 0.08, steps) ?? last));
    // the first points before the first step is found take the height of the first one that is
    const first = dense.findIndex((p) => stairTopAt(s, p, 0.08, steps) !== null);
    for (let i = 0; i < first; i++) ys[i] = ys[first] ?? 0;
    out.push(...railRun(dense.map(c), ys, r.style));
  }
  return out;
}

/** The outline of a staircase on the plan (where it stands and the hole it makes in the floor above). */
export function stairPlanOutline(s: Pick<Stair, 'kind' | 'w' | 'd' | 'steps' | 'rise' | 'flip' | 'x' | 'y' | 'rotation'>): Point[] {
  const c = Math.cos(rad(s.rotation));
  const sn = Math.sin(rad(s.rotation));
  return stairOutline(s).map((p) => {
    const lx = p.x - s.w / 2;
    const ly = p.y - s.d / 2;
    return { x: s.x + lx * c - ly * sn, y: s.y + lx * sn + ly * c };
  });
}

/** The holes the stairs of the floor below make in a room's floor. */
export function stairHoles(room: { points: Point[] }, below: Stair[]): Point[][] {
  const out: Point[][] = [];
  const convex = isConvex(room.points);
  for (const st of below) {
    const outline = stairPlanOutline(st);
    if (convex) {
      const hole = clipPolygon(outline, room.points);
      if (hole.length >= 3) out.push(hole);
    } else if (outline.every((p) => pointInPolygon(p, room.points))) out.push(outline);
  }
  return out;
}

// ---- outdoors ----------------------------------------------------------------------------------------------------------

const ZONE_HEIGHT: Record<Zone['kind'], number> = { lawn: 0.03, terrace: 0.06, driveway: 0.04, flowerbed: 0.08, water: 0.0, plot: 0 };

/** A pond or pool as a basin: a floor, walls all around, and the water a little below the edge. */
function pondParts(z: Zone, elev: number): Part[] {
  const depth = elev === 0 ? 0.9 : 0.3;
  const pts = z.points;
  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  const out: Part[] = [prism(pts, elev - depth - 0.1, elev - depth, '#8fbfd6'), prism(pts, elev - depth, elev - 0.15, z.color, undefined, { glass: true })];
  pts.forEach((a, i) => {
    const b = pts[(i + 1) % pts.length];
    if (Math.hypot(b.x - a.x, b.y - a.y) < 1e-4) return;
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    out.push({ t: 'panel', pts: [[a.x, elev, a.y], [b.x, elev, b.y], [b.x, elev - depth, b.y], [a.x, elev - depth, a.y]], thick: 0.12, facing: [cx - mid.x, 0, cy - mid.y], color: '#cbd5dc' });
    out.push({ t: 'box', x: mid.x, y: elev + 0.02, z: mid.y, sx: Math.hypot(b.x - a.x, b.y - a.y), sy: 0.05, sz: 0.3, ry: yaw({ x: b.x - a.x, y: b.y - a.y }), color: '#e5e7eb' });
  });
  return out;
}

function zoneParts(z: Zone, elev: number): Part[] {
  if (z.kind === 'plot') {
    // the plot boundary: a thin line around the site
    return z.points.map((a, i) => {
      const b = z.points[(i + 1) % z.points.length];
      return { t: 'box', x: (a.x + b.x) / 2, y: elev + 0.02, z: (a.y + b.y) / 2, sx: Math.hypot(b.x - a.x, b.y - a.y), sy: 0.03, sz: 0.1, ry: yaw({ x: b.x - a.x, y: b.y - a.y }), color: '#8c9a7b' } as Part;
    });
  }
  if (z.kind === 'water') return pondParts(z, elev);
  return [prism(z.points, elev - 0.02, elev + ZONE_HEIGHT[z.kind], z.color)];
}

function stripParts(kind: 'road' | 'path' | 'fence' | 'hedge', pts: Point[], width: number, color: string, elev: number): Part[] {
  const out: Part[] = [];
  const h = kind === 'road' ? 0.02 : kind === 'path' ? 0.03 : kind === 'fence' ? 1.1 : 1.2;
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 1e-4) continue;
    out.push({ t: 'box', x: (a.x + b.x) / 2, y: elev + h / 2 - 0.01, z: (a.y + b.y) / 2, sx: len + (kind === 'fence' ? 0 : width * 0.0), sy: h, sz: width, ry: yaw({ x: b.x - a.x, y: b.y - a.y }), color });
    if (kind === 'road' || kind === 'path') {
      // dashes in the middle of a street
      if (kind === 'road') {
        const dir = { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
        for (let s = 0.5; s + 1 < len; s += 3) out.push({ t: 'box', x: a.x + dir.x * (s + 0.5), y: elev + h, z: a.y + dir.y * (s + 0.5), sx: 1.5, sy: 0.005, sz: 0.12, ry: yaw(dir), color: '#f5f5f4' });
      }
    }
  }
  // round the joints: a disc for roads and paths, a post for fences, a block for hedges
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    if (kind === 'road' || kind === 'path') {
      if (i > 0 && i < pts.length - 1) out.push(cyl(p.x, p.y, elev - 0.01, elev - 0.01 + h, width / 2, color));
    } else if (kind === 'fence') out.push(box(p.x - 0.05, p.x + 0.05, elev, elev + 1.2, p.y - 0.05, p.y + 0.05, '#5b4a38'));
    else if (i > 0 && i < pts.length - 1) out.push(box(p.x - width / 2, p.x + width / 2, elev, elev + h - 0.01, p.y - width / 2, p.y + width / 2, color));
  }
  if (kind === 'fence') {
    // posts every 2 m along the fence
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      for (let s = 2; s < len - 0.3; s += 2) out.push(box(a.x + ((b.x - a.x) * s) / len - 0.05, a.x + ((b.x - a.x) * s) / len + 0.05, elev, elev + 1.2, a.y + ((b.y - a.y) * s) / len - 0.05, a.y + ((b.y - a.y) * s) / len + 0.05, '#5b4a38'));
    }
  }
  return out;
}

// ---- furniture -----------------------------------------------------------------------------------------------------------

const inFootprint = (f: Furniture, p: Point) => {
  const c = Math.cos(rad(-f.rotation));
  const s = Math.sin(rad(-f.rotation));
  const dx = p.x - f.x;
  const dy = p.y - f.y;
  return Math.abs(dx * c - dy * s) <= f.w / 2 && Math.abs(dx * s + dy * c) <= f.d / 2;
};

/** The four corners of a furniture item's footprint on the plan. */
function rectPoints(f: Furniture): Point[] {
  const c = Math.cos(rad(f.rotation));
  const s = Math.sin(rad(f.rotation));
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => ({ x: f.x + (a * f.w * c - b * f.d * s) / 2, y: f.y + (a * f.w * s + b * f.d * c) / 2 }));
}

/** Height of whatever stands under a table lamp or plant: the tallest low piece of furniture it sits in. */
function supportHeight(d: Design, f: Furniture): number {
  let top = 0;
  for (const o of d.furniture) {
    if (o.id === f.id || o.floor !== f.floor || SITS_ON_FURNITURE.has(o.type) || !inFootprint(o, f)) continue;
    const h = furnitureHeight(o);
    if (h > top && h <= 1.3) top = h;
  }
  return top;
}

export function furnitureChunk(d: Design, f: Furniture, elev: number): Part[] {
  const custom = f.type.startsWith(CUSTOM_PREFIX) ? d.custom.find((c) => CUSTOM_PREFIX + c.id === f.type) : undefined;
  const type = custom?.shape === 'symbol' && custom.base ? custom.base : f.type;
  const h = typeof f.height === 'number' ? f.height : furnitureHeight(f);
  const k = { w: f.w, d: f.d, h, c: f.color, hw: f.w / 2, hd: f.d / 2, on: f.on !== false, ceil: ceilingHeight(d) };
  const parts = furnitureParts(type, k, custom);
  const lift = SITS_ON_FURNITURE.has(f.type) ? supportHeight(d, f) : 0;
  return place(parts, f.x, f.y, rad(f.rotation), elev + lift);
}

// ---- roofs ----------------------------------------------------------------------------------------------------------

const BRICK = '#a1553c';

/** The skylights that lie in a roof (a skylight belongs to the first roof on its floor that covers it). */
export function skylightsOn(d: Design, r: Roof): Skylight[] {
  return d.skylights.filter((s) => s.floor === r.floor && skylightPlacement(d.roofs, s.floor, s)?.roof.id === r.id);
}

/** A roof window: glass in a white frame lying in the slope (or a raised box on a flat roof), in the roof's own box. */
/** The four corners of a skylight's opening in the plane of the roof (roof-local coordinates), or null on a flat roof where it lies at the roof's level. */
export function skylightCorners(sp: SkylightPlacement, s: Skylight): V3[] {
  const hw = s.w / 2;
  const hd = s.d / 2;
  if (sp.flat) return [[sp.lx - hw, sp.y, sp.lz - hd], [sp.lx + hw, sp.y, sp.lz - hd], [sp.lx + hw, sp.y, sp.lz + hd], [sp.lx - hw, sp.y, sp.lz + hd]];
  const at = (a: number, b: number): V3 => [sp.lx + sp.t[0] * a + sp.u[0] * b, sp.y + sp.t[1] * a + sp.u[1] * b, sp.lz + sp.t[2] * a + sp.u[2] * b];
  return [at(-hw, -hd), at(hw, -hd), at(hw, hd), at(-hw, hd)];
}

export function skylightParts(sp: SkylightPlacement, s: Skylight): Part[] {
  if (sp.flat) {
    const hw = s.w / 2;
    const hd = s.d / 2;
    return [box(sp.lx - hw - 0.05, sp.lx + hw + 0.05, sp.y, sp.y + 0.3, sp.lz - hd - 0.05, sp.lz + hd + 0.05, '#f1f5f9'), box(sp.lx - hw, sp.lx + hw, sp.y + 0.3, sp.y + 0.33, sp.lz - hd, sp.lz + hd, '#9fd0f0', { glass: true })];
  }
  const { t, u, n } = sp;
  const at = (a: number, b: number, lift: number): V3 => [sp.lx + t[0] * a + u[0] * b + n[0] * lift, sp.y + t[1] * a + u[1] * b + n[1] * lift, sp.lz + t[2] * a + u[2] * b + n[2] * lift];
  const rect = (a0: number, a1: number, b0: number, b1: number, lift: number): V3[] => [at(a0, b0, lift), at(a1, b0, lift), at(a1, b1, lift), at(a0, b1, lift)];
  const hw = s.w / 2;
  const hd = s.d / 2;
  const f = 0.07;
  const strip = (a0: number, a1: number, b0: number, b1: number): Part => ({ t: 'panel', pts: rect(a0, a1, b0, b1, 0.045), thick: 0.05, facing: n, color: '#f1f5f9' });
  return [
    strip(-hw - f, hw + f, hd, hd + f),
    strip(-hw - f, hw + f, -hd - f, -hd),
    strip(-hw - f, -hw, -hd, hd),
    strip(hw, hw + f, -hd, hd),
    { t: 'panel', pts: rect(-hw, hw, -hd, hd, 0.028), thick: 0.01, facing: n, color: '#334155' },
    { t: 'panel', pts: rect(-hw, hw, -hd, hd, 0.036), thick: 0.01, facing: n, color: '#9fd0f0', glass: true },
  ];
}

/** A roof as panels and blocks in its own box, then moved onto the walls it covers. */
export function roofParts(d: Design, r: Roof, elev: number): Part[] {
  const m = roofModel(r);
  const out: Part[] = [];
  const up: [number, number, number] = [0, 1, 0];
  // each skylight cuts a hole in the roof face it lies in (when it lies wholly inside that face), so light comes through
  const mine = skylightsOn(d, r).flatMap((sk) => {
    const sp = skylightPlacement(d.roofs, r.floor, sk);
    return sp ? [{ sk, sp, corners: skylightCorners(sp, sk) }] : [];
  });
  for (const [fi, f] of m.faces.entries()) {
    if (f.kind === 'slope') {
      const holes = mine.filter((x) => x.sp.face === fi && x.corners.every((c) => inFace(f.pts, c[0], c[2]))).map((x) => x.corners);
      out.push({ t: 'panel', pts: f.pts, thick: r.thickness, facing: up, color: r.color, tex: { kind: r.material, color: r.color }, ...(holes.length ? { holes } : {}) });
    } else {
      const sx = Math.sign(f.pts[0][0]) || 1;
      // a little lower than the roof, so the top edge of the wall hides under the roof instead of fighting with it
      out.push({ t: 'panel', pts: f.pts.map((p) => [p[0], p[1] > 0.01 ? p[1] - r.thickness : p[1], p[2]] as [number, number, number]), thick: 0.2, facing: [sx, 0, 0], color: WALL_COLOR.exterior });
    }
  }
  for (const b of m.blocks) out.push(box(b.x0, b.x1, b.y0, b.y1, b.z0, b.z1, b.kind === 'chimney' ? BRICK : b.kind === 'cap' ? '#6b7280' : WALL_COLOR.exterior));
  for (const x of mine) out.push(...skylightParts(x.sp, x.sk));
  return place(out, r.x, r.y, rad(r.rotation), elev + roofBaseHeight(d, r.floor));
}

// ---- the whole scene -------------------------------------------------------------------------------------------------------

export function sceneChunks(d: Design, opts: BuildOptions = {}): ChunkSpec[] {
  const elev = floorElevations(d);
  const hiddenFrom = opts.hideAbove ? d.floors.findIndex((f) => f.id === opts.hideAbove) : -1;
  const off = new Set(opts.hiddenFloors ?? []);
  const visible = new Set(d.floors.filter((f, i) => !off.has(f.id) && (hiddenFrom < 0 || i <= hiddenFrom)).map((f) => f.id));
  const shown = (layer: keyof Design['layers']) => d.layers[layer].visible;
  const activeIndex = hiddenFrom;
  const slab = slabThickness(d);
  const out: ChunkSpec[] = [];

  const opsByWall = new Map<string, Opening[]>();
  for (const o of d.openings) (opsByWall.get(o.wallId) ?? opsByWall.set(o.wallId, []).get(o.wallId)!).push(o);

  for (const w of d.walls) {
    if (!visible.has(w.floor) || !shown('structure')) continue;
    const e = elev.get(w.floor) ?? 0;
    const ops = opsByWall.get(w.id) ?? [];
    out.push({ key: `wall:${w.id}`, deps: [w, e, slab, ...ops], make: () => wallChunk(d, w, ops, e) });
  }
  for (const r of d.rooms) {
    if (!visible.has(r.floor) || !shown('rooms')) continue;
    const e = elev.get(r.floor) ?? 0;
    const thick = e > 0.01 ? slab : 0.1;
    // the stairs of the floor below come up through this floor: they leave a hole in it
    const at = d.floors.findIndex((f) => f.id === r.floor);
    const stairsBelow = at > 0 ? d.stairs.filter((st) => st.floor === d.floors[at - 1].id) : [];
    out.push({ key: `room:${r.id}`, deps: [r, e, thick, ...stairsBelow], make: () => [prism(r.points, e - thick, e + 0.01, r.color, r.material !== 'plain' ? { kind: r.material, color: r.color } : undefined, {}, stairHoles(r, stairsBelow))] });
  }
  for (const z of d.zones) {
    if (!visible.has(z.floor) || !shown('outdoor')) continue;
    const e = elev.get(z.floor) ?? 0;
    out.push({ key: `zone:${z.id}`, deps: [z, e], make: () => zoneParts(z, e) });
  }
  for (const s of d.strips) {
    if (!visible.has(s.floor) || !shown('outdoor')) continue;
    const e = elev.get(s.floor) ?? 0;
    out.push({ key: `strip:${s.id}`, deps: [s, e], make: () => stripParts(s.kind, s.points, s.width, STRIP_STYLES[s.kind].color, e) });
  }
  for (const s of d.stairs) {
    if (!visible.has(s.floor) || !shown('structure')) continue;
    const e = elev.get(s.floor) ?? 0;
    const hasAbove = d.floors.findIndex((f) => f.id === s.floor) < d.floors.length - 1;
    out.push({ key: `stair:${s.id}`, deps: [s, e, hasAbove], make: () => place([...stairParts(s), ...railParts(s, false), ...(hasAbove ? railParts(s, true) : [])], s.x, s.y, rad(s.rotation), e) });
  }
  for (const r of d.roofs) {
    // a cut-away takes off the roof of the floor you are on, and everything above it
    const index = d.floors.findIndex((f) => f.id === r.floor);
    // looking into an attic, its ceiling is the roof of the floor below: that comes off as well
    const intoAttic = activeIndex > 0 && !!d.floors[activeIndex].attic && index === activeIndex - 1;
    if (!visible.has(r.floor) || !shown('roofs') || opts.showRoof === false || (activeIndex >= 0 && (index >= activeIndex || intoAttic))) continue;
    const e = elev.get(r.floor) ?? 0;
    const base = roofBaseHeight(d, r.floor);
    out.push({ key: `roof:${r.id}`, deps: [r, e, base, ...skylightsOn(d, r)], make: () => roofParts(d, r, e) });
  }
  for (const f of d.furniture) {
    if (!visible.has(f.floor) || !shown(catalogLayer(f.type))) continue;
    const e = elev.get(f.floor) ?? 0;
    const deps: unknown[] = [f, e, d.settings.storeyHeight];
    if (SITS_ON_FURNITURE.has(f.type)) deps.push(d.furniture);
    if (f.type.startsWith(CUSTOM_PREFIX)) deps.push(d.custom);
    out.push({ key: `fur:${f.id}`, deps, make: () => furnitureChunk(d, f, e) });
  }

  // the ground: a big lawn-colored slab with holes where there is a basement and where there are pools and ponds
  const b = contentBounds(d);
  if (b) {
    const size = Math.max(600, Math.max(b.maxX - b.minX, b.maxY - b.minY) * 4 + 300);
    const cx = (b.minX + b.maxX) / 2;
    const cz = (b.minY + b.maxY) / 2;
    const holes: { key: unknown; pts: Point[] }[] = [];
    for (const r of d.rooms) {
      if ((elev.get(r.floor) ?? 0) < -0.01 && visible.has(r.floor) && shown('rooms')) holes.push({ key: r, pts: r.points });
    }
    for (const f of d.furniture) {
      if (f.type === 'pool' && (elev.get(f.floor) ?? 0) === 0 && visible.has(f.floor) && shown('furniture')) holes.push({ key: f, pts: rectPoints(f) });
    }
    for (const z of d.zones) {
      if (z.kind === 'water' && (elev.get(z.floor) ?? 0) === 0 && visible.has(z.floor) && shown('outdoor')) holes.push({ key: z, pts: z.points });
    }
    const half = size / 2;
    const square: Point[] = [{ x: cx - half, y: cz - half }, { x: cx + half, y: cz - half }, { x: cx + half, y: cz + half }, { x: cx - half, y: cz + half }];
    out.push({ key: 'ground', deps: [cx, cz, size, ...holes.map((h) => h.key)], make: () => [prism(square, -0.1, -0.02, '#d4e2c6', undefined, {}, holes.map((h) => h.pts))] });
  }
  return out;
}

/** Turn every chunk into parts at once (tests and one-off use). */
export function buildParts(d: Design, opts: BuildOptions = {}): Part[] {
  return sceneChunks(d, opts).flatMap((c) => c.make());
}

/** Size of the content in 3D, for framing the camera. */
export function sceneExtent(d: Design) {
  const b = contentBounds(d);
  const elev = floorElevations(d);
  const top = Math.max(3, ...d.floors.map((f) => (elev.get(f.id) ?? 0) + 3));
  if (!b) return { cx: 0, cz: 0, radius: 8, top };
  return { cx: (b.minX + b.maxX) / 2, cz: (b.minY + b.maxY) / 2, radius: Math.max(4, Math.hypot(b.maxX - b.minX, b.maxY - b.minY) / 2), top };
}
