import { useMemo } from 'react';
import { Group, Line, Rect } from 'react-konva';
import type { Opening, Wall } from '../../model';
import { doorGeometry, wallFrame, wallSolidSegments } from '../../geometry';
import { useDesign } from '../../store/design';
import { useOnFloor } from '../../store/floor';
import { useSelectedIds, useUi } from '../../store/ui';
import { input } from '../input';
import { pressItem } from '../press';
import { SELECT_COLOR, WALL_COLOR } from '../style';

export function WallShape({ wall, openings, selected, ghost }: { wall: Wall; openings: Opening[]; selected: boolean; ghost?: boolean }) {
  const f = wallFrame(wall);
  const segs = wallSolidSegments(wall, openings);
  return (
    <Group
      x={wall.a.x}
      y={wall.a.y}
      rotation={f.angle}
      opacity={ghost ? 0.5 : 1}
      onMouseDown={(e) => {
        if (e.evt.button !== 0 || input.space) return;
        e.cancelBubble = true;
        pressItem(e.evt, { kind: 'wall', id: wall.id }, 'move');
      }}
    >
      {segs.map(([s0, s1], i) => (
        <Rect
          key={i}
          x={s0}
          y={-wall.thickness / 2}
          width={s1 - s0}
          height={wall.thickness}
          fill={WALL_COLOR}
          stroke={selected ? SELECT_COLOR : 'rgba(0,0,0,0)'}
          strokeWidth={selected ? 2.5 : 8}
          strokeScaleEnabled={false}
        />
      ))}
    </Group>
  );
}

/** Everything that can sit in a wall gap: doors (with swing arcs), windows, garage doors and open passages. */
export function OpeningShape({ wall, opening, selected, ghost }: { wall: Wall; opening: Opening; selected: boolean; ghost?: boolean }) {
  const f = wallFrame(wall);
  const t = wall.thickness;
  const x0 = opening.pos - opening.width / 2;
  const x1 = opening.pos + opening.width / 2;
  const kind = opening.kind;
  const stroke = selected ? SELECT_COLOR : '#1f2937';
  const thin = { strokeScaleEnabled: false, listening: false } as const;

  // Door leaves: one for a single door, two half-width leaves hinged on opposite jambs for a double door.
  const leaves: Opening[] =
    kind === 'door'
      ? [opening]
      : kind === 'double'
        ? [
            { ...opening, pos: opening.pos - opening.width / 4, width: opening.width / 2, hinge: 'a' },
            { ...opening, pos: opening.pos + opening.width / 4, width: opening.width / 2, hinge: 'b' },
          ]
        : [];

  return (
    <Group opacity={ghost ? 0.75 : 1}>
      {ghost && (
        <Group x={wall.a.x} y={wall.a.y} rotation={f.angle}>
          <Rect x={x0} y={-t / 2 - 0.005} width={opening.width} height={t + 0.01} fill="#ffffff" />
        </Group>
      )}
      {leaves.map((leaf, i) => {
        const g = doorGeometry(wall, leaf);
        return (
          <Group key={i} listening={false}>
            <Line points={g.arc.flatMap((p) => [p.x, p.y])} stroke={stroke} strokeWidth={1} dash={[4, 3]} {...thin} />
            <Line points={[g.hinge.x, g.hinge.y, g.leafEnd.x, g.leafEnd.y]} stroke={stroke} strokeWidth={0.045} lineCap="butt" listening={false} />
          </Group>
        );
      })}
      <Group
        x={wall.a.x}
        y={wall.a.y}
        rotation={f.angle}
        onMouseDown={(e) => {
          if (ghost || e.evt.button !== 0 || input.space) return;
          e.cancelBubble = true;
          pressItem(e.evt, { kind: 'opening', id: opening.id }, 'move');
        }}
      >
        {kind === 'window' ? (
          <>
            <Rect x={x0} y={-t / 2} width={opening.width} height={t} fill="#e6f2ff" stroke={stroke} strokeWidth={selected ? 2 : 1.25} strokeScaleEnabled={false} />
            <Line points={[x0, 0, x1, 0]} stroke={stroke} strokeWidth={1} {...thin} />
          </>
        ) : (
          <>
            {kind === 'garage' && (
              <>
                <Rect x={x0} y={-t / 2} width={opening.width} height={t} fill="#e5e7eb" listening={false} />
                <Line points={[x0, 0, x1, 0]} stroke={stroke} strokeWidth={2} dash={[10, 5]} {...thin} />
              </>
            )}
            <Line points={[x0, -t / 2, x0, t / 2]} stroke={stroke} strokeWidth={1.5} {...thin} />
            <Line points={[x1, -t / 2, x1, t / 2]} stroke={stroke} strokeWidth={1.5} {...thin} />
            <Rect
              x={x0}
              y={-t / 2}
              width={opening.width}
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
    </Group>
  );
}
