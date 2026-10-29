/**
 * The kinds of windows: where their glass starts and ends on the wall, how they look in the plan symbol and what to call them.
 * Pure data, shared by the plan, the SVG export, the tool options and the 3D view.
 */
import type { OpeningKind } from './model';
import { localize } from './i18n';

export type WindowKind = 'window' | 'casement' | 'sash' | 'picture' | 'bay' | 'highwin' | 'floorwin';
export const WINDOW_KINDS: WindowKind[] = ['window', 'casement', 'sash', 'picture', 'bay', 'highwin', 'floorwin'];
export const isWindowKind = (k: OpeningKind): k is WindowKind => (WINDOW_KINDS as string[]).includes(k);

/** Heights of the top of each opening above the floor, in meters (a lintel set on the opening itself overrides it). */
export const OPENING_HEAD: Record<OpeningKind, number> = { door: 2.05, main: 2.3, garden: 2.1, double: 2.1, french: 2.15, sliding: 2.15, garage: 2.2, gap: 2.1, window: 2.1, bay: 2.1, casement: 2.1, sash: 2.15, picture: 2.2, highwin: 2.25, floorwin: 2.3 };

export interface WindowSpec {
  label: string;
  /** Short label for the tool options strip. */
  short: string;
  /** Height of the bottom of the glass above the floor, and the default width. */
  sill: number;
  width: number;
  hint: string;
}

export const WINDOW_SPEC: Record<WindowKind, WindowSpec> = {
  window: { label: 'Window', short: 'Window', sill: 0.9, width: 1.2, hint: 'A plain window with a frame' },
  casement: { label: 'Casement window (two wings)', short: 'Casement', sill: 0.9, width: 1.4, hint: 'Two wings that meet at a post in the middle' },
  sash: { label: 'Sash window (bars)', short: 'Sash', sill: 0.85, width: 1.0, hint: 'Two sashes one above the other, divided into small panes' },
  picture: { label: 'Picture window (one big pane)', short: 'Picture', sill: 0.6, width: 1.8, hint: 'One large fixed pane, low sill' },
  bay: { label: 'Bay window', short: 'Bay', sill: 0.9, width: 1.6, hint: 'Sticks out of the wall in three panes' },
  highwin: { label: 'High window (strip)', short: 'High', sill: 1.7, width: 1.2, hint: 'A narrow strip near the ceiling: light without being seen (bathrooms, stairs)' },
  floorwin: { label: 'Floor-to-ceiling window', short: 'Full height', sill: 0, width: 1.2, hint: 'Glass from the floor to the head of the door' },
};
localize(WINDOW_SPEC, ['label', 'hint', 'short']);

/** The plan symbol of a window in the wall's own frame (x along the wall from -w/2 to w/2, y across it): lines inside the glass rectangle. */
export function windowMarks(kind: WindowKind, w: number, t: number): { fill: string; dash: boolean; lines: [number, number, number, number][] } {
  const x0 = -w / 2;
  const x1 = w / 2;
  const mid: [number, number, number, number] = [x0, 0, x1, 0];
  switch (kind) {
    case 'casement':
      return { fill: '#dbeafe', dash: false, lines: [mid, [0, -t / 2, 0, t / 2]] };
    case 'sash':
      return { fill: '#dbeafe', dash: false, lines: [[x0, -t * 0.18, x1, -t * 0.18], [x0, t * 0.18, x1, t * 0.18]] };
    case 'picture':
      return { fill: '#dbeafe', dash: false, lines: [] };
    case 'highwin':
      return { fill: '#eff6ff', dash: true, lines: [mid] };
    case 'floorwin':
      return { fill: '#bfdbfe', dash: false, lines: [mid, [x0, -t / 2, x0, t / 2], [x1, -t / 2, x1, t / 2]] };
    default:
      return { fill: '#dbeafe', dash: false, lines: [mid] };
  }
}
