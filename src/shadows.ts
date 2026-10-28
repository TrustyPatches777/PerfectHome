/**
 * Shadow shapes for the sun layer. Everything is a list of polygons that can be filled together
 * (all with the same orientation, so overlapping ones merge instead of cancelling out).
 */
import { catalogItem, catalogLayer, furnitureHeight } from './catalog';
import { wallOutlinePoints, rotatePoint } from './geometry';
import type { Design, Furniture, Point } from './model';
import { roofAt } from './roofs';
import { rectCorners } from './selection';
import { shadowOffset, type SunPosition } from './sun';

/** Signed area; with y pointing down a positive value means clockwise on screen. */
function signedArea(p: Point[]): number {
  let s = 0;
  for (let i = 0; i < p.length; i++) {
    const a = p[i];
    const b = p[(i + 1) % p.length];
    s += a.x * b.y - b.x * a.y;
  }
  return s / 2;
}

/** The same polygon, always wound the same way. */
export const normalized = (p: Point[]): Point[] => (signedArea(p) < 0 ? [...p].reverse() : p);

/**
 * The area covered when `poly` is pushed along (dx, dy): the polygon itself plus one parallelogram per edge.
 * Works for any simple polygon, convex or not.
 */
export function sweepPolygon(poly: Point[], dx: number, dy: number): Point[][] {
  const out: Point[][] = [normalized(poly)];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    out.push(
      normalized([
        a,
        b,
        { x: b.x + dx, y: b.y + dy },
        { x: a.x + dx, y: a.y + dy },
      ]),
    );
  }
  return out;
}

export function ellipsePolygon(cx: number, cy: number, rx: number, ry: number, rotation: number, n = 20): Point[] {
  const c = { x: cx, y: cy };
  const pts: Point[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push(rotatePoint({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry }, c, rotation));
  }
  return pts;
}

/** Outline of a piece of furniture as seen from above (round things are ellipses, the rest boxes). */
export function furnitureFootprint(f: Furniture): Point[] {
  const first = catalogItem(f.type).shapes[0];
  const round = first?.t === 'ellipse' && first.x < 0.05 && first.y < 0.05 && first.w > 0.9 && first.h > 0.9;
  return round ? ellipsePolygon(f.x, f.y, f.w / 2, f.d / 2, f.rotation) : rectCorners(f.x, f.y, f.w, f.d, f.rotation);
}

/** How much of the sun a see-through screen (slats, a pergola, sheer cloth) lets through: its shadow is painted this much lighter. */
export const VEIL_STRENGTH = 0.55;

/** Catalog items that are only partly solid: they cast a lighter shadow. */
export const VEILED_ITEMS: ReadonlySet<string> = new Set(['pergola', 'gate-garden', 'gate-sliding', 'gate-driveway', 'kr-hanji-door', 'kr-hanji-screen', 'curtain-sheer', 'wg-birdcage', 'headboard-wood']);

export interface ShadowSet {
  /** Dark areas to paint. */
  shadows: Point[][];
  /** Shadows of see-through things (a slat partition, a pergola): painted lighter, in proportion to how much of them is solid. */
  veils: Point[][];
  /** Areas to keep light even if a shadow covers them (the inside of the building, under its own roof). */
  cutouts: Point[][];
}

/** Index of the lowest floor that is not a basement (where the garden is). */
export function groundIndex(d: Design): number {
  const i = d.floors.findIndex((f) => !/^basement/i.test(f.name));
  return i < 0 ? 0 : i;
}

export function computeShadows(d: Design, floor: string, sun: SunPosition): ShadowSet {
  const shadows: Point[][] = [];
  const veils: Point[][] = [];
  const cutouts: Point[][] = [];
  const north = d.site.north;
  const add = (poly: Point[], height: number, veil = false) => {
    const off = shadowOffset(sun, north, height);
    if (off) (veil ? veils : shadows).push(...sweepPolygon(poly, off.dx, off.dy));
  };

  // glass lets the light through; slats let part of it through (the 3D view casts the real striped shadow, the plan a lighter one)
  for (const w of d.walls.filter((x) => x.floor === floor && x.type !== 'glass')) add(wallOutlinePoints(w), w.height, w.type === 'slats');

  for (const f of d.furniture.filter((x) => x.floor === floor)) {
    if (catalogLayer(f.type) === 'tech') continue; // sockets, switches and ceiling lights cast nothing worth drawing
    const h = furnitureHeight(f);
    if (h >= 0.2) add(furnitureFootprint(f), h, VEILED_ITEMS.has(f.type));
  }

  for (const s of d.strips.filter((x) => x.floor === floor)) {
    const h = s.kind === 'fence' ? 1.8 : s.kind === 'hedge' ? 1.5 : 0;
    if (!h) continue;
    const half = Math.max(s.width, 0.08) / 2;
    for (let i = 1; i < s.points.length; i++) {
      const a = s.points[i - 1];
      const b = s.points[i];
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const nx = (-(b.y - a.y) / len) * half;
      const ny = ((b.x - a.x) / len) * half;
      add([{ x: a.x + nx, y: a.y + ny }, { x: b.x + nx, y: b.y + ny }, { x: b.x - nx, y: b.y - ny }, { x: a.x - nx, y: a.y - ny }], h);
    }
  }

  // the house itself throws a big shadow onto the garden (seen from the ground floor)
  const gi = groundIndex(d);
  const here = d.floors.findIndex((f) => f.id === floor);
  if (here === gi) {
    const ground = d.floors[gi].id;
    const height = (d.floors.length - gi) * d.settings.storeyHeight + 0.4;
    const rooms = d.rooms.filter((r) => r.floor === ground);
    // a room under a glass roof (a winter garden) lets part of the light through; glass walls and slat partitions are not part of the solid house
    const glassRoofed = (pts: Point[]) => roofAt(d.roofs, ground, { x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length })?.material === 'glass';
    const wallsHere = d.walls.filter((w) => w.floor === ground);
    const solid = [...rooms.filter((r) => !glassRoofed(r.points)).map((r) => r.points), ...wallsHere.filter((w) => w.type !== 'glass' && w.type !== 'slats').map((w) => wallOutlinePoints(w))];
    for (const poly of solid) add(poly, height);
    for (const r of rooms.filter((x) => glassRoofed(x.points))) add(r.points, height, true);
    cutouts.push(...[...rooms.map((r) => r.points), ...wallsHere.map((w) => wallOutlinePoints(w))].map(normalized));
  }
  return { shadows, veils, cutouts };
}
