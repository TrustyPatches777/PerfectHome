/**
 * The horizon beyond the plot: a ring of far-away hills, mountains, city blocks or trees, or a sea that runs out to the edge of the world. Plain parts like
 * everything else in 3D, marked `sky` so that the viewer draws them unlit and out of the fog (they are hazy blue-grey by their colors, not by the fog),
 * and does not let them cast shadows. Deterministic: the same horizon always looks the same.
 */
import type { Horizon } from '../model';
import { mixHex } from '../sky';
import { ball, box, cyl, type Part } from './parts';

/** How far from the middle of the plot the horizon lies (meters). */
export const HORIZON_RADIUS = 470;

/** A small seeded random number generator (mulberry32), so the horizon is the same every time. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const sky = { sky: true } as const;

export function horizonParts(kind: Horizon, cx: number, cz: number): Part[] {
  if (kind === 'none') return [];
  const rand = rng(kind.length * 7919 + 13);
  const out: Part[] = [];
  const around = (n: number, radius: number, spread: number, make: (x: number, z: number, angle: number, i: number) => void) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + (rand() - 0.5) * (Math.PI / n);
      const r = radius + (rand() - 0.5) * spread;
      make(cx + Math.cos(a) * r, cz + Math.sin(a) * r, a, i);
    }
  };
  switch (kind) {
    case 'hills':
      around(26, HORIZON_RADIUS + 20, 60, (x, z, a, i) => {
        const w = 70 + rand() * 70;
        out.push(ball(x, 0, z, w, 22 + rand() * 38, w * (0.6 + rand() * 0.3), mixHex('#9bb7a0', '#b9cdb8', (i % 3) / 3), { ...sky, ...{} }));
        void a;
      });
      break;
    case 'mountains':
      around(15, HORIZON_RADIUS + 90, 80, (x, z, _a, i) => {
        const r = 100 + rand() * 90;
        const h = 130 + rand() * 170;
        const rock = mixHex('#7f8c9d', '#a3afbd', (i % 4) / 4);
        out.push(cyl(x, z, 0, h, r, rock, 0.02, sky), cyl(x, z, h * 0.62, h, r * 0.4, '#f1f5f9', 0.02, sky));
      });
      break;
    case 'city':
      around(110, HORIZON_RADIUS + 40, 70, (x, z, a, i) => {
        const w = 14 + rand() * 30;
        const h = 14 + rand() * rand() * 110;
        const col = mixHex('#a9b4c4', '#c5ced9', (i % 5) / 5);
        out.push({ ...box(x - w / 2, x + w / 2, 0, h, z - w / 2, z + w / 2, col, sky), ry: -a } as Part);
      });
      break;
    case 'forest':
      around(220, HORIZON_RADIUS - 60, 90, (x, z, _a, i) => {
        const r = 8 + rand() * 7;
        const h = 20 + rand() * 20;
        out.push(cyl(x, z, 0, h, r, mixHex('#476e4d', '#5f8a63', (i % 4) / 4), 0.5, sky));
      });
      break;
    case 'sea':
      // a disc that runs out to beyond the far plane, a little below the ground, lighter where it meets the sky
      out.push(cyl(cx, cz, -0.5, -0.4, 2600, '#7fb2d0', undefined, sky), cyl(cx, cz, -0.4, -0.35, 1200, '#6ea4c6', undefined, sky));
      break;
  }
  return out;
}
