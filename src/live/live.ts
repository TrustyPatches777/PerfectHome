/**
 * Working on the same design at the same time. Start a session and send the link; whoever opens it joins the same design.
 *
 * Every person keeps a full copy in their own browser (saved there as well, so a session can be reopened), and changes are
 * merged as they happen (see crdt.ts). Nothing is stored on a server. The session is a Yjs document in a "room" whose name and
 * password are random and live only in the link (`#live=room.key`); anybody with the link can join and edit.
 */
import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import { Awareness } from 'y-protocols/awareness';
import { fitView } from '../canvas/camera';
import { createDesign, type Design, type ItemRef } from '../model';
import { BACKUP_KEY, isEmptyDesign, writeSaved } from '../share';
import { setLiveBridge, useDesign } from '../store/design';
import { floorId } from '../store/floor';
import { useLive, type Peer } from '../store/live';
import { useUi } from '../store/ui';
import { LOCAL, SEED, designTypes, hasDesign, readDesign, writeChange } from './crdt';
import { connect, type Transport } from './transport';
import { t } from '../i18n';

const toast = (m: string) => useUi.getState().showToast(m);

interface Active {
  id: string;
  doc: Y.Doc;
  awareness: Awareness;
  undo: Y.UndoManager;
  persistence: IndexeddbPersistence;
  transport: Transport;
  stop: (() => void)[];
}
let active: Active | null = null;

export const isLive = () => active !== null;

// ---- links ----------------------------------------------------------------------------------------

const randomId = (n: number) => {
  const bytes = crypto.getRandomValues(new Uint8Array(n));
  return Array.from(bytes, (b) => (b % 36).toString(36)).join('');
};
export const newLiveId = () => `${randomId(14)}.${randomId(14)}`;

/** `#live=room.key` -> "room.key", or null. */
export function parseLiveHash(hash: string): string | null {
  const m = /^#live=([a-z0-9]{8,40}\.[a-z0-9]{8,40})$/.exec(hash);
  return m ? m[1] : null;
}

export const liveUrl = (id: string) => `${location.origin}${location.pathname}${location.search}#live=${id}`;

// ---- helpers --------------------------------------------------------------------------------------

const KEY_OF_KIND: Record<ItemRef['kind'], keyof Design> = {
  wall: 'walls',
  opening: 'openings',
  room: 'rooms',
  furniture: 'furniture',
  label: 'labels',
  dimension: 'dimensions',
  zone: 'zones',
  strip: 'strips',
  stair: 'stairs',
  roof: 'roofs',
  skylight: 'skylights',
  note: 'notes',
  guide: 'guides',
};

/** Forget selected things that somebody else (or an undo) just removed. */
function pruneSelection(d: Design) {
  const ui = useUi.getState();
  const exists = (r: ItemRef) => (d[KEY_OF_KIND[r.kind]] as { id: string }[]).some((i) => i.id === r.id);
  if (ui.selected.every(exists)) return;
  ui.setSelected(ui.selected.filter(exists));
}

function colorOfClient(id: number) {
  return ['#60a5fa', '#f472b6', '#4ade80', '#fb923c', '#a78bfa', '#2dd4bf', '#f87171', '#facc15'][id % 8];
}

function readPeers(awareness: Awareness): Peer[] {
  const out: Peer[] = [];
  awareness.getStates().forEach((s, id) => {
    if (id === awareness.clientID || !s.user) return;
    const u = s.user as { name?: string; color?: string; floor?: string | null; cursor?: { x: number; y: number } | null };
    out.push({ id, name: u.name || 'Guest', color: u.color || colorOfClient(id), floor: u.floor ?? null, cursor: u.cursor ?? null });
  });
  return out.sort((a, b) => a.id - b.id);
}

// ---- start / join / leave -----------------------------------------------------------------------

interface Opened {
  id: string;
  doc: Y.Doc;
  persistence: IndexeddbPersistence;
}

/** Open (or create) this device's copy of a room. Nothing visible changes yet. */
async function openRoom(id: string): Promise<Opened> {
  const doc = new Y.Doc();
  const persistence = new IndexeddbPersistence(`perfect-home:live:${id.split('.')[0]}`, doc);
  // a browser that blocks storage still works, just without a saved copy
  await Promise.race([persistence.whenSynced, new Promise((r) => setTimeout(r, 3000))]);
  return { id, doc, persistence };
}

function discard(o: Opened) {
  void o.persistence.destroy();
  o.doc.destroy();
}

/** Put the current design in the shared room and start sharing it. Returns the link to send. */
export async function startLive(): Promise<string | null> {
  if (active) return liveUrl(active.id);
  const o = await openRoom(newLiveId());
  writeChange(o.doc, null, useDesign.getState().design, SEED);
  attach(o, true);
  return liveUrl(o.id);
}

/**
 * Join the session of a link. A first visit replaces the design on screen (the old one is kept under
 * File → Restore previous design, after asking), later visits just reopen the session with the saved copy.
 */
export async function joinLive(id: string): Promise<void> {
  if (active) {
    if (active.id === id) return;
    return toast(t('You are already in a live session. Leave it first (Live button).'));
  }
  const o = await openRoom(id);
  const current = useDesign.getState().design;
  if (hasDesign(o.doc) || isEmptyDesign(current)) return attach(o);

  useUi.getState().setDialog({
    type: 'confirm',
    title: t('Join the live session?'),
    message: t('You will work on the shared design together. Your own design “{name}” is kept under File → Restore previous design.', { name: current.name }),
    confirmLabel: 'Join',
    onConfirm: () => attach(o),
  });
  // closing the question with Cancel leaves the room unopened
  const unsub = useUi.subscribe((s) => {
    if (s.dialog?.type === 'confirm') return;
    unsub();
    setTimeout(() => {
      if (!active) {
        discard(o);
        if (parseLiveHash(location.hash)) history.replaceState(null, '', location.pathname + location.search);
      }
    }, 0);
  });
}

/** `fromScreen`: the room was just filled with the design that is on screen, so nothing has to be reloaded or re-framed. */
function attach(o: Opened, fromScreen = false) {
  const { id, doc, persistence } = o;
  const store = useDesign;
  const stop: (() => void)[] = [];

  // what is on screen now: the shared design if there is one, otherwise a blank sheet until it arrives
  const had = hasDesign(doc);
  if (!had) {
    const current = store.getState().design;
    if (!isEmptyDesign(current)) writeSaved(BACKUP_KEY, current);
    store.getState().load(createDesign());
  }

  // undo/redo now belong to the shared document; the history from before the session is not part of it
  store.setState({ past: [], future: [], txBase: null });
  const undo = new Y.UndoManager(designTypes(doc), { trackedOrigins: new Set([LOCAL]), captureTimeout: 1e9 });
  const depth = () => store.setState({ liveUndo: undo.undoStack.length, liveRedo: undo.redoStack.length });
  undo.on('stack-item-added', depth);
  undo.on('stack-item-popped', depth);
  undo.on('stack-cleared', depth);

  // anything that did not come from this computer's own edits is shown
  let first = !fromScreen;
  const show = () => {
    const prev = store.getState().design;
    const next = readDesign(doc, first ? null : prev);
    if (!next) return;
    if (next !== prev) {
      store.setState({ design: next });
      pruneSelection(next);
    }
    if (!useLive.getState().synced) useLive.setState({ synced: true });
    if (first) {
      first = false;
      useUi.getState().setActiveFloor(next.floors[0].id);
      fitView(next);
    }
  };
  const onTransaction = (t: Y.Transaction) => {
    if (t.origin === LOCAL) return;
    show();
  };
  doc.on('afterTransaction', onTransaction);
  stop.push(() => doc.off('afterTransaction', onTransaction));

  setLiveBridge({
    push: (prev, next) => writeChange(doc, prev, next, LOCAL),
    boundary: () => undo.stopCapturing(),
    undo: () => void undo.undo(),
    redo: () => void undo.redo(),
  });
  stop.push(() => setLiveBridge(null));

  // who is here
  const awareness = new Awareness(doc);
  const me = () => useUi.getState().me;
  const publish = (cursor = useUi.getState().cursor) =>
    awareness.setLocalStateField('user', { name: me()?.name ?? 'Guest', color: me()?.color ?? colorOfClient(doc.clientID), floor: floorId(), cursor });
  publish(null);
  const onPeers = () => useLive.setState({ peers: readPeers(awareness) });
  awareness.on('change', onPeers);
  stop.push(() => awareness.off('change', onPeers));

  let timer: ReturnType<typeof setTimeout> | undefined;
  const unsubUi = useUi.subscribe((s, prev) => {
    if (s.cursor === prev.cursor && s.activeFloor === prev.activeFloor && s.me === prev.me) return;
    if (timer) return;
    timer = setTimeout(() => {
      timer = undefined;
      publish();
    }, 50);
  });
  stop.push(unsubUi, () => clearTimeout(timer));
  const goodbye = () => awareness.setLocalState(null);
  window.addEventListener('pagehide', goodbye);
  stop.push(() => window.removeEventListener('pagehide', goodbye));

  const transport = connect(doc, awareness, id.split('.')[0], id.split('.')[1], toast);

  active = { id, doc, awareness, undo, persistence, transport, stop };
  useLive.setState({ active: true, id, synced: false, peers: [] });
  history.replaceState(null, '', `${location.pathname}${location.search}#live=${id}`);
  depth();
  if (hasDesign(doc)) show();
  onPeers();
}

/** Stop sharing. The design stays on screen as your own copy. */
export function leaveLive() {
  if (!active) return;
  const a = active;
  active = null;
  a.awareness.setLocalState(null);
  a.stop.forEach((f) => f());
  a.transport.destroy();
  a.awareness.destroy();
  a.undo.destroy();
  void a.persistence.destroy();
  a.doc.destroy();
  useDesign.setState({ past: [], future: [], liveUndo: 0, liveRedo: 0, txBase: null });
  useLive.setState({ active: false, id: null, synced: false, peers: [] });
  if (parseLiveHash(location.hash)) history.replaceState(null, '', location.pathname + location.search);
  toast(t('You left the live session. You keep your own copy of the design.'));
}

/** After something else touched the address bar, put the session link back so a reload rejoins. */
export function restoreLiveHash() {
  if (active) history.replaceState(null, '', `${location.pathname}${location.search}#live=${active.id}`);
}

/** Can this browser reach the services that introduce it to the other person? Null outside a session. */
export const liveNetwork = () => active?.transport.status() ?? null;

/** Test/debug access. */
export const liveDoc = () => active?.doc ?? null;
