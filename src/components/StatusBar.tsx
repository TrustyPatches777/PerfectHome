import { useUi } from '../store/ui';

const HINTS: Record<string, string> = {
  select: 'Drag empty space to pan · scroll to zoom · click an item to select',
  wall: 'Click to start a wall, click again for each corner · double-click or Enter to finish · Esc to stop',
  door: 'Hover a wall and click to place a door',
  window: 'Hover a wall and click to place a window',
  room: 'Click inside closed walls to create a room',
  furniture: 'Click to place · R rotates · Shift+click places several · Esc stops',
  measure: 'Click two points to measure · snaps to corners · Esc cancels',
  text: 'Click where the label should go',
};

export function StatusBar() {
  const cursor = useUi((s) => s.cursor);
  const tool = useUi((s) => s.tool);
  const toast = useUi((s) => s.toast);
  return (
    <div className="statusbar">
      <span className="hint">{toast ?? HINTS[tool] ?? ''}</span>
      <span className="coords" data-testid="coords">
        {cursor ? `x ${cursor.x.toFixed(2)} m   y ${cursor.y.toFixed(2)} m` : ''}
      </span>
    </div>
  );
}
