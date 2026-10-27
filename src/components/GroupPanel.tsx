import { alignSelection, copySelection, deleteSelection, distributeSelection, duplicateSelection, rotateSelection } from '../actions';
import type { ItemKind } from '../model';
import type { AlignMode } from '../selection';
import { useUi } from '../store/ui';

const NAMES: Record<ItemKind, [string, string]> = {
  wall: ['wall', 'walls'],
  opening: ['opening', 'openings'],
  room: ['room', 'rooms'],
  furniture: ['piece of furniture', 'pieces of furniture'],
  label: ['label', 'labels'],
  dimension: ['measurement', 'measurements'],
  zone: ['outdoor area', 'outdoor areas'],
  strip: ['street / fence / path', 'streets, fences & paths'],
  stair: ['staircase', 'staircases'],
  roof: ['roof', 'roofs'],
  skylight: ['skylight', 'skylights'],
  note: ['sticky note', 'sticky notes'],
  guide: ['guide', 'guides'],
};

const ALIGN: { mode: AlignMode; label: string; title: string; icon: string }[] = [
  { mode: 'left', label: 'Left', title: 'Align left edges', icon: 'M3 2v16M6 5h11v4H6zM6 11h7v4H6z' },
  { mode: 'center', label: 'Center', title: 'Center horizontally', icon: 'M10 2v16M4 5h12v4H4zM6 11h8v4H6z' },
  { mode: 'right', label: 'Right', title: 'Align right edges', icon: 'M17 2v16M3 5h11v4H3zM7 11h7v4H7z' },
  { mode: 'top', label: 'Top', title: 'Align top edges', icon: 'M2 3h16M5 6h4v11H5zM11 6h4v7h-4z' },
  { mode: 'middle', label: 'Middle', title: 'Center vertically', icon: 'M2 10h16M5 4h4v12H5zM11 6h4v8h-4z' },
  { mode: 'bottom', label: 'Bottom', title: 'Align bottom edges', icon: 'M2 17h16M5 3h4v11H5zM11 7h4v7h-4z' },
];

/** Shown instead of the single-item properties when several things are selected. */
export function GroupPanel() {
  const selected = useUi((s) => s.selected);
  const counts = new Map<ItemKind, number>();
  for (const r of selected) counts.set(r.kind, (counts.get(r.kind) ?? 0) + 1);
  const summary = [...counts].map(([k, n]) => `${n} ${NAMES[k][n > 1 ? 1 : 0]}`).join(', ');
  const movable = selected.filter((r) => r.kind !== 'opening').length;

  return (
    <div className="panel" data-testid="group-panel">
      <h3>{selected.length} selected</h3>
      <p className="muted">{summary}</p>
      <div className="field">
        <span>Align</span>
        <div className="icon-row">
          {ALIGN.map((a) => (
            <button key={a.mode} className="icon" title={a.title} aria-label={a.title} onClick={() => alignSelection(a.mode)} data-testid={`align-${a.mode}`} disabled={movable < 2}>
              <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d={a.icon} />
              </svg>
            </button>
          ))}
        </div>
      </div>
      <div className="row">
        <button onClick={() => distributeSelection('x')} disabled={movable < 3} title="Equal gaps from left to right" data-testid="distribute-x">
          Distribute ↔
        </button>
        <button onClick={() => distributeSelection('y')} disabled={movable < 3} title="Equal gaps from top to bottom" data-testid="distribute-y">
          Distribute ↕
        </button>
      </div>
      <div className="row">
        <button onClick={() => rotateSelection(90)} title="Rotate the whole selection 90° (R)" data-testid="group-rotate">
          Rotate 90°
        </button>
        <button onClick={copySelection} title="Ctrl+C">
          Copy
        </button>
        <button onClick={duplicateSelection} title="Ctrl+D" data-testid="group-duplicate">
          Duplicate
        </button>
        <button className="danger" onClick={deleteSelection} title="Delete" data-testid="group-delete">
          Delete
        </button>
      </div>
      <p className="muted">Shift+click adds or removes items · Shift+drag on empty space selects a box · Ctrl+A selects all.</p>
    </div>
  );
}
