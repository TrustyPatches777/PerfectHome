import { Group, Line, Rect, Text } from 'react-konva';
import type { Point } from '../../model';
import { dist, formatLength, textBox as labelBox } from '../../geometry';
import { useDesign } from '../../store/design';
import { useOnFloor } from '../../store/floor';
import { useIsMulti, useSelectedIds, useUi } from '../../store/ui';
import { input } from '../input';
import { pressItem } from '../press';
import { SELECT_COLOR } from '../style';

const DIM_COLOR = '#0f766e';


/** A dimension line with end ticks and the length written alongside it. Also used as the measure-tool preview. */
export function DimensionShape({ a, b, zoom, selected, id, interactive }: { a: Point; b: Point; zoom: number; selected?: boolean; id?: string; interactive?: boolean }) {
  const px = 1 / zoom;
  const len = dist(a, b);
  if (len < 1e-6) return null;
  const ux = (b.x - a.x) / len;
  const uy = (b.y - a.y) / len;
  let nx = -uy;
  let ny = ux;
  if (ny > 0) {
    nx = -nx;
    ny = -ny; // always put the label above the line
  }
  const tick = 6 * px;
  const color = selected ? SELECT_COLOR : DIM_COLOR;
  let angle = (Math.atan2(uy, ux) * 180) / Math.PI;
  if (angle > 90 || angle < -90) angle += 180;
  const text = formatLength(len);
  const fs = 12 * px;
  const tw = text.length * fs * 0.62 + 8 * px;
  const mid = { x: (a.x + b.x) / 2 + nx * 11 * px, y: (a.y + b.y) / 2 + ny * 11 * px };
  return (
    <Group
      listening={!!interactive}
      onMouseDown={(e) => {
        if (!id || e.evt.button !== 0 || input.space) return;
        e.cancelBubble = true;
        pressItem(e.evt, { kind: 'dimension', id }, 'move');
      }}
    >
      <Line points={[a.x, a.y, b.x, b.y]} stroke="rgba(0,0,0,0.001)" strokeWidth={14} strokeScaleEnabled={false} />
      <Line points={[a.x, a.y, b.x, b.y]} stroke={color} strokeWidth={1.5} strokeScaleEnabled={false} listening={false} />
      <Line points={[a.x - nx * tick, a.y - ny * tick, a.x + nx * tick, a.y + ny * tick]} stroke={color} strokeWidth={1.5} strokeScaleEnabled={false} listening={false} />
      <Line points={[b.x - nx * tick, b.y - ny * tick, b.x + nx * tick, b.y + ny * tick]} stroke={color} strokeWidth={1.5} strokeScaleEnabled={false} listening={false} />
      <Group x={mid.x} y={mid.y} rotation={angle} listening={false}>
        <Rect x={-tw / 2} y={-fs * 0.65} width={tw} height={fs * 1.3} fill="rgba(255,255,255,0.85)" cornerRadius={2 * px} />
        <Text x={-tw / 2} y={-fs * 0.55} width={tw} align="center" text={text} fontSize={fs} fontStyle="bold" fill={color} />
      </Group>
    </Group>
  );
}

export function NotesLayer() {
  const labels = useOnFloor((d) => d.labels);
  const dimensions = useOnFloor((d) => d.dimensions);
  const layer = useDesign((s) => s.design.layers.notes);
  const tool = useUi((s) => s.tool);
  const zoom = useUi((s) => s.viewport.zoom);
  const dimIds = useSelectedIds('dimension');
  const labelIds = useSelectedIds('label');
  const multi = useIsMulti();
  if (!layer.visible) return null;
  const interactive = tool === 'select' && !layer.locked;

  return (
    <Group listening={interactive}>
      {dimensions.map((m) => (
        <DimensionShape key={m.id} id={m.id} a={m.a} b={m.b} zoom={zoom} selected={dimIds.has(m.id)} interactive={interactive} />
      ))}
      {labels.map((l) => {
        const box = labelBox(l);
        return (
          <Group
            key={l.id}
            id={l.id}
            x={l.x}
            y={l.y}
            rotation={l.rotation}
            onMouseDown={(e) => {
              if (e.evt.button !== 0 || input.space) return;
              e.cancelBubble = true;
              pressItem(e.evt, { kind: 'label', id: l.id }, 'move');
            }}
            onDblClick={() => useUi.getState().requestTextFocus()}
          >
            <Rect x={-box.w / 2} y={-box.h / 2} width={box.w} height={box.h} fill="rgba(0,0,0,0.001)" stroke={multi && labelIds.has(l.id) ? SELECT_COLOR : undefined} strokeWidth={2} strokeScaleEnabled={false} />
            <Text
              x={-box.w / 2}
              y={-box.h / 2}
              width={box.w}
              height={box.h}
              align="center"
              verticalAlign="middle"
              text={l.text}
              fontSize={l.size}
              lineHeight={1.25}
              fill={l.color}
              wrap="none"
              listening={false}
            />
          </Group>
        );
      })}
    </Group>
  );
}
