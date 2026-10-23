import { useRef, useState } from 'react';
import { Circle, Group, Line, Text } from 'react-konva';
import type Konva from 'konva';
import { layerBlocksEditing } from '../../actions';
import { newId, type Point } from '../../model';
import { constrainAngle, dist, formatLength, samePoint, snapValue } from '../../geometry';
import { useDesign } from '../../store/design';
import { floorId } from '../../store/floor';
import { useUi } from '../../store/ui';
import { isDoubleClick, isPrimary, snapWorld, useCaptureKeys, useStageEvents } from '../input';
import { SELECT_COLOR } from '../style';

/** Click to start a wall, click again to place each corner. Double-click, Enter or Esc to finish. */
export function WallTool() {
  const ref = useRef<Konva.Group>(null);
  const zoom = useUi((s) => s.viewport.zoom);
  const thickness = useDesign((s) => s.design.settings.wallThickness);
  const [start, setStart] = useState<Point | null>(null);
  const [hover, setHover] = useState<{ p: Point; vertex: boolean } | null>(null);
  const first = useRef<Point | null>(null);

  const resolve = (world: Point, shift: boolean) => {
    if (start && shift) {
      const locked = constrainAngle(start, world, 45);
      const { gridStep } = useDesign.getState().design.settings;
      if (!useUi.getState().snap) return { p: locked, vertex: false };
      const len = dist(start, locked);
      const k = snapValue(len, gridStep) / (len || 1);
      return { p: { x: start.x + (locked.x - start.x) * k, y: start.y + (locked.y - start.y) * k }, vertex: false };
    }
    const r = snapWorld(world);
    return { p: r.p, vertex: r.kind === 'vertex' };
  };

  const finish = () => {
    setStart(null);
    first.current = null;
  };

  useStageEvents(ref, {
    mousemove: (e, world) => setHover(resolve(world, e.evt.shiftKey)),
    mousedown: (e, world) => {
      if (!isPrimary(e)) return;
      if (isDoubleClick(e.evt)) {
        finish();
        return;
      }
      if (!start && layerBlocksEditing('wall')) return;
      const { p } = resolve(world, e.evt.shiftKey);
      if (!start) {
        setStart(p);
        first.current = p;
        return;
      }
      if (dist(start, p) < 0.02) return; // second click of a double-click
      const floor = floorId();
      useDesign.getState().update((d) => {
        d.walls.push({ id: newId(), floor, a: { ...start }, b: { ...p }, thickness });
      });
      if (first.current && samePoint(p, first.current, 0.01)) finish(); // closed a loop
      else setStart(p);
    },
  });

  useCaptureKeys((e) => {
    if (!start) return false;
    if (e.key === 'Escape' || e.key === 'Enter') {
      finish();
      return true;
    }
    return false;
  });

  const px = 1 / zoom;
  return (
    <Group ref={ref} listening={false}>
      {start && hover && dist(start, hover.p) > 0.001 && (
        <>
          <Line points={[start.x, start.y, hover.p.x, hover.p.y]} stroke={SELECT_COLOR} opacity={0.55} strokeWidth={thickness} lineCap="square" />
          <Text
            x={(start.x + hover.p.x) / 2 + 8 * px}
            y={(start.y + hover.p.y) / 2 - 22 * px}
            text={formatLength(dist(start, hover.p))}
            fontSize={13 * px}
            fontStyle="bold"
            fill={SELECT_COLOR}
          />
        </>
      )}
      {hover && (
        <Circle x={hover.p.x} y={hover.p.y} radius={(hover.vertex ? 6 : 4) * px} fill={hover.vertex ? '#22a06b' : SELECT_COLOR} opacity={0.85} />
      )}
      {start && <Circle x={start.x} y={start.y} radius={4 * px} fill={SELECT_COLOR} />}
    </Group>
  );
}
