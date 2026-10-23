import { useRef, useState } from 'react';
import { Group } from 'react-konva';
import type Konva from 'konva';
import { catalogItem } from '../../catalog';
import { newId, type Point } from '../../model';
import { useDesign } from '../../store/design';
import { useUi } from '../../store/ui';
import { isPrimary, snapWorld, useCaptureKeys, useStageEvents } from '../input';
import { SymbolShapes } from '../layers/FurnitureLayer';

/** Place furniture: a ghost follows the cursor; click to drop it (Shift+click keeps placing more). */
export function FurnitureTool() {
  const ref = useRef<Konva.Group>(null);
  const placing = useUi((s) => s.placing);
  const rotation = useUi((s) => s.placingRotation);
  const [hover, setHover] = useState<Point | null>(null);
  const item = placing ? catalogItem(placing) : null;

  useCaptureKeys((e) => {
    if (e.key.toLowerCase() === 'r' && !e.ctrlKey && !e.metaKey) {
      useUi.getState().setPlacingRotation((rotation + (e.shiftKey ? 270 : 90)) % 360);
      return true;
    }
    return false;
  });

  useStageEvents(ref, {
    mousemove: (_e, world) => setHover(snapWorld(world, { ignore: () => true }).p),
    mousedown: (e, world) => {
      if (!isPrimary(e) || !item) return;
      const p = snapWorld(world, { ignore: () => true }).p;
      const id = newId();
      useDesign.getState().update((d) => {
        d.furniture.push({ id, type: item.type, x: p.x, y: p.y, w: item.w, d: item.d, rotation, color: item.color, label: '' });
      });
      if (!e.evt.shiftKey) {
        useUi.getState().setTool('select');
        useUi.getState().select({ kind: 'furniture', id });
      }
    },
  });

  return (
    <Group ref={ref} listening={false}>
      {item && hover && (
        <Group x={hover.x} y={hover.y} offsetX={item.w / 2} offsetY={item.d / 2} rotation={rotation} opacity={0.6}>
          <SymbolShapes type={item.type} w={item.w} d={item.d} color={item.color} />
        </Group>
      )}
    </Group>
  );
}
