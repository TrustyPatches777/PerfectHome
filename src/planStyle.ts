/**
 * How the plan is drawn. A design carries a `PlanStyle` (a preset and a few choices that override it); `lookOf` turns that into the concrete
 * colors and options every renderer needs (the canvas, the SVG export and the print), so the presets are defined in ONE place.
 *
 * The colour preset is the plan as it always was: every function here returns its input unchanged for it. The other presets change what is
 * drawn with the colors of the design (rooms, zones, glass, stairs) by `tone`, and the ink the lines are drawn in.
 */
import { shade } from './catalog';
import type { FurnitureDrawing, LabelFont, LineWeight, PlanPreset, PlanStyle, RoomFill, RoomLabels, WallDrawing } from './model';
import { localize } from './i18n';

export const PRESET_LABEL: Record<PlanPreset, string> = { colour: 'Colour', architectural: 'Architectural', blueprint: 'Blueprint' };
localize(PRESET_LABEL, '*');
export const PRESET_HINT: Record<PlanPreset, string> = {
  colour: 'Rooms in their colors and floors, dark walls: the plan as you draw it.',
  architectural: 'Black and white, like a drawing for a permit: solid black walls, empty rooms, plain furniture, capital letters.',
  blueprint: 'White lines on blue: walls and furniture in outline.',
};
localize(PRESET_HINT, '*');

const rgbOf = (hex: string): [number, number, number] => {
  const m = /^#([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(hex.trim());
  if (!m) return [128, 128, 128];
  const h = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};
const toHex = (c: number[]) => `#${c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
/** How light a color is, 0 (black) to 1 (white). */
export const lightness = (hex: string): number => {
  const [r, g, b] = rgbOf(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
};
/** `a` with `t` of `b` mixed in (0 = a, 1 = b). */
export const mix = (a: string, b: string, t: number): string => {
  const x = rgbOf(a);
  const y = rgbOf(b);
  return toHex(x.map((v, i) => v + (y[i] - v) * t));
};
const grey = (hex: string): string => {
  const v = lightness(hex) * 255;
  return toHex([v, v, v]);
};

const FONT_STACK: Record<LabelFont, { canvas: string; svg: string }> = {
  sans: { canvas: 'Arial, sans-serif', svg: 'system-ui, Segoe UI, Arial, sans-serif' },
  serif: { canvas: 'Georgia, "Times New Roman", serif', svg: 'Georgia, Times New Roman, serif' },
  mono: { canvas: 'Consolas, "Courier New", monospace', svg: 'Consolas, Courier New, monospace' },
};
const LINE_FACTOR: Record<LineWeight, number> = { fine: 0.6, normal: 1, heavy: 1.8 };
const LABEL_FACTOR = { small: 0.8, normal: 1, large: 1.3 };

/** What a preset does before any single choice is made. */
interface Base {
  paper: string;
  grid: [string, string, string];
  ink: string;
  ink2: string;
  text: string;
  dim: string;
  walls: WallDrawing;
  rooms: RoomFill;
  furniture: FurnitureDrawing;
  font: LabelFont;
  caps: boolean;
}

const BASE: Record<PlanPreset, Base> = {
  colour: { paper: '#ffffff', grid: ['#eef1f6', '#dde2ea', '#bcc5d3'], ink: '#1f2937', ink2: '#475569', text: '#374151', dim: '#0f766e', walls: 'solid', rooms: 'material', furniture: 'colour', font: 'sans', caps: false },
  architectural: { paper: '#ffffff', grid: ['#f3f3f3', '#e6e6e6', '#cfcfcf'], ink: '#111111', ink2: '#333333', text: '#111111', dim: '#111111', walls: 'solid', rooms: 'none', furniture: 'plain', font: 'sans', caps: true },
  blueprint: { paper: '#1b4b8f', grid: ['#215497', '#2a60a6', '#4a82c4'], ink: '#ffffff', ink2: '#d6e6ff', text: '#ffffff', dim: '#9fd0ff', walls: 'outline', rooms: 'none', furniture: 'outline', font: 'sans', caps: true },
};

export interface Look {
  preset: PlanPreset;
  /** The sheet the plan is drawn on, and its grid lines (fine, every meter, every five). */
  paper: string;
  grid: { minor: string; mid: string; major: string };
  /** Main lines (doors, windows, wall outlines), secondary lines (furniture, stairs, roofs), text, the outline round text, dimensions. */
  ink: string;
  ink2: string;
  text: string;
  halo: string;
  dim: string;
  /** Multiplies the width of lines that are not the walls themselves. */
  lw: number;
  walls: WallDrawing;
  rooms: RoomFill;
  furniture: FurnitureDrawing;
  labels: RoomLabels;
  font: { canvas: string; svg: string };
  labelScale: number;
  caps: boolean;
  /** A color of the design as it is drawn here (the colour preset keeps it; the others make it grey or faint). */
  tone(color: string): string;
  /** The edge of an area or a roof drawn in that color. */
  zoneEdge(color: string): string;
  roofLine(color: string): string;
  /** A solid wall of this (type) color. */
  wallFill(color: string): string;
  /** The two colors of a hatched wall: the ground and the lines. */
  wallHatch(color: string): { base: string; line: string };
  /** The ground of a wall that is drawn as an outline, and the outline itself. */
  wallOutlineFill(color: string): string;
  wallLine: string;
  /** What a room shows when it does not show its material: a color, or 'none'. */
  roomFlat(color: string): string;
  /** The fill of a piece of furniture: its own color, a pale grey, or 'none'. */
  furnFill(color: string): string;
  /** The lines of a room label, in order: name, area, level. */
  roomLabel(name: string, area: string, level?: string): string[];
}

const cache = new Map<string, Look>();

export function lookOf(style?: PlanStyle): Look {
  const key = style ? JSON.stringify(style) : '';
  const hit = cache.get(key);
  if (hit) return hit;
  const preset = style?.preset ?? 'colour';
  const base = BASE[preset];
  const paper = base.paper;
  const dark = preset === 'blueprint';
  const arch = preset === 'architectural';
  const plain = preset === 'colour';
  const font = FONT_STACK[style?.font ?? base.font];
  const labels = style?.labels ?? 'full';
  const caps = base.caps;
  const look: Look = {
    preset,
    paper,
    grid: { minor: base.grid[0], mid: base.grid[1], major: base.grid[2] },
    ink: base.ink,
    ink2: base.ink2,
    text: base.text,
    halo: paper,
    dim: base.dim,
    lw: LINE_FACTOR[style?.lines ?? 'normal'],
    walls: style?.walls ?? base.walls,
    rooms: style?.rooms ?? base.rooms,
    furniture: style?.furniture ?? base.furniture,
    labels,
    font,
    labelScale: LABEL_FACTOR[style?.labelSize ?? 'normal'],
    caps,
    tone: (c) => (plain ? c : arch ? mix(grey(c), '#ffffff', 0.55) : mix(paper, '#ffffff', 0.08 + 0.12 * (1 - lightness(c)))),
    zoneEdge: (c) => (plain ? shade(c, -0.18) : base.ink2),
    roofLine: (c) => (plain ? shade(c, -0.15) : base.ink2),
    wallFill: (c) => (plain ? c : arch ? grey(c) : mix(paper, '#ffffff', 0.9 - 0.7 * lightness(c))),
    wallHatch: (c) => (plain ? { base: c, line: 'rgba(255,255,255,0.45)' } : { base: paper, line: base.ink }),
    wallOutlineFill: (c) => (plain ? mix(c, '#ffffff', 0.85) : paper),
    wallLine: plain ? '#1f2937' : base.ink,
    roomFlat: (c) => (style?.rooms ?? base.rooms) === 'none' ? 'none' : plain ? mix(c, '#ffffff', 0.65) : arch ? mix(grey(c), '#ffffff', 0.7) : mix(paper, '#ffffff', 0.1),
    furnFill: (c) => ((style?.furniture ?? base.furniture) === 'colour' ? c : (style?.furniture ?? base.furniture) === 'outline' ? 'none' : dark ? mix(paper, '#ffffff', 0.1) : mix(grey(c), '#ffffff', 0.75)),
    roomLabel: (name, area, level) => {
      if (labels === 'none') return [];
      const n = caps ? name.toUpperCase() : name;
      return labels === 'name' ? [n] : [n, area, ...(level ? [level] : [])];
    },
  };
  cache.set(key, look);
  return look;
}

/** True when the plan is drawn on something other than white paper (the exports then need a background of their own). */
export const hasPaper = (look: Look): boolean => look.paper.toLowerCase() !== '#ffffff';

const DEFAULT_OF: Required<Omit<PlanStyle, 'preset'>> = { walls: 'solid', rooms: 'material', furniture: 'colour', lines: 'normal', labels: 'full', font: 'sans', labelSize: 'normal' };

/** What a choice is when the preset decides it. */
export function presetDefault<K extends Exclude<keyof PlanStyle, 'preset'>>(preset: PlanPreset, key: K): NonNullable<PlanStyle[K]> {
  const b = BASE[preset];
  const base: Record<string, string> = { walls: b.walls, rooms: b.rooms, furniture: b.furniture, font: b.font };
  return (base[key] ?? DEFAULT_OF[key]) as NonNullable<PlanStyle[K]>;
}

/** A style without the choices that only repeat what the preset does; nothing at all for the plain colour plan. */
export function normalizeStyle(style: PlanStyle): PlanStyle | undefined {
  const out: PlanStyle = { preset: style.preset };
  for (const key of Object.keys(DEFAULT_OF) as (keyof typeof DEFAULT_OF)[]) {
    const v = style[key];
    if (v !== undefined && v !== presetDefault(style.preset, key)) (out as unknown as Record<string, string>)[key] = v;
  }
  return out.preset === 'colour' && Object.keys(out).length === 1 ? undefined : out;
}
