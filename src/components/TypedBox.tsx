import { describeTyped } from '../typed';
import { useUi } from '../store/ui';
import { t } from '../i18n';

/** Floats next to the cursor while you type an exact length, and shows how it is understood. */
export function TypedBox() {
  const typed = useUi((s) => s.typed);
  const cursor = useUi((s) => s.cursor);
  const v = useUi((s) => s.viewport);
  if (typed === null) return null;
  const x = cursor ? cursor.x * v.zoom + v.x + 18 : 40;
  const y = cursor ? cursor.y * v.zoom + v.y + 18 : 40;
  return (
    <div className="typed-box" style={{ left: x, top: y }} data-testid="typed-box">
      <span className="typed-text" data-testid="typed-text">
        {typed}
        <i className="caret" />
      </span>
      <span className="typed-meaning">= {describeTyped(typed)}</span>
      <span className="typed-hint">{t('Enter ✓ · Esc ✗ · add <45 for an angle')}</span>
    </div>
  );
}
