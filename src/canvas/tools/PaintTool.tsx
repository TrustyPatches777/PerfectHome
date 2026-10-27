import { useRef, useState } from 'react';
import { Group, Line } from 'react-konva';
import type Konva from 'konva';
import { layerBlocksEditing } from '../../actions';
import { nearestWall, wallLength } from '../../geometry';
import type { Point, Wall } from '../../model';
import { useDesign } from '../../store/design';
import { floorId } from '../../store/floor';
import { useUi } from '../../store/ui';
import { wallFaceLine } from '../../walls';
import { isPrimary, useStageEvents } from '../input';

/** Which face of the wall is nearest to a point, and the wall. */
function faceAt(p: Point, reach: number): { wall: Wall; side: 'l' | 'r' } | null {
  const floor = floorId();
  const hit = nearestWall(p, useDesign.getState().design.walls.filter((w) => w.floor === floor), reach);
  return hit ? { wall: hit.wall, side: hit.d >= 0 ? 'r' : 'l' } : null;
}

/** Paint walls: click the face you want to cover (Shift: both faces). The color and covering are chosen above the plan. */
export function PaintTool() {
  const ref = useRef<Konva.Group>(null);
  const zoom = useUi((s) => s.viewport.zoom);
  const finish = useUi((s) => s.paintFinish);
  const color = useUi((s) => s.paintColor);
  const [hover, setHover] = useState<{ wall: Wall; side: 'l' | 'r' } | null>(null);
  const reach = Math.max(0.35, 14 / zoom);

  useStageEvents(ref, {
    mousemove: (_e, world) => setHover(faceAt(world, reach)),
    mousedown: (e, world) => {
      if (!isPrimary(e) || layerBlocksEditing('wall')) return;
      const hit = faceAt(world, reach);
      if (!hit) return;
      const sides: ('l' | 'r')[] = e.evt.shiftKey ? ['l', 'r'] : [hit.side];
      useDesign.getState().update((d) => {
        const w = d.walls.find((x) => x.id === hit.wall.id);
        if (!w) return;
        for (const side of sides) {
          if (finish === 'clear') {
            if (w.paint) delete w.paint[side];
            if (w.paint && !w.paint.l && !w.paint.r) delete w.paint;
          } else w.paint = { ...w.paint, [side]: { finish, color } };
        }
      });
    },
  });

  const px = 1 / zoom;
  return (
    <Group ref={ref} listening={false}>
      {hover &&
        (['l', 'r'] as const)
          .filter((s) => s === hover.side)
          .map((s) => (
            <Line key={s} points={wallFaceLine(hover.wall, 0, wallLength(hover.wall), s, 0).flatMap((p) => [p.x, p.y])} stroke={finish === 'clear' ? '#ef4444' : color} opacity={0.75} strokeWidth={Math.max(hover.wall.thickness * 0.5, 5 * px)} lineCap="round" />
          ))}
    </Group>
  );
}
