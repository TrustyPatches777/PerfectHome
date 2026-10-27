/**
 * Roofs: what they look like and how they are shaped. Pure maths, shared by the plan drawing (lines), the 3D view (faces) and the
 * tool that fits a roof to the walls of a floor.
 *
 * A roof lives in its own box: x along the ridge, z across it (the plan's y), y up from the top of the walls. The footprint is
 * w x d centered on the origin; `overhang` pushes the eaves out beyond it.
 */
import { wallOutlinePoints } from './geometry';
import type { Design, Point, Roof, RoofKind, RoofMaterial } from './model';

export const ROOF_STYLES: Record<RoofKind, { label: string; pitch: number; material: RoofMaterial; hint: string }> = {
  gable: { label: 'Gable', pitch: 35, material: 'tiles', hint: 'Two slopes meeting at a ridge, with a triangular wall at each end' },
  hip: { label: 'Hip', pitch: 30, material: 'tiles', hint: 'Four slopes: no gable ends (a square footprint makes a pyramid)' },
  flat: { label: 'Flat', pitch: 5, material: 'gravel', hint: 'A flat roof, optionally with a low edge wall' },
  shed: { label: 'Shed', pitch: 15, material: 'metal', hint: 'One single slope' },
  gambrel: { label: 'Gambrel', pitch: 20, material: 'shingle', hint: 'Barn roof: steep lower slopes, shallow upper ones' },
  mansard: { label: 'Mansard', pitch: 20, material: 'slate', hint: 'Steep lower slope on all four sides, a shallow hip roof on top' },
};

export const ROOF_MATERIAL_STYLES: Record<RoofMaterial, { label: string; color: string }> = {
  tiles: { label: 'Clay tiles', color: '#b5523b' },
  slate: { label: 'Slate', color: '#4b5563' },
  metal: { label: 'Standing-seam metal', color: '#7b8794' },
  shingle: { label: 'Shingles', color: '#6b5b4a' },
  thatch: { label: 'Thatch', color: '#c9a86a' },
  green: { label: 'Green roof', color: '#6d9a5b' },
  gravel: { label: 'Gravel', color: '#9ca3af' },
};

const DEG = Math.PI / 180;
/** The steep lower slope of gambrel and mansard roofs. */
export const STEEP = 65;

export type V3 = [number, number, number];

/** A planar polygon of the roof's skin or of a gable end wall. */
export interface RoofFace {
  kind: 'slope' | 'gable';
  pts: V3[];
}

/** An upright block: chimney, parapet. */
export interface RoofBlock {
  kind: 'chimney' | 'parapet' | 'cap';
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  z0: number;
  z1: number;
}

export interface RoofModel {
  faces: RoofFace[];
  blocks: RoofBlock[];
  /** Height of the highest point above the top of the walls (without the chimney). */
  height: number;
}

const swapXZ = (p: V3): V3 => [p[2], p[1], p[0]];

/** The sloping faces of a hip roof over a w x d box whose long side is x. Eaves reach Hx, Hz; the plane passes through the box edge at `y0`. */
function hipFaces(hw: number, hd: number, tp: number, Hx: number, Hz: number, y0: number): { faces: V3[][]; top: number } {
  const L = Math.max(0, 2 * hw - 2 * hd); // ridge length
  const yr = y0 + hd * tp;
  const yE = yr - Hz * tp;
  const r = L / 2;
  const front: V3[] = [[-Hx, yE, Hz], [Hx, yE, Hz], [r, yr, 0], [-r, yr, 0]];
  const back: V3[] = [[Hx, yE, -Hz], [-Hx, yE, -Hz], [-r, yr, 0], [r, yr, 0]];
  const left: V3[] = [[-Hx, yE, -Hz], [-Hx, yE, Hz], [-r, yr, 0]];
  const right: V3[] = [[Hx, yE, Hz], [Hx, yE, -Hz], [r, yr, 0]];
  return { faces: [front, back, left, right].filter((f) => polyArea(f) > 1e-6), top: yr };
}

function polyArea(p: V3[]): number {
  let ax = 0, ay = 0, az = 0;
  for (let i = 0; i < p.length; i++) {
    const a = p[i];
    const b = p[(i + 1) % p.length];
    ax += a[1] * b[2] - a[2] * b[1];
    ay += a[2] * b[0] - a[0] * b[2];
    az += a[0] * b[1] - a[1] * b[0];
  }
  return Math.hypot(ax, ay, az) / 2;
}

/** The 3D shape of a roof (see the file comment for the axes). */
export function roofModel(r: Pick<Roof, 'kind' | 'w' | 'd' | 'pitch' | 'overhang' | 'chimney' | 'parapet'>): RoofModel {
  const tp = Math.tan(Math.min(80, Math.max(3, r.pitch)) * DEG);
  const hw = r.w / 2;
  const hd = r.d / 2;
  const o = Math.max(0, r.overhang);
  const Hx = hw + o;
  const Hz = hd + o;
  const faces: RoofFace[] = [];
  const blocks: RoofBlock[] = [];
  const slope = (...pts: V3[][]) => pts.forEach((p) => faces.push({ kind: 'slope', pts: p }));
  const gable = (pts: (x: number) => V3[]) => [-hw, hw].forEach((x) => faces.push({ kind: 'gable', pts: pts(x) }));
  let height = 0;

  switch (r.kind) {
    case 'flat': {
      slope([[-Hx, 0, -Hz], [-Hx, 0, Hz], [Hx, 0, Hz], [Hx, 0, -Hz]]);
      if (r.parapet) {
        const t = 0.15;
        const h = 0.4;
        blocks.push(
          { kind: 'parapet', x0: -Hx, x1: Hx, y0: 0, y1: h, z0: -Hz, z1: -Hz + t },
          { kind: 'parapet', x0: -Hx, x1: Hx, y0: 0, y1: h, z0: Hz - t, z1: Hz },
          { kind: 'parapet', x0: -Hx, x1: -Hx + t, y0: 0, y1: h, z0: -Hz + t, z1: Hz - t },
          { kind: 'parapet', x0: Hx - t, x1: Hx, y0: 0, y1: h, z0: -Hz + t, z1: Hz - t },
        );
        height = h;
      }
      break;
    }
    case 'shed': {
      const y = (z: number) => (hd - z) * tp;
      slope([[-Hx, y(Hz), Hz], [Hx, y(Hz), Hz], [Hx, y(-Hz), -Hz], [-Hx, y(-Hz), -Hz]]);
      gable((x) => [[x, 0, -hd], [x, 0, hd], [x, 2 * hd * tp, -hd]]);
      height = 2 * hd * tp;
      break;
    }
    case 'gable': {
      const yr = hd * tp;
      const yE = yr - Hz * tp;
      slope([[-Hx, yE, Hz], [Hx, yE, Hz], [Hx, yr, 0], [-Hx, yr, 0]], [[Hx, yE, -Hz], [-Hx, yE, -Hz], [-Hx, yr, 0], [Hx, yr, 0]]);
      gable((x) => [[x, 0, -hd], [x, 0, hd], [x, yr, 0]]);
      height = yr;
      break;
    }
    case 'hip': {
      // the ridge runs along the longer side
      const long = hw >= hd;
      const m = hipFaces(long ? hw : hd, long ? hd : hw, tp, long ? Hx : Hz, long ? Hz : Hx, 0);
      for (const f of m.faces) slope(long ? f : f.map(swapXZ));
      height = m.top;
      break;
    }
    case 'gambrel': {
      const rb = 0.28 * hd;
      const tl = Math.tan(STEEP * DEG);
      const y1 = rb * tl;
      const yr = y1 + (hd - rb) * tp;
      const oL = Math.min(o, 0.25);
      const zL = hd + oL;
      const yE = -oL * tl;
      slope(
        [[-Hx, yE, zL], [Hx, yE, zL], [Hx, y1, hd - rb], [-Hx, y1, hd - rb]],
        [[-Hx, y1, hd - rb], [Hx, y1, hd - rb], [Hx, yr, 0], [-Hx, yr, 0]],
        [[Hx, yE, -zL], [-Hx, yE, -zL], [-Hx, y1, -(hd - rb)], [Hx, y1, -(hd - rb)]],
        [[Hx, y1, -(hd - rb)], [-Hx, y1, -(hd - rb)], [-Hx, yr, 0], [Hx, yr, 0]],
      );
      gable((x) => [[x, 0, -hd], [x, 0, hd], [x, y1, hd - rb], [x, yr, 0], [x, y1, -(hd - rb)]]);
      height = yr;
      break;
    }
    case 'mansard': {
      const rb = Math.min(0.28 * hd, 0.28 * hw);
      const tl = Math.tan(STEEP * DEG);
      const y1 = rb * tl;
      const oL = Math.min(o, 0.25);
      const X = hw + oL;
      const Z = hd + oL;
      const yE = -oL * tl;
      const ix = hw - rb;
      const iz = hd - rb;
      slope(
        [[-X, yE, Z], [X, yE, Z], [ix, y1, iz], [-ix, y1, iz]],
        [[X, yE, -Z], [-X, yE, -Z], [-ix, y1, -iz], [ix, y1, -iz]],
        [[-X, yE, -Z], [-X, yE, Z], [-ix, y1, iz], [-ix, y1, -iz]],
        [[X, yE, Z], [X, yE, -Z], [ix, y1, -iz], [ix, y1, iz]],
      );
      const long = ix >= iz;
      const m = hipFaces(long ? ix : iz, long ? iz : ix, tp, long ? ix : iz, long ? iz : ix, y1);
      for (const f of m.faces) slope(long ? f : f.map(swapXZ));
      height = m.top;
      break;
    }
  }

  if (r.chimney && r.kind !== 'flat') {
    const cx = -r.w * 0.22;
    const cz = r.kind === 'shed' ? 0 : -r.d * 0.12;
    blocks.push({ kind: 'chimney', x0: cx - 0.28, x1: cx + 0.28, y0: 0, y1: height + 0.9, z0: cz - 0.28, z1: cz + 0.28 });
    blocks.push({ kind: 'cap', x0: cx - 0.34, x1: cx + 0.34, y0: height + 0.9, y1: height + 0.96, z0: cz - 0.34, z1: cz + 0.34 });
  } else if (r.chimney) {
    blocks.push({ kind: 'chimney', x0: -r.w * 0.22 - 0.28, x1: -r.w * 0.22 + 0.28, y0: 0, y1: 1.1, z0: -0.28, z1: 0.28 });
    blocks.push({ kind: 'cap', x0: -r.w * 0.22 - 0.34, x1: -r.w * 0.22 + 0.34, y0: 1.1, y1: 1.16, z0: -0.34, z1: 0.34 });
  }
  return { faces, blocks, height };
}

/** Outward-pointing normal of a planar polygon (any vertex order gives the same line, so callers flip it as needed). */
export function faceNormal(pts: V3[]): V3 {
  let nx = 0, ny = 0, nz = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    nx += (a[1] - b[1]) * (a[2] + b[2]);
    ny += (a[2] - b[2]) * (a[0] + b[0]);
    nz += (a[0] - b[0]) * (a[1] + b[1]);
  }
  const len = Math.hypot(nx, ny, nz) || 1;
  return [nx / len, ny / len, nz / len];
}

// ---- the plan symbol -------------------------------------------------------------------------------------------------

export interface RoofPlan {
  /** Eave outline (footprint plus overhang), local coordinates, clockwise on screen. */
  outline: Point[];
  /** Footprint outline (the walls underneath). */
  footprint: Point[];
  /** Ridge, hip and break lines. */
  lines: [Point, Point][];
  /** Shed roofs: the direction the water runs, from the high edge to the low one. */
  fall: [Point, Point] | null;
}

const rect = (hx: number, hz: number): Point[] => [{ x: -hx, y: -hz }, { x: hx, y: -hz }, { x: hx, y: hz }, { x: -hx, y: hz }];

/** What the roof looks like on the plan: outline, ridge lines, hips. In the roof's own box, centered. */
export function roofPlan(r: Pick<Roof, 'kind' | 'w' | 'd' | 'pitch' | 'overhang'>): RoofPlan {
  const hw = r.w / 2;
  const hd = r.d / 2;
  const o = Math.max(0, r.overhang);
  const Hx = hw + o;
  const Hz = hd + o;
  const P = (x: number, y: number): Point => ({ x, y });
  const lines: [Point, Point][] = [];
  let fall: RoofPlan['fall'] = null;
  switch (r.kind) {
    case 'gable':
      lines.push([P(-Hx, 0), P(Hx, 0)]);
      break;
    case 'shed':
      fall = [P(0, -hd * 0.6), P(0, hd * 0.6)];
      break;
    case 'hip': {
      const long = hw >= hd;
      const a = long ? hw : hd;
      const b = long ? hd : hw;
      const L = a - b; // half the ridge length
      const Ha = long ? Hx : Hz;
      const Hb = long ? Hz : Hx;
      const m = (x: number, z: number): Point => (long ? P(x, z) : P(z, x));
      if (L > 1e-6) lines.push([m(-L, 0), m(L, 0)]);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) lines.push([m(sx * L, 0), m(sx * Ha, sz * Hb)]);
      break;
    }
    case 'gambrel': {
      const rb = 0.28 * hd;
      lines.push([P(-Hx, 0), P(Hx, 0)], [P(-Hx, hd - rb), P(Hx, hd - rb)], [P(-Hx, -(hd - rb)), P(Hx, -(hd - rb))]);
      break;
    }
    case 'mansard': {
      const rb = Math.min(0.28 * hd, 0.28 * hw);
      const ix = hw - rb;
      const iz = hd - rb;
      const X = hw + Math.min(o, 0.25);
      const Z = hd + Math.min(o, 0.25);
      const inner = rect(ix, iz);
      for (let i = 0; i < 4; i++) lines.push([inner[i], inner[(i + 1) % 4]]);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) lines.push([P(sx * ix, sz * iz), P(sx * X, sz * Z)]);
      const long = ix >= iz;
      const a = long ? ix : iz;
      const b = long ? iz : ix;
      const L = a - b;
      const m = (x: number, z: number): Point => (long ? P(x, z) : P(z, x));
      if (L > 1e-6) lines.push([m(-L, 0), m(L, 0)]);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) lines.push([m(sx * L, 0), m(sx * a, sz * b)]);
      break;
    }
    case 'flat':
      break;
  }
  return { outline: rect(r.kind === 'mansard' ? hw + Math.min(o, 0.25) : Hx, r.kind === 'mansard' ? hd + Math.min(o, 0.25) : Hz), footprint: rect(hw, hd), lines, fall };
}

// ---- fitting a roof to the walls ---------------------------------------------------------------------------------------

export interface RoofBox {
  x: number;
  y: number;
  w: number;
  d: number;
  rotation: number;
}

/** The smallest rotated rectangle around a set of points (searching the directions of the given angles). */
export function minAreaBox(pts: Point[], angles: number[]): RoofBox | null {
  if (!pts.length) return null;
  let best: (RoofBox & { area: number }) | null = null;
  for (const deg of angles) {
    const c = Math.cos(deg * DEG);
    const s = Math.sin(deg * DEG);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const p of pts) {
      const u = p.x * c + p.y * s;
      const v = -p.x * s + p.y * c;
      x0 = Math.min(x0, u); x1 = Math.max(x1, u); y0 = Math.min(y0, v); y1 = Math.max(y1, v);
    }
    const w = x1 - x0;
    const d = y1 - y0;
    const cu = (x0 + x1) / 2;
    const cv = (y0 + y1) / 2;
    const box = { x: cu * c - cv * s, y: cu * s + cv * c, w, d, rotation: deg, area: w * d };
    if (!best || box.area < best.area - 1e-6) best = box;
  }
  if (!best) return null;
  let { w, d, rotation } = best;
  // the ridge runs along the longer side
  if (d > w + 1e-6) {
    [w, d] = [d, w];
    rotation += 90;
  }
  rotation = ((Math.round(rotation * 10) / 10) % 180 + 180) % 180;
  const round = (v: number) => Math.round(v * 100) / 100;
  return { x: round(best.x), y: round(best.y), w: round(w), d: round(d), rotation };
}

/** A roof box that covers the walls of one floor (the outer walls if there are any). Null when the floor has no walls. */
export function fitRoofToWalls(d: Design, floor: string): RoofBox | null {
  const all = d.walls.filter((w) => w.floor === floor && w.type !== 'railing');
  const outer = all.filter((w) => w.type === 'exterior');
  const walls = outer.length >= 3 ? outer : all;
  if (!walls.length) return null;
  const pts = walls.flatMap(wallOutlinePoints);
  const angles = new Set<number>([0]);
  for (const w of walls) {
    const a = (Math.atan2(w.b.y - w.a.y, w.b.x - w.a.x) / DEG + 360) % 90;
    angles.add(Math.round(a * 10) / 10);
  }
  return minAreaBox(pts, [...angles]);
}

/** Height of the walls a roof sits on: the tallest real wall of that floor (a wall height of 2.5 m when there is none). */
export function roofBaseHeight(d: Design, floor: string): number {
  const hs = d.walls.filter((w) => w.floor === floor && w.type !== 'railing').map((w) => w.height);
  return hs.length ? Math.max(...hs) : 2.5;
}
