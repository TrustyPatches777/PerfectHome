import { useRef, useState } from 'react';
import { copyShareLink } from '../session';
import { readableOn } from '../identity';
import { leaveLive, liveUrl, startLive } from '../live/live';
import { useLive } from '../store/live';
import { useUi } from '../store/ui';

/** Start, share and leave a live session. */
export function LiveDialog() {
  const live = useLive();
  const me = useUi((s) => s.me);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const close = () => useUi.getState().setDialog(null);
  const url = live.id ? liveUrl(live.id) : '';

  const start = async () => {
    setBusy(true);
    try {
      const link = await startLive();
      if (link) setCopied(await copyShareLink(link));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={close}>
      <div className="modal" role="dialog" aria-label="Live session" onMouseDown={(e) => e.stopPropagation()} data-testid="live-dialog">
        <h2>Work together, live</h2>
        {!live.active ? (
          <>
            <p>
              Start a live session and send the link. Whoever opens it sees this design, and you both edit it at the same time: changes appear as they happen, with each
              other&apos;s mouse pointer. Undo only takes back your own changes.
            </p>
            <p className="muted">
              Nothing is uploaded: the computers connect directly to each other, and each of you keeps a full copy in your own browser. Both of you need to be online
              at the same time to see changes; anything done while the other is away is merged in when you meet again. Anybody who has the link can join and edit, so only send it to people you trust.
            </p>
            {!me && <p className="notice">Tip: set your name and color first (top right, “Who are you?”), so the other person sees who is who.</p>}
            <div className="row end">
              <button onClick={close}>Cancel</button>
              <button className="primary" onClick={() => void start()} disabled={busy} data-testid="live-start">
                Start a live session
              </button>
            </div>
          </>
        ) : (
          <>
            <p className={live.peers.length ? 'ok' : 'muted'} data-testid="live-status">
              {live.peers.length
                ? `✓ ${live.peers.length + 1} people are here.`
                : 'Waiting for the other person to open the link… You can keep working; they get everything when they arrive.'}
            </p>
            <div className="live-people" data-testid="live-people">
              {[{ id: 0, name: me?.name ?? 'You', color: me?.color ?? '#9ca3af' }, ...live.peers].map((p) => (
                <span key={p.id} className="live-person">
                  <span className="dot" style={{ background: p.color, color: readableOn(p.color) }}>
                    {p.name[0]?.toUpperCase()}
                  </span>
                  {p.name}
                  {p.id === 0 && ' (you)'}
                </span>
              ))}
            </div>
            <p className="muted">Send this link:</p>
            <textarea ref={ref} className="link-box" readOnly value={url} rows={3} aria-label="Live session link" data-testid="live-url" onFocus={(e) => e.currentTarget.select()} />
            {copied && <p className="ok">✓ Link copied to the clipboard.</p>}
            {!live.synced && live.peers.length === 0 && <p className="muted">If you joined through a link and the plan is empty, the person who started the session has to be online.</p>}
            <div className="row end">
              <button className="danger" style={{ marginRight: 'auto' }} onClick={() => (leaveLive(), close())} data-testid="live-leave">
                Leave the session
              </button>
              <button
                onClick={async () => {
                  setCopied(await copyShareLink(url));
                  if (!copied) ref.current?.select();
                }}
              >
                Copy link
              </button>
              <button className="primary" onClick={close}>
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
