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
  roof: 'Drag a box for the roof footprint (or click two corners) · or press "Fit to walls" above · choose the roof type above · Esc cancels',
  skylight: 'Click on a roof to put a skylight there · Shift+click places several · choose the size above · Esc stops',
  paint: 'Click the face of a wall to cover it · Shift+click covers both faces · choose the covering and color above · Esc stops',
  zone: 'Drag a box (or click two corners, then type 5x3 + Enter) · Polygon mode: click corners, double-click to finish · Esc cancels',
  stretch: 'Drag a box round the part to stretch, then drag inside the box to pull it · everything attached follows · drag outside the box for a new one · Esc stops',
  'split-room': 'Click where the cutting line starts, then where it ends (it runs through the whole room) · Esc cancels',
  gate: 'Hover a fence or hedge and click to put a gate in it · choose the kind above · click a gate in 3D to open it · Esc stops',
  strip: 'Click the points along the line · double-click or Enter to finish · Shift = 45° · Esc cancels',
};

export function StatusBar() {
  const cursor = useUi((s) => s.cursor);
  const tool = useUi((s) => s.tool);
  const toast = useUi((s) => s.toast);
  const wallMode = useUi((s) => s.wallMode);
  const roomMode = useUi((s) => s.roomMode);
  const hint = tool === 'wall' && wallMode === 'rect' ? 'Drag from one corner to the opposite one for four walls (and the room inside) · or click both corners · type 5x3 + Enter · Esc cancels' : tool === 'room' && roomMode === 'box' ? 'Drag a box to make a room (no walls) · or click two opposite corners · Esc cancels' : HINTS[tool];
  return (
    <div className="statusbar">
      <span className="hint">{toast ?? hint ?? ''}</span>
      <span className="coords" data-testid="coords">
        {cursor ? `x ${cursor.x.toFixed(2)} m   y ${cursor.y.toFixed(2)} m` : ''}
      </span>
    </div>
  );
}
