import { useRef } from 'react';
import { Group } from 'react-konva';
import type Konva from 'konva';
import { layerBlocksEditing } from '../../actions';
import { newId } from '../../model';
import { useDesign } from '../../store/design';
import { floorId } from '../../store/floor';
import { useUi } from '../../store/ui';
import { isPrimary, snapWorld, useStageEvents } from '../input';

/** Click anywhere to drop a text label, then type its text in the properties panel. */
export function TextTool() {
  const ref = useRef<Konva.Group>(null);
  useStageEvents(ref, {
    mousedown: (e, world) => {
      if (!isPrimary(e) || layerBlocksEditing('label')) return;
      const p = snapWorld(world, { ignore: () => true }).p;
      const id = newId();
      useDesign.getState().update((d) => {
        d.labels.push({ id, floor: floorId(), text: 'Text', x: p.x, y: p.y, size: 0.25, rotation: 0, color: '#1f2937' });
      });
      const ui = useUi.getState();
      ui.setTool('select');
      ui.select({ kind: 'label', id });
      ui.requestTextFocus();
    },
  });
  return <Group ref={ref} listening={false} />;
}
