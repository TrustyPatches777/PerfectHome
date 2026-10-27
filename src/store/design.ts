import { create } from 'zustand';
import { produce, type Draft } from 'immer';
import { syncCustomItems } from '../catalog';
import { settleFurniture } from '../fit';
import { createDesign, type Design } from '../model';
import { notify } from './notice';

const HISTORY_LIMIT = 100;

/**
 * While working together live (src/live/), the shared Yjs document is the truth: every edit is also written to it, and undo/redo
 * only take back YOUR changes. The bridge is how this store talks to it without importing the network code.
 */
export interface LiveBridge {
  /** An edit was made locally: write the difference into the shared document. */
  push: (prev: Design, next: Design) => void;
  /** Close the current undo step (a gesture starts or ends, or a separate edit begins). */
  boundary: () => void;
  undo: () => void;
  redo: () => void;
}
let bridge: LiveBridge | null = null;
export const setLiveBridge = (b: LiveBridge | null) => {
  bridge = b;
};

interface DesignStore {
  design: Design;
  past: Design[];
  future: Design[];
  /** Design as it was when a gesture (drag, draw...) began; the gesture becomes ONE undo step. */
  txBase: Design | null;
  /** How many steps of YOUR changes can be undone/redone while live (past/future above are unused then). */
  liveUndo: number;
  liveRedo: number;

  /** Apply an edit. Each call is one undo step unless a transaction is open. */
  update: (recipe: (d: Draft<Design>) => void) => void;
  beginTx: () => void;
  endTx: () => void;
  undo: () => void;
  redo: () => void;
  /** Replace the whole design (load/import/new) and clear the history. */
  load: (design: Design) => void;
}

export const useDesign = create<DesignStore>((set, get) => ({
  design: createDesign(),
  past: [],
  future: [],
  txBase: null,
  liveUndo: 0,
  liveRedo: 0,

  update: (recipe) => {
    const { design, past, txBase } = get();
    const edited = produce(design, recipe);
    if (edited === design) return;
    // furniture is pushed out of walls (and refused when there is no room)
    const { design: next, refused } = settleFurniture(design, edited);
    if (refused) notify(refused > 1 ? 'Some furniture does not fit there: it cannot go through walls.' : 'That does not fit there: furniture cannot go through walls.');
    if (next === design) return;
    if (bridge) {
      if (!txBase) bridge.boundary();
      set({ design: next });
      bridge.push(design, next);
      return;
    }
    if (txBase) set({ design: next });
    else set({ design: next, past: [...past, design].slice(-HISTORY_LIMIT), future: [] });
  },

  beginTx: () => {
    bridge?.boundary();
    if (!get().txBase) set({ txBase: get().design });
  },

  endTx: () => {
    const { txBase, design, past } = get();
    if (!txBase) return;
    if (bridge) {
      set({ txBase: null });
      return bridge.boundary();
    }
    if (txBase === design) set({ txBase: null });
    else set({ txBase: null, past: [...past, txBase].slice(-HISTORY_LIMIT), future: [] });
  },

  undo: () => {
    if (bridge) return bridge.undo();
    const { past, design, future } = get();
    if (!past.length) return;
    set({ design: past[past.length - 1], past: past.slice(0, -1), future: [design, ...future], txBase: null });
  },

  redo: () => {
    if (bridge) return bridge.redo();
    const { past, design, future } = get();
    if (!future.length) return;
    set({ design: future[0], past: [...past, design], future: future.slice(1), txBase: null });
  },

  load: (design) => set({ design, past: [], future: [], txBase: null, liveUndo: 0, liveRedo: 0 }),
}));

// Custom furniture lives in the design; the catalog needs to know about it before anything is drawn.
syncCustomItems(useDesign.getState().design.custom);
useDesign.subscribe((s, prev) => {
  if (s.design.custom !== prev.design.custom) syncCustomItems(s.design.custom);
});
