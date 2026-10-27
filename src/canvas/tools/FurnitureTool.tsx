import { useRef, useState } from 'react';
import { Group } from 'react-konva';
import type Konva from 'konva';
import { layerBlocksEditing } from '../../actions';
import { catalogItem, catalogLayer } from '../../catalog';
import { settledPosition } from '../../fit';
import { mountOnWall } from '../../mount';
import { newId, type Point } from '../../model';
import { useDesign } from '../../store/design';
import { floorId } from '../../store/floor';
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

  /** Where and how the item would be placed for a cursor position: against a wall for wall-mounted symbols. */
  const placeAt = (world: Point): { x: number; y: number; rotation: number } => {
    if (item?.wallMounted) {
      const floor = floorId();
      const walls = useDesign.getState().design.walls.filter((w) => w.floor === floor);
      const step = useUi.getState().snap ? useDesign.getState().design.settings.gridStep : 0;
      const m = mountOnWall(world, walls, item.d, 0.6, step);
      if (m) return m;
    }
    const p = snapWorld(world, { ignore: () => true }).p;
    // pushed out of walls, like the real thing will be
    if (item) {
      const probe = { id: '', floor: floorId(), type: item.type, x: p.x, y: p.y, w: item.w, d: item.d, rotation, color: '', label: '' };
      const spot = settledPosition(useDesign.getState().design, probe);
      if (spot) return { x: spot.x, y: spot.y, rotation };
    }
    return { x: p.x, y: p.y, rotation };
  };


  useCaptureKeys((e) => {
    if (e.key.toLowerCase() === 'r' && !e.ctrlKey && !e.metaKey) {
      useUi.getState().setPlacingRotation((rotation + (e.shiftKey ? 270 : 90)) % 360);
      return true;
    }
    return false;
  });

  useStageEvents(ref, {
    mousemove: (_e, world) => setHover(world),
    mousedown: (e, world) => {
      if (!isPrimary(e) || !item || layerBlocksEditing(catalogLayer(item.type))) return;
      const at = placeAt(world);
      const id = newId();
      useDesign.getState().update((d) => {
        d.furniture.push({ id, floor: floorId(), type: item.type, x: at.x, y: at.y, w: item.w, d: item.d, rotation: at.rotation, color: item.color, label: '' });
      });
      const placed = useDesign.getState().design.furniture.some((f) => f.id === id); // not when it did not fit between the walls
      if (!e.evt.shiftKey && placed) {
        useUi.getState().setTool('select');
        useUi.getState().select({ kind: 'furniture', id });
      }
    },
  });

  return (
    <Group ref={ref} listening={false}>
      {item && hover && (
        <Group x={placeAt(hover).x} y={placeAt(hover).y} offsetX={item.w / 2} offsetY={item.d / 2} rotation={placeAt(hover).rotation} opacity={0.6}>
          <SymbolShapes type={item.type} w={item.w} d={item.d} color={item.color} />
        </Group>
      )}
    </Group>
  );
}
