import { SHORTCUT_HELP } from '../shortcuts';

export function HelpDialog({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" role="dialog" aria-label="Help" onMouseDown={(e) => e.stopPropagation()}>
        <h2>How it works</h2>
        <p className="muted">
          Everything is measured in real units: the grid snaps to the step you choose, and the scale bar in the corner
          shows the current zoom in meters.
        </p>
        <table className="help-table">
          <tbody>
            {SHORTCUT_HELP.map((s) => (
              <tr key={s.keys}>
                <td>
                  <kbd>{s.keys}</kbd>
                </td>
                <td>{s.what}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="row end">
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
