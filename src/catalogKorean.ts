/**
 * Two more groups for the catalog: Korean furniture and household items (low tables and floor seating, chests, screens, hanji doors, ondol,
 * kimchi refrigerator...) and winter garden furniture (rattan, plants, planters, a fountain). 3D models: view3d/furniture3d3.ts.
 */
import type { CatalogItem, Fill, Prim } from './catalog';

const R = (x: number, y: number, w: number, h: number, fill: Fill = 'body', r = 0): Prim => ({ t: 'rect', x, y, w, h, fill, r });
const E = (x: number, y: number, w: number, h: number, fill: Fill = 'body'): Prim => ({ t: 'ellipse', x, y, w, h, fill });
const L = (...pts: number[]): Prim => ({ t: 'line', pts });

const grid = (nx: number, ny: number, x0 = 0.06, y0 = 0.1, x1 = 0.94, y1 = 0.9): Prim[] => [
  ...Array.from({ length: nx - 1 }, (_, i) => L(x0 + ((x1 - x0) * (i + 1)) / nx, y0, x0 + ((x1 - x0) * (i + 1)) / nx, y1)),
  ...Array.from({ length: ny - 1 }, (_, i) => L(x0, y0 + ((y1 - y0) * (i + 1)) / ny, x1, y0 + ((y1 - y0) * (i + 1)) / ny)),
];

export const KOREAN_ITEMS: CatalogItem[] = [
  { type: 'kr-soban', label: 'Soban (low dining tray table)', category: 'Korean', w: 0.8, d: 0.5, color: '#8b5a2b', height: 0.28, shapes: [R(0, 0, 1, 1, 'body', 0.06), R(0.06, 0.1, 0.88, 0.8, 'light', 0.04)] },
  { type: 'kr-low-table', label: 'Low family table', category: 'Korean', w: 1.2, d: 0.8, color: '#a5835a', height: 0.34, shapes: [R(0, 0, 1, 1, 'body', 0.04), R(0.05, 0.07, 0.9, 0.86, 'light', 0.03), L(0.5, 0.07, 0.5, 0.93)] },
  { type: 'kr-bbq-table', label: 'Korean BBQ table', category: 'Korean', w: 1.2, d: 0.8, color: '#6b4a2f', height: 0.75, shapes: [R(0, 0, 1, 1, 'body', 0.04), E(0.36, 0.26, 0.28, 0.48, 'dark'), E(0.42, 0.34, 0.16, 0.32, 'light')] },
  { type: 'kr-floor-cushion', label: 'Floor cushion (bangseok)', category: 'Korean', w: 0.6, d: 0.6, color: '#c0504d', height: 0.08, shapes: [R(0, 0, 1, 1, 'body', 0.1), R(0.12, 0.12, 0.76, 0.76, 'light', 0.08), E(0.46, 0.46, 0.08, 0.08, 'dark')] },
  { type: 'kr-floor-chair', label: 'Floor chair (jwaeshik)', category: 'Korean', w: 0.45, d: 0.5, color: '#8b7355', height: 0.62, shapes: [R(0, 0.25, 1, 0.75, 'body', 0.1), R(0.06, 0, 0.88, 0.3, 'dark', 0.1), R(0.1, 0.4, 0.8, 0.52, 'light', 0.08)] },
  { type: 'kr-yo', label: 'Floor bedding (yo & ibul)', category: 'Korean', w: 1.0, d: 2.0, color: '#d8d0e8', height: 0.12, shapes: [R(0, 0, 1, 1, 'body', 0.03), R(0.04, 0.03, 0.92, 0.94, 'white', 0.02), R(0.15, 0.04, 0.7, 0.14, 'light', 0.3), R(0.04, 0.3, 0.92, 0.66, 'body', 0.02), L(0.04, 0.3, 0.96, 0.3)] },
  { type: 'kr-chest', label: 'Traditional chest (jangnong)', category: 'Korean', w: 1.0, d: 0.5, color: '#7a4a28', height: 1.2, wallMounted: true, shapes: [R(0, 0, 1, 1, 'body'), L(0.5, 0, 0.5, 1), E(0.2, 0.9, 0.06, 0.1, 'light'), E(0.74, 0.9, 0.06, 0.1, 'light')] },
  { type: 'kr-cabinet', label: 'Low cabinet (bandaji)', category: 'Korean', w: 0.9, d: 0.45, color: '#8b5a2b', height: 0.8, wallMounted: true, shapes: [R(0, 0, 1, 1, 'body'), L(0.5, 0, 0.5, 1), R(0.05, 0.1, 0.4, 0.8, 'light', 0.03), R(0.55, 0.1, 0.4, 0.8, 'light', 0.03)] },
  { type: 'kr-medicine-chest', label: 'Medicine chest (yakjang)', category: 'Korean', w: 0.5, d: 0.35, color: '#7a4a28', height: 0.65, shapes: [R(0, 0, 1, 1, 'body', 0.04), ...grid(4, 5, 0.08, 0.1, 0.92, 0.9)] },
  { type: 'kr-screen', label: 'Folding screen (byeongpung)', category: 'Korean', w: 1.8, d: 0.35, color: '#c9a97c', height: 1.4, shapes: [L(0, 0.1, 0.17, 0.9, 0.33, 0.1, 0.5, 0.9, 0.67, 0.1, 0.83, 0.9, 1, 0.1), R(0, 0.06, 1, 0.06, 'none')] },
  { type: 'kr-hanji-door', label: 'Hanji lattice door panel', category: 'Korean', w: 0.9, d: 0.06, color: '#f5efe0', height: 2.0, shapes: [R(0, 0, 1, 1, 'light'), L(0.33, 0, 0.33, 1), L(0.66, 0, 0.66, 1)] },
  { type: 'kr-hanji-screen', label: 'Hanji sliding door (pair)', category: 'Korean', w: 1.8, d: 0.08, color: '#f5efe0', height: 2.0, shapes: [R(0, 0, 0.52, 1, 'light'), R(0.48, 0, 0.52, 1, 'light'), L(0.26, 0, 0.26, 1), L(0.74, 0, 0.74, 1)] },
  { type: 'kr-kimchi-fridge', label: 'Kimchi refrigerator', category: 'Korean', w: 0.6, d: 0.7, color: '#e5e7eb', height: 1.8, shapes: [R(0, 0, 1, 1, 'body', 0.05), R(0.06, 0.06, 0.88, 0.45, 'light', 0.05), R(0.06, 0.55, 0.88, 0.38, 'light', 0.05), R(0.8, 0.45, 0.1, 0.05, 'dark')] },
  { type: 'kr-onggi', label: 'Onggi jars (jangdokdae)', category: 'Korean', w: 0.9, d: 0.5, color: '#8b5a3c', height: 0.65, shapes: [E(0.02, 0.28, 0.4, 0.7), E(0.3, 0.02, 0.42, 0.7), E(0.62, 0.3, 0.36, 0.68), E(0.1, 0.4, 0.24, 0.4, 'dark'), E(0.38, 0.14, 0.26, 0.4, 'dark'), E(0.7, 0.4, 0.2, 0.36, 'dark')] },
  { type: 'kr-rice-cooker', label: 'Pressure rice cooker', category: 'Korean', w: 0.32, d: 0.3, color: '#f3f4f6', height: 0.3, shapes: [R(0, 0, 1, 1, 'body', 0.25), E(0.2, 0.15, 0.6, 0.6, 'light'), R(0.3, 0.8, 0.4, 0.14, 'dark', 0.4)] },
  { type: 'kr-tea-set', label: 'Tea tray set (darye)', category: 'Korean', w: 0.5, d: 0.35, color: '#a5835a', height: 0.12, shapes: [R(0, 0, 1, 1, 'body', 0.08), E(0.1, 0.18, 0.2, 0.3, 'white'), E(0.38, 0.18, 0.2, 0.3, 'white'), E(0.66, 0.2, 0.24, 0.5, 'dark')] },
  { type: 'kr-shoe-cabinet', label: 'Entrance shoe cabinet (sinjangjang)', category: 'Korean', w: 1.0, d: 0.35, color: '#e5e7eb', height: 1.1, wallMounted: true, shapes: [R(0, 0, 1, 1), ...grid(3, 1, 0.04, 0.1, 0.96, 0.9), R(0.04, 0.82, 0.92, 0.08, 'light')] },
  { type: 'kr-hanbok-stand', label: 'Hanbok stand', category: 'Korean', w: 0.55, d: 0.3, color: '#e8b4b4', height: 1.5, shapes: [E(0, 0.1, 1, 0.8, 'body'), E(0.3, 0.3, 0.4, 0.4, 'light'), L(0.5, 0.1, 0.5, 0.9)] },
  { type: 'kr-lantern', label: 'Hanji paper lamp', category: 'Korean', w: 0.4, d: 0.4, color: '#fff0c2', height: 1.3, lamp: { radius: 2.6, color: '#ffd98a' }, shapes: [E(0, 0, 1, 1, 'body'), E(0.2, 0.2, 0.6, 0.6, 'light'), E(0.44, 0.44, 0.12, 0.12, 'dark')] },
  { type: 'kr-baduk', label: 'Baduk (Go) board', category: 'Korean', w: 0.5, d: 0.5, color: '#d9a85c', height: 0.15, shapes: [R(0, 0, 1, 1, 'body', 0.04), ...grid(8, 8, 0.1, 0.1, 0.9, 0.9), E(0.4, 0.4, 0.08, 0.08, 'dark'), E(0.52, 0.52, 0.08, 0.08, 'white')] },
  { type: 'kr-gayageum', label: 'Gayageum (zither)', category: 'Korean', w: 1.5, d: 0.3, color: '#8b5a2b', height: 0.2, shapes: [R(0, 0, 1, 1, 'body', 0.2), L(0.1, 0.3, 0.9, 0.3), L(0.1, 0.5, 0.9, 0.5), L(0.1, 0.7, 0.9, 0.7)] },
  { type: 'kr-ondol', label: 'Ondol heated floor zone', category: 'Korean', w: 3.0, d: 2.2, color: '#f87171', layer: 'tech', height: 0.01, shapes: [R(0, 0, 1, 1, 'light', 0.03), L(0.08, 0.1, 0.92, 0.1, 0.92, 0.27, 0.08, 0.27, 0.08, 0.44, 0.92, 0.44, 0.92, 0.61, 0.08, 0.61, 0.08, 0.78, 0.92, 0.78)] },
];

export const WINTER_ITEMS: CatalogItem[] = [
  { type: 'wg-rattan-sofa', label: 'Rattan sofa', category: 'Winter garden', w: 1.9, d: 0.85, color: '#c9a97c', height: 0.8, shapes: [R(0, 0, 1, 1, 'body', 0.12), R(0, 0, 1, 0.26, 'dark', 0.12), R(0, 0.2, 0.1, 0.8, 'dark', 0.2), R(0.9, 0.2, 0.1, 0.8, 'dark', 0.2), R(0.12, 0.3, 0.38, 0.62, 'light', 0.1), R(0.5, 0.3, 0.38, 0.62, 'light', 0.1)] },
  { type: 'wg-rattan-chair', label: 'Rattan armchair', category: 'Winter garden', w: 0.75, d: 0.75, color: '#c9a97c', height: 0.85, shapes: [E(0, 0, 1, 1, 'body'), E(0.15, 0.2, 0.7, 0.7, 'light'), R(0.1, 0, 0.8, 0.22, 'dark', 0.4)] },
  { type: 'wg-bistro-set', label: 'Bistro table with two chairs', category: 'Winter garden', w: 1.3, d: 0.8, color: '#4b5563', height: 0.8, shapes: [E(0.3, 0.1, 0.4, 0.8), E(0.34, 0.2, 0.32, 0.6, 'light'), R(0, 0.3, 0.22, 0.4, 'dark', 0.3), R(0.78, 0.3, 0.22, 0.4, 'dark', 0.3)] },
  { type: 'wg-daybed', label: 'Garden daybed', category: 'Winter garden', w: 2.0, d: 0.95, color: '#f1e8d8', height: 0.7, shapes: [R(0, 0, 1, 1, 'body', 0.06), R(0.03, 0.04, 0.94, 0.92, 'light', 0.05), R(0.05, 0.08, 0.3, 0.3, 'white', 0.2), R(0.4, 0.08, 0.3, 0.3, 'white', 0.2)] },
  { type: 'wg-plant-stand', label: 'Tiered plant stand', category: 'Winter garden', w: 1.0, d: 0.4, color: '#a5835a', height: 1.3, shapes: [R(0, 0, 1, 1, 'body', 0.05), E(0.06, 0.15, 0.2, 0.7, 'light'), E(0.4, 0.15, 0.2, 0.7, 'light'), E(0.74, 0.15, 0.2, 0.7, 'light')] },
  { type: 'wg-planter', label: 'Long planter', category: 'Winter garden', w: 1.5, d: 0.4, color: '#9c6644', height: 0.55, shapes: [R(0, 0, 1, 1, 'body', 0.05), R(0.04, 0.12, 0.92, 0.76, 'light', 0.05), E(0.1, 0.2, 0.2, 0.6, 'dark'), E(0.4, 0.15, 0.22, 0.7, 'dark'), E(0.7, 0.2, 0.2, 0.6, 'dark')] },
  { type: 'wg-palm', label: 'Potted palm', category: 'Winter garden', w: 0.9, d: 0.9, color: '#4f9d5d', height: 2.3, shapes: [E(0.325, 0.325, 0.35, 0.35, 'dark'), L(0.5, 0.5, 0.5, 0), L(0.5, 0.5, 1, 0.5), L(0.5, 0.5, 0.5, 1), L(0.5, 0.5, 0, 0.5), L(0.5, 0.5, 0.85, 0.15), L(0.5, 0.5, 0.85, 0.85), L(0.5, 0.5, 0.15, 0.85), L(0.5, 0.5, 0.15, 0.15), E(0, 0, 1, 1, 'none')] },
  { type: 'wg-ficus', label: 'Fig tree in a pot', category: 'Winter garden', w: 1.0, d: 1.0, color: '#3f8f4f', height: 2.6, shapes: [E(0, 0, 1, 1), E(0.15, 0.15, 0.7, 0.7, 'light'), E(0.42, 0.42, 0.16, 0.16, 'dark')] },
  { type: 'wg-citrus', label: 'Potted lemon tree', category: 'Winter garden', w: 0.8, d: 0.8, color: '#5da35d', height: 1.8, shapes: [E(0, 0, 1, 1), E(0.2, 0.2, 0.6, 0.6, 'light'), E(0.3, 0.3, 0.1, 0.1, 'dark'), E(0.6, 0.45, 0.1, 0.1, 'dark'), E(0.42, 0.62, 0.1, 0.1, 'dark')] },
  { type: 'wg-fountain', label: 'Tiered fountain', category: 'Winter garden', w: 0.9, d: 0.9, color: '#cbd5e1', height: 0.9, shapes: [E(0, 0, 1, 1), E(0.1, 0.1, 0.8, 0.8, 'light'), E(0.3, 0.3, 0.4, 0.4, 'body'), E(0.44, 0.44, 0.12, 0.12, 'white')] },
  { type: 'wg-potting-bench', label: 'Potting bench', category: 'Winter garden', w: 1.5, d: 0.6, color: '#a5835a', height: 0.9, shapes: [R(0, 0, 1, 1, 'body', 0.03), R(0.04, 0.08, 0.92, 0.84, 'light', 0.03), E(0.1, 0.25, 0.14, 0.5, 'dark'), E(0.3, 0.3, 0.12, 0.4, 'dark'), R(0.6, 0.2, 0.3, 0.6, 'body', 0.05)] },
  { type: 'wg-hanging-basket', label: 'Hanging plant basket', category: 'Winter garden', w: 0.45, d: 0.45, color: '#6dae5b', layer: 'tech', height: 0.6, shapes: [E(0, 0, 1, 1), E(0.2, 0.2, 0.6, 0.6, 'light'), E(0.44, 0.44, 0.12, 0.12, 'dark')] },
  { type: 'wg-orchid', label: 'Orchid on a table', category: 'Winter garden', w: 0.25, d: 0.25, color: '#e9a8d2', height: 0.6, shapes: [E(0.15, 0.15, 0.7, 0.7, 'dark'), E(0.3, 0.3, 0.4, 0.4, 'body'), E(0.42, 0.42, 0.16, 0.16, 'white')] },
  { type: 'wg-birdcage', label: 'Bird cage on a stand', category: 'Winter garden', w: 0.5, d: 0.5, color: '#d6c28a', height: 1.7, shapes: [E(0.22, 0.22, 0.56, 0.56, 'body'), E(0.3, 0.3, 0.4, 0.4, 'light'), L(0.5, 0.15, 0.5, 0.85), L(0.15, 0.5, 0.85, 0.5)] },
];
