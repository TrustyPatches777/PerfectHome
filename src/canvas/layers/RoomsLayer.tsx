import { Group, Line, Text } from 'react-konva';
import { formatArea, labelPoint, polygonArea } from '../../geometry';
import { useDesign } from '../../store/design';
import { useUi } from '../../store/ui';
import { SELECT_COLOR } from '../style';

export function RoomsLayer() {
  const rooms = useDesign((s) => s.design.rooms);
  const layer = useDesign((s) => s.design.layers.rooms);
  const tool = useUi((s) => s.tool);
  const zoom = useUi((s) => s.viewport.zoom);
  const selId = useUi((s) => (s.selection?.kind === 'room' ? s.selection.id : null));

  if (!layer.visible) return null;
  const fs = 13 / zoom; // labels keep a constant on-screen size

  return (
    <Group listening={tool === 'select' && !layer.locked}>
      {rooms.map((r) => {
        return (
          <Line
            key={r.id}
            points={r.points.flatMap((p) => [p.x, p.y])}
            closed
            fill={r.color}
            opacity={0.92}
            stroke={r.id === selId ? SELECT_COLOR : undefined}
            strokeWidth={2}
            strokeScaleEnabled={false}
            name={`room-${r.id}`}
            onMouseDown={(e) => {
              if (e.evt.button !== 0) return;
              e.cancelBubble = true;
              useUi.getState().select({ kind: 'room', id: r.id });
            }}
          />
        );
      })}
      {rooms.map((r) => {
        const c = labelPoint(r.points);
        const xs = r.points.map((p) => p.x);
        const ys = r.points.map((p) => p.y);
        if (Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) * zoom < 44) return null;
        const width = 200 / zoom;
        return (
          <Text
            key={`t-${r.id}`}
            x={c.x - width / 2}
            y={c.y - fs * 1.2}
            width={width}
            align="center"
            text={`${r.name}\n${formatArea(polygonArea(r.points))}`}
            fontSize={fs}
            fontStyle="bold"
            lineHeight={1.25}
            fill="#374151"
            listening={false}
          />
        );
      })}
    </Group>
  );
}
