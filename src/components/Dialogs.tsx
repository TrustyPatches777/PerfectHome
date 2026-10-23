import { useEffect, useRef } from 'react';
import { copyShareLink } from '../session';
import { useUi, type DialogState } from '../store/ui';

/** Renders whichever modal is open (ui.dialog). */
export function Dialogs() {
  const dialog = useUi((s) => s.dialog);
  if (!dialog) return null;
  if (dialog.type === 'share') return <ShareDialog url={dialog.url} copied={dialog.copied} long={dialog.long} />;
  if (dialog.type === 'confirm') return <ConfirmDialog dialog={dialog} />;
  return <ConflictDialog dialog={dialog} />;
}

function ShareDialog({ url, copied, long }: { url: string; copied: boolean; long: boolean }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const close = () => useUi.getState().setDialog(null);
  useEffect(() => ref.current?.select(), []);
  return (
    <div className="modal-backdrop" onMouseDown={close}>
      <div className="modal" role="dialog" aria-label="Share" onMouseDown={(e) => e.stopPropagation()} data-testid="share-dialog">
        <h2>Share your design</h2>
        <p className={copied ? 'ok' : 'muted'} data-testid="share-status">
          {copied ? '✓ Link copied to the clipboard. Paste it into a message.' : 'Copy this link and send it:'}
        </p>
        <textarea ref={ref} className="link-box" readOnly value={url} rows={4} aria-label="Share link" data-testid="share-url" onFocus={(e) => e.currentTarget.select()} />
        <p className="muted">
          The whole design is inside the link ({url.length.toLocaleString()} characters), so nothing is uploaded anywhere. Whoever opens it gets their
          own copy and their changes stay in their browser. For a new version, share a new link.
        </p>
        {long && (
          <p className="notice">
            This link is quite long. Some chat apps may shorten or cut it. If it does not open, use File → Export JSON and send the file instead.
          </p>
        )}
        <div className="row end">
          <button
            onClick={async () => {
              if (await copyShareLink(url)) useUi.getState().showToast('Link copied.');
              else ref.current?.select();
            }}
          >
            Copy again
          </button>
          <button className="primary" onClick={close}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function ConflictDialog({ dialog }: { dialog: Extract<DialogState, { type: 'link-conflict' }> }) {
  const { incoming, current, sameDesign, choose } = dialog;
  return (
    <div className="modal-backdrop">
      <div className="modal" role="dialog" aria-label="Open shared design" data-testid="conflict-dialog">
        <h2>Open the shared design?</h2>
        <p>
          {sameDesign ? (
            <>
              You already have a copy of <strong>“{incoming.name}”</strong> in this browser, and it is different from the one in the link.
            </>
          ) : (
            <>
              This link contains <strong>“{incoming.name}”</strong>. You are currently working on <strong>“{current.name}”</strong>.
            </>
          )}
        </p>
        <p className="muted">Either way nothing is lost: if you open the shared one, your current design is kept under File → Restore previous design.</p>
        <div className="row end">
          <button onClick={() => choose(false)} data-testid="keep-mine">
            Keep my design
          </button>
          <button className="primary" onClick={() => choose(true)} data-testid="open-shared">
            Open the shared design
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmDialog({ dialog }: { dialog: Extract<DialogState, { type: 'confirm' }> }) {
  const close = () => useUi.getState().setDialog(null);
  return (
    <div className="modal-backdrop" onMouseDown={close}>
      <div className="modal" role="dialog" aria-label={dialog.title} onMouseDown={(e) => e.stopPropagation()} data-testid="confirm-dialog">
        <h2>{dialog.title}</h2>
        <p>{dialog.message}</p>
        <div className="row end">
          <button onClick={close}>Cancel</button>
          <button
            className="primary"
            data-testid="confirm-ok"
            onClick={() => {
              close();
              dialog.onConfirm();
            }}
          >
            {dialog.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
