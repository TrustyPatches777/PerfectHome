/**
 * 3D models of the furniture catalog: each item is a recipe that builds a few boxes, cylinders and balls in item-local
 * coordinates (x across, z deep with the BACK at -z, y up from the floor, origin in the middle of the footprint).
 * Items without a recipe become a plain box of their size and color, so a new catalog entry works immediately.
 * Models stay within their footprint (a few cm of overhang at most), which a unit test checks for every item.
 */
import { shade } from '../catalog';
import { ball, box, cyl, light, ring, rod, type Look, type Part } from './parts';

export interface Ctx {
  w: number;
  d: number;
  /** Height in meters (the catalog value or the user's override). */
  h: number;
  /** The item's color. */
  c: string;
  /** The item's second color, when it has one: the recipes then show their frame (wooden arm caps, a plinth). */
  c2?: string;
  hw: number;
  hd: number;
  /** Lamps: switched on. */
  on: boolean;
  /** Where the room's ceiling is, relative to the item's floor. */
  ceil: number;
}
type Recipe = (k: Ctx) => Part[];

const WOOD = '#a5835a';
const WOOD_L = '#c9a97c';
/** The colors of the parts that make up a piece's frame (legs, bed frames, table frames): a piece's second color replaces them. */
export const FRAME_COLORS: ReadonlySet<string> = new Set([WOOD, WOOD_L]);
const METAL = '#b8bec8';
const STEEL = '#8d96a3';
const BLK = '#1f2937';
const DARKM = '#4b5563';
const WHITE = '#f5f5f4';
const GLASS = '#bfe3f5';
const LEAF = '#4f9d5d';
const SOIL = '#6b4f3a';
const GLOW = '#fff0c2';

// ---- small shared pieces ---------------------------------------------------------------------------------

/** A table top on four legs. */
function table(x0: number, x1: number, z0: number, z1: number, h: number, top: string, legs = WOOD, thick = 0.04): Part[] {
  const t = 0.05;
  const inset = 0.05;
  return [
    box(x0, x1, h - thick, h, z0, z1, top),
    box(x0 + inset, x0 + inset + t, 0, h - thick, z0 + inset, z0 + inset + t, legs),
    box(x1 - inset - t, x1 - inset, 0, h - thick, z0 + inset, z0 + inset + t, legs),
    box(x0 + inset, x0 + inset + t, 0, h - thick, z1 - inset - t, z1 - inset, legs),
    box(x1 - inset - t, x1 - inset, 0, h - thick, z1 - inset - t, z1 - inset, legs),
  ];
}

/** Dining chair, backrest at -z, centered at the origin. */
function chair(c: string, s = 1): Part[] {
  const hw = 0.21 * s;
  const hd = 0.21 * s;
  const leg = 0.035;
  return [
    box(-hw, hw, 0.43, 0.48, -hd, hd, c),
    box(-hw, -hw + leg, 0, 0.43, -hd, -hd + leg, WOOD),
    box(hw - leg, hw, 0, 0.43, -hd, -hd + leg, WOOD),
    box(-hw, -hw + leg, 0, 0.43, hd - leg, hd, WOOD),
    box(hw - leg, hw, 0, 0.43, hd - leg, hd, WOOD),
    box(-hw, hw, 0.48, 0.9, -hd, -hd + 0.04, c),
  ];
}

/** Move a few parts built at the origin (rotating by quarter turns) — a tiny `place` for sub-assemblies. */
function at(parts: Part[], x: number, z: number, turns = 0): Part[] {
  const rot = (turns * Math.PI) / 2;
  const cs = Math.round(Math.cos(rot));
  const sn = Math.round(Math.sin(rot));
  return parts.map((p): Part => {
    if (p.t === 'prism' || p.t === 'light' || p.t === 'panel' || p.t === 'beam') return p;
    const nx = p.x * cs - p.z * sn + x;
    const nz = p.x * sn + p.z * cs + z;
    const moved = { ...p, x: nx, z: nz };
    return 'ry' in moved ? { ...moved, ry: moved.ry - rot } : moved;
  });
}

const handle = (x: number, y: number, z: number, vertical = false): Part => (vertical ? box(x - 0.01, x + 0.01, y - 0.07, y + 0.07, z, z + 0.025, STEEL) : box(x - 0.07, x + 0.07, y - 0.01, y + 0.01, z, z + 0.025, STEEL));

/** A pitched roof: two slabs meeting at a ridge along z, eaves `over` meters outside the walls. */
function gable(hw: number, hd: number, y0: number, tilt: number, color: string, thick: number, over: number, o: Partial<Look> = {}): Part[] {
  const run = hw + over;
  const len = run / Math.cos(tilt);
  const rise = run * Math.tan(tilt);
  const sz = 2 * hd + 2 * over;
  return [
    { t: 'box', x: -run / 2, y: y0 + rise / 2, z: 0, sx: len, sy: thick, sz, ry: 0, rz: tilt, color, ...o },
    { t: 'box', x: run / 2, y: y0 + rise / 2, z: 0, sx: len, sy: thick, sz, ry: 0, rz: -tilt, color, ...o },
  ];
}

const bookColors = ['#c0504d', '#4f81bd', '#9bbb59', '#f2c14e', '#8064a2', '#4bacc6', '#d9d9d9', '#e8884a'];

// ---- bedroom -----------------------------------------------------------------------------------------------

const bed = (kind: 'double' | 'single'): Recipe => ({ hw, hd, h, c }) => {
  const top = 0.28;
  const pillows = kind === 'single' ? [[-hw * 0.55, hw * 0.55]] : [[-hw + 0.1, -0.05], [0.05, hw - 0.1]];
  return [
    box(-hw, hw, 0.1, top, -hd, hd, WOOD),
    box(-hw + 0.03, hw - 0.03, top, top + 0.2, -hd + 0.05, hd - 0.03, WHITE),
    box(-hw + 0.01, hw - 0.01, top + 0.2, Math.max(h, top + 0.27), -hd + 0.55, hd - 0.01, c),
    ...pillows.map(([a, b]) => box(a, b, top + 0.2, top + 0.3, -hd + 0.1, -hd + 0.46, '#ffffff')),
    box(-hw, hw, 0.1, 1.0, -hd, -hd + 0.07, WOOD),
    box(-hw, -hw + 0.06, 0, 0.1, -hd, -hd + 0.06, WOOD),
    box(hw - 0.06, hw, 0, 0.1, -hd, -hd + 0.06, WOOD),
    box(-hw, -hw + 0.06, 0, 0.1, hd - 0.06, hd, WOOD),
    box(hw - 0.06, hw, 0, 0.1, hd - 0.06, hd, WOOD),
  ];
};

const bunk: Recipe = ({ hw, hd, c }) => {
  const posts = [[-hw, -hd], [hw - 0.06, -hd], [-hw, hd - 0.06], [hw - 0.06, hd - 0.06]].map(([x, z]) => box(x, x + 0.06, 0, 1.7, z, z + 0.06, WOOD));
  const rungs = [0.3, 0.6, 0.9, 1.2, 1.5].map((y) => box(hw - 0.05, hw, y, y + 0.03, hd - 0.5, hd - 0.1, WOOD));
  return [
    ...posts,
    box(-hw + 0.06, hw - 0.06, 0.28, 0.4, -hd + 0.06, hd - 0.06, WHITE),
    box(-hw + 0.06, hw - 0.06, 0.4, 0.47, -hd + 0.4, hd - 0.06, c),
    box(-hw + 0.06, hw - 0.06, 1.0, 1.12, -hd + 0.06, hd - 0.06, WHITE),
    box(-hw + 0.06, hw - 0.06, 1.12, 1.19, -hd + 0.4, hd - 0.06, c),
    box(-hw, -hw + 0.03, 1.12, 1.45, -hd, hd, WOOD),
    ...rungs,
  ];
};

const crib: Recipe = ({ hw, hd, c }) => {
  const bars: Part[] = [];
  for (let z = -hd + 0.1; z < hd - 0.05; z += 0.1) {
    bars.push(box(-hw, -hw + 0.02, 0.35, 0.95, z, z + 0.02, WOOD_L), box(hw - 0.02, hw, 0.35, 0.95, z, z + 0.02, WOOD_L));
  }
  return [
    box(-hw, hw, 0.28, 0.33, -hd, hd, WOOD_L),
    box(-hw + 0.03, hw - 0.03, 0.33, 0.43, -hd + 0.03, hd - 0.03, c),
    box(-hw, -hw + 0.04, 0, 1.0, -hd, -hd + 0.04, WOOD_L),
    box(hw - 0.04, hw, 0, 1.0, -hd, -hd + 0.04, WOOD_L),
    box(-hw, -hw + 0.04, 0, 1.0, hd - 0.04, hd, WOOD_L),
    box(hw - 0.04, hw, 0, 1.0, hd - 0.04, hd, WOOD_L),
    box(-hw, hw, 0.35, 1.0, -hd, -hd + 0.03, WOOD_L),
    box(-hw, hw, 0.35, 0.65, hd - 0.03, hd, WOOD_L),
    box(-hw, -hw + 0.02, 0.93, 0.97, -hd, hd, WOOD),
    box(hw - 0.02, hw, 0.93, 0.97, -hd, hd, WOOD),
    ...bars,
  ];
};

const cabinet = (seams: number, handles: 'v' | 'h' | 'none' = 'v'): Recipe => ({ hw, hd, h, c }) => {
  const out: Part[] = [box(-hw, hw, 0, h, -hd, hd, c)];
  const dark = shade(c, -0.3);
  for (let i = 1; i < seams; i++) out.push(box(-hw + (2 * hw * i) / seams - 0.004, -hw + (2 * hw * i) / seams + 0.004, 0.04, h - 0.04, hd, hd + 0.004, dark));
  if (handles === 'v') for (let i = 0; i < seams; i++) {
    const cx = -hw + (2 * hw * (i + 0.5)) / seams;
    out.push(handle(cx - (i % 2 ? -1 : 1) * 0.04, h * 0.5, hd, true));
  }
  return out;
};

const dresser: Recipe = ({ hw, hd, h, c }) => {
  const dark = shade(c, -0.3);
  const rows = 3;
  const out: Part[] = [box(-hw, hw, 0.06, h, -hd, hd, c), box(-hw, hw, h, h + 0.03, -hd - 0.02, hd + 0.02, shade(c, -0.12)), box(-hw + 0.04, hw - 0.04, 0, 0.06, -hd + 0.04, hd - 0.04, dark)];
  for (let i = 1; i < rows; i++) out.push(box(-hw, hw, 0.06 + ((h - 0.06) * i) / rows - 0.004, 0.06 + ((h - 0.06) * i) / rows + 0.004, hd, hd + 0.004, dark));
  for (let i = 0; i < rows; i++) out.push(handle(0, 0.06 + ((h - 0.06) * (i + 0.5)) / rows, hd));
  return out;
};

// ---- living ------------------------------------------------------------------------------------------------

const sofaOf = (seats: number): Recipe => ({ hw, hd, h, c, c2 }) => {
  const dark = shade(c, -0.18);
  const arm = Math.min(0.14, hw * 0.2);
  const out: Part[] = [
    box(-hw, hw, 0.08, 0.4, -hd, hd, dark),
    box(-hw, hw, 0.08, h, -hd, -hd + 0.2, dark),
    box(-hw, -hw + arm, 0.08, 0.62, -hd + 0.2, hd, dark),
    box(hw - arm, hw, 0.08, 0.62, -hd + 0.2, hd, dark),
  ];
  const span = 2 * (hw - arm) - 0.02;
  for (let i = 0; i < seats; i++) {
    const x0 = -hw + arm + 0.01 + (span * i) / seats;
    const x1 = x0 + span / seats - 0.02;
    out.push(box(x0, x1, 0.4, 0.5, -hd + 0.25, hd - 0.02, c), box(x0, x1, 0.5, h - 0.06, -hd + 0.2, -hd + 0.34, c));
  }
  // with a second color the sofa has a frame to show: wooden caps on the arms and the back, taller legs
  if (c2) out.push(box(-hw - 0.01, -hw + arm + 0.01, 0.62, 0.67, -hd + 0.2, hd + 0.01, WOOD), box(hw - arm - 0.01, hw + 0.01, 0.62, 0.67, -hd + 0.2, hd + 0.01, WOOD), box(-hw - 0.01, hw + 0.01, h, h + 0.05, -hd - 0.01, -hd + 0.21, WOOD));
  out.push(box(-hw + 0.05, -hw + 0.1, 0, 0.08, -hd + 0.05, -hd + 0.1, WOOD), box(hw - 0.1, hw - 0.05, 0, 0.08, -hd + 0.05, -hd + 0.1, WOOD), box(-hw + 0.05, -hw + 0.1, 0, 0.08, hd - 0.1, hd - 0.05, WOOD), box(hw - 0.1, hw - 0.05, 0, 0.08, hd - 0.1, hd - 0.05, WOOD));
  return out;
};

/** Mirror a model left to right (x -> -x). */
function mirrorX(parts: Part[]): Part[] {
  return parts.map((p) => (p.t === 'prism' || p.t === 'light' || p.t === 'panel' || p.t === 'beam' ? p : { ...p, x: -p.x, ...('ry' in p ? { ry: -p.ry } : {}) }));
}

/** The corner sofa as it is drawn on the plan: the chaise is at the LEFT end, at the front. */
const sofaL: Recipe = (k) => mirrorX(sofaLChaiseRight(k));

const sofaLChaiseRight: Recipe = (k) => {
  const { hw, hd, h, c } = k;
  const row = 0.95;
  const dark = shade(c, -0.18);
  const chaise = row;
  const out: Part[] = [
    box(-hw, hw, 0.08, 0.4, -hd, -hd + row, dark),
    box(hw - chaise, hw, 0.08, 0.4, -hd + row, hd, dark),
    box(-hw, hw, 0.08, h, -hd, -hd + 0.2, dark),
    box(-hw, -hw + 0.14, 0.08, 0.62, -hd + 0.2, -hd + row, dark),
    box(hw - 0.14, hw, 0.08, 0.62, -hd + row, hd, dark),
  ];
  const seatW = (2 * hw - chaise - 0.14) / 2;
  for (let i = 0; i < 2; i++) {
    const x0 = -hw + 0.14 + i * seatW;
    out.push(box(x0 + 0.01, x0 + seatW - 0.01, 0.4, 0.5, -hd + 0.25, -hd + row - 0.02, c), box(x0 + 0.01, x0 + seatW - 0.01, 0.5, h - 0.06, -hd + 0.2, -hd + 0.34, c));
  }
  out.push(box(hw - chaise + 0.01, hw - 0.14, 0.4, 0.5, -hd + row + 0.0, hd - 0.02, c), box(hw - chaise + 0.01, hw - 0.14, 0.4, 0.5, -hd + 0.25, -hd + row, c));
  return out;
};

const armchair: Recipe = ({ hw, hd, h, c, c2 }) => {
  const dark = shade(c, -0.18);
  return [
    ...(c2 ? [box(-hw - 0.01, -hw + 0.15, 0.62, 0.67, -hd + 0.2, hd + 0.01, WOOD), box(hw - 0.15, hw + 0.01, 0.62, 0.67, -hd + 0.2, hd + 0.01, WOOD), box(-hw - 0.01, hw + 0.01, h, h + 0.05, -hd - 0.01, -hd + 0.21, WOOD)] : []),
    box(-hw, hw, 0.1, 0.4, -hd, hd, dark),
    box(-hw, hw, 0.1, h, -hd, -hd + 0.2, dark),
    box(-hw, -hw + 0.14, 0.1, 0.62, -hd + 0.2, hd, dark),
    box(hw - 0.14, hw, 0.1, 0.62, -hd + 0.2, hd, dark),
    box(-hw + 0.15, hw - 0.15, 0.4, 0.5, -hd + 0.25, hd - 0.02, c),
    box(-hw + 0.15, hw - 0.15, 0.5, h - 0.08, -hd + 0.2, -hd + 0.34, c),
    box(-hw + 0.06, -hw + 0.1, 0, 0.1, -hd + 0.06, -hd + 0.1, WOOD), box(hw - 0.1, hw - 0.06, 0, 0.1, -hd + 0.06, -hd + 0.1, WOOD),
    box(-hw + 0.06, -hw + 0.1, 0, 0.1, hd - 0.1, hd - 0.06, WOOD), box(hw - 0.1, hw - 0.06, 0, 0.1, hd - 0.1, hd - 0.06, WOOD),
  ];
};

const coffeeTable: Recipe = ({ hw, hd, h, c }) => [...table(-hw, hw, -hd, hd, h, c), box(-hw + 0.08, hw - 0.08, 0.12, 0.15, -hd + 0.08, hd - 0.08, WOOD)];

const tvUnit: Recipe = ({ hw, hd, c }) => [
  box(-hw, hw, 0.12, 0.5, -hd, hd, c),
  box(-hw + 0.05, -hw + 0.1, 0, 0.12, -hd + 0.05, -hd + 0.1, BLK), box(hw - 0.1, hw - 0.05, 0, 0.12, -hd + 0.05, -hd + 0.1, BLK),
  box(-hw + 0.05, -hw + 0.1, 0, 0.12, hd - 0.1, hd - 0.05, BLK), box(hw - 0.1, hw - 0.05, 0, 0.12, hd - 0.1, hd - 0.05, BLK),
  box(-hw * 0.5, hw * 0.5, 0.55, 1.25, -hd * 0.3, -hd * 0.3 + 0.04, BLK),
  box(-0.12, 0.12, 0.5, 0.55, -hd * 0.5, -hd * 0.1, METAL),
  box(-hw * 0.5 + 0.02, hw * 0.5 - 0.02, 0.57, 1.23, -hd * 0.3 + 0.04, -hd * 0.3 + 0.045, '#334155'),
];

const bookshelf: Recipe = ({ hw, hd, h, c }) => {
  const out: Part[] = [box(-hw, -hw + 0.03, 0, h, -hd, hd, c), box(hw - 0.03, hw, 0, h, -hd, hd, c), box(-hw, hw, 0, h, -hd, -hd + 0.015, shade(c, -0.2))];
  const rows = Math.max(3, Math.round(h / 0.38));
  let n = 0;
  for (let r = 0; r <= rows; r++) {
    const y = (r * (h - 0.03)) / rows;
    out.push(box(-hw + 0.03, hw - 0.03, y, y + 0.03, -hd + 0.015, hd, c));
    if (r < rows && r % 2 === 0) {
      let x = -hw + 0.05;
      for (let i = 0; x < hw - 0.12; i++, n++) {
        const bw = 0.03 + ((n * 7) % 3) * 0.012;
        const bh = ((h - 0.03) / rows) * (0.62 + ((n * 5) % 4) * 0.08);
        out.push(box(x, x + bw, y + 0.03, y + 0.03 + bh, -hd + 0.05, hd - 0.04, bookColors[n % bookColors.length]));
        x += bw + 0.002;
      }
    }
  }
  return out;
};

const rug: Recipe = ({ hw, hd, c }) => [box(-hw, hw, 0, 0.012, -hd, hd, c), box(-hw + 0.1, hw - 0.1, 0.012, 0.016, -hd + 0.1, hd - 0.1, shade(c, 0.4))];

// ---- dining & kitchen -------------------------------------------------------------------------------------------

const diningTable: Recipe = ({ hw, hd, h, c }) => table(-hw, hw, -hd, hd, h, c);

const roundTable: Recipe = ({ hw, hd, h, c }) => [cyl(0, 0, h - 0.04, h, hw, c, undefined, { rz: hd }), cyl(0, 0, 0, h - 0.04, 0.06, WOOD), cyl(0, 0, 0, 0.04, hw * 0.45, WOOD, undefined, { rz: hd * 0.45 })];

const chairR: Recipe = ({ c }) => chair(c);

const diningSet = (perSide: number): Recipe => ({ hw, hd, h, c }) => {
  const tw = hw - 0.3;
  const out = table(-tw, tw, -hd + 0.5, hd - 0.5, h, c);
  const gap = (2 * tw) / perSide;
  for (let i = 0; i < perSide; i++) {
    const x = -tw + gap * (i + 0.5);
    out.push(...at(chair(shade(c, -0.12)), x, -hd + 0.24, 0), ...at(chair(shade(c, -0.12)), x, hd - 0.24, 2));
  }
  return out;
};

const fridge: Recipe = ({ hw, hd, h, c }) => {
  const dark = shade(c, -0.35);
  return [
    box(-hw, hw, 0, h, -hd, hd - 0.03, c),
    box(-hw, hw, 0.05, h - 0.02, hd - 0.03, hd, shade(c, 0.1)),
    box(-hw, hw, h * 0.62, h * 0.62 + 0.008, hd - 0.03, hd + 0.004, dark),
    box(hw - 0.12, hw - 0.1, h * 0.66, h * 0.92, hd, hd + 0.03, STEEL),
    box(hw - 0.12, hw - 0.1, h * 0.3, h * 0.58, hd, hd + 0.03, STEEL),
  ];
};

const stove: Recipe = ({ hw, hd, h, c }) => [
  box(-hw, hw, 0, h, -hd, hd, c),
  box(-hw, hw, h, h + 0.012, -hd, hd, BLK),
  ...[[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]].map(([a, b]) => cyl(a * hw * 0.9, b * hd * 0.9, h + 0.012, h + 0.02, Math.min(hw, hd) * 0.32, '#4b5563')),
  box(-hw + 0.05, hw - 0.05, h * 0.18, h * 0.62, hd, hd + 0.01, '#2b3441'),
  box(-hw + 0.08, hw - 0.08, h * 0.7, h * 0.7 + 0.02, hd, hd + 0.03, STEEL),
  ...[-0.3, -0.1, 0.1, 0.3].map((a) => cyl(a * hw * 1.4, hd + 0.01, h * 0.8 - 0.015, h * 0.8 + 0.015, 0.02, BLK, undefined)),
];

const counterTop = '#d6d3cd';
const counter: Recipe = ({ hw, hd, h, c }) => {
  const out: Part[] = [box(-hw, hw, 0.08, h - 0.04, -hd, hd - 0.01, c), box(-hw, hw, 0, 0.08, -hd + 0.03, hd - 0.04, BLK), box(-hw - 0.01, hw + 0.01, h - 0.04, h, -hd, hd + 0.02, counterTop)];
  const n = Math.max(1, Math.round((2 * hw) / 0.6));
  for (let i = 1; i < n; i++) out.push(box(-hw + (2 * hw * i) / n - 0.004, -hw + (2 * hw * i) / n + 0.004, 0.1, h - 0.06, hd - 0.01, hd + 0.0, shade(c, -0.3)));
  for (let i = 0; i < n; i++) out.push(handle(-hw + (2 * hw * (i + 0.5)) / n, h - 0.16, hd - 0.01));
  return out;
};

const kitchenSink: Recipe = (k) => [
  ...counter(k),
  box(-k.hw + 0.07, -0.03, k.h, k.h + 0.004, -k.hd + 0.08, k.hd - 0.08, STEEL),
  box(0.03, k.hw - 0.07, k.h, k.h + 0.004, -k.hd + 0.08, k.hd - 0.08, '#cfd5dd'),
  cyl(0, -k.hd + 0.07, k.h, k.h + 0.28, 0.015, STEEL),
  box(-0.015, 0.015, k.h + 0.26, k.h + 0.29, -k.hd + 0.07, -k.hd + 0.2, STEEL),
];

const island: Recipe = (k) => {
  const { hw, hd, h, c } = k;
  return [
    box(-hw, hw, 0.08, h - 0.04, -hd, hd - 0.35, c),
    box(-hw, hw, 0, 0.08, -hd + 0.03, hd - 0.38, BLK),
    box(-hw - 0.02, hw + 0.02, h - 0.04, h, -hd - 0.02, hd, counterTop),
    box(-hw + 0.1, -hw + 0.16, 0, h - 0.04, hd - 0.12, hd - 0.06, WOOD), box(hw - 0.16, hw - 0.1, 0, h - 0.04, hd - 0.12, hd - 0.06, WOOD),
  ];
};

const dishwasher: Recipe = ({ hw, hd, h, c }) => [
  box(-hw, hw, 0, h, -hd, hd - 0.02, c),
  box(-hw + 0.02, hw - 0.02, 0.03, h - 0.04, hd - 0.02, hd, STEEL),
  box(-hw + 0.05, hw - 0.05, h - 0.12, h - 0.1, hd, hd + 0.03, '#d1d5db'),
  box(-hw, hw, h - 0.04, h, -hd, hd, counterTop),
];

const desk: Recipe = ({ hw, hd, h, c }) => [
  box(-hw, hw, h - 0.04, h, -hd, hd, c),
  box(-hw + 0.04, -hw + 0.08, 0, h - 0.04, -hd + 0.04, hd - 0.04, WOOD),
  box(hw - 0.46, hw - 0.04, 0.05, h - 0.04, -hd + 0.04, hd - 0.04, shade(c, -0.1)),
  ...[0.2, 0.5, 0.8].map((f) => box(hw - 0.46, hw - 0.04, 0.05 + (h - 0.09) * (f - 0.18), 0.05 + (h - 0.09) * (f - 0.18) + 0.006, hd - 0.04, hd - 0.034, shade(c, -0.35))),
  box(-0.28, 0.1, h, h + 0.02, -hd + 0.18, -hd + 0.34, METAL),
  box(-0.26, 0.08, h + 0.02, h + 0.34, -hd + 0.2, -hd + 0.22, BLK),
  box(-0.2, 0.0, h, h + 0.012, -hd + 0.4, -hd + 0.52, '#d1d5db'),
];

const deskL: Recipe = (k) => {
  const { hw, hd, h, c } = k;
  const dep = 0.7;
  return [
    box(-hw, hw, h - 0.04, h, -hd, -hd + dep, c),
    box(hw - dep, hw, h - 0.04, h, -hd + dep, hd, c),
    box(-hw + 0.04, -hw + 0.08, 0, h - 0.04, -hd + 0.04, -hd + dep - 0.04, WOOD),
    box(hw - 0.08, hw - 0.04, 0, h - 0.04, hd - 0.08, hd - 0.04, WOOD),
    box(hw - 0.08, hw - 0.04, 0, h - 0.04, -hd + 0.04, -hd + 0.08, WOOD),
    box(-0.3, 0.1, h, h + 0.02, -hd + 0.2, -hd + 0.36, METAL),
    box(-0.28, 0.08, h + 0.02, h + 0.34, -hd + 0.22, -hd + 0.24, BLK),
  ];
};

const officeChair: Recipe = ({ c }) => [
  ...[0, 1, 2, 3, 4].map((i) => {
    const a = (i * 2 * Math.PI) / 5;
    return box(Math.cos(a) * 0.12 - 0.12, Math.cos(a) * 0.12 + 0.12, 0.03, 0.06, Math.sin(a) * 0.12 - 0.015, Math.sin(a) * 0.12 + 0.015, BLK);
  }),
  cyl(0, 0, 0.06, 0.45, 0.025, STEEL),
  box(-0.24, 0.24, 0.45, 0.52, -0.2, 0.24, c),
  box(-0.22, 0.22, 0.52, 0.98, -0.26, -0.2, c),
  box(-0.3, -0.26, 0.6, 0.66, -0.15, 0.1, BLK), box(0.26, 0.3, 0.6, 0.66, -0.15, 0.1, BLK),
];

const meetingTable: Recipe = ({ hw, hd, h, c }) => [box(-hw, hw, h - 0.05, h, -hd, hd, c), box(-hw * 0.7, -hw * 0.6, 0, h - 0.05, -hd * 0.6, hd * 0.6, DARKM), box(hw * 0.6, hw * 0.7, 0, h - 0.05, -hd * 0.6, hd * 0.6, DARKM)];

const filing: Recipe = ({ hw, hd, h, c }) => [
  box(-hw, hw, 0, h, -hd, hd, c),
  ...[0.2, 0.45, 0.7, 0.95].map((f, i) => (i < 3 ? box(-hw + 0.02, hw - 0.02, h * (f - 0.2) + 0.03, h * (f + 0.05) + 0.01, hd, hd + 0.005, shade(c, -0.25)) : handle(0, h * 0.83, hd))),
  handle(0, h * 0.17, hd), handle(0, h * 0.5, hd),
];

const printer: Recipe = ({ hw, hd, h, c }) => [box(-hw, hw, 0, h * 0.55, -hd, hd, c), box(-hw + 0.04, hw - 0.04, h * 0.55, h * 0.7, -hd + 0.04, hd - 0.04, shade(c, 0.2)), box(-hw + 0.06, hw - 0.06, h * 0.7, h * 0.75, -hd + 0.02, -hd + 0.2, WHITE)];

// ---- bathroom & utility ------------------------------------------------------------------------------------------

const toilet: Recipe = ({ hw, hd, c }) => [
  box(-hw * 0.8, hw * 0.8, 0.0, 0.8, -hd, -hd + 0.2, c),
  cyl(0, -hd + 0.45, 0, 0.3, 0.12, c, 0.17),
  ball(0, 0.4, -hd + 0.5, hw * 0.88, 0.1, hd * 0.52, c),
  ball(0, 0.47, -hd + 0.5, hw * 0.78, 0.025, hd * 0.44, '#ffffff'),
  cyl(hw * 0.35, -hd + 0.15, 0.8, 0.84, 0.025, STEEL),
];

const bidet: Recipe = ({ hw, hd, c }) => [
  box(-hw * 0.7, hw * 0.7, 0.0, 0.36, -hd, -hd * 0.62, c),
  cyl(0, hd * 0.15, 0, 0.3, hw * 0.5, c, hw * 0.7, { rz: hd * 0.45 }),
  ball(0, 0.38, hd * 0.15, hw * 0.95, 0.09, hd * 0.85, c),
  ball(0, 0.44, hd * 0.2, hw * 0.78, 0.02, hd * 0.68, '#dbe4ee'),
  cyl(0, -hd + 0.08, 0.36, 0.5, 0.014, STEEL), box(-0.012, 0.012, 0.48, 0.5, -hd + 0.08, -hd + 0.2, STEEL),
];

const bathSink: Recipe = ({ hw, hd, c }) => [
  cyl(0, -hd * 0.3, 0, 0.7, 0.07, c),
  box(-hw, hw, 0.76, 0.86, -hd, hd, c),
  box(-hw + 0.08, hw - 0.08, 0.86, 0.865, -hd + 0.08, hd - 0.08, '#dbe4ee'),
  cyl(0, -hd + 0.07, 0.86, 1.0, 0.014, STEEL),
  box(-0.012, 0.012, 0.98, 1.0, -hd + 0.07, -hd + 0.17, STEEL),
];

const bathtub: Recipe = ({ hw, hd, h, c }) => [
  box(-hw, hw, 0, h * 0.15, -hd, hd, c),
  box(-hw, hw, 0, h, -hd, -hd + 0.07, c), box(-hw, hw, 0, h, hd - 0.07, hd, c),
  box(-hw, -hw + 0.07, 0, h, -hd, hd, c), box(hw - 0.07, hw, 0, h, -hd, hd, c),
  box(-hw + 0.07, hw - 0.07, h * 0.15, h * 0.16 + 0.02, -hd + 0.07, hd - 0.07, '#cfe6f5'),
  cyl(-hw + 0.15, -hd + 0.02, h, h + 0.22, 0.014, STEEL),
];

const shower: Recipe = ({ hw, hd, c }) => [
  box(-hw, hw, 0, 0.07, -hd, hd, c),
  box(-hw, hw, 0.07, 2.0, hd - 0.02, hd, GLASS, { glass: true }),
  box(hw - 0.02, hw, 0.07, 2.0, -hd, hd, GLASS, { glass: true }),
  box(-hw, hw, 1.98, 2.02, hd - 0.03, hd, STEEL), box(hw - 0.03, hw, 1.98, 2.02, -hd, hd, STEEL),
  cyl(-hw + 0.12, -hd + 0.06, 0.07, 2.05, 0.012, STEEL),
  cyl(-hw + 0.12, -hd + 0.2, 2.02, 2.05, 0.09, STEEL),
];

const washer: Recipe = ({ hw, hd, h, c }) => [
  box(-hw, hw, 0, h, -hd, hd - 0.01, c),
  rod(0, h * 0.46, hd - 0.005, 0.03, hw * 0.62, 'z', '#2b3441'),
  rod(0, h * 0.46, hd + 0.005, 0.015, hw * 0.5, 'z', '#8fc3e6', { glass: true }),
  box(-hw + 0.04, hw - 0.04, h - 0.1, h - 0.03, hd - 0.01, hd + 0.006, '#dfe4ea'),
];

const waterHeater: Recipe = ({ hw, hd, h }) => [cyl(0, 0, 0.1, h, Math.min(hw, hd) * 0.92, WHITE), cyl(0, 0, 0, 0.1, Math.min(hw, hd) * 0.8, STEEL), cyl(0.12, 0, h, h + 0.1, 0.03, STEEL)];

const workbench: Recipe = ({ hw, hd, h }) => [
  box(-hw, hw, h - 0.06, h, -hd, hd, WOOD_L),
  box(-hw + 0.05, -hw + 0.1, 0, h - 0.06, -hd + 0.05, hd - 0.05, DARKM), box(hw - 0.1, hw - 0.05, 0, h - 0.06, -hd + 0.05, hd - 0.05, DARKM),
  box(-hw + 0.1, hw - 0.1, 0.2, 0.24, -hd + 0.05, hd - 0.05, WOOD),
  box(-hw + 0.1, hw - 0.1, 0.75, 0.9, -hd, -hd + 0.03, '#c9a97c'),
];

const shelving: Recipe = ({ hw, hd, h }) => {
  const out: Part[] = [];
  for (const [x, z] of [[-hw, -hd], [hw - 0.04, -hd], [-hw, hd - 0.04], [hw - 0.04, hd - 0.04]]) out.push(box(x, x + 0.04, 0, h, z, z + 0.04, STEEL));
  for (let i = 0; i < 5; i++) {
    const y = 0.1 + (i * (h - 0.14)) / 4;
    out.push(box(-hw, hw, y, y + 0.03, -hd, hd, METAL));
    if (i < 4) out.push(box(-hw + 0.1 + i * 0.05, -hw + 0.4 + i * 0.05, y + 0.03, y + 0.27, -hd + 0.06, hd - 0.06, bookColors[(i * 3) % 8]), box(0.1, 0.4, y + 0.03, y + 0.2, -hd + 0.06, hd - 0.1, WOOD_L));
  }
  return out;
};

const utilSink: Recipe = ({ hw, hd, h }) => [
  box(-hw, hw, 0.0, h * 0.4, -hd, hd, WHITE), box(-hw, hw, h * 0.4, h, -hd, hd, WHITE),
  box(-hw + 0.06, hw - 0.06, h, h + 0.004, -hd + 0.06, hd - 0.12, '#dbe4ee'),
  cyl(0, -hd + 0.05, h, h + 0.25, 0.015, STEEL), box(-0.012, 0.012, h + 0.23, h + 0.26, -hd + 0.05, -hd + 0.15, STEEL),
  box(-hw, -hw + 0.04, 0, 0.1, -hd, hd, DARKM), box(hw - 0.04, hw, 0, 0.1, -hd, hd, DARKM),
];

// ---- other living things ----------------------------------------------------------------------------------------

const fireplace: Recipe = ({ hw, hd, h, c }) => [
  box(-hw, hw, 0, 0.12, -hd, hd, shade(c, -0.3)),
  box(-hw, hw, 0.12, h, -hd, -hd + 0.3, c), box(-hw, -hw + 0.22, 0.12, h, -hd + 0.3, hd, c), box(hw - 0.22, hw, 0.12, h, -hd + 0.3, hd, c),
  box(-hw + 0.22, hw - 0.22, 0.12, 0.7, -hd + 0.3, -hd + 0.34, BLK),
  box(-hw - 0.01, hw + 0.01, h, h + 0.05, -hd - 0.01, hd + 0.03, WOOD),
  box(-hw + 0.22, hw - 0.22, 0.12, 0.7, -hd + 0.3, hd - 0.0, '#0f172a'),
  box(-hw + 0.3, hw - 0.3, 0.12, 0.3, -hd + 0.4, hd - 0.2, '#f59e0b', { glow: true }),
  box(-hw + 0.22, hw - 0.22, h - 0.1, h, hd - 0.02, hd, shade(c, -0.1)),
];

const piano: Recipe = ({ hw, hd, c }) => [
  box(-hw, hw, 0, 1.2, -hd, -hd + 0.4, BLK),
  box(-hw, hw, 0.58, 0.7, -hd + 0.4, hd - 0.1, BLK),
  box(-hw + 0.03, hw - 0.03, 0.7, 0.73, -hd + 0.4, hd - 0.12, WHITE),
  box(-hw, -hw + 0.06, 0, 0.7, -hd + 0.4, hd - 0.1, BLK), box(hw - 0.06, hw, 0, 0.7, -hd + 0.4, hd - 0.1, BLK),
  box(-0.3, 0.3, 0.28, 0.32, hd - 0.18, hd - 0.02, shade(c, -0.1)), box(-0.28, -0.24, 0, 0.28, hd - 0.16, hd - 0.12, STEEL), box(0.24, 0.28, 0, 0.28, hd - 0.16, hd - 0.12, STEEL),
];

const radiator: Recipe = ({ hw, hd }) => {
  const out: Part[] = [];
  const n = Math.max(4, Math.round((2 * hw) / 0.08));
  for (let i = 0; i < n; i++) out.push(box(-hw + (2 * hw * i) / n, -hw + (2 * hw * (i + 0.7)) / n, 0.15, 0.7, -hd, hd, WHITE));
  out.push(box(-hw, hw, 0.14, 0.17, -hd, hd, WHITE), box(-hw, hw, 0.68, 0.71, -hd, hd, WHITE));
  return out;
};

const aquarium: Recipe = ({ hw, hd, h, c }) => [
  box(-hw, hw, 0, 0.7, -hd, hd, shade(c, -0.4)),
  box(-hw, hw, 0.7, 0.74, -hd, hd, BLK),
  box(-hw + 0.02, hw - 0.02, 0.74, h, -hd + 0.02, hd - 0.02, '#7dc4e8', { glass: true }),
  box(-hw + 0.04, hw - 0.04, 0.74, 0.8, -hd + 0.04, hd - 0.04, '#e6d3a8'),
  ball(-0.2, 1.0, 0, 0.06, 0.03, 0.02, '#f59e0b'), ball(0.25, 1.1, 0.05, 0.05, 0.025, 0.02, '#ef4444'),
  cyl(0.3, -hd + 0.1, 0.8, 1.0, 0.03, LEAF),
];

const vanity: Recipe = ({ hw, hd, h, c }) => [...table(-hw, hw, -hd, hd, h, c), box(-hw + 0.1, hw - 0.1, 0.15, 0.45, -hd + 0.04, hd - 0.04, shade(c, -0.1)), box(-hw * 0.55, hw * 0.55, h + 0.1, h + 0.75, -hd + 0.01, -hd + 0.03, '#dbeafe', { glass: true })];

const pouf: Recipe = ({ hw, hd, h, c }) => [cyl(0, 0, 0, h, hw, c, hw * 0.92, { rz: hd }), cyl(0, 0, h, h + 0.04, hw * 0.88, shade(c, 0.2), undefined, { rz: hd * 0.88 })];

const sideTable: Recipe = ({ hw, hd, h, c }) => [cyl(0, 0, h - 0.035, h, hw, c, undefined, { rz: hd }), cyl(0, 0, 0.04, h - 0.035, 0.03, WOOD), cyl(0, 0, 0, 0.04, hw * 0.6, WOOD, undefined, { rz: hd * 0.6 })];

const plantRecipe: Recipe = ({ hw, hd, h, c }) => {
  const out: Part[] = [cyl(0, 0, 0, 0.28, Math.min(hw, hd) * 0.55, '#c2714f', Math.min(hw, hd) * 0.42), cyl(0, 0, 0.26, 0.285, Math.min(hw, hd) * 0.5, SOIL)];
  const top = Math.max(h, 0.6);
  for (let i = 0; i < 7; i++) {
    const a = (i * 2 * Math.PI) / 7;
    out.push(ball(Math.cos(a) * hw * 0.35, 0.28 + (top - 0.28) * (0.45 + 0.1 * (i % 3)), Math.sin(a) * hd * 0.35, 0.13, 0.22, 0.09, i % 2 ? c : shade(c, -0.2)));
  }
  out.push(ball(0, top - 0.1, 0, 0.14, 0.2, 0.14, c));
  return out;
};

// ---- lighting ------------------------------------------------------------------------------------------------------

const lamp = (build: (k: Ctx) => Part[], height: (k: Ctx) => number, strength = 1): Recipe => (k) => {
  const parts = build(k);
  if (!k.on) return parts.map((p) => ('glow' in p && p.glow ? { ...p, glow: false } : p));
  return [...parts, light(0, height(k), 0, GLOW, strength, 5)];
};

const lampCeiling = lamp(({ hw, hd, ceil }) => [cyl(0, 0, ceil - 0.07, ceil, Math.min(hw, hd), '#f4f1ea'), cyl(0, 0, ceil - 0.09, ceil - 0.07, Math.min(hw, hd) * 0.8, GLOW, undefined, { glow: true })], (k) => k.ceil - 0.2, 0.8);
const lampSpot = lamp(({ ceil }) => [cyl(0, 0, ceil - 0.05, ceil, 0.07, '#e5e7eb'), cyl(0, 0, ceil - 0.07, ceil - 0.05, 0.05, GLOW, undefined, { glow: true })], (k) => k.ceil - 0.2, 0.5);
const lampPendant = lamp(({ hw, ceil }) => [cyl(0, 0, ceil - 0.6, ceil, 0.006, BLK), cyl(0, 0, ceil - 0.78, ceil - 0.6, hw * 0.3, '#f4f1ea', hw), cyl(0, 0, ceil - 0.8, ceil - 0.78, hw * 0.9, GLOW, undefined, { glow: true })], (k) => k.ceil - 0.9, 0.9);
const lampChandelier = lamp(({ hw, ceil }) => [
  cyl(0, 0, ceil - 0.5, ceil, 0.012, BLK), ring(0, ceil - 0.52, 0, hw * 0.8, 0.014, 'y', '#d6b45e'),
  ...[0, 1, 2, 3, 4, 5].map((i) => ball(Math.cos((i * Math.PI) / 3) * hw * 0.8, ceil - 0.52, Math.sin((i * Math.PI) / 3) * hw * 0.8, 0.045, 0.06, 0.045, GLOW, { glow: true })),
], (k) => k.ceil - 0.7, 1.1);
const lampWall = lamp(({ hd }) => [box(-0.07, 0.07, 1.85, 2.0, -hd, -hd + 0.03, METAL), box(-0.06, 0.06, 1.88, 2.0, -hd + 0.03, -hd + 0.11, GLOW, { glow: true })], () => 1.9, 0.5);
const lampTable = lamp(({ hw, hd }) => [cyl(0, 0, 0, 0.03, hw * 0.55, '#6b7280', undefined, { rz: hd * 0.55 }), cyl(0, 0, 0.03, 0.24, 0.015, '#6b7280'), cyl(0, 0, 0.22, 0.42, hw * 0.55, GLOW, hw * 0.33, { rz: hd * 0.55, glow: true })], () => 0.4, 0.4);
const lampFloor = lamp(({ hw, hd, h }) => [cyl(0, 0, 0, 0.03, hw * 0.4, '#374151', undefined, { rz: hd * 0.4 }), cyl(0, 0, 0.03, h - 0.3, 0.015, '#374151'), cyl(0, 0, h - 0.35, h, hw * 0.4, GLOW, hw * 0.25, { rz: hd * 0.4, glow: true })], (k) => k.h - 0.2, 0.7);
const lampGarden = lamp(() => [cyl(0, 0, 0, 0.9, 0.025, '#374151'), cyl(0, 0, 0.9, 1.05, 0.1, GLOW, 0.04, { glow: true })], () => 1.0, 0.5);

// ---- electrical & plumbing (flat against the wall, back at -z) --------------------------------------------------------

const plate = (y: number, wd: number, ht: number, color = WHITE, depth = 0.02): Recipe => ({ hd }) => [box(-wd / 2, wd / 2, y, y + ht, -hd, -hd + depth, color)];

const socket = (n: number): Recipe => ({ hd }) => {
  const wd = n === 2 ? 0.16 : 0.09;
  const out: Part[] = [box(-wd / 2, wd / 2, 0.3, 0.38, -hd, -hd + 0.015, WHITE)];
  for (let i = 0; i < n; i++) out.push(cyl((i - (n - 1) / 2) * 0.07, -hd + 0.016, 0.33, 0.35, 0.02, '#d1d5db'));
  return out;
};

const tap: Recipe = ({ hd }) => [box(-0.04, 0.04, 0.95, 1.0, -hd, -hd + 0.06, METAL), box(-0.015, 0.015, 0.93, 0.97, -hd + 0.06, -hd + 0.2, METAL), box(-0.06, -0.03, 0.97, 1.02, -hd, -hd + 0.04, STEEL), box(0.03, 0.06, 0.97, 1.02, -hd, -hd + 0.04, STEEL)];

// ---- outdoors ----------------------------------------------------------------------------------------------------

const treeOf = (scale: number): Recipe => ({ hw, hd, h, c }) => {
  const trunk = Math.max(0.1, hw * 0.06);
  const canopy = shade(c, -0.1);
  const out: Part[] = [cyl(0, 0, 0, h * 0.45, trunk, '#7a5a3a', trunk * 0.7)];
  const cy = h * 0.68;
  out.push(ball(0, cy, 0, hw * 0.9, h * 0.3, hd * 0.9, c));
  const offs = [[0.45, -0.3, 0.1], [-0.4, 0.3, -0.05], [0.1, 0.5, 0.0], [-0.3, -0.45, 0.06], [0.35, 0.4, -0.08]];
  for (const [a, b, dy] of offs) out.push(ball(a * hw * scale, cy + dy * h, b * hd * scale, hw * 0.55, h * 0.2, hd * 0.55, canopy));
  return out;
};

const bush: Recipe = ({ hw, hd, h, c }) => [ball(0, h * 0.4, 0, hw * 0.95, h * 0.42, hd * 0.95, c), ball(hw * 0.3, h * 0.5, hd * 0.2, hw * 0.55, h * 0.4, hd * 0.55, shade(c, -0.15)), ball(-hw * 0.35, h * 0.45, -hd * 0.25, hw * 0.5, h * 0.35, hd * 0.5, shade(c, 0.1))];

const flowerPot: Recipe = ({ hw, hd, h }) => [cyl(0, 0, 0, h * 0.7, Math.min(hw, hd) * 0.7, '#c2714f', Math.min(hw, hd) * 0.55), cyl(0, 0, h * 0.68, h * 0.72, Math.min(hw, hd) * 0.64, SOIL), ball(0, h * 0.95, 0, hw * 0.45, h * 0.22, hd * 0.45, LEAF), ball(hw * 0.12, h * 1.05, hd * 0.1, 0.07, 0.07, 0.07, '#ec4899'), ball(-hw * 0.12, h * 1.0, -hd * 0.1, 0.07, 0.07, 0.07, '#f59e0b')];

const raisedBed: Recipe = ({ hw, hd, h }) => [
  box(-hw, hw, 0, h, -hd, -hd + 0.04, WOOD), box(-hw, hw, 0, h, hd - 0.04, hd, WOOD), box(-hw, -hw + 0.04, 0, h, -hd, hd, WOOD), box(hw - 0.04, hw, 0, h, -hd, hd, WOOD),
  box(-hw + 0.04, hw - 0.04, 0, h - 0.06, -hd + 0.04, hd - 0.04, SOIL),
  ...[-0.6, -0.2, 0.2, 0.6].map((f, i) => ball(f * hw, h + 0.08, (i % 2 ? 0.3 : -0.3) * hd, 0.12, 0.12, 0.12, i % 2 ? LEAF : '#7fb77e')),
];

const shed: Recipe = ({ hw, hd, h, c }) => [
  box(-hw, hw, 0, h, -hd, hd, c),
  ...gable(hw, hd, h, 0.22, '#6b7280', 0.05, 0.08),
  box(-0.4, 0.4, 0, 1.9, hd, hd + 0.03, shade(c, -0.25)),
  box(0.25, 0.3, 0.9, 1.0, hd + 0.03, hd + 0.06, STEEL),
];

const greenhouse: Recipe = ({ hw, hd, h }) => [
  box(-hw, hw, 0, 0.5, -hd, hd, '#e5e7eb'),
  box(-hw, hw, 0.5, h - 0.4, -hd + 0.015, -hd + 0.03, GLASS, { glass: true }), box(-hw, hw, 0.5, h - 0.4, hd - 0.03, hd - 0.015, GLASS, { glass: true }),
  box(-hw + 0.015, -hw + 0.03, 0.5, h - 0.4, -hd, hd, GLASS, { glass: true }), box(hw - 0.03, hw - 0.015, 0.5, h - 0.4, -hd, hd, GLASS, { glass: true }),
  ...gable(hw, hd, h - 0.4, 0.3, GLASS, 0.03, 0.0, { glass: true }),
  ...[-hw, 0, hw - 0.04].map((x) => box(x, x + 0.04, 0.5, h - 0.4, hd - 0.04, hd, WHITE)),
  box(-hw, hw, 0.5, 0.54, -hd, hd, WHITE),
  ...[-0.5, 0, 0.5].map((f) => ball(f * hw, 0.75, -hd * 0.5, 0.18, 0.22, 0.18, LEAF)),
];

const bbq: Recipe = ({ hw, hd, h }) => [
  box(-hw, hw, 0, 0.06, -hd, hd, BLK), box(-hw + 0.04, -hw + 0.08, 0.06, 0.75, -hd + 0.04, hd - 0.04, BLK), box(hw - 0.08, hw - 0.04, 0.06, 0.75, -hd + 0.04, hd - 0.04, BLK),
  box(-hw, hw, 0.75, h - 0.15, -hd, hd, '#374151'), box(-hw + 0.03, hw - 0.03, h - 0.15, h - 0.12, -hd, hd, '#4b5563'), box(hw - 0.15, hw - 0.1, h - 0.12, h, hd - 0.02, hd, METAL),
];

const patioSet: Recipe = ({ hw, hd, h, c }) => [
  cyl(0, 0, h - 0.04, h, 0.5, c, undefined), cyl(0, 0, 0, h - 0.04, 0.05, METAL), cyl(0, 0, 0, 0.03, 0.3, METAL),
  // every chair has its back to the outside and faces the table
  ...at(chair(shade(c, -0.1)), 0, -hd * 0.72, 0), ...at(chair(shade(c, -0.1)), 0, hd * 0.72, 2), ...at(chair(shade(c, -0.1)), -hw * 0.72, 0, 3), ...at(chair(shade(c, -0.1)), hw * 0.72, 0, 1),
];

const lounger: Recipe = ({ hw, hd, c }) => [
  box(-hw, hw, 0.18, 0.28, -hd + 0.65, hd, c), box(-hw + 0.02, -hw + 0.07, 0, 0.18, hd - 0.1, hd - 0.04, METAL), box(hw - 0.07, hw - 0.02, 0, 0.18, hd - 0.1, hd - 0.04, METAL),
  box(-hw + 0.02, -hw + 0.07, 0, 0.18, -hd + 0.65, -hd + 0.71, METAL), box(hw - 0.07, hw - 0.02, 0, 0.18, -hd + 0.65, -hd + 0.71, METAL),
  box(-hw, hw, 0.28, 0.38, -hd + 0.35, -hd + 0.65, c), box(-hw, hw, 0.38, 0.48, -hd + 0.2, -hd + 0.35, c), box(-hw, hw, 0.48, 0.58, -hd, -hd + 0.2, shade(c, -0.1)),
  box(-hw + 0.02, -hw + 0.07, 0, 0.28, -hd + 0.2, -hd + 0.26, METAL), box(hw - 0.07, hw - 0.02, 0, 0.28, -hd + 0.2, -hd + 0.26, METAL),
];

const parasol: Recipe = ({ hw, hd, h }) => [cyl(0, 0, 0, 0.05, 0.3, '#6b7280', undefined, { rz: 0.3 }), cyl(0, 0, 0.05, h, 0.025, '#cbd5e1'), cyl(0, 0, h - 0.4, h, hw, '#f4e6b0', 0.04, { rz: hd })];

const trampoline: Recipe = ({ hw, hd, h }) => [
  ring(0, 0.85, 0, hw - 0.04, 0.03, 'y', '#374151'), cyl(0, 0, 0.82, 0.86, hw - 0.1, '#1f2937', undefined, { rz: hd - 0.1 }),
  ...[0, 1, 2, 3, 4, 5].map((i) => cyl(Math.cos((i * Math.PI) / 3) * (hw - 0.05), Math.sin((i * Math.PI) / 3) * (hd - 0.05), 0, 0.85, 0.02, '#374151')),
  ...[0, 1, 2, 3, 4, 5].map((i) => cyl(Math.cos((i * Math.PI) / 3 + 0.5) * (hw - 0.05), Math.sin((i * Math.PI) / 3 + 0.5) * (hd - 0.05), 0.85, h, 0.012, '#2563eb')),
  ring(0, h, 0, hw - 0.04, 0.012, 'y', '#2563eb'),
];

const sandbox: Recipe = ({ hw, hd, h }) => [box(-hw, hw, 0, h, -hd, -hd + 0.06, WOOD), box(-hw, hw, 0, h, hd - 0.06, hd, WOOD), box(-hw, -hw + 0.06, 0, h, -hd, hd, WOOD), box(hw - 0.06, hw, 0, h, -hd, hd, WOOD), box(-hw + 0.06, hw - 0.06, 0, h - 0.05, -hd + 0.06, hd - 0.06, '#e6d3a8')];

/** How deep a swimming pool is (the ground is cut away under it, see build.ts). */
export const POOL_DEPTH = 1.5;

const pool: Recipe = ({ hw, hd }) => {
  const D = POOL_DEPTH;
  const tile = '#9fd3e6';
  const rim = '#e5e7eb';
  return [
    // a basin: floor, four walls, a rim of coping stones, and the water a little below the edge
    box(-hw, hw, -D - 0.1, -D, -hd, hd, tile),
    box(-hw, hw, -D, 0, -hd, -hd + 0.15, tile), box(-hw, hw, -D, 0, hd - 0.15, hd, tile), box(-hw, -hw + 0.15, -D, 0, -hd + 0.15, hd - 0.15, tile), box(hw - 0.15, hw, -D, 0, -hd + 0.15, hd - 0.15, tile),
    box(-hw - 0.05, hw + 0.05, 0, 0.06, -hd - 0.05, -hd + 0.22, rim), box(-hw - 0.05, hw + 0.05, 0, 0.06, hd - 0.22, hd + 0.05, rim), box(-hw - 0.05, -hw + 0.22, 0, 0.06, -hd + 0.22, hd - 0.22, rim), box(hw - 0.22, hw + 0.05, 0, 0.06, -hd + 0.22, hd - 0.22, rim),
    box(-hw + 0.15, hw - 0.15, -D + 0.05, -0.15, -hd + 0.15, hd - 0.15, '#4aa8d6', { glass: true }),
    // steps down at one end
    box(-hw + 0.15, -hw + 0.75, -0.9, -0.5, -hd + 0.15, hd - 0.15, tile), box(-hw + 0.15, -hw + 0.45, -0.5, -0.25, -hd + 0.15, hd - 0.15, tile),
  ];
};

/** A round tub on a plinth: a cabinet of wooden slats, a pale shell with a rounded rim, the water below the rim, a glowing light strip and a step to climb in by. */
const hotTub: Recipe = ({ hw, hd, h }) => {
  const R = Math.min(hw, hd) * 0.86;
  const cz = -(hd - R); // the step takes the rest of the box at the front
  const slats = 28;
  const out: Part[] = [
    cyl(0, cz, 0, 0.1, R - 0.03, '#3f3f46'),
    cyl(0, cz, 0.1, h - 0.2, R - 0.02, '#6f533a'),
    ring(0, h - 0.06, cz, R - 0.06, 0.08, 'y', '#f1f5f9'),
    cyl(0, cz, h - 0.5, h - 0.14, R - 0.1, '#dff1fb'),
    cyl(0, cz, h - 0.17, h - 0.12, R - 0.1, '#6cc4ea', undefined, { glass: true }),
    ring(0, 0.1, cz, R - 0.02, 0.012, 'y', '#7dd3fc', { glow: true }),
    // the control panel on the rim
    box(-0.12, 0.12, h - 0.03, h + 0.015, cz - R + 0.04, cz - R + 0.15, '#1f2937'),
    // the step
    box(-0.4, 0.4, 0, 0.22, cz + R - 0.05, hd, '#a5835a'), box(-0.4, 0.4, 0.22, 0.25, cz + R - 0.05, hd, '#c9a679'),
  ];
  for (let i = 0; i < slats; i++) {
    const a = (i * 2 * Math.PI) / slats;
    const r = R - 0.005;
    const part = box(-0.5, 0.5, 0.1, h - 0.1, -0.012, 0.012, i % 2 ? '#8a6a4a' : '#7a5c40');
    if (part.t === 'box') out.push({ ...part, x: Math.cos(a) * r, z: cz + Math.sin(a) * r, sx: ((2 * Math.PI * R) / slats) * 0.82, ry: Math.atan2(-Math.cos(a), -Math.sin(a)) });
  }
  return out;
};

const firePit: Recipe = ({ hw, hd }) => [cyl(0, 0, 0, 0.35, hw, '#6b7280', hw * 0.9, { rz: hd }), cyl(0, 0, 0.3, 0.36, hw * 0.8, '#1f2937', undefined, { rz: hd * 0.8 }), cyl(0, 0, 0.3, 0.7, 0.18, '#f97316', 0.02, { glow: true })];

const gardenBench: Recipe = ({ hw, hd, h }) => [
  box(-hw, hw, 0.42, 0.47, -hd + 0.1, hd, WOOD), box(-hw, hw, 0.6, h, -hd, -hd + 0.04, WOOD), box(-hw, hw, 0.76, 0.8, -hd, -hd + 0.04, WOOD),
  box(-hw + 0.05, -hw + 0.1, 0, 0.42, -hd + 0.12, hd - 0.05, DARKM), box(hw - 0.1, hw - 0.05, 0, 0.42, -hd + 0.12, hd - 0.05, DARKM), box(-hw + 0.05, -hw + 0.1, 0.42, h, -hd, -hd + 0.04, DARKM), box(hw - 0.1, hw - 0.05, 0.42, h, -hd, -hd + 0.04, DARKM),
];

const rainBarrel: Recipe = ({ hw, hd, h }) => [cyl(0, 0, 0, h, hw, '#3b6e8f', hw * 0.95, { rz: hd }), cyl(0, 0, h, h + 0.02, hw * 0.98, '#2d556f', undefined, { rz: hd * 0.98 })];

// ---- vehicles ------------------------------------------------------------------------------------------------------

const carOf = (cabinFrom: number, cabinTo: number, roof: number): Recipe => ({ hw, hd, c }) => {
  const wheelR = 0.32;
  const w = 2 * hw;
  const out: Part[] = [
    box(-hw, hw, 0.28, 0.82, -hd + 0.06, hd - 0.06, c),
    box(-hw + 0.1, hw - 0.05, 0.2, 0.3, -hd + 0.12, hd - 0.12, BLK),
    box(-hw + w * cabinFrom, -hw + w * cabinTo, 0.82, roof, -hd + 0.14, hd - 0.14, c),
    box(-hw + w * cabinFrom - 0.01, -hw + w * cabinTo + 0.01, 0.86, roof - 0.07, -hd + 0.12, -hd + 0.14, '#9fc5e0', { glass: true }),
    box(-hw + w * cabinFrom - 0.01, -hw + w * cabinTo + 0.01, 0.86, roof - 0.07, hd - 0.14, hd - 0.12, '#9fc5e0', { glass: true }),
    box(-hw + w * cabinTo - 0.01, -hw + w * cabinTo + 0.14, 0.84, roof - 0.04, -hd + 0.18, hd - 0.18, '#9fc5e0', { glass: true }),
    box(hw - 0.04, hw, 0.52, 0.66, -hd + 0.14, -hd + 0.4, '#fffbe0', { glow: true }), box(hw - 0.04, hw, 0.52, 0.66, hd - 0.4, hd - 0.14, '#fffbe0', { glow: true }),
    box(-hw, -hw + 0.04, 0.55, 0.68, -hd + 0.12, -hd + 0.4, '#dc2626'), box(-hw, -hw + 0.04, 0.55, 0.68, hd - 0.4, hd - 0.12, '#dc2626'),
  ];
  for (const [x, z] of [[-hw * 0.62, -hd + 0.08], [hw * 0.6, -hd + 0.08], [-hw * 0.62, hd - 0.08], [hw * 0.6, hd - 0.08]]) {
    out.push(rod(x, wheelR, z, 0.22, wheelR, 'z', '#111827'), rod(x, wheelR, z + (z < 0 ? -0.115 : 0.115), 0.01, wheelR * 0.55, 'z', '#cbd5e1'));
  }
  return out;
};

/**
 * A Porsche 911 Turbo: a low, wide body with swollen rear hips, a fastback roof with raked glass, a rear wing, wide wheels with
 * calipers, round headlights and a light bar across the tail. The front of the car is +x.
 */
const porsche: Recipe = ({ hw, hd, c }) => {
  const dark = '#111827';
  const glassC = '#1b2735';
  const out: Part[] = [
    // underbody, then a smooth body made of long ellipsoids: nose, middle, tail, and the hips over the rear wheels
    box(-hw + 0.4, hw - 0.5, 0.12, 0.2, -hd + 0.3, hd - 0.3, dark),
    ball(0, 0.44, 0, hw * 0.95, 0.24, hd * 0.9, c),
    ball(hw * 0.6, 0.43, 0, hw * 0.4, 0.17, hd * 0.8, c),
    ball(-hw * 0.5, 0.58, 0, hw * 0.5, 0.24, hd * 0.88, c),
    ball(-hw * 0.52, 0.55, hd - 0.28, 0.62, 0.26, 0.3, c), ball(-hw * 0.52, 0.55, -hd + 0.28, 0.62, 0.26, 0.3, c),
    ball(hw * 0.52, 0.52, hd - 0.26, 0.5, 0.22, 0.27, c), ball(hw * 0.52, 0.52, -hd + 0.26, 0.5, 0.22, 0.27, c),
    // the cabin: a dark glass canopy under a body-colored roof, sloping down to the tail
    ball(-0.15, 0.84, 0, 1.05, 0.34, 0.62, glassC),
    ball(-0.4, 0.98, 0, 0.82, 0.22, 0.55, c),
    ball(-1.15, 0.78, 0, 0.55, 0.16, 0.5, c),
    // front splitter and air intake
    box(hw - 0.2, hw - 0.02, 0.18, 0.4, -hd + 0.3, hd - 0.3, dark),
    box(hw - 0.35, hw - 0.18, 0.3, 0.38, -0.5, 0.5, '#374151'),
    // mirrors, side intakes
    box(0.35, 0.5, 0.78, 0.86, hd - 0.36, hd - 0.2, c), box(0.35, 0.5, 0.78, 0.86, -hd + 0.2, -hd + 0.36, c),
    box(-1.0, -0.5, 0.4, 0.58, hd - 0.2, hd - 0.12, dark), box(-1.0, -0.5, 0.4, 0.58, -hd + 0.12, -hd + 0.2, dark),
    // rear wing on two posts, light bar across the tail, exhausts
    box(-hw + 0.08, -hw + 0.52, 1.02, 1.07, -0.82, 0.82, dark), box(-hw + 0.22, -hw + 0.28, 0.74, 1.02, 0.5, 0.56, dark), box(-hw + 0.22, -hw + 0.28, 0.74, 1.02, -0.56, -0.5, dark),
    box(-hw + 0.02, -hw + 0.07, 0.62, 0.7, -0.75, 0.75, '#ef4444', { glow: true }),
    rod(-hw + 0.1, 0.3, 0.32, 0.2, 0.05, 'x', '#cbd5e1'), rod(-hw + 0.1, 0.3, -0.32, 0.2, 0.05, 'x', '#cbd5e1'),
    // round headlights
    rod(hw - 0.32, 0.6, 0.55, 0.12, 0.11, 'x', '#fff8d6', { glow: true }), rod(hw - 0.32, 0.6, -0.55, 0.12, 0.11, 'x', '#fff8d6', { glow: true }),
  ];
  // wheels: tyre, rim, brake disc and a red caliper (the rear ones wider)
  for (const [x, w] of [[hw * 0.56, 0.3], [-hw * 0.55, 0.36]] as const) {
    for (const sgn of [-1, 1]) {
      const z = sgn * (hd - 0.2);
      out.push(rod(x, 0.35, z, w, 0.35, 'z', '#0b0f14'), rod(x, 0.35, z + sgn * (w / 2 + 0.005), 0.02, 0.25, 'z', '#d1d5db'), rod(x, 0.35, z + sgn * (w / 2 + 0.012), 0.02, 0.1, 'z', '#6b7280'), rod(x, 0.35, z - sgn * 0.02, 0.04, 0.2, 'z', '#9ca3af'), box(x + 0.02, x + 0.16, 0.38, 0.5, z - sgn * 0.08, z - sgn * 0.02, '#dc2626'));
    }
  }
  return out;
};

const van: Recipe = ({ hw, hd, c }) => {
  const out = carOf(0.62, 0.9, 1.5)({ hw, hd, c } as Ctx);
  return [...out, box(-hw, hw * 0.4, 0.82, 2.0, -hd + 0.06, hd - 0.06, c)];
};

const motorbike: Recipe = ({ hw, c }) => [
  rod(-hw + 0.35, 0.33, 0, 0.12, 0.33, 'z', '#111827'), rod(hw - 0.35, 0.33, 0, 0.12, 0.33, 'z', '#111827'),
  box(-0.4, 0.5, 0.45, 0.62, -0.12, 0.12, c), box(-0.5, 0.0, 0.62, 0.72, -0.1, 0.1, '#1f2937'),
  box(hw - 0.5, hw - 0.4, 0.6, 1.0, -0.4, 0.4, METAL), box(hw - 0.6, hw - 0.4, 0.33, 0.9, -0.05, 0.05, METAL),
];

const bicycle: Recipe = ({ hw }) => [
  ring(-hw + 0.34, 0.34, 0, 0.32, 0.02, 'z', '#111827'), ring(hw - 0.34, 0.34, 0, 0.32, 0.02, 'z', '#111827'),
  box(-hw + 0.34, 0.1, 0.34, 0.38, -0.02, 0.02, '#ef4444'), box(0.1, hw - 0.34, 0.34, 0.38, -0.02, 0.02, '#ef4444'), box(-0.1, 0.1, 0.38, 0.88, -0.02, 0.02, '#ef4444'),
  box(-0.25, -0.05, 0.86, 0.9, -0.05, 0.05, BLK), box(hw - 0.34 - 0.05, hw - 0.34 + 0.05, 0.34, 0.95, -0.02, 0.02, '#ef4444'), box(hw - 0.4, hw - 0.28, 0.93, 0.97, -0.25, 0.25, BLK),
];

const parking: Recipe = ({ hw, hd, c }) => [box(-hw, hw, 0, 0.008, -hd, hd, c), box(-hw, hw, 0.008, 0.012, -hd, -hd + 0.07, WHITE), box(-hw, hw, 0.008, 0.012, hd - 0.07, hd, WHITE), box(hw - 0.07, hw, 0.008, 0.012, -hd, hd, WHITE)];

const bins: Recipe = ({ hw, hd, h }) => {
  const cols = ['#2f6f3e', '#2c5aa0', '#4b5563'];
  const lids = ['#3f9152', '#3b73c4', '#6b7280'];
  const n = hw > 0.5 ? 3 : 2;
  const step = (2 * hw) / n;
  const out: Part[] = [];
  for (let i = 0; i < n; i++) {
    const x = -hw + step * (i + 0.5);
    out.push(box(x - step * 0.4, x + step * 0.4, 0, h - 0.05, -hd + 0.05, hd - 0.05, cols[i % 3]), box(x - step * 0.43, x + step * 0.43, h - 0.05, h, -hd + 0.03, hd - 0.03, lids[i % 3]));
  }
  return out;
};

const evCharger: Recipe = ({ hw, hd }) => [box(-hw, hw, 0.0, 1.35, -hd, hd, WHITE), box(-hw + 0.04, hw - 0.04, 1.0, 1.25, hd - 0.0, hd + 0.01, '#1f2937'), box(-0.02, 0.02, 1.28, 1.32, hd - 0.02, hd, '#22c55e', { glow: true })];

const stairsItem: Recipe = ({ hw, hd, h }) => {
  const n = 12;
  const out: Part[] = [];
  for (let i = 0; i < n; i++) out.push(box(-hw, hw, 0, (h * (i + 1)) / n, hd - ((i + 1) * 2 * hd) / n, hd - (i * 2 * hd) / n, '#e5e7eb'));
  return out;
};

// ---- table of recipes -----------------------------------------------------------------------------------------------

export const RECIPES: Record<string, Recipe> = {
  'bed-double': bed('double'), 'bed-king': bed('double'), 'bed-single': bed('single'), 'bunk-bed': bunk, crib,
  bedside: cabinet(1, 'h'), wardrobe: cabinet(3, 'v'), dresser, vanity,
  sofa: sofaOf(3), loveseat: sofaOf(2), 'sofa-l': sofaL, armchair, 'coffee-table': coffeeTable, 'tv-unit': tvUnit, bookshelf, rug, sideboard: cabinet(3, 'v'),
  'dining-table': diningTable, 'table-round': roundTable, chair: chairR, 'bar-stool': ({ c }) => [cyl(0, 0, 0.7, 0.75, 0.17, c), cyl(0, 0, 0.03, 0.7, 0.02, STEEL), cyl(0, 0, 0, 0.03, 0.17, STEEL)],
  'dining-set-4': diningSet(2), 'dining-set-6': diningSet(3),
  fridge, stove, 'kitchen-sink': kitchenSink, counter, 'kitchen-island': island, dishwasher,
  desk, 'desk-l': deskL, 'office-chair': officeChair, 'meeting-table': meetingTable, 'filing-cabinet': filing, printer,
  toilet, bidet, 'bath-sink': bathSink, 'double-sink': bathSink, bathtub, shower, washer, dryer: washer, 'water-heater': waterHeater,
  workbench, 'utility-shelf': shelving, 'utility-sink': utilSink,
  fireplace, piano, radiator, aquarium, pouf, 'side-table': sideTable, plant: plantRecipe,
  'lamp-ceiling': lampCeiling, 'lamp-spot': lampSpot, 'lamp-pendant': lampPendant, 'lamp-chandelier': lampChandelier, 'lamp-wall': lampWall, 'lamp-table': lampTable, 'floor-lamp': lampFloor, 'lamp-garden': lampGarden,
  socket: socket(1), 'socket-double': socket(2), switch: plate(1.05, 0.08, 0.08), 'switch-dimmer': plate(1.05, 0.08, 0.08, '#e7e5e4'), 'data-point': plate(0.3, 0.08, 0.08, '#dbeafe'), 'tv-point': plate(1.0, 0.08, 0.08, '#e5e7eb'),
  thermostat: plate(1.5, 0.1, 0.1, '#f5f5f4', 0.03),
  'smoke-detector': ({ ceil }) => [cyl(0, 0, ceil - 0.04, ceil, 0.06, WHITE)],
  junction: ({ ceil }) => [box(-0.06, 0.06, ceil - 0.08, ceil, -0.06, 0.06, '#d1d5db')],
  tap, 'tap-garden': tap,
  drain: ({ hw }) => [cyl(0, 0, 0, 0.012, hw * 0.45, '#4b5563')],
  'water-meter': ({ hd }) => [rod(0, 1.0, -hd + 0.06, 0.12, 0.09, 'z', '#bfdbfe'), rod(0, 1.0, -hd + 0.13, 0.01, 0.06, 'z', WHITE)],
  'gas-point': ({ hd }) => [box(-0.05, 0.05, 0.95, 1.05, -hd, -hd + 0.05, '#fde047'), rod(0, 0.9, -hd + 0.03, 0.1, 0.015, 'z', STEEL)],
  'fuse-box': ({ hw, hd }) => [box(-hw, hw, 1.2, 1.7, -hd, hd, '#9ca3af'), box(-hw + 0.03, hw - 0.03, 1.23, 1.67, hd - 0.003, hd, '#d1d5db')],
  'pipe-stack': ({ hw, ceil }) => [cyl(0, 0, 0, ceil, hw * 0.45, '#9ca3af')],
  tree: treeOf(1), 'tree-small': treeOf(1), 'tree-large': treeOf(1.1), bush, 'flower-pot': flowerPot, 'raised-bed': raisedBed, shed, greenhouse, bbq,
  'patio-set': patioSet, lounger, parasol, trampoline, sandbox, pool, 'hot-tub': hotTub, 'fire-pit': firePit, 'garden-bench': gardenBench, 'rain-barrel': rainBarrel,
  car: carOf(0.18, 0.62, 1.38), porsche, 'car-small': carOf(0.2, 0.66, 1.36), suv: carOf(0.14, 0.7, 1.65), van, motorbike, bicycle, parking, bins, 'ev-charger': evCharger,
  stairs: stairsItem,
};

/** Catalog items whose model sits on top of whatever furniture stands under them (lamps and plants on tables). */
export const SITS_ON_FURNITURE = new Set(['lamp-table', 'plant', 'printer', 'aquarium']);

/** A plain block in the item's color: the model of anything without a recipe. */
function generic({ hw, hd, h, c }: Ctx): Part[] {
  return [box(-hw, hw, 0, h, -hd, hd, c), box(-hw, hw, h, h + 0.004, -hd, hd, shade(c, 0.25))];
}

/** Parts of one piece of furniture in item-local coordinates. `baseType` lets custom items borrow a catalog item's shape. */
export function furnitureParts(type: string, k: Ctx, custom?: { shape: string }): Part[] {
  if (custom && !RECIPES[type]) {
    const { hw, hd, h, c } = k;
    if (custom.shape === 'ellipse') return [cyl(0, 0, 0, h, hw, c, undefined, { rz: hd })];
    if (custom.shape === 'round') return [box(-hw, hw, 0, h, -hd, hd, c), box(-hw, hw, h, h + 0.004, -hd, hd, shade(c, 0.25))];
  }
  return (RECIPES[type] ?? generic)(k);
}
