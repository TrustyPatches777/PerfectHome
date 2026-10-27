import { describe, expect, it } from 'vitest';
import { CATALOG, type CatalogItem } from '../catalog';
import { createDesign } from '../model';
import { furnitureChunk } from './build';
import type { Part } from './parts';

/**
 * The plan symbol and the 3D model of a catalog item must cover the same ground: a corner sofa whose chaise is on the left in
 * the plan must not have it on the right in 3D. Both are drawn on a grid (the item's box) and compared.
 */
const N = 32;

/** Cells covered by the 2D symbol (rectangles and ellipses; lines are ignored). */
function symbolGrid(item: CatalogItem): boolean[] {
  const grid = new Array<boolean>(N * N).fill(false);
  for (const s of item.shapes) {
    if (s.t === 'line' || s.fill === 'none') continue;
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const x = (i + 0.5) / N;
        const y = (j + 0.5) / N;
        if (s.t === 'rect' && x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) grid[j * N + i] = true;
        if (s.t === 'ellipse') {
          const rx = s.w / 2;
          const ry = s.h / 2;
          if (((x - s.x - rx) / rx) ** 2 + ((y - s.y - ry) / ry) ** 2 <= 1) grid[j * N + i] = true;
        }
      }
    }
  }
  return grid;
}

/** Cells covered by the 3D model seen from above. */
function modelGrid(parts: Part[], w: number, d: number): boolean[] {
  const grid = new Array<boolean>(N * N).fill(false);
  const mark = (inside: (x: number, z: number) => boolean) => {
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) if (inside(((i + 0.5) / N - 0.5) * w, ((j + 0.5) / N - 0.5) * d)) grid[j * N + i] = true;
  };
  for (const p of parts) {
    if (p.t === 'light' || p.t === 'prism' || p.t === 'panel') continue;
    if (p.t === 'box') {
      const c = Math.cos(p.ry);
      const s = Math.sin(p.ry);
      mark((x, z) => {
        const dx = x - p.x;
        const dz = z - p.z;
        return Math.abs(dx * c - dz * s) <= p.sx / 2 && Math.abs(dx * s + dz * c) <= p.sz / 2;
      });
    } else if (p.t === 'cyl') {
      const long = p.ax === 'x' ? p.h / 2 : p.ax === 'z' ? p.r : p.r;
      const deep = p.ax === 'z' ? p.h / 2 : p.ax === 'x' ? p.r : p.rz ?? p.r;
      mark((x, z) => ((x - p.x) / long) ** 2 + ((z - p.z) / deep) ** 2 <= 1);
    } else if (p.t === 'ball') {
      mark((x, z) => ((x - p.x) / p.sx) ** 2 + ((z - p.z) / p.sz) ** 2 <= 1);
    } else if (p.t === 'ring') {
      const R = p.R + p.tube;
      mark((x, z) => (p.ax === 'y' ? ((x - p.x) / R) ** 2 + ((z - p.z) / R) ** 2 <= 1 : Math.abs(x - p.x) <= R && Math.abs(z - p.z) <= p.tube));
    }
  }
  return grid;
}

const iou = (a: boolean[], b: boolean[]) => {
  let inter = 0;
  let union = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] && b[i]) inter++;
    if (a[i] || b[i]) union++;
  }
  return union ? inter / union : 1;
};

/**
 * Items whose plan symbol is only a small mark, a thin strip or something that hangs in the air do not describe the model's
 * footprint, so they are not compared (wall sockets, ceiling lamps ...).
 */
/** Plan symbols that only suggest the object (a bicycle's wheels are drawn as fat blobs, a plant as a disc): checked by eye, not by area. */
const SCHEMATIC = new Set(['bicycle', 'motorbike', 'floor-lamp', 'flower-pot', 'plant', 'parking']);

const SKIP = new Set(['socket', 'socket-double', 'switch', 'switch-dimmer', 'data-point', 'tv-point', 'thermostat', 'smoke-detector', 'junction', 'tap', 'tap-garden', 'drain', 'water-meter', 'gas-point', 'pipe-stack', 'fuse-box', 'lamp-wall', 'radiator']);

describe('plan symbol and 3D model of every catalog item cover the same ground', () => {
  const d = createDesign();
  const F = d.floors[0].id;
  for (const item of CATALOG) {
    if (SKIP.has(item.type) || SCHEMATIC.has(item.type) || item.layer === 'tech') continue;
    it(item.type, () => {
      const parts = furnitureChunk(d, { id: 'x', floor: F, type: item.type, x: 0, y: 0, w: item.w, d: item.d, rotation: 0, color: item.color, label: '' }, 0);
      const score = iou(symbolGrid(item), modelGrid(parts, item.w, item.d));
      expect(score, `${item.type}: plan and 3D footprints overlap only ${Math.round(score * 100)}%`).toBeGreaterThan(0.6);
    });
  }
});
