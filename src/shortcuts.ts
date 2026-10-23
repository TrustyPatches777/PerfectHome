/** Keyboard shortcuts: the table drives both the handler (hooks/useShortcuts.ts) and the in-app help. */
import type { Tool } from './store/ui';

export const TOOL_KEYS: Record<string, Tool> = {
  v: 'select',
  w: 'wall',
  d: 'door',
  n: 'window',
  a: 'room',
  m: 'measure',
  t: 'text',
};

export const SHORTCUT_HELP: { keys: string; what: string }[] = [
  { keys: 'V', what: 'Select / move' },
  { keys: 'W', what: 'Draw walls (click corners; double-click, Enter or Esc to finish; Shift = 45° angles)' },
  { keys: 'D / N', what: 'Place a door / window on a wall' },
  { keys: 'A', what: 'Add a room (click inside closed walls)' },
  { keys: 'M', what: 'Measure a distance' },
  { keys: 'T', what: 'Add a text label' },
  { keys: 'Space + drag, or right/middle drag', what: 'Pan' },
  { keys: 'Mouse wheel', what: 'Zoom at the cursor' },
  { keys: 'G', what: 'Toggle snap to grid' },
  { keys: 'F', what: 'Fit the whole design in view' },
  { keys: 'Ctrl+Z / Ctrl+Y', what: 'Undo / redo' },
  { keys: 'Delete', what: 'Delete the selection' },
  { keys: 'Ctrl+D', what: 'Duplicate the selection' },
  { keys: 'Arrow keys', what: 'Nudge the selection (Shift = bigger steps)' },
  { keys: 'R / Shift+R', what: 'Rotate furniture 90° / -90°' },
  { keys: '[ and ]', what: 'Rotate furniture by 15°' },
  { keys: 'Esc', what: 'Cancel / back to the select tool' },
];
