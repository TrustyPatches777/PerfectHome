import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Layer, Stage } from 'react-konva';
import type Konva from 'konva';
import { useUi } from '../store/ui';
import { refsInRect } from '../selection';
import { useDesign } from '../store/design';
import { floorId } from '../store/floor';
import { screenToWorld, startPan, zoomAt } from './camera';
import { setStage } from './stage';
import { input } from './input';
import { GridLayer } from './GridLayer';
import { RoomsLayer } from './layers/RoomsLayer';
import { StructureLayer } from './layers/StructureLayer';
import { FurnitureLayer } from './layers/FurnitureLayer';
import { NotesLayer } from './layers/NotesLayer';
import { RoofLayer } from './layers/RoofLayer';
import { OutdoorLayer } from './layers/OutdoorLayer';
import { Underlay } from './layers/Underlay';
import { TraceLayer } from './layers/TraceLayer';
import { CompareLayer } from './layers/CompareLayer';
import { FloorSwitcher } from '../components/FloorSwitcher';
import { OverlayLayer } from './layers/OverlayLayer';
import { ScaleBar } from '../components/ScaleBar';
import { TypedBox } from '../components/TypedBox';
import { Rulers } from '../components/Rulers';
import { AutoDimensions } from './layers/AutoDimensions';
import { StickyLayer } from './layers/StickyLayer';
import { LightingLayer } from './layers/LightingLayer';
import { ChecksLayer } from './layers/ChecksLayer';
import { NorthArrow } from '../components/NorthArrow';
import { RemoteCursors } from '../components/RemoteCursors';
import { ToolOptions } from '../components/ToolOptions';

/** The canvas: owns the Konva stage, the camera (pan/zoom) and pointer plumbing. */
export function CanvasView() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const viewport = useUi((s) => s.viewport);
  const { w, h } = useUi((s) => s.canvasSize);
  const tool = useUi((s) => s.tool);
  const showRulers = useUi((s) => s.showRulers);
  const panning = useUi((s) => s.panning);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);

  // Track the size of the canvas area.
  useLayoutEffect(() => {
    const el = wrapRef.current!;
    const apply = () => useUi.getState().setCanvasSize(el.clientWidth, el.clientHeight);
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    setStage(stageRef.current);
    return () => setStage(null);
  }, []);

  // Space bar = temporary hand tool.
  useEffect(() => {
    const typing = (t: EventTarget | null) =>
      t instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName);
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !typing(e.target)) {
        input.space = true;
        setSpaceHeld(true);
        e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        input.space = false;
        setSpaceHeld(false);
      }
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  const onWheel = useCallback((e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const p = stageRef.current!.getPointerPosition();
    if (!p) return;
    const unit = e.evt.deltaMode === 1 ? 33 : 1;
    const speed = e.evt.ctrlKey ? 0.01 : 0.0015; // ctrl+wheel = trackpad pinch
    const factor = Math.exp(-e.evt.deltaY * unit * speed);
    const ui = useUi.getState();
    ui.setViewport(zoomAt(ui.viewport, factor, p.x, p.y));
  }, []);

  /** Shift+drag on empty space: add everything the box touches to the selection. */
  const startMarquee = (startX: number, startY: number) => {
    const rect = wrapRef.current!.getBoundingClientRect();
    const local = (cx: number, cy: number) => ({ x: cx - rect.left, y: cy - rect.top });
    const a = local(startX, startY);
    setMarquee({ x0: a.x, y0: a.y, x1: a.x, y1: a.y });
    const move = (e: MouseEvent) => {
      const p = local(e.clientX, e.clientY);
      setMarquee({ x0: a.x, y0: a.y, x1: p.x, y1: p.y });
    };
    const up = (e: MouseEvent) => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      setMarquee(null);
      const p = local(e.clientX, e.clientY);
      if (Math.hypot(p.x - a.x, p.y - a.y) < 4) return;
      const v = useUi.getState().viewport;
      const w0 = screenToWorld(v, Math.min(a.x, p.x), Math.min(a.y, p.y));
      const w1 = screenToWorld(v, Math.max(a.x, p.x), Math.max(a.y, p.y));
      const hits = refsInRect(useDesign.getState().design, floorId(), { minX: w0.x, minY: w0.y, maxX: w1.x, maxY: w1.y });
      const ui = useUi.getState();
      const merged = [...ui.selected];
      for (const h of hits) if (!merged.some((r) => r.kind === h.kind && r.id === h.id)) merged.push(h);
      ui.setSelected(merged);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  const onMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const onBackground = e.target === e.target.getStage();
    const button = e.evt.button;
    if (button === 0 && tool === 'select' && onBackground && e.evt.shiftKey && !input.space) {
      e.evt.preventDefault();
      startMarquee(e.evt.clientX, e.evt.clientY);
      return;
    }
    const selectBg = button === 0 && tool === 'select' && onBackground;
    if (button === 1 || button === 2 || (button === 0 && input.space) || selectBg) {
      e.evt.preventDefault();
      startPan(e.evt.clientX, e.evt.clientY, selectBg ? () => useUi.getState().select(null) : undefined);
    }
  };

  const onMouseMove = () => {
    useUi.getState().setCursor(stageRef.current!.getRelativePointerPosition());
  };

  const cursor = panning ? 'grabbing' : spaceHeld ? 'grab' : tool === 'select' ? 'default' : 'crosshair';

  return (
    <div ref={wrapRef} className={`canvas-wrap ${showRulers ? 'rulers' : ''}`} style={{ cursor }} onContextMenu={(e) => e.preventDefault()}>
      <Stage
        ref={stageRef}
        width={w}
        height={h}
        x={viewport.x}
        y={viewport.y}
        scaleX={viewport.zoom}
        scaleY={viewport.zoom}
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseLeave={() => useUi.getState().setCursor(null)}
      >
        <GridLayer />
        <Layer>
          <TraceLayer />
          <Underlay />
          <OutdoorLayer />
          <RoomsLayer />
          <StructureLayer />
          <FurnitureLayer />
          <RoofLayer />
          <NotesLayer />
          <AutoDimensions />
          <StickyLayer />
          <ChecksLayer />
          <CompareLayer />
        </Layer>
        <LightingLayer />
        <OverlayLayer />
      </Stage>
      {marquee && (
        <div
          className="marquee"
          style={{ left: Math.min(marquee.x0, marquee.x1), top: Math.min(marquee.y0, marquee.y1), width: Math.abs(marquee.x1 - marquee.x0), height: Math.abs(marquee.y1 - marquee.y0) }}
        />
      )}
      {showRulers && <Rulers />}
      <RemoteCursors />
      <NorthArrow />
      <TypedBox />
      <FloorSwitcher />
      <ToolOptions />
      <ScaleBar />
    </div>
  );
}
