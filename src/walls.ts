/** How each wall type looks. (Default thicknesses and heights live in model.ts, next to the data.) */
import type { WallType } from './model';

export const WALL_STYLE: Record<WallType, { label: string; fill: string; hint: string; hatch?: boolean }> = {
  exterior: { label: 'Exterior', fill: '#262c3a', hint: 'The outer shell of the house: thick, insulated. Roofs are fitted to these.' },
  interior: { label: 'Interior', fill: '#3b4252', hint: 'An ordinary wall between rooms.' },
  load: { label: 'Load-bearing', fill: '#3b4252', hatch: true, hint: 'A wall that carries the floor or roof above, inside or outside. It cannot simply be removed. Hatched on the plan.' },
  partition: { label: 'Partition', fill: '#7b8499', hint: 'A thin, light wall that only divides a space and carries nothing.' },
  railing: { label: 'Railing / low wall', fill: '#b9c0cc', hint: 'A balustrade or low wall, 1 m high.' },
};
