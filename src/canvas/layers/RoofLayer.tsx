import { useMemo } from 'react';
import { Arrow, Group, Line, Rect } from 'react-konva';
import type { Roof, Skylight } from '../../model';
import { roofBaseHeight, roofPlan, roofUndersideLocal, skylightPlacement } from '../../roofs';
import { Shape } from 'react-konva';
import { useDesign } from '../../store/design';
import { useFloorId, useOnFloor } from '../../store/floor';
import { useSelectedIds, useUi } from '../../store/ui';
import { pressItem } from '../press';
import { input } from '../input';
import { useLook } from '../look';
import { SELECT_COLOR } from '../style';

const flat = (pts: { x: number; y: number }[]) => pts.flatMap((p) => [p.x, p.y]);

/** One roof on the plan: the eaves as a dashed outline, the ridge and hip lines inside. Only the outline can be clicked, so a roof never covers what is under it. */
function RoofShape({ roof, selected }: { roof: Roof; selected: boolean }) {
  const plan = useMemo(() => roofPlan(roof), [roof.kind, roof.w, roof.d, roof.pitch, roof.overhang]); // eslint-disable-line react-hooks/exhaustive-deps
  const look = useLook();
  const stroke = selected ? SELECT_COLOR : look.roofLine(roof.color);
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

/** A skylight on the plan: a small blue window turned to the slope it lies in. */
function SkylightShape({ sky, roofs, selected }: { sky: Skylight; roofs: Roof[]; selected: boolean }) {
  const spot = skylightPlacement(roofs, sky.floor, sky);
  const rotation = spot ? spot.roof.rotation + (spot.flat ? 0 : (Math.atan2(spot.t[2], spot.t[0]) * 180) / Math.PI) : 0;
  // seen from above a sloping window is shorter than it is long
  const length = spot && !spot.flat ? sky.d * Math.hypot(spot.u[0], spot.u[2]) : sky.d;
  const stroke = selected ? SELECT_COLOR : spot ? '#2f5f9e' : '#ef4444';
  return (
    <Group
      x={sky.x}
      y={sky.y}
      rotation={rotation}
      onMouseDown={(e) => {
        if (e.evt.button !== 0 || input.space) return;
        e.cancelBubble = true;
        pressItem(e.evt, { kind: 'skylight', id: sky.id }, 'move');
      }}
    >
      {sky.kind === 'dormer' ? (
        <>
          {/* the little house: its front towards the eaves (down in the symbol), a ridge up the middle */}
          <Rect x={-sky.w / 2} y={0} width={sky.w} height={length} fill="rgba(226,232,240,0.9)" stroke={stroke} strokeWidth={selected ? 2.5 : 1.5} strokeScaleEnabled={false} dash={spot ? undefined : [4, 3]} />
          <Line points={[0, 0, 0, length]} stroke={stroke} strokeWidth={1} strokeScaleEnabled={false} listening={false} />
          <Line points={[-sky.w / 2, 0, sky.w / 2, 0]} stroke={stroke} strokeWidth={3} strokeScaleEnabled={false} listening={false} />
        </>
      ) : sky.kind === 'solar' ? (
        <>
          <Rect x={-sky.w / 2} y={-length / 2} width={sky.w} height={length} fill="rgba(30,58,138,0.75)" stroke={stroke} strokeWidth={selected ? 2.5 : 1.5} strokeScaleEnabled={false} dash={spot ? undefined : [4, 3]} />
          {Array.from({ length: Math.max(0, Math.round(sky.w / 0.5) - 1) }, (_, i) => (
            <Line key={i} points={[-sky.w / 2 + ((i + 1) * sky.w) / Math.round(sky.w / 0.5), -length / 2, -sky.w / 2 + ((i + 1) * sky.w) / Math.round(sky.w / 0.5), length / 2]} stroke="rgba(203,213,225,0.8)" strokeWidth={1} strokeScaleEnabled={false} listening={false} />
          ))}
        </>
      ) : (
        <>
          <Rect x={-sky.w / 2} y={-length / 2} width={sky.w} height={length} fill="rgba(147,197,253,0.6)" stroke={stroke} strokeWidth={selected ? 2.5 : 1.5} strokeScaleEnabled={false} dash={spot ? undefined : [4, 3]} />
          <Line points={[-sky.w / 2, -length / 2, sky.w / 2, length / 2]} stroke={stroke} strokeWidth={1} strokeScaleEnabled={false} listening={false} />
          <Line points={[sky.w / 2, -length / 2, -sky.w / 2, length / 2]} stroke={stroke} strokeWidth={1} strokeScaleEnabled={false} listening={false} />
        </>
      )}
    </Group>
  );
}

/**
 * Seen from the attic: the roof above, with the parts where you cannot stand up shaded (red: under 1 m of room, yellow: under
 * 1.8 m). Not clickable: the roof belongs to the floor below.
 */
function AtticRoof({ roof, lift }: { roof: Roof; lift: number }) {
  const plan = useMemo(() => roofPlan(roof), [roof.kind, roof.w, roof.d, roof.pitch, roof.overhang]); // eslint-disable-line react-hooks/exhaustive-deps
  const look = useLook();
  const stroke = look.roofLine(roof.color);
  return (
    <Group x={roof.x} y={roof.y} rotation={roof.rotation} listening={false}>
      <Shape
        sceneFunc={(ctx) => {
          const cell = 0.2;
          for (let x = -roof.w / 2; x < roof.w / 2; x += cell) {
            for (let z = -roof.d / 2; z < roof.d / 2; z += cell) {
              const under = roofUndersideLocal(roof, x + cell / 2, z + cell / 2);
              if (under === null) continue;
              const room = under - lift;
              if (room >= 1.8) continue;
              ctx.setAttr('fillStyle', room < 1 ? 'rgba(239,68,68,0.28)' : 'rgba(250,204,21,0.22)');
              ctx.fillRect(x, z, cell + 0.005, cell + 0.005);
            }
          }
        }}
      />
      <Line points={flat(plan.footprint)} closed stroke={stroke} strokeWidth={1} opacity={0.5} dash={[2, 4]} strokeScaleEnabled={false} />
      {plan.lines.map((l, i) => (
        <Line key={i} points={flat(l)} stroke={stroke} strokeWidth={1.25} opacity={0.7} strokeScaleEnabled={false} />
      ))}
    </Group>
  );
}

/** Roofs of the floor you are on (a roof belongs to the floor whose walls carry it). */
export function RoofLayer() {
  const roofs = useOnFloor((d) => d.roofs);
  const layer = useDesign((s) => s.design.layers.roofs);
  const tool = useUi((s) => s.tool);
  const ids = useSelectedIds('roof');
  const skylights = useOnFloor((d) => d.skylights);
  const allRoofs = useDesign((s) => s.design.roofs);
  const skyIds = useSelectedIds('skylight');
  const design = useDesign((s) => s.design);
  const active = useFloorId();
  if (!layer.visible) return null;
  // in an attic the roof of the floor below is the ceiling: show it, and where it is too low to stand
  const at = design.floors.findIndex((f) => f.id === active);
  const atticRoofs = at > 0 && design.floors[at].attic ? design.roofs.filter((r) => r.floor === design.floors[at - 1].id) : [];
  const lift = atticRoofs.length ? design.settings.storeyHeight - roofBaseHeight(design, design.floors[at - 1].id) : 0;
  return (
    <Group listening={tool === 'select' && !layer.locked}>
      {atticRoofs.map((r) => (
        <AtticRoof key={`attic-${r.id}`} roof={r} lift={lift} />
      ))}
      {roofs.map((r) => (
        <RoofShape key={r.id} roof={r} selected={ids.has(r.id)} />
      ))}
      {skylights.map((s) => (
        <SkylightShape key={s.id} sky={s} roofs={allRoofs} selected={skyIds.has(s.id)} />
      ))}
      {/* the invisible footprint box the resize handles attach to */}
      {roofs.map((r) => (
        <Rect key={`box-${r.id}`} id={r.id} x={r.x} y={r.y} offsetX={r.w / 2} offsetY={r.d / 2} width={r.w} height={r.d} rotation={r.rotation} listening={false} />
      ))}
    </Group>
  );
}
