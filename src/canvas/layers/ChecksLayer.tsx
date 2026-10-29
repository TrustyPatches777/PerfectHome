import { useMemo } from 'react';
import { Circle, Group, Line, Text } from 'react-konva';
import { findIssues } from '../../checks';
import { areaReport } from '../../areas';
import { useDesign } from '../../store/design';
import { useFloorId } from '../../store/floor';
import { useUi } from '../../store/ui';
import { useLang } from '../../i18n';

/** Markers for "Check plan" problems and (optionally) the distances from the house to the plot boundary. */
export function ChecksLayer() {
  const show = useUi((s) => s.showChecks);
  const minPassage = useUi((s) => s.minPassage);
  const showSetbacks = useUi((s) => s.showSetbacks);
  const zoom = useUi((s) => s.viewport.zoom);
  const design = useDesign((s) => s.design);
  const floor = useFloorId();
  const lang = useLang(); // texts worked out here follow the language
  const issues = useMemo(() => (show ? findIssues(design, floor, minPassage) : []), [show, design, floor, minPassage, lang]);
  const setbacks = useMemo(() => (showSetbacks ? (areaReport(design).plot?.edges ?? []) : []), [showSetbacks, design]);
  const px = 1 / zoom;

  return (
    <Group listening={false}>
      {issues.map((i) => (
        <Group key={i.id}>
          {i.polygon && (
            <Line
              points={i.polygon.flatMap((p) => [p.x, p.y])}
              closed
              fill={i.kind === 'in-wall' ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.3)'}
              stroke="#ef4444"
              strokeWidth={2}
              strokeScaleEnabled={false}
              dash={i.kind === 'in-wall' ? [6, 4] : undefined}
            />
          )}
          {i.line && <Line points={[i.line[0].x, i.line[0].y, i.line[1].x, i.line[1].y]} stroke="#f59e0b" strokeWidth={4} strokeScaleEnabled={false} lineCap="round" />}
          <Circle x={i.at.x} y={i.at.y} radius={9 * px} fill="#ef4444" stroke="#ffffff" strokeWidth={2} strokeScaleEnabled={false} />
          <Text x={i.at.x - 9 * px} y={i.at.y - 6.5 * px} width={18 * px} align="center" text="!" fontSize={13 * px} fontStyle="bold" fill="#ffffff" />
        </Group>
      ))}
      {setbacks.map((e) => (
        <Group key={e.index}>
          <Line points={[e.from.x, e.from.y, e.to.x, e.to.y]} stroke="#16a34a" strokeWidth={1.5} dash={[6, 4]} strokeScaleEnabled={false} />
          <Circle x={e.from.x} y={e.from.y} radius={3 * px} fill="#16a34a" />
          <Circle x={e.to.x} y={e.to.y} radius={3 * px} fill="#16a34a" />
          <Text
            x={(e.from.x + e.to.x) / 2 + 6 * px}
            y={(e.from.y + e.to.y) / 2 - 7 * px}
            text={`${(Math.round(e.distance * 100) / 100).toFixed(2)} m`}
            fontSize={12 * px}
            fontStyle="bold"
            fill="#15803d"
          />
        </Group>
      ))}
    </Group>
  );
}
