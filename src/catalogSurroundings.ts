/**
 * Neighbouring buildings and boundaries (the "Surroundings" group): houses, a terrace, blocks, a tower, a garage, a wall and a fence. They are
 * ordinary furniture items (placed, sized and turned like any), they cast shadows on the plan and in 3D, and they block walking. 3D models: furniture3d4.ts.
 */
import type { CatalogItem, Fill, Prim } from './catalog';

const R = (x: number, y: number, w: number, h: number, fill: Fill = 'body', r = 0): Prim => ({ t: 'rect', x, y, w, h, fill, r });
const L = (...pts: number[]): Prim => ({ t: 'line', pts });

export const SURROUNDINGS_ITEMS: CatalogItem[] = [
  { type: 'nb-house', label: 'Neighbouring house (gabled)', category: 'Surroundings', w: 9.0, d: 7.5, color: '#e8e0d0', height: 7.2, shapes: [R(0, 0, 1, 1, 'body'), L(0, 0.5, 1, 0.5), R(0.05, 0.05, 0.9, 0.4, 'light'), R(0.05, 0.55, 0.9, 0.4, 'light')] },
  { type: 'nb-house-modern', label: 'Neighbouring house (flat roof)', category: 'Surroundings', w: 10, d: 8.5, color: '#d9dde3', height: 6.4, shapes: [R(0, 0, 1, 1, 'body'), R(0.06, 0.06, 0.88, 0.88, 'light'), R(0.6, 0.6, 0.3, 0.3, 'body')] },
  { type: 'nb-terrace', label: 'Terraced houses', category: 'Surroundings', w: 16, d: 9, color: '#d8b9a0', height: 7.4, shapes: [R(0, 0, 1, 1, 'body'), L(0, 0.5, 1, 0.5), L(0.25, 0, 0.25, 1), L(0.5, 0, 0.5, 1), L(0.75, 0, 0.75, 1)] },
  { type: 'nb-block', label: 'Apartment block', category: 'Surroundings', w: 24, d: 12, color: '#cfd3d8', height: 19, shapes: [R(0, 0, 1, 1, 'body'), R(0.03, 0.06, 0.94, 0.88, 'light'), L(0.25, 0.06, 0.25, 0.94), L(0.5, 0.06, 0.5, 0.94), L(0.75, 0.06, 0.75, 0.94)] },
  { type: 'nb-tower', label: 'Tower block', category: 'Surroundings', w: 14, d: 14, color: '#b4bcc8', height: 48, shapes: [R(0, 0, 1, 1, 'body'), R(0.1, 0.1, 0.8, 0.8, 'light'), L(0, 0, 1, 1), L(1, 0, 0, 1)] },
  { type: 'nb-garage', label: "Neighbour's garage", category: 'Surroundings', w: 3.4, d: 6.2, color: '#d9d6cf', height: 2.9, shapes: [R(0, 0, 1, 1, 'body'), L(0.5, 0, 0.5, 1), R(0.1, 0.85, 0.8, 0.1, 'dark')] },
  { type: 'nb-wall', label: 'Boundary wall', category: 'Surroundings', w: 10, d: 0.25, color: '#d6cfc2', height: 2.0, shapes: [R(0, 0, 1, 1, 'body'), L(0.1, 0, 0.1, 1), L(0.3, 0, 0.3, 1), L(0.5, 0, 0.5, 1), L(0.7, 0, 0.7, 1), L(0.9, 0, 0.9, 1)] },
  { type: 'nb-fence', label: "Neighbour's fence", category: 'Surroundings', w: 10, d: 0.1, color: '#a5835a', height: 1.8, shapes: [R(0, 0, 1, 1, 'body'), L(0.05, 0, 0.05, 1), L(0.25, 0, 0.25, 1), L(0.5, 0, 0.5, 1), L(0.75, 0, 0.75, 1), L(0.95, 0, 0.95, 1)] },
];
