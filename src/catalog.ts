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

export type Category = 'My items' | 'Lighting' | 'Electrical' | 'Plumbing' | 'Bedroom' | 'Living' | 'Kitchen & dining' | 'Office' | 'Bathroom' | 'Utility' | 'Garage & cars' | 'Outdoor' | 'Built-in' | 'Heating & cooling' | 'People & pets' | 'Window dressing' | 'Korean' | 'Winter garden' | 'Surroundings' | 'Other';

import type { CustomItem, LayerId } from './model';
import { MORE_ITEMS } from './catalogMore';
import { KOREAN_ITEMS, WINTER_ITEMS } from './catalogKorean';
import { SURROUNDINGS_ITEMS } from './catalogSurroundings';
import { localize, registerTexts } from './i18n';

export interface CatalogItem {
  type: string;
  label: string;
  category: Category;
  /** Default width (x) and depth (y) in meters. */
  w: number;
  d: number;
  color: string;
  shapes: Prim[];
  /** Layer the item lives on when it is not the default 'furniture' (lamps, sockets, taps...). */
  layer?: LayerId;
  /** Height in meters, for shadows. */
  height?: number;
  /** Lamps: light radius in meters and glow color. */
  lamp?: { radius: number; color: string };
  /** Sockets, switches, taps...: placed flat against the wall face under the cursor. */
  wallMounted?: boolean;
}

const R = (x: number, y: number, w: number, h: number, fill: Fill = 'body', r = 0): Prim => ({ t: 'rect', x, y, w, h, fill, r });
const E = (x: number, y: number, w: number, h: number, fill: Fill = 'body'): Prim => ({ t: 'ellipse', x, y, w, h, fill });
const L = (...pts: number[]): Prim => ({ t: 'line', pts });

const pillowsDouble = [R(0.08, 0.04, 0.39, 0.16, 'light', 0.3), R(0.53, 0.04, 0.39, 0.16, 'light', 0.3)];

const carShapes = (cabin = 0.32): Prim[] => [
  R(0, 0, 1, 1, 'body', 0.22),
  R(0.1, 0.0, 0.16, 0.07, 'dark', 0.3),
  R(0.66, 0.0, 0.16, 0.07, 'dark', 0.3),
  R(0.1, 0.93, 0.16, 0.07, 'dark', 0.3),
  R(0.66, 0.93, 0.16, 0.07, 'dark', 0.3),
  R(0.27, 0.13, cabin, 0.74, 'light', 0.12),
  R(0.27 + cabin, 0.12, 0.1, 0.76, 'dark', 0.2),
  R(0.17, 0.15, 0.09, 0.7, 'dark', 0.2),
  R(0.955, 0.1, 0.04, 0.2, 'white', 0.4),
  R(0.955, 0.7, 0.04, 0.2, 'white', 0.4),
];

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

  // ---- more Bedroom
  {
    type: 'bed-king', label: 'King bed', category: 'Bedroom', w: 1.8, d: 2.0, color: '#c7d7ee',
    shapes: [R(0, 0, 1, 1, 'body'), R(0.04, 0.03, 0.92, 0.94, 'white'), R(0.07, 0.04, 0.4, 0.15, 'light', 0.3), R(0.53, 0.04, 0.4, 0.15, 'light', 0.3), R(0.04, 0.27, 0.92, 0.7, 'body'), L(0.04, 0.27, 0.96, 0.27)],
  },
  {
    type: 'bunk-bed', label: 'Bunk bed', category: 'Bedroom', w: 0.95, d: 2.0, color: '#d9c7b0',
    shapes: [R(0, 0, 1, 1, 'body'), R(0.1, 0.04, 0.8, 0.92, 'white'), R(0.18, 0.05, 0.64, 0.14, 'light', 0.3), L(0.1, 0.3, 0.9, 0.3), R(0, 0.55, 0.1, 0.3, 'dark'), L(0, 0.6, 0.1, 0.6), L(0, 0.7, 0.1, 0.7), L(0, 0.8, 0.1, 0.8)],
  },
  {
    type: 'crib', label: 'Crib', category: 'Bedroom', w: 0.7, d: 1.3, color: '#f2e2a8',
    shapes: [R(0, 0, 1, 1, 'body', 0.04), R(0.1, 0.08, 0.8, 0.84, 'white', 0.04), R(0.2, 0.1, 0.6, 0.2, 'light', 0.3), L(0.1, 0.4, 0.9, 0.4)],
  },
  {
    type: 'vanity', label: 'Vanity table', category: 'Bedroom', w: 1.0, d: 0.45, color: '#d9c7b0',
    shapes: [R(0, 0, 1, 1, 'body'), R(0.1, 0.06, 0.8, 0.1, 'light'), E(0.38, 0.4, 0.24, 0.5, 'dark')],
  },
  // ---- more Living
  {
    type: 'sofa-l', label: 'Corner sofa', category: 'Living', w: 2.8, d: 1.9, color: '#b7c9a8',
    shapes: [R(0, 0, 1, 0.5, 'body', 0.08), R(0, 0.5, 0.38, 0.5, 'body', 0.08), R(0, 0, 1, 0.14, 'dark', 0.08), R(0, 0.14, 0.1, 0.86, 'dark', 0.08), R(0.11, 0.16, 0.28, 0.3, 'light', 0.1), R(0.4, 0.16, 0.28, 0.3, 'light', 0.1), R(0.69, 0.16, 0.28, 0.3, 'light', 0.1), R(0.11, 0.5, 0.27, 0.45, 'light', 0.1)],
  },
  {
    type: 'loveseat', label: 'Loveseat', category: 'Living', w: 1.5, d: 0.85, color: '#e6c9c9',
    shapes: [R(0, 0, 1, 1, 'body', 0.14), R(0, 0, 1, 0.28, 'dark', 0.14), R(0, 0.2, 0.12, 0.8, 'dark', 0.25), R(0.88, 0.2, 0.12, 0.8, 'dark', 0.25), R(0.14, 0.3, 0.35, 0.66, 'light', 0.12), R(0.51, 0.3, 0.35, 0.66, 'light', 0.12)],
  },
  {
    type: 'pouf', label: 'Pouf', category: 'Living', w: 0.55, d: 0.55, color: '#f2e2a8',
    shapes: [E(0, 0, 1, 1, 'body'), E(0.15, 0.15, 0.7, 0.7, 'light')],
  },
  {
    type: 'side-table', label: 'Side table', category: 'Living', w: 0.5, d: 0.5, color: '#d9c7b0',
    shapes: [R(0, 0, 1, 1, 'body', 0.06), E(0.3, 0.3, 0.4, 0.4, 'light')],
  },
  {
    type: 'floor-lamp', label: 'Floor lamp', category: 'Living', w: 0.4, d: 0.4, color: '#f2e2a8',
    shapes: [E(0, 0, 1, 1, 'body'), E(0.25, 0.25, 0.5, 0.5, 'light'), E(0.44, 0.44, 0.12, 0.12, 'dark')],
  },
  {
    type: 'sideboard', label: 'Sideboard', category: 'Living', w: 1.6, d: 0.45, color: '#d9c7b0',
    shapes: [R(0, 0, 1, 1, 'body'), L(0.25, 0, 0.25, 1), L(0.5, 0, 0.5, 1), L(0.75, 0, 0.75, 1)],
  },
  {
    type: 'fireplace', label: 'Fireplace', category: 'Living', w: 1.3, d: 0.6, color: '#9ca3af',
    shapes: [R(0, 0, 1, 1, 'body'), R(0.18, 0.1, 0.64, 0.5, 'dark'), R(0.1, 0.6, 0.8, 0.4, 'light')],
  },
  {
    type: 'piano', label: 'Piano', category: 'Living', w: 1.5, d: 0.65, color: '#4b5563',
    shapes: [R(0, 0, 1, 0.65, 'body', 0.03), R(0.02, 0.65, 0.96, 0.35, 'white'), ...[0.12, 0.22, 0.32, 0.42, 0.52, 0.62, 0.72, 0.82, 0.92].map((x) => L(x, 0.65, x, 1))],
  },
  {
    type: 'radiator', label: 'Radiator', category: 'Living', w: 1.0, d: 0.12, color: '#f3f4f6',
    shapes: [R(0, 0, 1, 1, 'body'), ...[0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9].map((x) => L(x, 0, x, 1))],
  },
  {
    type: 'aquarium', label: 'Aquarium', category: 'Living', w: 1.0, d: 0.4, color: '#bfe0f5',
    shapes: [R(0, 0, 1, 1, 'body', 0.04), R(0.04, 0.1, 0.92, 0.8, 'light', 0.04), E(0.2, 0.35, 0.12, 0.2, 'dark'), E(0.6, 0.45, 0.1, 0.18, 'dark')],
  },
  // ---- more Kitchen & dining
  {
    type: 'kitchen-island', label: 'Kitchen island', category: 'Kitchen & dining', w: 1.9, d: 0.95, color: '#d1d5db',
    shapes: [R(0, 0, 1, 1, 'body', 0.03), R(0.05, 0.1, 0.9, 0.8, 'light', 0.02), E(0.15, 0.3, 0.12, 0.4, 'dark')],
  },
  {
    type: 'dishwasher', label: 'Dishwasher', category: 'Kitchen & dining', w: 0.6, d: 0.6, color: '#e5e7eb',
    shapes: [R(0, 0, 1, 1, 'body', 0.04), R(0.08, 0.06, 0.84, 0.12, 'dark'), L(0.1, 0.4, 0.9, 0.4), L(0.1, 0.55, 0.9, 0.55), L(0.1, 0.7, 0.9, 0.7)],
  },
  {
    type: 'dining-set-4', label: 'Table + 4 chairs', category: 'Kitchen & dining', w: 1.7, d: 1.5, color: '#d9c7b0',
    shapes: [R(0.12, 0.17, 0.76, 0.66, 'body', 0.04), R(0.2, 0.0, 0.2, 0.15, 'dark', 0.25), R(0.6, 0.0, 0.2, 0.15, 'dark', 0.25), R(0.2, 0.85, 0.2, 0.15, 'dark', 0.25), R(0.6, 0.85, 0.2, 0.15, 'dark', 0.25)],
  },
  {
    type: 'dining-set-6', label: 'Table + 6 chairs', category: 'Kitchen & dining', w: 2.4, d: 1.5, color: '#d9c7b0',
    shapes: [R(0.1, 0.17, 0.8, 0.66, 'body', 0.04), R(0.15, 0.0, 0.16, 0.15, 'dark', 0.25), R(0.42, 0.0, 0.16, 0.15, 'dark', 0.25), R(0.69, 0.0, 0.16, 0.15, 'dark', 0.25), R(0.15, 0.85, 0.16, 0.15, 'dark', 0.25), R(0.42, 0.85, 0.16, 0.15, 'dark', 0.25), R(0.69, 0.85, 0.16, 0.15, 'dark', 0.25)],
  },
  {
    type: 'bar-stool', label: 'Bar stool', category: 'Kitchen & dining', w: 0.4, d: 0.4, color: '#6b7280',
    shapes: [E(0, 0, 1, 1, 'body'), E(0.25, 0.25, 0.5, 0.5, 'light')],
  },
  // ---- more Office
  {
    type: 'desk-l', label: 'Corner desk', category: 'Office', w: 1.8, d: 1.6, color: '#d9c7b0',
    shapes: [R(0, 0, 1, 0.42, 'body'), R(0.58, 0.42, 0.42, 0.58, 'body'), R(0.08, 0.08, 0.2, 0.1, 'dark'), L(0.58, 0.42, 1, 0.42)],
  },
  {
    type: 'filing-cabinet', label: 'Filing cabinet', category: 'Office', w: 0.45, d: 0.6, color: '#9ca3af',
    shapes: [R(0, 0, 1, 1, 'body'), L(0, 0.33, 1, 0.33), L(0, 0.66, 1, 0.66), R(0.38, 0.12, 0.24, 0.06, 'dark'), R(0.38, 0.45, 0.24, 0.06, 'dark'), R(0.38, 0.78, 0.24, 0.06, 'dark')],
  },
  {
    type: 'printer', label: 'Printer', category: 'Office', w: 0.5, d: 0.4, color: '#e5e7eb',
    shapes: [R(0, 0, 1, 1, 'body', 0.06), R(0.1, 0.1, 0.8, 0.35, 'light'), R(0.2, 0.6, 0.6, 0.3, 'white')],
  },
  {
    type: 'meeting-table', label: 'Meeting table', category: 'Office', w: 2.6, d: 1.2, color: '#d9c7b0',
    shapes: [R(0, 0, 1, 1, 'body', 0.15), R(0.05, 0.1, 0.9, 0.8, 'light', 0.12)],
  },
  // ---- more Bathroom
  {
    type: 'double-sink', label: 'Double sink', category: 'Bathroom', w: 1.3, d: 0.5, color: '#ffffff',
    shapes: [R(0, 0, 1, 1, 'body', 0.04), E(0.08, 0.2, 0.38, 0.65, 'light'), E(0.54, 0.2, 0.38, 0.65, 'light'), E(0.24, 0.07, 0.06, 0.12, 'dark'), E(0.7, 0.07, 0.06, 0.12, 'dark')],
  },
  {
    type: 'bidet', label: 'Bidet', category: 'Bathroom', w: 0.4, d: 0.6, color: '#ffffff',
    shapes: [R(0.15, 0, 0.7, 0.18, 'body', 0.2), E(0.05, 0.15, 0.9, 0.85, 'body'), E(0.2, 0.3, 0.6, 0.55, 'light')],
  },
  {
    type: 'dryer', label: 'Dryer', category: 'Utility', w: 0.6, d: 0.6, color: '#f3f4f6',
    shapes: [R(0, 0, 1, 1, 'body', 0.05), R(0.08, 0.06, 0.84, 0.14, 'light', 0.2), E(0.2, 0.28, 0.6, 0.6, 'light'), E(0.3, 0.38, 0.4, 0.4, 'white')],
  },
  // ---- Utility
  {
    type: 'water-heater', label: 'Boiler', category: 'Utility', w: 0.6, d: 0.6, color: '#e5e7eb',
    shapes: [E(0, 0, 1, 1, 'body'), E(0.2, 0.2, 0.6, 0.6, 'light'), E(0.42, 0.42, 0.16, 0.16, 'dark')],
  },
  {
    type: 'workbench', label: 'Workbench', category: 'Utility', w: 1.8, d: 0.7, color: '#b9a58a',
    shapes: [R(0, 0, 1, 1, 'body'), R(0.03, 0.08, 0.94, 0.14, 'dark'), L(0.35, 0.22, 0.35, 1), L(0.7, 0.22, 0.7, 1)],
  },
  {
    type: 'utility-shelf', label: 'Storage shelf', category: 'Utility', w: 1.2, d: 0.4, color: '#9ca3af',
    shapes: [R(0, 0, 1, 1, 'body'), L(0.25, 0, 0.25, 1), L(0.5, 0, 0.5, 1), L(0.75, 0, 0.75, 1), L(0, 0.5, 1, 0.5)],
  },
  {
    type: 'utility-sink', label: 'Utility sink', category: 'Utility', w: 0.6, d: 0.5, color: '#e5e7eb',
    shapes: [R(0, 0, 1, 1, 'body', 0.05), R(0.1, 0.18, 0.8, 0.68, 'light', 0.08), E(0.45, 0.04, 0.1, 0.12, 'dark')],
  },
  {
    type: 'fuse-box', label: 'Fuse box', category: 'Utility', w: 0.4, d: 0.15, color: '#9ca3af',
    shapes: [R(0, 0, 1, 1, 'body'), L(0.5, 0.15, 0.5, 0.85)],
  },
  // ---- Garage & cars
  { type: 'car', label: 'Car', category: 'Garage & cars', w: 4.5, d: 1.9, color: '#9db4d6', shapes: carShapes(0.32) },
  { type: 'car-small', label: 'Small car', category: 'Garage & cars', w: 3.6, d: 1.7, color: '#e8b46a', shapes: carShapes(0.3) },
  {
    type: 'porsche', label: 'Porsche 911 Turbo', category: 'Garage & cars', w: 4.55, d: 1.95, color: '#c8102e',
    shapes: [
      R(0, 0, 1, 1, 'body', 0.42),
      R(0.13, 0.0, 0.17, 0.07, 'dark', 0.3), R(0.66, 0.0, 0.17, 0.07, 'dark', 0.3), R(0.13, 0.93, 0.17, 0.07, 'dark', 0.3), R(0.66, 0.93, 0.17, 0.07, 'dark', 0.3),
      R(0.5, 0.17, 0.16, 0.66, 'dark', 0.25), R(0.27, 0.2, 0.23, 0.6, 'light', 0.3), R(0.18, 0.22, 0.09, 0.56, 'dark', 0.25),
      R(0.9, 0.1, 0.05, 0.2, 'white', 0.5), R(0.9, 0.7, 0.05, 0.2, 'white', 0.5), R(0.01, 0.15, 0.03, 0.7, 'dark', 0.4), R(0.03, 0.06, 0.1, 0.88, 'dark', 0.2),
    ],
  },
  { type: 'suv', label: 'SUV', category: 'Garage & cars', w: 4.8, d: 2.0, color: '#6b7280', shapes: carShapes(0.4) },
  { type: 'van', label: 'Van', category: 'Garage & cars', w: 5.4, d: 2.0, color: '#e5e7eb', shapes: carShapes(0.52) },
  {
    type: 'motorbike', label: 'Motorbike', category: 'Garage & cars', w: 2.1, d: 0.8, color: '#6b7280',
    shapes: [R(0.04, 0.4, 0.28, 0.2, 'dark', 0.5), R(0.68, 0.4, 0.28, 0.2, 'dark', 0.5), E(0.3, 0.25, 0.4, 0.5, 'body'), R(0.62, 0.05, 0.06, 0.9, 'dark', 0.5), E(0.38, 0.35, 0.2, 0.3, 'light')],
  },
  {
    type: 'bicycle', label: 'Bicycle', category: 'Garage & cars', w: 1.8, d: 0.55, color: '#6b7280',
    shapes: [R(0, 0.38, 0.22, 0.24, 'dark', 0.5), R(0.78, 0.38, 0.22, 0.24, 'dark', 0.5), L(0.11, 0.5, 0.5, 0.5), L(0.5, 0.5, 0.89, 0.5), R(0.78, 0.05, 0.05, 0.9, 'dark', 0.5), R(0.4, 0.4, 0.14, 0.2, 'body', 0.4)],
  },
  {
    type: 'parking', label: 'Parking space', category: 'Garage & cars', w: 5.0, d: 2.5, color: '#e5e7eb',
    shapes: [R(0, 0, 1, 1, 'none'), L(0, 0, 0, 1), L(0.94, 0.25, 0.94, 0.75)],
  },
  {
    type: 'ev-charger', label: 'EV charger', category: 'Garage & cars', w: 0.3, d: 0.2, color: '#34d399',
    shapes: [R(0, 0, 1, 1, 'body', 0.1), E(0.3, 0.3, 0.4, 0.4, 'dark')],
  },
  {
    type: 'bins', label: 'Waste bins', category: 'Garage & cars', w: 1.3, d: 0.6, color: '#6b7280',
    shapes: [E(0.02, 0.05, 0.45, 0.9, 'body'), E(0.1, 0.2, 0.3, 0.6, 'dark'), E(0.53, 0.05, 0.45, 0.9, 'body'), E(0.6, 0.2, 0.3, 0.6, 'dark')],
  },
  // ---- Outdoor
  {
    type: 'tree', label: 'Tree', category: 'Outdoor', w: 3.0, d: 3.0, color: '#7fb77e',
    shapes: [E(0, 0, 1, 1, 'body'), E(0.1, 0.12, 0.42, 0.42, 'light'), E(0.5, 0.4, 0.38, 0.38, 'light'), E(0.2, 0.55, 0.3, 0.3, 'light'), E(0.46, 0.46, 0.08, 0.08, 'dark')],
  },
  {
    type: 'tree-small', label: 'Small tree', category: 'Outdoor', w: 1.6, d: 1.6, color: '#9ccc8f',
    shapes: [E(0, 0, 1, 1, 'body'), E(0.18, 0.18, 0.64, 0.64, 'light'), E(0.44, 0.44, 0.12, 0.12, 'dark')],
  },
  {
    type: 'tree-large', label: 'Large tree', category: 'Outdoor', w: 6.0, d: 6.0, color: '#6aa96a',
    shapes: [E(0, 0, 1, 1, 'body'), E(0.08, 0.1, 0.4, 0.4, 'light'), E(0.5, 0.15, 0.4, 0.4, 'light'), E(0.15, 0.5, 0.38, 0.4, 'light'), E(0.55, 0.52, 0.34, 0.34, 'light'), E(0.47, 0.47, 0.06, 0.06, 'dark')],
  },
  {
    type: 'bush', label: 'Bush', category: 'Outdoor', w: 1.0, d: 1.0, color: '#86c08a',
    shapes: [E(0.0, 0.15, 0.55, 0.6, 'body'), E(0.4, 0.05, 0.58, 0.62, 'body'), E(0.2, 0.4, 0.62, 0.58, 'body'), E(0.35, 0.35, 0.3, 0.3, 'light')],
  },
  {
    type: 'flower-pot', label: 'Flower pot', category: 'Outdoor', w: 0.5, d: 0.5, color: '#f0a8b8',
    shapes: [E(0, 0, 1, 1, 'dark'), E(0.12, 0.12, 0.76, 0.76, 'body'), E(0.35, 0.35, 0.3, 0.3, 'light')],
  },
  {
    type: 'raised-bed', label: 'Raised bed', category: 'Outdoor', w: 1.2, d: 0.8, color: '#86c08a',
    shapes: [R(0, 0, 1, 1, 'dark'), R(0.07, 0.1, 0.86, 0.8, 'body'), L(0.3, 0.2, 0.3, 0.8), L(0.5, 0.2, 0.5, 0.8), L(0.7, 0.2, 0.7, 0.8)],
  },
  {
    type: 'shed', label: 'Garden shed', category: 'Outdoor', w: 2.5, d: 2.0, color: '#b9a58a',
    shapes: [R(0, 0, 1, 1, 'body'), L(0.5, 0, 0.5, 1), L(0, 0, 0.5, 1), L(0, 1, 0.5, 0)],
  },
  {
    type: 'greenhouse', label: 'Greenhouse', category: 'Outdoor', w: 3.0, d: 2.0, color: '#cfeaf0',
    shapes: [R(0, 0, 1, 1, 'body', 0.02), L(0.33, 0, 0.33, 1), L(0.66, 0, 0.66, 1), L(0, 0.5, 1, 0.5), R(0.05, 0.08, 0.9, 0.84, 'none')],
  },
  {
    type: 'bbq', label: 'BBQ grill', category: 'Outdoor', w: 0.9, d: 0.5, color: '#4b5563',
    shapes: [R(0, 0, 1, 1, 'body', 0.15), E(0.1, 0.15, 0.38, 0.7, 'dark'), E(0.52, 0.15, 0.38, 0.7, 'dark'), L(0.15, 0.3, 0.43, 0.3), L(0.15, 0.5, 0.43, 0.5), L(0.15, 0.7, 0.43, 0.7)],
  },
  {
    type: 'patio-set', label: 'Patio set', category: 'Outdoor', w: 2.0, d: 2.0, color: '#d9c7b0',
    shapes: [E(0.25, 0.25, 0.5, 0.5, 'body'), E(0.32, 0.32, 0.36, 0.36, 'light'), E(0.38, 0.0, 0.24, 0.2, 'dark'), E(0.38, 0.8, 0.24, 0.2, 'dark'), E(0.0, 0.38, 0.2, 0.24, 'dark'), E(0.8, 0.38, 0.2, 0.24, 'dark')],
  },
  {
    type: 'lounger', label: 'Sun lounger', category: 'Outdoor', w: 0.7, d: 2.0, color: '#f2e2a8',
    shapes: [R(0, 0, 1, 1, 'body', 0.12), R(0.05, 0.03, 0.9, 0.3, 'dark', 0.12), L(0.05, 0.33, 0.95, 0.33)],
  },
  {
    type: 'parasol', label: 'Parasol', category: 'Outdoor', w: 2.5, d: 2.5, color: '#f2e2a8',
    shapes: [E(0, 0, 1, 1, 'body'), L(0.5, 0.5, 0.5, 0), L(0.5, 0.5, 1, 0.5), L(0.5, 0.5, 0.5, 1), L(0.5, 0.5, 0, 0.5), L(0.5, 0.5, 0.85, 0.15), L(0.5, 0.5, 0.85, 0.85), L(0.5, 0.5, 0.15, 0.85), L(0.5, 0.5, 0.15, 0.15), E(0.46, 0.46, 0.08, 0.08, 'dark')],
  },
  {
    type: 'trampoline', label: 'Trampoline', category: 'Outdoor', w: 3.0, d: 3.0, color: '#4b5563',
    shapes: [E(0, 0, 1, 1, 'body'), E(0.1, 0.1, 0.8, 0.8, 'light'), E(0.4, 0.4, 0.2, 0.2, 'dark')],
  },
  {
    type: 'sandbox', label: 'Sandbox', category: 'Outdoor', w: 1.5, d: 1.5, color: '#e9d8a6',
    shapes: [R(0, 0, 1, 1, 'dark'), R(0.08, 0.08, 0.84, 0.84, 'body')],
  },
  {
    type: 'pool', label: 'Swimming pool', category: 'Outdoor', w: 8.0, d: 4.0, color: '#bfe0f5',
    shapes: [R(0, 0, 1, 1, 'white', 0.03), R(0.02, 0.04, 0.96, 0.92, 'body', 0.03), L(0.1, 0.5, 0.9, 0.5), R(0.05, 0.1, 0.03, 0.1, 'dark'), R(0.05, 0.8, 0.03, 0.1, 'dark')],
  },
  {
    type: 'hot-tub', label: 'Hot tub', category: 'Outdoor', w: 2.0, d: 2.0, color: '#bfe0f5',
    shapes: [R(0.3, 0.86, 0.4, 0.14, 'dark', 0.1), E(0.07, 0.01, 0.86, 0.86, 'body'), E(0.15, 0.09, 0.7, 0.7, 'light'), E(0.22, 0.16, 0.56, 0.56, 'white')],
  },
  {
    type: 'fire-pit', label: 'Fire pit', category: 'Outdoor', w: 1.0, d: 1.0, color: '#f59e0b',
    shapes: [E(0, 0, 1, 1, 'dark'), E(0.18, 0.18, 0.64, 0.64, 'body'), E(0.36, 0.36, 0.28, 0.28, 'light')],
  },
  {
    type: 'garden-bench', label: 'Garden bench', category: 'Outdoor', w: 1.5, d: 0.5, color: '#b9a58a',
    shapes: [R(0, 0, 1, 1, 'body', 0.05), R(0, 0, 1, 0.25, 'dark', 0.05), L(0.25, 0.3, 0.25, 1), L(0.5, 0.3, 0.5, 1), L(0.75, 0.3, 0.75, 1)],
  },
  {
    type: 'rain-barrel', label: 'Rain barrel', category: 'Outdoor', w: 0.6, d: 0.6, color: '#9ca3af',
    shapes: [E(0, 0, 1, 1, 'body'), E(0.12, 0.12, 0.76, 0.76, 'light')],
  },

  // ---- Lighting (lamps glow in the evening; they live on the "Lamps, electrical & plumbing" layer)
  {
    type: 'lamp-ceiling', label: 'Ceiling light', category: 'Lighting', w: 0.4, d: 0.4, color: '#fde68a', layer: 'tech', lamp: { radius: 3.4, color: '#ffd98a' },
    shapes: [E(0, 0, 1, 1, 'white'), E(0.2, 0.2, 0.6, 0.6, 'body'), L(0.5, 0.05, 0.5, 0.95), L(0.05, 0.5, 0.95, 0.5)],
  },
  {
    type: 'lamp-spot', label: 'Spotlight', category: 'Lighting', w: 0.25, d: 0.25, color: '#fde68a', layer: 'tech', lamp: { radius: 1.8, color: '#fff1c2' },
    shapes: [E(0, 0, 1, 1, 'white'), E(0.3, 0.3, 0.4, 0.4, 'body')],
  },
  {
    type: 'lamp-pendant', label: 'Pendant lamp', category: 'Lighting', w: 0.55, d: 0.55, color: '#fde68a', layer: 'tech', lamp: { radius: 3, color: '#ffd98a' },
    shapes: [E(0, 0, 1, 1, 'body'), E(0.18, 0.18, 0.64, 0.64, 'white'), E(0.38, 0.38, 0.24, 0.24, 'dark')],
  },
  {
    type: 'lamp-chandelier', label: 'Chandelier', category: 'Lighting', w: 0.9, d: 0.9, color: '#fde68a', layer: 'tech', lamp: { radius: 4.2, color: '#ffd98a' },
    shapes: [E(0.3, 0.3, 0.4, 0.4, 'body'), E(0, 0.3, 0.22, 0.4, 'white'), E(0.78, 0.3, 0.22, 0.4, 'white'), E(0.3, 0, 0.4, 0.22, 'white'), E(0.3, 0.78, 0.4, 0.22, 'white'), L(0.3, 0.5, 0.2, 0.5), L(0.7, 0.5, 0.8, 0.5), L(0.5, 0.3, 0.5, 0.2), L(0.5, 0.7, 0.5, 0.8)],
  },
  {
    type: 'lamp-wall', label: 'Wall light', category: 'Lighting', w: 0.3, d: 0.16, color: '#fde68a', layer: 'tech', wallMounted: true, lamp: { radius: 2.2, color: '#ffd98a' },
    shapes: [R(0, 0, 1, 0.35, 'dark'), E(0.1, 0, 0.8, 1, 'body')],
  },
  {
    type: 'lamp-table', label: 'Table lamp', category: 'Lighting', w: 0.3, d: 0.3, color: '#fde68a', layer: 'tech', lamp: { radius: 1.8, color: '#ffd98a' },
    shapes: [E(0, 0, 1, 1, 'body'), E(0.25, 0.25, 0.5, 0.5, 'white'), E(0.44, 0.44, 0.12, 0.12, 'dark')],
  },
  {
    type: 'lamp-garden', label: 'Garden lamp', category: 'Lighting', w: 0.3, d: 0.3, color: '#fde68a', layer: 'tech', lamp: { radius: 4, color: '#ffe3a3' },
    shapes: [E(0, 0, 1, 1, 'dark'), E(0.2, 0.2, 0.6, 0.6, 'body'), L(0.5, 0.2, 0.5, 0.8), L(0.2, 0.5, 0.8, 0.5)],
  },
  // ---- Electrical
  {
    type: 'socket', label: 'Socket', category: 'Electrical', w: 0.22, d: 0.1, color: '#fecaca', layer: 'tech', wallMounted: true,
    shapes: [R(0, 0, 1, 1, 'body', 0.2), E(0.2, 0.15, 0.25, 0.7, 'white'), E(0.55, 0.15, 0.25, 0.7, 'white')],
  },
  {
    type: 'socket-double', label: 'Double socket', category: 'Electrical', w: 0.34, d: 0.1, color: '#fecaca', layer: 'tech', wallMounted: true,
    shapes: [R(0, 0, 1, 1, 'body', 0.2), E(0.1, 0.15, 0.15, 0.7, 'white'), E(0.3, 0.15, 0.15, 0.7, 'white'), E(0.55, 0.15, 0.15, 0.7, 'white'), E(0.75, 0.15, 0.15, 0.7, 'white')],
  },
  {
    type: 'switch', label: 'Light switch', category: 'Electrical', w: 0.18, d: 0.1, color: '#fde68a', layer: 'tech', wallMounted: true,
    shapes: [R(0, 0, 1, 1, 'body', 0.2), L(0.2, 0.8, 0.8, 0.2), E(0.1, 0.55, 0.3, 0.4, 'white')],
  },
  {
    type: 'switch-dimmer', label: 'Dimmer', category: 'Electrical', w: 0.18, d: 0.1, color: '#fde68a', layer: 'tech', wallMounted: true,
    shapes: [R(0, 0, 1, 1, 'body', 0.2), E(0.25, 0.1, 0.5, 0.8, 'white'), L(0.5, 0.2, 0.5, 0.5)],
  },
  {
    type: 'data-point', label: 'Network point', category: 'Electrical', w: 0.2, d: 0.1, color: '#bfdbfe', layer: 'tech', wallMounted: true,
    shapes: [R(0, 0, 1, 1, 'body', 0.2), R(0.25, 0.2, 0.5, 0.6, 'white', 0.1), L(0.4, 0.2, 0.4, 0.5), L(0.6, 0.2, 0.6, 0.5)],
  },
  {
    type: 'tv-point', label: 'TV / antenna', category: 'Electrical', w: 0.2, d: 0.1, color: '#ddd6fe', layer: 'tech', wallMounted: true,
    shapes: [R(0, 0, 1, 1, 'body', 0.2), L(0.2, 0.85, 0.5, 0.15), L(0.5, 0.15, 0.8, 0.85), L(0.3, 0.55, 0.7, 0.55)],
  },
  {
    type: 'thermostat', label: 'Thermostat', category: 'Electrical', w: 0.18, d: 0.1, color: '#fed7aa', layer: 'tech', wallMounted: true,
    shapes: [R(0, 0, 1, 1, 'body', 0.2), E(0.25, 0.1, 0.5, 0.8, 'white'), L(0.5, 0.2, 0.5, 0.55)],
  },
  {
    type: 'smoke-detector', label: 'Smoke detector', category: 'Electrical', w: 0.3, d: 0.3, color: '#fecaca', layer: 'tech',
    shapes: [E(0, 0, 1, 1, 'body'), E(0.2, 0.2, 0.6, 0.6, 'white'), E(0.4, 0.4, 0.2, 0.2, 'dark')],
  },
  {
    type: 'junction', label: 'Junction box', category: 'Electrical', w: 0.22, d: 0.22, color: '#e5e7eb', layer: 'tech',
    shapes: [R(0, 0, 1, 1, 'body'), L(0, 0, 1, 1), L(1, 0, 0, 1)],
  },
  // ---- Plumbing
  {
    type: 'tap', label: 'Water tap', category: 'Plumbing', w: 0.2, d: 0.1, color: '#bfdbfe', layer: 'tech', wallMounted: true,
    shapes: [R(0, 0, 1, 1, 'body', 0.2), L(0.2, 0.3, 0.8, 0.3), L(0.5, 0.3, 0.5, 0.9), E(0.4, 0.05, 0.2, 0.25, 'white')],
  },
  {
    type: 'tap-garden', label: 'Garden tap', category: 'Plumbing', w: 0.2, d: 0.1, color: '#a7f3d0', layer: 'tech', wallMounted: true,
    shapes: [R(0, 0, 1, 1, 'body', 0.2), L(0.2, 0.3, 0.8, 0.3), L(0.5, 0.3, 0.5, 0.9), E(0.4, 0.05, 0.2, 0.25, 'white')],
  },
  {
    type: 'drain', label: 'Floor drain', category: 'Plumbing', w: 0.3, d: 0.3, color: '#cbd5e1', layer: 'tech',
    shapes: [R(0, 0, 1, 1, 'body', 0.1), L(0.25, 0.1, 0.25, 0.9), L(0.5, 0.1, 0.5, 0.9), L(0.75, 0.1, 0.75, 0.9)],
  },
  {
    type: 'water-meter', label: 'Water meter', category: 'Plumbing', w: 0.3, d: 0.3, color: '#bfdbfe', layer: 'tech',
    shapes: [E(0, 0, 1, 1, 'body'), E(0.15, 0.15, 0.7, 0.7, 'white'), L(0.5, 0.5, 0.5, 0.25), L(0.5, 0.5, 0.7, 0.5)],
  },
  {
    type: 'gas-point', label: 'Gas connection', category: 'Plumbing', w: 0.25, d: 0.25, color: '#fde047', layer: 'tech',
    shapes: [R(0.14, 0.14, 0.72, 0.72, 'body', 0.05), L(0.5, 0, 0.9, 0.5), L(0.9, 0.5, 0.5, 1), L(0.5, 1, 0.1, 0.5), L(0.1, 0.5, 0.5, 0)],
  },
  {
    type: 'pipe-stack', label: 'Pipe / riser', category: 'Plumbing', w: 0.2, d: 0.2, color: '#9ca3af', layer: 'tech',
    shapes: [E(0, 0, 1, 1, 'body'), E(0.25, 0.25, 0.5, 0.5, 'white')],
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

CATALOG.push(...MORE_ITEMS, ...KOREAN_ITEMS, ...WINTER_ITEMS, ...SURROUNDINGS_ITEMS);
localize(CATALOG, ['label']);

// Extra properties of a few older items.
Object.assign(CATALOG.find((c) => c.type === 'floor-lamp')!, { lamp: { radius: 2.6, color: '#ffd98a' } });
Object.assign(CATALOG.find((c) => c.type === 'radiator')!, { wallMounted: true });

export const CATEGORIES: Category[] = ['My items', 'Bedroom', 'Living', 'Kitchen & dining', 'Office', 'Bathroom', 'Utility', 'Lighting', 'Electrical', 'Plumbing', 'Garage & cars', 'Outdoor', 'Built-in', 'Heating & cooling', 'People & pets', 'Window dressing', 'Korean', 'Winter garden', 'Surroundings', 'Other'];
// the names are kept as they are (items are compared with them); the palette shows them through t()
registerTexts(CATEGORIES);

const byType = new Map(CATALOG.map((c) => [c.type, c]));
const GENERIC = byType.get('box')!;

const CATEGORY_HEIGHT: Record<Category, number> = {
  'My items': 0.8,
  Bedroom: 0.6,
  Living: 0.8,
  'Kitchen & dining': 0.9,
  Office: 0.75,
  Bathroom: 0.5,
  Utility: 0.9,
  Lighting: 2.4,
  Electrical: 0.3,
  Plumbing: 0.3,
  'Garage & cars': 1.5,
  Outdoor: 1.0,
  'Built-in': 2.4,
  'Heating & cooling': 0.6,
  'People & pets': 1.0,
  'Window dressing': 2.4,
  Korean: 0.6,
  'Winter garden': 1.2,
  Surroundings: 7,
  Other: 0.5,
};
const HEIGHT: Record<string, number> = {
  wardrobe: 2.1, bookshelf: 1.9, 'utility-shelf': 1.8, fridge: 1.8, 'floor-lamp': 1.6, piano: 1.2, fireplace: 1.1, shower: 2.2,
  rug: 0.01, parking: 0.01, stairs: 1.5, bed: 0.5, 'bed-double': 0.55, 'bed-single': 0.5, 'bed-king': 0.55, 'bunk-bed': 1.6, chair: 0.9,
  'office-chair': 1.0, 'bar-stool': 0.75, 'coffee-table': 0.45, 'table-round': 0.75, 'dining-table': 0.75, 'dining-set-4': 0.75, 'dining-set-6': 0.75,
  radiator: 0.6, aquarium: 1.2, pouf: 0.4, 'side-table': 0.5, bathtub: 0.6, toilet: 0.8, 'bath-sink': 0.85, washer: 0.85, dryer: 0.85, 'water-heater': 1.5,
  car: 1.5, porsche: 1.3, 'car-small': 1.45, suv: 1.8, van: 2.1, motorbike: 1.1, bicycle: 1.0, bins: 1.1, 'ev-charger': 1.4,
  tree: 6, 'tree-small': 3, 'tree-large': 10, bush: 0.9, 'flower-pot': 0.4, 'raised-bed': 0.5, shed: 2.4, greenhouse: 2.5, bbq: 1.0, 'patio-set': 0.75,
  lounger: 0.4, parasol: 2.4, trampoline: 0.9, sandbox: 0.3, pool: 0, 'hot-tub': 0.8, 'fire-pit': 0.4, 'garden-bench': 0.8, 'rain-barrel': 1.0,
};

/** Height in meters of a piece of furniture, for shadows: its own override, else the catalog value. */
export function furnitureHeight(f: { type: string; height?: number }): number {
  if (typeof f.height === 'number') return f.height;
  const item = catalogItem(f.type);
  return item.height ?? HEIGHT[f.type] ?? CATEGORY_HEIGHT[item.category];
}

export const catalogLayer = (type: string): LayerId => catalogItem(type).layer ?? 'furniture';

// ---- custom items: defined by the user inside the design, so they must look like catalog items everywhere

const customMap = new Map<string, CatalogItem>();

export const CUSTOM_PREFIX = 'custom:';

/** What a custom item looks like as a catalog entry. */
export function customCatalogItem(c: CustomItem): CatalogItem {
  let shapes: Prim[];
  if (c.shape === 'symbol' && c.base && byType.has(c.base)) shapes = byType.get(c.base)!.shapes;
  else if (c.shape === 'ellipse') shapes = [E(0, 0, 1, 1, 'body'), E(0.15, 0.15, 0.7, 0.7, 'light')];
  else if (c.shape === 'round') shapes = [R(0, 0, 1, 1, 'body', 0.22), R(0.1, 0.1, 0.8, 0.8, 'light', 0.16)];
  else shapes = [R(0, 0, 1, 1, 'body'), R(0.08, 0.08, 0.84, 0.84, 'light')];
  return { type: CUSTOM_PREFIX + c.id, label: c.label, category: 'My items', w: c.w, d: c.d, color: c.color, shapes, height: c.height };
}

/** Called whenever the design's custom items change (and when a design is loaded). */
export function syncCustomItems(list: CustomItem[]) {
  customMap.clear();
  for (const c of list) customMap.set(CUSTOM_PREFIX + c.id, customCatalogItem(c));
}

/** The built-in catalog followed by this design's custom items. */
export const allCatalog = (): CatalogItem[] => [...CATALOG, ...customMap.values()];

/** Look up a catalog entry; unknown types (e.g. from a newer app version) render as a plain box. */
export const catalogItem = (type: string): CatalogItem => byType.get(type) ?? customMap.get(type) ?? GENERIC;

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
export function fillColor(fill: Fill | undefined, color: string, color2?: string): string {
  switch (fill) {
    case 'dark':
      return color2 ?? shade(color, -0.14);
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
