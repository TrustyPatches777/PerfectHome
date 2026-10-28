/** Pure geometry helpers. No React, no Konva, no state: easy to unit test. All units are meters. */
import type { Opening, Point, Wall, SectionLine } from './model';

export const dist = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Rotate `p` about `c` by `deg` degrees (clockwise on screen, y down). */
export function rotatePoint(p: Point, c: Point, deg: number): Point {
  const r = (deg * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const dx = p.x - c.x;
  const dy = p.y - c.y;
  return { x: c.x + dx * cos - dy * sin, y: c.y + dx * sin + dy * cos };
}

/** Rough size in meters of a text label (good enough for centering and hit areas without measuring fonts). */
export function textBox(l: { text: string; size: number }) {
  const lines = l.text.split('\n');
  const chars = Math.max(1, ...lines.map((s) => s.length));
  return { w: chars * l.size * 0.62 + l.size * 0.4, h: lines.length * l.size * 1.25 };
}

export function snapValue(v: number, step: number): number {
  return Math.round(v / step) * step;
}

/** Round away float noise (e.g. 0.30000000000000004) without changing the visible value. */
export const clean = (v: number) => Math.round(v * 1e6) / 1e6 + 0; // `+ 0` turns -0 into 0

export function snapPoint(p: Point, step: number): Point {
  return { x: clean(snapValue(p.x, step)), y: clean(snapValue(p.y, step)) };
}

// ---------------------------------------------------------------------------
// Walls & openings
// ---------------------------------------------------------------------------

export interface WallFrame {
  length: number;
  /** Unit vector a→b. */
  u: Point;
  /** Unit normal, pointing to the RIGHT of a→b on screen (y down). Positive `swing` goes this way. */
  n: Point;
  /** Angle of a→b in degrees (Konva rotation). */
  angle: number;
}

const TWO_PI = Math.PI * 2;
const normAngle = (x: number) => ((x % TWO_PI) + TWO_PI) % TWO_PI;

/** A curved wall: the circle arc through a, b and the apex `bulge` meters from the middle of the chord. */
export interface WallArc {
  c: Point;
  r: number;
  /** Angle (radians) of point `a` seen from the center, and the signed angle swept going to `b`. */
  a0: number;
  sweep: number;
  length: number;
}

/** The arc of a curved wall, or null for a straight one. */
export function wallArc(w: Wall): WallArc | null {
  const chord = dist(w.a, w.b);
  const raw = w.bulge ?? 0;
  if (Math.abs(raw) < 0.001 || chord < 1e-6) return null;
  const h = Math.sign(raw) * Math.min(Math.abs(raw), chord); // at most a bit more than a half circle
  const u = { x: (w.b.x - w.a.x) / chord, y: (w.b.y - w.a.y) / chord };
  const n = { x: -u.y, y: u.x };
  const r = (chord * chord / 4 + h * h) / (2 * Math.abs(h));
  const mid = { x: (w.a.x + w.b.x) / 2, y: (w.a.y + w.b.y) / 2 };
  const apex = { x: mid.x + n.x * h, y: mid.y + n.y * h };
  const k = h - Math.sign(h) * r;
  const c = { x: mid.x + n.x * k, y: mid.y + n.y * k };
  const a0 = Math.atan2(w.a.y - c.y, w.a.x - c.x);
  const toB = normAngle(Math.atan2(w.b.y - c.y, w.b.x - c.x) - a0);
  const toApex = normAngle(Math.atan2(apex.y - c.y, apex.x - c.x) - a0);
  const sweep = toApex <= toB ? toB : toB - TWO_PI; // go the way that passes through the apex
  return { c, r, a0, sweep, length: r * Math.abs(sweep) };
}

/** Length along the wall: the arc length for curved walls, the distance a→b for straight ones. */
export const wallLength = (w: Wall): number => wallArc(w)?.length ?? dist(w.a, w.b);

export interface WallPoint {
  p: Point;
  /** Unit tangent (direction of travel a→b) and unit normal to the right of it. */
  u: Point;
  n: Point;
  /** Direction of the tangent in degrees (Konva rotation). */
  angle: number;
}

/** Position and direction at distance `s` along the wall (values outside 0..length extend the wall). */
export function wallPointAt(w: Wall, s: number): WallPoint {
  const arc = wallArc(w);
  if (!arc) {
    const f = wallFrame(w);
    return { p: { x: w.a.x + f.u.x * s, y: w.a.y + f.u.y * s }, u: f.u, n: f.n, angle: f.angle };
  }
  const th = arc.a0 + arc.sweep * (s / arc.length);
  const dir = Math.sign(arc.sweep);
  const u = { x: -Math.sin(th) * dir, y: Math.cos(th) * dir };
  return {
    p: { x: arc.c.x + arc.r * Math.cos(th), y: arc.c.y + arc.r * Math.sin(th) },
    u,
    n: { x: -u.y, y: u.x },
    angle: (Math.atan2(u.y, u.x) * 180) / Math.PI,
  };
}

/** The outline of a wall's drawn body as a polygon (including the half-thickness extension at both ends). */
export function wallOutlinePoints(w: Wall): Point[] {
  const h = w.thickness / 2;
  const arc = wallArc(w);
  const steps = arc ? Math.max(6, Math.ceil(Math.abs(arc.sweep) / (Math.PI / 24))) : 1;
  const L = wallLength(w);
  const outer: Point[] = [];
  const inner: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    const wp = wallPointAt(w, -h + ((L + 2 * h) * i) / steps);
    outer.push({ x: wp.p.x + wp.n.x * h, y: wp.p.y + wp.n.y * h });
    inner.push({ x: wp.p.x - wp.n.x * h, y: wp.p.y - wp.n.y * h });
  }
  return [...outer, ...inner.reverse()];
}

/** A wall as convex pieces (one rectangle for a straight wall, one short rectangle per step of a curved wall), for collision tests. */
export function wallPieces(w: Wall): Point[][] {
  const h = w.thickness / 2;
  return wallRangePieces(w, -h, wallLength(w) + h);
}

/** The same for the part of a wall between two distances along it. */
export function wallRangePieces(w: Wall, s0: number, s1: number): Point[][] {
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
  const out: Point[][] = [];
  for (let i = 0; i < steps; i++) out.push([outer[i], outer[i + 1], inner[i + 1], inner[i]]);
  return out;
}

/** Frame of the straight chord a→b. For curved walls `length` is the length along the curve. */
export function wallFrame(w: Wall): WallFrame {
  const chord = dist(w.a, w.b);
  const u = chord > 1e-9 ? { x: (w.b.x - w.a.x) / chord, y: (w.b.y - w.a.y) / chord } : { x: 1, y: 0 };
  return { length: wallLength(w), u, n: { x: -u.y, y: u.x }, angle: (Math.atan2(u.y, u.x) * 180) / Math.PI };
}

/** Point at distance `s` along the wall from `a`, offset `d` toward the normal. */
export function pointOnWall(w: Wall, s: number, d = 0): Point {
  const wp = wallPointAt(w, s);
  return { x: wp.p.x + wp.n.x * d, y: wp.p.y + wp.n.y * d };
}

/** Position of `p` in the wall's frame: `s` along the wall (unclamped), `d` signed distance to the centerline. */
export function projectOnWall(w: Wall, p: Point): { s: number; d: number } {
  const arc = wallArc(w);
  if (!arc) {
    const f = wallFrame(w);
    const dx = p.x - w.a.x;
    const dy = p.y - w.a.y;
    return { s: dx * f.u.x + dy * f.u.y, d: dx * f.n.x + dy * f.n.y };
  }
  const dx = p.x - arc.c.x;
  const dy = p.y - arc.c.y;
  const dir = Math.sign(arc.sweep);
  const span = Math.abs(arc.sweep);
  const t = normAngle((Math.atan2(dy, dx) - arc.a0) * dir);
  let travelled = t;
  if (t > span) {
    const beyond = t - span;
    const before = TWO_PI - t;
    travelled = beyond < before ? span + beyond : -before; // closer to the b end or to the a end
  }
  // the normal points away from the center when the wall bulges right (bulge > 0), toward it otherwise
  return { s: travelled * arc.r, d: (Math.hypot(dx, dy) - arc.r) * Math.sign(w.bulge ?? 1) };
}

/** Nearest wall to `p` within `maxDist` meters (to the wall's centerline). */
export function nearestWall(p: Point, walls: Wall[], maxDist: number): { wall: Wall; s: number; d: number } | null {
  let best: { wall: Wall; s: number; d: number; dist: number } | null = null;
  for (const wall of walls) {
    const { s, d } = projectOnWall(wall, p);
    const L = wallLength(wall);
    const sc = Math.min(L, Math.max(0, s));
    const dd = Math.hypot(s - sc, d);
    if (dd <= maxDist && (!best || dd < best.dist)) best = { wall, s, d, dist: dd };
  }
  return best && { wall: best.wall, s: best.s, d: best.d };
}

export const openingSpan = (o: Opening): [number, number] => [o.pos - o.width / 2, o.pos + o.width / 2];

/** Keep an opening fully inside its wall. */
export function clampOpeningPos(pos: number, width: number, wallLength: number): number {
  if (width >= wallLength) return wallLength / 2;
  return Math.min(wallLength - width / 2, Math.max(width / 2, pos));
}

export function openingOverlaps(wallOpenings: Opening[], pos: number, width: number, ignoreId?: string): boolean {
  const a0 = pos - width / 2;
  const a1 = pos + width / 2;
  return wallOpenings.some((o) => {
    if (o.id === ignoreId) return false;
    const [b0, b1] = openingSpan(o);
    return a0 < b1 - 1e-6 && b0 < a1 - 1e-6;
  });
}

/**
 * The solid parts of a wall as [start, end] distances along it, with the doors/windows cut out.
 * The wall is extended by half its thickness at both ends so corners and T-junctions close up.
 */
export function wallSolidSegments(w: Wall, openings: Opening[]): [number, number][] {
  const L = wallFrame(w).length;
  const gaps = openings
    .map(openingSpan)
    .sort((a, b) => a[0] - b[0]);
  const out: [number, number][] = [];
  let cursor = -w.thickness / 2;
  for (const [g0, g1] of gaps) {
    if (g0 > cursor) out.push([cursor, g0]);
    cursor = Math.max(cursor, g1);
  }
  if (cursor < L + w.thickness / 2) out.push([cursor, L + w.thickness / 2]);
  return out;
}

export interface DoorGeometry {
  hinge: Point;
  /** The jamb opposite the hinge (where the closed leaf ends). */
  jamb: Point;
  /** Tip of the leaf when fully open (90°). */
  leafEnd: Point;
  /** Swing arc from the closed to the open position, as a polyline. */
  arc: Point[];
}

export function doorGeometry(w: Wall, o: Opening, steps = 14): DoorGeometry {
  const wp = wallPointAt(w, o.pos); // for curved walls the door is drawn straight along the tangent at its center
  const half = o.width / 2;
  const sgn = o.hinge === 'a' ? -1 : 1;
  const hinge = { x: wp.p.x + wp.u.x * half * sgn, y: wp.p.y + wp.u.y * half * sgn };
  const jamb = { x: wp.p.x - wp.u.x * half * sgn, y: wp.p.y - wp.u.y * half * sgn };
  const closedDir = o.hinge === 'a' ? wp.u : { x: -wp.u.x, y: -wp.u.y };
  const openDir = { x: wp.n.x * o.swing, y: wp.n.y * o.swing };
  const arc: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * (Math.PI / 2);
    arc.push({
      x: hinge.x + o.width * (Math.cos(t) * closedDir.x + Math.sin(t) * openDir.x),
      y: hinge.y + o.width * (Math.cos(t) * closedDir.y + Math.sin(t) * openDir.y),
    });
  }
  return { hinge, jamb, leafEnd: arc[arc.length - 1], arc };
}

/** Constrain `p` so the segment from `from` points at a multiple of `stepDeg`. */
export function constrainAngle(from: Point, p: Point, stepDeg = 45): Point {
  const dx = p.x - from.x;
  const dy = p.y - from.y;
  const len = Math.hypot(dx, dy);
  const step = (stepDeg * Math.PI) / 180;
  const ang = Math.round(Math.atan2(dy, dx) / step) * step;
  return { x: from.x + Math.cos(ang) * len, y: from.y + Math.sin(ang) * len };
}

export const samePoint = (a: Point, b: Point, eps = 1e-3) => Math.abs(a.x - b.x) < eps && Math.abs(a.y - b.y) < eps;

// ---------------------------------------------------------------------------
// Polygons & rooms
// ---------------------------------------------------------------------------

/** Absolute polygon area (shoelace). */
export function polygonArea(pts: Point[]): number {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    s += p.x * q.y - q.x * p.y;
  }
  return Math.abs(s) / 2;
}

export function pointInPolygon(p: Point, pts: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i];
    const b = pts[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** True when segments p1-p2 and p3-p4 cross at a single interior point (touching or collinear does not count). */
function segmentsCross(p1: Point, p2: Point, p3: Point, p4: Point): boolean {
  const d = (a: Point, b: Point, c: Point) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const eps = 1e-9;
  const d1 = d(p3, p4, p1);
  const d2 = d(p3, p4, p2);
  const d3 = d(p1, p2, p3);
  const d4 = d(p1, p2, p4);
  return ((d1 > eps && d2 < -eps) || (d1 < -eps && d2 > eps)) && ((d3 > eps && d4 < -eps) || (d3 < -eps && d4 > eps));
}

/** Do two polygons share any area? Polygons that merely touch along an edge or at a corner do not overlap. */
export function polygonsOverlap(a: Point[], b: Point[]): boolean {
  for (let i = 0; i < a.length; i++)
    for (let j = 0; j < b.length; j++)
      if (segmentsCross(a[i], a[(i + 1) % a.length], b[j], b[(j + 1) % b.length])) return true;
  // no crossing edges: one may lie completely inside the other (or they are identical)
  return pointInPolygon(labelPoint(a), b) || pointInPolygon(labelPoint(b), a);
}

/** A good spot for a room's label: the centroid, or the nearest interior point for concave shapes. */
export function labelPoint(pts: Point[]): Point {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    const cr = p.x * q.y - q.x * p.y;
    a += cr;
    cx += (p.x + q.x) * cr;
    cy += (p.y + q.y) * cr;
  }
  const c = Math.abs(a) < 1e-9 ? { x: pts[0].x, y: pts[0].y } : { x: cx / (3 * a), y: cy / (3 * a) };
  if (pointInPolygon(c, pts)) return c;
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  let best = pts[0];
  let bestD = Infinity;
  for (let i = 0; i <= 24; i++)
    for (let j = 0; j <= 24; j++) {
      const q = { x: x0 + ((x1 - x0) * i) / 24, y: y0 + ((y1 - y0) * j) / 24 };
      const d = dist(q, c);
      if (d < bestD && pointInPolygon(q, pts)) {
        best = q;
        bestD = d;
      }
    }
  return best;
}

function simplifyClosed(pts: Point[], eps: number): Point[] {
  if (pts.length < 4) return pts;
  const segDist = (p: Point, a: Point, b: Point) => {
    const l2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
    if (l2 === 0) return dist(p, a);
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2));
    return dist(p, { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) });
  };
  const dp = (chain: Point[]): Point[] => {
    if (chain.length < 3) return chain;
    let maxD = 0;
    let idx = 0;
    for (let i = 1; i < chain.length - 1; i++) {
      const d = segDist(chain[i], chain[0], chain[chain.length - 1]);
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (maxD <= eps) return [chain[0], chain[chain.length - 1]];
    return [...dp(chain.slice(0, idx + 1)).slice(0, -1), ...dp(chain.slice(idx))];
  };
  // split the loop at the two points farthest apart so both halves are open chains
  let far = 1;
  for (let i = 1; i < pts.length; i++) if (dist(pts[i], pts[0]) > dist(pts[far], pts[0])) far = i;
  const first = dp(pts.slice(0, far + 1));
  const second = dp([...pts.slice(far), pts[0]]);
  return [...first.slice(0, -1), ...second.slice(0, -1)];
}

/**
 * Find the room around `seed`: rasterise the walls (door/window gaps count as closed), flood-fill from the
 * seed, and trace the outline. Returns null when the seed is inside a wall or the area is not enclosed.
 */
export function detectRoom(seed: Point, walls: Wall[]): Point[] | null {
  if (!walls.length) return null;
  const pad = 0.3;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const w of walls) {
    for (const p of wallOutlinePoints(w)) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
  }
  minX -= pad;
  minY -= pad;
  maxX += pad;
  maxY += pad;
  if (seed.x < minX || seed.x > maxX || seed.y < minY || seed.y > maxY) return null;

  const W = maxX - minX;
  const H = maxY - minY;
  const c = Math.max(0.0125, Math.sqrt((W * H) / 2.5e6));
  const nx = Math.ceil(W / c);
  const ny = Math.ceil(H / c);
  const blocked = new Uint8Array(nx * ny);

  for (const w of walls) {
    const r = w.thickness / 2;
    const L = wallLength(w);
    const box = wallOutlinePoints(w);
    const x0 = Math.max(0, Math.floor((Math.min(...box.map((p) => p.x)) - minX) / c));
    const x1 = Math.min(nx - 1, Math.ceil((Math.max(...box.map((p) => p.x)) - minX) / c));
    const y0 = Math.max(0, Math.floor((Math.min(...box.map((p) => p.y)) - minY) / c));
    const y1 = Math.min(ny - 1, Math.ceil((Math.max(...box.map((p) => p.y)) - minY) / c));
    for (let j = y0; j <= y1; j++) {
      for (let i = x0; i <= x1; i++) {
        const { s, d } = projectOnWall(w, { x: minX + (i + 0.5) * c, y: minY + (j + 0.5) * c });
        if (s >= -r && s <= L + r && Math.abs(d) <= r) blocked[j * nx + i] = 1;
      }
    }
  }

  const si = Math.floor((seed.x - minX) / c);
  const sj = Math.floor((seed.y - minY) / c);
  if (blocked[sj * nx + si]) return null;

  // flood fill (4-connected)
  const fill = new Uint8Array(nx * ny);
  const stack = new Int32Array(nx * ny);
  let sp = 0;
  stack[sp++] = sj * nx + si;
  fill[sj * nx + si] = 1;
  while (sp) {
    const idx = stack[--sp];
    const i = idx % nx;
    const j = (idx - i) / nx;
    if (i === 0 || j === 0 || i === nx - 1 || j === ny - 1) return null; // leaked out: not enclosed
    for (const n of [idx - 1, idx + 1, idx - nx, idx + nx]) {
      if (!blocked[n] && !fill[n]) {
        fill[n] = 1;
        stack[sp++] = n;
      }
    }
  }

  // trace boundary edges, oriented clockwise around filled cells
  const vid = (vx: number, vy: number) => vy * (nx + 1) + vx;
  const next = new Map<number, number[]>();
  const addEdge = (ax: number, ay: number, bx: number, by: number) => {
    const k = vid(ax, ay);
    const arr = next.get(k);
    if (arr) arr.push(vid(bx, by));
    else next.set(k, [vid(bx, by)]);
  };
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      if (!fill[j * nx + i]) continue;
      if (!fill[(j - 1) * nx + i]) addEdge(i, j, i + 1, j);
      if (!fill[j * nx + i + 1]) addEdge(i + 1, j, i + 1, j + 1);
      if (!fill[(j + 1) * nx + i]) addEdge(i + 1, j + 1, i, j + 1);
      if (!fill[j * nx + i - 1]) addEdge(i, j + 1, i, j);
    }

  const toPoint = (v: number): Point => ({ x: minX + (v % (nx + 1)) * c, y: minY + Math.floor(v / (nx + 1)) * c });
  let best: Point[] = [];
  let bestArea = -1;
  while (next.size) {
    const start = next.keys().next().value as number;
    const loop: number[] = [start];
    let cur = start;
    for (;;) {
      const outs = next.get(cur);
      if (!outs?.length) break;
      const nxt = outs.pop()!;
      if (!outs.length) next.delete(cur);
      if (nxt === start) break;
      loop.push(nxt);
      cur = nxt;
    }
    // drop collinear points
    const pts = loop.map(toPoint);
    const corners = pts.filter((p, i) => {
      const a = pts[(i + pts.length - 1) % pts.length];
      const b = pts[(i + 1) % pts.length];
      return Math.abs((p.x - a.x) * (b.y - p.y) - (p.y - a.y) * (b.x - p.x)) > 1e-9;
    });
    const area = polygonArea(corners);
    if (area > bestArea) {
      best = corners;
      bestArea = area;
    }
  }
  if (best.length < 3) return null;
  return simplifyClosed(best, c * 1.2).map((p) => ({ x: Math.round(p.x * 1000) / 1000, y: Math.round(p.y * 1000) / 1000 }));
}

// ---------------------------------------------------------------------------
// Formatting & scale
// ---------------------------------------------------------------------------

/** Pick a "nice" 1-2-5 length (meters) whose on-screen size is at least `minPx` at `zoom` px/m. */
export function niceLength(zoom: number, minPx: number): number {
  const raw = minPx / zoom;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  for (const m of [1, 2, 5, 10]) if (m * pow >= raw) return m * pow;
  return 10 * pow;
}

/** "3.20 m" for lengths, "45 cm" for short ones. */
export function formatLength(m: number): string {
  if (m < 1) return `${Math.round(m * 100)} cm`;
  return `${(Math.round(m * 100) / 100).toFixed(2)} m`;
}

export function formatArea(m2: number): string {
  return `${(Math.round(m2 * 100) / 100).toFixed(2)} m²`;
}

/** True when the polygon turns the same way at every corner. */
export function isConvex(pts: Point[]): boolean {
  let sign = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const c = pts[(i + 2) % pts.length];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cross) < 1e-9) continue;
    if (sign === 0) sign = Math.sign(cross);
    else if (Math.sign(cross) !== sign) return false;
  }
  return true;
}

/** The part of `subject` inside the CONVEX polygon `clip` (Sutherland–Hodgman). Empty when they do not meet. */
export function clipPolygon(subject: Point[], clip: Point[]): Point[] {
  let area = 0;
  for (let i = 0; i < clip.length; i++) area += clip[i].x * clip[(i + 1) % clip.length].y - clip[(i + 1) % clip.length].x * clip[i].y;
  const orient = area >= 0 ? 1 : -1;
  let out = subject;
  for (let i = 0; i < clip.length && out.length; i++) {
    const a = clip[i];
    const b = clip[(i + 1) % clip.length];
    const side = (p: Point) => orient * ((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x));
    const input = out;
    out = [];
    for (let j = 0; j < input.length; j++) {
      const p = input[j];
      const q = input[(j + 1) % input.length];
      const sp = side(p);
      const sq = side(q);
      if (sp >= 0) out.push(p);
      if (sp >= 0 !== sq >= 0) {
        const t = sp / (sp - sq);
        out.push({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });
      }
    }
  }
  return out.length >= 3 ? out : [];
}

// ---- wall corners ---------------------------------------------------------------------------------------------------------

/**
 * A place where this wall meets exactly one other wall end to end at an angle. Walls are drawn half a thickness longer than their
 * centerlines, which closes a square corner but pokes out (a sharper turn leaves a notch, a gentler one an ear) at any other angle.
 * So such corners are mitred instead: each face of the wall runs to the point where it meets the same face of the other wall.
 * `side` is the outer face, `s` where the outer faces meet and `si` where the inner faces meet, both measured along this wall.
 */
export interface WallCorner {
  side: 'l' | 'r';
  s: number;
  si: number;
}
export interface WallCorners {
  a?: WallCorner;
  b?: WallCorner;
}

/** The corners at the two ends of `w`, given the other walls of the same floor. Curved walls and T-junctions have none. */
export function wallCorners(w: Wall, walls: readonly Wall[]): WallCorners {
  if (wallArc(w)) return {};
  const out: WallCorners = {};
  const near = (p: Point, q: Point) => Math.abs(p.x - q.x) < 0.02 && Math.abs(p.y - q.y) < 0.02;
  for (const end of ['a', 'b'] as const) {
    const P = end === 'a' ? w.a : w.b;
    const others = walls.filter((o) => o.id !== w.id && (near(o.a, P) || near(o.b, P)));
    if (others.length !== 1 || wallArc(others[0])) continue;
    const o = others[0];
    const f = wallFrame(w);
    const g = wallFrame(o);
    const dA = end === 'a' ? f.u : { x: -f.u.x, y: -f.u.y };
    const dB = near(o.a, P) ? g.u : { x: -g.u.x, y: -g.u.y };
    const cross = dA.x * dB.y - dA.y * dB.x;
    if (Math.abs(cross) < 0.05) continue; // straight on (or folded back): nothing to mitre
    const bis = { x: dA.x + dB.x, y: dA.y + dB.y };
    const outward = (n: Point) => (n.x * bis.x + n.y * bis.y < 0 ? 1 : -1); // +1 = the face on the normal's side is the outer one
    const sA = outward(f.n);
    const sB = outward(g.n);
    const hA = w.thickness / 2;
    const hB = o.thickness / 2;
    const nA = { x: f.n.x * sA, y: f.n.y * sA };
    const nB = { x: g.n.x * sB, y: g.n.y * sB };
    // where P + nA*hA + t*dA meets P + nB*hB + t2*dB (the outer faces)
    const rx = nB.x * hB - nA.x * hA;
    const ry = nB.y * hB - nA.y * hA;
    const t = (rx * -dB.y + dB.x * ry) / -cross;
    if (!Number.isFinite(t) || Math.abs(t) > 10 * Math.max(hA, hB)) continue;
    // the inner faces meet at the mirror image of that point along the wall
    const L = wallLength(w);
    out[end] = end === 'a' ? { side: sA === 1 ? 'r' : 'l', s: t, si: -t } : { side: sA === 1 ? 'r' : 'l', s: L - t, si: L + t };
  }
  return out;
}

/** Where a face of a wall (`l` or `r`) runs from and to when the solid part runs from s0 to s1, with mitred ends at corners. */
export function faceSpan(w: Wall, side: 'l' | 'r', s0: number, s1: number, corners: WallCorners = {}): [number, number] {
  let t0 = s0;
  let t1 = s1;
  if (s0 < 0 && corners.a) t0 = corners.a.side === side ? corners.a.s : corners.a.si;
  if (s1 > wallLength(w) && corners.b) t1 = corners.b.side === side ? corners.b.s : corners.b.si;
  return [t0, t1];
}

/** The outline of the part of a straight wall between s0 and s1, with mitred ends where it turns a corner. */
export function wallSegmentOutline(w: Wall, s0: number, s1: number, corners: WallCorners = {}): Point[] {
  const h = w.thickness / 2;
  const [r0, r1] = faceSpan(w, 'r', s0, s1, corners);
  const [l0, l1] = faceSpan(w, 'l', s0, s1, corners);
  const at = (s: number, off: number) => {
    const wp = wallPointAt(w, s);
    return { x: wp.p.x + wp.n.x * off, y: wp.p.y + wp.n.y * off };
  };
  return [at(r0, h), at(r1, h), at(l1, -h), at(l0, -h)];
}

/** The direction a section looks in (a unit vector on the plan): to the left of the line as you walk from a to b on the screen, or the other way when flipped. */
export function sectionDirection(line: Pick<SectionLine, 'a' | 'b' | 'flip'>): Point {
  const len = Math.hypot(line.b.x - line.a.x, line.b.y - line.a.y) || 1;
  const t = { x: (line.b.x - line.a.x) / len, y: (line.b.y - line.a.y) / len };
  return line.flip ? { x: -t.y, y: t.x } : { x: t.y, y: -t.x };
}
