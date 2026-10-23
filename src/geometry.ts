/** Pure geometry helpers. No React, no Konva, no state: easy to unit test. All units are meters. */
import type { Opening, Point, Wall } from './model';

export const dist = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);

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

export function wallFrame(w: Wall): WallFrame {
  const length = dist(w.a, w.b);
  const u = length > 1e-9 ? { x: (w.b.x - w.a.x) / length, y: (w.b.y - w.a.y) / length } : { x: 1, y: 0 };
  return { length, u, n: { x: -u.y, y: u.x }, angle: (Math.atan2(u.y, u.x) * 180) / Math.PI };
}

/** Point at distance `s` along the wall from `a`, offset `d` toward the normal. */
export function pointOnWall(w: Wall, s: number, d = 0): Point {
  const f = wallFrame(w);
  return { x: w.a.x + f.u.x * s + f.n.x * d, y: w.a.y + f.u.y * s + f.n.y * d };
}

/** Position of `p` in the wall's frame: `s` along the wall (unclamped), `d` signed distance to the centerline. */
export function projectOnWall(w: Wall, p: Point): { s: number; d: number } {
  const f = wallFrame(w);
  const dx = p.x - w.a.x;
  const dy = p.y - w.a.y;
  return { s: dx * f.u.x + dy * f.u.y, d: dx * f.n.x + dy * f.n.y };
}

/** Nearest wall to `p` within `maxDist` meters (to the wall's centerline segment). */
export function nearestWall(p: Point, walls: Wall[], maxDist: number): { wall: Wall; s: number; d: number } | null {
  let best: { wall: Wall; s: number; d: number; dist: number } | null = null;
  for (const wall of walls) {
    const { s, d } = projectOnWall(wall, p);
    const L = wallFrame(wall).length;
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
  const f = wallFrame(w);
  const hingeS = o.hinge === 'a' ? o.pos - o.width / 2 : o.pos + o.width / 2;
  const jambS = o.hinge === 'a' ? o.pos + o.width / 2 : o.pos - o.width / 2;
  const hinge = pointOnWall(w, hingeS);
  const jamb = pointOnWall(w, jambS);
  const closedDir = o.hinge === 'a' ? f.u : { x: -f.u.x, y: -f.u.y };
  const openDir = { x: f.n.x * o.swing, y: f.n.y * o.swing };
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
    const r = w.thickness / 2;
    minX = Math.min(minX, w.a.x - r, w.b.x - r);
    minY = Math.min(minY, w.a.y - r, w.b.y - r);
    maxX = Math.max(maxX, w.a.x + r, w.b.x + r);
    maxY = Math.max(maxY, w.a.y + r, w.b.y + r);
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
    const f = wallFrame(w);
    const r = w.thickness / 2;
    const x0 = Math.max(0, Math.floor((Math.min(w.a.x, w.b.x) - r - minX) / c));
    const x1 = Math.min(nx - 1, Math.ceil((Math.max(w.a.x, w.b.x) + r - minX) / c));
    const y0 = Math.max(0, Math.floor((Math.min(w.a.y, w.b.y) - r - minY) / c));
    const y1 = Math.min(ny - 1, Math.ceil((Math.max(w.a.y, w.b.y) + r - minY) / c));
    for (let j = y0; j <= y1; j++) {
      const py = minY + (j + 0.5) * c - w.a.y;
      for (let i = x0; i <= x1; i++) {
        const px = minX + (i + 0.5) * c - w.a.x;
        const s = px * f.u.x + py * f.u.y;
        const d = px * f.n.x + py * f.n.y;
        if (s >= -r && s <= f.length + r && Math.abs(d) <= r) blocked[j * nx + i] = 1;
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
