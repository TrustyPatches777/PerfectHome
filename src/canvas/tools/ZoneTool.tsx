import { useRef, useState } from 'react';
import { Circle, Group, Line, Text } from 'react-konva';
import type Konva from 'konva';
import { layerBlocksEditing } from '../../actions';
import { newId, type Point } from '../../model';
import { dist, formatLength } from '../../geometry';
import { ZONE_STYLES } from '../../outdoor';
import { useDesign } from '../../store/design';
import { floorId } from '../../store/floor';
import { useUi } from '../../store/ui';
import { isDoubleClick, isPrimary, snapWorld, useCaptureKeys, useStageEvents } from '../input';
import { SELECT_COLOR } from '../style';

/** Create a zone of the kind chosen in the Outdoor palette and select it. */
export function addZone(points: Point[]) {
  const { zoneKind } = useUi.getState();
  const id = newId();
  useDesign.getState().update((d) => {
    d.zones.push({ id, floor: floorId(), kind: zoneKind, name: ZONE_STYLES[zoneKind].label, color: ZONE_STYLES[zoneKind].color, points });
  });
  useUi.getState().setTool('select');
  useUi.getState().select({ kind: 'zone', id });
}

const rectPoints = (a: Point, b: Point): Point[] => [
  { x: a.x, y: a.y },
  { x: b.x, y: a.y },
  { x: b.x, y: b.y },
  { x: a.x, y: b.y },
];

/**
 * Draw an outdoor area. Rectangle: drag a box, or click two opposite corners. Polygon: click the corners,
 * then double-click, Enter, or click the first corner again.
 */
export function ZoneTool() {
  const ref = useRef<Konva.Group>(null);
  const zoom = useUi((s) => s.viewport.zoom);
  const shape = useUi((s) => s.zoneShape);
  const [start, setStart] = useState<Point | null>(null);
  const [points, setPoints] = useState<Point[]>([]);
  const [hover, setHover] = useState<Point | null>(null);
  const downAt = useRef({ x: 0, y: 0 });

  const snap = (w: Point) => snapWorld(w, { faces: true }).p;
  const finishRect = (a: Point, b: Point) => {
    setStart(null);
    if (Math.abs(a.x - b.x) < 0.2 || Math.abs(a.y - b.y) < 0.2) return;
    addZone(rectPoints(a, b));
  };
  const finishPoly = () => {
    if (points.length >= 3) addZone(points);
    setPoints([]);
  };

  useStageEvents(ref, {
    mousemove: (_e, world) => setHover(snap(world)),
    mousedown: (e, world) => {
      if (!isPrimary(e) || layerBlocksEditing('zone')) return;
      const p = snap(world);
      downAt.current = { x: e.evt.clientX, y: e.evt.clientY };
      if (shape === 'rect') {
        if (!start) setStart(p);
        else finishRect(start, p);
        return;
      }
      if (isDoubleClick(e.evt)) return finishPoly();
      if (points.length >= 3 && dist(p, points[0]) < 10 / zoom) return finishPoly();
      if (points.length && dist(p, points[points.length - 1]) < 0.02) return;
      setPoints([...points, p]);
    },
    mouseup: (e, world) => {
      // a real drag (not a click) finishes the rectangle on release
      if (shape !== 'rect' || !start || !isPrimary(e)) return;
      if (Math.hypot(e.evt.clientX - downAt.current.x, e.evt.clientY - downAt.current.y) > 6) finishRect(start, snap(world));
    },
  });

  useCaptureKeys((e) => {
    if (e.key === 'Escape' && (start || points.length)) {
      setStart(null);
      setPoints([]);
      return true;
    }
    if (e.key === 'Enter' && points.length) {
      finishPoly();
      return true;
    }
    return false;
  });

  const px = 1 / zoom;
  const preview = shape === 'rect' ? (start && hover ? rectPoints(start, hover) : []) : hover && points.length ? [...points, hover] : points;
  return (
    <Group ref={ref} listening={false}>
      {preview.length > 1 && (
        <Line
          points={preview.flatMap((p) => [p.x, p.y])}
          closed={shape === 'rect'}
          stroke={SELECT_COLOR}
          strokeWidth={2}
          strokeScaleEnabled={false}
          fill="rgba(47,111,237,0.15)"
          dash={[6, 4]}
        />
      )}
      {shape === 'rect' && start && hover && (
        <Text x={hover.x + 10 * px} y={hover.y + 8 * px} text={`${formatLength(Math.abs(hover.x - start.x))} × ${formatLength(Math.abs(hover.y - start.y))}`} fontSize={13 * px} fontStyle="bold" fill={SELECT_COLOR} />
      )}
      {points.map((p, i) => (
        <Circle key={i} x={p.x} y={p.y} radius={(i === 0 ? 6 : 4) * px} fill={SELECT_COLOR} />
      ))}
      {hover && <Circle x={hover.x} y={hover.y} radius={4 * px} fill={SELECT_COLOR} opacity={0.7} />}
    </Group>
  );
}
