/** Look and defaults of the outdoor features: ground areas (zones) and line features (strips). */
import type { Gate, PathSurface, Point, Strip, StripKind, ZoneKind } from './model';

export const ZONE_STYLES: Record<ZoneKind, { label: string; color: string; swatches: string[] }> = {
  lawn: { label: 'Lawn', color: '#cfe8c4', swatches: ['#cfe8c4', '#b9dba8', '#e0efc8', '#a8cf9a'] },
  terrace: { label: 'Terrace', color: '#e4dccb', swatches: ['#e4dccb', '#d9cdb5', '#cfc6bb', '#e9e4da'] },
  driveway: { label: 'Driveway', color: '#d4d6da', swatches: ['#d4d6da', '#c3c6cc', '#e1ddd3', '#b7bcc4'] },
  flowerbed: { label: 'Flower bed', color: '#e2c9ae', swatches: ['#e2c9ae', '#d9b99a', '#f0c9d4', '#d6c2e6'] },
  water: { label: 'Pond / pool', color: '#bfe0f5', swatches: ['#bfe0f5', '#a8d4ee', '#cfeaf0'] },
  plot: { label: 'Plot boundary', color: '#f4f1e6', swatches: ['#f4f1e6', '#ffffff', '#ecf2e4'] },
};

export const STRIP_STYLES: Record<StripKind, { label: string; color: string }> = {
  road: { label: 'Street', color: '#a3a9b3' },
  path: { label: 'Footpath', color: '#e6dcc3' },
  fence: { label: 'Fence', color: '#7a6650' },
  hedge: { label: 'Hedge', color: '#6aa96a' },
};

/** Draw order of outdoor areas: the plot boundary is the ground of everything else, so it goes first (at the back) however it was drawn. */
export const plotFirst = <T extends { kind: string }>(zones: readonly T[]): T[] => [...zones.filter((z) => z.kind === 'plot'), ...zones.filter((z) => z.kind !== 'plot')];

export const polylineLength = (pts: Point[]): number => {
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return len;
};

/**
 * Points along a polyline about `spacing` apart (always including both ends and every corner),
 * used for fence posts.
 */
export function samplePolyline(pts: Point[], spacing: number): Point[] {
  if (!pts.length) return [];
  const out: Point[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(1, Math.round(len / spacing));
    for (let k = 1; k <= n; k++) out.push({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n });
  }
  return out;
}

// ---- garden paths ------------------------------------------------------------------------------------------------------------

export const PATH_SURFACES: Record<PathSurface, { label: string; color: string }> = {
  plain: { label: 'Plain', color: '#e6dcc3' },
  slabs: { label: 'Paving slabs', color: '#d3cfc6' },
  gravel: { label: 'Gravel', color: '#d9cfb6' },
  stepping: { label: 'Stepping stones', color: '#a8a39a' },
  brick: { label: 'Brick', color: '#b9775a' },
  boards: { label: 'Wooden boards', color: '#b58b5e' },
};

/** The color a strip is drawn with: its own look for a path with a surface, else the style of its kind. */
export const stripColor = (s: Pick<Strip, 'kind' | 'surface'>): string => (s.kind === 'path' ? PATH_SURFACES[s.surface ?? 'plain'].color : STRIP_STYLES[s.kind].color);

/** Where a distance along a polyline is, and which way it runs there (clamped to the ends). */
export function pointAtLength(pts: Point[], s: number): { p: Point; u: Point } {
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 1e-9) continue;
    if (s <= acc + len || i === pts.length - 1) {
      const t = Math.min(1, Math.max(0, (s - acc) / len));
      return { p: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, u: { x: (b.x - a.x) / len, y: (b.y - a.y) / len } };
    }
    acc += len;
  }
  return { p: pts[0] ?? { x: 0, y: 0 }, u: { x: 1, y: 0 } };
}

/** The part of a polyline between two distances along it, as a polyline (corners inside it are kept). */
export function subPolyline(pts: Point[], s0: number, s1: number): Point[] {
  const out: Point[] = [pointAtLength(pts, s0).p];
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    acc += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    if (acc > s0 + 1e-6 && acc < s1 - 1e-6) out.push(pts[i]);
  }
  out.push(pointAtLength(pts, s1).p);
  return out;
}

/** Nearest point of a polyline to `p`: distance along it and sideways. */
export function projectOnPolyline(pts: Point[], p: Point): { s: number; dist: number; side: 1 | -1 } {
  let best = { s: 0, dist: Infinity, side: 1 as 1 | -1 };
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 1e-9) continue;
    const ux = (b.x - a.x) / len;
    const uy = (b.y - a.y) / len;
    const t = Math.min(len, Math.max(0, (p.x - a.x) * ux + (p.y - a.y) * uy));
    const qx = a.x + ux * t;
    const qy = a.y + uy * t;
    const dist = Math.hypot(p.x - qx, p.y - qy);
    if (dist < best.dist) best = { s: acc + t, dist, side: (p.x - qx) * -uy + (p.y - qy) * ux >= 0 ? 1 : -1 };
    acc += len;
  }
  return best;
}

/** The gate openings of a strip, kept inside the strip, in order and without overlaps (the later of two overlapping gates loses). */
export function gateSpans(strip: Pick<Strip, 'points' | 'gates'>): { gate: Gate; s0: number; s1: number }[] {
  const L = polylineLength(strip.points);
  const out: { gate: Gate; s0: number; s1: number }[] = [];
  for (const g of [...(strip.gates ?? [])].sort((a, b) => a.pos - b.pos)) {
    const s0 = Math.max(0, g.pos - g.width / 2);
    const s1 = Math.min(L, g.pos + g.width / 2);
    if (s1 - s0 < 0.2 || (out.length && s0 < out[out.length - 1].s1 - 1e-6)) continue;
    out.push({ gate: g, s0, s1 });
  }
  return out;
}

/** The solid parts of a fence or hedge: the line without its gate openings, as polylines. */
export function solidSpans(strip: Pick<Strip, 'points' | 'gates'>): Point[][] {
  const L = polylineLength(strip.points);
  const out: Point[][] = [];
  let cursor = 0;
  for (const { s0, s1 } of gateSpans(strip)) {
    if (s0 - cursor > 0.02) out.push(subPolyline(strip.points, cursor, s0));
    cursor = s1;
  }
  if (L - cursor > 0.02) out.push(subPolyline(strip.points, cursor, L));
  return out;
}

export interface GateGeometry {
  /** The two ends of the opening, its middle and which way the fence runs there, and the way the gate swings open. */
  a: Point;
  b: Point;
  mid: Point;
  u: Point;
  n: Point;
  /** One entry per leaf: where it is hinged, where its free end is when shut, and where it is when open (plan points). */
  leaves: { hinge: Point; shut: Point; open: Point }[];
}

/** Where the leaves of a gate are, shut and open (a sliding gate's leaf slides sideways along the fence behind it). */
export function gateGeometry(strip: Pick<Strip, 'points'>, g: Gate): GateGeometry {
  const L = polylineLength(strip.points);
  const s0 = Math.max(0, g.pos - g.width / 2);
  const s1 = Math.min(L, g.pos + g.width / 2);
  const a = pointAtLength(strip.points, s0).p;
  const b = pointAtLength(strip.points, s1).p;
  const w = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const u = { x: (b.x - a.x) / w, y: (b.y - a.y) / w };
  const n = { x: -u.y * g.swing, y: u.x * g.swing }; // the side it opens to
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const add = (p: Point, d: Point, k: number): Point => ({ x: p.x + d.x * k, y: p.y + d.y * k });
  let leaves: GateGeometry['leaves'];
  if (g.kind === 'double') {
    leaves = [
      { hinge: a, shut: mid, open: add(a, n, w / 2) },
      { hinge: b, shut: mid, open: add(b, n, w / 2) },
    ];
  } else if (g.kind === 'sliding') {
    const side = add(a, n, 0.12);
    const sideB = add(b, n, 0.12);
    // it rolls along the fence on its own side, towards the end it is hinged on
    leaves = g.hinge === 'a'
      ? [{ hinge: sideB, shut: side, open: add(side, u, -w) }]
      : [{ hinge: side, shut: sideB, open: add(sideB, u, w) }];
  } else {
    leaves = g.hinge === 'a' ? [{ hinge: a, shut: b, open: add(a, n, w) }] : [{ hinge: b, shut: a, open: add(b, n, w) }];
  }
  return { a, b, mid, u, n, leaves };
}

/** A mark on a garden path: a line (joints of slabs, courses of bricks, boards) or a stone. In plan coordinates. */
export type PathMark = { t: 'line'; pts: Point[] } | { t: 'stone'; x: number; y: number; rx: number; ry: number; rot: number };

/** The marks that show what a path is made of, and for stepping stones the stones themselves (these replace the band). */
export function pathMarks(strip: Pick<Strip, 'points' | 'width' | 'surface'>): PathMark[] {
  const surface = strip.surface ?? 'plain';
  const out: PathMark[] = [];
  const L = polylineLength(strip.points);
  if (L < 0.05 || surface === 'plain') return out;
  const hw = strip.width / 2;
  const across = (s: number): PathMark => {
    const { p, u } = pointAtLength(strip.points, s);
    return { t: 'line', pts: [{ x: p.x - u.y * hw, y: p.y + u.x * hw }, { x: p.x + u.y * hw, y: p.y - u.x * hw }] };
  };
  if (surface === 'stepping') {
    const step = Math.max(0.55, strip.width * 0.6);
    for (let s = step / 2, i = 0; s < L; s += step, i++) {
      const { p, u } = pointAtLength(strip.points, s);
      const side = (i % 2 ? 1 : -1) * Math.min(0.1, hw * 0.25);
      out.push({ t: 'stone', x: p.x - u.y * side, y: p.y + u.x * side, rx: Math.min(0.28, hw * 0.8), ry: Math.min(0.22, hw * 0.6), rot: (Math.atan2(u.y, u.x) * 180) / Math.PI + (i % 3) * 9 });
    }
  } else if (surface === 'slabs') {
    for (let s = 0.6; s < L - 0.05; s += 0.6) out.push(across(s));
    if (strip.width > 1.3) out.push({ t: 'line', pts: strip.points });
  } else if (surface === 'brick') {
    for (let s = 0.2; s < L - 0.05; s += 0.2) out.push(across(s));
    const lanes = Math.max(1, Math.round(strip.width / 0.2));
    for (let k = 1; k < lanes; k++) out.push({ t: 'line', pts: offsetPolyline(strip.points, -hw + (strip.width * k) / lanes) });
  } else if (surface === 'boards') {
    const lanes = Math.max(2, Math.round(strip.width / 0.14));
    for (let k = 1; k < lanes; k++) out.push({ t: 'line', pts: offsetPolyline(strip.points, -hw + (strip.width * k) / lanes) });
  } else if (surface === 'gravel') {
    // a sprinkling of pebbles, the same every time for the same path
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const count = Math.min(260, Math.round(L * strip.width * 14));
    for (let i = 0; i < count; i++) {
      const { p, u } = pointAtLength(strip.points, rnd() * L);
      const side = (rnd() - 0.5) * strip.width * 0.92;
      out.push({ t: 'stone', x: p.x - u.y * side, y: p.y + u.x * side, rx: 0.018 + rnd() * 0.02, ry: 0.014 + rnd() * 0.016, rot: rnd() * 180 });
    }
  }
  return out;
}

/** A polyline moved sideways by `off` (positive = to the right of the way it runs), with the corners mitred. */
export function offsetPolyline(pts: Point[], off: number): Point[] {
  return pts.map((p, i) => {
    const prev = pts[Math.max(0, i - 1)];
    const next = pts[Math.min(pts.length - 1, i + 1)];
    const norm = (a: Point, b: Point) => {
      const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      return { x: -(b.y - a.y) / l, y: (b.x - a.x) / l };
    };
    const n1 = i > 0 ? norm(prev, p) : norm(p, next);
    const n2 = i < pts.length - 1 ? norm(p, next) : n1;
    const m = { x: n1.x + n2.x, y: n1.y + n2.y };
    const ml = Math.hypot(m.x, m.y) || 1;
    const dir = { x: m.x / ml, y: m.y / ml };
    const k = 1 / Math.max(0.5, dir.x * n1.x + dir.y * n1.y); // a mitre at corners, but not a spike
    return { x: p.x + dir.x * off * k, y: p.y + dir.y * off * k };
  });
}
