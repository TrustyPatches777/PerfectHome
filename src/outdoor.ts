/** Look and defaults of the outdoor features: ground areas (zones) and line features (strips). */
import type { Point, StripKind, ZoneKind } from './model';

export const ZONE_STYLES: Record<ZoneKind, { label: string; color: string; swatches: string[] }> = {
  lawn: { label: 'Lawn', color: '#cfe8c4', swatches: ['#cfe8c4', '#b9dba8', '#e0efc8', '#a8cf9a'] },
  terrace: { label: 'Terrace', color: '#e4dccb', swatches: ['#e4dccb', '#d9cdb5', '#cfc6bb', '#e9e4da'] },
  driveway: { label: 'Driveway', color: '#d4d6da', swatches: ['#d4d6da', '#c3c6cc', '#e1ddd3', '#b7bcc4'] },
  flowerbed: { label: 'Flower bed', color: '#e2c9ae', swatches: ['#e2c9ae', '#d9b99a', '#f0c9d4', '#d6c2e6'] },
  water: { label: 'Pond / pool', color: '#bfe0f5', swatches: ['#bfe0f5', '#a8d4ee', '#cfeaf0'] },
  plot: { label: 'Plot boundary', color: '#f4f1e6', swatches: ['#f4f1e6', '#ffffff', '#ecf2e4'] },
};

export const STRIP_STYLES: Record<StripKind, { label: string; color: string }> = {
  road: { label: 'Street', color: '#a3a9b3' },
  path: { label: 'Footpath', color: '#e6dcc3' },
  fence: { label: 'Fence', color: '#7a6650' },
  hedge: { label: 'Hedge', color: '#6aa96a' },
};

export const polylineLength = (pts: Point[]): number => {
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return len;
};

/**
 * Points along a polyline about `spacing` apart (always including both ends and every corner),
 * used for fence posts.
 */
export function samplePolyline(pts: Point[], spacing: number): Point[] {
  if (!pts.length) return [];
  const out: Point[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(1, Math.round(len / spacing));
    for (let k = 1; k <= n; k++) out.push({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n });
  }
  return out;
}
