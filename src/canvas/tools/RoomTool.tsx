import { useRef, useState } from 'react';
import { Circle, Group, Line } from 'react-konva';
import type Konva from 'konva';
import { layerBlocksEditing } from '../../actions';
import { newId, type Point } from '../../model';
import { detectRoom, dist } from '../../geometry';
import { useDesign } from '../../store/design';
import { useUi } from '../../store/ui';
import { isDoubleClick, isPrimary, snapWorld, useCaptureKeys, useStageEvents } from '../input';
import { FLOOR_COLORS, SELECT_COLOR } from '../style';

/** Add a room to the design with the next default name ("Room 3") and floor color. */
export function addRoom(points: Point[], seed?: Point) {
  const id = newId();
  useDesign.getState().update((d) => {
    const used = d.rooms.map((r) => /^Room (\d+)$/.exec(r.name)).map((m) => (m ? Number(m[1]) : 0));
    const n = Math.max(0, ...used) + 1;
    d.rooms.push({ id, name: `Room ${n}`, color: FLOOR_COLORS[d.rooms.length % FLOOR_COLORS.length], points, seed });
  });
  useUi.getState().select({ kind: 'room', id });
}

/**
 * Auto mode: click inside a closed set of walls to create the room (area measured to the inner wall faces).
 * Draw mode: click the corners yourself; click the first corner, double-click or press Enter to finish.
 */
export function RoomTool() {
  const ref = useRef<Konva.Group>(null);
  const zoom = useUi((s) => s.viewport.zoom);
  const mode = useUi((s) => s.roomMode);
  const [points, setPoints] = useState<Point[]>([]);
  const [hover, setHover] = useState<Point | null>(null);

  const finish = () => {
    if (points.length >= 3) addRoom(points);
    setPoints([]);
  };

  useStageEvents(ref, {
    mousemove: (_e, world) => setHover(mode === 'draw' ? snapWorld(world).p : world),
    mousedown: (e, world) => {
      if (!isPrimary(e)) return;
      if (layerBlocksEditing('room')) return;
      const dbl = isDoubleClick(e.evt);
      if (mode === 'draw' && dbl) {
        finish();
        return;
      }
      if (mode === 'auto') {
        const walls = useDesign.getState().design.walls;
        const poly = detectRoom(world, walls);
        if (!poly) {
          useUi
            .getState()
            .showToast(walls.length ? 'No closed room here. Close the walls, or switch to "Draw" to click the corners.' : 'Draw some walls first.');
          return;
        }
        addRoom(poly, world);
        return;
      }
      const p = snapWorld(world).p;
      if (points.length >= 3 && dist(p, points[0]) < 10 / zoom) {
        finish();
        return;
      }
      if (points.length && dist(p, points[points.length - 1]) < 0.02) return; // double-click's second press
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
      {path.length > 1 && (
        <Line
          points={path.flatMap((p) => [p.x, p.y])}
          closed={points.length >= 3 && !hover}
          stroke={SELECT_COLOR}
          strokeWidth={2}
          strokeScaleEnabled={false}
          fill={points.length >= 2 ? 'rgba(47,111,237,0.15)' : undefined}
          dash={[6, 4]}
        />
      )}
      {points.map((p, i) => (
        <Circle key={i} x={p.x} y={p.y} radius={(i === 0 ? 6 : 4) * px} fill={SELECT_COLOR} />
      ))}
      {mode === 'draw' && hover && <Circle x={hover.x} y={hover.y} radius={4 * px} fill={SELECT_COLOR} opacity={0.7} />}
    </Group>
  );
}
