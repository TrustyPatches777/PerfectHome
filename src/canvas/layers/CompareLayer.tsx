import { Group, Rect } from 'react-konva';
import { useFloorId } from '../../store/floor';
import { useUi } from '../../store/ui';

const PAD = 0.12;

/** While comparing with a snapshot: what was added (green), changed (orange) and removed (red, dashed) since, on this floor. */
export function CompareLayer() {
  const compare = useUi((s) => s.compare);
  const floor = useFloorId();
  if (!compare) return null;
  const draw = (list: typeof compare.diff.added, stroke: string, dash?: number[]) =>
    list
      .filter((e) => e.box && e.floor === floor)
      .map((e) => (
        <Rect key={`${stroke}${e.ref.kind}${e.ref.id}`} x={e.box!.minX - PAD} y={e.box!.minY - PAD} width={e.box!.maxX - e.box!.minX + 2 * PAD} height={e.box!.maxY - e.box!.minY + 2 * PAD} stroke={stroke} strokeWidth={2.5} strokeScaleEnabled={false} dash={dash} fill={`${stroke}22`} listening={false} />
      ));
  return (
    <Group name="underlay" listening={false}>
      {draw(compare.diff.removed, '#dc2626', [6, 4])}
      {draw(compare.diff.changed, '#f59e0b')}
      {draw(compare.diff.added, '#16a34a')}
    </Group>
  );
}
