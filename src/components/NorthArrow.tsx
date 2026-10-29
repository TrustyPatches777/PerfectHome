import { useDesign } from '../store/design';
import { useUi } from '../store/ui';
import { sunPosition } from '../sun';
import { t } from '../i18n';

const SIZE = 64;

/** A compass in the corner of the plan showing where north is (and the sun while the sun layer is on). It is set in the Sun panel, not by dragging. */
export function NorthArrow() {
  const north = useDesign((s) => s.design.site.north);
  const site = useDesign((s) => s.design.site);
  const sunOn = useDesign((s) => s.design.layers.shadows.visible);
  const hour = useUi((s) => s.timeOfDay);
  const sun = sunPosition(site.lat, site.month, site.day, hour);
  const sunBearing = site.north + sun.azimuth; // degrees clockwise from "up" on screen

  return (
    <div className="north-arrow" title={t('North (set in the Sun panel)')} data-testid="north-arrow">
      <svg width={SIZE} height={SIZE} viewBox="-32 -32 64 64" aria-hidden>
        <circle r="30" fill="rgba(255,255,255,0.9)" stroke="#94a3b8" />
        <g transform={`rotate(${north})`}>
          <path d="M0 -24 L7 6 L0 1 L-7 6 Z" fill="#1f2937" />
          <path d="M0 -24 L7 6 L0 1 Z" fill="#475569" />
          <text y="-27.5" x="0" textAnchor="middle" fontSize="9" fontWeight="700" fill="#1f2937" transform="translate(0,-1)">
            N
          </text>
        </g>
        {sunOn && sun.elevation > -2 && (
          <g transform={`rotate(${sunBearing})`}>
            <circle cy="-21" r="4.2" fill="#f59e0b" stroke="#b45309" />
          </g>
        )}
      </svg>
    </div>
  );
}
