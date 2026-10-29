import { useMemo } from 'react';
import { Group, Line, Text } from 'react-konva';
import { doorwayPatches } from '../../doorways';
import { formatArea, labelPoint, polygonArea } from '../../geometry';
import { roomSpec } from '../../paintSpec';
import { patternFillProps, patternFor, type PatternKind } from '../../patterns';
import { useDesign } from '../../store/design';
import { useOnFloor } from '../../store/floor';
import { useSelectedIds, useUi } from '../../store/ui';
import { input } from '../input';
import { pressItem } from '../press';
import { useLook } from '../look';
import { SELECT_COLOR } from '../style';
import { t } from '../../i18n';

/** Pattern fill props for a room with a floor material (null for a plain color). */
function pattern(r: { material: string; color: string; grout?: string; texture?: string }) {
  if (r.material === 'plain') return null;
  const p = patternFor(r.material as PatternKind, roomSpec(r));
  return p && patternFillProps(p);
}

export function RoomsLayer() {
  const rooms = useOnFloor((d) => d.rooms);
  const walls = useDesign((s) => s.design.walls);
  const openings = useDesign((s) => s.design.openings);
  const patches = useMemo(() => doorwayPatches({ walls, openings, rooms }), [walls, openings, rooms]);
  const layer = useDesign((s) => s.design.layers.rooms);
  const tool = useUi((s) => s.tool);
  const zoom = useUi((s) => s.viewport.zoom);
  const selIds = useSelectedIds('room');
  useUi((s) => s.texturesVersion); // draw again when an uploaded picture has loaded
  const look = useLook();
  // what a floor looks like in this plan style: its material, or a flat tint (nothing at all still has to catch the mouse)
  const fillOf = (r: { material: string; color: string; grout?: string; texture?: string }) => {
    if (look.rooms === 'material') return pattern(r) ?? { fill: r.color };
    const flat = look.roomFlat(r.color);
    return { fill: flat === 'none' ? 'rgba(0,0,0,0.001)' : flat };
  };

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
            {...fillOf(r)}
            opacity={0.92}
            stroke={selIds.has(r.id) ? SELECT_COLOR : undefined}
            strokeWidth={2}
            strokeScaleEnabled={false}
            name={`room-${r.id}`}
            onMouseDown={(e) => {
              if (e.evt.button !== 0 || input.space) return;
              e.cancelBubble = true;
              pressItem(e.evt, { kind: 'room', id: r.id }, 'area');
            }}
          />
        );
      })}
      {patches.map((p, i) => (
        <Line key={`door-${p.openingId}-${i}`} points={p.pts.flatMap((q) => [q.x, q.y])} closed {...fillOf(p.room)} opacity={0.92} listening={false} />
      ))}
      {rooms.map((r) => {
        const c = labelPoint(r.points);
        const xs = r.points.map((p) => p.x);
        const ys = r.points.map((p) => p.y);
        if (Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) * zoom < 44) return null;
        const width = 200 / zoom;
        const lines = look.roomLabel(t(r.name), formatArea(polygonArea(r.points)), r.level ? `${r.level > 0 ? '+' : '−'}${Math.abs(Math.round(r.level * 100))} cm` : '');
        if (!lines.length) return null;
        const size = fs * look.labelScale;
        return (
          <Text
            key={`t-${r.id}`}
            x={c.x - width / 2}
            y={c.y - size * (lines.length > 1 ? 1.2 : 0.6)}
            width={width}
            align="center"
            text={lines.join('\n')}
            fontFamily={look.font.canvas}
            fontSize={size}
            fontStyle="bold"
            lineHeight={1.25}
            fill={look.text}
            listening={false}
          />
        );
      })}
    </Group>
  );
}
