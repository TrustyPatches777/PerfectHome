import { useRef, useState } from 'react';
import { Group } from 'react-konva';
import type Konva from 'konva';
import { layerBlocksEditing } from '../../actions';
import { newId, type Opening, type OpeningKind, type Wall } from '../../model';
import { clampOpeningPos, nearestWall, openingOverlaps, wallFrame } from '../../geometry';
import { useDesign } from '../../store/design';
import { useUi } from '../../store/ui';
import { isPrimary, snapScalar, useStageEvents } from '../input';
import { OpeningShape } from '../layers/StructureLayer';

interface Hover {
  wall: Wall;
  opening: Opening;
  blocked: boolean;
}

/** Hover a wall to preview a door/window; click to place it. The door swings toward the side you point at. */
export function OpeningTool({ kind }: { kind: OpeningKind }) {
  const ref = useRef<Konva.Group>(null);
  const [hover, setHover] = useState<Hover | null>(null);

  const locate = (world: { x: number; y: number }): Hover | null => {
    const { design } = useDesign.getState();
    const hit = nearestWall(world, design.walls, 0.6);
    if (!hit) return null;
    const width = Math.min(useUi.getState().openingWidth[kind], wallFrame(hit.wall).length);
    const pos = clampOpeningPos(snapScalar(hit.s), width, wallFrame(hit.wall).length);
    const opening: Opening = {
      id: 'ghost',
      wallId: hit.wall.id,
      kind,
      pos,
      width,
      swing: hit.d >= 0 ? 1 : -1,
      hinge: 'a',
    };
    const blocked = openingOverlaps(
      design.openings.filter((o) => o.wallId === hit.wall.id),
      pos,
      width,
    );
    return { wall: hit.wall, opening, blocked };
  };

  useStageEvents(ref, {
    mousemove: (_e, world) => setHover(locate(world)),
    mousedown: (e, world) => {
      if (!isPrimary(e)) return;
      const h = locate(world);
      if (!h || layerBlocksEditing('opening')) return;
      if (h.blocked) {
        useUi.getState().showToast('There is already a door or window there.');
        return;
      }
      const id = newId();
      useDesign.getState().update((d) => {
        d.openings.push({ ...h.opening, id });
      });
    },
  });

  return (
    <Group ref={ref} listening={false}>
      {hover && <OpeningShape wall={hover.wall} opening={hover.opening} selected={false} ghost />}
    </Group>
  );
}
