/**
 * The design as a 3D scene: a list of "chunks" (one per wall, room, piece of furniture, ...), each of which makes its parts only
 * when asked. The viewer asks for a chunk again only when something in its `deps` changed (immer keeps untouched items
 * identical), so dragging a sofa rebuilds one sofa, not the house.
 */
import { CUSTOM_PREFIX, catalogLayer, furnitureHeight, shade } from '../catalog';
import { contentBounds } from '../bounds';
import { clipPolygon, faceSpan, isConvex, pointInPolygon, wallArc, wallCorners, wallLength, wallPointAt, wallSegmentOutline, wallSolidSegments, type WallCorners, type WallPoint } from '../geometry';
import type { Design, Furniture, Gate, Opening, OpeningKind, Point, Roof, Skylight, Stair, Strip, Wall, WallType, Zone } from '../model';
import { STRIP_STYLES, gateGeometry, gateSpans, pathMarks, solidSpans, stripColor } from '../outdoor';
import { OPENING_HEAD, WINDOW_SPEC, isWindowKind } from '../windows';
import { inFace, roofBaseHeight, roofModel, skylightPlacement, type SkylightPlacement, type V3 } from '../roofs';
import { guardAvoid, stairOutline } from '../stairs';
import { groundIndex } from '../shadows';
import { box, cyl, place, prism, type Anim, type Look, type Part } from './parts';
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
export { OPENING_HEAD };
export const WINDOW_SILL = WINDOW_SPEC.window.sill;

// ---- walls ----------------------------------------------------------------------------------------------------------

/** Outline of the part of a wall between distances s0 and s1 along it (full thickness, following the curve). */
export function wallStrip(w: Wall, s0: number, s1: number, corners: WallCorners = {}): Point[] {
  const h = w.thickness / 2;
  const arc = wallArc(w);
  if (!arc) return wallSegmentOutline(w, s0, s1, corners);
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
export function skinPanels(w: Wall, s0: number, s1: number, y0: number, y1: number, corners: WallCorners = {}): Part[] {
  if (!w.paint || y1 - y0 < 0.01) return [];
  const out: Part[] = [];
  for (const side of ['l', 'r'] as const) {
    const skin = w.paint[side];
    if (!skin) continue;
    // past the end of the wall (the half thickness it is drawn longer): at a corner the outer face runs out to where the two outer
    // faces meet and the inner face stops at the centerline; at a free end both faces run to the end of the wall
    const [t0, t1] = faceSpan(w, side, s0, s1, corners);
    if (t1 - t0 < 0.005) continue;
    const steps = wallArc(w) ? Math.max(1, Math.ceil(((t1 - t0) * 8) / 4)) : 1;
    const sign = side === 'r' ? 1 : -1;
    const off = w.thickness / 2 + 0.002;
    for (let i = 0; i < steps; i++) {
      const a = wallPointAt(w, t0 + ((t1 - t0) * i) / steps);
      const b = wallPointAt(w, t0 + ((t1 - t0) * (i + 1)) / steps);
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

/** The glass and frames of the window kinds (not the bay, which is built out of the wall). */
function windowGlass(wp: WallPoint, kind: Exclude<OpeningKind, 'bay'>, width: number, y0: number, y1: number, t: number): Part[] {
  const out: Part[] = [];
  const mullion = (off: number, w = 0.05) => out.push(slab(wp, off, 0, w, 0.06, y0, y1, FRAME));
  switch (kind) {
    case 'casement':
      // two wings with their own frames, a post between them and a handle on each
      for (const sgn of [-1, 1]) out.push(...glazed(wp, (sgn * width) / 4, width / 2, y0, y1));
      mullion(0, 0.07);
      for (const sgn of [-1, 1]) out.push(slab(wp, sgn * 0.09, 0.05, 0.02, 0.02, (y0 + y1) / 2 - 0.06, (y0 + y1) / 2 + 0.06, '#9ca3af'));
      break;
    case 'sash': {
      // two sashes meeting in the middle, each divided into small panes by thin bars
      const mid = (y0 + y1) / 2;
      out.push(...glazed(wp, 0, width, y0, mid + 0.02), ...glazed(wp, 0, width, mid - 0.02, y1));
      const cols = Math.max(2, Math.round(width / 0.4));
      for (let i = 1; i < cols; i++) mullion(-width / 2 + (width * i) / cols, 0.02);
      for (const f of [0.5]) out.push(slab(wp, 0, 0, width, 0.05, y0 + (mid - y0) * f - 0.01, y0 + (mid - y0) * f + 0.01, FRAME), slab(wp, 0, 0, width, 0.05, mid + (y1 - mid) * f - 0.01, mid + (y1 - mid) * f + 0.01, FRAME));
      break;
    }
    case 'picture':
      out.push(...glazed(wp, 0, width, y0, y1));
      break;
    case 'floorwin': {
      out.push(...glazed(wp, 0, width, y0, y1));
      const cols = Math.max(1, Math.round(width / 1.3));
      for (let i = 1; i < cols; i++) mullion(-width / 2 + (width * i) / cols, 0.05);
      break;
    }
    default:
      out.push(...glazed(wp, 0, width, y0, y1));
      if (width > 1.3 && kind === 'window') mullion(0);
  }
  void t;
  return out;
}

/** A door or window, in its wall: with its own sill and lintel heights, a round top and a frame color when it has them. */
function openingParts(w: Wall, o: Opening, base: number, top: number, wy0: number): Part[] {
  const parts = openingPartsPlain(w, o, base, top, wy0);
  return o.frame ? parts.map((p) => (p.color === FRAME ? { ...p, color: o.frame! } : p)) : parts;
}

function openingPartsPlain(w: Wall, o: Opening, base: number, top: number, wy0: number): Part[] {
  const L = wallLength(w);
  const wp = wallPointAt(w, o.pos);
  const s0 = Math.max(0, o.pos - o.width / 2);
  const s1 = Math.min(L, o.pos + o.width / 2);
  const width = s1 - s0;
  if (width < 0.1) return [];
  const tall = top - base;
  const head = base + Math.min(o.head ?? OPENING_HEAD[o.kind], tall - 0.1);
  const wallColor = WALL_COLOR[w.type];
  const out: Part[] = [];
  const lintel = (y0: number) => y0 < top - 0.005 && out.push(prism(wallStrip(w, s0, s1), y0, top, wallColor), ...skinPanels(w, s0, s1, y0, top));
  const sill = (y1: number) => y1 > wy0 + 0.005 && out.push(prism(wallStrip(w, s0, s1), wy0, y1, wallColor), ...skinPanels(w, s0, s1, wy0, y1));
  const t = w.thickness;

  // where the glass of a window starts and the opening ends; and the arch (a half circle) on top of the opening when it has one and there is room
  const win = isWindowKind(o.kind) && o.kind !== 'bay';
  const winY0 = base + (o.sill ?? (isWindowKind(o.kind) ? WINDOW_SPEC[o.kind].sill : 0));
  const yTop = win ? Math.max(winY0 + 0.4, head) : head;
  const yBot = win ? winY0 : base;
  const r = width / 2;
  const spring = o.arch && o.kind !== 'garage' && o.kind !== 'bay' && yTop - r >= yBot + 0.4 ? yTop - r : null;
  const leafTop = spring ?? head;
  /** The wall over the opening; over an arch the wall pieces beside the curve are cut in steps, and the arch is closed with glass. */
  const close = (yLintel: number) => {
    lintel(yLintel);
    if (spring === null) return;
    const N = 16;
    for (let k = 0; k < N; k++) {
      const y0 = spring + (r * k) / N;
      const y1 = spring + (r * (k + 1)) / N;
      const ym = (y0 + y1) / 2 - spring;
      const half = Math.sqrt(Math.max(0, r * r - ym * ym));
      const lo = o.pos - half;
      const hi = o.pos + half;
      if (lo - s0 > 0.005) out.push(prism(wallStrip(w, s0, lo), y0, y1, wallColor), ...skinPanels(w, s0, lo, y0, y1));
      if (s1 - hi > 0.005) out.push(prism(wallStrip(w, hi, s1), y0, y1, wallColor), ...skinPanels(w, hi, s1, y0, y1));
      if (o.kind !== 'gap') out.push(slab(wp, 0, 0, 2 * half, 0.02, y0, y1, GLASS, { glass: true }), slab(wp, -half + 0.015, 0, 0.03, 0.06, y0, y1, FRAME), slab(wp, half - 0.015, 0, 0.03, 0.06, y0, y1, FRAME));
    }
  };

  if (tall < 1.3) return out; // low railings: a gap is a gap
  switch (o.kind) {
    case 'gap':
      close(head);
      break;
    case 'door':
    case 'main':
    case 'garden': {
      close(head);
      out.push(...singleDoor(w, o, wp, base, leafTop, width));
      break;
    }
    case 'double': {
      close(head);
      for (const sgn of [-1, 1] as const) out.push(slab(wp, (sgn * width) / 4, 0, width / 2 - 0.05, 0.045, base, leafTop - 0.03, WOOD, { anim: leafAnim(wp, o, sgn, width, base) }));
      out.push(slab(wp, 0, 0, width, t, leafTop - 0.04, leafTop, FRAME));
      break;
    }
    case 'french': {
      close(head);
      for (const sgn of [-1, 1] as const) out.push(...glazed(wp, (sgn * width) / 4, width / 2, base, leafTop - 0.02, 0, { anim: leafAnim(wp, o, sgn, width, base) }));
      break;
    }
    case 'sliding': {
      close(head);
      const slide: Anim = { door: o.id, kind: 'slide', move: [wp.u.x * width * 0.44, 0, wp.u.y * width * 0.44] };
      out.push(...glazed(wp, -width * 0.22, width * 0.56, base, leafTop - 0.02, 0.03, { anim: slide }), ...glazed(wp, width * 0.22, width * 0.56, base, leafTop - 0.02, -0.03));
      break;
    }
    case 'window':
    case 'casement':
    case 'sash':
    case 'picture':
    case 'highwin':
    case 'floorwin':
    case 'bay': {
      const y0 = winY0;
      const y1 = yTop;
      sill(y0);
      close(y1);
      if (o.kind !== 'bay') {
        out.push(...windowGlass(wp, o.kind, width, y0, spring ?? y1, t));
        if (y0 - base > 0.2) out.push(slab(wp, 0, t / 2 + 0.03, width + 0.08, 0.1, y0 - 0.03, y0, '#e5e7eb'));
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

function wallChunk(d: Design, w: Wall, ops: Opening[], elev: number, corners: WallCorners = {}): Part[] {
  const above = elev > 0.01;
  const wy0 = above ? elev - slabThickness(d) : elev;
  // the walls of a basement reach up to the ground (a hair under it, so they do not fight with its top)
  const top = elev < -0.01 ? Math.max(elev + w.height, -0.03) : elev + w.height;
  const color = WALL_COLOR[w.type];
  const out: Part[] = [];
  for (const [a, b] of wallSolidSegments(w, ops)) {
    if (b - a <= 0.005) continue;
    out.push(prism(wallStrip(w, a, b, corners), wy0, top, color), ...skinPanels(w, a, b, wy0, top, corners));
  }
  for (const o of ops) out.push(...openingParts(w, o, elev, top, wy0));
  return out;
}

// ---- stairs (the steps and railings are in stairs3d.ts) ---------------------------------------------------------------------

export { railParts, stairParts } from './stairs3d';
import { railParts, stairParts } from './stairs3d';

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

const FENCE_WOOD = '#5b4a38';

/** The leaf of a gate: a framed board gate (two rails, a brace and pickets) of length `len` from `hinge` along `dir`, carrying the animation that opens it. */
function gateLeaf(hinge: Point, dir: Point, len: number, height: number, elev: number, color: string, anim: Anim): Part[] {
  const out: Part[] = [];
  const ry = yaw(dir);
  const at = (s: number) => ({ x: hinge.x + dir.x * s, z: hinge.y + dir.y * s });
  const bar = (s0: number, s1: number, y0: number, y1: number, thick: number, col: string): Part => {
    const m = at((s0 + s1) / 2);
    return { t: 'box', x: m.x, y: (y0 + y1) / 2, z: m.z, sx: s1 - s0, sy: y1 - y0, sz: thick, ry, color: col, anim };
  };
  out.push(bar(0, len, elev + 0.12, elev + 0.2, 0.05, color), bar(0, len, elev + height - 0.2, elev + height - 0.12, 0.05, color));
  out.push(bar(0, 0.06, elev + 0.08, elev + height - 0.06, 0.06, shade(color, -0.2)), bar(len - 0.06, len, elev + 0.08, elev + height - 0.06, 0.06, shade(color, -0.2)));
  for (let s = 0.14; s < len - 0.1; s += 0.12) out.push(bar(s - 0.025, s + 0.025, elev + 0.1, elev + height - 0.08, 0.025, color));
  const a = at(0.06);
  const b = at(len - 0.06);
  out.push({ t: 'beam', a: [a.x, elev + 0.18, a.z], b: [b.x, elev + height - 0.18, b.z], w: 0.05, h: 0.045, color: shade(color, -0.3), anim });
  return out;
}

/** The posts and the leaves of a gate (they open when clicked, like a door). */
export function gateParts(s: Pick<Strip, 'kind' | 'points' | 'width'>, g: Gate, elev: number): Part[] {
  const geo = gateGeometry(s, g);
  const height = s.kind === 'hedge' ? 1.3 : 1.1;
  const color = s.kind === 'hedge' ? '#7a6650' : STRIP_STYLES.fence.color;
  const out: Part[] = [];
  for (const p of [geo.a, geo.b]) out.push(box(p.x - 0.07, p.x + 0.07, elev, elev + height + 0.25, p.y - 0.07, p.y + 0.07, FENCE_WOOD), box(p.x - 0.09, p.x + 0.09, elev + height + 0.25, elev + height + 0.29, p.y - 0.09, p.y + 0.09, '#6d5a45'));
  for (const leaf of geo.leaves) {
    const full = Math.hypot(leaf.shut.x - leaf.hinge.x, leaf.shut.y - leaf.hinge.y);
    const dir = { x: (leaf.shut.x - leaf.hinge.x) / (full || 1), y: (leaf.shut.y - leaf.hinge.y) / (full || 1) };
    const len = Math.max(0.2, full - 0.1);
    const start = { x: leaf.hinge.x + dir.x * (g.kind === 'sliding' ? 0 : 0.05), y: leaf.hinge.y + dir.y * (g.kind === 'sliding' ? 0 : 0.05) };
    const anim: Anim =
      g.kind === 'sliding'
        ? { door: g.id, kind: 'slide', move: [leaf.open.x - leaf.shut.x, 0, leaf.open.y - leaf.shut.y] }
        : (() => {
            const od = Math.hypot(leaf.open.x - leaf.hinge.x, leaf.open.y - leaf.hinge.y) || 1;
            return { door: g.id, kind: 'swing' as const, origin: [leaf.hinge.x, elev, leaf.hinge.y] as [number, number, number], angle: swingAngle(dir, { x: (leaf.open.x - leaf.hinge.x) / od, y: (leaf.open.y - leaf.hinge.y) / od }) };
          })();
    out.push(...gateLeaf(start, dir, g.kind === 'sliding' ? full : len, height, elev, color, anim));
  }
  return out;
}

/** A street, footpath, fence or hedge, with the gates in it and what a path is made of. */
function stripParts(s: Strip, elev: number): Part[] {
  const { kind, points: pts, width } = s;
  const color = stripColor(s);
  const out: Part[] = [];
  // roads and paths lie a little above the lawn (3 cm) so that they are not buried in it
  const h = kind === 'road' ? 0.045 : kind === 'path' ? (s.surface === 'gravel' ? 0.055 : s.surface === 'boards' ? 0.08 : 0.06) : kind === 'fence' ? 1.1 : 1.2;
  const solid = kind === 'fence' || kind === 'hedge' ? solidSpans(s) : [pts];
  const stepping = kind === 'path' && s.surface === 'stepping';

  if (!stepping) {
    for (const run of solid) {
      for (let i = 0; i + 1 < run.length; i++) {
        const a = run[i];
        const b = run[i + 1];
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        if (len < 1e-4) continue;
        out.push({ t: 'box', x: (a.x + b.x) / 2, y: elev + h / 2 - 0.01, z: (a.y + b.y) / 2, sx: len, sy: h, sz: width, ry: yaw({ x: b.x - a.x, y: b.y - a.y }), color });
        // dashes in the middle of a street
        if (kind === 'road') {
          const dir = { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
          for (let d = 0.5; d + 1 < len; d += 3) out.push({ t: 'box', x: a.x + dir.x * (d + 0.5), y: elev + h, z: a.y + dir.y * (d + 0.5), sx: 1.5, sy: 0.005, sz: 0.12, ry: yaw(dir), color: '#f5f5f4' });
        }
      }
      // round the joints: a disc for roads and paths, a post for fences, a block for hedges
      for (let i = 0; i < run.length; i++) {
        const p = run[i];
        if (kind === 'road' || kind === 'path') {
          if (i > 0 && i < run.length - 1) out.push(cyl(p.x, p.y, elev - 0.01, elev - 0.01 + h, width / 2, color));
        } else if (kind === 'fence') out.push(box(p.x - 0.05, p.x + 0.05, elev, elev + 1.2, p.y - 0.05, p.y + 0.05, FENCE_WOOD));
        else if (i > 0 && i < run.length - 1) out.push(box(p.x - width / 2, p.x + width / 2, elev, elev + h - 0.01, p.y - width / 2, p.y + width / 2, color));
      }
      if (kind === 'fence') {
        // posts every 2 m along the fence
        for (let i = 0; i + 1 < run.length; i++) {
          const a = run[i];
          const b = run[i + 1];
          const len = Math.hypot(b.x - a.x, b.y - a.y);
          for (let d = 2; d < len - 0.3; d += 2) out.push(box(a.x + ((b.x - a.x) * d) / len - 0.05, a.x + ((b.x - a.x) * d) / len + 0.05, elev, elev + 1.2, a.y + ((b.y - a.y) * d) / len - 0.05, a.y + ((b.y - a.y) * d) / len + 0.05, FENCE_WOOD));
        }
      }
    }
  }
  if (kind === 'fence' || kind === 'hedge') for (const { gate } of gateSpans(s)) out.push(...gateParts(s, gate, elev));
  if (kind === 'path') {
    const line = shade(color, -0.25);
    for (const m of pathMarks(s)) {
      if (m.t === 'stone') {
        // stepping stones are flat blocks; the pebbles of a gravel path are too small to show
        if (stepping) out.push({ ...cyl(m.x, m.y, elev, elev + 0.05, m.rx, color, undefined, { rz: m.ry }), ry: -rad(m.rot) } as Part);
      } else {
        for (let i = 0; i + 1 < m.pts.length; i++) {
          const a = m.pts[i];
          const b = m.pts[i + 1];
          const len = Math.hypot(b.x - a.x, b.y - a.y);
          if (len < 1e-4) continue;
          out.push({ t: 'box', x: (a.x + b.x) / 2, y: elev + h - 0.007, z: (a.y + b.y) / 2, sx: len, sy: 0.004, sz: 0.012, ry: yaw({ x: b.x - a.x, y: b.y - a.y }), color: line });
        }
      }
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

/**
 * The wall that a gable end of a roof stands on (the one of the roof's floor lying along that end), and which of its faces looks
 * outwards ('l' or 'r'). A painted wall paints the triangle above it too.
 */
function gableWall(d: Design, r: Roof, sx: number): { wall: Wall; outer: 'l' | 'r' } | null {
  const c = Math.cos(rad(r.rotation));
  const s = Math.sin(rad(r.rotation));
  const out = { x: sx * c, y: sx * s }; // the way the end faces on the plan
  const mid = { x: r.x + out.x * (r.w / 2), y: r.y + out.y * (r.w / 2) };
  let best: { wall: Wall; outer: 'l' | 'r'; dist: number } | null = null;
  for (const w of d.walls) {
    if (w.floor !== r.floor || w.type === 'railing' || wallArc(w)) continue;
    const wp = wallPointAt(w, 0);
    // roughly parallel to the end, and close to it
    if (Math.abs(wp.u.x * out.x + wp.u.y * out.y) > 0.2) continue;
    const dist = Math.abs((mid.x - w.a.x) * out.x + (mid.y - w.a.y) * out.y);
    // the wall also has to reach the middle of the end sideways
    const along = (mid.x - w.a.x) * wp.u.x + (mid.y - w.a.y) * wp.u.y;
    if (along < -w.thickness || along > wallLength(w) + w.thickness || dist > Math.max(0.6, w.thickness * 1.5)) continue;
    if (!best || dist < best.dist) best = { wall: w, outer: wp.n.x * out.x + wp.n.y * out.y > 0 ? 'r' : 'l', dist };
  }
  return best && { wall: best.wall, outer: best.outer };
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
      const pts = f.pts.map((p) => [p[0], p[1] > 0.01 ? p[1] - r.thickness : p[1], p[2]] as [number, number, number]);
      const under = gableWall(d, r, sx);
      const skin = (side: 'l' | 'r') => under?.wall.paint?.[side];
      const outer = skin(under?.outer ?? 'r');
      const inner = skin(under?.outer === 'l' ? 'r' : 'l');
      const thick = under?.wall.thickness ?? 0.2;
      const tex = (k: NonNullable<typeof outer>) => (k.finish === 'paint' ? undefined : { kind: `wall-${k.finish}`, color: k.color });
      out.push({ t: 'panel', pts, thick, facing: [sx, 0, 0], color: outer?.color ?? WALL_COLOR.exterior, ...(outer && tex(outer) ? { tex: tex(outer) } : {}) });
      // the face of the gable seen from the attic
      if (inner) out.push({ t: 'panel', pts: pts.map((p) => [p[0] - sx * thick, p[1], p[2]] as [number, number, number]), thick: 0.004, facing: [-sx, 0, 0], color: inner.color, ...(tex(inner) ? { tex: tex(inner) } : {}) });
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

  const floorWalls = new Map<string, Wall[]>();
  for (const w of d.walls) (floorWalls.get(w.floor) ?? floorWalls.set(w.floor, []).get(w.floor)!).push(w);
  const wallsOf = (floor: string) => floorWalls.get(floor) ?? [];
  for (const w of d.walls) {
    if (!visible.has(w.floor) || !shown('structure')) continue;
    const e = elev.get(w.floor) ?? 0;
    const ops = opsByWall.get(w.id) ?? [];
    const corners = wallCorners(w, wallsOf(w.floor));
    // the corners are part of what the chunk looks like (a neighbor that moves changes them)
    out.push({ key: `wall:${w.id}`, deps: [w, e, slab, JSON.stringify(corners), ...ops], make: () => wallChunk(d, w, ops, e, corners) });
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
    out.push({ key: `strip:${s.id}`, deps: [s, e], make: () => stripParts(s, e) });
  }
  for (const s of d.stairs) {
    if (!visible.has(s.floor) || !shown('structure')) continue;
    const e = elev.get(s.floor) ?? 0;
    const at = d.floors.findIndex((f) => f.id === s.floor);
    const hasAbove = at < d.floors.length - 1;
    // the stairs that start on the floor above: the guard rail leaves their way in free
    const stairsAbove = hasAbove ? d.stairs.filter((o) => o.floor === d.floors[at + 1].id) : [];
    out.push({ key: `stair:${s.id}`, deps: [s, e, hasAbove, ...stairsAbove], make: () => place([...stairParts(s), ...railParts(s, false), ...(hasAbove ? railParts(s, true, guardAvoid(d, s)) : [])], s.x, s.y, rad(s.rotation), e) });
  }
  for (const r of d.roofs) {
    // a cut-away takes off the roof of the floor you are on, and everything above it
    const index = d.floors.findIndex((f) => f.id === r.floor);
    // looking into an attic, its ceiling is the roof of the floor below: that comes off as well
    const intoAttic = activeIndex > 0 && !!d.floors[activeIndex].attic && index === activeIndex - 1;
    if (!visible.has(r.floor) || !shown('roofs') || opts.showRoof === false || (activeIndex >= 0 && (index >= activeIndex || intoAttic))) continue;
    const e = elev.get(r.floor) ?? 0;
    const base = roofBaseHeight(d, r.floor);
    out.push({ key: `roof:${r.id}`, deps: [r, e, base, ...skylightsOn(d, r), ...[0, 1].map((sx) => gableWall(d, r, sx ? 1 : -1)?.wall)], make: () => roofParts(d, r, e) });
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
