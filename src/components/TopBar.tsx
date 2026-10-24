import { useDesign } from '../store/design';
import { useUi } from '../store/ui';
import { fitView, zoomByCenter } from '../canvas/camera';
import { GRID_STEPS } from '../model';
import { shareLink } from '../session';
import { FileMenu } from './FileMenu';
import { ViewMenu } from './ViewMenu';
import { readableOn } from '../identity';
import { useLive } from '../store/live';

export function TopBar({ onHelp }: { onHelp: () => void }) {
  const name = useDesign((s) => s.design.name);
  const gridStep = useDesign((s) => s.design.settings.gridStep);
  const canUndo = useDesign((s) => s.past.length + s.liveUndo > 0);
  const canRedo = useDesign((s) => s.future.length + s.liveRedo > 0);
  const snap = useUi((s) => s.snap);
  const zoom = useUi((s) => s.viewport.zoom);
  const saveState = useUi((s) => s.saveState);
  const me = useUi((s) => s.me);
  const live = useLive();
  const { update, undo, redo } = useDesign.getState();

  return (
    <header className="topbar">
      <div className="brand">Perfect Home</div>
      <input
        className="name-input"
        aria-label="Design name"
        value={name}
        onChange={(e) => update((d) => void (d.name = e.target.value))}
      />

      <div className="group">
        <button onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)" data-testid="undo">
          Undo
        </button>
        <button onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Y)" data-testid="redo">
          Redo
        </button>
      </div>

      <div className="group">
        <button
          className={snap ? 'active' : ''}
          onClick={() => useUi.getState().toggleSnap()}
          title="Snap to grid (G)"
          data-testid="snap-toggle"
        >
          Snap {snap ? 'on' : 'off'}
        </button>
        <label className="select-label">
          Grid
          <select
            value={gridStep}
            data-testid="grid-step"
            onChange={(e) => update((d) => void (d.settings.gridStep = Number(e.target.value)))}
          >
            {GRID_STEPS.map((s) => (
              <option key={s} value={s}>
                {s * 100} cm
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="spacer" />

      <span className={`save-state ${saveState.failed ? 'failed' : ''}`} data-testid="save-state" title="Your design is saved automatically in this browser">
        {saveState.failed
          ? '⚠ Could not autosave (storage full or blocked). Use Export JSON.'
          : saveState.at
            ? `✓ Saved ${new Date(saveState.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
            : ''}
      </span>

      <button
        className="user-chip"
        onClick={() => useUi.getState().setDialog({ type: 'identity' })}
        title="Your name and color, used on sticky notes"
        data-testid="user-chip"
      >
        {me ? (
          <>
            <span className="dot" style={{ background: me.color, color: readableOn(me.color) }}>
              {me.name[0].toUpperCase()}
            </span>
            {me.name}
          </>
        ) : (
          'Who are you?'
        )}
      </button>

      <div className="group">
        <ViewMenu />
        <FileMenu />
        <button
          className={live.active ? 'live on' : 'live'}
          onClick={() => useUi.getState().setDialog({ type: 'live' })}
          title="Work on this design together, at the same time"
          data-testid="live"
        >
          {live.active ? `● Live${live.peers.length ? ` · ${live.peers.length + 1}` : ''}` : 'Live'}
        </button>
        <button className="primary" onClick={() => void shareLink()} title="Copy a link that opens this design" data-testid="share">
          Share
        </button>
      </div>

      <div className="group">
        <button onClick={() => zoomByCenter(1 / 1.25)} title="Zoom out" aria-label="Zoom out">
          −
        </button>
        <span className="zoom-label" data-testid="zoom-label">
          {Math.round((zoom / 60) * 100)}%
        </span>
        <button onClick={() => zoomByCenter(1.25)} title="Zoom in" aria-label="Zoom in">
          +
        </button>
        <button onClick={() => fitView(useDesign.getState().design)} title="Fit design in view (F)">
          Fit
        </button>
        <button onClick={onHelp} title="Help & shortcuts (?)" aria-label="Help">
          ?
        </button>
      </div>
    </header>
  );
}
