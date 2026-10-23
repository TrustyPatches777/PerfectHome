import { useState } from 'react';
import { readableOn } from '../identity';
import { useDesign } from '../store/design';
import { setActiveFloorAndFocus } from '../floors';

/** All sticky notes in the design, open ones first: click one to go to it. */
export function NotesPanel() {
  const notes = useDesign((s) => s.design.notes);
  const floors = useDesign((s) => s.design.floors);
  const visible = useDesign((s) => s.design.layers.comments.visible);
  const [showDone, setShowDone] = useState(false);
  if (!notes.length) return null;
  const open = notes.filter((n) => !n.done);
  const done = notes.filter((n) => n.done);
  const list = showDone ? [...open, ...done] : open;
  const floorName = (id: string) => floors.find((f) => f.id === id)?.name ?? '';

  return (
    <div className="panel" data-testid="notes-panel">
      <h3>
        Sticky notes <span className="count">{open.length} open</span>
      </h3>
      {!visible && <p className="notice">The notes layer is hidden. Show it in Layers.</p>}
      <ul className="notes-list">
        {list.map((n) => (
          <li key={n.id}>
            <button className={`note-item ${n.done ? 'done' : ''}`} onClick={() => setActiveFloorAndFocus(n.floor, { x: n.x, y: n.y }, { kind: 'note', id: n.id })} data-testid="note-item">
              <span className="dot" style={{ background: n.color, color: readableOn(n.color) }}>
                {n.done ? '✓' : (n.author[0] ?? '?').toUpperCase()}
              </span>
              <span className="note-text">
                {n.text || <em>(empty)</em>}
                <small>
                  {n.author || 'someone'}
                  {floors.length > 1 ? ` · ${floorName(n.floor)}` : ''}
                </small>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {done.length > 0 && (
        <label className="check">
          <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} data-testid="show-done" />
          Show {done.length} done
        </label>
      )}
    </div>
  );
}
