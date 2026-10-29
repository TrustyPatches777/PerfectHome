import { useEffect, useRef, type RefObject } from 'react';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { Point } from '../model';
import { snapPoint, wallLength, wallPointAt } from '../geometry';
import { useDesign } from '../store/design';
import { floorBelow, floorId } from '../store/floor';
import { useUi } from '../store/ui';
import { getStage } from './stage';
import { t } from '../i18n';

/** Shared, non-reactive input state. */
export const input = { space: false };

/** Thickness in pixels of the rulers along the canvas edges. */
export const RULER_SIZE = 22;

/** Pixels of pointer movement before a press turns into a drag. */
const DRAG_THRESHOLD = 3;
/** Distance in screen pixels within which points snap to existing corners. */
const VERTEX_SNAP_PX = 9;

export interface SnapResult {
  p: Point;
  /** What it snapped to, for drawing an indicator. */
  kind: 'vertex' | 'guide' | 'grid' | 'none';
}

/** Corners other things can snap to: wall ends and room corners (and, for measuring, the wall faces). */
export function snapTargets(faces = false): Point[] {
  const d = useDesign.getState().design;
  const floor = floorId();
  const below = floorBelow(d, floor);
  const pts: Point[] = [];
  for (const w of d.walls) {
    if (w.floor !== floor && w.floor !== below) continue; // the floor below is snappable so walls line up
    pts.push(w.a, w.b);
    if (faces) {
      const h = w.thickness / 2;
      const ends = [wallPointAt(w, 0), wallPointAt(w, wallLength(w))];
      for (const e of ends) for (const s of [-1, 1]) pts.push({ x: e.p.x + e.n.x * h * s, y: e.p.y + e.n.y * h * s });
    }
  }
  for (const r of d.rooms) if (r.floor === floor) pts.push(...r.points);
  return pts;
}

/**
 * Snap a world point to nearby corners first, then to the grid. Does nothing when snapping is off.
 * `ignore` lets a drag skip the very points it is moving.
 */
export function snapWorld(p: Point, opts: { ignore?: (q: Point) => boolean; grid?: boolean; faces?: boolean } = {}): SnapResult {
  const ui = useUi.getState();
  if (!ui.snap) return { p, kind: 'none' };
  const tol = VERTEX_SNAP_PX / ui.viewport.zoom;
  let best: Point | null = null;
  let bestD = tol;
  for (const q of snapTargets(opts.faces)) {
    if (opts.ignore?.(q)) continue;
    const dd = Math.hypot(q.x - p.x, q.y - p.y);
    if (dd < bestD) {
      best = q;
      bestD = dd;
    }
  }
  if (best) return { p: { ...best }, kind: 'vertex' };
  // guide lines: each axis snaps to the nearest guide, the rest to the grid
  let gx: number | null = null;
  let gy: number | null = null;
  if (ui.showGuides) {
    let bx = tol;
    let by = tol;
    for (const g of useDesign.getState().design.guides) {
      const dd = Math.abs((g.axis === 'x' ? p.x : p.y) - g.pos);
      if (g.axis === 'x' && dd < bx) [gx, bx] = [g.pos, dd];
      if (g.axis === 'y' && dd < by) [gy, by] = [g.pos, dd];
    }
  }
  const grid = opts.grid === false ? p : snapPoint(p, useDesign.getState().design.settings.gridStep);
  if (gx !== null || gy !== null) return { p: { x: gx ?? grid.x, y: gy ?? grid.y }, kind: 'guide' };
  if (opts.grid === false) return { p, kind: 'none' };
  return { p: grid, kind: 'grid' };
}

/** Snap a single length/offset to the grid step (used for sliding things along walls). */
export function snapScalar(v: number): number {
  if (!useUi.getState().snap) return v;
  const step = useDesign.getState().design.settings.gridStep;
  return Math.round(v / step) * step;
}

export function clientToWorld(clientX: number, clientY: number): Point {
  const rect = getStage()!.container().getBoundingClientRect();
  const v = useUi.getState().viewport;
  return { x: (clientX - rect.left - v.x) / v.zoom, y: (clientY - rect.top - v.y) / v.zoom };
}

/**
 * Run a mouse drag that started at `startEvt`. The whole drag is one undo step, and nothing happens
 * until the pointer has moved a few pixels (so a plain click never edits anything).
 */
export function dragSession(
  startEvt: MouseEvent,
  onMove: (world: Point, start: Point, e: MouseEvent) => void,
  onEnd?: (moved: boolean) => void,
  /** Runs inside the gesture (so it is part of the same undo step) when the drag ends after moving. */
  beforeEnd?: () => void,
) {
  const start = clientToWorld(startEvt.clientX, startEvt.clientY);
  let started = false;
  const move = (e: MouseEvent) => {
    if (!started) {
      if (Math.hypot(e.clientX - startEvt.clientX, e.clientY - startEvt.clientY) < DRAG_THRESHOLD) return;
      started = true;
      useDesign.getState().beginTx();
    }
    onMove(clientToWorld(e.clientX, e.clientY), start, e);
  };
  const up = () => {
    window.removeEventListener('mousemove', move);
    window.removeEventListener('mouseup', up);
    if (started) {
      beforeEnd?.();
      useDesign.getState().endTx();
    }
    onEnd?.(started);
  };
  window.addEventListener('mousemove', move);
  window.addEventListener('mouseup', up);
}

type StageHandler = (e: KonvaEventObject<MouseEvent>, world: Point) => void;
type StageHandlers = Partial<Record<'mousedown' | 'mousemove' | 'mouseup', StageHandler>>;

/**
 * Subscribe a tool to the stage's pointer events while it is mounted. `node` is any Konva node inside the
 * stage (used to find the stage); handlers always see the latest props/state.
 */
export function useStageEvents(node: RefObject<Konva.Node | null>, handlers: StageHandlers) {
  const latest = useRef(handlers);
  latest.current = handlers;
  useEffect(() => {
    const stage = node.current?.getStage();
    if (!stage) return;
    const ns = `.tool${Math.random().toString(36).slice(2)}`;
    for (const name of ['mousedown', 'mousemove', 'mouseup'] as const) {
      stage.on(`${name}${ns}`, (e: KonvaEventObject<MouseEvent>) => {
        const world = stage.getRelativePointerPosition();
        if (world) latest.current[name]?.(e, world);
      });
    }
    return () => void stage.off(ns);
  }, [node]);
}

/**
 * Keyboard handling that runs BEFORE the global shortcuts (capture phase). Return true to consume the key.
 */
export function useCaptureKeys(handler: (e: KeyboardEvent) => boolean) {
  const latest = useRef(handler);
  latest.current = handler;
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      lastPress = { t: 0, x: 0, y: 0 }; // a key press between two clicks means they are not a double-click
      if (latest.current(e)) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };
    window.addEventListener('keydown', fn, true);
    return () => window.removeEventListener('keydown', fn, true);
  }, []);
}

/**
 * Exact-length typing for drawing tools: while `active` (a start point exists), typing a number starts an input
 * that is shown next to the cursor; Enter hands the text to `onSubmit` (return false to keep typing, e.g. when it
 * could not be understood), Esc cancels the typing, Backspace edits. Register this BEFORE the tool's own key handler.
 */
export function useTypedInput(active: boolean, onSubmit: (text: string) => boolean | void) {
  const latest = useRef(onSubmit);
  latest.current = onSubmit;
  useEffect(() => () => useUi.getState().setTyped(null), []);
  useCaptureKeys((e) => {
    const ui = useUi.getState();
    const text = ui.typed;
    if (!active) {
      if (text !== null) ui.setTyped(null);
      return false;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return false;
    if (text === null) {
      if (/^[0-9.,]$/.test(e.key)) {
        ui.setTyped(e.key);
        return true;
      }
      return false;
    }
    if (e.key === 'Enter') {
      if (latest.current(text) === false) ui.showToast(t('Could not read “{text}”. Try 3.5, 350, 2.4m or 3.5<45.', { text }));
      else ui.setTyped(null);
      return true;
    }
    if (e.key === 'Escape') {
      ui.setTyped(null);
      return true;
    }
    if (e.key === 'Backspace') {
      ui.setTyped(text.length > 1 ? text.slice(0, -1) : null);
      return true;
    }
    if (e.key.length === 1) {
      if (/[0-9.,<xXmMcC-]/.test(e.key)) ui.setTyped(text + e.key);
      return true; // other printable keys are swallowed so they cannot trigger tool shortcuts mid-number
    }
    return false;
  });
}

/** True when a left-button press should be treated as a tool click (not a pan). */
export const isPrimary = (e: KonvaEventObject<MouseEvent>) => e.evt.button === 0 && !input.space;

let lastPress = { t: 0, x: 0, y: 0 };

/**
 * Call once per mouse press. True when this press is the second of a double-click: close in time AND
 * position (Konva's own dblclick ignores position, so two quick clicks on different corners would count).
 */
export function isDoubleClick(e: MouseEvent): boolean {
  const dbl = e.timeStamp - lastPress.t < 400 && Math.hypot(e.clientX - lastPress.x, e.clientY - lastPress.y) < 6;
  lastPress = dbl ? { t: 0, x: 0, y: 0 } : { t: e.timeStamp, x: e.clientX, y: e.clientY };
  return dbl;
}
