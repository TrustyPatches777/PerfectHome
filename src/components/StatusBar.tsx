import { useUi } from '../store/ui';

const HINTS: Record<string, string> = {
  select: 'Drag empty space to pan · scroll to zoom · click an item to select',
  wall: 'Click to start a wall, click again for each corner · type a length (3.5, 350, 2.4m, 3.5<45) + Enter · double-click or Enter to finish · Esc to stop',
  door: 'Hover a wall and click to place it (pick door, double door, garage door or open passage above)',
  window: 'Hover a wall and click to place a window',
  room: 'Click inside closed walls to create a room',
  furniture: 'Click to place · R rotates · Shift+click places several · Esc stops',
  measure: 'Click two points to measure · or click one and type a length · Esc cancels',
  text: 'Click where the label should go',
  note: 'Click where the sticky note should go · it is signed with your name and color',
  stairs: 'Click to place the stairs · R rotates · choose straight, L, U or spiral above · Esc cancels',
  zone: 'Drag a box (or click two corners, then type 5x3 + Enter) · Polygon mode: click corners, double-click to finish · Esc cancels',
  strip: 'Click the points along the line · double-click or Enter to finish · Shift = 45° · Esc cancels',
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
