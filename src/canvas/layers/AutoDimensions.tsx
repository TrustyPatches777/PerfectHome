import { useMemo } from 'react';
import { Group, Rect, Text } from 'react-konva';
import { autoDimensions } from '../../dims';
import { useDesign } from '../../store/design';
import { useFloorId } from '../../store/floor';
import { useUi } from '../../store/ui';

const COLORS = { wall: '#475569', room: '#0f766e', zone: '#15803d', strip: '#6b7280', furniture: '#64748b' };

/** "Show all dimensions": small labels for every wall, room, area, street and piece of furniture. */
export function AutoDimensions() {
  const show = useUi((s) => s.showAllDims);
  const zoom = useUi((s) => s.viewport.zoom);
  const design = useDesign((s) => s.design);
  const floor = useFloorId();
  const labels = useMemo(() => (show ? autoDimensions(design, floor, Math.round(zoom)) : []), [show, design, floor, zoom]);
  if (!show) return null;
  const fs = 11 / zoom;
  return (
    <Group listening={false}>
      {labels.map((l, i) => {
        const w = l.text.length * fs * 0.6 + fs * 0.8;
        return (
          <Group key={i} x={l.x} y={l.y} rotation={l.angle}>
            <Rect x={-w / 2} y={-fs * 0.7} width={w} height={fs * 1.4} fill="rgba(255,255,255,0.8)" cornerRadius={fs * 0.25} />
            <Text x={-w / 2} y={-fs * 0.55} width={w} align="center" text={l.text} fontSize={fs} fontStyle="bold" fill={COLORS[l.kind]} />
          </Group>
        );
      })}
    </Group>
  );
}
