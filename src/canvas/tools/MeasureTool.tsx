import { useRef, useState } from 'react';
import { Circle, Group } from 'react-konva';
import type Konva from 'konva';
import { layerBlocksEditing } from '../../actions';
import { newId, type Point } from '../../model';
import { dist } from '../../geometry';
import { useDesign } from '../../store/design';
import { floorId } from '../../store/floor';
import { useUi } from '../../store/ui';
import { parseTypedLength, pointAtDistance } from '../../typed';
import { isPrimary, snapWorld, useCaptureKeys, useStageEvents, useTypedInput } from '../input';
import { DimensionShape } from '../layers/NotesLayer';
import { SELECT_COLOR } from '../style';

/** Click two points to leave a dimension line. Snaps to wall centerline ends, wall faces and room corners. Esc cancels. */
export function MeasureTool() {
  const ref = useRef<Konva.Group>(null);
  const zoom = useUi((s) => s.viewport.zoom);
  const [start, setStart] = useState<Point | null>(null);
  const [hover, setHover] = useState<{ p: Point; vertex: boolean } | null>(null);

  const resolve = (world: Point) => {
    const r = snapWorld(world, { faces: true });
    return { p: r.p, vertex: r.kind === 'vertex' };
  };

  useTypedInput(!!start, (text) => {
    const v = parseTypedLength(text);
    if (!v || !start) return false;
    const end = pointAtDistance(start, hover?.p ?? null, v.length, v.angle);
    useDesign.getState().update((d) => {
      d.dimensions.push({ id: newId(), floor: floorId(), a: { ...start }, b: end });
    });
    setStart(null);
  });

  useStageEvents(ref, {
    mousemove: (_e, world) => setHover(resolve(world)),
    mousedown: (e, world) => {
      if (!isPrimary(e)) return;
      const { p } = resolve(world);
      if (!start) {
        if (!layerBlocksEditing('dimension')) setStart(p);
        return;
      }
      if (dist(start, p) < 0.02) return;
      useDesign.getState().update((d) => {
        d.dimensions.push({ id: newId(), floor: floorId(), a: { ...start }, b: { ...p } });
      });
      setStart(null);
    },
  });

  useCaptureKeys((e) => {
    if (start && e.key === 'Escape') {
      setStart(null);
      return true;
    }
    return false;
  });

  const px = 1 / zoom;
  return (
    <Group ref={ref} listening={false}>
      {start && hover && <DimensionShape a={start} b={hover.p} zoom={zoom} selected />}
      {start && <Circle x={start.x} y={start.y} radius={4 * px} fill={SELECT_COLOR} />}
      {hover && <Circle x={hover.p.x} y={hover.p.y} radius={(hover.vertex ? 6 : 4) * px} fill={hover.vertex ? '#22a06b' : SELECT_COLOR} opacity={0.85} />}
    </Group>
  );
}
