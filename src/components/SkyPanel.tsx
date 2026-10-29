import { HORIZONS, SEASONS, WEATHERS, type Horizon, type Season, type Weather } from '../model';
import { HORIZON_LABEL, SEASON_LABEL, WEATHER_LABEL, seasonOf } from '../sky';
import { useDesign } from '../store/design';
import { t } from '../i18n';

/** The weather, the season and the horizon of the site: what the 3D view shows beyond the walls. */
export function SkyPanel() {
  const site = useDesign((s) => s.design.site);
  const edit = (fn: (s: typeof site) => void) => useDesign.getState().update((d) => fn(d.site));
  const now = seasonOf(site);
  return (
    <details className="panel sky-panel" data-testid="sky-panel">
      <summary>
        <h3 style={{ display: 'inline' }}>{t('Sky & surroundings')}</h3>
      </summary>
      <p className="muted">{t('What the 3D view shows: the weather, the season (trees in leaf or bare) and what lies on the horizon. Neighbouring buildings are in the furniture list under Surroundings.')}</p>
      <label className="field">
        <span>{t('Weather')}</span>
        <select value={site.weather ?? 'clear'} data-testid="site-weather" onChange={(e) => edit((s) => (e.target.value === 'clear' ? void delete s.weather : void (s.weather = e.target.value as Weather)))}>
          {WEATHERS.map((w) => (
            <option key={w} value={w}>
              {WEATHER_LABEL[w]}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>{t('Season')}</span>
        <select value={site.season ?? 'auto'} data-testid="site-season" onChange={(e) => edit((s) => (e.target.value === 'auto' ? void delete s.season : void (s.season = e.target.value as Season)))}>
          {SEASONS.map((x) => (
            <option key={x} value={x}>
              {x === 'auto' ? t('From the date ({value})', { value: SEASON_LABEL[now].toLowerCase() }) : SEASON_LABEL[x]}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>{t('Horizon')}</span>
        <select value={site.horizon ?? 'none'} data-testid="site-horizon" onChange={(e) => edit((s) => (e.target.value === 'none' ? void delete s.horizon : void (s.horizon = e.target.value as Horizon)))}>
          {HORIZONS.map((h) => (
            <option key={h} value={h}>
              {HORIZON_LABEL[h]}
            </option>
          ))}
        </select>
      </label>
    </details>
  );
}
