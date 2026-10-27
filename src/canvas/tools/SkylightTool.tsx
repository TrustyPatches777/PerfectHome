import { useRef, useState } from 'react';
import { Group, Rect } from 'react-konva';
import type Konva from 'konva';
import { layerBlocksEditing } from '../../actions';
import type { Point } from '../../model';
import { SKYLIGHT_SIZES, addSkylight } from '../../roofActions';
import { roofAt } from '../../roofs';
import { useDesign } from '../../store/design';
import { floorId } from '../../store/floor';
import { useUi } from '../../store/ui';
import { isPrimary, snapWorld, useStageEvents } from '../input';

/** Put a skylight on a roof: click on the roof where the window should be. */
export function SkylightTool() {
  const ref = useRef<Konva.Group>(null);
  const size = SKYLIGHT_SIZES[useUi((s) => s.skylightSize)] ?? SKYLIGHT_SIZES[1];
  const [hover, setHover] = useState<Point | null>(null);
  const roof = hover ? roofAt(useDesign.getState().design.roofs, floorId(), hover) : null;

  useStageEvents(ref, {
    mousemove: (_e, world) => setHover(snapWorld(world, { ignore: () => true }).p),
    mousedown: (e, world) => {
      if (!isPrimary(e) || layerBlocksEditing('skylight')) return;
      const p = snapWorld(world, { ignore: () => true }).p;
      if (addSkylight(p, size) && !e.evt.shiftKey) useUi.getState().setTool('select');
    },
  });

  return (
    <Group ref={ref} listening={false}>
      {hover && roof && (
        <Group x={hover.x} y={hover.y} rotation={roof.rotation}>
          <Rect x={-size.w / 2} y={-size.d / 2} width={size.w} height={size.d} fill="rgba(147,197,253,0.5)" stroke="#2f6fed" strokeWidth={2} strokeScaleEnabled={false} dash={[5, 3]} />
        </Group>
      )}
    </Group>
  );
}
