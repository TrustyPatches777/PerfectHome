/**
 * Elevations and sections: the house drawn from the side, or cut open along a line, as a vector drawing that prints at a true scale.
 *
 * The drawing is made from the same parts as the 3D view (`sceneChunks`), so whatever the 3D view shows, with the same windows, roofs and
 * heights, is in the drawing and nothing has to be kept in step. Each part becomes a convex solid (a box, a ring of corners joined by flat
 * faces, a flat outline stood up as a wall); the faces that look at the viewer are projected onto the picture plane and painted far to near.
 * A section first removes everything in front of the cutting plane, and draws what the plane passes through as hatched "cut" shapes on top.
 *
 * Two steps: `prepareDrawing` does the geometry once, `renderDrawing` makes the SVG for a scale (line weights and text are fixed in
 * millimeters on the paper, so they depend on the scale; the shapes do not).
 */
import { groundAt } from './terrain';
import { pointInPolygon, sectionDirection } from './geometry';
import type { Design, Point, SectionLine } from './model';
import { floorElevations, sceneChunks, slabThickness } from './view3d/build';
import type { Part } from './view3d/parts';
import { compassPoint } from './sun';
import { localize, t } from './i18n';

type V3 = [number, number, number];
type P2 = [number, number];

export type Side = 'N' | 'E' | 'S' | 'W';
export { sectionDirection };
export const SIDE_NAME: Record<Side, string> = { N: 'North', E: 'East', S: 'South', W: 'West' };
localize(SIDE_NAME, '*');

export interface DrawingSpec {
  /** An elevation (the house seen from one side) or a section along a line. */
  kind: 'elevation' | 'section';
  side?: Side;
  line?: SectionLine;
  /** Draw furniture, trees and the like (the house itself is always drawn). */
  furniture: boolean;
  /** Fill with the colors of the parts instead of a line drawing. */
  colour: boolean;
}

export const DEFAULT_DRAWING: Pick<DrawingSpec, 'furniture' | 'colour'> = { furniture: true, colour: false };

/** The direction you look in (a unit vector on the plan) for an elevation of a side, given where north lies on the plan. */
export function elevationDirection(side: Side, north: number): Point {
  const a = (north * Math.PI) / 180;
  const n = { x: Math.sin(a), y: -Math.cos(a) }; // north on the plan
  const e = { x: Math.cos(a), y: Math.sin(a) }; // east on the plan
  // you stand on the named side and look at the house
  return { S: n, N: { x: -n.x, y: -n.y }, W: e, E: { x: -e.x, y: -e.y } }[side];
}

/** The title of a drawing: "South elevation" or "Section A–A". */
export function drawingTitle(spec: Pick<DrawingSpec, 'kind' | 'side' | 'line'>): string {
  if (spec.kind === 'section') return t('Section {value}–{value}', { value: spec.line?.name ?? 'A' });
  return t('{value} elevation', { value: SIDE_NAME[spec.side ?? 'S'] });
}

// ---- solids ------------------------------------------------------------------------------------------------------------------

interface Solid {
  faces: V3[][];
  color: string;
  glass: boolean;
  /** Furniture and the like: drawn with finer lines. */
  fine: boolean;
  /** A wall, slab or other upright outline: cut exactly along the line. */
  prism?: { pts: Point[]; holes: Point[][]; y0: number; y1: number };
  centre: V3;
}

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** The normal of a polygon (its length is twice the area). */
function newell(p: V3[]): V3 {
  let x = 0, y = 0, z = 0;
  for (let i = 0; i < p.length; i++) {
    const a = p[i];
    const b = p[(i + 1) % p.length];
    x += (a[1] - b[1]) * (a[2] + b[2]);
    y += (a[2] - b[2]) * (a[0] + b[0]);
    z += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return [x, y, z];
}

const centroid = (pts: V3[]): V3 => {
  const n = pts.length || 1;
  return [pts.reduce((s, p) => s + p[0], 0) / n, pts.reduce((s, p) => s + p[1], 0) / n, pts.reduce((s, p) => s + p[2], 0) / n];
};

/** Turn every face of a convex solid so that it looks outwards, and drop the ones with no area. */
function outward(faces: V3[][], inside: V3): V3[][] {
  const out: V3[][] = [];
  for (const f of faces) {
    const n = newell(f);
    if (Math.hypot(n[0], n[1], n[2]) < 1e-9) continue;
    out.push(dot(n, sub(centroid(f), inside)) < 0 ? [...f].reverse() : f);
  }
  return out;
}

/** The faces of a body whose two ends are rings of corners (a box seen as four corners at each end, a cylinder, a thick flat panel). */
function ringFaces(a: V3[], b: V3[]): V3[][] {
  const faces: V3[][] = [a, b];
  for (let i = 0; i < a.length; i++) {
    const j = (i + 1) % a.length;
    faces.push([a[i], a[j], b[j], b[i]]);
  }
  return faces;
}

/** Turn local coordinates (x across, y up, z deep) about the vertical axis the way the 3D view does (Three.js: positive turns x towards -z), then move them. */
const turned = (ry: number, c: V3, rz = 0) => {
  const cy = Math.cos(ry), sy = Math.sin(ry), cz = Math.cos(rz), sz = Math.sin(rz);
  return (p: V3): V3 => {
    const x1 = p[0] * cz - p[1] * sz;
    const y1 = p[0] * sz + p[1] * cz;
    return [c[0] + x1 * cy + p[2] * sy, c[1] + y1, c[2] - x1 * sy + p[2] * cy];
  };
};

const BOX_FACES = [[0, 2, 6, 4], [1, 3, 7, 5], [0, 1, 5, 4], [2, 3, 7, 6], [0, 1, 3, 2], [4, 5, 7, 6]];

function solidOf(p: Part, fine: boolean): Solid | null {
  const look = { color: p.color, glass: !!p.glass, fine };
  const make = (faces: V3[][], centre: V3): Solid | null => {
    const f = outward(faces, centre);
    return f.length ? { faces: f, centre, ...look } : null;
  };
  switch (p.t) {
    case 'box': {
      const c: V3 = [p.x, p.y, p.z];
      const at = turned(p.ry, c, p.rz ?? 0);
      const k = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => at([(i & 1 ? 0.5 : -0.5) * p.sx, (i & 2 ? 0.5 : -0.5) * p.sy, (i & 4 ? 0.5 : -0.5) * p.sz]));
      return make(BOX_FACES.map((f) => f.map((i) => k[i])), c);
    }
    case 'cyl': {
      const n = Math.max(p.r, p.rz ?? 0) > 0.4 ? 16 : 10;
      const c: V3 = [p.x, p.y, p.z];
      const at = turned(p.ry, c);
      const ax = p.ax ?? 'y';
      const rt = p.rt ?? p.r;
      const ring = (along: number, r: number, rz: number): V3[] =>
        Array.from({ length: n }, (_, i) => {
          const t = (i / n) * Math.PI * 2;
          const a = Math.cos(t) * r, b = Math.sin(t) * rz;
          return at(ax === 'y' ? [a, along, b] : ax === 'x' ? [along, a, b] : [a, b, along]);
        });
      const rzBottom = p.rz ?? p.r;
      return make(ringFaces(ring(-p.h / 2, p.r, rzBottom), ring(p.h / 2, rt, rzBottom * (rt / (p.r || 1)))), c);
    }
    case 'ring': {
      const r = p.R + p.tube;
      return solidOf({ t: 'cyl', x: p.x, y: p.y, z: p.z, r, h: p.tube * 2, ax: p.ax ?? 'z', ry: p.ry, color: p.color }, fine);
    }
    case 'ball': {
      const n = 10;
      const c: V3 = [p.x, p.y, p.z];
      const at = turned(p.ry, c);
      const lats = [-90, -60, -30, 0, 30, 60, 90].map((d) => (d * Math.PI) / 180);
      const rings = lats.map((la) => Array.from({ length: n }, (_, i) => {
        const t = (i / n) * Math.PI * 2;
        return at([Math.cos(la) * Math.cos(t) * p.sx, Math.sin(la) * p.sy, Math.cos(la) * Math.sin(t) * p.sz]);
      }));
      const faces: V3[][] = [];
      for (let r = 0; r < rings.length - 1; r++) for (let i = 0; i < n; i++) faces.push([rings[r][i], rings[r][(i + 1) % n], rings[r + 1][(i + 1) % n], rings[r + 1][i]]);
      return make(faces, c);
    }
    case 'beam': {
      const d = sub(p.b, p.a);
      const len = Math.hypot(d[0], d[2]);
      // across the bar, level; for an upright post any direction will do
      const s: V3 = len < 1e-6 ? [1, 0, 0] : [d[2] / len, 0, -d[0] / len];
      const end = (q: V3): V3[] => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [q[0] + s[0] * (a * p.w) / 2, q[1] + (b * p.h) / 2, q[2] + s[2] * (a * p.w) / 2] as V3);
      return make(ringFaces(end(p.a), end(p.b)), centroid([p.a, p.b]));
    }
    case 'panel': {
      const f = Math.hypot(...p.facing) || 1;
      const back = p.pts.map((q): V3 => [q[0] - (p.facing[0] / f) * p.thick, q[1] - (p.facing[1] / f) * p.thick, q[2] - (p.facing[2] / f) * p.thick]);
      return make(ringFaces(p.pts, back), centroid([...p.pts, ...back]));
    }
    case 'prism': {
      if (p.pts.length < 3 || p.y1 - p.y0 < 1e-4) return null;
      const faces: V3[][] = [];
      const edges = (ring: Point[], sign: number) => {
        let area = 0;
        for (let i = 0; i < ring.length; i++) area += ring[i].x * ring[(i + 1) % ring.length].y - ring[(i + 1) % ring.length].x * ring[i].y;
        // a ring that runs the other way round has its faces looking the other way; a hole looks into the hole
        const flip = area * sign < 0;
        for (let i = 0; i < ring.length; i++) {
          const a = ring[i];
          const b = ring[(i + 1) % ring.length];
          const quad: V3[] = [[a.x, p.y0, a.y], [b.x, p.y0, b.y], [b.x, p.y1, b.y], [a.x, p.y1, a.y]];
          // as drawn this looks to (dz, -dx) when the ring runs counter-clockwise on the screen (area > 0 in x/z)
          faces.push(flip ? quad : [...quad].reverse());
        }
      };
      edges(p.pts, 1);
      for (const h of p.holes ?? []) if (h.length >= 3) edges(h, -1);
      return { faces, centre: [0, 0, 0], prism: { pts: p.pts, holes: p.holes ?? [], y0: p.y0, y1: p.y1 }, ...look };
    }
    default:
      return null;
  }
}

// ---- projection -----------------------------------------------------------------------------------------------------------

interface Frame {
  /** The viewing direction on the plan (x, z). */
  vx: number;
  vz: number;
  /** "Right" in the picture (x, z). */
  rx: number;
  rz: number;
  /** Depth of the cutting plane; everything nearer than this is removed. Null for an elevation. */
  cut: number | null;
}

const depthOf = (f: Frame, p: V3) => p[0] * f.vx + p[2] * f.vz;
const uOf = (f: Frame, x: number, z: number) => x * f.rx + z * f.rz;

/** The part of a polygon on the far side of the cutting plane. */
function clipFar(poly: V3[], f: Frame): V3[] {
  if (f.cut === null) return poly;
  const c = f.cut;
  const out: V3[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const da = depthOf(f, a) - c;
    const db = depthOf(f, b) - c;
    if (da >= 0) out.push(a);
    if ((da >= 0) !== (db >= 0)) {
      const t = da / (da - db);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
    }
  }
  return out.length >= 3 ? out : [];
}

function hull(points: P2[]): P2[] {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]).filter((p, i, all) => i === 0 || Math.abs(p[0] - all[i - 1][0]) > 1e-7 || Math.abs(p[1] - all[i - 1][1]) > 1e-7);
  if (pts.length < 3) return [];
  const cross = (o: P2, a: P2, b: P2) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: P2[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 1e-9) lower.pop();
    lower.push(p);
  }
  const upper: P2[] = [];
  for (const p of [...pts].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 1e-9) upper.pop();
    upper.push(p);
  }
  const h = [...lower.slice(0, -1), ...upper.slice(0, -1)];
  return h.length >= 3 ? h : [];
}

/** Where the cutting plane passes through a solid, as shapes in the picture (u across, height up). */
function cutShapes(s: Solid, f: Frame): P2[][] {
  if (f.cut === null) return [];
  const c = f.cut;
  if (s.prism) {
    const { pts, holes, y0, y1 } = s.prism;
    const us: number[] = [];
    for (const ring of [pts, ...holes]) {
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i];
        const b = ring[(i + 1) % ring.length];
        const da = a.x * f.vx + a.y * f.vz - c;
        const db = b.x * f.vx + b.y * f.vz - c;
        if (da < 0 === db < 0) continue;
        const t = da / (da - db);
        us.push(uOf(f, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t));
      }
    }
    us.sort((a, b) => a - b);
    const out: P2[][] = [];
    for (let i = 0; i + 1 < us.length; i += 2) if (us[i + 1] - us[i] > 1e-4) out.push([[us[i], y0], [us[i + 1], y0], [us[i + 1], y1], [us[i], y1]]);
    return out;
  }
  const pts: P2[] = [];
  for (const face of s.faces) {
    for (let i = 0; i < face.length; i++) {
      const a = face[i];
      const b = face[(i + 1) % face.length];
      const da = depthOf(f, a) - c;
      const db = depthOf(f, b) - c;
      if (Math.abs(da) < 1e-9) pts.push([uOf(f, a[0], a[2]), a[1]]);
      else if (da * db < 0) {
        const t = da / (da - db);
        pts.push([uOf(f, a[0] + (b[0] - a[0]) * t, a[2] + (b[2] - a[2]) * t), a[1] + (b[1] - a[1]) * t]);
      }
    }
  }
  const h = hull(pts);
  return h.length ? [h] : [];
}

// ---- the drawing ----------------------------------------------------------------------------------------------------------------

interface Shape {
  pts: P2[];
  depth: number;
  /** 0..1, how much light the face gets. */
  light: number;
  color: string;
  glass: boolean;
  fine: boolean;
}

interface Cap {
  pts: P2[];
  color: string;
  fine: boolean;
}

export interface Level {
  name: string;
  /** Height of the floor above the ground outside, in meters. */
  h: number;
}

export interface Prepared {
  spec: DrawingSpec;
  title: string;
  shapes: Shape[];
  caps: Cap[];
  /** The ground cut by a section: a band under the profile of the ground. */
  earth: P2[] | null;
  /** The ground line of an elevation. */
  groundLine: P2[] | null;
  levels: Level[];
  /** Extent of the picture: u across, h up. */
  box: { u0: number; u1: number; h0: number; h1: number };
  /** Highest point. */
  top: number;
}

const COLOR_RE = /^#([0-9a-f]{6}|[0-9a-f]{3})(?![0-9a-f])/i;
export function rgb(hex: string): [number, number, number] {
  const m = COLOR_RE.exec(hex);
  if (!m) return [200, 200, 200];
  const h = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
const hex2 = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
/** A color lit by `k` (1 = as it is, less = darker). */
export const shade = (hex: string, k: number): string => `#${rgb(hex).map((v) => hex2(v * k)).join('')}`;

const LAYERS = /^(wall|room|doorway|zone|strip|stair|roof):/;

/** All the parts the drawing is made of (what the 3D view shows, without the ground, the ceilings, the horizon and the lamps). */
function drawingParts(d: Design, furniture: boolean): { part: Part; fine: boolean }[] {
  const out: { part: Part; fine: boolean }[] = [];
  const open = { showRoof: true, showCeilings: false, hiddenFloors: [] as string[] };
  for (const c of sceneChunks(d, open)) {
    const fur = c.key.startsWith('fur:');
    if (!(LAYERS.test(c.key) || (fur && furniture))) continue;
    for (const part of c.make()) if (part.t !== 'light' && !part.sky) out.push({ part, fine: fur || c.key.startsWith('stair:') });
  }
  return out;
}

export function prepareDrawing(d: Design, spec: DrawingSpec): Prepared | null {
  let dir: Point;
  let o: Point; // a point on the plane
  if (spec.kind === 'section') {
    if (!spec.line) return null;
    dir = sectionDirection(spec.line);
    o = spec.line.a;
  } else {
    dir = elevationDirection(spec.side ?? 'S', d.site.north);
    o = { x: 0, y: 0 };
  }
  const f: Frame = { vx: dir.x, vz: dir.y, rx: -dir.y, rz: dir.x, cut: spec.kind === 'section' ? o.x * dir.x + o.y * dir.y : null };
  const sun: V3 = [-dir.x * 0.5 + f.rx * 0.3, 0.8, -dir.y * 0.5 + f.rz * 0.3];
  const sl = Math.hypot(...sun);

  const solids: Solid[] = [];
  for (const { part, fine } of drawingParts(d, spec.furniture)) {
    const s = solidOf(part, fine);
    if (s) solids.push(s);
  }

  const shapes: Shape[] = [];
  const caps: Cap[] = [];
  for (const s of solids) {
    for (const face of s.faces) {
      const n = newell(face);
      const len = Math.hypot(...n);
      if (len < 1e-9) continue;
      const facing = (n[0] * f.vx + n[2] * f.vz) / len;
      if (facing > -0.05) continue; // looks away from you, or edge-on
      const poly = clipFar(face, f);
      if (poly.length < 3) continue;
      const pts = poly.map((p): P2 => [uOf(f, p[0], p[2]), p[1]]);
      // nearest corner first; of two faces that begin at the same depth (the mitre faces inside a wall corner) the one that reaches further back goes first
      let nearest = Infinity, sum = 0;
      for (const q of poly) {
        const dq = depthOf(f, q);
        nearest = Math.min(nearest, dq);
        sum += dq;
      }
      shapes.push({
        pts,
        depth: nearest + (0.001 * sum) / poly.length,
        light: Math.max(0, Math.min(1, (n[0] * sun[0] + n[1] * sun[1] + n[2] * sun[2]) / (len * sl))),
        color: s.color,
        glass: s.glass,
        fine: s.fine,
      });
    }
    if (f.cut !== null && !s.glass) for (const pts of cutShapes(s, f)) caps.push({ pts, color: s.color, fine: s.fine });
  }
  if (!shapes.length && !caps.length) return null;

  // the room the picture takes (loops, not spreads: a furnished house has far more points than a call can take)
  let u0 = Infinity, u1 = -Infinity, top = -Infinity, h0 = 0, near = Infinity;
  for (const pts of [...shapes.map((s) => s.pts), ...caps.map((c) => c.pts)]) {
    for (const q of pts) {
      u0 = Math.min(u0, q[0]);
      u1 = Math.max(u1, q[0]);
      top = Math.max(top, q[1]);
      h0 = Math.min(h0, q[1]);
    }
  }
  for (const sh of shapes) near = Math.min(near, sh.depth);
  if (spec.kind === 'section' && spec.line) {
    // only what lies between the two ends of the line is shown
    const ua = uOf(f, spec.line.a.x, spec.line.a.y);
    const ub = uOf(f, spec.line.b.x, spec.line.b.y);
    u0 = Math.min(ua, ub);
    u1 = Math.max(ua, ub);
  }

  // the ground
  const profile = (depth: number): P2[] => {
    const steps = Math.min(240, Math.max(2, Math.ceil((u1 - u0) / 0.1)));
    const slab = slabThickness(d);
    const elev = floorElevations(d);
    const deep = d.rooms.filter((r) => (elev.get(r.floor) ?? 0) < -0.01);
    const out: P2[] = [];
    for (let i = 0; i <= steps; i++) {
      const u = u0 + ((u1 - u0) * i) / steps;
      // the point of the plane at (u, depth), back on the plan
      const p = { x: u * f.rx + depth * f.vx, y: u * f.rz + depth * f.vz };
      let h = groundAt(d, p).h;
      for (const r of deep) if (pointInPolygon(p, r.points)) h = Math.min(h, (elev.get(r.floor) ?? 0) - slab);
      out.push([u, h]);
    }
    return out;
  };
  let earth: P2[] | null = null;
  let groundLine: P2[] | null = null;
  if (f.cut !== null) earth = profile(f.cut);
  else groundLine = profile(near - 0.001);
  for (const q of earth ?? groundLine ?? []) h0 = Math.min(h0, q[1] - 0.8);
  h0 = Math.min(h0, -0.8);
  if (earth) earth = [...earth, [u1, h0], [u0, h0]];

  const elev = floorElevations(d);
  const levels: Level[] = d.floors.map((fl) => ({ name: t(fl.name), h: elev.get(fl.id) ?? 0 }));

  return {
    spec,
    title: drawingTitle(spec),
    shapes: shapes.sort((a, b) => b.depth - a.depth),
    caps,
    earth,
    groundLine,
    levels,
    box: { u0, u1, h0, h1: top },
    top,
  };
}

// ---- SVG --------------------------------------------------------------------------------------------------------------------

export interface RenderedDrawing {
  svg: string;
  /** Size of the picture in meters of the house at 1:1 (what `scale` divides). */
  width: number;
  height: number;
}

const r3 = (v: number) => Math.round(v * 1000) / 1000;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const pointsAttr = (pts: P2[]) => pts.map((p) => `${r3(p[0])},${r3(-p[1])}`).join(' ');
const fmtLevel = (h: number) => (Math.abs(h) < 0.005 ? '±0.00' : `${h > 0 ? '+' : '−'}${Math.abs(h).toFixed(2)}`);

/** Room around the drawing and the strip for the level labels, in millimeters on the paper. */
export const PAD_MM = { left: 8, right: 30, top: 8, bottom: 14 };

/** The drawing as SVG for a scale (the number after "1:"). One unit of the picture is a meter of the house. */
export function renderDrawing(p: Prepared, scale: number, pixelsPerMeter = 100): RenderedDrawing {
  const k = scale / 1000; // meters of house per millimeter of paper
  const mm = (v: number) => r3(v * k);
  const { u0, u1, h0, h1 } = p.box;
  const x0 = u0 - mm(PAD_MM.left);
  const x1 = u1 + mm(PAD_MM.right);
  const yTop = -h1 - mm(PAD_MM.top);
  const yBot = -h0 + mm(PAD_MM.bottom);
  const width = x1 - x0;
  const height = yBot - yTop;
  const colour = p.spec.colour;
  const main = mm(0.18);
  const fine = mm(0.09);
  const fs = mm(2.6);
  const out: string[] = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(width * pixelsPerMeter)}" height="${Math.round(height * pixelsPerMeter)}" viewBox="${r3(x0)} ${r3(yTop)} ${r3(width)} ${r3(height)}" font-family="system-ui, 'Segoe UI', Arial, sans-serif">`);
  const hatch = mm(1.7);
  const dots = mm(2.6);
  out.push(`<defs>
<pattern id="cut" patternUnits="userSpaceOnUse" width="${hatch}" height="${hatch}" patternTransform="rotate(45)"><rect width="${hatch}" height="${hatch}" fill="#f3f4f6"/><line x1="0" y1="0" x2="0" y2="${hatch}" stroke="#111827" stroke-width="${mm(0.22)}"/></pattern>
<pattern id="earth" patternUnits="userSpaceOnUse" width="${dots}" height="${dots}" patternTransform="rotate(-45)"><rect width="${dots}" height="${dots}" fill="#faf8f3"/><line x1="0" y1="0" x2="0" y2="${dots}" stroke="#9a9186" stroke-width="${mm(0.15)}"/></pattern>
<clipPath id="view"><rect x="${r3(u0)}" y="${r3(-h1 - mm(1))}" width="${r3(u1 - u0)}" height="${r3(h1 - h0 + mm(2))}"/></clipPath>
</defs>`);
  out.push(`<rect x="${r3(x0)}" y="${r3(yTop)}" width="${r3(width)}" height="${r3(height)}" fill="#ffffff"/>`);
  out.push('<g clip-path="url(#view)" stroke-linejoin="round">');
  for (const s of p.shapes) {
    const base = s.glass ? '#bfe3f5' : colour ? shade(s.color, 0.68 + 0.32 * s.light) : '#ffffff';
    const stroke = s.fine ? '#6b7280' : '#111827';
    out.push(`<polygon points="${pointsAttr(s.pts)}" fill="${base}"${s.glass ? ' fill-opacity="0.6"' : ''} stroke="${stroke}" stroke-width="${s.fine ? fine : main}"/>`);
  }
  if (p.groundLine) {
    const line = p.groundLine;
    out.push(`<polygon points="${pointsAttr([...line, [line[line.length - 1][0], h0 - 1], [line[0][0], h0 - 1]])}" fill="url(#earth)" stroke="none"/>`);
    out.push(`<polyline points="${pointsAttr(line)}" fill="none" stroke="#111827" stroke-width="${mm(0.5)}"/>`);
  }
  if (p.earth) {
    out.push(`<polygon points="${pointsAttr(p.earth)}" fill="url(#earth)" stroke="none"/>`);
    out.push(`<polyline points="${pointsAttr(p.earth.slice(0, -2))}" fill="none" stroke="#111827" stroke-width="${mm(0.5)}"/>`);
  }
  for (const c of p.caps) {
    out.push(`<polygon points="${pointsAttr(c.pts)}" fill="${colour ? shade(c.color, 0.62) : 'url(#cut)'}" stroke="#111827" stroke-width="${c.fine ? fine : mm(0.35)}"/>`);
  }
  out.push('</g>');
  // the floor levels
  out.push(`<g stroke="#6b7280" stroke-width="${fine}" stroke-dasharray="${mm(3)} ${mm(1)} ${mm(0.6)} ${mm(1)}" fill="#374151" font-size="${fs}">`);
  for (const lv of p.levels) {
    out.push(`<line x1="${r3(u0 - mm(3))}" y1="${r3(-lv.h)}" x2="${r3(u1 + mm(3))}" y2="${r3(-lv.h)}"/>`);
    out.push(`<text x="${r3(u1 + mm(4))}" y="${r3(-lv.h - mm(0.6))}" stroke="none">${esc(fmtLevel(lv.h))}</text>`);
    out.push(`<text x="${r3(u1 + mm(4))}" y="${r3(-lv.h + mm(2.6))}" stroke="none" fill="#6b7280" font-size="${mm(2.1)}">${esc(lv.name)}</text>`);
  }
  out.push('</g>');
  out.push(`<g fill="#374151" font-size="${fs}"><text x="${r3(u1 + mm(4))}" y="${r3(-h1 + mm(1))}">${esc(fmtLevel(h1))}</text><line x1="${r3(u1 + mm(1))}" y1="${r3(-h1)}" x2="${r3(u1 + mm(3.5))}" y2="${r3(-h1)}" stroke="#374151" stroke-width="${fine}"/></g>`);
  out.push(`<text x="${r3((u0 + u1) / 2)}" y="${r3(-h0 + mm(9))}" text-anchor="middle" font-size="${mm(3.6)}" font-weight="600" fill="#111827">${esc(p.title)}</text>`);
  out.push('</svg>');
  return { svg: out.join('\n'), width, height };
}

/** One call: the drawing of a design for a scale. */
export function buildDrawing(d: Design, spec: DrawingSpec, scale: number): RenderedDrawing | null {
  const p = prepareDrawing(d, spec);
  return p ? renderDrawing(p, scale) : null;
}

/** "From the south" etc. for a section line: which side of the house you look at, from the direction of the view. */
export function lookingAt(d: Design, line: SectionLine): string {
  const v = sectionDirection(line);
  // compass bearing of the view: 0 = looking north
  const a = (d.site.north * Math.PI) / 180;
  const n = { x: Math.sin(a), y: -Math.cos(a) };
  const e = { x: Math.cos(a), y: Math.sin(a) };
  const bearing = ((Math.atan2(v.x * e.x + v.y * e.y, v.x * n.x + v.y * n.y) * 180) / Math.PI + 360) % 360;
  return compassPoint(bearing);
}
