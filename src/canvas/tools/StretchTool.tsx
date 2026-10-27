import { useEffect, useRef, useState } from 'react';
import { Group, Rect } from 'react-konva';
import type Konva from 'konva';
import type { Bounds } from '../../geometry';
import { stretchFromBase } from '../../resize';
import { useDesign } from '../../store/design';
import { floorId } from '../../store/floor';
import { useUi } from '../../store/ui';
import { dragSession, isPrimary, snapScalar, snapWorld, useStageEvents } from '../input';

const inside = (b: Bounds, p: { x: number; y: number }) => p.x >= b.minX && p.x <= b.maxX && p.y >= b.minY && p.y <= b.maxY;

/**
 * Stretch part of the plan: drag a box round what should move (a side of the house, a few walls), then drag inside the box. Corners
 * and points in the box move with the mouse; walls with only one end in the box get longer or shorter, and the rest stays put.
 */
export function StretchTool() {
  const ref = useRef<Konva.Group>(null);
  const box = useUi((s) => s.stretchBox);
  const [drawing, setDrawing] = useState<Bounds | null>(null);
  useEffect(() => () => useUi.getState().setStretchBox(null), []);

  useStageEvents(ref, {
    mousedown: (e, world) => {
      if (!isPrimary(e)) return;
      const current = useUi.getState().stretchBox;
      if (current && inside(current, world)) {
        // pull what is in the box, from the untouched plan every time so that the drag does not drift
        const base = useDesign.getState().design;
        const floor = floorId();
        let moved = { dx: 0, dy: 0 };
        dragSession(
          e.evt,
          (w, start) => {
            moved = { dx: snapScalar(w.x - start.x), dy: snapScalar(w.y - start.y) };
            useDesign.getState().update((d) => stretchFromBase(d, base, floor, current, moved.dx, moved.dy));
          },
          (did) => {
            if (did) useUi.getState().setStretchBox({ minX: current.minX + moved.dx, minY: current.minY + moved.dy, maxX: current.maxX + moved.dx, maxY: current.maxY + moved.dy });
          },
        );
        return;
      }
      // a new box
      const a = snapWorld(world, { ignore: () => true }).p;
      let last: Bounds | null = null;
      useUi.getState().setStretchBox(null);
      dragSession(
        e.evt,
        (w) => {
          const b = snapWorld(w, { ignore: () => true }).p;
          last = { minX: Math.min(a.x, b.x), minY: Math.min(a.y, b.y), maxX: Math.max(a.x, b.x), maxY: Math.max(a.y, b.y) };
          setDrawing(last);
        },
        () => {
          setDrawing(null);
          if (last && last.maxX - last.minX > 0.05 && last.maxY - last.minY > 0.05) useUi.getState().setStretchBox(last);
        },
      );
    },
  });

  const shown = drawing ?? box;
  return (
    <Group ref={ref} listening={false}>
      {shown && (
        <Rect
          x={shown.minX}
          y={shown.minY}
          width={shown.maxX - shown.minX}
          height={shown.maxY - shown.minY}
          fill={drawing ? 'rgba(37,99,235,0.08)' : 'rgba(37,99,235,0.14)'}
          stroke="#2563eb"
          strokeWidth={2}
          strokeScaleEnabled={false}
          dash={[8, 5]}
        />
      )}
    </Group>
  );
}
