import { useRef } from 'react';
import { Group } from 'react-konva';
import type Konva from 'konva';
import { layerBlocksEditing } from '../../actions';
import { newId } from '../../model';
import { useDesign } from '../../store/design';
import { floorId } from '../../store/floor';
import { useUi } from '../../store/ui';
import { isPrimary, snapWorld, useStageEvents } from '../input';

/** Click on the plan to leave a sticky note there (signed with your name and color). */
export function NoteTool() {
  const ref = useRef<Konva.Group>(null);
  useStageEvents(ref, {
    mousedown: (e, world) => {
      if (!isPrimary(e) || layerBlocksEditing('note')) return;
      const ui = useUi.getState();
      const me = ui.me;
      if (!me) {
        // nobody has said who they are yet: ask first, the note is placed afterwards
        ui.setDialog({ type: 'identity', then: { x: world.x, y: world.y } });
        return;
      }
      createNote(world.x, world.y);
    },
  });
  return <Group ref={ref} listening={false} />;
}

/** Add a sticky note signed by the current person, select it and focus its text box. */
export function createNote(x: number, y: number) {
  const ui = useUi.getState();
  if (!ui.me) return;
  const p = snapWorld({ x, y }, { ignore: () => true }).p;
  const id = newId();
  const me = ui.me;
  useDesign.getState().update((d) => {
    d.notes.push({ id, floor: floorId(), x: p.x, y: p.y, text: '', author: me.name, color: me.color, time: Date.now(), done: false });
  });
  ui.setTool('select');
  ui.select({ kind: 'note', id });
  ui.requestTextFocus();
}
