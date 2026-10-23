import { Group, Line, Rect, Text } from 'react-konva';
import type { Strip, Zone } from '../../model';
import { shade } from '../../catalog';
import { formatArea, labelPoint, polygonArea } from '../../geometry';
import { STRIP_STYLES, samplePolyline } from '../../outdoor';
import { useOnFloor } from '../../store/floor';
import { useDesign } from '../../store/design';
import { useUi } from '../../store/ui';
import { startPan } from '../camera';
import { startPolyMove } from '../editing';
import { input } from '../input';
import { SELECT_COLOR } from '../style';

/**
 * Press on a zone/strip: if it is already selected, drag moves it; otherwise a click selects it and a drag
 * pans the plan (big lawns and plots would otherwise trap the mouse).
 */
function pressArea(e: { evt: MouseEvent; cancelBubble: boolean }, kind: 'zone' | 'strip', id: string, selected: boolean) {
  if (e.evt.button !== 0 || input.space) return;
  e.cancelBubble = true;
  if (selected) startPolyMove(e.evt, kind, id);
  else startPan(e.evt.clientX, e.evt.clientY, () => useUi.getState().select({ kind, id }));
}

function ZoneShape({ zone, selected, zoom }: { zone: Zone; selected: boolean; zoom: number }) {
  const pts = zone.points.flatMap((p) => [p.x, p.y]);
  const plot = zone.kind === 'plot';
  const xs = zone.points.map((p) => p.x);
  const ys = zone.points.map((p) => p.y);
  const big = Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) * zoom > 44;
  const c = labelPoint(zone.points);
  const fs = 13 / zoom;
  const width = 220 / zoom;
  const text = `${zone.name || ''}${zone.name ? '\n' : ''}${formatArea(polygonArea(zone.points))}`;
  return (
    <>
      <Line
        points={pts}
        closed
        fill={zone.color}
        stroke={selected ? SELECT_COLOR : plot ? '#6b7280' : shade(zone.color, -0.18)}
        strokeWidth={selected ? 2.5 : 1}
        dash={plot && !selected ? [10, 6] : undefined}
        strokeScaleEnabled={false}
        onMouseDown={(e) => pressArea(e, 'zone', zone.id, selected)}
      />
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

function StripShape({ strip, selected, zoom }: { strip: Strip; selected: boolean; zoom: number }) {
  const style = STRIP_STYLES[strip.kind];
  const pts = strip.points.flatMap((p) => [p.x, p.y]);
  const px = 1 / zoom;
  const onDown = (e: Parameters<typeof pressArea>[0]) => pressArea(e, 'strip', strip.id, selected);
  const grab = Math.max(strip.width, 12 * px); // an easy-to-hit invisible band
  return (
    <>
      {selected && <Line points={pts} stroke={SELECT_COLOR} strokeWidth={strip.width + 7 * px} opacity={0.4} lineCap="round" lineJoin="round" listening={false} />}
      {strip.kind === 'road' && (
        <>
          <Line points={pts} stroke={style.color} strokeWidth={strip.width} lineJoin="round" listening={false} />
          <Line points={pts} stroke="#ffffff" strokeWidth={Math.min(0.15, strip.width * 0.03)} dash={[0.9, 0.7]} listening={false} />
        </>
      )}
      {strip.kind === 'path' && <Line points={pts} stroke={style.color} strokeWidth={strip.width} lineJoin="round" listening={false} />}
      {strip.kind === 'hedge' && (
        <>
          <Line points={pts} stroke={shade(style.color, -0.3)} strokeWidth={strip.width + 3 * px} lineCap="round" lineJoin="round" listening={false} />
          <Line points={pts} stroke={style.color} strokeWidth={strip.width} lineCap="round" lineJoin="round" listening={false} />
        </>
      )}
      {strip.kind === 'fence' && (
        <>
          <Line points={pts} stroke={style.color} strokeWidth={Math.max(strip.width * 0.5, 1.5 * px)} listening={false} />
          {samplePolyline(strip.points, 1.5).map((p, i) => (
            <Rect key={i} x={p.x - strip.width} y={p.y - strip.width} width={strip.width * 2} height={strip.width * 2} fill={shade(style.color, -0.25)} listening={false} />
          ))}
        </>
      )}
      <Line points={pts} stroke="rgba(0,0,0,0.001)" strokeWidth={grab} lineCap="round" lineJoin="round" onMouseDown={onDown} />
    </>
  );
}

export function OutdoorLayer() {
  const zones = useOnFloor((d) => d.zones);
  const strips = useOnFloor((d) => d.strips);
  const layer = useDesign((s) => s.design.layers.outdoor);
  const tool = useUi((s) => s.tool);
  const zoom = useUi((s) => s.viewport.zoom);
  const sel = useUi((s) => s.selection);
  if (!layer.visible) return null;
  // roads and paths are drawn under hedges and fences
  const rank = (s: Strip) => (s.kind === 'road' ? 0 : s.kind === 'path' ? 1 : 2);
  return (
    <Group listening={tool === 'select' && !layer.locked}>
      {zones.map((z) => (
        <ZoneShape key={z.id} zone={z} zoom={zoom} selected={sel?.kind === 'zone' && sel.id === z.id} />
      ))}
      {[...strips].sort((a, b) => rank(a) - rank(b)).map((s) => (
        <StripShape key={s.id} strip={s} zoom={zoom} selected={sel?.kind === 'strip' && sel.id === s.id} />
      ))}
    </Group>
  );
}
