import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Stage } from 'react-konva';
import type Konva from 'konva';
import { useUi } from '../store/ui';
import { zoomAt } from './camera';
import { setStage } from './stage';
import { GridLayer } from './GridLayer';
import { ScaleBar } from '../components/ScaleBar';

/** The canvas: owns the Konva stage, the camera (pan/zoom) and pointer plumbing. */
export function CanvasView() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const viewport = useUi((s) => s.viewport);
  const { w, h } = useUi((s) => s.canvasSize);
  const tool = useUi((s) => s.tool);
  const [panning, setPanning] = useState(false);
  const spaceDown = useRef(false);

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
    const isTyping = (t: EventTarget | null) =>
      t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT');
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isTyping(e.target)) {
        spaceDown.current = true;
        e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') spaceDown.current = false;
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

  const startPan = useCallback((startX: number, startY: number) => {
    const origin = useUi.getState().viewport;
    setPanning(true);
    const move = (e: MouseEvent) => {
      useUi.getState().setViewport({ ...origin, x: origin.x + e.clientX - startX, y: origin.y + e.clientY - startY });
    };
    const up = () => {
      setPanning(false);
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  }, []);

  const onMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const onBackground = e.target === e.target.getStage();
    const wantsPan =
      e.evt.button === 1 ||
      e.evt.button === 2 ||
      (e.evt.button === 0 && (spaceDown.current || (tool === 'select' && onBackground)));
    if (wantsPan) {
      e.evt.preventDefault();
      startPan(e.evt.clientX, e.evt.clientY);
    }
  };

  const onMouseMove = () => {
    const p = stageRef.current!.getRelativePointerPosition();
    useUi.getState().setCursor(p);
  };

  const cursor = panning ? 'grabbing' : spaceDown.current ? 'grab' : tool === 'select' ? 'default' : 'crosshair';

  return (
    <div
      ref={wrapRef}
      className="canvas-wrap"
      style={{ cursor }}
      onContextMenu={(e) => e.preventDefault()}
    >
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
      </Stage>
      <ScaleBar />
    </div>
  );
}
