import { useMemo } from 'react';
import { Group, Line, Rect, Shape } from 'react-konva';
import type { Opening, Wall } from '../../model';
import { doorGeometry, wallArc, wallPointAt, wallSolidSegments } from '../../geometry';
import { patternFillProps, patternFor } from '../../patterns';
import { WALL_STYLE } from '../../walls';
import { useDesign } from '../../store/design';
import { useOnFloor } from '../../store/floor';
import { useSelectedIds, useUi } from '../../store/ui';
import { input } from '../input';
import { pressItem } from '../press';
import { SELECT_COLOR } from '../style';
import { stairShapes } from '../../stairs';
import { StairShapes } from './StairShapes';
import { useFloorId } from '../../store/floor';
import { useIsMulti } from '../../store/ui';

/** A wall: straight (a row of rectangles with gaps for doors) or curved (arc bands). */
export function WallShape({ wall, openings, selected, ghost }: { wall: Wall; openings: Opening[]; selected: boolean; ghost?: boolean }) {
  const style = WALL_STYLE[wall.type] ?? WALL_STYLE.interior;
  const segs = wallSolidSegments(wall, openings);
  const arc = wallArc(wall);
  const t = wall.thickness;
  const pattern = style.hatch ? patternFor('hatch', style.fill) : null;
  const paint = pattern ? patternFillProps(pattern) : { fill: style.fill };
  const stroke = {
    stroke: selected ? SELECT_COLOR : 'rgba(0,0,0,0)',
    strokeWidth: selected ? 2.5 : 8,
    strokeScaleEnabled: false,
  };
  const onMouseDown = (e: { evt: MouseEvent; cancelBubble: boolean }) => {
    if (e.evt.button !== 0 || input.space) return;
    e.cancelBubble = true;
    pressItem(e.evt, { kind: 'wall', id: wall.id }, 'move');
  };

  if (!arc) {
    const wp = wallPointAt(wall, 0);
    return (
      <Group x={wp.p.x} y={wp.p.y} rotation={wp.angle} opacity={ghost ? 0.5 : 1} onMouseDown={onMouseDown}>
        {segs.map(([s0, s1], i) => (
          <Rect key={i} x={s0} y={-t / 2} width={s1 - s0} height={t} {...paint} {...stroke} />
        ))}
      </Group>
    );
  }
  const ccw = arc.sweep < 0;
  return (
    <Group opacity={ghost ? 0.5 : 1} onMouseDown={onMouseDown}>
      {segs.map(([s0, s1], i) => (
        <Shape
          key={i}
          {...paint}
          {...stroke}
          sceneFunc={(ctx, shape) => {
            const th0 = arc.a0 + arc.sweep * (s0 / arc.length);
            const th1 = arc.a0 + arc.sweep * (s1 / arc.length);
            ctx.beginPath();
            ctx.arc(arc.c.x, arc.c.y, arc.r + t / 2, th0, th1, ccw);
            ctx.arc(arc.c.x, arc.c.y, Math.max(0.001, arc.r - t / 2), th1, th0, !ccw);
            ctx.closePath();
            ctx.fillStrokeShape(shape);
          }}
        />
      ))}
    </Group>
  );
}

const GLASS = '#dbeafe';

/** Everything that can sit in a wall gap: doors, windows, sliding and garage doors, bay windows, open passages. */
export function OpeningShape({ wall, opening, selected, ghost }: { wall: Wall; opening: Opening; selected: boolean; ghost?: boolean }) {
  const wp = wallPointAt(wall, opening.pos); // for curved walls the opening is drawn straight along the tangent at its center
  const t = wall.thickness;
  const w = opening.width;
  const x0 = -w / 2;
  const x1 = w / 2;
  const kind = opening.kind;
  const stroke = selected ? SELECT_COLOR : '#1f2937';
  const thin = { strokeScaleEnabled: false, listening: false } as const;
  const side = opening.swing; // doors swing, and bay windows project, toward this side

  // Door leaves: one for a single door, two half-width leaves hinged on opposite jambs for double and French doors.
  const leaves: Opening[] =
    kind === 'door'
      ? [opening]
      : kind === 'double' || kind === 'french'
        ? [
            { ...opening, pos: opening.pos - w / 4, width: w / 2, hinge: 'a' },
            { ...opening, pos: opening.pos + w / 4, width: w / 2, hinge: 'b' },
          ]
        : [];
  const bay = Math.min(0.6, w * 0.35);
  const bayInset = bay * 0.7;

  return (
    <Group opacity={ghost ? 0.75 : 1}>
      {ghost && (
        <Group x={wp.p.x} y={wp.p.y} rotation={wp.angle}>
          <Rect x={x0} y={-t / 2 - 0.005} width={w} height={t + 0.01} fill="#ffffff" />
        </Group>
      )}
      {leaves.map((leaf, i) => {
        const g = doorGeometry(wall, leaf);
        return (
          <Group key={i} listening={false}>
            <Line points={g.arc.flatMap((p) => [p.x, p.y])} stroke={stroke} strokeWidth={1} dash={[4, 3]} {...thin} />
            {kind === 'french' ? (
              <Line points={[g.hinge.x, g.hinge.y, g.leafEnd.x, g.leafEnd.y]} stroke={stroke} strokeWidth={0.07} lineCap="butt" listening={false} />
            ) : (
              <Line points={[g.hinge.x, g.hinge.y, g.leafEnd.x, g.leafEnd.y]} stroke={stroke} strokeWidth={0.045} lineCap="butt" listening={false} />
            )}
            {kind === 'french' && <Line points={[g.hinge.x, g.hinge.y, g.leafEnd.x, g.leafEnd.y]} stroke={GLASS} strokeWidth={0.03} lineCap="butt" listening={false} />}
          </Group>
        );
      })}
      <Group
        x={wp.p.x}
        y={wp.p.y}
        rotation={wp.angle}
        onMouseDown={(e) => {
          if (ghost || e.evt.button !== 0 || input.space) return;
          e.cancelBubble = true;
          pressItem(e.evt, { kind: 'opening', id: opening.id }, 'move');
        }}
      >
        {kind === 'window' && (
          <>
            <Rect x={x0} y={-t / 2} width={w} height={t} fill={GLASS} stroke={stroke} strokeWidth={selected ? 2 : 1.25} strokeScaleEnabled={false} />
            <Line points={[x0, 0, x1, 0]} stroke={stroke} strokeWidth={1} {...thin} />
          </>
        )}
        {kind === 'bay' && (
          <>
            <Rect x={x0} y={-t / 2} width={w} height={t} fill={GLASS} stroke={stroke} strokeWidth={1} strokeScaleEnabled={false} />
            <Line
              points={[x0, (side * t) / 2, x0 + bayInset, side * (t / 2 + bay), x1 - bayInset, side * (t / 2 + bay), x1, (side * t) / 2]}
              closed
              fill={GLASS}
              stroke={stroke}
              strokeWidth={selected ? 2 : 1.25}
              strokeScaleEnabled={false}
              lineJoin="round"
            />
            <Line points={[x0 + bayInset, side * (t / 2 + bay * 0.4), x1 - bayInset, side * (t / 2 + bay * 0.4)]} stroke={stroke} strokeWidth={1} {...thin} />
          </>
        )}
        {kind === 'sliding' && (
          <>
            <Rect x={x0} y={-t / 2} width={w} height={t} fill="#ffffff" stroke={stroke} strokeWidth={selected ? 2 : 1} strokeScaleEnabled={false} />
            <Rect x={x0 + w * 0.02} y={-t / 2 + t * 0.12} width={w * 0.55} height={t * 0.3} fill={GLASS} stroke={stroke} strokeWidth={1} strokeScaleEnabled={false} listening={false} />
            <Rect x={x1 - w * 0.57} y={t / 2 - t * 0.42} width={w * 0.55} height={t * 0.3} fill={GLASS} stroke={stroke} strokeWidth={1} strokeScaleEnabled={false} listening={false} />
          </>
        )}
        {(kind === 'door' || kind === 'double' || kind === 'french' || kind === 'garage' || kind === 'gap') && (
          <>
            {kind === 'garage' && (
              <>
                <Rect x={x0} y={-t / 2} width={w} height={t} fill="#e5e7eb" listening={false} />
                <Line points={[x0, 0, x1, 0]} stroke={stroke} strokeWidth={2} dash={[10, 5]} {...thin} />
              </>
            )}
            <Line points={[x0, -t / 2, x0, t / 2]} stroke={stroke} strokeWidth={1.5} {...thin} />
            <Line points={[x1, -t / 2, x1, t / 2]} stroke={stroke} strokeWidth={1.5} {...thin} />
            <Rect
              x={x0}
              y={-t / 2}
              width={w}
              height={t}
              fill="rgba(0,0,0,0.001)"
              stroke={selected ? SELECT_COLOR : 'rgba(0,0,0,0)'}
              strokeWidth={2}
              strokeScaleEnabled={false}
            />
          </>
        )}
      </Group>
    </Group>
  );
}

export function StructureLayer() {
  const walls = useOnFloor((d) => d.walls);
  const allOpenings = useDesign((s) => s.design.openings);
  const openings = useMemo(() => {
    const ids = new Set(walls.map((w) => w.id));
    return allOpenings.filter((o) => ids.has(o.wallId));
  }, [walls, allOpenings]);
  const layer = useDesign((s) => s.design.layers.structure);
  const tool = useUi((s) => s.tool);
  const stairs = useOnFloor((d) => d.stairs);
  const allStairs = useDesign((s) => s.design.stairs);
  const floors = useDesign((s) => s.design.floors);
  const floor = useFloorId();
  const stairIds = useSelectedIds('stair');
  const multi = useIsMulti();
  const wallIds = useSelectedIds('wall');
  const openingIds = useSelectedIds('opening');
  if (!layer.visible) return null;
  const byWall = new Map<string, Opening[]>();
  for (const o of openings) byWall.set(o.wallId, [...(byWall.get(o.wallId) ?? []), o]);

  return (
    <Group listening={tool === 'select' && !layer.locked}>
      {walls.map((w) => (
        <WallShape key={w.id} wall={w} openings={byWall.get(w.id) ?? []} selected={wallIds.has(w.id)} />
      ))}
      {openings.map((o) => {
        const wall = walls.find((w) => w.id === o.wallId);
        return wall && <OpeningShape key={o.id} wall={wall} opening={o} selected={openingIds.has(o.id)} />;
      })}
      {/* the stairs coming up from the floor below show as a dashed outline (the stairwell) */}
      {(() => {
        const at = floors.findIndex((f) => f.id === floor);
        const below = at > 0 ? floors[at - 1].id : null;
        return allStairs
          .filter((s) => s.floor === below)
          .map((s) => (
            <Group key={`well-${s.id}`} x={s.x} y={s.y} offsetX={s.w / 2} offsetY={s.d / 2} rotation={s.rotation} listening={false}>
              <StairShapes shapes={stairShapes(s)} ghost />
            </Group>
          ));
      })()}
      {stairs.map((s) => (
        <Group
          key={s.id}
          id={s.id}
          x={s.x}
          y={s.y}
          offsetX={s.w / 2}
          offsetY={s.d / 2}
          rotation={s.rotation}
          onMouseDown={(e) => {
            if (e.evt.button !== 0 || input.space) return;
            e.cancelBubble = true;
            pressItem(e.evt, { kind: 'stair', id: s.id }, 'move');
          }}
        >
          <Rect width={s.w} height={s.d} fill="rgba(0,0,0,0.001)" />
          <StairShapes shapes={stairShapes(s)} />
          {multi && stairIds.has(s.id) && <Rect width={s.w} height={s.d} stroke={SELECT_COLOR} strokeWidth={2.5} strokeScaleEnabled={false} listening={false} />}
        </Group>
      ))}
    </Group>
  );
}
