import { Ellipse, Group, Layer, Line, Rect, Text } from 'react-konva';
import type { Furniture } from '../../model';
import { catalogItem, fillColor } from '../../catalog';
import { snapPoint } from '../../geometry';
import { useDesign } from '../../store/design';
import { useUi } from '../../store/ui';
import { input } from '../input';

const OUTLINE = '#475569';

/** The shapes of one furniture symbol in local coordinates (0..w, 0..d). Shared by items and the placement ghost. */
export function SymbolShapes({ type, w, d, color }: { type: string; w: number; d: number; color: string }) {
  const item = catalogItem(type);
  const m = Math.min(w, d);
  const common = { stroke: OUTLINE, strokeWidth: 1, strokeScaleEnabled: false, listening: false } as const;
  return (
    <>
      {item.shapes.map((p, i) => {
        if (p.t === 'rect')
          return (
            <Rect key={i} x={p.x * w} y={p.y * d} width={p.w * w} height={p.h * d} cornerRadius={(p.r ?? 0) * m} fill={fillColor(p.fill, color)} {...common} />
          );
        if (p.t === 'ellipse')
          return (
            <Ellipse key={i} x={(p.x + p.w / 2) * w} y={(p.y + p.h / 2) * d} radiusX={(p.w / 2) * w} radiusY={(p.h / 2) * d} fill={fillColor(p.fill, color)} {...common} />
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
  const furniture = useDesign((s) => s.design.furniture);
  const layer = useDesign((s) => s.design.layers.furniture);
  const tool = useUi((s) => s.tool);
  const zoom = useUi((s) => s.viewport.zoom);
  if (!layer.visible) return null;
  const interactive = tool === 'select' && !layer.locked;

  return (
    <Layer listening={interactive}>
      {furniture.map((f) => (
        <Group
          key={f.id}
          id={f.id}
          x={f.x}
          y={f.y}
          offsetX={f.w / 2}
          offsetY={f.d / 2}
          rotation={f.rotation}
          draggable={interactive}
          onMouseDown={(e) => {
            if (e.evt.button !== 0 || input.space) {
              e.target.stopDrag();
              return;
            }
            e.cancelBubble = true;
            useUi.getState().select({ kind: 'furniture', id: f.id });
          }}
          onDragStart={() => useDesign.getState().beginTx()}
          onDragMove={(e) => {
            const node = e.target;
            let p = { x: node.x(), y: node.y() };
            if (useUi.getState().snap) {
              p = snapPoint(p, useDesign.getState().design.settings.gridStep);
              node.position(p);
            }
            useDesign.getState().update((d) => {
              const item = d.furniture.find((x) => x.id === f.id);
              if (item) {
                item.x = p.x;
                item.y = p.y;
              }
            });
          }}
          onDragEnd={() => useDesign.getState().endTx()}
        >
          <Rect width={f.w} height={f.d} fill="rgba(0,0,0,0.001)" />
          <SymbolShapes type={f.type} w={f.w} d={f.d} color={f.color} />
        </Group>
      ))}
      {furniture.map((f) => {
        const { size, show } = labelFont(f, zoom);
        if (!show) return null;
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
    </Layer>
  );
}
