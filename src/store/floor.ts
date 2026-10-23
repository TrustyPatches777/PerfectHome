import { useMemo } from 'react';
import type { Design } from '../model';
import { useDesign } from './design';
import { useUi } from './ui';

/** The active floor id, falling back to the lowest floor when the remembered one no longer exists (undo, load...). */
export const floorIdOf = (design: Design, active: string): string =>
  design.floors.some((f) => f.id === active) ? active : design.floors[0].id;

export const floorId = (): string => floorIdOf(useDesign.getState().design, useUi.getState().activeFloor);

export function useFloorId(): string {
  const active = useUi((s) => s.activeFloor);
  return useDesign((s) => floorIdOf(s.design, active));
}

/** The floor directly below `id`, or null on the lowest floor. */
export function floorBelow(design: Design, id: string): string | null {
  const i = design.floors.findIndex((f) => f.id === id);
  return i > 0 ? design.floors[i - 1].id : null;
}

/** Items of one kind that belong to the active floor. `pick` must return the store's own array (stable reference). */
export function useOnFloor<T extends { floor: string }>(pick: (d: Design) => T[]): T[] {
  const all = useDesign((s) => pick(s.design));
  const floor = useFloorId();
  return useMemo(() => all.filter((i) => i.floor === floor), [all, floor]);
}
