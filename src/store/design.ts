import { create } from 'zustand';
import { produce, type Draft } from 'immer';
import { createDesign, type Design } from '../model';

const HISTORY_LIMIT = 100;

interface DesignStore {
  design: Design;
  past: Design[];
  future: Design[];
  /** Design as it was when a gesture (drag, draw...) began; the gesture becomes ONE undo step. */
  txBase: Design | null;

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

  update: (recipe) => {
    const { design, past, txBase } = get();
    const next = produce(design, recipe);
    if (next === design) return;
    if (txBase) set({ design: next });
    else set({ design: next, past: [...past, design].slice(-HISTORY_LIMIT), future: [] });
  },

  beginTx: () => {
    if (!get().txBase) set({ txBase: get().design });
  },

  endTx: () => {
    const { txBase, design, past } = get();
    if (!txBase) return;
    if (txBase === design) set({ txBase: null });
    else set({ txBase: null, past: [...past, txBase].slice(-HISTORY_LIMIT), future: [] });
  },

  undo: () => {
    const { past, design, future } = get();
    if (!past.length) return;
    set({ design: past[past.length - 1], past: past.slice(0, -1), future: [design, ...future], txBase: null });
  },

  redo: () => {
    const { past, design, future } = get();
    if (!future.length) return;
    set({ design: future[0], past: [...past, design], future: future.slice(1), txBase: null });
  },

  load: (design) => set({ design, past: [], future: [], txBase: null }),
}));
