import { Layer, Rect, Shape } from 'react-konva';
import type { Context } from 'konva/lib/Context';
import { useUi } from '../store/ui';
import { useDesign } from '../store/design';

/** The finest grid spacing (meters) that is still at least `minPx` apart on screen. */
function minorStep(base: number, zoom: number, minPx: number): number {
  const ladder = [base];
  for (let p = -2; p <= 3; p++) for (const m of [1, 2, 5]) if (m * 10 ** p > base) ladder.push(m * 10 ** p);
  return ladder.find((s) => s * zoom >= minPx) ?? ladder[ladder.length - 1];
}

/** Draws the snapping grid for the visible area. Lines stay 1 screen pixel wide at any zoom. */
export function GridLayer() {
  const { x, y, zoom } = useUi((s) => s.viewport);
  const { w, h } = useUi((s) => s.canvasSize);
  const gridStep = useDesign((s) => s.design.settings.gridStep);

  const minor = minorStep(gridStep, zoom, 9);
  const mid = minor < 1 ? 1 : minor; // emphasised every whole meter
  const major = mid * 5;

  const x0 = -x / zoom;
  const y0 = -y / zoom;
  const x1 = (w - x) / zoom;
  const y1 = (h - y) / zoom;

  const sceneFunc = (ctx: Context) => {
    const draw = (step: number, skipStep: number | null, color: string) => {
      ctx.beginPath();
      const skip = (i: number) => skipStep !== null && Math.abs((i * step) / skipStep - Math.round((i * step) / skipStep)) < 1e-6;
      for (let i = Math.floor(x0 / step); i * step <= x1; i++) {
        if (skip(i)) continue;
        ctx.moveTo(i * step, y0);
        ctx.lineTo(i * step, y1);
      }
      for (let i = Math.floor(y0 / step); i * step <= y1; i++) {
        if (skip(i)) continue;
        ctx.moveTo(x0, i * step);
        ctx.lineTo(x1, i * step);
      }
      ctx.setAttr('strokeStyle', color);
      ctx.setAttr('lineWidth', 1 / zoom);
      ctx.stroke();
    };
    if (minor < mid) draw(minor, mid, '#eef1f6');
    draw(mid, major, '#dde2ea');
    draw(major, null, '#bcc5d3');
  };

  return (
    <Layer listening={false}>
      <Rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} fill="#ffffff" />
      <Shape sceneFunc={sceneFunc} />
      <Shape
        sceneFunc={(ctx) => {
          ctx.beginPath();
          ctx.moveTo(-0.15, 0);
          ctx.lineTo(0.15, 0);
          ctx.moveTo(0, -0.15);
          ctx.lineTo(0, 0.15);
          ctx.setAttr('strokeStyle', '#94a3b8');
          ctx.setAttr('lineWidth', 1.5 / zoom);
          ctx.stroke();
        }}
      />
    </Layer>
  );
}
