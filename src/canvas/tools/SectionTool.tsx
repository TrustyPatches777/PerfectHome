import { useRef, useState } from 'react';
import { Circle, Group } from 'react-konva';
import type Konva from 'konva';
import { dist } from '../../geometry';
import { newId, type Point } from '../../model';
import { useDesign } from '../../store/design';
import { useUi } from '../../store/ui';
import { isPrimary, snapWorld, useCaptureKeys, useStageEvents } from '../input';
import { SectionShape } from '../layers/SectionMarks';
import { SELECT_COLOR } from '../style';

/** The next free letter for a section line: A, B, C ... then A2, B2 ... */
export function nextSectionName(names: string[]): string {
  const taken = new Set(names);
  for (let round = 0; ; round++) {
    for (let i = 0; i < 26; i++) {
      const n = String.fromCharCode(65 + i) + (round ? String(round + 1) : '');
      if (!taken.has(n)) return n;
    }
  }
}

/** Click where the cut begins and where it ends; the house is cut open along that line and the drawing opens (Section tool). Esc cancels. */
export function SectionTool() {
  const ref = useRef<Konva.Group>(null);
  const zoom = useUi((s) => s.viewport.zoom);
  const [start, setStart] = useState<Point | null>(null);
  const [hover, setHover] = useState<Point | null>(null);

  useStageEvents(ref, {
    mousemove: (_e, world) => setHover(snapWorld(world, { faces: true }).p),
    mousedown: (e, world) => {
      if (!isPrimary(e)) return;
      const p = snapWorld(world, { faces: true }).p;
      if (!start) return setStart(p);
      if (dist(start, p) < 0.3) return;
      const id = newId();
      useDesign.getState().update((d) => void d.sections.push({ id, name: nextSectionName(d.sections.map((s) => s.name)), a: { ...start }, b: { ...p } }));
      setStart(null);
      const ui = useUi.getState();
      ui.setDrawingOptions({ view: id });
      ui.setTool('select');
      ui.setDialog({ type: 'drawing' });
    },
  });

  useCaptureKeys((e) => {
    if (start && e.key === 'Escape') {
      setStart(null);
      return true;
    }
    return false;
  });

  const px = 1 / zoom;
  return (
    <Group ref={ref} listening={false}>
      {start && hover && dist(start, hover) > 0.05 && <SectionShape line={{ a: start, b: hover }} name="" zoom={zoom} color={SELECT_COLOR} />}
      {start && <Circle x={start.x} y={start.y} radius={4 * px} fill={SELECT_COLOR} />}
      {hover && <Circle x={hover.x} y={hover.y} radius={4 * px} fill={SELECT_COLOR} opacity={0.85} />}
    </Group>
  );
}
