import { useEffect, useRef } from 'react';
import { setLayerFlag } from '../actions';
import { useDesign } from '../store/design';
import { useUi } from '../store/ui';
import { compassPoint, darkness, formatHour, sunPosition, sunTimes } from '../sun';
import { NumberField } from './fields';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS_IN = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** Sun, shadows and the day/night cycle: a time slider with a play button, the date, the latitude and where north is. */
export function SunPanel() {
  const site = useDesign((s) => s.design.site);
  const on = useDesign((s) => s.design.layers.shadows.visible);
  const hour = useUi((s) => s.timeOfDay);
  const playing = useUi((s) => s.sunPlaying);
  const edit = (fn: (s: typeof site) => void) => useDesign.getState().update((d) => fn(d.site));
  const sun = sunPosition(site.lat, site.month, site.day, hour);
  const times = sunTimes(site.lat, site.month, site.day);
  const dark = darkness(sun.elevation);

  // play: one day in about 24 seconds
  const raf = useRef(0);
  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const ui = useUi.getState();
      ui.setTimeOfDay((ui.timeOfDay + dt) % 24);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [playing]);

  const setTime = (h: number) => useUi.getState().setTimeOfDay(h);
  const phase = sun.elevation > 6 ? `Sun ${Math.round(sun.elevation)}° high, from ${compassPoint(sun.azimuth)}` : sun.elevation > -6 ? (hour < 12 ? 'Sunrise' : 'Sunset') : dark > 0.9 ? 'Night' : 'Dusk';

  return (
    <div className="panel" data-testid="sun-panel">
      <h3>Sun &amp; light</h3>
      <label className="check">
        <input type="checkbox" checked={on} onChange={(e) => setLayerFlag('shadows', 'visible', e.target.checked)} data-testid="sun-toggle" />
        Show sun, shadows and evening light
      </label>
      {on && (
        <>
          <div className="time-row">
            <button onClick={() => useUi.getState().setSunPlaying(!playing)} title={playing ? 'Pause' : 'Play a whole day'} aria-label={playing ? 'Pause' : 'Play'} data-testid="sun-play">
              {playing ? '❚❚' : '▶'}
            </button>
            <strong className="time" data-testid="sun-time">
              {formatHour(hour)}
            </strong>
            <span className="muted" data-testid="sun-phase">
              {phase}
            </span>
          </div>
          <input
            type="range"
            className="time-slider"
            min={0}
            max={24}
            step={0.25}
            value={hour}
            onChange={(e) => {
              useUi.getState().setSunPlaying(false);
              setTime(Number(e.target.value));
            }}
            aria-label="Time of day"
            data-testid="sun-slider"
          />
          <div className="row">
            <button onClick={() => setTime(typeof times === 'string' ? 12 : times.sunrise + 0.25)} data-testid="sun-sunrise">
              Sunrise
            </button>
            <button onClick={() => setTime(12)}>Noon</button>
            <button onClick={() => setTime(typeof times === 'string' ? 12 : times.sunset - 0.25)}>Sunset</button>
            <button onClick={() => setTime(23)}>Night</button>
          </div>
          <p className="muted">{typeof times === 'string' ? (times === 'polar-day' ? 'The sun does not set on this date here.' : 'The sun does not rise on this date here.') : `Sunrise ${formatHour(times.sunrise)} · sunset ${formatHour(times.sunset)}`}</p>

          <div className="row two">
            <label className="field">
              <span>Month</span>
              <select value={site.month} data-testid="sun-month" onChange={(e) => edit((s) => void ((s.month = Number(e.target.value)), (s.day = Math.min(s.day, DAYS_IN[s.month - 1]))))}>
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <NumberField label="Day" value={site.day} min={1} max={DAYS_IN[site.month - 1]} testId="sun-day" onCommit={(v) => edit((s) => void (s.day = Math.round(v)))} />
          </div>
          <div className="row">
            <button onClick={() => edit((s) => void ((s.month = 6), (s.day = 21)))} data-testid="sun-summer">
              Summer
            </button>
            <button onClick={() => edit((s) => void ((s.month = 3), (s.day = 21)))}>Spring / autumn</button>
            <button onClick={() => edit((s) => void ((s.month = 12), (s.day = 21)))} data-testid="sun-winter">
              Winter
            </button>
          </div>
          <div className="row two">
            <NumberField label="Latitude" value={site.lat} unit="°N" min={-66} max={66} testId="sun-lat" onCommit={(v) => edit((s) => void (s.lat = v))} />
            <NumberField label="North is at" value={site.north} unit="°" min={0} max={359} testId="sun-north" onCommit={(v) => edit((s) => void (s.north = v))} />
          </div>
          <p className="muted">Latitude: Berlin 52.5, London 51.5, Rome 42, Madrid 40. “North is at” turns the compass (0 = up the screen). Lamps glow in the evening.</p>
        </>
      )}
    </div>
  );
}
