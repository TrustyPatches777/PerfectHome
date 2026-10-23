import { contentBounds } from '../bounds';
import type { Bounds } from '../geometry';
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

/**
 * Pan the plan with the mouse from a press at (startX, startY). When the mouse never really moves,
 * `onClick` runs instead (select the thing that was pressed, or deselect on empty space).
 */
export function startPan(startX: number, startY: number, onClick?: () => void) {
  const ui = useUi.getState();
  const origin = ui.viewport;
  let moved = false;
  ui.setPanning(true);
  const move = (e: MouseEvent) => {
    if (Math.hypot(e.clientX - startX, e.clientY - startY) > 3) moved = true;
    useUi.getState().setViewport({ ...origin, x: origin.x + e.clientX - startX, y: origin.y + e.clientY - startY });
  };
  const up = () => {
    useUi.getState().setPanning(false);
    window.removeEventListener('mousemove', move);
    window.removeEventListener('mouseup', up);
    if (!moved) onClick?.();
  };
  window.addEventListener('mousemove', move);
  window.addEventListener('mouseup', up);
}

export function zoomByCenter(factor: number) {
  const { viewport, canvasSize, setViewport } = useUi.getState();
  setViewport(zoomAt(viewport, factor, canvasSize.w / 2, canvasSize.h / 2));
}

export type { Bounds };
export { contentBounds };

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
  // never zoom in past twice the normal size: a design with one small thing in it should not be blown up
  const zoom = clampZoom(Math.min((canvasSize.w - pad * 2) / w, (canvasSize.h - pad * 2) / h, 120));
  setViewport({
    zoom,
    x: (canvasSize.w - w * zoom) / 2 - b.minX * zoom,
    y: (canvasSize.h - h * zoom) / 2 - b.minY * zoom,
  });
}
