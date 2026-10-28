import { Fragment } from 'react';
import { Arrow, Ellipse, Group, Line, Rect, Text } from 'react-konva';
import { isGround, isTerrainZone, planeAt, zonePlane } from '../../terrain';
import type { Gate, Strip, Wall, Zone } from '../../model';
import { RAIL_LOOKS } from '../../stairs';
import { shade } from '../../catalog';
import { formatArea, labelPoint, polygonArea } from '../../geometry';
import { STRIP_STYLES, freeEdges, joinEdges, plotFirst, gateGeometry, gateSpans, pathMarks, samplePolyline, solidSpans, stripColor } from '../../outdoor';
import { useOnFloor } from '../../store/floor';
import { useDesign } from '../../store/design';
import { useSelectedIds, useUi } from '../../store/ui';
import { input } from '../input';
import { pressItem } from '../press';
import { SELECT_COLOR } from '../style';

function pressArea(e: { evt: MouseEvent; cancelBubble: boolean }, kind: 'zone' | 'strip', id: string) {
  if (e.evt.button !== 0 || input.space) return;
  e.cancelBubble = true;
  pressItem(e.evt, { kind, id }, 'area');
}

/** What the plan shows of the lie of the land in an area: its height in the middle and the fall of the ground. */
interface Lie {
  h: number;
  pct: number;
  dir: number;
}

function ZoneShape({ zone, selected, zoom, walls, lie }: { zone: Zone; selected: boolean; zoom: number; walls: Wall[]; lie?: Lie }) {
  const pts = zone.points.flatMap((p) => [p.x, p.y]);
  const plot = zone.kind === 'plot';
  const xs = zone.points.map((p) => p.x);
  const ys = zone.points.map((p) => p.y);
  const big = Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) * zoom > 44;
  const c = labelPoint(zone.points);
  const fs = 13 / zoom;
  const width = 220 / zoom;
  const level = lie && Math.abs(lie.h) >= 0.005 ? `${lie.h > 0 ? '+' : '−'}${Math.abs(lie.h).toFixed(2)} m` : '';
  const fall = lie && lie.pct >= 0.5 ? `${lie.pct % 1 ? lie.pct.toFixed(1) : lie.pct}% ↘` : '';
  const text = `${zone.name || ''}${zone.name ? '\n' : ''}${formatArea(polygonArea(zone.points))}${level ? `\n${level}` : ''}${fall ? ` ${fall}` : ''}`;
  const steep = !!lie && Math.abs(lie.h) > 0.05; // a level change: the retaining wall shows as a heavy line
  const arrow = lie && lie.pct >= 0.5 ? Math.min(2.2, Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) / 3) : 0;
  return (
    <>
      <Line
        points={pts}
        closed
        fill={zone.color}
        stroke={selected ? SELECT_COLOR : plot ? '#6b7280' : steep ? '#57534e' : shade(zone.color, -0.18)}
        strokeWidth={selected ? 2.5 : steep ? 2.5 : 1}
        dash={plot && !selected ? [10, 6] : undefined}
        strokeScaleEnabled={false}
        onMouseDown={(e) => pressArea(e, 'zone', zone.id)}
      />
      {zone.railing && zone.railing !== 'none' && (zone.kind === 'balcony' || zone.kind === 'terrace') && joinEdges(freeEdges(zone, walls)).map((run, i) => <Line key={`rail${i}`} points={run.flatMap((p) => [p.x, p.y])} stroke={RAIL_LOOKS[zone.railing as keyof typeof RAIL_LOOKS].color} strokeWidth={0.06} lineCap="round" lineJoin="round" listening={false} />)}
      {lie && arrow > 0 && big && (
        <Arrow
          points={[c.x - Math.cos((lie.dir * Math.PI) / 180) * arrow * 0.5, c.y - Math.sin((lie.dir * Math.PI) / 180) * arrow * 0.5 - fs * 1.4, c.x + Math.cos((lie.dir * Math.PI) / 180) * arrow * 0.5, c.y + Math.sin((lie.dir * Math.PI) / 180) * arrow * 0.5 - fs * 1.4]}
          stroke="#57534e"
          fill="#57534e"
          strokeWidth={0.05}
          pointerLength={0.25}
          pointerWidth={0.2}
          listening={false}
        />
      )}
      {big && (
        <Text
          x={c.x - width / 2}
          y={c.y - fs * (zone.name ? 1.2 : 0.6)}
          width={width}
          align="center"
          text={text}
          fontSize={fs}
          fontStyle="bold"
          lineHeight={1.25}
          fill="#374151"
          opacity={0.8}
          listening={false}
        />
      )}
    </>
  );
}

/** A gate in a fence or hedge on the plan: its two posts, the leaf (shut) and where it swings or slides when open. */
export function GateShape({ strip, gate, color, ghost, selected, onDown }: { strip: Pick<Strip, 'points' | 'width' | 'kind'>; gate: Gate; color: string; ghost?: boolean; selected?: boolean; onDown?: (e: { evt: MouseEvent; cancelBubble: boolean }) => void }) {
  const g = gateGeometry(strip, gate);
  const post = Math.max(strip.width * 1.6, 0.16);
  const ink = selected ? SELECT_COLOR : '#1f2937';
  const hairline = { strokeScaleEnabled: false, listening: false } as const;
  return (
    <Group opacity={ghost ? 0.75 : 1}>
      {[g.a, g.b].map((p, i) => (
        <Rect key={i} x={p.x - post / 2} y={p.y - post / 2} width={post} height={post} fill={shade(color, -0.35)} listening={false} />
      ))}
      {g.leaves.map((l, i) => {
        const open: number[] = [];
        if (gate.kind !== 'sliding') {
          // the quarter circle the leaf sweeps
          const a0 = Math.atan2(l.shut.y - l.hinge.y, l.shut.x - l.hinge.x);
          let sweep = Math.atan2(l.open.y - l.hinge.y, l.open.x - l.hinge.x) - a0;
          while (sweep > Math.PI) sweep -= 2 * Math.PI;
          while (sweep <= -Math.PI) sweep += 2 * Math.PI;
          const r = Math.hypot(l.shut.x - l.hinge.x, l.shut.y - l.hinge.y);
          for (let k = 0; k <= 12; k++) open.push(l.hinge.x + Math.cos(a0 + (sweep * k) / 12) * r, l.hinge.y + Math.sin(a0 + (sweep * k) / 12) * r);
        } else open.push(l.shut.x, l.shut.y, l.open.x, l.open.y);
        return (
          <Group key={i}>
            <Line points={open} stroke={ink} strokeWidth={1} dash={[4, 3]} {...hairline} />
            <Line points={[l.hinge.x, l.hinge.y, l.shut.x, l.shut.y]} stroke={ink} strokeWidth={Math.max(strip.width * 0.6, 0.05)} lineCap="butt" listening={false} />
          </Group>
        );
      })}
      {onDown && <Line points={[g.a.x, g.a.y, g.b.x, g.b.y]} stroke="rgba(0,0,0,0.001)" strokeWidth={Math.max(strip.width + 0.5, 0.7)} onMouseDown={onDown} />}
    </Group>
  );
}

function StripShape({ strip, selected, zoom }: { strip: Strip; selected: boolean; zoom: number }) {
  const style = STRIP_STYLES[strip.kind];
  const color = stripColor(strip);
  const pts = strip.points.flatMap((p) => [p.x, p.y]);
  const px = 1 / zoom;
  const onDown = (e: Parameters<typeof pressArea>[0]) => pressArea(e, 'strip', strip.id);
  const grab = Math.max(strip.width, 12 * px); // an easy-to-hit invisible band
  const spans = strip.kind === 'fence' || strip.kind === 'hedge' ? solidSpans(strip) : [];
  const marks = strip.kind === 'path' ? pathMarks(strip) : [];
  const stepping = strip.kind === 'path' && strip.surface === 'stepping';
  const joint = shade(color, -0.25);
  return (
    <>
      {selected && <Line points={pts} stroke={SELECT_COLOR} strokeWidth={strip.width + 7 * px} opacity={0.4} lineCap="round" lineJoin="round" listening={false} />}
      {strip.kind === 'road' && (
        <>
          <Line points={pts} stroke={style.color} strokeWidth={strip.width} lineJoin="round" listening={false} />
          <Line points={pts} stroke="#ffffff" strokeWidth={Math.min(0.15, strip.width * 0.03)} dash={[0.9, 0.7]} listening={false} />
        </>
      )}
      {strip.kind === 'path' && !stepping && <Line points={pts} stroke={color} strokeWidth={strip.width} lineJoin="round" listening={false} />}
      {marks.map((m, i) =>
        m.t === 'line' ? (
          <Line key={i} points={m.pts.flatMap((p) => [p.x, p.y])} stroke={joint} strokeWidth={1} strokeScaleEnabled={false} listening={false} />
        ) : (
          <Ellipse key={i} x={m.x} y={m.y} radiusX={m.rx} radiusY={m.ry} rotation={m.rot} fill={stepping ? color : joint} stroke={stepping ? shade(color, -0.3) : undefined} strokeWidth={1} strokeScaleEnabled={false} listening={false} />
        ),
      )}
      {strip.kind === 'hedge' &&
        spans.map((run, i) => {
          const rp = run.flatMap((p) => [p.x, p.y]);
          return (
            <Fragment key={i}>
              <Line points={rp} stroke={shade(style.color, -0.3)} strokeWidth={strip.width + 3 * px} lineCap="round" lineJoin="round" listening={false} />
              <Line points={rp} stroke={style.color} strokeWidth={strip.width} lineCap="round" lineJoin="round" listening={false} />
            </Fragment>
          );
        })}
      {strip.kind === 'fence' &&
        spans.map((run, i) => (
          <Fragment key={i}>
            <Line points={run.flatMap((p) => [p.x, p.y])} stroke={style.color} strokeWidth={Math.max(strip.width * 0.5, 1.5 * px)} listening={false} />
            {samplePolyline(run, 1.5).map((p, k) => (
              <Rect key={k} x={p.x - strip.width} y={p.y - strip.width} width={strip.width * 2} height={strip.width * 2} fill={shade(style.color, -0.25)} listening={false} />
            ))}
          </Fragment>
        ))}
      {spans.length > 0 && gateSpans(strip).map(({ gate }) => <GateShape key={gate.id} strip={strip} gate={gate} color={style.color} selected={selected} onDown={onDown} />)}
      <Line points={pts} stroke="rgba(0,0,0,0.001)" strokeWidth={grab} lineCap="round" lineJoin="round" onMouseDown={onDown} />
    </>
  );
}

/** The height and fall of the ground of an area, when it has any (null for the usual flat ground at level 0). */
function lieOf(zones: Zone[], floors: { id: string; name: string }[], z: Zone): Lie | null {
  const d = { zones, floors };
  if (!isGround(z.kind) || !isTerrainZone(d, z)) return null;
  const pl = zonePlane(d, z);
  const pct = Math.hypot(pl.gx, pl.gy) * 100;
  const h = planeAt(pl, pl.ref);
  if (Math.abs(h) < 0.005 && pct < 0.5) return null;
  return { h, pct, dir: pct < 0.5 ? 0 : ((Math.atan2(-pl.gy, -pl.gx) * 180) / Math.PI + 360) % 360 };
}

export function OutdoorLayer() {
  const zones = useOnFloor((d) => d.zones);
  const allZones = useDesign((s) => s.design.zones);
  const floors = useDesign((s) => s.design.floors);
  const walls = useDesign((s) => s.design.walls);
  const strips = useOnFloor((d) => d.strips);
  const layer = useDesign((s) => s.design.layers.outdoor);
  const tool = useUi((s) => s.tool);
  const zoom = useUi((s) => s.viewport.zoom);
  const zoneIds = useSelectedIds('zone');
  const stripIds = useSelectedIds('strip');
  if (!layer.visible) return null;
  // roads and paths are drawn under hedges and fences
  const rank = (s: Strip) => (s.kind === 'road' ? 0 : s.kind === 'path' ? 1 : 2);
  return (
    <Group listening={tool === 'select' && !layer.locked}>
      {plotFirst(zones).map((z) => (
        <ZoneShape key={z.id} zone={z} zoom={zoom} selected={zoneIds.has(z.id)} walls={walls} lie={lieOf(allZones, floors, z) ?? undefined} />
      ))}
      {[...strips].sort((a, b) => rank(a) - rank(b)).map((s) => (
        <StripShape key={s.id} strip={s} zoom={zoom} selected={stripIds.has(s.id)} />
      ))}
    </Group>
  );
}
