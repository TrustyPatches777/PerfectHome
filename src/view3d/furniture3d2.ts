/**
 * 3D models for the items of catalogMore.ts (kitchen runs and appliances, bedroom, living, bathroom, built-ins, garden, heating and cooling,
 * people and pets, window dressing). Same rules as furniture3d.ts: item-local coordinates, the BACK at -z, y up from the floor, the origin in
 * the middle of the footprint, and nothing outside the footprint by more than a few centimeters.
 */
import { shade } from '../catalog';
import { ball, beam, box, cyl, ring, rod, type Part } from './parts';
import type { Ctx } from './furniture3d';

type Recipe = (k: Ctx) => Part[];

const WOOD = '#a5835a';
const WOOD_L = '#c9a97c';
const METAL = '#b8bec8';
const STEEL = '#8d96a3';
const BLK = '#1f2937';
const DARKM = '#4b5563';
const WHITE = '#f5f5f4';
const GLASS = '#bfe3f5';
const TOP = '#d6d3cd';
const SKIN = '#e0b99a';

/** Appliances that stand on a worktop: the viewer lifts them onto whatever furniture is under them. */
export const COUNTERTOP = ['cooktop', 'microwave', 'coffee-machine', 'rice-cooker', 'thermomix', 'kettle', 'toaster', 'air-fryer', 'stand-mixer'];

const handleH = (x: number, y: number, z: number, len = 0.14): Part => box(x - len / 2, x + len / 2, y - 0.01, y + 0.01, z, z + 0.025, STEEL);
const handleV = (x: number, y: number, z: number, len = 0.14): Part => box(x - 0.01, x + 0.01, y - len / 2, y + len / 2, z, z + 0.025, STEEL);
const seamV = (x: number, y0: number, y1: number, z: number, c: string): Part => box(x - 0.004, x + 0.004, y0, y1, z, z + 0.004, shade(c, -0.3));
const seamH = (y: number, x0: number, x1: number, z: number, c: string): Part => box(x0, x1, y - 0.004, y + 0.004, z, z + 0.004, shade(c, -0.3));

/** Doors across a front: seams between them and a handle on each. */
function doorsFront(hw: number, hd: number, y0: number, y1: number, c: string, per = 0.6, handle: 'v' | 'h' = 'v', hy = (y0 + y1) / 2): Part[] {
  const n = Math.max(1, Math.round((2 * hw) / per));
  const out: Part[] = [];
  for (let i = 1; i < n; i++) out.push(seamV(-hw + (2 * hw * i) / n, y0, y1, hd, c));
  for (let i = 0; i < n; i++) out.push((handle === 'v' ? handleV : handleH)(-hw + (2 * hw * (i + 0.5)) / n + (n > 1 ? (i % 2 ? -0.18 : 0.18) * Math.min(1, per / 0.6) : 0), hy, hd - 0.003));
  return out;
}

// ---- kitchen runs ---------------------------------------------------------------------------------------------------

/** A base unit (or a run of them): plinth, carcass, doors or drawers, a worktop. */
const baseUnit = (kind: 'doors' | 'drawers' | 'hob' | 'sink'): Recipe => ({ hw, hd, h, c }) => {
  const out: Part[] = [box(-hw, hw, 0.08, h - 0.04, -hd, hd - 0.01, c), box(-hw, hw, 0, 0.08, -hd + 0.03, hd - 0.04, BLK), box(-hw, hw, h - 0.04, h, -hd, hd, TOP)];
  if (kind === 'drawers') {
    for (const f of [1, 2]) out.push(seamH(0.08 + ((h - 0.12) * f) / 3, -hw, hw, hd - 0.01, c));
    for (let i = 0; i < 3; i++) out.push(handleH(0, 0.08 + ((h - 0.12) * (i + 0.8)) / 3, hd - 0.012, Math.min(0.3, hw)));
  } else out.push(...doorsFront(hw, hd - 0.01, 0.1, h - 0.06, c, 0.6, kind === 'sink' ? 'v' : 'h', h - 0.16));
  if (kind === 'hob') {
    out.push(box(-hw + 0.04, hw - 0.04, h, h + 0.008, -hd + 0.04, hd - 0.06, '#111827'));
    for (const [x, z] of [[-0.14, -0.13], [0.14, -0.13], [-0.14, 0.13], [0.14, 0.13]]) out.push(ring(x * (hw / 0.3), h + 0.012, z * (hd / 0.3), 0.07, 0.005, 'y', '#9ca3af'));
  }
  if (kind === 'sink') {
    out.push(box(-hw + 0.07, -hw + 0.07 + hw * 0.65, h - 0.01, h + 0.002, -hd + 0.07, hd - 0.1, STEEL), box(-hw + 0.07 + hw * 0.7, hw - 0.28, h - 0.01, h + 0.002, -hd + 0.07, hd - 0.1, '#cbd5e1'));
    out.push(cyl(hw - 0.15, -hd + 0.05, h, h + 0.22, 0.012, STEEL), box(hw - 0.15 - 0.01, hw - 0.15 + 0.01, h + 0.2, h + 0.22, -hd + 0.05, -hd + 0.2, STEEL));
  }
  return out;
};

/** A corner unit: two arms at right angles (the back arm full width, the side arm along the left edge). */
const cornerOf = (y0: number, wall: boolean): Recipe => ({ hw, hd, h, c }) => {
  const a = (4 * hw) / 3; // depth of an arm = two thirds of the footprint
  const out: Part[] = [];
  if (!wall) {
    out.push(box(-hw, hw, y0 + 0.08, y0 + h - 0.04, -hd, -hd + a, c), box(-hw, -hw + a, y0 + 0.08, y0 + h - 0.04, -hd + a, hd - 0.01, c));
    out.push(box(-hw, hw, y0, y0 + 0.08, -hd + 0.03, -hd + a - 0.03, BLK), box(-hw, -hw + a, y0, y0 + 0.08, -hd + a, hd - 0.04, BLK));
    out.push(box(-hw, hw, y0 + h - 0.04, y0 + h, -hd, -hd + a, TOP), box(-hw, -hw + a, y0 + h - 0.04, y0 + h, -hd + a, hd, TOP));
    out.push(seamV(-hw + a / 2, y0 + 0.1, y0 + h - 0.06, hd - 0.01, c), handleH(-hw + a * 0.25, y0 + h - 0.16, hd - 0.013), handleH(-hw + a * 0.75, y0 + h - 0.16, hd - 0.013));
    out.push(box(-hw + a, hw, y0 + 0.1, y0 + h - 0.06, -hd + a, -hd + a + 0.004, shade(c, -0.3)));
  } else {
    out.push(box(-hw, hw, y0, y0 + h, -hd, -hd + a * 0.58, c), box(-hw, -hw + a * 0.58, y0, y0 + h, -hd + a * 0.58, hd, c));
    out.push(handleV(-hw + a * 0.29, y0 + 0.1, hd - 0.003), handleV(-hw + a * 0.58 + 0.1, y0 + 0.1, -hd + a * 0.58 - 0.003));
  }
  return out;
};

const wallUnit: Recipe = ({ hw, hd, h, c }) => {
  const y0 = 1.45;
  return [box(-hw, hw, y0, y0 + h, -hd, hd, c), ...doorsFront(hw, hd, y0 + 0.04, y0 + h - 0.04, c, 0.45, 'v', y0 + 0.12)];
};

const tallUnit: Recipe = ({ hw, hd, h, c }) => [
  box(-hw, hw, 0, h, -hd, hd - 0.01, c),
  seamH(1.0, -hw, hw, hd - 0.01, c), seamV(0, 1.0, h - 0.04, hd - 0.01, c),
  handleV(-0.05, 1.5, hd - 0.012), handleV(0.05, 1.5, hd - 0.012), handleV(0, 0.6, hd - 0.012, 0.3),
];

const rangeHood: Recipe = ({ hw, hd, c, ceil }) => [
  box(-hw, hw, 1.55, 1.7, -hd, hd, c),
  box(-hw * 0.5, hw * 0.5, 1.7, Math.max(1.8, ceil), -hd, -hd + 0.28, shade(c, 0.1)),
  box(-hw + 0.04, hw - 0.04, 1.54, 1.55, -hd + 0.05, hd - 0.05, '#fff0c2', { glow: true }),
  box(-hw * 0.4, hw * 0.4, 1.6, 1.64, hd - 0.003, hd + 0.003, BLK),
];

const ovenTower: Recipe = ({ hw, hd, h, c }) => [
  box(-hw, hw, 0, h, -hd, hd - 0.01, c),
  box(-hw + 0.03, hw - 0.03, 0.82, 1.4, hd - 0.012, hd, BLK), box(-hw + 0.08, hw - 0.08, 0.9, 1.3, hd - 0.012, hd + 0.004, '#0b1220', { glass: true }),
  rod(0, 1.36, hd + 0.03, 2 * hw - 0.14, 0.012, 'x', STEEL),
  box(-hw + 0.03, hw - 0.03, 1.5, 1.88, hd - 0.012, hd, BLK), box(-hw + 0.08, hw - 0.18, 1.55, 1.82, hd - 0.012, hd + 0.004, '#0b1220', { glass: true }),
  box(-hw + 0.04, hw - 0.04, 0.1, 0.26, hd - 0.012, hd, DARKM), handleH(0, 0.2, hd - 0.003, 0.3),
  box(-hw, hw, 0, 0.08, -hd, hd - 0.04, BLK),
];

const rangeCooker: Recipe = ({ hw, hd, h, c }) => {
  const out: Part[] = [
    box(-hw, hw, 0.05, h - 0.03, -hd, hd - 0.01, c), box(-hw + 0.02, hw - 0.02, 0, 0.05, -hd + 0.03, hd - 0.04, BLK),
    box(-hw, hw, h - 0.03, h, -hd, hd - 0.02, '#111827'),
    box(-hw + 0.06, hw - 0.06, 0.2, 0.68, hd - 0.012, hd, '#0b1220', { glass: true }), rod(0, 0.74, hd + 0.03, 2 * hw - 0.2, 0.012, 'x', STEEL),
    box(-hw, hw, h, h + 0.1, -hd, -hd + 0.03, c),
  ];
  for (const [x, z, r] of [[-0.3, -0.12, 0.09], [0, -0.12, 0.09], [0.3, -0.12, 0.09], [-0.15, 0.12, 0.07], [0.15, 0.12, 0.07]]) out.push(ring(x * (hw / 0.45), h + 0.012, z * (hd / 0.325), r, 0.006, 'y', '#9ca3af'));
  for (let i = 0; i < 5; i++) out.push(cyl(-hw + 0.1 + (i * (2 * hw - 0.2)) / 4, hd - 0.01, 0.8, 0.84, 0.018, DARKM, undefined, { }));
  return out;
};

// ---- things on a worktop --------------------------------------------------------------------------------------------

const cooktop: Recipe = ({ hw, hd }) => {
  const out: Part[] = [box(-hw, hw, 0, 0.015, -hd, hd, '#111827')];
  for (const [x, z] of [[-0.14, -0.1], [0.14, -0.1], [-0.14, 0.1], [0.14, 0.1]]) out.push(ring(x * (hw / 0.3), 0.017, z * (hd / 0.26), 0.07, 0.004, 'y', '#9ca3af'));
  return out;
};

const microwave: Recipe = ({ hw, hd, h }) => [
  box(-hw, hw, 0, h, -hd, hd, '#d1d5db'),
  box(-hw + 0.03, hw - 0.14, 0.04, h - 0.04, hd - 0.004, hd + 0.004, '#0b1220', { glass: true }),
  box(hw - 0.12, hw - 0.04, 0.04, h - 0.04, hd - 0.004, hd + 0.004, '#9ca3af'), box(hw - 0.1, hw - 0.06, h - 0.1, h - 0.06, hd + 0.004, hd + 0.008, '#22c55e', { glow: true }),
  box(hw - 0.145, hw - 0.135, 0.08, h - 0.08, hd, hd + 0.02, STEEL),
];

const coffeeMachine: Recipe = ({ hw, hd, h, c }) => [
  box(-hw, hw, 0, 0.04, -hd, hd, BLK), box(-hw, hw, 0.04, h, -hd, -hd + 0.14, c), box(-hw, hw, h - 0.12, h, -hd, 0, c),
  cyl(0, hd * 0.25, 0.04, 0.2, 0.05, GLASS, undefined, { glass: true }), box(-0.02, 0.02, 0.2, h - 0.12, hd * 0.25 - 0.02, hd * 0.25 + 0.02, BLK),
  cyl(-hw * 0.5, -hd * 0.2, h - 0.04, h - 0.02, 0.012, '#ef4444', undefined, { glow: true }),
];

const riceCooker: Recipe = ({ hw, hd, h, c }) => [
  cyl(0, 0, 0, h * 0.7, Math.min(hw, hd), c), ball(0, h * 0.7, 0, Math.min(hw, hd) * 0.98, h * 0.3, Math.min(hw, hd) * 0.98, shade(c, 0.1)),
  box(-0.025, 0.025, h * 0.4, h * 0.55, hd - 0.012, hd + 0.003, DARKM), box(-0.02, 0.02, h * 0.95, h, -0.02, 0.02, DARKM),
];

const thermomix: Recipe = ({ hw, hd, h, c }) => [
  box(-hw, hw, 0, h * 0.4, -hd, hd, c), cyl(0, 0, h * 0.4, h * 0.93, Math.min(hw, hd) * 0.8, '#cbd5e1', undefined, { }), cyl(0, 0, h * 0.93, h, Math.min(hw, hd) * 0.82, DARKM),
  box(-hw + 0.04, hw - 0.04, h * 0.12, h * 0.3, hd - 0.004, hd + 0.003, '#0b1220', { glass: true }),
];

const kettle: Recipe = ({ hw, hd, h, c }) => [
  cyl(0, 0, 0, 0.03, Math.min(hw, hd), BLK), cyl(0, 0, 0.03, h * 0.85, Math.min(hw, hd) * 0.85, c, Math.min(hw, hd) * 0.7), cyl(0, 0, h * 0.85, h, Math.min(hw, hd) * 0.55, DARKM),
  box(hw * 0.6, hw, h * 0.3, h * 0.8, -0.015, 0.015, DARKM), box(-hw, -hw * 0.5, h * 0.7, h * 0.8, -0.015, 0.015, c),
];

const toaster: Recipe = ({ hw, hd, h, c }) => [
  box(-hw, hw, 0, h, -hd, hd, c), box(-hw + 0.04, -0.02, h, h + 0.004, -hd + 0.04, hd - 0.04, BLK), box(0.02, hw - 0.04, h, h + 0.004, -hd + 0.04, hd - 0.04, BLK),
  box(hw, hw + 0.015, h * 0.4, h * 0.55, -0.02, 0.02, DARKM),
];

const airFryer: Recipe = ({ hw, hd, h, c }) => [
  box(-hw, hw, 0, h, -hd, hd, c), box(-hw + 0.03, hw - 0.03, h * 0.12, h * 0.62, hd - 0.004, hd + 0.004, '#0b1220'), box(-0.05, 0.05, h * 0.5, h * 0.55, hd + 0.004, hd + 0.03, STEEL),
  box(-hw + 0.05, hw - 0.05, h * 0.78, h * 0.9, hd - 0.004, hd + 0.003, '#0b1220', { glass: true }),
];

const standMixer: Recipe = ({ hw, hd, h, c }) => [
  box(-hw, hw, 0, 0.06, -hd + 0.02, hd - 0.02, c), box(-hw * 0.5, hw * 0.5, 0.06, h * 0.75, -hd + 0.02, -hd + 0.14, c),
  box(-hw * 0.8, hw * 0.8, h * 0.62, h * 0.78, -hd + 0.02, hd * 0.25, c), ball(0, 0.2, hd * 0.35, hw * 0.75, 0.1, hd * 0.3, METAL),
];

// ---- bedroom ---------------------------------------------------------------------------------------------------------

const wardrobeSliding: Recipe = ({ hw, hd, h, c }) => [
  box(-hw, hw, 0, h, -hd, hd - 0.05, c), box(-hw, 0.02, 0.04, h - 0.04, hd - 0.05, hd - 0.025, c), box(-0.02, hw, 0.04, h - 0.04, hd - 0.025, hd, GLASS, { glass: true }),
  box(-hw, hw, h - 0.04, h, hd - 0.05, hd, DARKM), box(-hw, hw, 0, 0.04, hd - 0.05, hd, DARKM),
  box(-0.03, -0.01, 0.9, 1.4, hd - 0.025, hd - 0.02, STEEL), box(0.01, 0.03, 0.9, 1.4, hd, hd + 0.005, STEEL),
];

const wardrobeWalkin: Recipe = ({ hw, hd, h, c }) => {
  const dep = Math.min(0.55, hd * 0.44);
  const out: Part[] = [box(-hw, hw, 0, h, -hd, -hd + dep, c), box(-hw, -hw + dep, 0, h, -hd + dep, hd, c), box(hw - dep, hw, 0, h, -hd + dep, hd, c)];
  // hanging rails and shelves on the inner faces, a few clothes
  out.push(rod(0, h - 0.45, -hd + dep + 0.02, 2 * hw - 2 * dep, 0.012, 'x', STEEL), rod(-hw + dep + 0.02, h - 0.45, 0, 2 * hd - 2 * dep, 0.012, 'z', STEEL), rod(hw - dep - 0.02, h - 0.45, 0, 2 * hd - 2 * dep, 0.012, 'z', STEEL));
  for (let i = 0; i < 8; i++) out.push(box(-hw + dep + 0.1 + i * 0.1, -hw + dep + 0.14 + i * 0.1, h - 1.2, h - 0.47, -hd + dep, -hd + dep + 0.03, ['#c0504d', '#4f81bd', '#d9d9d9', '#374151'][i % 4]));
  for (const y of [0.4, 0.8, 1.2]) out.push(box(-hw + dep, -hw + dep + 0.01, y, y + 0.02, -hd + dep, hd, shade(c, 0.2)));
  return out;
};

const wardrobeFitted: Recipe = ({ hw, hd, h, c }) => {
  const out: Part[] = [box(-hw, hw, 0, h, -hd, hd - 0.01, c), box(-hw, hw, 0, 0.06, -hd + 0.02, hd, BLK)];
  const n = Math.max(2, Math.round((2 * hw) / 0.6));
  for (let i = 1; i < n; i++) out.push(seamV(-hw + (2 * hw * i) / n, 0.06, h - 0.02, hd - 0.01, c));
  for (let i = 0; i < n; i++) out.push(handleV(-hw + (2 * hw * (i + 0.5)) / n + (i % 2 ? -0.2 : 0.2) * Math.min(1, hw / 0.6), 1.05, hd - 0.012, 0.2));
  return out;
};

const headboardOf = (style: 'padded' | 'wood' | 'tufted'): Recipe => ({ hw, hd, h, c }) => {
  if (style === 'wood') {
    const out: Part[] = [box(-hw, hw, 0.15, 0.2, -hd, hd, WOOD)];
    const n = Math.round((2 * hw) / 0.12);
    for (let i = 0; i < n; i++) out.push(box(-hw + (2 * hw * i) / n + 0.01, -hw + (2 * hw * (i + 1)) / n - 0.01, 0.2, h, -hd, hd, c));
    return out;
  }
  const out: Part[] = [box(-hw, hw, 0.15, h, -hd, hd, c), box(-hw + 0.06, hw - 0.06, 0.3, h - 0.1, hd - 0.003, hd + 0.003, shade(c, 0.2))];
  if (style === 'tufted') for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) out.push(ball(-hw + 0.15 + (i * (2 * hw - 0.3)) / 5, 0.45 + j * ((h - 0.8) / 2), hd, 0.02, 0.02, 0.012, shade(c, -0.35)));
  return out;
};

const changingTable: Recipe = ({ hw, hd, h, c }) => [
  box(-hw, hw, 0.1, h - 0.12, -hd, hd, c), box(-hw, hw, h - 0.12, h - 0.1, -hd, hd, shade(c, 0.2)),
  box(-hw, -hw + 0.03, h - 0.1, h, -hd, hd, c), box(hw - 0.03, hw, h - 0.1, h, -hd, hd, c), box(-hw, hw, h - 0.1, h, -hd, -hd + 0.03, c),
  box(-hw + 0.06, hw - 0.06, h - 0.1, h - 0.06, -hd + 0.05, hd - 0.05, '#bfdbfe'),
  box(-hw + 0.05, -hw + 0.12, 0, 0.1, -hd + 0.05, -hd + 0.12, WOOD), box(hw - 0.12, hw - 0.05, 0, 0.1, -hd + 0.05, -hd + 0.12, WOOD), box(-hw + 0.05, -hw + 0.12, 0, 0.1, hd - 0.12, hd - 0.05, WOOD), box(hw - 0.12, hw - 0.05, 0, 0.1, hd - 0.12, hd - 0.05, WOOD),
  box(-hw + 0.04, hw - 0.04, 0.2, 0.22, hd - 0.004, hd + 0.003, shade(c, -0.25)), box(-hw + 0.06, 0, 0.3, 0.55, -hd + 0.04, hd - 0.04, '#fef3c7'),
];

const rockingChair: Recipe = ({ hw, hd, h, c }) => [
  box(-hw + 0.04, -hw + 0.12, 0, 0.06, -hd + 0.05, hd - 0.05, WOOD), box(hw - 0.12, hw - 0.04, 0, 0.06, -hd + 0.05, hd - 0.05, WOOD),
  box(-hw + 0.04, hw - 0.04, 0.38, 0.5, -hd + 0.2, hd - 0.05, c), box(-hw + 0.04, hw - 0.04, 0.5, h, -hd + 0.05, -hd + 0.2, c),
  box(-hw, -hw + 0.1, 0.45, 0.68, -hd + 0.2, hd - 0.1, c), box(hw - 0.1, hw, 0.45, 0.68, -hd + 0.2, hd - 0.1, c),
  box(-hw + 0.06, -hw + 0.1, 0.06, 0.4, -hd + 0.15, -hd + 0.19, WOOD), box(hw - 0.1, hw - 0.06, 0.06, 0.4, -hd + 0.15, -hd + 0.19, WOOD),
  box(-hw + 0.06, -hw + 0.1, 0.06, 0.4, hd - 0.2, hd - 0.16, WOOD), box(hw - 0.1, hw - 0.06, 0.06, 0.4, hd - 0.2, hd - 0.16, WOOD),
];

const toyChest: Recipe = ({ hw, hd, h, c }) => [box(-hw, hw, 0, h * 0.8, -hd, hd, c), box(-hw - 0.01, hw + 0.01, h * 0.8, h, -hd, hd, shade(c, -0.2)), box(-0.06, 0.06, h * 0.55, h * 0.65, hd, hd + 0.015, STEEL)];

const playMat: Recipe = ({ hw, hd, c }) => [
  box(-hw, hw, 0, 0.012, -hd, hd, c),
  box(-hw + 0.1, -0.05, 0.012, 0.016, -hd + 0.1, -0.05, '#f2c14e'), box(0.05, hw - 0.1, 0.012, 0.016, 0.05, hd - 0.1, '#e8884a'), box(0.05, hw - 0.1, 0.012, 0.016, -hd + 0.1, -0.05, '#9bbb59'), box(-hw + 0.1, -0.05, 0.012, 0.016, 0.05, hd - 0.1, '#4f81bd'),
];

const mirrorWall: Recipe = ({ hw, hd, h }) => [
  box(-hw, hw, 0.3, 0.3 + h, -hd, hd, WOOD), box(-hw + 0.04, hw - 0.04, 0.34, 0.26 + h, hd - 0.004, hd + 0.004, GLASS, { glass: true }),
];

const mirrorFloor: Recipe = ({ hw, hd, h }) => [
  box(-hw, hw, 0.12, h, -0.025, 0.025, WOOD), box(-hw + 0.04, hw - 0.04, 0.16, h - 0.04, 0.025, 0.03, GLASS, { glass: true }),
  box(-hw + 0.02, -hw + 0.08, 0, 0.12, -hd, hd, WOOD), box(hw - 0.08, hw - 0.02, 0, 0.12, -hd, hd, WOOD),
];

// ---- living and dining -----------------------------------------------------------------------------------------------

/** Seat blocks and backs of a sectional: `seats` are [x0,x1,z0,z1] boxes, `backs` the thicker ones. */
function sectional(seats: number[][], backs: number[][], c: string, h: number): Part[] {
  const out: Part[] = [];
  for (const [x0, x1, z0, z1] of seats) out.push(box(x0, x1, 0.1, 0.4, z0, z1, c), box(x0 + 0.02, x1 - 0.02, 0.4, 0.5, z0 + 0.02, z1 - 0.02, shade(c, 0.35)));
  for (const [x0, x1, z0, z1] of backs) out.push(box(x0, x1, 0.1, Math.max(0.8, h), z0, z1, c), box(x0 + 0.02, x1 - 0.02, Math.max(0.8, h), Math.max(0.8, h) + 0.002, z0 + 0.02, z1 - 0.02, shade(c, 0.2)));
  return out;
}

const sofaU: Recipe = ({ hw, hd, h, c }) => {
  const s = 0.92; // depth of the seat
  return sectional(
    [[-hw + s, hw - s, -hd + 0.2, -hd + s + 0.2], [-hw + 0.2, -hw + s, -hd + s, hd - 0.02], [hw - s, hw - 0.2, -hd + s, hd - 0.02]],
    [[-hw, hw, -hd, -hd + 0.2], [-hw, -hw + 0.2, -hd + 0.2, hd], [hw - 0.2, hw, -hd + 0.2, hd]],
    c,
    h,
  );
};

const chaiseOf = (side: 1 | -1): Recipe => ({ hw, hd, h, c }) => {
  const s = Math.min(0.9, hd * 0.52 * 2);
  const w = Math.min(0.9, hw * 0.34 * 2);
  const x0 = side === 1 ? hw - w : -hw;
  const x1 = side === 1 ? hw : -hw + w;
  return sectional([[-hw + 0.2, hw - 0.2, -hd + 0.2, -hd + s], [x0, x1, -hd + s, hd - 0.02]], [[-hw, hw, -hd, -hd + 0.2], [side === 1 ? hw - 0.2 : -hw, side === 1 ? hw : -hw + 0.2, -hd + 0.2, -hd + s]], c, h);
};

const sofaRound: Recipe = ({ hw, hd, h, c }) => [
  cyl(0, 0, 0.1, 0.42, hw * 0.98, c, undefined, { rz: hd * 0.98 }), cyl(0, 0.04, 0.42, 0.5, hw * 0.86, shade(c, 0.35), undefined, { rz: hd * 0.8 }),
  ball(0, Math.max(0.55, h * 0.55), -hd * 0.5, hw * 0.96, Math.max(0.3, h * 0.28), hd * 0.42, shade(c, -0.05)),
];

const recliner: Recipe = ({ hw, hd, h, c }) => [
  box(-hw, hw, 0.1, 0.4, -hd, hd, c), box(-hw + 0.1, hw - 0.1, 0.4, 0.5, -hd + 0.25, hd - 0.1, shade(c, 0.2)),
  beam([0, 0.45, -hd + 0.28], [0, h - 0.1, -hd + 0.06], 2 * hw - 0.25, 0.16, c), beam([0, h - 0.18, -hd + 0.1], [0, h, -hd + 0.06], 0.5, 0.16, shade(c, 0.1)),
  box(-hw, -hw + 0.15, 0.4, 0.75, -hd + 0.2, hd - 0.1, c), box(hw - 0.15, hw, 0.4, 0.75, -hd + 0.2, hd - 0.1, c),
  box(-hw + 0.2, hw - 0.2, 0.02, 0.1, hd - 0.4, hd - 0.1, DARKM),
];

const ottoman: Recipe = ({ hw, hd, h, c }) => [box(-hw, hw, 0.08, h - 0.08, -hd, hd, c), box(-hw + 0.03, hw - 0.03, h - 0.08, h, -hd + 0.03, hd - 0.03, shade(c, 0.25)), box(-hw + 0.06, -hw + 0.12, 0, 0.08, -hd + 0.06, -hd + 0.12, WOOD), box(hw - 0.12, hw - 0.06, 0, 0.08, -hd + 0.06, -hd + 0.12, WOOD), box(-hw + 0.06, -hw + 0.12, 0, 0.08, hd - 0.12, hd - 0.06, WOOD), box(hw - 0.12, hw - 0.06, 0, 0.08, hd - 0.12, hd - 0.06, WOOD)];

/** A top on four legs, with an optional lower shelf. */
const tableOn = (x0: number, x1: number, z0: number, z1: number, h: number, top: string, shelf = false, thick = 0.04): Part[] => {
  const out: Part[] = [box(x0, x1, h - thick, h, z0, z1, top)];
  for (const [x, z] of [[x0 + 0.04, z0 + 0.04], [x1 - 0.08, z0 + 0.04], [x0 + 0.04, z1 - 0.08], [x1 - 0.08, z1 - 0.08]]) out.push(box(x, x + 0.04, 0, h - thick, z, z + 0.04, WOOD));
  if (shelf) out.push(box(x0 + 0.04, x1 - 0.04, 0.15, 0.18, z0 + 0.04, z1 - 0.04, shade(top, -0.1)));
  return out;
};

const consoleTable: Recipe = ({ hw, hd, h, c }) => [...tableOn(-hw, hw, -hd, hd, h, c, true)];

const tvStand: Recipe = ({ hw, hd, h, c }) => {
  const low = 0.5;
  return [
    ...tableOn(-hw, hw, -hd, hd, low, c, true, 0.05),
    box(-hw * 0.62, hw * 0.62, low + 0.02, h, -hd + 0.06, -hd + 0.1, BLK), box(-hw * 0.58, hw * 0.58, low + 0.06, h - 0.04, -hd + 0.1, -hd + 0.104, '#0b1220', { glass: true }),
    box(-0.15, 0.15, low, low + 0.04, -hd + 0.06, -hd + 0.2, DARKM),
  ];
};

const tvWall: Recipe = ({ hw, hd, h }) => [box(-hw, hw, 0.95, 0.95 + h, -hd, hd, BLK), box(-hw + 0.03, hw - 0.03, 0.98, 0.92 + h, hd - 0.004, hd + 0.003, '#0b1220', { glass: true })];

const barCart: Recipe = ({ hw, hd, h, c }) => {
  const out: Part[] = [];
  for (const [x, z] of [[-hw + 0.03, -hd + 0.03], [hw - 0.03, -hd + 0.03], [-hw + 0.03, hd - 0.03], [hw - 0.03, hd - 0.03]]) out.push(cyl(x, z, 0.06, h, 0.014, c), ball(x, 0.03, z, 0.03, 0.03, 0.03, BLK));
  for (const y of [0.28, 0.58, h - 0.02]) out.push(box(-hw, hw, y, y + 0.02, -hd, hd, shade(c, 0.35), y > h - 0.05 ? { glass: false } : {}));
  out.push(box(hw - 0.04, hw + 0.01, h - 0.2, h, -hd + 0.02, hd - 0.02, c), cyl(-hw * 0.5, 0, h, h + 0.22, 0.035, '#065f46'), cyl(hw * 0.1, 0, h, h + 0.18, 0.03, '#92400e'), cyl(hw * 0.5, 0.05, h, h + 0.1, 0.03, GLASS, undefined, { glass: true }), cyl(-hw * 0.2, 0.05, 0.3, 0.45, 0.03, '#1d4ed8'));
  return out;
};

const fireplaceSurround: Recipe = ({ hw, hd, h, c }) => {
  const dep = Math.min(0.36, hd * 0.4);
  return [
    box(-hw, hw, 0.06, h, -hd, -hd + dep, c), box(-hw * 0.6, hw * 0.6, 0.1, h * 0.58, -hd + dep - 0.02, -hd + dep + 0.002, '#0f172a'),
    box(-hw * 0.5, hw * 0.5, 0.06, 0.34, -hd + 0.05, -hd + dep - 0.04, '#f59e0b', { glow: true }),
    box(-hw - 0.02, hw + 0.02, h, h + 0.05, -hd, -hd + dep + 0.1, WOOD),
    box(-hw, hw, 0, 0.06, -hd + dep, hd, shade(c, -0.2)),
    box(-hw * 0.6, hw * 0.6, 0.06, 0.1, -hd + dep, -hd + dep + 0.04, shade(c, -0.4)),
  ];
};

const benchOf: Recipe = ({ hw, hd, h, c }) => [box(-hw, hw, h - 0.08, h, -hd, hd, c), ...[[-hw + 0.06, -hd + 0.05], [hw - 0.12, -hd + 0.05], [-hw + 0.06, hd - 0.11], [hw - 0.12, hd - 0.11]].map(([x, z]) => box(x, x + 0.06, 0, h - 0.08, z, z + 0.06, WOOD))];

const banquette: Recipe = ({ hw, hd, h, c }) => [
  box(-hw, hw, 0.05, 0.42, -hd, hd, shade(c, -0.1)), box(-hw + 0.03, hw - 0.03, 0.42, 0.5, -hd + 0.2, hd - 0.03, c),
  box(-hw, hw, 0.42, h, -hd, -hd + 0.18, c), box(-hw + 0.04, hw - 0.04, 0.55, h - 0.08, -hd + 0.18, -hd + 0.2, shade(c, 0.2)), box(-hw, hw, 0, 0.05, -hd + 0.03, hd - 0.03, BLK),
];

const breakfastNook: Recipe = ({ hw, hd, h, c }) => {
  const a = Math.min(0.62, hd * 0.3 * 2);
  const out: Part[] = [
    box(-hw, hw, 0.05, 0.42, -hd, -hd + a, shade(c, -0.1)), box(-hw, -hw + a, 0.05, 0.42, -hd + a, hd, shade(c, -0.1)),
    box(-hw + 0.03, hw - 0.03, 0.42, 0.5, -hd + 0.18, -hd + a, c), box(-hw + 0.18, -hw + a, 0.42, 0.5, -hd + a, hd - 0.03, c),
    box(-hw, hw, 0.42, h, -hd, -hd + 0.18, c), box(-hw, -hw + 0.18, 0.42, h, -hd + 0.18, hd, c),
  ];
  const tx0 = -hw + 0.34 * 2 * hw * 0.5 + a * 0.6;
  const tx1 = hw - 0.18 * 2 * hw * 0.5;
  out.push(...tableOn(tx0, tx1, -hd + a + 0.1, hd - 0.2, 0.75, WOOD_L, false, 0.05));
  return out;
};

// ---- bathroom ---------------------------------------------------------------------------------------------------------

const bathCorner: Recipe = ({ hw, hd, h, c }) => [
  box(-hw, hw, 0, h, -hd, hd, c), cyl(0, 0, h - 0.04, h + 0.004, hw * 0.84, '#cfe6f5', undefined, { rz: hd * 0.84 }),
  cyl(-hw + 0.12, -hd + 0.12, h, h + 0.2, 0.014, STEEL), box(-hw + 0.1, -hw + 0.3, h + 0.18, h + 0.2, -hd + 0.11, -hd + 0.13, STEEL),
];

const bathFree: Recipe = ({ hw, hd, h, c }) => [
  cyl(0, 0, 0.1, h, hw, c, undefined, { rz: hd }), cyl(0, 0, h - 0.03, h + 0.004, hw * 0.9, '#cfe6f5', undefined, { rz: hd * 0.86 }),
  ...[[-hw * 0.7, -hd * 0.6], [hw * 0.7, -hd * 0.6], [-hw * 0.7, hd * 0.6], [hw * 0.7, hd * 0.6]].map(([x, z]) => ball(x, 0.05, z, 0.05, 0.05, 0.05, STEEL)),
  cyl(hw * 0.78, 0, 0, h + 0.55, 0.014, STEEL), box(hw * 0.78 - 0.1, hw * 0.78, h + 0.5, h + 0.54, -0.01, 0.01, STEEL),
];

const showerWalkin: Recipe = ({ hw, hd, c }) => [
  box(-hw, hw, 0, 0.06, -hd, hd, c), box(-hw + 0.04, hw - 0.04, 0.06, 0.065, -hd + 0.04, hd - 0.04, '#e0f2fe'),
  box(-hw, -hw + 0.012, 0.06, 2.0, -hd, hd, GLASS, { glass: true }), box(-hw, 0.1, 0.06, 2.0, hd - 0.012, hd, GLASS, { glass: true }),
  box(-hw, -hw + 0.03, 1.98, 2.02, -hd, hd, STEEL), box(-hw, 0.1, 1.98, 2.02, hd - 0.03, hd, STEEL),
  cyl(hw - 0.15, -hd + 0.06, 0.06, 2.1, 0.012, STEEL), cyl(hw - 0.15, -hd + 0.2, 2.07, 2.1, 0.12, STEEL),
];

const towelRail = (hot: boolean): Recipe => ({ hw, hd, h, c }) => {
  const out: Part[] = [box(-hw, -hw + 0.025, 0.4, 0.4 + h, -hd, -hd + 0.06, c), box(hw - 0.025, hw, 0.4, 0.4 + h, -hd, -hd + 0.06, c)];
  const n = Math.round(h / 0.1);
  out.push(box(-hw, hw, 0.4 + h - 0.03, 0.4 + h, -hd, -hd + 0.06, c));
  for (let i = 0; i < n; i++) out.push(rod(0, 0.45 + (i * (h - 0.1)) / (n - 1), -hd + 0.035, 2 * hw, 0.012, 'x', c));
  if (hot) out.push(box(hw - 0.01, hw, 0.35, 0.42, -hd + 0.03, -hd + 0.06, '#f59e0b', { glow: true }));
  return out;
};

const vanityMirror: Recipe = ({ hw, hd, h, c }) => [
  box(-hw, hw, 0.15, h - 0.04, -hd, hd - 0.02, c), box(-hw + 0.04, hw - 0.04, 0, 0.15, -hd + 0.05, hd - 0.1, BLK), box(-hw, hw, h - 0.04, h, -hd, hd, TOP),
  cyl(0, 0.02, h - 0.05, h + 0.002, hw * 0.4, '#f8fafc', undefined, { rz: hd * 0.5 }), cyl(0, -hd + 0.08, h, h + 0.2, 0.012, STEEL),
  box(-hw * 0.55, hw * 0.55, 1.1, 1.95, -hd, -hd + 0.025, GLASS, { glass: true }), box(-hw * 0.58, hw * 0.58, 1.08, 1.97, -hd, -hd + 0.015, WOOD_L),
  handleH(-hw * 0.5, 0.5, hd - 0.03, 0.12), handleH(hw * 0.5, 0.5, hd - 0.03, 0.12),
];

// ---- built-in -----------------------------------------------------------------------------------------------------------

const columnRound: Recipe = ({ hw, h, c }) => [cyl(0, 0, 0, 0.1, hw, shade(c, -0.1)), cyl(0, 0, 0.1, h - 0.1, hw * 0.82, c), cyl(0, 0, h - 0.1, h, hw, shade(c, -0.1))];
const columnSquare: Recipe = ({ hw, hd, h, c }) => [box(-hw, hw, 0, 0.1, -hd, hd, shade(c, -0.1)), box(-hw * 0.85, hw * 0.85, 0.1, h - 0.1, -hd * 0.85, hd * 0.85, c), box(-hw, hw, h - 0.1, h, -hd, hd, shade(c, -0.1))];
const ceilingBeam: Recipe = ({ hw, hd, h, c, ceil }) => [box(-hw, hw, ceil - h, ceil, -hd, hd, c)];

const wallShelf: Recipe = ({ hw, hd, c }) => [
  box(-hw, hw, 1.4, 1.44, -hd, hd, c),
  box(-hw * 0.8, -hw * 0.8 + 0.03, 1.28, 1.4, -hd, -hd + 0.03, STEEL), box(hw * 0.8 - 0.03, hw * 0.8, 1.28, 1.4, -hd, -hd + 0.03, STEEL),
  box(-hw * 0.7, -hw * 0.5, 1.44, 1.66, -hd + 0.04, -hd + 0.1, '#c0504d'), box(-hw * 0.45, -hw * 0.3, 1.44, 1.7, -hd + 0.04, -hd + 0.1, '#4f81bd'), cyl(hw * 0.4, 0, 1.44, 1.6, 0.05, '#f3f4f6'),
];

const wallNiche: Recipe = ({ hw, hd, h, c }) => [
  box(-hw, hw, 0.9, 0.9 + h, -hd, hd, c), box(-hw + 0.05, hw - 0.05, 0.95, 0.85 + h, hd - 0.004, hd + 0.004, '#cbd5e1'), box(-hw + 0.05, hw - 0.05, 1.3, 1.32, hd - 0.04, hd, '#f8fafc'),
];

// ---- garden ---------------------------------------------------------------------------------------------------------------

const pergola: Recipe = ({ hw, hd, h, c }) => {
  const out: Part[] = [];
  for (const [x, z] of [[-hw, -hd], [hw - 0.12, -hd], [-hw, hd - 0.12], [hw - 0.12, hd - 0.12]]) out.push(box(x, x + 0.12, 0, h, z, z + 0.12, c));
  out.push(box(-hw, hw, h - 0.2, h - 0.08, -hd, -hd + 0.1, c), box(-hw, hw, h - 0.2, h - 0.08, hd - 0.1, hd, c));
  const n = Math.round((2 * hd) / 0.35);
  for (let i = 0; i < n; i++) out.push(box(-hw, hw, h - 0.08, h, -hd + (2 * hd * (i + 0.2)) / n, -hd + (2 * hd * (i + 0.7)) / n, shade(c, 0.1)));
  return out;
};

const gazebo: Recipe = ({ hw, hd, h, c }) => {
  const out: Part[] = [cyl(0, 0, 0, 0.1, hw, shade(c, -0.15), undefined, { rz: hd })];
  const post = h * 0.72;
  for (const [x, z] of [[-0.72, -0.72], [0.72, -0.72], [-0.72, 0.72], [0.72, 0.72]]) out.push(box(x * hw - 0.05, x * hw + 0.05, 0.1, post, z * hd - 0.05, z * hd + 0.05, c));
  out.push(box(-0.72 * hw, 0.72 * hw, 0.5, 0.56, -0.72 * hd, -0.72 * hd + 0.04, c), box(-0.72 * hw, -0.72 * hw + 0.04, 0.5, 0.56, -0.72 * hd, 0.72 * hd, c), box(0.72 * hw - 0.04, 0.72 * hw, 0.5, 0.56, -0.72 * hd, 0.72 * hd, c));
  out.push(cyl(0, 0, post, h, hw * 0.98, '#6b7280', 0.06, { rz: hd * 0.98 }), cyl(0, 0, h, h + 0.1, 0.04, STEEL));
  return out;
};

const carport: Recipe = ({ hw, hd, h, c }) => {
  const out: Part[] = [];
  for (const [x, z] of [[-hw + 0.05, -hd + 0.05], [hw - 0.15, -hd + 0.05], [-hw + 0.05, hd - 0.15], [hw - 0.15, hd - 0.15]]) out.push(box(x, x + 0.1, 0, h, z, z + 0.1, DARKM));
  out.push(box(-hw, hw, h, h + 0.12, -hd, hd, c), box(-hw, hw, h + 0.12, h + 0.15, -hd, hd, shade(c, 0.2)));
  return out;
};

const awning: Recipe = ({ hw, hd, c }) => {
  const out: Part[] = [];
  const n = 6;
  for (let i = 0; i < n; i++) {
    const x0 = -hw + (2 * hw * i) / n;
    const x1 = -hw + (2 * hw * (i + 1)) / n;
    out.push({ t: 'panel', pts: [[x0, 2.55, -hd], [x1, 2.55, -hd], [x1, 2.2, hd], [x0, 2.2, hd]], thick: 0.02, facing: [0, 1, 0], color: i % 2 ? WHITE : c });
    out.push(box(x0, x1, 2.1, 2.2, hd - 0.02, hd, i % 2 ? WHITE : c));
  }
  out.push(box(-hw, hw, 2.55, 2.6, -hd, -hd + 0.05, STEEL), beam([-hw + 0.03, 2.5, -hd + 0.1], [-hw + 0.03, 2.22, hd - 0.1], 0.025, 0.025, STEEL), beam([hw - 0.03, 2.5, -hd + 0.1], [hw - 0.03, 2.22, hd - 0.1], 0.025, 0.025, STEEL));
  return out;
};

const retainingWall: Recipe = ({ hw, hd, h, c }) => {
  const out: Part[] = [box(-hw, hw, 0, h - 0.06, -hd, hd, c), box(-hw - 0.01, hw + 0.01, h - 0.06, h, -hd - 0.01, hd + 0.01, shade(c, 0.2))];
  const courses = Math.max(2, Math.round(h / 0.2));
  for (let i = 1; i < courses; i++) out.push(box(-hw, hw, (i * (h - 0.06)) / courses - 0.004, (i * (h - 0.06)) / courses + 0.004, hd, hd + 0.004, shade(c, -0.3)));
  return out;
};

const gardenSteps: Recipe = ({ hw, hd, h, c }) => {
  const n = 3;
  return Array.from({ length: n }, (_, i) => box(-hw, hw, 0, (h * (i + 1)) / n, hd - ((i + 1) * 2 * hd) / n, hd - (i * 2 * hd) / n, i % 2 ? shade(c, 0.08) : c));
};

const pavingGrid: Recipe = ({ hw, hd, c }) => {
  const out: Part[] = [box(-hw, hw, 0, 0.02, -hd, hd, c)];
  const n = Math.max(2, Math.round(hw / 0.3));
  const m = Math.max(2, Math.round(hd / 0.3));
  for (let i = 1; i < n; i++) out.push(box(-hw + (2 * hw * i) / n - 0.006, -hw + (2 * hw * i) / n + 0.006, 0.02, 0.023, -hd, hd, shade(c, -0.3)));
  for (let j = 1; j < m; j++) out.push(box(-hw, hw, 0.02, 0.023, -hd + (2 * hd * j) / m - 0.006, -hd + (2 * hd * j) / m + 0.006, shade(c, -0.3)));
  return out;
};

const pavingBricks: Recipe = ({ hw, hd, c }) => {
  const out: Part[] = [box(-hw, hw, 0, 0.02, -hd, hd, shade(c, -0.25))];
  const cell = 0.4;
  const nx = Math.max(1, Math.round((2 * hw) / cell));
  const nz = Math.max(1, Math.round((2 * hd) / cell));
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const x0 = -hw + (2 * hw * i) / nx;
    const x1 = -hw + (2 * hw * (i + 1)) / nx;
    const z0 = -hd + (2 * hd * j) / nz;
    const z1 = -hd + (2 * hd * (j + 1)) / nz;
    const col = (i + j) % 3 === 0 ? shade(c, 0.08) : c;
    if ((i + j) % 2 === 0) {
      const zm = (z0 + z1) / 2;
      out.push(box(x0 + 0.01, x1 - 0.01, 0.02, 0.026, z0 + 0.01, zm - 0.005, col), box(x0 + 0.01, x1 - 0.01, 0.02, 0.026, zm + 0.005, z1 - 0.01, col));
    } else {
      const xm = (x0 + x1) / 2;
      out.push(box(x0 + 0.01, xm - 0.005, 0.02, 0.026, z0 + 0.01, z1 - 0.01, col), box(xm + 0.005, x1 - 0.01, 0.02, 0.026, z0 + 0.01, z1 - 0.01, col));
    }
  }
  return out;
};

const pavingRound: Recipe = ({ hw, hd, c }) => [
  cyl(0, 0, 0, 0.02, hw, shade(c, -0.1), undefined, { rz: hd }), cyl(0, 0, 0.02, 0.024, hw * 0.78, c, undefined, { rz: hd * 0.78 }), cyl(0, 0, 0.024, 0.028, hw * 0.5, shade(c, 0.1), undefined, { rz: hd * 0.5 }), cyl(0, 0, 0.028, 0.032, hw * 0.2, shade(c, -0.15), undefined, { rz: hd * 0.2 }),
];

const trunk = (h: number, r: number, color = '#6b4f3a'): Part => cyl(0, 0, 0, h, r, color, r * 0.7);

const treeOak: Recipe = ({ hw, hd, h, c }) => [trunk(h * 0.45, 0.22), ball(0, h * 0.68, 0, hw * 0.95, h * 0.3, hd * 0.95, c), ball(hw * 0.35, h * 0.62, hd * 0.2, hw * 0.55, h * 0.24, hd * 0.55, shade(c, -0.15)), ball(-hw * 0.4, h * 0.65, -hd * 0.25, hw * 0.5, h * 0.22, hd * 0.5, shade(c, 0.12)), ball(0, h * 0.86, 0, hw * 0.6, h * 0.14, hd * 0.6, shade(c, 0.05))];
const treePine: Recipe = ({ hw, hd, h, c }) => [trunk(h * 0.3, 0.14), cyl(0, 0, h * 0.18, h * 0.5, hw * 0.98, c, hw * 0.3, { rz: hd * 0.98 }), cyl(0, 0, h * 0.4, h * 0.72, hw * 0.75, shade(c, 0.05), hw * 0.2, { rz: hd * 0.75 }), cyl(0, 0, h * 0.62, h, hw * 0.5, shade(c, 0.1), 0.02, { rz: hd * 0.5 })];
const treeBirch: Recipe = ({ hw, hd, h, c }) => [trunk(h * 0.6, 0.1, '#e5e7eb'), ball(0, h * 0.72, 0, hw * 0.8, h * 0.22, hd * 0.8, c), ball(hw * 0.2, h * 0.88, hd * 0.1, hw * 0.55, h * 0.12, hd * 0.55, shade(c, 0.15)), box(-0.03, 0.03, h * 0.1, h * 0.18, 0.1, 0.103, BLK)];
const treePalm: Recipe = ({ hw, hd, h, c }) => {
  const out: Part[] = [trunk(h * 0.8, 0.14, '#8b6b4a')];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    out.push(beam([0, h * 0.82, 0], [Math.cos(a) * hw * 0.95, h * 0.62, Math.sin(a) * hd * 0.95], 0.18, 0.04, i % 2 ? shade(c, -0.1) : c));
  }
  out.push(ball(0.08, h * 0.8, 0, 0.12, 0.12, 0.12, '#8b5a2b'));
  return out;
};
const treeApple: Recipe = ({ hw, hd, h, c }) => [trunk(h * 0.4, 0.12), ball(0, h * 0.68, 0, hw * 0.9, h * 0.3, hd * 0.9, c), ball(hw * 0.3, h * 0.6, hd * 0.2, hw * 0.5, h * 0.2, hd * 0.5, shade(c, -0.15)), ...[[0.5, 0.55, 0.3], [-0.4, 0.62, 0.45], [0.1, 0.5, -0.6], [-0.55, 0.58, -0.2], [0.35, 0.72, -0.4]].map(([x, y, z]) => ball(x * hw, h * y, z * hd, 0.06, 0.06, 0.06, '#dc2626'))];
const treeCypress: Recipe = ({ hw, hd, h, c }) => [cyl(0, 0, 0, 0.3, 0.05, '#6b4f3a'), cyl(0, 0, 0.25, h, hw * 0.95, c, 0.03, { rz: hd * 0.95 }), ball(0, h * 0.55, 0, hw * 0.9, h * 0.38, hd * 0.9, shade(c, 0.05))];

const gateGarden: Recipe = ({ hw, hd, h, c }) => {
  const out: Part[] = [box(-hw, -hw + 0.06, 0, h, -hd, hd, c), box(hw - 0.06, hw, 0, h, -hd, hd, c), box(-hw, hw, 0.15, 0.25, -hd, hd, c), box(-hw, hw, h - 0.25, h - 0.15, -hd, hd, c)];
  const n = Math.round(hw / 0.07);
  for (let i = 1; i < n; i++) out.push(box(-hw + (2 * hw * i) / n - 0.02, -hw + (2 * hw * i) / n + 0.02, 0.05, h - 0.05, -hd * 0.5, hd * 0.5, shade(c, 0.1)));
  return out;
};
const gateLeaf = (x0: number, x1: number, hd: number, h: number, c: string): Part[] => {
  const out: Part[] = [box(x0, x1, 0.1, h, -hd, hd, c)];
  const n = Math.max(3, Math.round((x1 - x0) / 0.12));
  for (let i = 1; i < n; i++) out.push(box(x0 + ((x1 - x0) * i) / n - 0.012, x0 + ((x1 - x0) * i) / n + 0.012, 0.14, h - 0.04, hd, hd + 0.01, shade(c, 0.2)));
  out.push(box(x0, x1, 0.14, 0.18, hd, hd + 0.012, shade(c, 0.2)), box(x0, x1, h - 0.04, h, hd, hd + 0.012, shade(c, 0.2)));
  return out;
};
const gateDriveway: Recipe = ({ hw, hd, h, c }) => [box(-hw, -hw + 0.12, 0, h + 0.1, -hd, hd, DARKM), box(hw - 0.12, hw, 0, h + 0.1, -hd, hd, DARKM), ...gateLeaf(-hw + 0.12, -0.02, hd * 0.6, h, c), ...gateLeaf(0.02, hw - 0.12, hd * 0.6, h, c)];
const gateSliding: Recipe = ({ hw, hd, h, c }) => [box(-hw, -hw + 0.12, 0, h + 0.1, -hd, hd, DARKM), box(hw - 0.12, hw, 0, h + 0.1, -hd, hd, DARKM), ...gateLeaf(-hw + 0.12, hw - 0.5, hd * 0.6, h, c), box(-hw + 0.12, hw - 0.12, 0, 0.1, -hd * 0.5, hd * 0.5, STEEL)];

// ---- heating, ventilation and cooling -----------------------------------------------------------------------------------------

const outdoorUnit = (feet: number): Recipe => ({ hw, hd, h, c }) => [
  box(-hw, hw, feet, h, -hd, hd, c), box(-hw + 0.04, -hw + 0.1, 0, feet, -hd + 0.05, hd - 0.05, DARKM), box(hw - 0.1, hw - 0.04, 0, feet, -hd + 0.05, hd - 0.05, DARKM),
  ring(-hw * 0.4, feet + (h - feet) / 2, hd, (h - feet) * 0.42, 0.012, 'z', DARKM), cyl(-hw * 0.4, hd, feet + (h - feet) * 0.46, feet + (h - feet) * 0.54, 0.03, DARKM, undefined, { }),
  ...Array.from({ length: 6 }, (_, i) => box(hw * 0.2, hw - 0.05, feet + 0.08 + (i * (h - feet - 0.16)) / 5, feet + 0.1 + (i * (h - feet - 0.16)) / 5, hd - 0.004, hd + 0.01, shade(c, -0.3))),
];

const acSplit: Recipe = ({ hw, hd, h, c }) => [
  box(-hw, hw, 2.0, 2.0 + h, -hd, hd, c), box(-hw + 0.05, hw - 0.05, 2.0, 2.02, hd - 0.02, hd + 0.003, shade(c, -0.25)), box(-hw + 0.04, hw - 0.04, 2.0 + h * 0.4, 2.0 + h * 0.55, hd - 0.004, hd + 0.003, shade(c, -0.15)),
  box(hw - 0.12, hw - 0.06, 2.0 + h * 0.65, 2.0 + h * 0.78, hd - 0.004, hd + 0.003, '#22c55e', { glow: true }),
];

const boiler: Recipe = ({ hw, hd, h, c }) => [
  box(-hw, hw, 1.0, 1.0 + h, -hd, hd, c), box(-hw + 0.05, hw - 0.05, 1.0 + h * 0.72, 1.0 + h * 0.9, hd - 0.004, hd + 0.003, '#0b1220'), cyl(0, hd - 0.1, 1.0 + h * 0.3, 1.0 + h * 0.5, 0.03, '#cbd5e1'),
  cyl(-hw * 0.5, -hd + 0.06, 0.2, 1.0, 0.015, '#b45309'), cyl(0, -hd + 0.06, 0.2, 1.0, 0.015, '#9ca3af'), cyl(hw * 0.5, -hd + 0.06, 0.2, 1.0, 0.015, '#1d4ed8'),
];

const woodStove: Recipe = ({ hw, hd, h, c, ceil }) => [
  box(-hw + 0.04, -hw + 0.1, 0, 0.12, -hd + 0.04, -hd + 0.1, c), box(hw - 0.1, hw - 0.04, 0, 0.12, -hd + 0.04, -hd + 0.1, c), box(-hw + 0.04, -hw + 0.1, 0, 0.12, hd - 0.1, hd - 0.04, c), box(hw - 0.1, hw - 0.04, 0, 0.12, hd - 0.1, hd - 0.04, c),
  box(-hw, hw, 0.12, h * 0.72, -hd, hd, c), box(-hw - 0.01, hw + 0.01, h * 0.72, h * 0.76, -hd, hd, shade(c, 0.15)),
  box(-hw * 0.6, hw * 0.6, 0.25, h * 0.55, hd - 0.004, hd + 0.003, '#0b1220', { glass: true }), box(-hw * 0.5, hw * 0.5, 0.3, 0.4, hd - 0.1, hd - 0.01, '#f59e0b', { glow: true }),
  cyl(0, -hd * 0.3, h * 0.76, Math.max(h, ceil), 0.075, shade(c, 0.1)),
];

const ceilingFan: Recipe = ({ hw, ceil, c }) => {
  const out: Part[] = [cyl(0, 0, ceil - 0.3, ceil, 0.015, STEEL), cyl(0, 0, ceil - 0.36, ceil - 0.3, 0.09, DARKM)];
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    out.push({ t: 'box', x: Math.cos(a) * hw * 0.5, y: ceil - 0.34, z: Math.sin(a) * hw * 0.5, sx: hw * 0.8, sy: 0.015, sz: 0.14, ry: -a, color: c });
  }
  return out;
};

const duct: Recipe = ({ hw, hd, h, c, ceil }) => {
  const out: Part[] = [box(-hw, hw, ceil - h, ceil - 0.02, -hd, hd, c)];
  const n = Math.round((2 * hw) / 0.5);
  for (let i = 1; i < n; i++) out.push(box(-hw + (2 * hw * i) / n - 0.015, -hw + (2 * hw * i) / n + 0.015, ceil - h - 0.01, ceil - 0.01, -hd - 0.01, hd + 0.01, shade(c, -0.25)));
  return out;
};

const vent: Recipe = ({ hw, hd, ceil, c }) => [box(-hw, hw, ceil - 0.04, ceil, -hd, hd, c), ...Array.from({ length: 4 }, (_, i) => box(-hw + 0.04, hw - 0.04, ceil - 0.045, ceil - 0.04, -hd + 0.06 + i * ((2 * hd - 0.12) / 3) - 0.01, -hd + 0.06 + i * ((2 * hd - 0.12) / 3) + 0.01, shade(c, -0.4)))];

const flue: Recipe = ({ hw, ceil, c }) => [cyl(0, 0, 0, ceil, hw * 0.8, c), cyl(0, 0, 0.25, 0.3, hw, shade(c, 0.1)), cyl(0, 0, ceil - 0.3, ceil - 0.25, hw, shade(c, 0.1))];

const underfloor: Recipe = ({ hw, hd, c }) => {
  const out: Part[] = [box(-hw, hw, 0, 0.004, -hd, hd, shade(c, 0.5))];
  const rows = [0.12, 0.3, 0.48, 0.66, 0.84];
  rows.forEach((f, i) => {
    const z = -hd + 2 * hd * f;
    out.push(box(-hw * 0.84, hw * 0.84, 0.004, 0.012, z - 0.02, z + 0.02, c));
    if (i < rows.length - 1) out.push(box(i % 2 ? -hw * 0.84 : hw * 0.84 - 0.04, i % 2 ? -hw * 0.84 + 0.04 : hw * 0.84, 0.004, 0.012, z, -hd + 2 * hd * rows[i + 1], c));
  });
  return out;
};

// ---- people and pets -------------------------------------------------------------------------------------------------------------

/** A simple standing figure: legs, body, arms, head. `c` is the clothes color. */
const personOf: Recipe = ({ hw, hd, h, c }) => {
  const leg = h * 0.5;
  const torso = h * 0.3;
  return [
    box(-hw * 0.4, -hw * 0.05, 0, leg, -hd * 0.3, hd * 0.3, '#374151'), box(hw * 0.05, hw * 0.4, 0, leg, -hd * 0.3, hd * 0.3, '#374151'),
    box(-hw * 0.5, hw * 0.5, leg, leg + torso, -hd * 0.45, hd * 0.45, c),
    box(-hw, -hw * 0.5, leg + torso * 0.1, leg + torso, -hd * 0.25, hd * 0.25, c), box(hw * 0.5, hw, leg + torso * 0.1, leg + torso, -hd * 0.25, hd * 0.25, c),
    box(-hw, -hw * 0.6, leg - torso * 0.3, leg + torso * 0.1, -hd * 0.2, hd * 0.2, SKIN), box(hw * 0.6, hw, leg - torso * 0.3, leg + torso * 0.1, -hd * 0.2, hd * 0.2, SKIN),
    cyl(0, 0, leg + torso, leg + torso + h * 0.03, hw * 0.12, SKIN), ball(0, leg + torso + h * 0.09, 0, hw * 0.32, h * 0.065, hd * 0.5, SKIN), ball(0, leg + torso + h * 0.11, -hd * 0.08, hw * 0.34, h * 0.05, hd * 0.5, '#4b3621'),
  ];
};

const animalOf = (legLen: number, tail: boolean): Recipe => ({ hw, hd, h, c }) => {
  const out: Part[] = [ball(0, legLen + (h - legLen) * 0.45, hd * 0.12, hw * 0.9, (h - legLen) * 0.5, hd * 0.55, c), ball(0, h * 0.85, -hd * 0.72, hw * 0.65, h * 0.2, hd * 0.2, shade(c, 0.1)), box(-hw * 0.5, -hw * 0.2, h * 0.95, h, -hd * 0.78, -hd * 0.7, shade(c, -0.2)), box(hw * 0.2, hw * 0.5, h * 0.95, h, -hd * 0.78, -hd * 0.7, shade(c, -0.2))];
  for (const [x, z] of [[-hw * 0.55, -hd * 0.4], [hw * 0.55, -hd * 0.4], [-hw * 0.55, hd * 0.55], [hw * 0.55, hd * 0.55]]) out.push(box(x - 0.025, x + 0.025, 0, legLen + 0.03, z - 0.025, z + 0.025, shade(c, -0.15)));
  if (tail) out.push(beam([0, legLen + (h - legLen) * 0.7, hd * 0.6], [0, h * 1.0, hd * 0.98], 0.04, 0.04, shade(c, -0.1)));
  return out;
};

const petBed: Recipe = ({ hw, hd, h, c }) => [box(-hw + 0.05, hw - 0.05, 0, h * 0.6, -hd + 0.05, hd - 0.05, shade(c, 0.4)), box(-hw, hw, 0, h, -hd, -hd + 0.1, c), box(-hw, hw, 0, h, hd - 0.1, hd, c), box(-hw, -hw + 0.1, 0, h, -hd + 0.1, hd - 0.1, c), box(hw - 0.1, hw, 0, h, -hd + 0.1, hd - 0.1, c)];

const catTree: Recipe = ({ hw, hd, h, c }) => [
  box(-hw, hw, 0, 0.06, -hd, hd, c), cyl(0, 0, 0.06, h, 0.06, '#d6b98a'), box(-hw, hw, 0.5, 0.56, -hd, hd, c), box(-hw * 0.6, hw * 0.6, 0.95, 1.0, -hd * 0.6, hd * 0.6, c),
  box(-hw, hw, h - 0.25, h - 0.2, -hd, hd, c), box(-hw, hw, h - 0.2, h - 0.05, -hd, -hd + 0.05, c), box(-hw, hw, h - 0.2, h - 0.05, hd - 0.05, hd, c), box(-hw, -hw + 0.05, h - 0.2, h - 0.05, -hd, hd, c), box(hw - 0.05, hw, h - 0.2, h - 0.05, -hd, hd, c),
];

const petBowls: Recipe = ({ hw, hd, h, c }) => [box(-hw, hw, 0, 0.012, -hd, hd, DARKM), cyl(-hw * 0.5, 0, 0.012, h, hd * 0.8, c, hd * 0.65), cyl(hw * 0.5, 0, 0.012, h, hd * 0.8, shade(c, 0.2), hd * 0.65)];
const litterBox: Recipe = ({ hw, hd, h, c }) => [box(-hw, hw, 0, h, -hd, hd, c), box(-hw + 0.03, hw - 0.03, h - 0.04, h + 0.002, -hd + 0.03, hd - 0.03, '#d6b98a'), box(-hw, hw, h, h + 0.04, -hd, -hd + 0.03, c)];

// ---- window dressing ------------------------------------------------------------------------------------------------------------------

/** A curtain drape of folded strips: each strip a little deeper than the next. */
function drape(x0: number, x1: number, top: number, bottom: number, hd: number, c: string, glass = false): Part[] {
  const n = Math.max(2, Math.round((x1 - x0) / 0.1));
  return Array.from({ length: n }, (_, i) => {
    const a = x0 + ((x1 - x0) * i) / n;
    const b = x0 + ((x1 - x0) * (i + 1)) / n;
    const deep = i % 2 ? hd * 1.8 : hd * 1.2;
    return box(a, b, bottom, top, -hd, -hd + deep, i % 2 ? shade(c, -0.12) : c, glass ? { glass: true } : {});
  });
}

const curtain: Recipe = ({ hw, hd, h, c }) => {
  const top = h + 0.05;
  return [
    rod(0, top, 0, 2 * hw, 0.012, 'x', STEEL), ball(-hw, top, 0, 0.03, 0.03, 0.03, STEEL), ball(hw, top, 0, 0.03, 0.03, 0.03, STEEL),
    ...drape(-hw, -hw * 0.45, top - 0.04, 0.05, hd, c), ...drape(hw * 0.45, hw, top - 0.04, 0.05, hd, c),
  ];
};

const curtainSheer: Recipe = ({ hw, hd, h, c }) => [rod(0, h + 0.05, 0, 2 * hw, 0.01, 'x', STEEL), ...drape(-hw, hw, h + 0.01, 0.05, hd, c, true)];

const rollerBlind: Recipe = ({ hw, hd, h, c }) => {
  const top = 2.15;
  return [rod(0, top + 0.03, -hd + 0.03, 2 * hw, 0.03, 'x', STEEL), box(-hw, hw, top - h, top, -hd + 0.01, -hd + 0.03, c), box(-hw, hw, top - h - 0.03, top - h, -hd + 0.005, -hd + 0.04, shade(c, -0.3)), box(hw - 0.04, hw - 0.035, top - h * 0.5, top, -hd + 0.035, -hd + 0.04, STEEL)];
};

const venetianBlind: Recipe = ({ hw, hd, h, c }) => {
  const top = 2.15;
  const out: Part[] = [box(-hw, hw, top, top + 0.05, -hd, hd, shade(c, -0.2))];
  const n = Math.round(h / 0.04);
  for (let i = 0; i < n; i++) out.push(box(-hw + 0.01, hw - 0.01, top - (i + 1) * (h / n), top - (i + 1) * (h / n) + 0.008, -hd, hd, i % 2 ? c : shade(c, 0.1)));
  out.push(box(-hw + 0.01, hw - 0.01, top - h - 0.02, top - h, -hd, hd, shade(c, -0.25)), cyl(-hw * 0.7, -hd + 0.01, top - h, top, 0.004, STEEL));
  return out;
};

export const MORE_RECIPES: Record<string, Recipe> = {
  'unit-base': baseUnit('doors'), 'unit-drawers': baseUnit('drawers'), 'unit-hob': baseUnit('hob'), 'unit-sink': baseUnit('sink'), worktop: baseUnit('doors'),
  'unit-corner': cornerOf(0, false), 'unit-wall': wallUnit, 'unit-wall-corner': cornerOf(1.45, true), 'unit-tall': tallUnit,
  'range-hood': rangeHood, oven: ovenTower, 'range-cooker': rangeCooker,
  cooktop, microwave, 'coffee-machine': coffeeMachine, 'rice-cooker': riceCooker, thermomix, kettle, toaster, 'air-fryer': airFryer, 'stand-mixer': standMixer,
  'wardrobe-sliding': wardrobeSliding, 'wardrobe-walkin': wardrobeWalkin, 'wardrobe-fitted': wardrobeFitted,
  'headboard-padded': headboardOf('padded'), 'headboard-wood': headboardOf('wood'), 'headboard-tufted': headboardOf('tufted'),
  'changing-table': changingTable, 'rocking-chair': rockingChair, 'toy-chest': toyChest, 'play-mat': playMat, 'mirror-wall': mirrorWall, 'mirror-floor': mirrorFloor,
  'sofa-u': sofaU, 'sofa-chaise': chaiseOf(1), 'sofa-chaise-left': chaiseOf(-1), 'sofa-curved': sofaRound, recliner, ottoman, 'console-table': consoleTable, 'tv-stand': tvStand, 'tv-wall': tvWall,
  'bar-cart': barCart, 'fireplace-surround': fireplaceSurround, bench: benchOf, banquette, 'breakfast-nook': breakfastNook,
  'bath-corner': bathCorner, 'bath-freestanding': bathFree, 'shower-walkin': showerWalkin, 'towel-rail': towelRail(false), 'towel-rail-heated': towelRail(true), 'vanity-mirror': vanityMirror,
  'column-round': columnRound, 'column-square': columnSquare, beam: ceilingBeam, 'wall-shelf': wallShelf, 'wall-niche': wallNiche,
  pergola, gazebo, carport, awning, 'retaining-wall': retainingWall, 'garden-steps': gardenSteps, 'paving-grid': pavingGrid, 'paving-herringbone': pavingBricks, 'paving-circle': pavingRound,
  'tree-oak': treeOak, 'tree-pine': treePine, 'tree-birch': treeBirch, 'tree-palm': treePalm, 'tree-apple': treeApple, 'tree-cypress': treeCypress,
  'gate-garden': gateGarden, 'gate-driveway': gateDriveway, 'gate-sliding': gateSliding,
  'heat-pump': outdoorUnit(0.1), 'ac-outdoor': outdoorUnit(0.08), 'ac-split': acSplit, boiler, 'wood-stove': woodStove, 'ceiling-fan': ceilingFan, duct, vent, flue, underfloor,
  person: personOf, 'person-child': personOf, dog: animalOf(0.22, true), cat: animalOf(0.1, true), 'dog-bed': petBed, 'cat-tree': catTree, 'pet-bowls': petBowls, 'litter-box': litterBox,
  curtain, 'curtain-sheer': curtainSheer, 'blind-roller': rollerBlind, 'blind-venetian': venetianBlind,
};

void METAL;
void WHITE;
