import { setLayerFlag } from '../actions';
import { LAYER_IDS, LAYER_LABELS } from '../model';
import { useDesign } from '../store/design';

const Eye = ({ off }: { off: boolean }) => (
  <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M2 10s3-5.5 8-5.5S18 10 18 10s-3 5.5-8 5.5S2 10 2 10z" />
    <circle cx="10" cy="10" r="2.3" />
    {off && <path d="M3 17L17 3" />}
  </svg>
);

const Lock = ({ open }: { open: boolean }) => (
  <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="4.5" y="9" width="11" height="8" rx="1.5" />
    <path d={open ? 'M7 9V6.5a3 3 0 0 1 5.8-1' : 'M7 9V6.5a3 3 0 0 1 6 0V9'} />
  </svg>
);

/** Hide or lock groups of items. Lock "Walls" so they cannot be moved by accident while you arrange furniture. */
export function LayersPanel() {
  const layers = useDesign((s) => s.design.layers);
  return (
    <div className="panel" data-testid="layers">
      <h3>Layers</h3>
      <ul className="layers">
        {LAYER_IDS.map((id) => {
          const l = layers[id];
          return (
            <li key={id} className={l.visible ? '' : 'dim'}>
              <span className="layer-name">{LAYER_LABELS[id]}</span>
              <button
                className={`icon ${l.visible ? '' : 'active'}`}
                onClick={() => setLayerFlag(id, 'visible', !l.visible)}
                title={l.visible ? 'Hide' : 'Show'}
                aria-label={`${l.visible ? 'Hide' : 'Show'} ${LAYER_LABELS[id]}`}
                aria-pressed={!l.visible}
                data-testid={`hide-${id}`}
              >
                <Eye off={!l.visible} />
              </button>
              {id !== 'shadows' && (
              <button
                  className={`icon ${l.locked ? 'active' : ''}`}
                  onClick={() => setLayerFlag(id, 'locked', !l.locked)}
                  title={l.locked ? 'Unlock' : 'Lock so it cannot be changed'}
                  aria-label={`${l.locked ? 'Unlock' : 'Lock'} ${LAYER_LABELS[id]}`}
                  aria-pressed={l.locked}
                  data-testid={`lock-${id}`}
                >
                  <Lock open={!l.locked} />
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
