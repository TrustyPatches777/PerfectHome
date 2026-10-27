import { useRef, useState } from 'react';
import { Circle, Group, Line, Text } from 'react-konva';
import type Konva from 'konva';
import { layerBlocksEditing } from '../../actions';
import { newId, type Point } from '../../model';
import { constrainAngle, formatLength } from '../../geometry';
import { STRIP_STYLES, polylineLength } from '../../outdoor';
import { useDesign } from '../../store/design';
import { floorId } from '../../store/floor';
import { useUi } from '../../store/ui';
import { parseTypedLength, pointAtDistance } from '../../typed';
import { isDoubleClick, isPrimary, snapWorld, useCaptureKeys, useStageEvents, useTypedInput } from '../input';
import { SELECT_COLOR } from '../style';

/** Draw a street, footpath, fence or hedge: click the points, then double-click or press Enter to finish. */
export function StripTool() {
  const ref = useRef<Konva.Group>(null);
  const zoom = useUi((s) => s.viewport.zoom);
  const kind = useUi((s) => s.stripKind);
  const width = useUi((s) => s.stripWidth[kind]);
  const [points, setPoints] = useState<Point[]>([]);
  const [hover, setHover] = useState<Point | null>(null);

  const resolve = (world: Point, shift: boolean) => {
    const last = points[points.length - 1];
    return snapWorld(last && shift ? constrainAngle(last, world, 45) : world, { faces: true }).p;
  };

  const finish = () => {
    if (points.length >= 2) {
      const id = newId();
      useDesign.getState().update((d) => {
        const surface = useUi.getState().pathSurface;
        d.strips.push({ id, floor: floorId(), kind, points, width, ...(kind === 'path' && surface !== 'plain' ? { surface } : {}) });
      });
      useUi.getState().setTool('select');
      useUi.getState().select({ kind: 'strip', id });
    }
    setPoints([]);
  };

  useTypedInput(points.length > 0, (text) => {
    const v = parseTypedLength(text);
    if (!v) return false;
    const last = points[points.length - 1];
    setPoints([...points, pointAtDistance(last, hover, v.length, v.angle)]);
  });

  useStageEvents(ref, {
    mousemove: (e, world) => setHover(resolve(world, e.evt.shiftKey)),
    mousedown: (e, world) => {
      if (!isPrimary(e) || layerBlocksEditing('strip')) return;
      if (isDoubleClick(e.evt)) return finish();
      const p = resolve(world, e.evt.shiftKey);
      const last = points[points.length - 1];
      if (last && Math.hypot(p.x - last.x, p.y - last.y) < 0.02) return;
      setPoints([...points, p]);
    },
  });

  useCaptureKeys((e) => {
    if (!points.length) return false;
    if (e.key === 'Enter') {
      finish();
      return true;
    }
    if (e.key === 'Escape') {
      setPoints([]);
      return true;
    }
    return false;
  });

  const px = 1 / zoom;
  const path = hover && points.length ? [...points, hover] : points;
  return (
    <Group ref={ref} listening={false}>
      {path.length > 1 && <Line points={path.flatMap((p) => [p.x, p.y])} stroke={STRIP_STYLES[kind].color} strokeWidth={width} opacity={0.7} lineJoin="round" />}
      {path.length > 1 && <Line points={path.flatMap((p) => [p.x, p.y])} stroke={SELECT_COLOR} strokeWidth={1.5} strokeScaleEnabled={false} dash={[6, 4]} />}
      {points.length > 0 && hover && (
        <Text x={hover.x + 10 * px} y={hover.y + 8 * px} text={formatLength(polylineLength(path))} fontSize={13 * px} fontStyle="bold" fill={SELECT_COLOR} />
      )}
      {points.map((p, i) => (
        <Circle key={i} x={p.x} y={p.y} radius={4 * px} fill={SELECT_COLOR} />
      ))}
      {hover && <Circle x={hover.x} y={hover.y} radius={4 * px} fill={SELECT_COLOR} opacity={0.7} />}
    </Group>
  );
}
