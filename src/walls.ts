/** How each wall type looks. (Default thicknesses and heights live in model.ts, next to the data.) */
import type { WallType } from './model';

export const WALL_STYLE: Record<WallType, { label: string; fill: string; hatch?: boolean }> = {
  exterior: { label: 'Exterior', fill: '#262c3a' },
  interior: { label: 'Interior', fill: '#3b4252' },
  load: { label: 'Load-bearing', fill: '#3b4252', hatch: true },
  partition: { label: 'Partition', fill: '#7b8499' },
  railing: { label: 'Railing / low wall', fill: '#b9c0cc' },
};
