/**
 * Moves Yjs updates between the people in a room, with no server of ours:
 *  - the browsers connect directly (WebRTC, encrypted); Trystero finds the other person through public relays (BitTorrent
 *    trackers and Nostr relays) using the room name, so the relays never see the design, only that a room exists;
 *  - tabs of the same browser also talk through a BroadcastChannel, which also works offline (and in tests).
 *
 * One message format on every channel: first byte = kind, rest = payload.
 */
import * as Y from 'yjs';
import { readTurn } from './relay';
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate, removeAwarenessStates } from 'y-protocols/awareness';
import { getRelaySockets as nostrSockets, joinRoom as joinNostr } from '@trystero-p2p/nostr';
import { getRelaySockets as torrentSockets, joinRoom as joinTorrent } from '@trystero-p2p/torrent';

const APP_ID = 'perfect-home-live-1';
const STATE_VECTOR = 0; // "this is what I have: send me the rest"
const UPDATE = 1; // a Yjs update
const AWARENESS = 2; // who is here, where their mouse is
const REMOTE = 'remote';

/** Set `localStorage['perfect-home:p2p'] = 'off'` to use only same-browser tabs (the end-to-end tests do). */
const networkOff = () => {
  try {
    return localStorage.getItem('perfect-home:p2p') === 'off';
  } catch {
    return false;
  }
};

const frame = (kind: number, body: Uint8Array) => {
  const out = new Uint8Array(body.length + 1);
  out[0] = kind;
  out.set(body, 1);
  return out;
};

function toBytes(data: unknown): Uint8Array | null {
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  return null;
}

export interface Transport {
  destroy: () => void;
  /** How many of the public connection services (the places that introduce two browsers to each other) this browser can reach right now. */
  status: () => { open: number; total: number; direct: boolean; relay: boolean; updatesIn: number; updatesOut: number; lastIn: number | null };
}

/** A way to reach other people: send to everybody, or to one who just spoke to us. */
interface Channel {
  broadcast: (msg: Uint8Array) => void;
  close: () => void;
}

export function connect(doc: Y.Doc, awareness: Awareness, room: string, password: string, onError?: (m: string) => void): Transport {
  const channels: Channel[] = [];
  /** awareness client ids last seen from each remote peer, to remove their cursor when they leave */
  const clientsOf = new Map<string, Set<number>>();

  const hello = () => frame(STATE_VECTOR, Y.encodeStateVector(doc));
  const myAwareness = () => frame(AWARENESS, encodeAwarenessUpdate(awareness, [doc.clientID]));

  // what arrived and what went out from here (shown in the Live dialog, to tell a blocked connection from a display problem)
  let updatesIn = 0;
  let updatesOut = 0;
  let lastIn: number | null = null;

  const handle = (msg: Uint8Array, reply: (m: Uint8Array) => void, from: string | null) => {
    const body = msg.subarray(1);
    if (from !== null) lastIn = Date.now();
    try {
      if (msg[0] === STATE_VECTOR) reply(frame(UPDATE, Y.encodeStateAsUpdate(doc, body)));
      else if (msg[0] === UPDATE) {
        Y.applyUpdate(doc, body, REMOTE);
        if (from !== null) updatesIn++;
      }
      else if (msg[0] === AWARENESS) {
        const seen = from ? (clientsOf.get(from) ?? clientsOf.set(from, new Set()).get(from)!) : null;
        const onChange = ({ added, updated }: { added: number[]; updated: number[] }) => seen && [...added, ...updated].forEach((c) => seen.add(c));
        awareness.on('change', onChange);
        applyAwarenessUpdate(awareness, body, REMOTE);
        awareness.off('change', onChange);
      }
    } catch (e) {
      onError?.(`Ignored a broken message: ${(e as Error).message}`);
    }
  };

  const send = (msg: Uint8Array) => channels.forEach((c) => c.broadcast(msg));

  // ---- same browser: tabs
  if (typeof BroadcastChannel !== 'undefined') {
    const bc = new BroadcastChannel(`perfect-home:${room}`);
    bc.onmessage = (e) => {
      const msg = toBytes(e.data);
      if (msg?.length) handle(msg, (m) => bc.postMessage(m), null);
    };
    channels.push({ broadcast: (m) => bc.postMessage(m), close: () => bc.close() });
  }

  // ---- other computers
  const leaves: (() => void | Promise<void>)[] = [];
  const turn = readTurn(); // a relay server for networks that block direct connections (optional)
  if (!networkOff()) {
    for (const join of [joinTorrent, joinNostr]) {
      try {
        const r = join({ appId: APP_ID, password, ...(turn ? { turnConfig: [{ urls: turn.urls, username: turn.username, credential: turn.credential }] } : {}) }, room);
        const action = r.makeAction<Uint8Array>('ph');
        action.onMessage = (data, { peerId }) => {
          const msg = toBytes(data);
          if (msg?.length) handle(msg, (m) => void action.send(m, { target: peerId }), peerId);
        };
        r.onPeerJoin = (peerId) => {
          void action.send(hello(), { target: peerId });
          void action.send(myAwareness(), { target: peerId });
        };
        r.onPeerLeave = (peerId) => {
          const gone = clientsOf.get(peerId);
          if (gone) removeAwarenessStates(awareness, [...gone], REMOTE);
          clientsOf.delete(peerId);
        };
        channels.push({ broadcast: (m) => void action.send(m).catch(() => undefined), close: () => void r.leave() });
        leaves.push(() => r.leave());
      } catch (e) {
        onError?.(`Could not reach one of the connection services: ${(e as Error).message}`);
      }
    }
  }

  // ---- local changes go out; everything that arrived stays where it is
  const onUpdate = (u: Uint8Array, origin: unknown) => {
    if (origin === REMOTE) return;
    updatesOut++;
    send(frame(UPDATE, u));
  };
  const onAwareness = ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }, origin: unknown) => {
    if (origin === REMOTE) return;
    send(frame(AWARENESS, encodeAwarenessUpdate(awareness, [...added, ...updated, ...removed])));
  };
  doc.on('update', onUpdate);
  awareness.on('update', onAwareness);

  // tell the other tabs/people what we have, and who we are
  send(hello());
  send(myAwareness());
  // anybody who opens the room later says hello themselves; this repeat covers a missed first message
  // and ask for what we may have missed (a message lost on a bad connection would otherwise leave us behind for good)
  const again = setInterval(() => {
    send(myAwareness());
    send(hello());
  }, 15_000);

  return {
    status: () => {
      let open = 0;
      let total = 0;
      if (!networkOff()) {
        for (const sockets of [torrentSockets, nostrSockets]) {
          try {
            for (const s of Object.values(sockets() as Record<string, { readyState?: number }>)) {
              total++;
              if (s?.readyState === 1) open++;
            }
          } catch {
            /* the services report nothing: counted as none */
          }
        }
      }
      return { open, total, direct: !networkOff(), relay: !!turn, updatesIn, updatesOut, lastIn };
    },
    destroy: () => {
      clearInterval(again);
      doc.off('update', onUpdate);
      awareness.off('update', onAwareness);
      channels.forEach((c) => c.close());
    },
  };
}
