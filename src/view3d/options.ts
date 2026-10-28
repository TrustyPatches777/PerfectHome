import type { Design } from '../model';
import { floorElevations, type BuildOptions } from './build';

/** How high the walls of a floor shown as a dollhouse stand (meters above its floor). */
export const DOLLHOUSE_HEIGHT = 1.3;

/** The bits of the interface state that decide what the 3D view builds. */
export interface View3DState {
  cutaway: boolean;
  showRoof3d: boolean;
  showCeilings3d: boolean;
  walking: boolean;
  hiddenFloors: string[];
  texturesVersion: number;
  explode3d: number;
  dollhouse: string | null;
}

/** What to build for the 3D view: the floors shown, roof and ceilings, the floors pulled apart, a floor as a dollhouse. `floor` is the active floor. */
export function sceneOptions(d: Design, floor: string, s: View3DState): BuildOptions & { floorElevation: number } {
  const doll = s.dollhouse && d.floors.some((f) => f.id === s.dollhouse) ? s.dollhouse : null;
  return {
    hideAbove: doll ?? (s.cutaway ? floor : null),
    showRoof: s.showRoof3d && !doll,
    showCeilings: !doll && (s.showCeilings3d || s.walking),
    hiddenFloors: s.hiddenFloors,
    texVersion: s.texturesVersion,
    floorElevation: floorElevations(d).get(floor) ?? 0,
    explode: s.walking ? 0 : s.explode3d,
    ...(doll ? { dollhouse: { floor: doll, height: DOLLHOUSE_HEIGHT } } : {}),
  };
}
