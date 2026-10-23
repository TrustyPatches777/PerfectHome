import { useRef } from 'react';
import { useDesign } from '../store/design';
import { useUi } from '../store/ui';
import { sunPosition } from '../sun';

const SIZE = 64;

/** A compass in the corner of the plan showing where north is (and the sun while the sun layer is on). Drag it to turn the plan. */
export function NorthArrow() {
  const north = useDesign((s) => s.design.site.north);
  const site = useDesign((s) => s.design.site);
  const sunOn = useDesign((s) => s.design.layers.shadows.visible);
  const hour = useUi((s) => s.timeOfDay);
  const box = useRef<HTMLDivElement>(null);
  const sun = sunPosition(site.lat, site.month, site.day, hour);
  const sunBearing = site.north + sun.azimuth; // degrees clockwise from "up" on screen

  const startDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    const r = box.current!.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    useDesign.getState().beginTx();
    const move = (ev: MouseEvent) => {
      let a = (Math.atan2(ev.clientX - cx, -(ev.clientY - cy)) * 180) / Math.PI;
      a = ((a % 360) + 360) % 360;
      a = ev.shiftKey ? Math.round(a / 15) * 15 : Math.round(a);
      useDesign.getState().update((d) => void (d.site.north = a % 360));
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      useDesign.getState().endTx();
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  return (
    <div ref={box} className="north-arrow" onMouseDown={startDrag} title="North. Drag to turn the compass (Shift = steps of 15°)" data-testid="north-arrow">
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
