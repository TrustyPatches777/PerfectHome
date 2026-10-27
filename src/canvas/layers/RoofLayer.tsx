import { useMemo } from 'react';
import { Arrow, Group, Line, Rect } from 'react-konva';
import { shade } from '../../catalog';
import type { Roof } from '../../model';
import { roofPlan } from '../../roofs';
import { useDesign } from '../../store/design';
import { useOnFloor } from '../../store/floor';
import { useSelectedIds, useUi } from '../../store/ui';
import { pressItem } from '../press';
import { input } from '../input';
import { SELECT_COLOR } from '../style';

const flat = (pts: { x: number; y: number }[]) => pts.flatMap((p) => [p.x, p.y]);

/** One roof on the plan: the eaves as a dashed outline, the ridge and hip lines inside. Only the outline can be clicked, so a roof never covers what is under it. */
function RoofShape({ roof, selected }: { roof: Roof; selected: boolean }) {
  const plan = useMemo(() => roofPlan(roof), [roof.kind, roof.w, roof.d, roof.pitch, roof.overhang]); // eslint-disable-line react-hooks/exhaustive-deps
  const stroke = selected ? SELECT_COLOR : shade(roof.color, -0.15);
  const thin = { strokeScaleEnabled: false, listening: false } as const;
  return (
    <Group x={roof.x} y={roof.y} rotation={roof.rotation}>
      <Line
        points={flat(plan.outline)}
        closed
        stroke={stroke}
        strokeWidth={selected ? 2.5 : 1.75}
        dash={[10, 6]}
        strokeScaleEnabled={false}
        fillEnabled={false}
        hitStrokeWidth={14}
        onMouseDown={(e) => {
          if (e.evt.button !== 0 || input.space) return;
          e.cancelBubble = true;
          pressItem(e.evt, { kind: 'roof', id: roof.id }, 'move');
        }}
      />
      <Line points={flat(plan.footprint)} closed stroke={stroke} strokeWidth={1} opacity={0.4} dash={[2, 4]} {...thin} />
      {plan.lines.map((l, i) => (
        <Line key={i} points={flat(l)} stroke={stroke} strokeWidth={1.25} opacity={0.85} {...thin} />
      ))}
      {plan.fall && <Arrow points={flat(plan.fall)} stroke={stroke} fill={stroke} strokeWidth={1.25} pointerLength={0.3} pointerWidth={0.25} {...thin} />}
    </Group>
  );
}

/** Roofs of the floor you are on (a roof belongs to the floor whose walls carry it). */
export function RoofLayer() {
  const roofs = useOnFloor((d) => d.roofs);
  const layer = useDesign((s) => s.design.layers.roofs);
  const tool = useUi((s) => s.tool);
  const ids = useSelectedIds('roof');
  if (!layer.visible) return null;
  return (
    <Group listening={tool === 'select' && !layer.locked}>
      {roofs.map((r) => (
        <RoofShape key={r.id} roof={r} selected={ids.has(r.id)} />
      ))}
      {/* the invisible footprint box the resize handles attach to */}
      {roofs.map((r) => (
        <Rect key={`box-${r.id}`} id={r.id} x={r.x} y={r.y} offsetX={r.w / 2} offsetY={r.d / 2} width={r.w} height={r.d} rotation={r.rotation} listening={false} />
      ))}
    </Group>
  );
}
