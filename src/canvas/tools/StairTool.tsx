import { useRef, useState } from 'react';
import { Group } from 'react-konva';
import type Konva from 'konva';
import { layerBlocksEditing } from '../../actions';
import { newId, type Point } from '../../model';
import { entranceSteps, snapEntrance } from '../../entrance';
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
  const entrance = useUi((s) => s.stairEntrance);
  const base = entrance ? entranceSteps(useDesign.getState().design, hover ?? { x: 0, y: 0 }, floorId()) : null;
  const door = base && hover ? snapEntrance(useDesign.getState().design, hover, floorId(), base) : null; // near a door the steps go to it
  const def = base ? { ...base, w: door?.w ?? base.w } : STAIR_DEFAULTS[kind];

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
      const p0 = snapWorld(world, { ignore: () => true }).p;
      const id = newId();
      // entrance steps next to a door: the spot, turn and width come from the door
      const at = entrance ? snapEntrance(useDesign.getState().design, p0, floorId(), entranceSteps(useDesign.getState().design, p0, floorId())) : null;
      const p = at ? { x: at.x, y: at.y } : p0;
      const turn = at ? at.rotation : rotation;
      const rise = 'rise' in def ? def.rise : useDesign.getState().design.settings.storeyHeight;
      useDesign.getState().update((d) => {
        d.stairs.push({ id, floor: floorId(), kind: entrance ? 'straight' : kind, x: p.x, y: p.y, w: at ? at.w : def.w, d: def.d, rotation: turn, steps: def.steps, rise, flip: false, ...(entrance ? {} : { railing: { style: 'wood' as const, a: true, b: true } }) });
      });
      useUi.getState().setTool('select');
      useUi.getState().select({ kind: 'stair', id });
    },
  });

  return (
    <Group ref={ref} listening={false}>
      {hover && (
        <Group x={door ? door.x : hover.x} y={door ? door.y : hover.y} offsetX={def.w / 2} offsetY={def.d / 2} rotation={door ? door.rotation : rotation} opacity={0.6}>
          <StairShapes shapes={stairShapes({ kind: entrance ? 'straight' : kind, w: def.w, d: def.d, steps: def.steps, flip: false })} />
        </Group>
      )}
    </Group>
  );
}
