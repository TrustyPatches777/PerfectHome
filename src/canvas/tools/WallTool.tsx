import { useRef, useState } from 'react';
import { Circle, Group, Line, Text } from 'react-konva';
import type Konva from 'konva';
import { layerBlocksEditing } from '../../actions';
import { newId, type Point } from '../../model';
import { wallHeightFor } from '../../storey';
import { addWinterGarden } from '../../winterGarden';
import { addRoomTo, boxCorners, rectWalls } from '../../shapes';
import { constrainAngle, detectRoom, dist, formatLength, samePoint, snapValue } from '../../geometry';
import { useDesign } from '../../store/design';
import { floorId } from '../../store/floor';
import { useUi } from '../../store/ui';
import { parseTypedLength, parseTypedSize, pointAtDistance } from '../../typed';
import { isDoubleClick, isPrimary, snapWorld, useCaptureKeys, useStageEvents, useTypedInput } from '../input';
import { FLOOR_COLORS, SELECT_COLOR } from '../style';

/** The Wall tool: one wall at a time, or a whole rectangle of walls (with its room) from two corners. */
export function WallTool() {
  const mode = useUi((s) => s.wallMode);
  return mode === 'line' ? <WallLineTool /> : <WallRectTool winter={mode === 'winter'} />;
}

/** Click to start a wall, click again to place each corner. Double-click, Enter or Esc to finish. */
function WallLineTool() {
  const ref = useRef<Konva.Group>(null);
  const zoom = useUi((s) => s.viewport.zoom);
  const thickness = useDesign((s) => s.design.settings.wallThickness);
  const wallType = useUi((s) => s.wallType);
  const [start, setStart] = useState<Point | null>(null);
  const [hover, setHover] = useState<{ p: Point; vertex: boolean } | null>(null);
  const first = useRef<Point | null>(null);

  const rightAngles = useUi((s) => s.wallOrtho);
  /** Which angle steps a wall is locked to: Shift = every 45°, Ctrl/Cmd (or the "Right angles" switch) = only 90°. */
  const stepOf = (e: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }) => (e.shiftKey ? 45 : rightAngles || e.ctrlKey || e.metaKey ? 90 : 0);

  const resolve = (world: Point, step: number) => {
    if (start && step) {
      const locked = constrainAngle(start, world, step);
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

  const commit = (from: Point, p: Point) => {
    if (dist(from, p) < 0.02) return;
    const floor = floorId();
    useDesign.getState().update((d) => {
      d.walls.push({ id: newId(), floor, a: { ...from }, b: { ...p }, thickness, type: wallType, height: wallHeightFor(wallType, useDesign.getState().design.settings.storeyHeight) });
    });
    if (first.current && samePoint(p, first.current, 0.01)) finish(); // closed a loop
    else setStart(p);
  };

  useTypedInput(!!start, (text) => {
    const v = parseTypedLength(text);
    if (!v || !start) return false;
    commit(start, pointAtDistance(start, hover?.p ?? null, v.length, v.angle));
  });

  useStageEvents(ref, {
    mousemove: (e, world) => setHover(resolve(world, stepOf(e.evt))),
    mousedown: (e, world) => {
      if (!isPrimary(e)) return;
      if (isDoubleClick(e.evt)) {
        finish();
        return;
      }
      if (!start && layerBlocksEditing('wall')) return;
      const { p } = resolve(world, stepOf(e.evt));
      if (!start) {
        setStart(p);
        first.current = p;
        return;
      }
      commit(start, p); // ignores the second click of a double-click (zero length)
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

/**
 * Rectangle mode: drag from one corner to the opposite one (or click both, or type 5x3 + Enter) and four joined walls appear;
 * with "room" on, the room inside them too.
 */
function WallRectTool({ winter = false }: { winter?: boolean }) {
  const ref = useRef<Konva.Group>(null);
  const zoom = useUi((s) => s.viewport.zoom);
  const thickness = useDesign((s) => s.design.settings.wallThickness);
  const wallType = useUi((s) => s.wallType);
  const withRoom = useUi((s) => s.wallRoom);
  const [start, setStart] = useState<Point | null>(null);
  const [hover, setHover] = useState<Point | null>(null);
  const downAt = useRef({ x: 0, y: 0 });
  const snap = (w: Point) => snapWorld(w).p;

  const finish = (a: Point, b: Point) => {
    setStart(null);
    if (Math.abs(a.x - b.x) < 0.3 || Math.abs(a.y - b.y) < 0.3) return;
    const floor = floorId();
    if (winter) {
      addWinterGarden(a, b, floor);
      return;
    }
    useDesign.getState().update((d) => {
      d.walls.push(...rectWalls(a, b, floor, thickness, wallType, wallHeightFor(wallType, useDesign.getState().design.settings.storeyHeight)));
      if (!withRoom) return;
      const middle = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const poly = detectRoom(middle, d.walls.filter((w) => w.floor === floor));
      if (poly) addRoomTo(d, floor, poly, { x: Math.round(middle.x * 1000) / 1000, y: Math.round(middle.y * 1000) / 1000 }, FLOOR_COLORS[d.rooms.length % FLOOR_COLORS.length]);
    });
  };

  useTypedInput(!!start, (text) => {
    const size = parseTypedSize(text);
    if (!size || !start) return false;
    const sx = hover && hover.x < start.x ? -1 : 1;
    const sy = hover && hover.y < start.y ? -1 : 1;
    finish(start, { x: start.x + sx * size.w, y: start.y + sy * size.d });
  });

  useStageEvents(ref, {
    mousemove: (_e, world) => setHover(snap(world)),
    mousedown: (e, world) => {
      if (!isPrimary(e) || layerBlocksEditing('wall')) return;
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
          <Line points={boxCorners(start, hover).flatMap((p) => [p.x, p.y])} closed stroke={SELECT_COLOR} opacity={0.6} strokeWidth={thickness} lineJoin="miter" />
          <Text x={hover.x + 10 * px} y={hover.y + 8 * px} text={`${formatLength(Math.abs(hover.x - start.x))} × ${formatLength(Math.abs(hover.y - start.y))}`} fontSize={13 * px} fontStyle="bold" fill={SELECT_COLOR} />
        </>
      )}
      {hover && <Circle x={hover.x} y={hover.y} radius={4 * px} fill={SELECT_COLOR} opacity={0.8} />}
      {start && <Circle x={start.x} y={start.y} radius={4 * px} fill={SELECT_COLOR} />}
    </Group>
  );
}
