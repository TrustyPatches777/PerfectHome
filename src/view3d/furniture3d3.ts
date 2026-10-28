/**
 * 3D models for the Korean furniture and the winter garden furniture (catalogKorean.ts). Same rules as furniture3d.ts: item-local coordinates,
 * the BACK at -z, y up, the origin in the middle of the footprint, nothing outside the footprint by more than a few centimeters.
 */
import { shade } from '../catalog';
import { ball, beam, box, cyl, light, rod, type Part } from './parts';
import type { Ctx } from './furniture3d';

type Recipe = (k: Ctx) => Part[];

const WOOD = '#a5835a';
const DARKWOOD = '#6b4a2f';
const BRASS = '#c9a24a';
const PAPER = '#f7f0dc';
const STEEL = '#8d96a3';
const BLK = '#1f2937';
const LEAF = '#4f9d5d';
const SOIL = '#6b4f3a';
const POT = '#b7673f';

/** Items of this file that stand on a table or a worktop. */
export const COUNTERTOP_EXTRA = ['kr-rice-cooker', 'kr-tea-set', 'wg-orchid'];

const legs = (x0: number, x1: number, z0: number, z1: number, h: number, c: string, t = 0.05, inset = 0.04): Part[] => [
  box(x0 + inset, x0 + inset + t, 0, h, z0 + inset, z0 + inset + t, c), box(x1 - inset - t, x1 - inset, 0, h, z0 + inset, z0 + inset + t, c),
  box(x0 + inset, x0 + inset + t, 0, h, z1 - inset - t, z1 - inset, c), box(x1 - inset - t, x1 - inset, 0, h, z1 - inset - t, z1 - inset, c),
];

// ---- Korean ------------------------------------------------------------------------------------------------------------------

const soban: Recipe = ({ hw, hd, h, c }) => [
  box(-hw, hw, h - 0.04, h, -hd, hd, c), box(-hw, hw, h, h + 0.025, -hd, -hd + 0.025, shade(c, -0.15)), box(-hw, hw, h, h + 0.025, hd - 0.025, hd, shade(c, -0.15)),
  box(-hw, -hw + 0.025, h, h + 0.025, -hd, hd, shade(c, -0.15)), box(hw - 0.025, hw, h, h + 0.025, -hd, hd, shade(c, -0.15)),
  ...legs(-hw, hw, -hd, hd, h - 0.04, shade(c, -0.2), 0.045, 0.03),
];

const lowTable: Recipe = ({ hw, hd, h, c }) => [box(-hw, hw, h - 0.05, h, -hd, hd, c), box(-hw + 0.04, hw - 0.04, h - 0.1, h - 0.05, -hd + 0.04, hd - 0.04, shade(c, -0.2)), ...legs(-hw, hw, -hd, hd, h - 0.1, shade(c, -0.25), 0.06, 0.05)];

const bbqTable: Recipe = ({ hw, hd, h, c, ceil }) => [
  box(-hw, hw, h - 0.05, h, -hd, hd, c), ...legs(-hw, hw, -hd, hd, h - 0.05, shade(c, -0.2), 0.06, 0.05),
  cyl(0, 0, h - 0.04, h + 0.02, Math.min(hw, hd) * 0.55, BLK), cyl(0, 0, h + 0.02, h + 0.025, Math.min(hw, hd) * 0.5, '#9ca3af'),
  cyl(0, 0, h + 0.6, ceil, 0.045, STEEL), cyl(0, 0, h + 0.3, h + 0.6, 0.18, '#d1d5db', 0.045),
];

const floorCushion: Recipe = ({ hw, hd, h, c }) => [box(-hw, hw, 0, h, -hd, hd, c), box(-hw + 0.04, hw - 0.04, h, h + 0.02, -hd + 0.04, hd - 0.04, shade(c, 0.25)), ball(0, h + 0.02, 0, 0.025, 0.012, 0.025, BRASS)];

const floorChair: Recipe = ({ hw, hd, h, c }) => [
  box(-hw, hw, 0.03, 0.12, -hd + 0.15, hd, shade(c, -0.2)), box(-hw + 0.03, hw - 0.03, 0.12, 0.2, -hd + 0.15, hd - 0.03, c),
  box(-hw + 0.03, hw - 0.03, 0.12, h, -hd, -hd + 0.14, c), box(-hw + 0.08, hw - 0.08, 0.2, h - 0.08, -hd + 0.14, -hd + 0.17, shade(c, 0.2)),
];

const yo: Recipe = ({ hw, hd, h, c }) => [
  box(-hw, hw, 0, h * 0.5, -hd, hd, shade(c, 0.1)), box(-hw + 0.03, hw - 0.03, h * 0.5, h * 0.85, -hd + 0.03, hd - 0.03, '#fafaf9'),
  box(-hw + 0.03, hw - 0.03, h * 0.85, h, -hd * 0.15, hd - 0.03, c), box(-hw * 0.7, hw * 0.7, h * 0.85, h + 0.07, -hd + 0.05, -hd + 0.32, '#f3efe6'),
];

const chest: Recipe = ({ hw, hd, h, c }) => {
  const out: Part[] = [box(-hw, hw, 0.1, h, -hd, hd - 0.02, c), box(-hw + 0.04, -hw + 0.1, 0, 0.1, -hd + 0.05, hd - 0.1, DARKWOOD), box(hw - 0.1, hw - 0.04, 0, 0.1, -hd + 0.05, hd - 0.1, DARKWOOD)];
  out.push(box(-hw, hw, h * 0.52, h * 0.52 + 0.012, hd - 0.02, hd, shade(c, -0.35)), box(-0.004, 0.004, 0.14, h - 0.04, hd - 0.02, hd, shade(c, -0.35)));
  for (const y of [h * 0.28, h * 0.76]) {
    out.push(box(-hw * 0.5 - 0.06, -hw * 0.5 + 0.06, y - 0.06, y + 0.06, hd - 0.012, hd + 0.004, BRASS), box(hw * 0.5 - 0.06, hw * 0.5 + 0.06, y - 0.06, y + 0.06, hd - 0.012, hd + 0.004, BRASS));
    out.push(ball(-hw * 0.5, y, hd + 0.004, 0.025, 0.025, 0.012, shade(BRASS, -0.2)), ball(hw * 0.5, y, hd + 0.004, 0.025, 0.025, 0.012, shade(BRASS, -0.2)));
  }
  out.push(box(-hw, -hw + 0.03, 0.1, h, hd - 0.02, hd, BRASS), box(hw - 0.03, hw, 0.1, h, hd - 0.02, hd, BRASS));
  return out;
};

const lowCabinet: Recipe = ({ hw, hd, h, c }) => [
  box(-hw, hw, 0.08, h, -hd, hd - 0.02, c), box(-hw + 0.03, hw - 0.03, 0, 0.08, -hd + 0.03, hd - 0.1, DARKWOOD), box(-hw - 0.01, hw + 0.01, h, h + 0.03, -hd, hd, shade(c, -0.15)),
  box(-0.004, 0.004, 0.1, h - 0.02, hd - 0.02, hd, shade(c, -0.35)),
  box(-hw * 0.5 - 0.05, -hw * 0.5 + 0.05, h * 0.5 - 0.1, h * 0.5 + 0.1, hd - 0.012, hd + 0.004, BRASS), box(hw * 0.5 - 0.05, hw * 0.5 + 0.05, h * 0.5 - 0.1, h * 0.5 + 0.1, hd - 0.012, hd + 0.004, BRASS),
];

const medicineChest: Recipe = ({ hw, hd, h, c }) => {
  const out: Part[] = [box(-hw, hw, 0.05, h, -hd, hd - 0.01, c), box(-hw + 0.03, -hw + 0.08, 0, 0.05, -hd + 0.03, hd - 0.05, DARKWOOD), box(hw - 0.08, hw - 0.03, 0, 0.05, -hd + 0.03, hd - 0.05, DARKWOOD)];
  const nx = 4;
  const ny = 5;
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
    const x = -hw * 0.84 + ((hw * 1.68) * (i + 0.5)) / nx;
    const y = 0.1 + ((h - 0.16) * (j + 0.5)) / ny;
    out.push(box(x - 0.045, x + 0.045, y - 0.045, y + 0.045, hd - 0.012, hd, shade(c, 0.12)), ball(x, y, hd + 0.002, 0.012, 0.012, 0.008, BRASS));
  }
  return out;
};

const foldingScreen: Recipe = ({ hw, hd, h, c }) => {
  const n = 6;
  const out: Part[] = [];
  for (let i = 0; i < n; i++) {
    const x0 = -hw + (2 * hw * i) / n;
    const x1 = -hw + (2 * hw * (i + 1)) / n;
    const z0 = i % 2 ? hd - 0.03 : -hd + 0.03;
    const z1 = i % 2 ? -hd + 0.03 : hd - 0.03;
    const len = Math.hypot(x1 - x0, z1 - z0);
    const mid = { x: (x0 + x1) / 2, z: (z0 + z1) / 2 };
    const ry = -Math.atan2(z1 - z0, x1 - x0);
    out.push({ t: 'box', x: mid.x, y: h / 2, z: mid.z, sx: len, sy: h, sz: 0.03, ry, color: c }, { t: 'box', x: mid.x, y: h / 2, z: mid.z, sx: len - 0.08, sy: h - 0.1, sz: 0.036, ry, color: i % 2 ? '#d8c8a0' : '#e6d8b4' });
  }
  return out;
};

const hanjiPanel = (leaves: number): Recipe => ({ hw, hd, h }) => {
  const out: Part[] = [box(-hw, hw, 0, 0.05, -hd, hd, DARKWOOD), box(-hw, hw, h - 0.05, h, -hd, hd, DARKWOOD)];
  const w = (2 * hw) / leaves;
  for (let k = 0; k < leaves; k++) {
    const x0 = -hw + w * k;
    const x1 = x0 + w;
    const z = k % 2 ? hd * 0.4 : -hd * 0.4;
    const zz = Math.abs(z) < 1e-9 ? 0 : z;
    out.push(box(x0, x0 + 0.04, 0.05, h - 0.05, zz - hd * 0.4, zz + hd * 0.4, DARKWOOD), box(x1 - 0.04, x1, 0.05, h - 0.05, zz - hd * 0.4, zz + hd * 0.4, DARKWOOD));
    out.push(box(x0 + 0.04, x1 - 0.04, 0.06, h - 0.06, zz - 0.004, zz + 0.004, PAPER, { glass: true }));
    const bars = Math.max(2, Math.round(w / 0.3));
    for (let i = 1; i < bars; i++) out.push(box(x0 + (w * i) / bars - 0.01, x0 + (w * i) / bars + 0.01, 0.05, h - 0.05, zz - hd * 0.4, zz + hd * 0.4, DARKWOOD));
    for (let j = 1; j < 6; j++) out.push(box(x0 + 0.04, x1 - 0.04, 0.05 + ((h - 0.1) * j) / 6 - 0.01, 0.05 + ((h - 0.1) * j) / 6 + 0.01, zz - hd * 0.4, zz + hd * 0.4, DARKWOOD));
  }
  return out;
};

const kimchiFridge: Recipe = ({ hw, hd, h, c }) => [
  box(-hw, hw, 0.06, h, -hd, hd - 0.02, c), box(-hw + 0.04, hw - 0.04, 0, 0.06, -hd + 0.04, hd - 0.1, BLK),
  box(-hw + 0.03, hw - 0.03, h * 0.5 + 0.02, h - 0.04, hd - 0.022, hd, shade(c, -0.08)), box(-hw + 0.03, hw - 0.03, 0.1, h * 0.5 - 0.02, hd - 0.022, hd, shade(c, -0.08)),
  box(hw - 0.1, hw - 0.08, h * 0.5 - 0.2, h * 0.5 + 0.2, hd, hd + 0.025, STEEL), box(hw - 0.1, hw - 0.08, h * 0.5 + 0.2, h * 0.5 + 0.5, hd, hd + 0.025, STEEL),
  box(-hw * 0.4, hw * 0.4, h - 0.18, h - 0.1, hd - 0.004, hd + 0.003, '#0b1220'),
];

const onggi: Recipe = ({ hw, hd, h, c }) => {
  const jar = (x: number, z: number, r: number, hh: number, col: string): Part[] => [
    cyl(x, z, 0, 0.04, r * 0.55, shade(col, -0.2)), ball(x, hh * 0.45, z, r, hh * 0.38, r, col), cyl(x, z, hh * 0.72, hh * 0.86, r * 0.6, col, r * 0.45), cyl(x, z, hh * 0.86, hh * 0.92, r * 0.7, shade(col, 0.15)),
  ];
  return [...jar(-hw * 0.55, hd * 0.2, Math.min(hw * 0.4, hd * 0.8), h * 0.9, c), ...jar(hw * 0.1, -hd * 0.3, Math.min(hw * 0.42, hd * 0.8), h, shade(c, -0.08)), ...jar(hw * 0.65, hd * 0.25, Math.min(hw * 0.34, hd * 0.7), h * 0.8, shade(c, 0.08))];
};

const riceCooker: Recipe = ({ hw, hd, h, c }) => [
  box(-hw + 0.02, hw - 0.02, 0, h * 0.62, -hd + 0.02, hd - 0.02, c), ball(0, h * 0.62, 0, hw * 0.88, h * 0.34, hd * 0.88, shade(c, 0.05)),
  box(-hw * 0.5, hw * 0.5, h * 0.14, h * 0.34, hd - 0.04, hd - 0.02, '#0b1220'), box(-0.04, 0.04, h * 0.95, h, -0.03, 0.03, BLK), cyl(hw * 0.6, hd * 0.2, h * 0.9, h * 0.97, 0.025, STEEL),
];

const teaSet: Recipe = ({ hw, hd, c }) => [
  box(-hw, hw, 0, 0.03, -hd, hd, c), ball(hw * 0.4, 0.1, 0, 0.07, 0.07, 0.07, '#e5e7eb'), box(hw * 0.55, hw * 0.75, 0.07, 0.09, -0.01, 0.01, '#e5e7eb'),
  cyl(-hw * 0.5, -hd * 0.3, 0.03, 0.07, 0.03, '#f8fafc', 0.04), cyl(-hw * 0.5, hd * 0.35, 0.03, 0.07, 0.03, '#f8fafc', 0.04), cyl(-hw * 0.1, 0, 0.03, 0.06, 0.04, '#cbd5e1'),
];

const shoeCabinet: Recipe = ({ hw, hd, h, c }) => {
  const out: Part[] = [box(-hw, hw, 0.12, h, -hd, hd - 0.02, c), box(-hw + 0.03, hw - 0.03, 0, 0.12, -hd + 0.03, hd - 0.1, BLK)];
  for (let i = 0; i < 3; i++) {
    const x0 = -hw + (2 * hw * i) / 3;
    const x1 = -hw + (2 * hw * (i + 1)) / 3;
    out.push(box(x0 + 0.015, x1 - 0.015, 0.16, h - 0.04, hd - 0.022, hd, shade(c, -0.06)), box((x0 + x1) / 2 - 0.1, (x0 + x1) / 2 + 0.1, 0.18, 0.2, hd, hd + 0.02, STEEL));
  }
  return out;
};

const hanbokStand: Recipe = ({ hw, hd, h, c }) => [
  cyl(0, 0, 0, 0.04, hw * 0.45, DARKWOOD), cyl(0, 0, 0.04, h, 0.018, DARKWOOD),
  cyl(0, 0, 0.4, 1.05, hw * 0.98, c, hw * 0.35, { rz: hd * 0.98 }),
  box(-hw * 0.4, hw * 0.4, 1.05, 1.3, -hd * 0.3, hd * 0.3, shade(c, 0.35)), box(-hw, -hw * 0.35, 1.0, 1.28, -hd * 0.22, hd * 0.22, shade(c, 0.35)), box(hw * 0.35, hw, 1.0, 1.28, -hd * 0.22, hd * 0.22, shade(c, 0.35)),
  box(-hw * 0.4, hw * 0.4, 1.28, 1.3, hd * 0.05, hd * 0.2, '#7f1d1d'), ball(0, h - 0.04, 0, 0.05, 0.05, 0.05, DARKWOOD),
];

const lantern: Recipe = ({ hw, hd, h, c, on }) => [
  cyl(0, 0, 0, 0.04, hw * 0.5, DARKWOOD), cyl(0, 0, 0.04, 0.5, 0.02, DARKWOOD),
  box(-hw * 0.7, hw * 0.7, 0.5, 0.5 + (h - 0.5), -hd * 0.7, hd * 0.7, PAPER, { glass: true, glow: on }), box(-hw * 0.74, -hw * 0.66, 0.5, h, -hd * 0.74, -hd * 0.66, DARKWOOD), box(hw * 0.66, hw * 0.74, 0.5, h, -hd * 0.74, -hd * 0.66, DARKWOOD),
  box(-hw * 0.74, -hw * 0.66, 0.5, h, hd * 0.66, hd * 0.74, DARKWOOD), box(hw * 0.66, hw * 0.74, 0.5, h, hd * 0.66, hd * 0.74, DARKWOOD), box(-hw * 0.76, hw * 0.76, h, h + 0.03, -hd * 0.76, hd * 0.76, DARKWOOD),
  ...(on ? [light(0, 0.9, 0, c, 0.8, 3)] : []),
];

const baduk: Recipe = ({ hw, hd, h, c }) => {
  const out: Part[] = [box(-hw, hw, 0.04, h, -hd, hd, c), ...legs(-hw, hw, -hd, hd, 0.04, DARKWOOD, 0.05, 0.02)];
  for (let i = 0; i < 9; i++) {
    const x = -hw * 0.85 + (hw * 1.7 * i) / 8;
    out.push(box(x - 0.002, x + 0.002, h, h + 0.002, -hd * 0.85, hd * 0.85, BLK), box(-hw * 0.85, hw * 0.85, h, h + 0.002, -hd * 0.85 + (hd * 1.7 * i) / 8 - 0.002, -hd * 0.85 + (hd * 1.7 * i) / 8 + 0.002, BLK));
  }
  out.push(ball(-0.06, h + 0.008, -0.06, 0.012, 0.007, 0.012, BLK), ball(0.04, h + 0.008, 0.02, 0.012, 0.007, 0.012, '#f5f5f4'), ball(-0.1, h + 0.008, 0.1, 0.012, 0.007, 0.012, '#f5f5f4'), ball(0.1, h + 0.008, -0.08, 0.012, 0.007, 0.012, BLK));
  return out;
};

const gayageum: Recipe = ({ hw, hd, h, c }) => {
  const out: Part[] = [box(-hw, hw, 0.04, h - 0.04, -hd, hd, c), box(-hw, hw, h - 0.04, h - 0.02, -hd, hd, shade(c, 0.12)), ...legs(-hw, -hw + 0.1, -hd, hd, 0.04, DARKWOOD, 0.04, 0.0)];
  for (let i = 0; i < 12; i++) {
    const z = -hd * 0.8 + (hd * 1.6 * i) / 11;
    out.push(box(-hw + 0.1, hw - 0.1, h - 0.02, h - 0.016, z - 0.002, z + 0.002, '#e5e7eb'), box(-hw * 0.2 + i * 0.012 - 0.01, -hw * 0.2 + i * 0.012 + 0.01, h - 0.02, h + 0.02, z - 0.012, z + 0.012, '#f8fafc'));
  }
  return out;
};

const ondol: Recipe = ({ hw, hd, c }) => {
  const out: Part[] = [box(-hw, hw, 0, 0.004, -hd, hd, shade(c, 0.55))];
  const rows = [0.1, 0.27, 0.44, 0.61, 0.78];
  rows.forEach((f, i) => {
    const z = -hd + 2 * hd * f;
    out.push(box(-hw * 0.84, hw * 0.84, 0.004, 0.012, z - 0.02, z + 0.02, c));
    if (i < rows.length - 1) out.push(box(i % 2 ? -hw * 0.84 : hw * 0.84 - 0.04, i % 2 ? -hw * 0.84 + 0.04 : hw * 0.84, 0.004, 0.012, z, -hd + 2 * hd * rows[i + 1], c));
  });
  return out;
};

// ---- winter garden ----------------------------------------------------------------------------------------------------------

const weave = (c: string, i: number) => (i % 2 ? shade(c, -0.08) : c);

const rattanSofa: Recipe = ({ hw, hd, h, c }) => [
  ...legs(-hw, hw, -hd, hd, 0.12, DARKWOOD, 0.05, 0.03),
  box(-hw, hw, 0.12, 0.38, -hd, hd, c), box(-hw + 0.1, hw - 0.1, 0.38, 0.5, -hd + 0.2, hd - 0.03, '#f1e8d8'),
  box(-hw, hw, 0.38, h, -hd, -hd + 0.14, c), box(-hw, -hw + 0.12, 0.38, 0.62, -hd + 0.14, hd, c), box(hw - 0.12, hw, 0.38, 0.62, -hd + 0.14, hd, c),
  ...Array.from({ length: 8 }, (_, i) => box(-hw + 0.03, hw - 0.03, 0.4 + i * 0.045, 0.4 + i * 0.045 + 0.012, -hd + 0.14, -hd + 0.15, weave(c, i))),
  box(-hw + 0.12, -0.02, 0.5, 0.78, -hd + 0.15, -hd + 0.3, '#f1e8d8'), box(0.02, hw - 0.12, 0.5, 0.78, -hd + 0.15, -hd + 0.3, '#f1e8d8'),
];

const rattanChair: Recipe = ({ hw, hd, h, c }) => [
  cyl(0, 0, 0.1, 0.4, hw * 0.9, c, undefined, { rz: hd * 0.9 }), cyl(0, 0, 0.4, 0.48, hw * 0.78, '#f1e8d8', undefined, { rz: hd * 0.78 }),
  ball(0, 0.6, -hd * 0.55, hw * 0.85, h * 0.4, hd * 0.3, c), ...[[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]].map(([x, z]) => cyl(x * hw, z * hd, 0, 0.1, 0.03, DARKWOOD)),
];

const bistroSet: Recipe = ({ hw }) => {
  const chair = (x: number, face: number): Part[] => [
    box(x - 0.2, x + 0.2, 0.42, 0.45, -0.2, 0.2, BLK), box(x - 0.2, x - 0.17, 0, 0.42, -0.2, -0.17, BLK), box(x + 0.17, x + 0.2, 0, 0.42, -0.2, -0.17, BLK), box(x - 0.2, x - 0.17, 0, 0.42, 0.17, 0.2, BLK), box(x + 0.17, x + 0.2, 0, 0.42, 0.17, 0.2, BLK),
    box(x + face * 0.17 - 0.015, x + face * 0.17 + 0.015, 0.45, 0.85, -0.2, 0.2, BLK),
  ];
  return [
    cyl(0, 0, 0.72, 0.75, 0.32, '#e5e7eb'), cyl(0, 0, 0.04, 0.72, 0.025, BLK), cyl(0, 0, 0, 0.04, 0.2, BLK), ring0(0, 0.75),
    ...chair(-hw + 0.25, -1), ...chair(hw - 0.25, 1),
  ];
};
const ring0 = (x: number, y: number): Part => rod(x, y, 0, 0.64, 0.012, 'x', BLK);

const daybed: Recipe = ({ hw, hd, h, c }) => [
  ...legs(-hw, hw, -hd, hd, 0.12, DARKWOOD, 0.06, 0.03), box(-hw, hw, 0.12, 0.3, -hd, hd, WOOD), box(-hw + 0.04, hw - 0.04, 0.3, 0.45, -hd + 0.04, hd - 0.04, c),
  box(-hw, hw, 0.3, h, -hd, -hd + 0.06, WOOD), box(-hw + 0.1, -hw * 0.1, 0.45, 0.62, -hd + 0.1, -hd + 0.36, '#fafaf9'), box(hw * 0.1, hw - 0.1, 0.45, 0.62, -hd + 0.1, -hd + 0.36, '#e8d9b8'),
];

const plantStand: Recipe = ({ hw, hd, h, c }) => {
  const out: Part[] = [box(-hw, -hw + 0.04, 0, h, -hd, hd, c), box(hw - 0.04, hw, 0, h, -hd, hd, c)];
  for (const y of [0.35, 0.75, 1.15]) out.push(box(-hw, hw, y, y + 0.03, -hd, hd, c));
  for (const [y, n] of [[0.38, 3], [0.78, 3], [1.18, 2]] as const) for (let i = 0; i < n; i++) {
    const x = -hw + 0.16 + (i * (2 * hw - 0.32)) / Math.max(1, n - 1);
    out.push(cyl(x, 0, y, y + 0.14, 0.07, POT, 0.055), ball(x, y + 0.22, 0, 0.1, 0.1, 0.1, LEAF));
  }
  return out;
};

const planter: Recipe = ({ hw, hd, h, c }) => [
  box(-hw, hw, 0.05, h, -hd, hd, c), box(-hw + 0.03, hw - 0.03, h - 0.04, h, -hd + 0.03, hd - 0.03, SOIL), box(-hw + 0.04, hw - 0.04, 0, 0.05, -hd + 0.04, hd - 0.04, DARKWOOD),
  ...[-0.62, -0.2, 0.22, 0.62].map((f, i) => ball(f * hw, h + 0.14, 0, hw * 0.2, 0.18, hd * 0.8, i % 2 ? '#3f8f4f' : LEAF)),
];

const palmPot: Recipe = ({ hw, hd, h }) => {
  const out: Part[] = [cyl(0, 0, 0, 0.4, hw * 0.35, POT, hw * 0.28), cyl(0, 0, 0.4, 1.7, 0.04, '#8b6b4a', 0.03)];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    out.push(beam([0, 1.65, 0], [Math.cos(a) * hw * 0.95, 1.2 + (i % 3) * 0.12, Math.sin(a) * hd * 0.95], 0.2, 0.03, i % 2 ? '#3f8f4f' : LEAF));
  }
  out.push(beam([0, 1.7, 0], [0, h, 0], 0.18, 0.03, LEAF));
  return out;
};

const ficus: Recipe = ({ hw, hd, h }) => [
  cyl(0, 0, 0, 0.45, hw * 0.35, POT, hw * 0.3), cyl(0, 0, 0.45, h * 0.6, 0.05, '#7c5d3e', 0.035),
  ball(0, h * 0.72, 0, hw * 0.8, h * 0.22, hd * 0.8, LEAF), ball(hw * 0.25, h * 0.6, hd * 0.2, hw * 0.5, h * 0.14, hd * 0.5, '#3f8f4f'), ball(-hw * 0.3, h * 0.65, -hd * 0.2, hw * 0.45, h * 0.16, hd * 0.45, '#5da35d'), ball(0, h * 0.88, 0, hw * 0.5, h * 0.1, hd * 0.5, LEAF),
];

const citrus: Recipe = ({ hw, hd, h }) => [
  cyl(0, 0, 0, 0.4, hw * 0.4, POT, hw * 0.33), cyl(0, 0, 0.4, h * 0.55, 0.035, '#7c5d3e', 0.03),
  ball(0, h * 0.72, 0, hw * 0.85, h * 0.25, hd * 0.85, '#5da35d'), ball(hw * 0.3, h * 0.62, hd * 0.2, hw * 0.5, h * 0.15, hd * 0.5, '#3f8f4f'),
  ...[[0.4, 0.62, 0.45], [-0.45, 0.7, 0.2], [0.1, 0.55, -0.55], [-0.2, 0.8, 0.4]].map(([x, y, z]) => ball(x * hw, h * y, z * hd, 0.05, 0.06, 0.05, '#facc15')),
];

const fountain: Recipe = ({ hw, hd, h, c }) => [
  cyl(0, 0, 0, 0.35, hw, c, undefined, { rz: hd }), cyl(0, 0, 0.3, 0.36, hw * 0.86, '#93c5fd', undefined, { rz: hd * 0.86, glass: true }),
  cyl(0, 0, 0.35, h * 0.62, hw * 0.12, shade(c, -0.1)), cyl(0, 0, h * 0.55, h * 0.62, hw * 0.55, c, undefined, { rz: hd * 0.55 }), cyl(0, 0, h * 0.62, h * 0.9, hw * 0.07, shade(c, -0.1)), ball(0, h * 0.92, 0, 0.06, 0.04, 0.06, '#e0f2fe'),
];

const pottingBench: Recipe = ({ hw, hd, h, c }) => [
  box(-hw, hw, h - 0.05, h, -hd, hd, c), ...legs(-hw, hw, -hd, hd, h - 0.05, shade(c, -0.15), 0.06, 0.03), box(-hw + 0.04, hw - 0.04, 0.25, 0.28, -hd + 0.04, hd - 0.04, shade(c, -0.1)),
  cyl(-hw * 0.6, 0, h, h + 0.14, 0.07, POT, 0.055), ball(-hw * 0.6, h + 0.22, 0, 0.1, 0.1, 0.1, LEAF), cyl(-hw * 0.25, 0.05, h, h + 0.1, 0.06, POT, 0.045), box(hw * 0.3, hw * 0.8, h, h + 0.06, -hd * 0.5, hd * 0.5, '#374151'),
  cyl(-hw * 0.7, 0, 0.28, 0.42, 0.08, POT, 0.06), cyl(hw * 0.4, 0, 0.28, 0.4, 0.07, POT, 0.05),
];

const hangingBasket: Recipe = ({ hw, ceil, c }) => [
  cyl(0, 0, ceil - 0.6, ceil, 0.006, STEEL), ball(0, ceil - 0.65, 0, hw * 0.95, 0.14, hw * 0.95, '#8b6b4a'), ball(0, ceil - 0.55, 0, hw * 0.98, 0.16, hw * 0.98, c),
  ...[[-0.5, 0.1], [0.4, -0.3], [0.1, 0.55]].map(([x, z]) => cyl(x * hw, z * hw, ceil - 0.9, ceil - 0.62, 0.012, LEAF)),
];

const orchid: Recipe = ({ hw, hd, h, c }) => [
  cyl(0, 0, 0, 0.12, hw * 0.7, '#e5e7eb', hw * 0.6), cyl(0, 0, 0.12, h, 0.008, LEAF),
  ...[[0, 0.38], [0.02, 0.48], [-0.02, 0.58]].map(([x, y]) => ball(x, y, 0, 0.04, 0.03, 0.04, c)), ball(0, 0.15, 0, hw * 0.6, 0.02, hd * 0.6, LEAF),
];

const birdcage: Recipe = ({ hw, hd, h }) => {
  const out: Part[] = [cyl(0, 0, 0, 0.04, hw * 0.55, BLK), cyl(0, 0, 0.04, 1.05, 0.015, BLK), cyl(0, 0, 1.05, 1.08, hw * 0.4, BLK)];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    out.push(cyl(Math.cos(a) * hw * 0.38, Math.sin(a) * hd * 0.38, 1.08, h - 0.15, 0.004, '#d6c28a'));
  }
  out.push(cyl(0, 0, h - 0.15, h - 0.05, hw * 0.4, '#d6c28a', 0.03), ball(0, h - 0.02, 0, 0.03, 0.03, 0.03, '#d6c28a'), box(-0.04, 0.04, 1.3, 1.34, -0.01, 0.01, DARKWOOD));
  return out;
};

export const EXTRA_RECIPES: Record<string, Recipe> = {
  'kr-soban': soban, 'kr-low-table': lowTable, 'kr-bbq-table': bbqTable, 'kr-floor-cushion': floorCushion, 'kr-floor-chair': floorChair, 'kr-yo': yo,
  'kr-chest': chest, 'kr-cabinet': lowCabinet, 'kr-medicine-chest': medicineChest, 'kr-screen': foldingScreen, 'kr-hanji-door': hanjiPanel(1), 'kr-hanji-screen': hanjiPanel(2),
  'kr-kimchi-fridge': kimchiFridge, 'kr-onggi': onggi, 'kr-rice-cooker': riceCooker, 'kr-tea-set': teaSet, 'kr-shoe-cabinet': shoeCabinet, 'kr-hanbok-stand': hanbokStand,
  'kr-lantern': lantern, 'kr-baduk': baduk, 'kr-gayageum': gayageum, 'kr-ondol': ondol,
  'wg-rattan-sofa': rattanSofa, 'wg-rattan-chair': rattanChair, 'wg-bistro-set': bistroSet, 'wg-daybed': daybed, 'wg-plant-stand': plantStand, 'wg-planter': planter,
  'wg-palm': palmPot, 'wg-ficus': ficus, 'wg-citrus': citrus, 'wg-fountain': fountain, 'wg-potting-bench': pottingBench, 'wg-hanging-basket': hangingBasket,
  'wg-orchid': orchid, 'wg-birdcage': birdcage,
};



