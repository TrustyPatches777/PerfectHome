import { stepFloor } from '../floors';
import { useDesign } from '../store/design';
import { useFloorId } from '../store/floor';

/** Small floor indicator floating on the canvas, with up/down buttons (Page Up / Page Down). */
export function FloorSwitcher() {
  const floors = useDesign((s) => s.design.floors);
  const active = useFloorId();
  const index = floors.findIndex((f) => f.id === active);
  if (floors.length < 2) return null;
  return (
    <div className="floor-switcher" data-testid="floor-switcher">
      <button onClick={() => stepFloor(1)} disabled={index >= floors.length - 1} title="Floor above (Page Up)" aria-label="Floor above">
        ▲
      </button>
      <strong data-testid="floor-current">{floors[index].name}</strong>
      <button onClick={() => stepFloor(-1)} disabled={index <= 0} title="Floor below (Page Down)" aria-label="Floor below">
        ▼
      </button>
    </div>
  );
}
