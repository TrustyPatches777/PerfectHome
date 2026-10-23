import { Group, Line, Rect, Text } from 'react-konva';
import type { Point, TextLabel } from '../../model';
import { dist, formatLength, snapPoint } from '../../geometry';
import { useDesign } from '../../store/design';
import { useOnFloor } from '../../store/floor';
import { useUi } from '../../store/ui';
import { dragSession, input } from '../input';
import { SELECT_COLOR } from '../style';

const DIM_COLOR = '#0f766e';

/** Rough text size in meters: good enough for centering and hit areas without measuring fonts. */
export function labelBox(l: Pick<TextLabel, 'text' | 'size'>) {
  const lines = l.text.split('\n');
  const chars = Math.max(1, ...lines.map((s) => s.length));
  return { w: chars * l.size * 0.62 + l.size * 0.4, h: lines.length * l.size * 1.25 };
}

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
        useUi.getState().select({ kind: 'dimension', id });
        const a0 = { ...a };
        const b0 = { ...b };
        dragSession(e.evt, (world, start) => {
          const step = useDesign.getState().design.settings.gridStep;
          const moved = { x: a0.x + world.x - start.x, y: a0.y + world.y - start.y };
          const t = useUi.getState().snap ? snapPoint(moved, step) : moved;
          const dx = t.x - a0.x;
          const dy = t.y - a0.y;
          useDesign.getState().update((d) => {
            const m = d.dimensions.find((x) => x.id === id);
            if (m) {
              m.a = { x: a0.x + dx, y: a0.y + dy };
              m.b = { x: b0.x + dx, y: b0.y + dy };
            }
          });
        });
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
  const sel = useUi((s) => s.selection);
  if (!layer.visible) return null;
  const interactive = tool === 'select' && !layer.locked;

  return (
    <Group listening={interactive}>
      {dimensions.map((m) => (
        <DimensionShape key={m.id} id={m.id} a={m.a} b={m.b} zoom={zoom} selected={sel?.kind === 'dimension' && sel.id === m.id} interactive={interactive} />
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
            draggable={interactive}
            onMouseDown={(e) => {
              if (e.evt.button !== 0 || input.space) {
                e.target.stopDrag();
                return;
              }
              e.cancelBubble = true;
              useUi.getState().select({ kind: 'label', id: l.id });
            }}
            onDblClick={() => useUi.getState().requestTextFocus()}
            onDragStart={() => useDesign.getState().beginTx()}
            onDragMove={(e) => {
              const node = e.target;
              let p = { x: node.x(), y: node.y() };
              if (useUi.getState().snap) {
                p = snapPoint(p, useDesign.getState().design.settings.gridStep);
                node.position(p);
              }
              useDesign.getState().update((d) => {
                const item = d.labels.find((x) => x.id === l.id);
                if (item) {
                  item.x = p.x;
                  item.y = p.y;
                }
              });
            }}
            onDragEnd={() => useDesign.getState().endTx()}
          >
            <Rect x={-box.w / 2} y={-box.h / 2} width={box.w} height={box.h} fill="rgba(0,0,0,0.001)" />
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
