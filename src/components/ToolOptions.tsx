import { useDesign } from '../store/design';
import { catalogItem } from '../catalog';
import { useUi } from '../store/ui';
import { NumberField } from './fields';

/** Small options strip floating at the top of the canvas for the active tool. */
export function ToolOptions() {
  const tool = useUi((s) => s.tool);
  const roomMode = useUi((s) => s.roomMode);
  const width = useUi((s) => s.openingWidth);
  const placing = useUi((s) => s.placing);
  const thickness = useDesign((s) => s.design.settings.wallThickness);

  let body = null;
  if (tool === 'wall') {
    body = (
      <>
        <NumberField
          label="Wall thickness"
          value={thickness}
          scale={100}
          unit="cm"
          min={2}
          max={100}
          testId="opt-thickness"
          onCommit={(v) => useDesign.getState().update((d) => void (d.settings.wallThickness = v))}
        />
        <span className="muted">Click corners · double-click or Enter to finish · Shift = 45°</span>
      </>
    );
  } else if (tool === 'door' || tool === 'window') {
    body = (
      <>
        <NumberField
          label={tool === 'door' ? 'Door width' : 'Window width'}
          value={width[tool]}
          scale={100}
          unit="cm"
          min={30}
          max={400}
          testId="opt-opening-width"
          onCommit={(v) => useUi.getState().setOpeningWidth(tool, v)}
        />
        <span className="muted">Hover a wall and click to place · the door swings toward your cursor</span>
      </>
    );
  } else if (tool === 'room') {
    body = (
      <>
        <div className="segmented" role="group" aria-label="Room mode">
          <button className={roomMode === 'auto' ? 'active' : ''} onClick={() => useUi.getState().setRoomMode('auto')} data-testid="room-auto">
            Click inside walls
          </button>
          <button className={roomMode === 'draw' ? 'active' : ''} onClick={() => useUi.getState().setRoomMode('draw')} data-testid="room-draw">
            Draw corners
          </button>
        </div>
      </>
    );
  }
  else if (tool === 'furniture' && placing) {
    body = (
      <span className="muted">
        Placing <strong>{catalogItem(placing).label}</strong> · click to drop · R rotates · Shift+click for several · Esc to stop
      </span>
    );
  }
  if (!body) return null;
  return <div className="tool-options">{body}</div>;
}
