import { useRef, useState } from 'react';
import { Circle, Group, Line, Text } from 'react-konva';
import type Konva from 'konva';
import { layerBlocksEditing } from '../../actions';
import { newId, type Point } from '../../model';
import { detectRoom, dist, formatLength, pointInPolygon, polygonsOverlap } from '../../geometry';
import { boxCorners } from '../../shapes';
import { useDesign } from '../../store/design';
import { floorId } from '../../store/floor';
import { useUi } from '../../store/ui';
import { isDoubleClick, isPrimary, snapWorld, useCaptureKeys, useStageEvents } from '../input';
import { FLOOR_COLORS, SELECT_COLOR } from '../style';

/** Add a room to the design with the next default name ("Room 3") and floor color. */
export function addRoom(points: Point[], seed?: Point) {
  const id = newId();
  useDesign.getState().update((d) => {
    const floor = floorId();
    const used = d.rooms.filter((r) => r.floor === floor).map((r) => /^Room (\d+)$/.exec(r.name)).map((m) => (m ? Number(m[1]) : 0));
    const n = Math.max(0, ...used) + 1;
    d.rooms.push({ id, floor, name: `Room ${n}`, color: FLOOR_COLORS[d.rooms.length % FLOOR_COLORS.length], material: 'plain', living: true, points, seed });
  });
  useUi.getState().select({ kind: 'room', id });
}

/**
 * Add a room unless it would overlap an existing one. Returns whether it was added; otherwise explains why
 * and selects the room that is in the way.
 */
function tryAddRoom(points: Point[], seed?: Point): boolean {
  const floor = floorId();
  const rooms = useDesign.getState().design.rooms.filter((r) => r.floor === floor);
  const clash = rooms.find((r) => polygonsOverlap(points, r.points));
  if (clash) {
    useUi.getState().select({ kind: 'room', id: clash.id });
    useUi.getState().showToast(`That would overlap “${clash.name}”. Rooms can't overlap, so it is selected instead.`);
    return false;
  }
  addRoom(points, seed);
  return true;
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
  const [corner, setCorner] = useState<Point | null>(null);
  const downAt = useRef({ x: 0, y: 0 });

  const finishBox = (a: Point, b: Point) => {
    setCorner(null);
    if (Math.abs(a.x - b.x) < 0.3 || Math.abs(a.y - b.y) < 0.3) return;
    tryAddRoom(boxCorners(a, b));
  };

  const finish = () => {
    if (points.length >= 3) tryAddRoom(points);
    setPoints([]);
  };

  useStageEvents(ref, {
    mousemove: (_e, world) => setHover(mode === 'auto' ? world : snapWorld(world).p),
    mouseup: (e, world) => {
      if (mode !== 'box' || !corner || !isPrimary(e)) return;
      if (Math.hypot(e.evt.clientX - downAt.current.x, e.evt.clientY - downAt.current.y) > 6) finishBox(corner, snapWorld(world).p);
    },
    mousedown: (e, world) => {
      if (!isPrimary(e)) return;
      if (layerBlocksEditing('room')) return;
      if (mode === 'box') {
        const p = snapWorld(world).p;
        downAt.current = { x: e.evt.clientX, y: e.evt.clientY };
        if (!corner) setCorner(p);
        else finishBox(corner, p);
        return;
      }
      const dbl = isDoubleClick(e.evt);
      if (mode === 'draw' && dbl) {
        finish();
        return;
      }
      if (mode === 'auto') {
        const floor = floorId();
        const existing = useDesign.getState().design.rooms.find((r) => r.floor === floor && pointInPolygon(world, r.points));
        if (existing) {
          useUi.getState().select({ kind: 'room', id: existing.id });
          useUi.getState().showToast(`“${existing.name}” is already a room. Switch to the Select tool (V) to edit it.`);
          return;
        }
        const walls = useDesign.getState().design.walls.filter((w) => w.floor === floor);
        const poly = detectRoom(world, walls);
        if (!poly) {
          useUi
            .getState()
            .showToast(walls.length ? 'No closed room here. Close the walls, or switch to "Draw" to click the corners.' : 'Draw some walls first.');
          return;
        }
        tryAddRoom(poly, { x: Math.round(world.x * 1000) / 1000, y: Math.round(world.y * 1000) / 1000 });
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
    if (corner && e.key === 'Escape') {
      setCorner(null);
      return true;
    }
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
      {mode === 'box' && corner && hover && (
        <>
          <Line points={boxCorners(corner, hover).flatMap((p) => [p.x, p.y])} closed stroke={SELECT_COLOR} strokeWidth={2} strokeScaleEnabled={false} fill="rgba(47,111,237,0.15)" dash={[6, 4]} />
          <Text x={hover.x + 10 * px} y={hover.y + 8 * px} text={`${formatLength(Math.abs(hover.x - corner.x))} × ${formatLength(Math.abs(hover.y - corner.y))}`} fontSize={13 * px} fontStyle="bold" fill={SELECT_COLOR} />
        </>
      )}
      {points.map((p, i) => (
        <Circle key={i} x={p.x} y={p.y} radius={(i === 0 ? 6 : 4) * px} fill={SELECT_COLOR} />
      ))}
      {mode !== 'auto' && hover && <Circle x={hover.x} y={hover.y} radius={4 * px} fill={SELECT_COLOR} opacity={0.7} />}
    </Group>
  );
}
