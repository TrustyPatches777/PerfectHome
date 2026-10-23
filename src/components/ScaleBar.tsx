import { useUi } from '../store/ui';
import { formatLength, niceLength } from '../geometry';

/** Map-style scale indicator in real units: a bar whose label is a round number of meters. */
export function ScaleBar() {
  const zoom = useUi((s) => s.viewport.zoom);
  const length = niceLength(zoom, 70);
  const label = length < 1 ? formatLength(length) : `${length} m`;
  return (
    <div className="scale-bar" data-testid="scale-bar" data-length={length}>
      <div className="scale-bar-line" style={{ width: length * zoom }} />
      <span>{label}</span>
    </div>
  );
}
