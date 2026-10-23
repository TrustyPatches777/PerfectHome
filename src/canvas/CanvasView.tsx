import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Layer, Stage } from 'react-konva';
import type Konva from 'konva';
import { useUi } from '../store/ui';
import { zoomAt } from './camera';
import { setStage } from './stage';
import { input } from './input';
import { GridLayer } from './GridLayer';
import { RoomsLayer } from './layers/RoomsLayer';
import { StructureLayer } from './layers/StructureLayer';
import { FurnitureLayer } from './layers/FurnitureLayer';
import { NotesLayer } from './layers/NotesLayer';
import { OverlayLayer } from './layers/OverlayLayer';
import { ScaleBar } from '../components/ScaleBar';
import { ToolOptions } from '../components/ToolOptions';

/** The canvas: owns the Konva stage, the camera (pan/zoom) and pointer plumbing. */
export function CanvasView() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const viewport = useUi((s) => s.viewport);
  const { w, h } = useUi((s) => s.canvasSize);
  const tool = useUi((s) => s.tool);
  const [panning, setPanning] = useState(false);
  const [spaceHeld, setSpaceHeld] = useState(false);

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

  const startPan = useCallback((startX: number, startY: number, clearOnClick: boolean) => {
    const origin = useUi.getState().viewport;
    let moved = false;
    setPanning(true);
    const move = (e: MouseEvent) => {
      if (Math.hypot(e.clientX - startX, e.clientY - startY) > 3) moved = true;
      useUi.getState().setViewport({ ...origin, x: origin.x + e.clientX - startX, y: origin.y + e.clientY - startY });
    };
    const up = () => {
      setPanning(false);
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      if (clearOnClick && !moved) useUi.getState().select(null); // a plain click on empty space deselects
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  }, []);

  const onMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const onBackground = e.target === e.target.getStage();
    const button = e.evt.button;
    const selectBg = button === 0 && tool === 'select' && onBackground;
    if (button === 1 || button === 2 || (button === 0 && input.space) || selectBg) {
      e.evt.preventDefault();
      startPan(e.evt.clientX, e.evt.clientY, selectBg);
    }
  };

  const onMouseMove = () => {
    useUi.getState().setCursor(stageRef.current!.getRelativePointerPosition());
  };

  const cursor = panning ? 'grabbing' : spaceHeld ? 'grab' : tool === 'select' ? 'default' : 'crosshair';

  return (
    <div ref={wrapRef} className="canvas-wrap" style={{ cursor }} onContextMenu={(e) => e.preventDefault()}>
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
          <RoomsLayer />
          <StructureLayer />
          <FurnitureLayer />
          <NotesLayer />
        </Layer>
        <OverlayLayer />
      </Stage>
      <ToolOptions />
      <ScaleBar />
    </div>
  );
}
