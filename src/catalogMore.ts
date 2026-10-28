/**
 * More furniture and fittings for the catalog (kitchen runs and appliances, bedroom, living, bathroom, built-ins, garden, heating and cooling,
 * people and pets, window dressing). Same format as catalog.ts; the 3D models are in view3d/furniture3d2.ts.
 *
 * `wallMounted` items snap flat onto the wall under the cursor with their back to it (units, wardrobes, curtains) and may stand in a wall's
 * line. Items that stand on a worktop (appliances) are listed in COUNTERTOP in furniture3d2.ts, which lifts them onto whatever is under them.
 */
import type { CatalogItem, Category, Fill, Prim } from './catalog';

const R = (x: number, y: number, w: number, h: number, fill: Fill = 'body', r = 0): Prim => ({ t: 'rect', x, y, w, h, fill, r });
const E = (x: number, y: number, w: number, h: number, fill: Fill = 'body'): Prim => ({ t: 'ellipse', x, y, w, h, fill });
const L = (...pts: number[]): Prim => ({ t: 'line', pts });

const K: Category = 'Kitchen & dining';

/** A row of `n` doors/drawer fronts seen from above: short marks at the front edge. */
const fronts = (n: number, y = 0.86): Prim[] => Array.from({ length: n }, (_, i) => L((i + 0.2) / n, y, (i + 0.8) / n, y));
const seams = (n: number): Prim[] => Array.from({ length: n - 1 }, (_, i) => L((i + 1) / n, 0.1, (i + 1) / n, 1));
const burners = (): Prim[] => [E(0.12, 0.14, 0.32, 0.32, 'dark'), E(0.56, 0.14, 0.32, 0.32, 'dark'), E(0.12, 0.54, 0.32, 0.32, 'dark'), E(0.56, 0.54, 0.32, 0.32, 'dark')];

const hang = (x: number): Prim[] => [L(x, 0.05, x, 0.95)];
const slats = (n: number): Prim[] => Array.from({ length: n }, (_, i) => L(0.04, (i + 1) / (n + 1), 0.96, (i + 1) / (n + 1)));

export const MORE_ITEMS: CatalogItem[] = [
  // ---- Kitchen runs
  { type: 'unit-base', label: 'Base unit', category: K, w: 0.6, d: 0.6, color: '#e5e7eb', wallMounted: true, height: 0.9, shapes: [R(0, 0, 1, 1), ...fronts(1), L(0.5, 0.1, 0.5, 0.86)] },
  { type: 'unit-drawers', label: 'Drawer unit', category: K, w: 0.6, d: 0.6, color: '#e5e7eb', wallMounted: true, height: 0.9, shapes: [R(0, 0, 1, 1), L(0.15, 0.9, 0.85, 0.9), L(0.1, 0.4, 0.1, 0.4)] },
  { type: 'unit-hob', label: 'Hob unit', category: K, w: 0.6, d: 0.6, color: '#e5e7eb', wallMounted: true, height: 0.92, shapes: [R(0, 0, 1, 1), R(0.06, 0.08, 0.88, 0.8, 'dark', 0.06), ...burners()] },
  { type: 'unit-sink', label: 'Sink unit', category: K, w: 1.2, d: 0.6, color: '#e5e7eb', wallMounted: true, height: 0.9, shapes: [R(0, 0, 1, 1), R(0.08, 0.14, 0.4, 0.7, 'white', 0.08), R(0.54, 0.14, 0.2, 0.7, 'light', 0.05), E(0.83, 0.3, 0.1, 0.1, 'dark')] },
  { type: 'unit-corner', label: 'Corner base unit', category: K, w: 0.9, d: 0.9, color: '#e5e7eb', wallMounted: true, height: 0.9, shapes: [R(0, 0, 1, 0.67), R(0, 0.67, 0.67, 0.33), L(0.67, 0.67, 0.67, 1), L(0.67, 0.67, 1, 0.67), ...fronts(1, 0.97).map(() => L(0.1, 0.97, 0.55, 0.97))] },
  { type: 'unit-wall', label: 'Wall unit', category: K, w: 0.6, d: 0.35, color: '#e5e7eb', wallMounted: true, height: 0.72, shapes: [R(0, 0, 1, 1, 'light'), R(0.05, 0.08, 0.9, 0.84, 'body', 0.04), L(0.5, 0.08, 0.5, 0.92)] },
  { type: 'unit-wall-corner', label: 'Corner wall unit', category: K, w: 0.6, d: 0.6, color: '#e5e7eb', wallMounted: true, height: 0.72, shapes: [R(0, 0, 1, 0.58, 'light'), R(0, 0.58, 0.58, 0.42, 'light'), L(0.58, 0.58, 0.58, 1), L(0.58, 0.58, 1, 0.58)] },
  { type: 'unit-tall', label: 'Tall unit', category: K, w: 0.6, d: 0.6, color: '#e5e7eb', wallMounted: true, height: 2.1, shapes: [R(0, 0, 1, 1, 'dark'), L(0, 0, 1, 1), L(1, 0, 0, 1)] },
  { type: 'worktop', label: 'Worktop run', category: K, w: 2.4, d: 0.6, color: '#e5e7eb', wallMounted: true, height: 0.9, shapes: [R(0, 0, 1, 1), R(0, 0, 1, 0.1, 'light'), ...seams(4), ...fronts(4)] },
  { type: 'range-hood', label: 'Range hood', category: K, w: 0.6, d: 0.5, color: '#cbd5e1', wallMounted: true, height: 0.2, shapes: [R(0, 0, 1, 1, 'body', 0.06), R(0.28, 0.0, 0.44, 0.45, 'dark'), E(0.35, 0.55, 0.3, 0.3, 'light')] },
  { type: 'oven', label: 'Oven tower', category: K, w: 0.6, d: 0.6, color: '#374151', wallMounted: true, height: 2.1, shapes: [R(0, 0, 1, 1, 'body'), R(0.1, 0.14, 0.8, 0.76, 'dark', 0.05), L(0.2, 0.9, 0.8, 0.9), L(0, 0, 1, 1)] },
  { type: 'range-cooker', label: 'Range cooker', category: K, w: 0.9, d: 0.65, color: '#d1d5db', wallMounted: false, height: 0.92, shapes: [R(0, 0, 1, 1, 'body', 0.04), E(0.08, 0.1, 0.26, 0.34, 'dark'), E(0.37, 0.1, 0.26, 0.34, 'dark'), E(0.66, 0.1, 0.26, 0.34, 'dark'), E(0.2, 0.55, 0.28, 0.32, 'dark'), E(0.55, 0.55, 0.28, 0.32, 'dark')] },
  // appliances that stand on a worktop
  { type: 'cooktop', label: 'Cooktop', category: K, w: 0.6, d: 0.52, color: '#111827', height: 0.03, shapes: [R(0, 0, 1, 1, 'body', 0.08), ...burners()] },
  { type: 'microwave', label: 'Microwave', category: K, w: 0.5, d: 0.4, color: '#d1d5db', height: 0.3, shapes: [R(0, 0, 1, 1, 'body', 0.06), R(0.08, 0.1, 0.62, 0.8, 'dark', 0.05), R(0.78, 0.15, 0.14, 0.7, 'light', 0.1)] },
  { type: 'coffee-machine', label: 'Coffee machine', category: K, w: 0.3, d: 0.38, color: '#374151', height: 0.38, shapes: [R(0, 0, 1, 1, 'body', 0.1), R(0.15, 0.2, 0.7, 0.4, 'dark', 0.08), E(0.4, 0.62, 0.2, 0.2, 'white')] },
  { type: 'rice-cooker', label: 'Rice cooker', category: K, w: 0.3, d: 0.3, color: '#f3f4f6', height: 0.26, shapes: [E(0, 0, 1, 1), E(0.18, 0.18, 0.64, 0.64, 'light'), R(0.44, 0.04, 0.12, 0.1, 'dark')] },
  { type: 'thermomix', label: 'Thermomix / food processor', category: K, w: 0.32, d: 0.32, color: '#e5e7eb', height: 0.38, shapes: [R(0, 0, 1, 1, 'body', 0.15), E(0.2, 0.2, 0.6, 0.6, 'light'), E(0.4, 0.4, 0.2, 0.2, 'dark')] },
  { type: 'kettle', label: 'Kettle', category: K, w: 0.2, d: 0.2, color: '#9ca3af', height: 0.25, shapes: [E(0, 0, 1, 1), E(0.2, 0.2, 0.6, 0.6, 'light'), R(0.8, 0.4, 0.2, 0.2, 'dark')] },
  { type: 'toaster', label: 'Toaster', category: K, w: 0.3, d: 0.18, color: '#d1d5db', height: 0.2, shapes: [R(0, 0, 1, 1, 'body', 0.2), R(0.12, 0.3, 0.3, 0.4, 'dark'), R(0.58, 0.3, 0.3, 0.4, 'dark')] },
  { type: 'air-fryer', label: 'Air fryer', category: K, w: 0.3, d: 0.36, color: '#374151', height: 0.35, shapes: [R(0, 0, 1, 1, 'body', 0.2), R(0.15, 0.15, 0.7, 0.55, 'dark', 0.12), R(0.3, 0.8, 0.4, 0.1, 'light')] },
  { type: 'stand-mixer', label: 'Stand mixer', category: K, w: 0.22, d: 0.36, color: '#e8b4b4', height: 0.38, shapes: [R(0.1, 0.55, 0.8, 0.45, 'body', 0.15), E(0.15, 0.05, 0.7, 0.55, 'light'), R(0.4, 0.5, 0.2, 0.2, 'dark')] },

  // ---- Bedroom
  { type: 'wardrobe-sliding', label: 'Sliding-door wardrobe', category: 'Bedroom', w: 2.0, d: 0.65, color: '#e5e7eb', wallMounted: true, height: 2.4, shapes: [R(0, 0, 1, 1), R(0, 0.3, 0.52, 0.3, 'light'), R(0.48, 0.55, 0.52, 0.3, 'dark'), L(0.5, 0.1, 0.5, 0.95)] },
  { type: 'wardrobe-walkin', label: 'Walk-in wardrobe', category: 'Bedroom', w: 2.4, d: 2.0, color: '#d9c7b0', height: 2.3, shapes: [R(0, 0, 1, 0.22), R(0, 0.22, 0.22, 0.78), R(0.78, 0.22, 0.22, 0.78), L(0.22, 0.22, 0.78, 0.22), L(0.1, 0.05, 0.1, 0.2), L(0.3, 0.05, 0.3, 0.2), L(0.5, 0.05, 0.5, 0.2), L(0.7, 0.05, 0.7, 0.2), L(0.9, 0.05, 0.9, 0.2)] },
  { type: 'wardrobe-fitted', label: 'Fitted wardrobe', category: 'Built-in', w: 2.4, d: 0.6, color: '#e5e7eb', wallMounted: true, height: 2.5, shapes: [R(0, 0, 1, 1), ...seams(4), L(0.18, 0.55, 0.18, 0.7), L(0.43, 0.55, 0.43, 0.7), L(0.68, 0.55, 0.68, 0.7), L(0.93, 0.55, 0.93, 0.7)] },
  { type: 'headboard-padded', label: 'Headboard (padded)', category: 'Bedroom', w: 1.8, d: 0.12, color: '#c7d7ee', wallMounted: true, height: 1.2, shapes: [R(0, 0, 1, 1, 'body', 0.3), R(0.04, 0.2, 0.92, 0.6, 'light', 0.2)] },
  { type: 'headboard-wood', label: 'Headboard (wood slats)', category: 'Bedroom', w: 1.8, d: 0.08, color: '#d9c7b0', wallMounted: true, height: 1.1, shapes: [R(0, 0, 1, 1), ...Array.from({ length: 8 }, (_, i) => L((i + 1) / 9, 0, (i + 1) / 9, 1))] },
  { type: 'headboard-tufted', label: 'Headboard (tufted)', category: 'Bedroom', w: 1.8, d: 0.14, color: '#d8d0e8', wallMounted: true, height: 1.4, shapes: [R(0, 0, 1, 1, 'body', 0.25), E(0.12, 0.3, 0.08, 0.4, 'dark'), E(0.32, 0.3, 0.08, 0.4, 'dark'), E(0.52, 0.3, 0.08, 0.4, 'dark'), E(0.72, 0.3, 0.08, 0.4, 'dark'), E(0.88, 0.3, 0.06, 0.4, 'dark')] },
  { type: 'changing-table', label: 'Changing table', category: 'Bedroom', w: 0.95, d: 0.55, color: '#f2e2a8', height: 0.95, shapes: [R(0, 0, 1, 1), R(0.06, 0.1, 0.88, 0.8, 'light', 0.06), L(0.06, 0.1, 0.94, 0.1)] },
  { type: 'rocking-chair', label: 'Nursing / rocking chair', category: 'Bedroom', w: 0.7, d: 0.85, color: '#e6c9c9', height: 1.0, shapes: [R(0, 0, 1, 1, 'body', 0.18), R(0, 0, 1, 0.28, 'dark', 0.18), R(0.08, 0.34, 0.84, 0.58, 'light', 0.12)] },
  { type: 'toy-chest', label: 'Toy chest', category: 'Bedroom', w: 0.8, d: 0.42, color: '#f2c14e', height: 0.45, shapes: [R(0, 0, 1, 1, 'body', 0.06), R(0.06, 0.12, 0.88, 0.76, 'light', 0.05)] },
  { type: 'play-mat', label: 'Play mat', category: 'Bedroom', w: 1.4, d: 1.4, color: '#a7d7a7', height: 0.02, shapes: [R(0, 0, 1, 1, 'body', 0.04), R(0.1, 0.1, 0.38, 0.38, 'light'), R(0.52, 0.52, 0.38, 0.38, 'light')] },
  { type: 'mirror-wall', label: 'Wall mirror', category: 'Bedroom', w: 0.8, d: 0.06, color: '#bfe3f5', wallMounted: true, height: 1.6, shapes: [R(0, 0, 1, 1, 'body'), L(0.2, 0.2, 0.8, 0.8)] },
  { type: 'mirror-floor', label: 'Standing mirror', category: 'Bedroom', w: 0.6, d: 0.35, color: '#bfe3f5', height: 1.75, shapes: [R(0, 0.43, 1, 0.14, 'body'), R(0, 0, 0.1, 1, 'dark'), R(0.9, 0, 0.1, 1, 'dark')] },

  // ---- Living and dining
  { type: 'sofa-u', label: 'U-shaped sectional', category: 'Living', w: 3.4, d: 2.4, color: '#b7c9a8', shapes: [R(0, 0, 1, 0.38, 'body', 0.06), R(0, 0.38, 0.27, 0.62, 'body', 0.06), R(0.73, 0.38, 0.27, 0.62, 'body', 0.06), R(0, 0, 1, 0.12, 'dark', 0.06), R(0.04, 0.14, 0.2, 0.8, 'light', 0.08), R(0.76, 0.14, 0.2, 0.8, 'light', 0.08), R(0.28, 0.14, 0.44, 0.22, 'light', 0.08)] },
  { type: 'sofa-chaise', label: 'Sofa with chaise (right)', category: 'Living', w: 2.7, d: 1.7, color: '#b7c9a8', shapes: [R(0, 0, 1, 0.52, 'body', 0.08), R(0.67, 0.52, 0.33, 0.48, 'body', 0.08), R(0, 0, 1, 0.14, 'dark', 0.08), R(0.04, 0.17, 0.28, 0.32, 'light', 0.1), R(0.35, 0.17, 0.28, 0.32, 'light', 0.1), R(0.68, 0.17, 0.28, 0.76, 'light', 0.1)] },
  { type: 'sofa-chaise-left', label: 'Sofa with chaise (left)', category: 'Living', w: 2.7, d: 1.7, color: '#b7c9a8', shapes: [R(0, 0, 1, 0.52, 'body', 0.08), R(0, 0.52, 0.33, 0.48, 'body', 0.08), R(0, 0, 1, 0.14, 'dark', 0.08), R(0.04, 0.17, 0.28, 0.76, 'light', 0.1), R(0.37, 0.17, 0.28, 0.32, 'light', 0.1), R(0.68, 0.17, 0.28, 0.32, 'light', 0.1)] },
  { type: 'sofa-curved', label: 'Round sofa', category: 'Living', w: 2.8, d: 1.2, color: '#e6c9c9', shapes: [R(0, 0.1, 1, 0.9, 'body', 0.45), R(0.05, 0.14, 0.9, 0.2, 'dark', 0.4), R(0.1, 0.38, 0.8, 0.55, 'light', 0.35)] },
  { type: 'recliner', label: 'Recliner', category: 'Living', w: 0.95, d: 1.0, color: '#6b5b4a', height: 1.05, shapes: [R(0, 0, 1, 1, 'body', 0.14), R(0, 0, 1, 0.3, 'dark', 0.14), R(0, 0.22, 0.15, 0.78, 'dark', 0.25), R(0.85, 0.22, 0.15, 0.78, 'dark', 0.25), R(0.18, 0.34, 0.64, 0.5, 'light', 0.12)] },
  { type: 'ottoman', label: 'Ottoman', category: 'Living', w: 0.9, d: 0.9, color: '#d8d0e8', height: 0.42, shapes: [R(0, 0, 1, 1, 'body', 0.12), R(0.1, 0.1, 0.8, 0.8, 'light', 0.1)] },
  { type: 'console-table', label: 'Console table', category: 'Living', w: 1.2, d: 0.35, color: '#d9c7b0', height: 0.8, shapes: [R(0, 0, 1, 1, 'body', 0.05), R(0.04, 0.12, 0.92, 0.76, 'light', 0.04)] },
  { type: 'tv-stand', label: 'TV stand', category: 'Living', w: 1.6, d: 0.42, color: '#9ca3af', height: 1.0, shapes: [R(0, 0, 1, 1, 'body', 0.04), R(0.05, 0.1, 0.9, 0.8, 'light', 0.03), R(0.2, 0.06, 0.6, 0.1, 'dark')] },
  { type: 'tv-wall', label: 'Wall-mounted TV', category: 'Living', w: 1.25, d: 0.07, color: '#111827', wallMounted: true, height: 0.75, shapes: [R(0, 0, 1, 1, 'dark', 0.1), L(0.1, 0.5, 0.9, 0.5)] },
  { type: 'bar-cart', label: 'Bar cart', category: 'Living', w: 0.8, d: 0.45, color: '#c9a24a', height: 0.85, shapes: [R(0, 0, 1, 1, 'body', 0.05), R(0.06, 0.12, 0.88, 0.76, 'light', 0.04), E(0.15, 0.3, 0.1, 0.2, 'dark'), E(0.4, 0.3, 0.1, 0.2, 'dark')] },
  { type: 'fireplace-surround', label: 'Fireplace with hearth', category: 'Living', w: 1.6, d: 0.95, color: '#d6d3cd', wallMounted: true, height: 1.4, shapes: [R(0, 0, 1, 0.38), R(0.18, 0.04, 0.64, 0.3, 'dark'), R(0.05, 0.4, 0.9, 0.6, 'light', 0.03), L(0.05, 0.4, 0.95, 0.4)] },
  { type: 'bench', label: 'Bench', category: 'Living', w: 1.2, d: 0.4, color: '#d9c7b0', height: 0.45, shapes: [R(0, 0, 1, 1, 'body', 0.06), R(0.04, 0.14, 0.92, 0.72, 'light', 0.05)] },
  { type: 'banquette', label: 'Banquette seat', category: K, w: 1.8, d: 0.6, color: '#c7d7ee', wallMounted: true, height: 0.95, shapes: [R(0, 0, 1, 1, 'body', 0.06), R(0, 0, 1, 0.22, 'dark', 0.06), R(0.04, 0.3, 0.92, 0.62, 'light', 0.08), L(0.5, 0.3, 0.5, 0.92)] },
  { type: 'breakfast-nook', label: 'Breakfast nook', category: K, w: 2.2, d: 2.0, color: '#c7d7ee', height: 0.95, shapes: [R(0, 0, 1, 0.3, 'body', 0.04), R(0, 0.3, 0.27, 0.7, 'body', 0.04), R(0, 0, 1, 0.1, 'dark', 0.04), R(0, 0.1, 0.1, 0.9, 'dark', 0.04), R(0.34, 0.38, 0.5, 0.42, 'light', 0.04), R(0.38, 0.42, 0.42, 0.34, 'body', 0.04)] },

  // ---- Bathroom
  { type: 'bath-corner', label: 'Corner bath', category: 'Bathroom', w: 1.5, d: 1.5, color: '#ffffff', height: 0.6, shapes: [R(0, 0, 1, 1, 'body', 0.12), E(0.08, 0.08, 0.84, 0.84, 'light'), E(0.1, 0.1, 0.08, 0.08, 'dark')] },
  { type: 'bath-freestanding', label: 'Freestanding bath', category: 'Bathroom', w: 1.7, d: 0.8, color: '#ffffff', height: 0.62, shapes: [E(0, 0, 1, 1, 'body'), E(0.06, 0.1, 0.88, 0.8, 'light'), E(0.08, 0.42, 0.06, 0.16, 'dark')] },
  { type: 'shower-walkin', label: 'Walk-in shower tray', category: 'Bathroom', w: 1.2, d: 0.8, color: '#dbeafe', height: 2.0, shapes: [R(0, 0, 1, 1, 'body'), R(0.04, 0.06, 0.92, 0.88, 'light'), L(0, 1, 0, 0), E(0.45, 0.42, 0.1, 0.16, 'dark'), L(0, 1, 1, 1)] },
  { type: 'towel-rail', label: 'Towel rail', category: 'Bathroom', w: 0.5, d: 0.1, color: '#cbd5e1', wallMounted: true, height: 1.2, shapes: [R(0, 0, 1, 0.6, 'body', 0.2), ...hang(0.25), ...hang(0.5), ...hang(0.75)] },
  { type: 'towel-rail-heated', label: 'Heated towel rail', category: 'Heating & cooling', w: 0.5, d: 0.1, color: '#e5e7eb', wallMounted: true, height: 1.2, shapes: [R(0, 0, 1, 0.6, 'body', 0.2), ...hang(0.2), ...hang(0.4), ...hang(0.6), ...hang(0.8)] },
  { type: 'vanity-mirror', label: 'Vanity with mirror', category: 'Bathroom', w: 1.0, d: 0.5, color: '#e5e7eb', wallMounted: true, height: 0.85, shapes: [R(0, 0, 1, 1, 'body', 0.04), E(0.25, 0.22, 0.5, 0.62, 'light'), E(0.46, 0.1, 0.08, 0.1, 'dark'), R(0.1, 0, 0.8, 0.07, 'dark')] },

  // ---- Built-in
  { type: 'column-round', label: 'Round column', category: 'Built-in', w: 0.3, d: 0.3, color: '#d6d3cd', layer: 'structure', height: 2.5, shapes: [E(0, 0, 1, 1), E(0.15, 0.15, 0.7, 0.7, 'light')] },
  { type: 'column-square', label: 'Square pillar', category: 'Built-in', w: 0.35, d: 0.35, color: '#c7c3ba', layer: 'structure', height: 2.5, shapes: [R(0, 0, 1, 1), R(0.15, 0.15, 0.7, 0.7, 'light')] },
  { type: 'beam', label: 'Ceiling beam', category: 'Built-in', w: 4.0, d: 0.25, color: '#a5835a', layer: 'structure', height: 0.3, shapes: [R(0, 0, 1, 1), L(0, 0.5, 1, 0.5)] },
  { type: 'wall-shelf', label: 'Wall shelf', category: 'Built-in', w: 1.0, d: 0.25, color: '#c9a97c', wallMounted: true, height: 0.04, shapes: [R(0, 0, 1, 1), L(0.1, 0, 0.1, 1), L(0.9, 0, 0.9, 1)] },
  { type: 'wall-niche', label: 'Wall niche', category: 'Built-in', w: 0.6, d: 0.12, color: '#f5f5f4', wallMounted: true, height: 0.8, shapes: [R(0, 0, 1, 1, 'body', 0.05), R(0.1, 0.15, 0.8, 0.7, 'dark', 0.04)] },

  // ---- Garden
  { type: 'pergola', label: 'Pergola', category: 'Outdoor', w: 3.2, d: 3.2, color: '#a5835a', height: 2.6, shapes: [R(0, 0, 1, 1, 'none'), ...Array.from({ length: 9 }, (_, i) => R(0, (i + 0.2) / 9, 1, 0.5 / 9, 'light')), R(0, 0, 1, 0.035), R(0, 0.965, 1, 0.035), R(0, 0, 0.04, 0.04), R(0.96, 0, 0.04, 0.04), R(0, 0.96, 0.04, 0.04), R(0.96, 0.96, 0.04, 0.04)] },
  { type: 'gazebo', label: 'Gazebo', category: 'Outdoor', w: 3.2, d: 3.2, color: '#e5e7eb', height: 3.0, shapes: [E(0, 0, 1, 1, 'body'), E(0.1, 0.1, 0.8, 0.8, 'light'), E(0.46, 0.46, 0.08, 0.08, 'dark'), L(0.5, 0.5, 0.15, 0.15), L(0.5, 0.5, 0.85, 0.15), L(0.5, 0.5, 0.85, 0.85), L(0.5, 0.5, 0.15, 0.85)] },
  { type: 'carport', label: 'Carport', category: 'Garage & cars', w: 3.2, d: 5.6, color: '#9ca3af', height: 2.5, shapes: [R(0, 0, 1, 1, 'light'), R(0, 0, 0.05, 0.03, 'dark'), R(0.95, 0, 0.05, 0.03, 'dark'), R(0, 0.97, 0.05, 0.03, 'dark'), R(0.95, 0.97, 0.05, 0.03, 'dark'), L(0, 0.5, 1, 0.5)] },
  { type: 'awning', label: 'Awning', category: 'Outdoor', w: 3.0, d: 1.6, color: '#f2c14e', wallMounted: true, height: 0.3, shapes: [R(0, 0, 1, 1, 'light'), ...Array.from({ length: 6 }, (_, i) => L((i + 1) / 7, 0, (i + 1) / 7, 1)), R(0, 0.95, 1, 0.05, 'body')] },
  { type: 'retaining-wall', label: 'Retaining wall', category: 'Outdoor', w: 3.0, d: 0.4, color: '#b8b3a7', height: 0.9, shapes: [R(0, 0, 1, 1), R(0, 0, 1, 0.3, 'light'), L(0.25, 0.3, 0.25, 1), L(0.5, 0.3, 0.5, 1), L(0.75, 0.3, 0.75, 1)] },
  { type: 'garden-steps', label: 'Garden steps', category: 'Outdoor', w: 1.2, d: 1.0, color: '#b8b3a7', height: 0.45, shapes: [R(0, 0, 1, 1), L(0, 0.25, 1, 0.25), L(0, 0.5, 1, 0.5), L(0, 0.75, 1, 0.75), L(0.5, 0.9, 0.5, 0.1), L(0.5, 0.1, 0.35, 0.2), L(0.5, 0.1, 0.65, 0.2)] },
  { type: 'paving-grid', label: 'Paving: square slabs', category: 'Outdoor', w: 2.0, d: 2.0, color: '#cfc6bb', height: 0.02, shapes: [R(0, 0, 1, 1), L(0.25, 0, 0.25, 1), L(0.5, 0, 0.5, 1), L(0.75, 0, 0.75, 1), L(0, 0.25, 1, 0.25), L(0, 0.5, 1, 0.5), L(0, 0.75, 1, 0.75)] },
  { type: 'paving-herringbone', label: 'Paving: bricks', category: 'Outdoor', w: 2.0, d: 2.0, color: '#c98f73', height: 0.02, shapes: [R(0, 0, 1, 1), L(0, 0.2, 0.2, 0), L(0, 0.4, 0.4, 0), L(0, 0.6, 0.6, 0), L(0, 0.8, 0.8, 0), L(0, 1, 1, 0), L(0.2, 1, 1, 0.2), L(0.4, 1, 1, 0.4), L(0.6, 1, 1, 0.6), L(0.8, 1, 1, 0.8)] },
  { type: 'paving-circle', label: 'Paving: round patio', category: 'Outdoor', w: 3.0, d: 3.0, color: '#cfc6bb', height: 0.02, shapes: [E(0, 0, 1, 1), E(0.2, 0.2, 0.6, 0.6, 'light'), E(0.38, 0.38, 0.24, 0.24, 'body'), L(0.5, 0, 0.5, 1), L(0, 0.5, 1, 0.5)] },
  { type: 'tree-oak', label: 'Oak tree', category: 'Outdoor', w: 5.0, d: 5.0, color: '#4f9d5d', height: 9, shapes: [E(0, 0, 1, 1), E(0.12, 0.12, 0.76, 0.76, 'light'), E(0.46, 0.46, 0.08, 0.08, 'dark')] },
  { type: 'tree-pine', label: 'Pine tree', category: 'Outdoor', w: 3.0, d: 3.0, color: '#2f6f4a', height: 11, shapes: [E(0, 0, 1, 1), E(0.25, 0.25, 0.5, 0.5, 'light'), E(0.44, 0.44, 0.12, 0.12, 'dark')] },
  { type: 'tree-birch', label: 'Birch tree', category: 'Outdoor', w: 2.6, d: 2.6, color: '#9bc77a', height: 8, shapes: [E(0, 0, 1, 1), E(0.2, 0.2, 0.6, 0.6, 'light'), E(0.45, 0.45, 0.1, 0.1, 'white')] },
  { type: 'tree-palm', label: 'Palm tree', category: 'Outdoor', w: 3.2, d: 3.2, color: '#3f8f4f', height: 6, shapes: [E(0.42, 0.42, 0.16, 0.16, 'dark'), L(0.5, 0.5, 0.5, 0), L(0.5, 0.5, 1, 0.5), L(0.5, 0.5, 0.5, 1), L(0.5, 0.5, 0, 0.5), L(0.5, 0.5, 0.85, 0.15), L(0.5, 0.5, 0.85, 0.85), L(0.5, 0.5, 0.15, 0.85), L(0.5, 0.5, 0.15, 0.15), E(0, 0, 1, 1, 'none')] },
  { type: 'tree-apple', label: 'Fruit tree', category: 'Outdoor', w: 3.2, d: 3.2, color: '#6dae5b', height: 4.2, shapes: [E(0, 0, 1, 1), E(0.15, 0.15, 0.7, 0.7, 'light'), E(0.3, 0.3, 0.08, 0.08, 'dark'), E(0.62, 0.4, 0.08, 0.08, 'dark'), E(0.45, 0.65, 0.08, 0.08, 'dark')] },
  { type: 'tree-cypress', label: 'Cypress', category: 'Outdoor', w: 1.0, d: 1.0, color: '#2f5f3f', height: 6.5, shapes: [E(0, 0, 1, 1), E(0.3, 0.3, 0.4, 0.4, 'light')] },
  { type: 'gate-garden', label: 'Garden gate', category: 'Outdoor', w: 1.0, d: 0.08, color: '#7a6650', height: 1.2, shapes: [R(0, 0, 1, 1), ...Array.from({ length: 5 }, (_, i) => L((i + 1) / 6, 0, (i + 1) / 6, 1))] },
  { type: 'gate-driveway', label: 'Driveway gate (double)', category: 'Outdoor', w: 3.6, d: 0.1, color: '#374151', height: 1.6, shapes: [R(0, 0, 1, 1), L(0.5, 0, 0.5, 1), R(0, 0, 0.03, 1, 'dark'), R(0.97, 0, 0.03, 1, 'dark')] },
  { type: 'gate-sliding', label: 'Sliding gate', category: 'Outdoor', w: 4.0, d: 0.12, color: '#374151', height: 1.6, shapes: [R(0, 0, 1, 1), L(0.1, 0, 0.1, 1), L(0.3, 0, 0.3, 1), L(0.5, 0, 0.5, 1), L(0.7, 0, 0.7, 1), L(0.9, 0, 0.9, 1)] },

  // ---- Heating and cooling
  { type: 'heat-pump', label: 'Heat pump (outdoor)', category: 'Heating & cooling', w: 1.0, d: 0.4, color: '#e5e7eb', height: 0.85, shapes: [R(0, 0, 1, 1, 'body', 0.05), E(0.12, 0.2, 0.4, 0.7, 'light'), E(0.28, 0.45, 0.08, 0.2, 'dark'), L(0.62, 0.2, 0.9, 0.2), L(0.62, 0.4, 0.9, 0.4), L(0.62, 0.6, 0.9, 0.6)] },
  { type: 'ac-split', label: 'Air conditioner (indoor)', category: 'Heating & cooling', w: 0.95, d: 0.25, color: '#f3f4f6', wallMounted: true, height: 0.3, shapes: [R(0, 0, 1, 1, 'body', 0.2), L(0.1, 0.8, 0.9, 0.8), R(0.82, 0.15, 0.1, 0.12, 'dark')] },
  { type: 'ac-outdoor', label: 'Air conditioner (outdoor)', category: 'Heating & cooling', w: 0.85, d: 0.35, color: '#d1d5db', height: 0.65, shapes: [R(0, 0, 1, 1, 'body', 0.05), E(0.1, 0.18, 0.42, 0.64, 'light'), L(0.62, 0.2, 0.9, 0.2), L(0.62, 0.5, 0.9, 0.5), L(0.62, 0.8, 0.9, 0.8)] },
  { type: 'boiler', label: 'Boiler', category: 'Heating & cooling', w: 0.4, d: 0.35, color: '#f5f5f4', wallMounted: true, height: 0.75, shapes: [R(0, 0, 1, 1, 'body', 0.08), R(0.15, 0.12, 0.7, 0.2, 'dark', 0.1), E(0.4, 0.5, 0.2, 0.25, 'light')] },
  { type: 'wood-stove', label: 'Wood stove', category: 'Heating & cooling', w: 0.55, d: 0.5, color: '#1f2937', height: 1.1, shapes: [R(0, 0, 1, 1, 'body', 0.08), R(0.15, 0.55, 0.7, 0.3, 'light', 0.05), E(0.38, 0.12, 0.24, 0.26, 'dark')] },
  { type: 'ceiling-fan', label: 'Ceiling fan', category: 'Heating & cooling', w: 1.1, d: 1.1, color: '#a5835a', layer: 'tech', height: 0.3, shapes: [E(0.4, 0.4, 0.2, 0.2, 'dark'), R(0.5, 0.05, 0.12, 0.4, 'body', 0.5), R(0.5, 0.55, 0.12, 0.4, 'body', 0.5), R(0.05, 0.5, 0.4, 0.12, 'body', 0.5), R(0.55, 0.4, 0.4, 0.12, 'body', 0.5)] },
  { type: 'duct', label: 'Ventilation duct', category: 'Heating & cooling', w: 2.0, d: 0.3, color: '#9ca3af', layer: 'tech', height: 0.3, shapes: [R(0, 0, 1, 1, 'body', 0.08), L(0.15, 0, 0.15, 1), L(0.35, 0, 0.35, 1), L(0.55, 0, 0.55, 1), L(0.75, 0, 0.75, 1), L(0.95, 0, 0.95, 1)] },
  { type: 'vent', label: 'Vent / air outlet', category: 'Heating & cooling', w: 0.35, d: 0.35, color: '#d1d5db', layer: 'tech', height: 0.04, shapes: [R(0, 0, 1, 1, 'body', 0.1), L(0.15, 0.3, 0.85, 0.3), L(0.15, 0.5, 0.85, 0.5), L(0.15, 0.7, 0.85, 0.7)] },
  { type: 'flue', label: 'Flue / chimney marker', category: 'Heating & cooling', w: 0.25, d: 0.25, color: '#6b7280', layer: 'tech', height: 2.6, shapes: [E(0, 0, 1, 1), E(0.25, 0.25, 0.5, 0.5, 'dark'), L(0.2, 0.2, 0.8, 0.8), L(0.8, 0.2, 0.2, 0.8)] },
  { type: 'underfloor', label: 'Underfloor heating zone', category: 'Heating & cooling', w: 2.4, d: 1.8, color: '#fca5a5', layer: 'tech', height: 0.01, shapes: [R(0, 0, 1, 1, 'light', 0.03), L(0.08, 0.12, 0.92, 0.12, 0.92, 0.3, 0.08, 0.3, 0.08, 0.48, 0.92, 0.48, 0.92, 0.66, 0.08, 0.66, 0.08, 0.84, 0.92, 0.84)] },

  // ---- People and pets
  { type: 'person', label: 'Person (adult)', category: 'People & pets', w: 0.5, d: 0.3, color: '#6b7fa8', height: 1.75, shapes: [E(0, 0.15, 1, 0.7, 'body'), E(0.32, 0.2, 0.36, 0.6, 'light'), L(0.5, 0.8, 0.5, 1)] },
  { type: 'person-child', label: 'Child', category: 'People & pets', w: 0.35, d: 0.22, color: '#e2a35c', height: 1.1, shapes: [E(0, 0.15, 1, 0.7, 'body'), E(0.32, 0.2, 0.36, 0.6, 'light')] },
  { type: 'dog', label: 'Dog', category: 'People & pets', w: 0.35, d: 0.75, color: '#a5835a', height: 0.55, shapes: [R(0.12, 0.2, 0.76, 0.8, 'body', 0.4), E(0.2, 0, 0.6, 0.3, 'light'), L(0.5, 1, 0.5, 0.9)] },
  { type: 'cat', label: 'Cat', category: 'People & pets', w: 0.2, d: 0.5, color: '#9ca3af', height: 0.3, shapes: [R(0.1, 0.25, 0.8, 0.75, 'body', 0.4), E(0.15, 0, 0.7, 0.3, 'light')] },
  { type: 'dog-bed', label: 'Pet bed', category: 'People & pets', w: 0.8, d: 0.6, color: '#c7d7ee', height: 0.15, shapes: [R(0, 0, 1, 1, 'body', 0.3), R(0.12, 0.15, 0.76, 0.7, 'light', 0.25)] },
  { type: 'cat-tree', label: 'Cat tree', category: 'People & pets', w: 0.5, d: 0.5, color: '#d9c7b0', height: 1.5, shapes: [R(0, 0, 1, 1, 'body', 0.05), E(0.1, 0.1, 0.8, 0.8, 'light'), E(0.38, 0.38, 0.24, 0.24, 'dark')] },
  { type: 'pet-bowls', label: 'Pet bowls', category: 'People & pets', w: 0.45, d: 0.2, color: '#9ca3af', height: 0.08, shapes: [R(0, 0, 1, 1, 'body', 0.2), E(0.06, 0.15, 0.4, 0.7, 'light'), E(0.54, 0.15, 0.4, 0.7, 'light')] },
  { type: 'litter-box', label: 'Litter box', category: 'People & pets', w: 0.4, d: 0.5, color: '#e5e7eb', height: 0.16, shapes: [R(0, 0, 1, 1, 'body', 0.15), R(0.08, 0.1, 0.84, 0.8, 'light', 0.12)] },

  // ---- Window dressing
  { type: 'curtain', label: 'Curtains', category: 'Window dressing', w: 1.9, d: 0.14, color: '#c7d7ee', wallMounted: true, height: 2.5, shapes: [R(0, 0, 0.3, 1, 'body', 0.2), R(0.7, 0, 0.3, 1, 'body', 0.2), L(0.08, 0.1, 0.08, 0.9), L(0.16, 0.1, 0.16, 0.9), L(0.84, 0.1, 0.84, 0.9), L(0.92, 0.1, 0.92, 0.9), L(0, 0.5, 1, 0.5)] },
  { type: 'curtain-sheer', label: 'Sheer curtain', category: 'Window dressing', w: 1.9, d: 0.1, color: '#f8fafc', wallMounted: true, height: 2.5, shapes: [R(0, 0, 1, 1, 'light', 0.2), L(0, 0.5, 1, 0.5)] },
  { type: 'blind-roller', label: 'Roller blind', category: 'Window dressing', w: 1.2, d: 0.06, color: '#e8e0d0', wallMounted: true, height: 1.5, shapes: [R(0, 0, 1, 1, 'body'), R(0, 0, 1, 0.5, 'dark')] },
  { type: 'blind-venetian', label: 'Venetian blind', category: 'Window dressing', w: 1.2, d: 0.06, color: '#d9d2c5', wallMounted: true, height: 1.4, shapes: [R(0, 0, 1, 1, 'body'), ...slats(4)] },
];
