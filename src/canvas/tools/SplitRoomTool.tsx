import { useRef, useState } from 'react';
import { Circle, Group, Line } from 'react-konva';
import type Konva from 'konva';
import type { Point } from '../../model';
import { splitRoom } from '../../roomEdit';
import { useDesign } from '../../store/design';
import { useUi } from '../../store/ui';
import { isPrimary, snapWorld, useStageEvents } from '../input';

/** Cut a room in two: click where the line starts and where it ends (the line goes on through the whole room). */
export function SplitRoomTool() {
  const ref = useRef<Konva.Group>(null);
  const [from, setFrom] = useState<Point | null>(null);
  const [hover, setHover] = useState<Point | null>(null);
  const roomId = useUi((s) => s.splitRoomId);

  useStageEvents(ref, {
    mousemove: (_e, world) => setHover(snapWorld(world, { ignore: () => true }).p),
    mousedown: (e, world) => {
      if (!isPrimary(e)) return;
      const p = snapWorld(world, { ignore: () => true }).p;
      if (!from) return setFrom(p);
      if (Math.hypot(p.x - from.x, p.y - from.y) < 0.1) return;
      let made: string | null = null;
      if (roomId) useDesign.getState().update((d) => void (made = splitRoom(d, roomId, from, p)));
      const ui = useUi.getState();
      if (!made) ui.showToast('That line does not cut the room into two real pieces. Draw it across the room.');
      else {
        ui.setTool('select');
        ui.select({ kind: 'room', id: made });
      }
      setFrom(null);
    },
  });

  return (
    <Group ref={ref} listening={false}>
      {from && <Circle x={from.x} y={from.y} radius={5} fill="#ef4444" scaleX={1} listening={false} />}
      {from && hover && <Line points={[from.x, from.y, hover.x, hover.y]} stroke="#ef4444" strokeWidth={2} dash={[8, 5]} strokeScaleEnabled={false} />}
    </Group>
  );
}
