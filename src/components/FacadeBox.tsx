import { useState } from 'react';
import { coverOutside } from '../facade';
import { WALL_FINISHES, type WallFinish } from '../model';
import { FINISH_STYLES, PAINT_COLORS } from '../walls';
import { useDesign } from '../store/design';
import { useFloorId } from '../store/floor';
import { useUi } from '../store/ui';
import { ColorField } from './fields';
import { t } from '../i18n';

const CLADDING = WALL_FINISHES.filter((f) => f !== 'custom' && f !== 'marble' && f !== 'wallpaper');

/** Clad the whole house in one go: choose a covering and a color and put it on the outside of the exterior walls. */
export function FacadeBox() {
  const floor = useFloorId();
  const [finish, setFinish] = useState<WallFinish>('brick');
  const [color, setColor] = useState(FINISH_STYLES.brick.color);
  const [all, setAll] = useState(true);
  const apply = (skin: { finish: WallFinish; color: string } | null) => {
    const d = useDesign.getState().design;
    let n = 0;
    useDesign.getState().update((draft) => {
      n = coverOutside(draft, all ? d.floors.map((f) => f.id) : [floor], skin);
    });
    useUi.getState().showToast(n ? skin ? t('Covered the outside of {n} walls.', { n }) : t('Took the covering off the outside of {n} walls.', { n }) : t('There are no exterior walls to cover (draw walls of the type "Exterior").'));
  };
  return (
    <div className="facade-box" data-testid="facade-box">
      <h4>{t('Facade')}</h4>
      <p className="muted">{t('Cover the outside of all exterior walls with one finish.')}</p>
      <label className="field">
        <span>{t('Finish')}</span>
        <select
          value={finish}
          data-testid="facade-finish"
          onChange={(e) => {
            const f = e.target.value as WallFinish;
            setFinish(f);
            setColor(FINISH_STYLES[f].color);
          }}
        >
          {CLADDING.map((f) => (
            <option key={f} value={f}>
              {FINISH_STYLES[f].label}
            </option>
          ))}
        </select>
      </label>
      <ColorField label={t('Color')} value={color} swatches={PAINT_COLORS} onChange={setColor} />
      <label className="check">
        <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} data-testid="facade-all" />
        {t('All floors (not only this one)')}
      </label>
      <div className="row">
        <button onClick={() => apply({ finish, color })} data-testid="facade-apply">
          {t('Cover the outside')}
        </button>
        <button onClick={() => apply(null)} data-testid="facade-clear">
          {t('Take it off')}
        </button>
      </div>
    </div>
  );
}
