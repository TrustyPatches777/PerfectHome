import { addAttic, addFloor, deleteFloor, duplicateFloor, rebuildAttic, renameFloor, setGroundLevel, setStoreyHeight } from '../floors';
import { NumberField } from './fields';
import { useDesign } from '../store/design';
import { floorBelow, isBasement, useFloorId } from '../store/floor';
import { useUi } from '../store/ui';
import { FloorTools } from './FloorTools';
import { t } from '../i18n';

/** The list of floors (highest first) with add / duplicate / rename / delete for the active one. */
export function FloorsPanel() {
  const floors = useDesign((s) => s.design.floors);
  const active = useFloorId();
  const underlay = useUi((s) => s.showUnderlay);
  const current = floors.find((f) => f.id === active)!;
  const hasBelow = !!floorBelow(useDesign.getState().design, active);
  const basement = isBasement(current);
  const top = floors[floors.length - 1];
  const roofs = useDesign((s) => s.design.roofs);
  const walls = useDesign((s) => s.design.walls);
  const storey = useDesign((s) => s.design.settings.storeyHeight);
  const groundLevel = useDesign((s) => s.design.settings.groundLevel ?? 0);
  const canAttic = !top.attic && (roofs.some((r) => r.floor === top.id && r.kind !== 'flat') || walls.some((w) => w.floor === top.id));

  return (
    <div className="panel" data-testid="floors">
      <h3>{t('Floors')}</h3>
      <ul className="floor-list">
        {[...floors].reverse().map((f) => (
          <li key={f.id}>
            <button
              className={`floor-item ${f.id === active ? 'active' : ''}`}
              onClick={() => useUi.getState().setActiveFloor(f.id)}
              aria-pressed={f.id === active}
              data-testid={`floor-${f.name}`}
            >
              {t(f.name)}
            </button>
          </li>
        ))}
      </ul>
      <label className="field">
        <span>{t('Name of this floor')}</span>
        <input type="text" value={t(current.name)} data-testid="floor-name" onChange={(e) => renameFloor(active, e.target.value)} />
      </label>
      <div className="row">
        <button onClick={() => addFloor('above')} title={t('Add an empty floor above this one')} data-testid="add-floor">
          {t('+ Floor above')}
        </button>
        <button onClick={() => addFloor('basement')} title={t('Add a basement below everything')} data-testid="add-basement">
          {t('+ Basement')}
        </button>
      </div>
      <div className="row">
        <button onClick={addAttic} disabled={!canAttic} title={canAttic ? t('Build the space under the roof of the top floor (a pitched roof is fitted to its walls when there is none)') : t('An attic needs walls on the top floor (and there can be only one attic)')} data-testid="add-attic">
          {t('+ Attic')}
        </button>
        {current.attic && (
          <button onClick={rebuildAttic} title={t('Make the attic floor again from the rooms below, after the walls or roof changed')} data-testid="rebuild-attic">
            {t('Rebuild from the roof')}
          </button>
        )}
      </div>
      <NumberField label={t('Storey height (all floors)')} value={storey} scale={100} unit="cm" min={180} max={600} testId="storey-height" onCommit={setStoreyHeight} />
      <NumberField label={t('Ground floor above the ground outside')} value={groundLevel} scale={100} unit="cm" min={-1000} max={1000} testId="ground-level" onCommit={setGroundLevel} />
      <div className="row">
        <button onClick={duplicateFloor} title={t('Copy everything on this floor to a new floor above')} data-testid="duplicate-floor">
          {t('Duplicate floor')}
        </button>
        <button className="danger" onClick={() => deleteFloor(active)} disabled={floors.length < 2} data-testid="delete-floor">
          {t('Delete floor')}
        </button>
      </div>
      <label className="check">
        <input
          type="checkbox"
          checked={underlay}
          disabled={!hasBelow}
          onChange={(e) => useUi.getState().setShowUnderlay(e.target.checked)}
          data-testid="underlay-toggle"
        />
        {basement ? t('Show the floor above faintly') : t('Show the floor below faintly')}
      </label>
      <FloorTools />
    </div>
  );
}
