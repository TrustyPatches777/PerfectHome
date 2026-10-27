import { useRef, useState } from 'react';
import { Group } from 'react-konva';
import type Konva from 'konva';
import { layerBlocksEditing } from '../../actions';
import { newId, type Gate, type Strip } from '../../model';
import { gateSpans, polylineLength, projectOnPolyline, stripColor } from '../../outdoor';
import { useDesign } from '../../store/design';
import { floorId } from '../../store/floor';
import { useUi } from '../../store/ui';
import { isPrimary, snapScalar, useStageEvents } from '../input';
import { GateShape } from '../layers/OutdoorLayer';

interface Hover {
  strip: Strip;
  gate: Gate;
  blocked: boolean;
}

/** Hover a fence or hedge to preview a gate; click to put it in. The gate opens to the side you point at. */
export function GateTool() {
  const ref = useRef<Konva.Group>(null);
  const [hover, setHover] = useState<Hover | null>(null);

  const locate = (world: { x: number; y: number }): Hover | null => {
    const { design } = useDesign.getState();
    const floor = floorId();
    let best: { strip: Strip; s: number; dist: number; side: 1 | -1 } | null = null;
    for (const strip of design.strips) {
      if (strip.floor !== floor || (strip.kind !== 'fence' && strip.kind !== 'hedge')) continue;
      const hit = projectOnPolyline(strip.points, world);
      if (hit.dist <= 0.8 && (!best || hit.dist < best.dist)) best = { strip, ...hit };
    }
    if (!best) return null;
    const ui = useUi.getState();
    const L = polylineLength(best.strip.points);
    const width = Math.min(ui.gateWidth, L);
    const gate: Gate = { id: 'ghost', pos: Math.min(L - width / 2, Math.max(width / 2, snapScalar(best.s))), width, kind: ui.gateKind, swing: best.side, hinge: 'a' };
    const blocked = gateSpans({ points: best.strip.points, gates: [...(best.strip.gates ?? []), gate] }).every((g) => g.gate.id !== 'ghost');
    return { strip: best.strip, gate, blocked };
  };

  useStageEvents(ref, {
    mousemove: (_e, world) => setHover(locate(world)),
    mousedown: (e, world) => {
      if (!isPrimary(e)) return;
      const h = locate(world);
      if (!h || layerBlocksEditing('strip')) return;
      if (h.blocked) {
        useUi.getState().showToast('There is already a gate there.');
        return;
      }
      const id = newId();
      useDesign.getState().update((d) => {
        const s = d.strips.find((x) => x.id === h.strip.id);
        if (s) (s.gates ??= []).push({ ...h.gate, id });
      });
    },
  });

  return (
    <Group ref={ref} listening={false}>
      {hover && <GateShape strip={hover.strip} gate={hover.gate} color={stripColor(hover.strip)} ghost />}
    </Group>
  );
}
