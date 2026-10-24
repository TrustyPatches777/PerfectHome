/**
 * The 3D scene as plain data. Everything the 3D view shows is first turned into a list of simple solid shapes
 * ("parts"); the viewer (View3D.tsx) only turns parts into Three.js meshes. Keeping this layer pure means it can be tested
 * without a graphics card.
 *
 * Coordinates: the plan's x is x, the plan's y is z, and up is y (meters). Rotations are about the vertical axis, in
 * Three.js' sense (a plan rotation of +θ degrees clockwise is `ry = -θ`).
 */
import type { Point } from '../model';

export interface Look {
  color: string;
  /** See-through (windows, aquariums). */
  glass?: boolean;
  /** Light-emitting (lamps switched on). */
  glow?: boolean;
}

export type Part = Look &
  (
    | { t: 'box'; x: number; y: number; z: number; sx: number; sy: number; sz: number; ry: number; rz?: number }
    /** Cylinder or cone. (x,y,z) is the middle; `r` bottom radius, `rt` top radius, `rz` makes the base an ellipse (r across x, rz across z). */
    | { t: 'cyl'; x: number; y: number; z: number; r: number; rt?: number; rz?: number; h: number; ax?: 'x' | 'y' | 'z'; ry: number }
    /** Ellipsoid with radii sx, sy, sz. */
    | { t: 'ball'; x: number; y: number; z: number; sx: number; sy: number; sz: number; ry: number }
    /** Ring (tyre, trampoline frame). */
    | { t: 'ring'; x: number; y: number; z: number; R: number; tube: number; ax?: 'x' | 'y' | 'z'; ry: number }
    /** A flat outline (plan coordinates) extruded from height y0 to y1. `tex` paints a floor material on the top. */
    | { t: 'prism'; pts: Point[]; y0: number; y1: number; tex?: { kind: string; color: string } }
    /** A point light (a lamp that is switched on). */
    | { t: 'light'; x: number; y: number; z: number; intensity: number; dist: number }
  );

// ---- builders (all take local or world coordinates, whichever the caller works in) ----------------------

type Opt = Partial<Look>;

/** Box from extents. */
export const box = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, color: string, o: Opt = {}): Part => ({
  t: 'box', x: (x0 + x1) / 2, y: (y0 + y1) / 2, z: (z0 + z1) / 2, sx: Math.abs(x1 - x0), sy: Math.abs(y1 - y0), sz: Math.abs(z1 - z0), ry: 0, color, ...o,
});

/** Vertical cylinder (or cone, with `rt`) standing on y0. */
export const cyl = (x: number, z: number, y0: number, y1: number, r: number, color: string, rt?: number, o: Opt & { rz?: number } = {}): Part => ({
  t: 'cyl', x, y: (y0 + y1) / 2, z, r, rt, h: y1 - y0, ry: 0, color, ...o,
});

/** Cylinder lying along x or z. */
export const rod = (x: number, y: number, z: number, len: number, r: number, ax: 'x' | 'z', color: string, o: Opt = {}): Part => ({
  t: 'cyl', x, y, z, r, h: len, ax, ry: 0, color, ...o,
});

export const ball = (x: number, y: number, z: number, sx: number, sy: number, sz: number, color: string, o: Opt = {}): Part => ({ t: 'ball', x, y, z, sx, sy, sz, ry: 0, color, ...o });

export const ring = (x: number, y: number, z: number, R: number, tube: number, ax: 'x' | 'y' | 'z', color: string, o: Opt = {}): Part => ({ t: 'ring', x, y, z, R, tube, ax, ry: 0, color, ...o });

export const prism = (pts: Point[], y0: number, y1: number, color: string, tex?: { kind: string; color: string }, o: Opt = {}): Part => ({ t: 'prism', pts, y0, y1, color, tex, ...o });

export const light = (x: number, y: number, z: number, color: string, intensity: number, dist: number): Part => ({ t: 'light', x, y, z, intensity, dist, color });

/**
 * Move parts built around the origin (item-local: x across, z deep, y up from the floor) to their place:
 * rotated `rot` radians clockwise on the plan, then moved to plan position (px, pz) and lifted by `dy`.
 */
export function place(parts: Part[], px: number, pz: number, rot: number, dy = 0): Part[] {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  const at = (x: number, z: number) => ({ x: px + x * c - z * s, z: pz + x * s + z * c });
  return parts.map((p): Part => {
    if (p.t === 'prism') return { ...p, pts: p.pts.map((q) => ({ x: px + q.x * c - q.y * s, y: pz + q.x * s + q.y * c })), y0: p.y0 + dy, y1: p.y1 + dy };
    const w = at(p.x, p.z);
    const moved = { ...p, x: w.x, y: p.y + dy, z: w.z };
    return 'ry' in moved ? { ...moved, ry: moved.ry - rot } : moved;
  });
}

/** Extents of a part list on the plan and in height (for tests and camera framing). */
export function partsBounds(parts: Part[]) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
  const add = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) => {
    minX = Math.min(minX, x0); maxX = Math.max(maxX, x1); minY = Math.min(minY, y0); maxY = Math.max(maxY, y1); minZ = Math.min(minZ, z0); maxZ = Math.max(maxZ, z1);
  };
  for (const p of parts) {
    if (p.t === 'light') continue;
    if (p.t === 'prism') {
      for (const q of p.pts) add(q.x, q.x, p.y0, p.y1, q.y, q.y);
    } else if (p.t === 'box') {
      // box turned by ry: use the rotated half-extents
      const c = Math.abs(Math.cos(p.ry));
      const s = Math.abs(Math.sin(p.ry));
      const hx = (p.sx * c + p.sz * s) / 2;
      const hz = (p.sx * s + p.sz * c) / 2;
      add(p.x - hx, p.x + hx, p.y - p.sy / 2, p.y + p.sy / 2, p.z - hz, p.z + hz);
    } else {
      let ex: number, ey: number, ez: number;
      if (p.t === 'ball') [ex, ey, ez] = [p.sx, p.sy, p.sz];
      else if (p.t === 'ring') {
        // a ring is wide across its plane and thin along its axis
        const o = p.R + p.tube;
        const ax = p.ax ?? 'z';
        [ex, ey, ez] = [ax === 'x' ? p.tube : o, ax === 'y' ? p.tube : o, ax === 'z' ? p.tube : o];
      } else {
        const ax = p.ax ?? 'y';
        [ex, ey, ez] = ax === 'x' ? [p.h / 2, p.r, p.r] : ax === 'z' ? [p.r, p.r, p.h / 2] : [p.r, p.h / 2, p.rz ?? p.r];
      }
      const c = Math.abs(Math.cos(p.ry));
      const s = Math.abs(Math.sin(p.ry));
      add(p.x - (ex * c + ez * s), p.x + (ex * c + ez * s), p.y - ey, p.y + ey, p.z - (ex * s + ez * c), p.z + (ex * s + ez * c));
    }
  }
  return { minX, maxX, minY, maxY, minZ, maxZ };
}
