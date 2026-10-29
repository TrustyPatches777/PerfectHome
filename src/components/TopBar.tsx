import { useDesign } from '../store/design';
import { useUi } from '../store/ui';
import { fitView, zoomByCenter } from '../canvas/camera';
import { GRID_STEPS } from '../model';
import { shareLink } from '../session';
import { FileMenu } from './FileMenu';
import { ViewMenu } from './ViewMenu';
import { readableOn } from '../identity';
import { useLive } from '../store/live';
import { getLang, localeOf, setLang, t } from '../i18n';

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
  const view = useUi((s) => s.view);
  const { update, undo, redo } = useDesign.getState();

  return (
    <header className="topbar">
      <div className="brand">{t('Perfect Home')}</div>
      <input
        className="name-input"
        aria-label={t('Design name')}
        value={t(name)}
        onChange={(e) => update((d) => void (d.name = e.target.value))}
      />

      <div className="segmented view-switch" role="group" aria-label={t('View')}>
        <button className={view === '2d' ? 'active' : ''} onClick={() => useUi.getState().setView('2d')} title={t('Floor plan (2)')} data-testid="view-2d">
          2D
        </button>
        <button className={view === '3d' ? 'active' : ''} onClick={() => useUi.getState().setView('3d')} title={t('The house in 3D (3)')} data-testid="view-3d">
          3D
        </button>
      </div>

      <div className="group">
        <button onClick={undo} disabled={!canUndo} title={t('Undo (Ctrl+Z)')} data-testid="undo">
          {t('Undo')}
        </button>
        <button onClick={redo} disabled={!canRedo} title={t('Redo (Ctrl+Y)')} data-testid="redo">
          {t('Redo')}
        </button>
      </div>

      <div className="group">
        <button
          className={snap ? 'active' : ''}
          onClick={() => useUi.getState().toggleSnap()}
          title={t('Snap to grid (G)')}
          data-testid="snap-toggle"
        >
          {t('Snap {value}', { value: snap ? t('on') : t('off') })}
        </button>
        <label className="select-label">
          {t('Grid')}
          <select
            value={gridStep}
            data-testid="grid-step"
            onChange={(e) => update((d) => void (d.settings.gridStep = Number(e.target.value)))}
          >
            {GRID_STEPS.map((s) => (
              <option key={s} value={s}>
                {t('{value} cm', { value: s * 100 })}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="spacer" />

      <span className={`save-state ${saveState.failed ? 'failed' : ''}`} data-testid="save-state" title={t('Your design is saved automatically in this browser')}>
        {saveState.failed ? t('⚠ Could not autosave (storage full or blocked). Use Export JSON.') : saveState.at ? t('✓ Saved {value}', { value: new Date(saveState.at).toLocaleTimeString(localeOf(), { hour: '2-digit', minute: '2-digit' }) }) : ''}
      </span>

      <button
        className="user-chip"
        onClick={() => useUi.getState().setDialog({ type: 'identity' })}
        title={t('Your name and color, used on sticky notes')}
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
          t('Who are you?')
        )}
      </button>

      <div className="group">
        <ViewMenu />
        <FileMenu />
        <button
          className={live.active ? 'live on' : 'live'}
          onClick={() => useUi.getState().setDialog({ type: 'live' })}
          title={t('Work on this design together, at the same time')}
          data-testid="live"
        >
          {live.active ? t('● Live{value}', { value: live.peers.length ? ` · ${live.peers.length + 1}` : '' }) : t('Live')}
        </button>
        <button className="primary" onClick={() => void shareLink()} title={t('Copy a link that opens this design')} data-testid="share">
          {t('Share')}
        </button>
      </div>

      <div className="group">
        <button onClick={() => zoomByCenter(1 / 1.25)} title={t('Zoom out')} aria-label={t('Zoom out')}>
          −
        </button>
        <span className="zoom-label" data-testid="zoom-label">
          {Math.round((zoom / 60) * 100)}%
        </span>
        <button onClick={() => zoomByCenter(1.25)} title={t('Zoom in')} aria-label={t('Zoom in')}>
          +
        </button>
        <button onClick={() => fitView(useDesign.getState().design)} title={t('Fit design in view (F)')}>
          {t('Fit')}
        </button>
        <button onClick={onHelp} title={t('Help & shortcuts (?)')} aria-label={t('Help')}>
          ?
        </button>
        <button
          onClick={() => void setLang(getLang() === 'ko' ? 'en' : 'ko')}
          title={getLang() === 'ko' ? t('Switch to English') : t('Switch to Korean')}
          lang={getLang() === 'ko' ? 'en' : 'ko'}
          data-testid="lang-toggle"
        >
          {getLang() === 'ko' ? 'English' : '한국어'}
        </button>
      </div>
    </header>
  );
}
