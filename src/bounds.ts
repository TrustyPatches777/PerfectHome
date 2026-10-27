import type { Bounds } from './geometry';
import type { Design, Point } from './model';

export type { Bounds };

/** Bounding box of everything in the design, or null when it is empty. */
export function contentBounds(d: Design, floor?: string): Bounds | null {
  const on = <T extends { floor: string }>(items: T[]) => (floor ? items.filter((i) => i.floor === floor) : items);
  const pts: Point[] = [];
  for (const w of on(d.walls)) pts.push(w.a, w.b);
  for (const r of on(d.rooms)) pts.push(...r.points);
  for (const z of on(d.zones)) pts.push(...z.points);
  for (const s of on(d.strips)) pts.push(...s.points);
  for (const dim of on(d.dimensions)) pts.push(dim.a, dim.b);
  for (const n of on(d.notes)) pts.push({ x: n.x - 0.3, y: n.y - 0.3 }, { x: n.x + 0.3, y: n.y + 0.3 });
  for (const s of on(d.stairs)) {
    const r = Math.hypot(s.w, s.d) / 2;
    pts.push({ x: s.x - r, y: s.y - r }, { x: s.x + r, y: s.y + r });
  }
  for (const r of on(d.roofs)) {
    const e = Math.hypot(r.w, r.d) / 2 + r.overhang;
    pts.push({ x: r.x - e, y: r.y - e }, { x: r.x + e, y: r.y + e });
  }
  for (const f of on(d.furniture)) {
    const r = Math.hypot(f.w, f.d) / 2;
    pts.push({ x: f.x - r, y: f.y - r }, { x: f.x + r, y: f.y + r });
  }
  for (const l of on(d.labels)) {
    const r = (l.text.length * l.size * 0.6) / 2;
    pts.push({ x: l.x - r, y: l.y - l.size }, { x: l.x + r, y: l.y + l.size });
  }
  if (!pts.length) return null;
  return {
    minX: Math.min(...pts.map((p) => p.x)),
    minY: Math.min(...pts.map((p) => p.y)),
    maxX: Math.max(...pts.map((p) => p.x)),
    maxY: Math.max(...pts.map((p) => p.y)),
  };
}
