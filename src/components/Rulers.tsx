import { useEffect, useRef } from 'react';
import { startGuideFromRuler } from '../canvas/editing';
import { RULER_SIZE } from '../canvas/input';
import { useUi } from '../store/ui';
import { t } from '../i18n';

const RULER = RULER_SIZE;
const STEPS = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100];

/** Rulers along the top and left edges, in meters. Drag out of a ruler to pull a guide line onto the plan. */
export function Rulers() {
  const v = useUi((s) => s.viewport);
  const { w, h } = useUi((s) => s.canvasSize);
  const cursor = useUi((s) => s.cursor);
  const top = useRef<HTMLCanvasElement>(null);
  const left = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const dpr = window.devicePixelRatio || 1;
    const draw = (canvas: HTMLCanvasElement | null, horizontal: boolean) => {
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;
      const len = horizontal ? w - RULER : h - RULER;
      canvas.width = (horizontal ? len : RULER) * dpr;
      canvas.height = (horizontal ? RULER : len) * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, horizontal ? len : RULER, horizontal ? RULER : len);
      const origin = (horizontal ? v.x : v.y) - RULER; // screen position of world 0 inside this canvas
      const minor = STEPS.find((s) => s * v.zoom >= 8) ?? 100;
      const labelStep = STEPS.find((s) => s * v.zoom >= 70) ?? 100;
      const first = Math.floor(-origin / v.zoom / minor) - 1;
      const last = Math.ceil((len - origin) / v.zoom / minor) + 1;
      ctx.strokeStyle = '#94a3b8';
      ctx.fillStyle = '#475569';
      ctx.font = '10px system-ui, sans-serif';
      ctx.lineWidth = 1;
      for (let i = first; i <= last; i++) {
        const value = i * minor;
        const pos = Math.round(origin + value * v.zoom) + 0.5;
        const isLabel = Math.abs(value / labelStep - Math.round(value / labelStep)) < 1e-6;
        const tick = isLabel ? 12 : Math.abs(value - Math.round(value)) < 1e-6 ? 8 : 4;
        ctx.beginPath();
        if (horizontal) {
          ctx.moveTo(pos, RULER);
          ctx.lineTo(pos, RULER - tick);
        } else {
          ctx.moveTo(RULER, pos);
          ctx.lineTo(RULER - tick, pos);
        }
        ctx.stroke();
        if (isLabel) {
          const text = `${Math.round(value * 100) / 100}`;
          if (horizontal) ctx.fillText(text, pos + 3, 10);
          else {
            ctx.save();
            ctx.translate(10, pos - 3);
            ctx.rotate(-Math.PI / 2);
            ctx.fillText(text, 0, 0);
            ctx.restore();
          }
        }
      }
      if (cursor) {
        ctx.strokeStyle = '#ef4444';
        ctx.beginPath();
        const c = Math.round(origin + (horizontal ? cursor.x : cursor.y) * v.zoom) + 0.5;
        if (horizontal) {
          ctx.moveTo(c, 0);
          ctx.lineTo(c, RULER);
        } else {
          ctx.moveTo(0, c);
          ctx.lineTo(RULER, c);
        }
        ctx.stroke();
      }
    };
    draw(top.current, true);
    draw(left.current, false);
  }, [v, w, h, cursor]);

  return (
    <>
      <div className="ruler-corner" />
      <canvas
        ref={top}
        className="ruler ruler-top"
        style={{ width: Math.max(0, w - RULER), height: RULER }}
        onMouseDown={(e) => e.button === 0 && startGuideFromRuler(e.nativeEvent, 'y')}
        title={t('Drag down to pull out a guide line')}
        data-testid="ruler-top"
      />
      <canvas
        ref={left}
        className="ruler ruler-left"
        style={{ width: RULER, height: Math.max(0, h - RULER) }}
        onMouseDown={(e) => e.button === 0 && startGuideFromRuler(e.nativeEvent, 'x')}
        title={t('Drag right to pull out a guide line')}
        data-testid="ruler-left"
      />
    </>
  );
}
