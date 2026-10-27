import { useRef, useState } from 'react';
import { Group, Line, Text } from 'react-konva';
import type Konva from 'konva';
import { layerBlocksEditing } from '../../actions';
import { formatLength } from '../../geometry';
import type { Point } from '../../model';
import { addRoof } from '../../roofActions';
import { useUi } from '../../store/ui';
import { isPrimary, snapWorld, useCaptureKeys, useStageEvents } from '../input';
import { SELECT_COLOR } from '../style';

const rectPoints = (a: Point, b: Point): Point[] => [{ x: a.x, y: a.y }, { x: b.x, y: a.y }, { x: b.x, y: b.y }, { x: a.x, y: b.y }];

/** Draw the footprint of a roof: drag a box, or click two opposite corners. (The "Fit to walls" button makes one in a click.) */
export function RoofTool() {
  const ref = useRef<Konva.Group>(null);
  const zoom = useUi((s) => s.viewport.zoom);
  const [start, setStart] = useState<Point | null>(null);
  const [hover, setHover] = useState<Point | null>(null);
  const downAt = useRef({ x: 0, y: 0 });
  const snap = (w: Point) => snapWorld(w, { faces: true }).p;

  const finish = (a: Point, b: Point) => {
    setStart(null);
    const w = Math.abs(a.x - b.x);
    const d = Math.abs(a.y - b.y);
    if (w < 0.5 || d < 0.5) return;
    const cx = (a.x + b.x) / 2;
    const cy = (a.y + b.y) / 2;
    // the ridge runs along the longer side
    addRoof(w >= d ? { x: cx, y: cy, w, d, rotation: 0 } : { x: cx, y: cy, w: d, d: w, rotation: 90 }, useUi.getState().roofKind);
  };

  useStageEvents(ref, {
    mousemove: (_e, world) => setHover(snap(world)),
    mousedown: (e, world) => {
      if (!isPrimary(e) || layerBlocksEditing('roof')) return;
      const p = snap(world);
      downAt.current = { x: e.evt.clientX, y: e.evt.clientY };
      if (!start) setStart(p);
      else finish(start, p);
    },
    mouseup: (e, world) => {
      if (!start || !isPrimary(e)) return;
      if (Math.hypot(e.evt.clientX - downAt.current.x, e.evt.clientY - downAt.current.y) > 6) finish(start, snap(world));
    },
  });

  useCaptureKeys((e) => {
    if (e.key === 'Escape' && start) {
      setStart(null);
      return true;
    }
    return false;
  });

  const px = 1 / zoom;
  return (
    <Group ref={ref} listening={false}>
      {start && hover && (
        <>
          <Line points={rectPoints(start, hover).flatMap((p) => [p.x, p.y])} closed stroke={SELECT_COLOR} strokeWidth={2} strokeScaleEnabled={false} fill="rgba(181,82,59,0.15)" dash={[6, 4]} />
          <Text x={hover.x + 10 * px} y={hover.y + 8 * px} text={`${formatLength(Math.abs(hover.x - start.x))} × ${formatLength(Math.abs(hover.y - start.y))}`} fontSize={13 * px} fontStyle="bold" fill={SELECT_COLOR} />
        </>
      )}
    </Group>
  );
}
