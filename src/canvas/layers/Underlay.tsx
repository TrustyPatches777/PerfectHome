import { useMemo } from 'react';
import { Group, Line } from 'react-konva';
import { useDesign } from '../../store/design';
import { floorBelow, useFloorId } from '../../store/floor';
import { useUi } from '../../store/ui';
import { WallShape } from './StructureLayer';

/** The floor below, drawn faintly and non-interactive, so walls and stairs can be lined up. */
export function Underlay() {
  const design = useDesign((s) => s.design);
  const floor = useFloorId();
  const show = useUi((s) => s.showUnderlay);
  const below = floorBelow(design, floor);

  const walls = useMemo(() => design.walls.filter((w) => w.floor === below), [design.walls, below]);
  const openings = useMemo(() => {
    const ids = new Set(walls.map((w) => w.id));
    return design.openings.filter((o) => ids.has(o.wallId));
  }, [walls, design.openings]);
  if (!show || !below) return null;

  return (
    <Group name="underlay" listening={false} opacity={0.28}>
      {design.zones.filter((z) => z.floor === below).map((z) => (
        <Line key={z.id} points={z.points.flatMap((p) => [p.x, p.y])} closed fill={z.color} />
      ))}
      {design.rooms.filter((r) => r.floor === below).map((r) => (
        <Line key={r.id} points={r.points.flatMap((p) => [p.x, p.y])} closed fill={r.color} />
      ))}
      {walls.map((w) => (
        <WallShape key={w.id} wall={w} openings={openings.filter((o) => o.wallId === w.id)} selected={false} />
      ))}
    </Group>
  );
}
