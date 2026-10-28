import { useEffect, useRef, useState } from 'react';
import { copyShareLink } from '../session';
import { readableOn } from '../identity';
import { leaveLive, liveNetwork, liveUrl, startLive } from '../live/live';
import { parseTurn, readTurn, saveTurn, testTurn, turnSource } from '../live/relay';
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
  const [net, setNet] = useState(liveNetwork);
  useEffect(() => {
    const t = setInterval(() => setNet(liveNetwork()), 2000);
    return () => clearInterval(t);
  }, []);

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
            <RelaySettings />
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
            {net && live.peers.length === 0 && net.direct && (
              <p className={net.open ? 'muted' : 'notice'} data-testid="live-network">
                {net.open
                  ? `Connection services reachable: ${net.open} of ${net.total}. If the other person has opened this exact link and still does not show up after a minute, one of your networks probably blocks direct connections (some mobile hotspots, work or school networks, VPNs): try another network, or turn the VPN off.`
                  : 'This browser cannot reach any of the services that introduce you to the other person (a firewall, VPN or ad blocker may be in the way). Until it can, you will not find each other; you can still work on this design alone.'}
              </p>
            )}
            {net?.direct && live.peers.length > 0 && (
              <p className="muted" data-testid="live-traffic">
                Changes sent from here: {net.updatesOut}. Changes received from the others: {net.updatesIn}
                {net.lastIn ? ` (the last ${Math.max(0, Math.round((Date.now() - net.lastIn) / 1000))} s ago)` : ''}.
                {net.updatesIn === 0 && ' Nothing has arrived from them yet: if they have changed something, the connection between you is dropping the larger messages.'}
              </p>
            )}
            <p className="muted">Send this link:</p>
            <textarea ref={ref} className="link-box" readOnly value={url} rows={3} aria-label="Live session link" data-testid="live-url" onFocus={(e) => e.currentTarget.select()} />
            {copied && <p className="ok">✓ Link copied to the clipboard.</p>}
            {!live.synced && live.peers.length === 0 && <p className="muted">If you joined through a link and the plan is empty, the person who started the session has to be online.</p>}
            <RelaySettings />
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

/** A relay (TURN) server for networks that block direct connections: typed in here, kept in this browser, used the next time a session opens. */
function RelaySettings() {
  const have = readTurn();
  const [urls, setUrls] = useState((have?.urls ?? []).join('\n'));
  const [user, setUser] = useState(have?.username ?? '');
  const [pass, setPass] = useState(have?.credential ?? '');
  const [state, setState] = useState<{ kind: 'ok' | 'bad' | 'busy'; text: string } | null>(null);
  const source = turnSource();
  const typed = () => parseTurn(urls, user, pass);

  const test = async () => {
    const cfg = typed();
    if (!cfg) return setState({ kind: 'bad', text: 'Fill in the address (starting with turn: or turns:), the user name and the password.' });
    setState({ kind: 'busy', text: 'Trying the relay…' });
    const r = await testTurn(cfg);
    setState(r.ok ? { kind: 'ok', text: '✓ The relay works.' } : { kind: 'bad', text: r.reason ?? 'The relay did not answer.' });
  };
  const save = () => {
    const cfg = typed();
    if (!cfg) return setState({ kind: 'bad', text: 'Fill in the address (starting with turn: or turns:), the user name and the password.' });
    setState(saveTurn(cfg) ? { kind: 'ok', text: 'Saved. It is used when a session opens: reload this page (the link stays the same) to use it now. The other person needs the same relay.' } : { kind: 'bad', text: 'This browser would not keep it.' });
  };
  const forget = () => {
    saveTurn(null);
    setUrls('');
    setUser('');
    setPass('');
    setState({ kind: 'ok', text: 'Removed.' });
  };

  return (
    <details className="relay-box" data-testid="relay-box">
      <summary>Relay server{source ? (source === 'typed' ? ' (set)' : ' (built into this site)') : ''}</summary>
      <p className="muted">
        For networks that block direct connections (schools, companies, some mobile hotspots). Get the details from a TURN service and paste them here; the traffic then goes through that
        server, still encrypted. It is kept in this browser only and is never part of a link. Both of you need it.
      </p>
      <label className="field">
        <span>Address (one per line, e.g. turns:… :443?transport=tcp)</span>
        <textarea rows={3} value={urls} onChange={(e) => setUrls(e.target.value)} data-testid="relay-urls" spellCheck={false} />
      </label>
      <label className="field">
        <span>User name</span>
        <input value={user} onChange={(e) => setUser(e.target.value)} data-testid="relay-user" spellCheck={false} autoComplete="off" />
      </label>
      <label className="field">
        <span>Password</span>
        <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} data-testid="relay-pass" autoComplete="off" />
      </label>
      {state && (
        <p className={state.kind === 'ok' ? 'ok' : state.kind === 'bad' ? 'notice' : 'muted'} data-testid="relay-state">
          {state.text}
        </p>
      )}
      <div className="row end">
        {source === 'typed' && (
          <button style={{ marginRight: 'auto' }} onClick={forget} data-testid="relay-forget">
            Remove
          </button>
        )}
        <button onClick={() => void test()} data-testid="relay-test">
          Test
        </button>
        <button onClick={save} data-testid="relay-save">
          Save
        </button>
      </div>
    </details>
  );
}
