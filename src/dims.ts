/**
 * Automatic dimension labels for "Show all dimensions": wall lengths (on the outside of rooms), room sizes,
 * outdoor area sizes, street lengths and furniture sizes. Pure; the canvas just draws what it returns.
 */
import { formatArea, pointInPolygon, polygonArea, wallLength, wallPointAt } from './geometry';
import { polylineLength } from './outdoor';
import type { Design, Point } from './model';

export interface DimLabel {
  text: string;
  x: number;
  y: number;
  /** Degrees; always upright (between -90 and 90). */
  angle: number;
  kind: 'wall' | 'room' | 'zone' | 'strip' | 'furniture';
}

const upright = (deg: number) => {
  let a = ((deg % 360) + 360) % 360;
  if (a > 180) a -= 360;
  if (a > 90) a -= 180;
  if (a < -90) a += 180;
  return a;
};

/** Meters with at most two decimals and no unit: "3.2", "0.45". */
export const plainMeters = (m: number) => `${Math.round(m * 100) / 100}`;

/** Is a polygon an axis-aligned rectangle? Returns its width and height if so. */
export function rectangleSize(pts: Point[]): { w: number; h: number } | null {
  if (pts.length !== 4) return null;
  const xs = [...new Set(pts.map((p) => Math.round(p.x * 100) / 100))];
  const ys = [...new Set(pts.map((p) => Math.round(p.y * 100) / 100))];
  if (xs.length !== 2 || ys.length !== 2) return null;
  return { w: Math.abs(xs[0] - xs[1]), h: Math.abs(ys[0] - ys[1]) };
}

export function autoDimensions(d: Design, floor: string, zoom: number): DimLabel[] {
  const out: DimLabel[] = [];
  const rooms = d.rooms.filter((r) => r.floor === floor);
  const insideSomeRoom = (p: Point) => rooms.some((r) => pointInPolygon(p, r.points));
  const pxPerChar = 7; // rough width of a label character on screen, to skip labels that would not fit

  for (const w of d.walls.filter((x) => x.floor === floor)) {
    const L = wallLength(w);
    if (L < 0.3) continue;
    const text = plainMeters(L);
    if (L * zoom < text.length * pxPerChar + 8) continue;
    const wp = wallPointAt(w, L / 2);
    const off = w.thickness / 2 + 0.22;
    const a = { x: wp.p.x + wp.n.x * off, y: wp.p.y + wp.n.y * off };
    const b = { x: wp.p.x - wp.n.x * off, y: wp.p.y - wp.n.y * off };
    // put the label on the outside of the room(s), where it does not collide with the room's own text
    const at = insideSomeRoom(a) && !insideSomeRoom(b) ? b : a;
    out.push({ text, x: at.x, y: at.y, angle: upright(wp.angle), kind: 'wall' });
  }

  for (const r of rooms) {
    const rect = rectangleSize(r.points);
    if (!rect) continue;
    const xs = r.points.map((p) => p.x);
    const ys = r.points.map((p) => p.y);
    out.push({ text: `${plainMeters(rect.w)} × ${plainMeters(rect.h)}`, x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 + 0.55, angle: 0, kind: 'room' });
  }

  for (const z of d.zones.filter((x) => x.floor === floor)) {
    const rect = rectangleSize(z.points);
    const xs = z.points.map((p) => p.x);
    const ys = z.points.map((p) => p.y);
    if (rect) {
      out.push({ text: plainMeters(rect.w), x: (Math.min(...xs) + Math.max(...xs)) / 2, y: Math.min(...ys) + 0.35, angle: 0, kind: 'zone' });
      out.push({ text: plainMeters(rect.h), x: Math.min(...xs) + 0.35, y: (Math.min(...ys) + Math.max(...ys)) / 2, angle: -90, kind: 'zone' });
    } else {
      out.push({ text: formatArea(polygonArea(z.points)), x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2, angle: 0, kind: 'zone' });
    }
  }

  for (const s of d.strips.filter((x) => x.floor === floor)) {
    const len = polylineLength(s.points);
    const mid = s.points[Math.floor(s.points.length / 2)];
    const a = s.points[Math.max(0, Math.floor(s.points.length / 2) - 1)];
    const ang = upright((Math.atan2(mid.y - a.y, mid.x - a.x) * 180) / Math.PI);
    out.push({ text: plainMeters(len), x: (mid.x + a.x) / 2, y: (mid.y + a.y) / 2 - (s.width / 2 + 0.25), angle: s.points.length > 1 ? ang : 0, kind: 'strip' });
  }

  if (zoom >= 40) {
    for (const f of d.furniture.filter((x) => x.floor === floor)) {
      if (Math.min(f.w, f.d) * zoom < 26) continue;
      out.push({ text: `${Math.round(f.w * 100)} × ${Math.round(f.d * 100)}`, x: f.x, y: f.y + Math.min(0.16, Math.min(f.w, f.d) * 0.28) * 0.9, angle: 0, kind: 'furniture' });
    }
  }
  return out;
}
