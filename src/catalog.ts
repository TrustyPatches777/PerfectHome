/**
 * Furniture catalog. Each symbol is a list of simple shapes in NORMALIZED coordinates (0..1 across the
 * item's width/depth), so it scales to any size, and doubles as the palette thumbnail.
 * Sizes are real-world meters. Add an item here and it appears in the palette automatically.
 */

export type Fill = 'body' | 'dark' | 'light' | 'white' | 'none';

export type Prim =
  | { t: 'rect'; x: number; y: number; w: number; h: number; r?: number; fill?: Fill }
  | { t: 'ellipse'; x: number; y: number; w: number; h: number; fill?: Fill }
  /** Open polyline. */
  | { t: 'line'; pts: number[] };

export type Category = 'Bedroom' | 'Living' | 'Kitchen & dining' | 'Office' | 'Bathroom' | 'Other';

export interface CatalogItem {
  type: string;
  label: string;
  category: Category;
  /** Default width (x) and depth (y) in meters. */
  w: number;
  d: number;
  color: string;
  shapes: Prim[];
}

const R = (x: number, y: number, w: number, h: number, fill: Fill = 'body', r = 0): Prim => ({ t: 'rect', x, y, w, h, fill, r });
const E = (x: number, y: number, w: number, h: number, fill: Fill = 'body'): Prim => ({ t: 'ellipse', x, y, w, h, fill });
const L = (...pts: number[]): Prim => ({ t: 'line', pts });

const pillowsDouble = [R(0.08, 0.04, 0.39, 0.16, 'light', 0.3), R(0.53, 0.04, 0.39, 0.16, 'light', 0.3)];

export const CATALOG: CatalogItem[] = [
  // ---- Bedroom
  {
    type: 'bed-double', label: 'Double bed', category: 'Bedroom', w: 1.6, d: 2.0, color: '#c7d7ee',
    shapes: [R(0, 0, 1, 1, 'body'), R(0.04, 0.03, 0.92, 0.94, 'white'), ...pillowsDouble, R(0.04, 0.27, 0.92, 0.7, 'body'), L(0.04, 0.27, 0.96, 0.27)],
  },
  {
    type: 'bed-single', label: 'Single bed', category: 'Bedroom', w: 0.9, d: 2.0, color: '#c7d7ee',
    shapes: [R(0, 0, 1, 1, 'body'), R(0.05, 0.03, 0.9, 0.94, 'white'), R(0.12, 0.04, 0.76, 0.16, 'light', 0.3), R(0.05, 0.27, 0.9, 0.7, 'body'), L(0.05, 0.27, 0.95, 0.27)],
  },
  {
    type: 'bedside', label: 'Bedside table', category: 'Bedroom', w: 0.45, d: 0.4, color: '#d9c7b0',
    shapes: [R(0, 0, 1, 1, 'body', 0.1), E(0.3, 0.25, 0.4, 0.5, 'light')],
  },
  {
    type: 'wardrobe', label: 'Wardrobe', category: 'Bedroom', w: 1.8, d: 0.6, color: '#d9c7b0',
    shapes: [R(0, 0, 1, 1, 'body'), L(0.5, 0, 0.5, 1), L(0.25, 0, 0.25, 1), L(0.75, 0, 0.75, 1), R(0.45, 0.4, 0.015, 0.2, 'dark'), R(0.54, 0.4, 0.015, 0.2, 'dark')],
  },
  {
    type: 'dresser', label: 'Dresser', category: 'Bedroom', w: 1.2, d: 0.5, color: '#d9c7b0',
    shapes: [R(0, 0, 1, 1, 'body'), L(0.33, 0.08, 0.33, 0.92), L(0.66, 0.08, 0.66, 0.92), L(0, 0.5, 1, 0.5)],
  },
  // ---- Living
  {
    type: 'sofa', label: 'Sofa', category: 'Living', w: 2.0, d: 0.9, color: '#b7c9a8',
    shapes: [R(0, 0, 1, 1, 'body', 0.12), R(0, 0, 1, 0.28, 'dark', 0.12), R(0, 0.2, 0.1, 0.8, 'dark', 0.2), R(0.9, 0.2, 0.1, 0.8, 'dark', 0.2), R(0.11, 0.3, 0.26, 0.66, 'light', 0.1), R(0.37, 0.3, 0.26, 0.66, 'light', 0.1), R(0.63, 0.3, 0.26, 0.66, 'light', 0.1)],
  },
  {
    type: 'armchair', label: 'Armchair', category: 'Living', w: 0.85, d: 0.85, color: '#e6c9c9',
    shapes: [R(0, 0, 1, 1, 'body', 0.14), R(0, 0, 1, 0.28, 'dark', 0.14), R(0, 0.2, 0.15, 0.8, 'dark', 0.25), R(0.85, 0.2, 0.15, 0.8, 'dark', 0.25), R(0.17, 0.3, 0.66, 0.66, 'light', 0.12)],
  },
  {
    type: 'coffee-table', label: 'Coffee table', category: 'Living', w: 1.1, d: 0.6, color: '#d9c7b0',
    shapes: [R(0, 0, 1, 1, 'body', 0.08), R(0.07, 0.12, 0.86, 0.76, 'light', 0.05)],
  },
  {
    type: 'tv-unit', label: 'TV unit', category: 'Living', w: 1.6, d: 0.4, color: '#9ca3af',
    shapes: [R(0, 0, 1, 1, 'body'), R(0.2, 0.15, 0.6, 0.12, 'dark')],
  },
  {
    type: 'bookshelf', label: 'Bookshelf', category: 'Living', w: 0.9, d: 0.3, color: '#d9c7b0',
    shapes: [R(0, 0, 1, 1, 'body'), L(0.2, 0, 0.2, 1), L(0.4, 0, 0.4, 1), L(0.6, 0, 0.6, 1), L(0.8, 0, 0.8, 1)],
  },
  {
    type: 'rug', label: 'Rug', category: 'Living', w: 2.0, d: 1.4, color: '#e8d5b5',
    shapes: [R(0, 0, 1, 1, 'body', 0.04), R(0.05, 0.07, 0.9, 0.86, 'none', 0.03)],
  },
  // ---- Kitchen & dining
  {
    type: 'dining-table', label: 'Dining table', category: 'Kitchen & dining', w: 1.6, d: 0.9, color: '#d9c7b0',
    shapes: [R(0, 0, 1, 1, 'body', 0.05), R(0.05, 0.08, 0.9, 0.84, 'light', 0.03)],
  },
  {
    type: 'table-round', label: 'Round table', category: 'Kitchen & dining', w: 1.0, d: 1.0, color: '#d9c7b0',
    shapes: [E(0, 0, 1, 1, 'body'), E(0.1, 0.1, 0.8, 0.8, 'light')],
  },
  {
    type: 'chair', label: 'Chair', category: 'Kitchen & dining', w: 0.45, d: 0.45, color: '#b9a58a',
    shapes: [R(0, 0.2, 1, 0.8, 'body', 0.15), R(0.04, 0, 0.92, 0.22, 'dark', 0.2)],
  },
  {
    type: 'fridge', label: 'Fridge', category: 'Kitchen & dining', w: 0.7, d: 0.7, color: '#e5e7eb',
    shapes: [R(0, 0, 1, 1, 'body', 0.05), L(0, 0.3, 1, 0.3), R(0.1, 0.13, 0.03, 0.1, 'dark'), R(0.1, 0.37, 0.03, 0.2, 'dark')],
  },
  {
    type: 'stove', label: 'Stove', category: 'Kitchen & dining', w: 0.6, d: 0.6, color: '#d1d5db',
    shapes: [R(0, 0, 1, 1, 'body', 0.05), E(0.1, 0.1, 0.34, 0.34, 'dark'), E(0.56, 0.1, 0.34, 0.34, 'dark'), E(0.1, 0.56, 0.34, 0.34, 'dark'), E(0.56, 0.56, 0.34, 0.34, 'dark')],
  },
  {
    type: 'kitchen-sink', label: 'Kitchen sink', category: 'Kitchen & dining', w: 0.9, d: 0.6, color: '#d1d5db',
    shapes: [R(0, 0, 1, 1, 'body'), R(0.08, 0.14, 0.38, 0.72, 'light', 0.1), R(0.54, 0.14, 0.38, 0.72, 'white', 0.1), E(0.24, 0.42, 0.07, 0.12, 'dark')],
  },
  {
    type: 'counter', label: 'Counter', category: 'Kitchen & dining', w: 1.2, d: 0.6, color: '#d1d5db',
    shapes: [R(0, 0, 1, 1, 'body'), L(0.5, 0, 0.5, 1)],
  },
  // ---- Office
  {
    type: 'desk', label: 'Desk', category: 'Office', w: 1.4, d: 0.7, color: '#d9c7b0',
    shapes: [R(0, 0, 1, 1, 'body'), R(0.72, 0, 0.28, 1, 'light'), L(0.72, 0.33, 1, 0.33), L(0.72, 0.66, 1, 0.66), R(0.25, 0.1, 0.25, 0.1, 'dark')],
  },
  {
    type: 'office-chair', label: 'Office chair', category: 'Office', w: 0.55, d: 0.55, color: '#6b7280',
    shapes: [E(0, 0, 1, 1, 'body'), E(0.2, 0.2, 0.6, 0.6, 'dark'), R(0.1, 0.02, 0.8, 0.14, 'dark', 0.5)],
  },
  // ---- Bathroom
  {
    type: 'toilet', label: 'Toilet', category: 'Bathroom', w: 0.4, d: 0.7, color: '#ffffff',
    shapes: [R(0.1, 0, 0.8, 0.28, 'body', 0.1), E(0.04, 0.22, 0.92, 0.78, 'body'), E(0.2, 0.36, 0.6, 0.52, 'light')],
  },
  {
    type: 'bath-sink', label: 'Sink', category: 'Bathroom', w: 0.55, d: 0.45, color: '#ffffff',
    shapes: [R(0, 0, 1, 1, 'body', 0.12), E(0.15, 0.22, 0.7, 0.66, 'light'), E(0.44, 0.07, 0.12, 0.14, 'dark')],
  },
  {
    type: 'bathtub', label: 'Bathtub', category: 'Bathroom', w: 1.7, d: 0.75, color: '#ffffff',
    shapes: [R(0, 0, 1, 1, 'body', 0.12), R(0.03, 0.07, 0.94, 0.86, 'light', 0.3), E(0.08, 0.42, 0.06, 0.16, 'dark')],
  },
  {
    type: 'shower', label: 'Shower', category: 'Bathroom', w: 0.9, d: 0.9, color: '#dbeafe',
    shapes: [R(0, 0, 1, 1, 'body'), L(0, 0, 1, 1), L(1, 0, 0, 1), E(0.42, 0.42, 0.16, 0.16, 'dark')],
  },
  {
    type: 'washer', label: 'Washer', category: 'Bathroom', w: 0.6, d: 0.6, color: '#f3f4f6',
    shapes: [R(0, 0, 1, 1, 'body', 0.05), R(0.08, 0.06, 0.84, 0.14, 'light', 0.2), E(0.2, 0.28, 0.6, 0.6, 'light'), E(0.3, 0.38, 0.4, 0.4, 'dark')],
  },
  // ---- Other
  {
    type: 'plant', label: 'Plant', category: 'Other', w: 0.5, d: 0.5, color: '#86c08a',
    shapes: [E(0, 0, 1, 1, 'body'), E(0.2, 0.2, 0.6, 0.6, 'light'), L(0.5, 0.5, 0.5, 0.05), L(0.5, 0.5, 0.95, 0.5), L(0.5, 0.5, 0.5, 0.95), L(0.5, 0.5, 0.05, 0.5), L(0.5, 0.5, 0.82, 0.18), L(0.5, 0.5, 0.82, 0.82), L(0.5, 0.5, 0.18, 0.82), L(0.5, 0.5, 0.18, 0.18)],
  },
  {
    type: 'stairs', label: 'Stairs', category: 'Other', w: 1.0, d: 3.0, color: '#e5e7eb',
    shapes: [R(0, 0, 1, 1, 'body'), ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => L(0, i / 12, 1, i / 12)), L(0.5, 0.92, 0.5, 0.08), L(0.5, 0.08, 0.35, 0.18), L(0.5, 0.08, 0.65, 0.18)],
  },
  {
    type: 'box', label: 'Box', category: 'Other', w: 1.0, d: 1.0, color: '#cbd5e1',
    shapes: [R(0, 0, 1, 1, 'body'), L(0, 0, 1, 1), L(1, 0, 0, 1)],
  },
];

export const CATEGORIES: Category[] = ['Bedroom', 'Living', 'Kitchen & dining', 'Office', 'Bathroom', 'Other'];

const byType = new Map(CATALOG.map((c) => [c.type, c]));
const GENERIC = byType.get('box')!;

/** Look up a catalog entry; unknown types (e.g. from a newer app version) render as a plain box. */
export const catalogItem = (type: string): CatalogItem => byType.get(type) ?? GENERIC;

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

export const FURNITURE_COLORS = [
  '#c7d7ee', '#b7c9a8', '#e6c9c9', '#d8d0e8', '#f2e2a8', '#d9c7b0',
  '#e5e7eb', '#9ca3af', '#6b7280', '#374151', '#86c08a', '#ffffff',
];

function parseHex(hex: string): [number, number, number] {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Mix `hex` toward white (amount > 0) or black (amount < 0). */
export function shade(hex: string, amount: number): string {
  const target = amount >= 0 ? 255 : 0;
  const a = Math.abs(amount);
  const [r, g, b] = parseHex(hex).map((v) => Math.round(v + (target - v) * a));
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** Concrete CSS color for a symbol fill, derived from the item's color. */
export function fillColor(fill: Fill | undefined, color: string): string {
  switch (fill) {
    case 'dark':
      return shade(color, -0.14);
    case 'light':
      return shade(color, 0.55);
    case 'white':
      return '#ffffff';
    case 'none':
      return 'rgba(0,0,0,0)';
    default:
      return color;
  }
}
