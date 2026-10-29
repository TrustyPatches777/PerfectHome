import { useMemo } from 'react';
import { findIssues } from '../checks';
import { setActiveFloorAndFocus } from '../floors';
import { useDesign } from '../store/design';
import { useFloorId } from '../store/floor';
import { useUi } from '../store/ui';
import { NumberField } from './fields';
import { t, useLang } from '../i18n';

/** "Check plan": lists what will not work in real life (doors that cannot open, furniture in walls, narrow passages). */
export function ChecksPanel() {
  const show = useUi((s) => s.showChecks);
  const minPassage = useUi((s) => s.minPassage);
  const design = useDesign((s) => s.design);
  const floor = useFloorId();
  const lang = useLang(); // texts worked out here follow the language
  const issues = useMemo(() => (show ? findIssues(design, floor, minPassage) : []), [show, design, floor, minPassage, lang]);

  return (
    <div className="panel" data-testid="checks-panel">
      <h3>
        {t('Plan check')} {show && <span className="count" data-testid="issue-count">{issues.length ? t('{length} to look at', { length: issues.length }) : t('all clear')}</span>}
      </h3>
      <label className="check">
        <input type="checkbox" checked={show} onChange={(e) => useUi.getState().setShowChecks(e.target.checked)} data-testid="checks-toggle" />
        {t('Look for problems on this floor')}
      </label>
      {show && (
        <>
          <NumberField label={t('Narrowest passage')} value={minPassage} scale={100} unit="cm" min={30} max={200} testId="min-passage" onCommit={(v) => useUi.getState().setMinPassage(v)} />
          {issues.length === 0 ? (
            <p className="ok">{t('No problems found: doors open, nothing stands in a wall, passages are wide enough.')}</p>
          ) : (
            <ul className="issues">
              {issues.map((i) => (
                <li key={i.id}>
                  <button className="issue" onClick={() => setActiveFloorAndFocus(floor, i.at, i.refs[i.refs.length - 1])} data-testid="issue">
                    <span className="issue-dot">!</span>
                    <span>{i.message}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
