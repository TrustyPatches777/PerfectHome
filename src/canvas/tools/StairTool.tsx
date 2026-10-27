import { useRef, useState } from 'react';
import { Group } from 'react-konva';
import type Konva from 'konva';
import { layerBlocksEditing } from '../../actions';
import { newId, type Point } from '../../model';
import { STAIR_DEFAULTS, stairShapes } from '../../stairs';
import { useDesign } from '../../store/design';
import { floorId } from '../../store/floor';
import { useUi } from '../../store/ui';
import { isPrimary, snapWorld, useCaptureKeys, useStageEvents } from '../input';
import { StairShapes } from '../layers/StairShapes';

/** Place a staircase: a ghost follows the cursor, R rotates it, click drops it. */
export function StairTool() {
  const ref = useRef<Konva.Group>(null);
  const kind = useUi((s) => s.stairKind);
  const rotation = useUi((s) => s.placingRotation);
  const [hover, setHover] = useState<Point | null>(null);
  const def = STAIR_DEFAULTS[kind];

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
      if (!isPrimary(e) || layerBlocksEditing('stair')) return;
      const p = snapWorld(world, { ignore: () => true }).p;
      const id = newId();
      const rise = useDesign.getState().design.settings.storeyHeight;
      useDesign.getState().update((d) => {
        d.stairs.push({ id, floor: floorId(), kind, x: p.x, y: p.y, w: def.w, d: def.d, rotation, steps: def.steps, rise, flip: false, railing: { style: 'wood', a: true, b: true } });
      });
      useUi.getState().setTool('select');
      useUi.getState().select({ kind: 'stair', id });
    },
  });

  return (
    <Group ref={ref} listening={false}>
      {hover && (
        <Group x={hover.x} y={hover.y} offsetX={def.w / 2} offsetY={def.d / 2} rotation={rotation} opacity={0.6}>
          <StairShapes shapes={stairShapes({ kind, w: def.w, d: def.d, steps: def.steps, flip: false })} />
        </Group>
      )}
    </Group>
  );
}
