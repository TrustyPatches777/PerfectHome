import { Circle, Group, Line, Text } from 'react-konva';
import { sectionDirection } from '../../geometry';
import type { Point } from '../../model';
import { useDesign } from '../../store/design';
import { useUi } from '../../store/ui';
import { input } from '../input';

const SECTION_COLOR = '#b91c1c';

/** A section line on the plan: dash-dotted, with a heavy tick and an arrow at each end that points the way the section looks, and its letter. */
export function SectionShape({ line, name, zoom, color = SECTION_COLOR }: { line: { a: Point; b: Point; flip?: boolean }; name: string; zoom: number; color?: string }) {
  const px = 1 / zoom;
  const v = sectionDirection(line);
  const len = Math.hypot(line.b.x - line.a.x, line.b.y - line.a.y) || 1;
  const t = { x: (line.b.x - line.a.x) / len, y: (line.b.y - line.a.y) / len };
  const end = (p: Point) => {
    const tip = { x: p.x + v.x * 26 * px, y: p.y + v.y * 26 * px };
    return (
      <Group key={`${p.x},${p.y}`} listening={false}>
        <Line points={[p.x, p.y, tip.x, tip.y]} stroke={color} strokeWidth={3} strokeScaleEnabled={false} />
        <Line
          points={[tip.x - (v.x * 7 + t.x * 5) * px, tip.y - (v.y * 7 + t.y * 5) * px, tip.x, tip.y, tip.x - (v.x * 7 - t.x * 5) * px, tip.y - (v.y * 7 - t.y * 5) * px]}
          stroke={color}
          strokeWidth={2}
          strokeScaleEnabled={false}
        />
        {name && (
          <>
            <Circle x={tip.x + v.x * 11 * px} y={tip.y + v.y * 11 * px} radius={10 * px} fill="#fff" stroke={color} strokeWidth={1.5} strokeScaleEnabled={false} />
            <Text x={tip.x + v.x * 11 * px - 10 * px} y={tip.y + v.y * 11 * px - 6.5 * px} width={20 * px} align="center" text={name.slice(0, 3)} fontSize={12 * px} fontStyle="bold" fill={color} />
          </>
        )}
      </Group>
    );
  };
  return (
    <Group listening={false}>
      <Line points={[line.a.x, line.a.y, line.b.x, line.b.y]} stroke={color} strokeWidth={1.5} dash={[14, 4, 3, 4]} strokeScaleEnabled={false} />
      {end(line.a)}
      {end(line.b)}
    </Group>
  );
}

/** The section lines of the design (on every floor: they cut the whole house). Click one, in the select tool, to open its drawing. */
export function SectionMarks() {
  const sections = useDesign((s) => s.design.sections);
  const layer = useDesign((s) => s.design.layers.notes);
  const tool = useUi((s) => s.tool);
  const zoom = useUi((s) => s.viewport.zoom);
  if (!layer.visible || !sections.length) return null;
  const interactive = tool === 'select';
  return (
    <Group>
      {sections.map((s) => (
        <Group
          key={s.id}
          listening={interactive}
          onMouseDown={(e) => {
            if (e.evt.button !== 0 || input.space) return;
            e.cancelBubble = true;
            const ui = useUi.getState();
            ui.setDrawingOptions({ view: s.id });
            ui.setDialog({ type: 'drawing' });
          }}
          onMouseEnter={(e) => (e.target.getStage()!.container().style.cursor = 'pointer')}
          onMouseLeave={(e) => (e.target.getStage()!.container().style.cursor = '')}
        >
          <Line points={[s.a.x, s.a.y, s.b.x, s.b.y]} stroke="rgba(0,0,0,0.001)" strokeWidth={14} strokeScaleEnabled={false} />
          <SectionShape line={s} name={s.name} zoom={zoom} />
        </Group>
      ))}
    </Group>
  );
}
