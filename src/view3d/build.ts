/**
 * The design as a 3D scene: a list of "chunks" (one per wall, room, piece of furniture, ...), each of which makes its parts only
 * when asked. The viewer asks for a chunk again only when something in its `deps` changed (immer keeps untouched items
 * identical), so dragging a sofa rebuilds one sofa, not the house.
 */
import { CUSTOM_PREFIX, catalogLayer, furnitureHeight } from '../catalog';
import { contentBounds } from '../bounds';
import { wallArc, wallLength, wallPointAt, wallSolidSegments, type WallPoint } from '../geometry';
import type { Design, Furniture, Opening, OpeningKind, Point, Roof, Stair, Wall, WallType, Zone } from '../model';
import { STRIP_STYLES } from '../outdoor';
import { faceNormal, roofBaseHeight, roofModel } from '../roofs';
import { groundIndex } from '../shadows';
import { box, cyl, place, prism, type Look, type Part } from './parts';
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

const WALL_COLOR: Record<WallType, string> = { exterior: '#f3efe7', interior: '#ece8e0', load: '#e2ded6', partition: '#f4f1ea', railing: '#8a6f55' };
const FRAME = '#f8fafc';
const GLASS = '#bfe3f5';
const WOOD = '#b08968';

/** Heights of the top of each opening above the floor, in meters. */
export const OPENING_HEAD: Record<OpeningKind, number> = { door: 2.05, double: 2.1, french: 2.15, sliding: 2.15, garage: 2.2, gap: 2.1, window: 2.1, bay: 2.1 };
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

/** A glass pane in a white frame. */
function glazed(wp: WallPoint, off: number, width: number, y0: number, y1: number, noff = 0): Part[] {
  const t = 0.06;
  return [
    slab(wp, off, noff, width - 0.04, 0.02, y0 + 0.03, y1 - 0.03, GLASS, { glass: true }),
    slab(wp, off, noff, width, t, y0, y0 + 0.05, FRAME),
    slab(wp, off, noff, width, t, y1 - 0.05, y1, FRAME),
    slab(wp, off - width / 2 + 0.025, noff, 0.05, t, y0, y1, FRAME),
    slab(wp, off + width / 2 - 0.025, noff, 0.05, t, y0, y1, FRAME),
  ];
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
  const lintel = (y0: number) => y0 < top - 0.005 && out.push(prism(wallStrip(w, s0, s1), y0, top, wallColor));
  const sill = (y1: number) => y1 > wy0 + 0.005 && out.push(prism(wallStrip(w, s0, s1), wy0, y1, wallColor));
  const t = w.thickness;

  if (tall < 1.3) return out; // low railings: a gap is a gap
  switch (o.kind) {
    case 'gap':
      lintel(head);
      break;
    case 'door': {
      lintel(head);
      out.push(slab(wp, 0, 0, width - 0.06, 0.045, base, head - 0.03, WOOD));
      out.push(slab(wp, o.hinge === 'a' ? width / 2 - 0.12 : -width / 2 + 0.12, 0, 0.1, t + 0.06, base + 1.0, base + 1.04, '#9ca3af'));
      out.push(slab(wp, 0, 0, width, t, head - 0.04, head, FRAME), slab(wp, -width / 2 + 0.02, 0, 0.04, t, base, head, FRAME), slab(wp, width / 2 - 0.02, 0, 0.04, t, base, head, FRAME));
      break;
    }
    case 'double': {
      lintel(head);
      for (const sgn of [-1, 1]) out.push(slab(wp, (sgn * width) / 4, 0, width / 2 - 0.05, 0.045, base, head - 0.03, WOOD));
      out.push(slab(wp, 0, 0, width, t, head - 0.04, head, FRAME));
      break;
    }
    case 'french': {
      lintel(head);
      for (const sgn of [-1, 1]) out.push(...glazed(wp, (sgn * width) / 4, width / 2, base, head - 0.02));
      break;
    }
    case 'sliding': {
      lintel(head);
      out.push(...glazed(wp, -width * 0.22, width * 0.56, base, head - 0.02, 0.03), ...glazed(wp, width * 0.22, width * 0.56, base, head - 0.02, -0.03));
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
      out.push(slab(wp, 0, 0, width - 0.04, 0.05, base, head - 0.02, '#e7e5e4'));
      for (let y = base + 0.4; y < head - 0.1; y += 0.4) out.push(slab(wp, 0, 0, width - 0.04, 0.056, y, y + 0.014, '#a8a29e'));
      break;
    }
  }
  return out;
}

function wallChunk(d: Design, w: Wall, ops: Opening[], elev: number): Part[] {
  const above = elev > 0.01;
  const wy0 = above ? elev - slabThickness(d) : elev;
  const top = elev + w.height;
  const color = WALL_COLOR[w.type];
  const out: Part[] = [];
  for (const [a, b] of wallSolidSegments(w, ops)) if (b - a > 0.005) out.push(prism(wallStrip(w, a, b), wy0, top, color));
  for (const o of ops) out.push(...openingParts(w, o, elev, top, wy0));
  return out;
}

// ---- stairs ------------------------------------------------------------------------------------------------------------

/** A staircase around its own center, climbing towards -z when unrotated (the same orientation as the plan symbol). */
export function stairParts(s: Pick<Stair, 'kind' | 'w' | 'd' | 'steps' | 'rise' | 'flip'>): Part[] {
  const { kind, w, d, rise } = s;
  const n = Math.max(2, s.steps);
  const color = '#e5e7eb';
  const out: Part[] = [];
  const mirror = (x0: number, x1: number): [number, number] => (s.flip && (kind === 'l' || kind === 'u') ? [w - x1, w - x0] : [x0, x1]);
  const blk = (x0: number, x1: number, z0: number, z1: number, level: number) => {
    const [a, b] = mirror(x0, x1);
    out.push(box(a - w / 2, b - w / 2, 0, (rise * level) / n, z0 - d / 2, z1 - d / 2, color));
  };

  if (kind === 'straight') {
    for (let i = 0; i < n; i++) blk(0, w, d - ((i + 1) * d) / n, d - (i * d) / n, i + 1);
  } else if (kind === 'spiral') {
    const r = Math.min(w, d) / 2;
    const pole = Math.min(0.12, r * 0.2);
    for (let i = 0; i < n; i++) {
      const pts: Point[] = [];
      const a0 = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      const a1 = a0 + (2 * Math.PI) / n;
      for (let k = 0; k <= 4; k++) pts.push({ x: Math.cos(a0 + ((a1 - a0) * k) / 4) * r, y: Math.sin(a0 + ((a1 - a0) * k) / 4) * r });
      for (let k = 4; k >= 0; k--) pts.push({ x: Math.cos(a0 + ((a1 - a0) * k) / 4) * pole, y: Math.sin(a0 + ((a1 - a0) * k) / 4) * pole });
      const top = (rise * (i + 1)) / n;
      out.push(prism(pts, top - 0.06, top, color));
    }
    out.push(cyl(0, 0, 0, rise + 0.9, pole, '#9ca3af'));
  } else if (kind === 'l') {
    const f = Math.min(w, d) / 2;
    const legA = d - f;
    const legB = w - f;
    const nA = Math.max(1, Math.round(((n - 1) * legA) / (legA + legB)));
    const nB = Math.max(1, n - 1 - nA);
    for (let i = 0; i < nA; i++) blk(0, f, d - ((i + 1) * legA) / nA, d - (i * legA) / nA, i + 1);
    blk(0, f, 0, f, nA + 1);
    for (let j = 0; j < nB; j++) blk(f + (j * legB) / nB, f + ((j + 1) * legB) / nB, 0, f, nA + 2 + j);
  } else {
    const f = Math.min((w - 0.1) / 2, d / 2);
    const up = Math.max(1, Math.floor((n - 1) / 2));
    const down = Math.max(1, n - 1 - up);
    const run = d - f;
    for (let i = 0; i < up; i++) blk(0, f, d - ((i + 1) * run) / up, d - (i * run) / up, i + 1);
    blk(0, w, 0, f, up + 1);
    for (let j = 0; j < down; j++) blk(w - f, w, f + (j * run) / down, f + ((j + 1) * run) / down, up + 2 + j);
  }
  return out;
}

// ---- outdoors ----------------------------------------------------------------------------------------------------------

const ZONE_HEIGHT: Record<Zone['kind'], number> = { lawn: 0.03, terrace: 0.06, driveway: 0.04, flowerbed: 0.08, water: 0.0, plot: 0 };

function zoneParts(z: Zone, elev: number): Part[] {
  if (z.kind === 'plot') {
    // the plot boundary: a thin line around the site
    return z.points.map((a, i) => {
      const b = z.points[(i + 1) % z.points.length];
      return { t: 'box', x: (a.x + b.x) / 2, y: elev + 0.02, z: (a.y + b.y) / 2, sx: Math.hypot(b.x - a.x, b.y - a.y), sy: 0.03, sz: 0.1, ry: yaw({ x: b.x - a.x, y: b.y - a.y }), color: '#8c9a7b' } as Part;
    });
  }
  if (z.kind === 'water') return [prism(z.points, elev - 0.02, elev + 0.025, z.color, undefined, { glass: true })];
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

/** A roof as panels and blocks in its own box, then moved onto the walls it covers. */
export function roofParts(d: Design, r: Roof, elev: number): Part[] {
  const m = roofModel(r);
  const out: Part[] = [];
  const up: [number, number, number] = [0, 1, 0];
  for (const f of m.faces) {
    if (f.kind === 'slope') out.push({ t: 'panel', pts: f.pts, thick: r.thickness, facing: up, color: r.color, tex: { kind: r.material, color: r.color } });
    else {
      const sx = Math.sign(f.pts[0][0]) || 1;
      // a little lower than the roof, so the top edge of the wall hides under the roof instead of fighting with it
      out.push({ t: 'panel', pts: f.pts.map((p) => [p[0], p[1] > 0.01 ? p[1] - r.thickness : p[1], p[2]] as [number, number, number]), thick: 0.2, facing: [sx, 0, 0], color: WALL_COLOR.exterior });
    }
  }
  for (const b of m.blocks) out.push(box(b.x0, b.x1, b.y0, b.y1, b.z0, b.z1, b.kind === 'chimney' ? BRICK : b.kind === 'cap' ? '#6b7280' : WALL_COLOR.exterior));
  void faceNormal;
  return place(out, r.x, r.y, rad(r.rotation), elev + roofBaseHeight(d, r.floor));
}

// ---- the whole scene -------------------------------------------------------------------------------------------------------

export function sceneChunks(d: Design, opts: BuildOptions = {}): ChunkSpec[] {
  const elev = floorElevations(d);
  const hiddenFrom = opts.hideAbove ? d.floors.findIndex((f) => f.id === opts.hideAbove) : -1;
  const visible = new Set(d.floors.filter((_, i) => hiddenFrom < 0 || i <= hiddenFrom).map((f) => f.id));
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
    out.push({ key: `room:${r.id}`, deps: [r, e, thick], make: () => [prism(r.points, e - thick, e + 0.01, r.color, r.material !== 'plain' ? { kind: r.material, color: r.color } : undefined)] });
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
    out.push({ key: `stair:${s.id}`, deps: [s, e], make: () => place(stairParts(s), s.x, s.y, rad(s.rotation), e) });
  }
  for (const r of d.roofs) {
    // a cut-away takes off the roof of the floor you are on, and everything above it
    const index = d.floors.findIndex((f) => f.id === r.floor);
    if (!visible.has(r.floor) || !shown('roofs') || opts.showRoof === false || (activeIndex >= 0 && index >= activeIndex)) continue;
    const e = elev.get(r.floor) ?? 0;
    const base = roofBaseHeight(d, r.floor);
    out.push({ key: `roof:${r.id}`, deps: [r, e, base], make: () => roofParts(d, r, e) });
  }
  for (const f of d.furniture) {
    if (!visible.has(f.floor) || !shown(catalogLayer(f.type))) continue;
    const e = elev.get(f.floor) ?? 0;
    const deps: unknown[] = [f, e, d.settings.storeyHeight];
    if (SITS_ON_FURNITURE.has(f.type)) deps.push(d.furniture);
    if (f.type.startsWith(CUSTOM_PREFIX)) deps.push(d.custom);
    out.push({ key: `fur:${f.id}`, deps, make: () => furnitureChunk(d, f, e) });
  }

  // the ground: a big lawn-colored slab, unless there is a basement (which would be hidden under it)
  const b = contentBounds(d);
  if (b && ![...elev.values()].some((v) => v < -0.01)) {
    const size = Math.max(600, Math.max(b.maxX - b.minX, b.maxY - b.minY) * 4 + 300);
    const cx = (b.minX + b.maxX) / 2;
    const cz = (b.minY + b.maxY) / 2;
    out.push({ key: 'ground', deps: [cx, cz, size], make: () => [box(cx - size / 2, cx + size / 2, -0.1, -0.02, cz - size / 2, cz + size / 2, '#d4e2c6')] });
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
