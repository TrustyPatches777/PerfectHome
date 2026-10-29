import { STRIP_KINDS, ZONE_KINDS, type StripKind, type ZoneKind } from '../model';
import { STRIP_STYLES, ZONE_STYLES } from '../outdoor';
import { useUi } from '../store/ui';
import { t } from '../i18n';

/** Pick what to draw outside: ground areas (drawn as rectangles or polygons) and lines (street, path, fence, hedge). */
export function OutdoorPalette() {
  const tool = useUi((s) => s.tool);
  const zoneKind = useUi((s) => s.zoneKind);
  const stripKind = useUi((s) => s.stripKind);

  const pickZone = (k: ZoneKind) => {
    const ui = useUi.getState();
    ui.setZoneKind(k);
    ui.setTool('zone');
  };
  const pickStrip = (k: StripKind) => {
    const ui = useUi.getState();
    ui.setStripKind(k);
    ui.setTool('strip');
  };

  return (
    <div className="palette" data-testid="outdoor-palette">
      <h5>{t('Areas')}</h5>
      <div className="tiles">
        {ZONE_KINDS.map((k) => (
          <button key={k} className={`tile ${tool === 'zone' && zoneKind === k ? 'active' : ''}`} onClick={() => pickZone(k)} data-testid={`zone-${k}`} title={ZONE_STYLES[k].label}>
            <span className="tile-icon">
              <svg width="44" height="30" viewBox="0 0 44 30" aria-hidden>
                <rect x="2" y="2" width="40" height="26" rx="3" fill={k === 'plot' ? 'none' : ZONE_STYLES[k].color} stroke={k === 'plot' ? '#6b7280' : '#475569'} strokeDasharray={k === 'plot' ? '4 3' : undefined} />
              </svg>
            </span>
            <span className="tile-label">{ZONE_STYLES[k].label}</span>
          </button>
        ))}
      </div>
      <h5>{t('Lines')}</h5>
      <div className="tiles">
        {STRIP_KINDS.map((k) => (
          <button key={k} className={`tile ${tool === 'strip' && stripKind === k ? 'active' : ''}`} onClick={() => pickStrip(k)} data-testid={`strip-${k}`} title={STRIP_STYLES[k].label}>
            <span className="tile-icon">
              <svg width="44" height="30" viewBox="0 0 44 30" aria-hidden>
                <path d="M3 22 C 14 22, 18 8, 41 8" fill="none" stroke={STRIP_STYLES[k].color} strokeWidth={k === 'road' ? 11 : k === 'path' ? 7 : k === 'hedge' ? 7 : 2.5} strokeLinecap={k === 'hedge' ? 'round' : 'butt'} strokeDasharray={k === 'fence' ? '2 3' : undefined} />
                {k === 'road' && <path d="M3 22 C 14 22, 18 8, 41 8" fill="none" stroke="#fff" strokeWidth="1.2" strokeDasharray="4 3" />}
              </svg>
            </span>
            <span className="tile-label">{STRIP_STYLES[k].label}</span>
          </button>
        ))}
      </div>
      <button className={`tile gate-tile ${tool === 'gate' ? 'active' : ''}`} onClick={() => useUi.getState().setTool('gate')} data-testid="tool-gate" title={t('Put a gate in a fence or hedge')}>
        <span className="tile-icon">
          <svg width="44" height="30" viewBox="0 0 44 30" aria-hidden>
            <path d="M2 24 H12 M32 24 H42" stroke={STRIP_STYLES.fence.color} strokeWidth="2.5" />
            <rect x="10" y="12" width="4" height="14" fill="#5b4a38" />
            <rect x="30" y="12" width="4" height="14" fill="#5b4a38" />
            <path d="M14 24 L30 12" stroke="#475569" strokeWidth="1.5" strokeDasharray="3 2" fill="none" />
            <path d="M14 24 H30" stroke="#1f2937" strokeWidth="2" />
          </svg>
        </span>
        <span className="tile-label">{t('Fence gate')}</span>
      </button>
      <p className="muted">{t('Draw on the floor you are viewing, usually the ground floor. Cars, trees and garden furniture are in the Furniture tab.')}</p>
    </div>
  );
}
