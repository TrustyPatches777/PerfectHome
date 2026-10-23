import type { Design, Point } from '../model';
import { floorId } from '../store/floor';
import { clampZoom, useUi, type Viewport } from '../store/ui';

export const screenToWorld = (v: Viewport, sx: number, sy: number): Point => ({
  x: (sx - v.x) / v.zoom,
  y: (sy - v.y) / v.zoom,
});

/** Zoom by `factor`, keeping the world point under screen position (cx, cy) fixed. */
export function zoomAt(v: Viewport, factor: number, cx: number, cy: number): Viewport {
  const zoom = clampZoom(v.zoom * factor);
  const wx = (cx - v.x) / v.zoom;
  const wy = (cy - v.y) / v.zoom;
  return { zoom, x: cx - wx * zoom, y: cy - wy * zoom };
}

export function zoomByCenter(factor: number) {
  const { viewport, canvasSize, setViewport } = useUi.getState();
  setViewport(zoomAt(viewport, factor, canvasSize.w / 2, canvasSize.h / 2));
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Bounding box of everything in the design, or null when it is empty. */
export function contentBounds(d: Design, floor?: string): Bounds | null {
  const on = <T extends { floor: string }>(items: T[]) => (floor ? items.filter((i) => i.floor === floor) : items);
  const pts: Point[] = [];
  for (const w of on(d.walls)) pts.push(w.a, w.b);
  for (const r of on(d.rooms)) pts.push(...r.points);
  for (const z of on(d.zones)) pts.push(...z.points);
  for (const s of on(d.strips)) pts.push(...s.points);
  for (const dim of on(d.dimensions)) pts.push(dim.a, dim.b);
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

/** Frame the whole design (or reset to the default view when it is empty). */
export function fitView(d: Design) {
  const { canvasSize, setViewport } = useUi.getState();
  const b = contentBounds(d, floorId()) ?? contentBounds(d);
  if (!b) {
    setViewport({ x: 160, y: 120, zoom: 60 });
    return;
  }
  const pad = 60;
  const w = Math.max(b.maxX - b.minX, 1);
  const h = Math.max(b.maxY - b.minY, 1);
  const zoom = clampZoom(Math.min((canvasSize.w - pad * 2) / w, (canvasSize.h - pad * 2) / h));
  setViewport({
    zoom,
    x: (canvasSize.w - w * zoom) / 2 - b.minX * zoom,
    y: (canvasSize.h - h * zoom) / 2 - b.minY * zoom,
  });
}
