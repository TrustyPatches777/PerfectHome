import { Ellipse, Group, Line, Rect, Text } from 'react-konva';
import type { Furniture } from '../../model';
import { catalogItem, catalogLayer, fillColor } from '../../catalog';
import { useDesign } from '../../store/design';
import { useOnFloor } from '../../store/floor';
import { useIsMulti, useSelectedIds, useUi } from '../../store/ui';
import { input } from '../input';
import { pressItem } from '../press';
import { SELECT_COLOR } from '../style';

const OUTLINE = '#475569';

/** The shapes of one furniture symbol in local coordinates (0..w, 0..d). Shared by items and the placement ghost. */
export function SymbolShapes({ type, w, d, color, color2 }: { type: string; w: number; d: number; color: string; color2?: string }) {
  const item = catalogItem(type);
  const m = Math.min(w, d);
  const common = { stroke: OUTLINE, strokeWidth: 1, strokeScaleEnabled: false, listening: false } as const;
  return (
    <>
      {item.shapes.map((p, i) => {
        if (p.t === 'rect')
          return (
            <Rect key={i} x={p.x * w} y={p.y * d} width={p.w * w} height={p.h * d} cornerRadius={(p.r ?? 0) * m} fill={fillColor(p.fill, color, color2)} {...common} />
          );
        if (p.t === 'ellipse')
          return (
            <Ellipse key={i} x={(p.x + p.w / 2) * w} y={(p.y + p.h / 2) * d} radiusX={(p.w / 2) * w} radiusY={(p.h / 2) * d} fill={fillColor(p.fill, color, color2)} {...common} />
          );
        return <Line key={i} points={p.pts.map((v, j) => (j % 2 ? v * d : v * w))} {...common} />;
      })}
    </>
  );
}

/** Font size (meters) for a furniture label, and whether it is big enough on screen to be worth drawing. */
function labelFont(f: Furniture, zoom: number) {
  const size = Math.min(0.2, Math.min(f.w, f.d) * 0.28);
  return { size, show: size * zoom >= 7.5 };
}

export function FurnitureLayer() {
  const furniture = useOnFloor((d) => d.furniture);
  useDesign((s) => s.design.custom); // redraw when a custom item is edited
  const furnitureLayer = useDesign((s) => s.design.layers.furniture);
  const techLayer = useDesign((s) => s.design.layers.tech);
  const tool = useUi((s) => s.tool);
  const zoom = useUi((s) => s.viewport.zoom);
  const selectedIds = useSelectedIds('furniture');
  const multi = useIsMulti();
  const groups = [
    { layer: furnitureLayer, items: furniture.filter((f) => catalogLayer(f.type) === 'furniture') },
    { layer: techLayer, items: furniture.filter((f) => catalogLayer(f.type) === 'tech') },
  ];

  return (
    <>
      {groups.map(({ layer, items }, gi) => {
        if (!layer.visible) return null;
        const interactive = tool === 'select' && !layer.locked;
        return (
          <Group key={gi} listening={interactive}>
            {items.map((f) => (
              <Group
                key={f.id}
                id={f.id}
                x={f.x}
                y={f.y}
                offsetX={f.w / 2}
                offsetY={f.d / 2}
                rotation={f.rotation}
                onMouseDown={(e) => {
                  if (e.evt.button !== 0 || input.space) return;
                  e.cancelBubble = true;
                  pressItem(e.evt, { kind: 'furniture', id: f.id }, 'move');
                }}
              >
                <Rect width={f.w} height={f.d} fill="rgba(0,0,0,0.001)" />
                <SymbolShapes type={f.type} w={f.w} d={f.d} color={f.color} color2={f.color2} />
                {multi && selectedIds.has(f.id) && <Rect width={f.w} height={f.d} stroke={SELECT_COLOR} strokeWidth={2.5} strokeScaleEnabled={false} listening={false} />}
              </Group>
            ))}
            {items.map((f) => {
              const { size, show } = labelFont(f, zoom);
              if (!show || catalogItem(f.type).layer === 'tech') return null; // small symbols carry no text
              const width = Math.max(f.w, f.d, 1.2);
              return (
                <Text
                  key={`l-${f.id}`}
                  x={f.x - width / 2}
                  y={f.y - size * 0.55}
                  width={width}
                  align="center"
                  text={f.label || catalogItem(f.type).label}
                  fontSize={size}
                  fill="#1f2937"
                  opacity={0.85}
                  wrap="none"
                  listening={false}
                />
              );
            })}
          </Group>
        );
      })}
    </>
  );
}
