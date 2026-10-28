/**
 * 3D models of the neighbouring buildings (catalogSurroundings.ts): simple blocks with a roof and rows of windows. Same rules as furniture3d.ts
 * (item-local coordinates, the FRONT at +z, nothing outside the footprint by more than a few centimeters).
 */
import { shade } from '../catalog';
import { box, type Part } from './parts';
import type { Ctx } from './furniture3d';

type Recipe = (k: Ctx) => Part[];

const GLASS_DARK = '#33475b';
const ROOF = '#8b5e4b';

/** Rows of windows on the front and the back face (and the sides when asked): `floors` rows, about every `pitch` meters. */
function windows(hw: number, hd: number, floors: number, floorH: number, pitch: number, sides = false, w = 1.1, h = 1.3): Part[] {
  const out: Part[] = [];
  const nx = Math.max(1, Math.floor((2 * hw - 1.2) / pitch));
  for (let f = 0; f < floors; f++) {
    const y0 = f * floorH + 0.9;
    for (let i = 0; i < nx; i++) {
      const x = -hw + 0.6 + ((2 * hw - 1.2) * (i + 0.5)) / nx;
      out.push(box(x - w / 2, x + w / 2, y0, y0 + h, hd - 0.02, hd, GLASS_DARK), box(x - w / 2, x + w / 2, y0, y0 + h, -hd, -hd + 0.02, GLASS_DARK));
    }
    if (sides) {
      const nz = Math.max(1, Math.floor((2 * hd - 1.2) / pitch));
      for (let i = 0; i < nz; i++) {
        const z = -hd + 0.6 + ((2 * hd - 1.2) * (i + 0.5)) / nz;
        out.push(box(hw - 0.02, hw, y0, y0 + h, z - w / 2, z + w / 2, GLASS_DARK), box(-hw, -hw + 0.02, y0, y0 + h, z - w / 2, z + w / 2, GLASS_DARK));
      }
    }
  }
  return out;
}

/** A gabled roof over the whole footprint with its ridge along x, and the two triangular ends. */
function gabled(hw: number, hd: number, y0: number, rise: number, color: string, wall: string): Part[] {
  const up: [number, number, number] = [0, 1, 0];
  return [
    { t: 'panel', pts: [[-hw, y0, hd], [hw, y0, hd], [hw, y0 + rise, 0], [-hw, y0 + rise, 0]], thick: 0.15, facing: up, color },
    { t: 'panel', pts: [[hw, y0, -hd], [-hw, y0, -hd], [-hw, y0 + rise, 0], [hw, y0 + rise, 0]], thick: 0.15, facing: up, color },
    { t: 'panel', pts: [[-hw, y0, -hd], [-hw, y0, hd], [-hw, y0 + rise, 0]], thick: 0.1, facing: [-1, 0, 0], color: wall },
    { t: 'panel', pts: [[hw, y0, hd], [hw, y0, -hd], [hw, y0 + rise, 0]], thick: 0.1, facing: [1, 0, 0], color: wall },
  ];
}

const house: Recipe = ({ hw, hd, h, c }) => {
  const rise = Math.min(hd * 0.55, h * 0.3);
  const body = h - rise;
  const floorH = body / 2;
  return [
    box(-hw, hw, 0, body, -hd, hd, c), ...gabled(hw, hd, body, rise, ROOF, c),
    ...windows(hw, hd, 2, floorH, 2.6, true), box(-0.5, 0.5, 0, 2.1, hd - 0.03, hd, shade(c, -0.45)),
    box(hw * 0.45, hw * 0.45 + 0.7, body + rise * 0.15, body + rise * 0.15 + 0.7, -0.1, 0.1, shade(ROOF, -0.2)),
  ];
};

const modernHouse: Recipe = ({ hw, hd, h, c }) => {
  const floorH = (h - 0.4) / 2;
  return [
    box(-hw, hw, 0, h - 0.4, -hd, hd, c), box(-hw - 0.0, hw, h - 0.4, h, -hd, hd, shade(c, -0.25)),
    ...windows(hw, hd, 2, floorH, 3.2, true, 2.2, 1.9), box(-hw * 0.3, hw * 0.3, 0, 2.2, hd - 0.03, hd, shade(c, -0.5)),
    box(-hw, -hw * 0.3, floorH + 0.2, floorH + 0.3, hd - 0.4, hd, shade(c, -0.15)),
  ];
};

const terrace: Recipe = ({ hw, hd, h, c }) => {
  const rise = Math.min(hd * 0.5, h * 0.28);
  const body = h - rise;
  const n = Math.max(2, Math.round((2 * hw) / 4));
  const out: Part[] = [box(-hw, hw, 0, body, -hd, hd, c), ...gabled(hw, hd, body, rise, ROOF, c)];
  for (let i = 0; i < n; i++) {
    const x = -hw + (2 * hw * (i + 0.5)) / n;
    const colr = i % 2 ? shade(c, -0.06) : c;
    out.push(box(x - hw / n + 0.02, x + hw / n - 0.02, 0, body - 0.01, hd - 0.04, hd, colr));
    for (let f = 0; f < 2; f++) out.push(box(x + 0.4, x + 1.5, f * (body / 2) + 0.9, f * (body / 2) + 2.2, hd - 0.02, hd + 0.0, GLASS_DARK), box(x + 0.4, x + 1.5, f * (body / 2) + 0.9, f * (body / 2) + 2.2, -hd, -hd + 0.02, GLASS_DARK));
    out.push(box(x - 1.3, x - 0.4, 0, 2.1, hd - 0.03, hd, shade(c, -0.5)));
  }
  return out;
};

const apartments = (floorH: number): Recipe => ({ hw, hd, h, c }) => {
  const floors = Math.max(3, Math.round(h / floorH));
  const fh = (h - 0.3) / floors;
  return [box(-hw, hw, 0, h - 0.3, -hd, hd, c), box(-hw, hw, h - 0.3, h, -hd, hd, shade(c, -0.3)), ...windows(hw, hd, floors, fh, 2.2, true, 1.2, Math.min(1.5, fh * 0.55)), box(-1, 1, 0, 2.4, hd - 0.03, hd, shade(c, -0.5))];
};

const garage: Recipe = ({ hw, hd, h, c }) => [
  box(-hw, hw, 0, h - 0.5, -hd, hd, c), box(-hw, hw, h - 0.5, h, -hd, hd, shade(c, -0.3)), box(-hw + 0.2, hw - 0.2, 0, 2.2, hd - 0.03, hd, '#e7e5e4'),
  ...[0.5, 1.0, 1.5, 2.0].map((y) => box(-hw + 0.2, hw - 0.2, y, y + 0.02, hd - 0.04, hd, '#a8a29e')),
];

const boundaryWall: Recipe = ({ hw, hd, h, c }) => {
  const out: Part[] = [box(-hw, hw, 0, h, -hd, hd, c), box(-hw, hw, h, h + 0.05, -hd - 0.02, hd + 0.02, shade(c, -0.25))];
  const piers = Math.max(2, Math.round((2 * hw) / 3) + 1);
  for (let i = 0; i < piers; i++) {
    const x = -hw + 0.12 + ((2 * hw - 0.24) * i) / (piers - 1);
    out.push(box(x - 0.12, x + 0.12, 0, h + 0.12, -hd - 0.01, hd + 0.01, shade(c, -0.12)));
  }
  return out;
};

const fence: Recipe = ({ hw, hd, h, c }) => {
  const out: Part[] = [box(-hw, hw, 0.12, 0.2, -hd, hd, shade(c, -0.2)), box(-hw, hw, h - 0.3, h - 0.22, -hd, hd, shade(c, -0.2))];
  const n = Math.round((2 * hw) / 0.14);
  for (let i = 0; i < n; i++) {
    const x = -hw + (2 * hw * (i + 0.5)) / n;
    out.push(box(x - 0.05, x + 0.05, 0.08, h - 0.05 - (i % 2) * 0.04, -hd, hd, c));
  }
  return out;
};

export const SURROUNDINGS_RECIPES: Record<string, Recipe> = {
  'nb-house': house, 'nb-house-modern': modernHouse, 'nb-terrace': terrace, 'nb-block': apartments(3), 'nb-tower': apartments(3.2), 'nb-garage': garage, 'nb-wall': boundaryWall, 'nb-fence': fence,
};
