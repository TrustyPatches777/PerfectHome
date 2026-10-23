import { useDesign } from '../store/design';
import { useUi } from '../store/ui';
import { fitView, zoomByCenter } from '../canvas/camera';
import { GRID_STEPS } from '../model';

export function TopBar({ onHelp }: { onHelp: () => void }) {
  const name = useDesign((s) => s.design.name);
  const gridStep = useDesign((s) => s.design.settings.gridStep);
  const canUndo = useDesign((s) => s.past.length > 0);
  const canRedo = useDesign((s) => s.future.length > 0);
  const snap = useUi((s) => s.snap);
  const zoom = useUi((s) => s.viewport.zoom);
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
