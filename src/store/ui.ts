import { create } from 'zustand';
import type { Design, ItemRef, Point } from '../model';

/** A modal question or message. Rendered by components/Dialogs.tsx. */
export type DialogState =
  | { type: 'share'; url: string; copied: boolean; long: boolean }
  | { type: 'link-conflict'; incoming: Design; current: Design; sameDesign: boolean; choose: (useShared: boolean) => void };

export type Tool = 'select' | 'wall' | 'door' | 'window' | 'room' | 'furniture' | 'measure' | 'text';

/** Camera: screen = world * zoom + (x, y). `zoom` is pixels per meter. */
export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

export const MIN_ZOOM = 5;
export const MAX_ZOOM = 500;
export const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

interface UiStore {
  tool: Tool;
  setTool: (t: Tool) => void;

  selection: ItemRef | null;
  select: (s: ItemRef | null) => void;

  viewport: Viewport;
  setViewport: (v: Viewport) => void;
  /** Size of the canvas area in CSS pixels. */
  canvasSize: { w: number; h: number };
  setCanvasSize: (w: number, h: number) => void;

  snap: boolean;
  toggleSnap: () => void;

  /** Last known pointer position in world coordinates (for the status bar). */
  cursor: Point | null;
  setCursor: (p: Point | null) => void;

  /** Furniture catalog key to place while tool === 'furniture'. */
  placing: string | null;
  setPlacing: (type: string | null) => void;
  /** Rotation (degrees) of the item being placed. */
  placingRotation: number;
  setPlacingRotation: (deg: number) => void;

  roomMode: 'auto' | 'draw';
  setRoomMode: (m: 'auto' | 'draw') => void;

  /** Width (meters) of newly placed doors and windows. */
  openingWidth: { door: number; window: number };
  setOpeningWidth: (kind: 'door' | 'window', w: number) => void;

  dialog: DialogState | null;
  setDialog: (d: DialogState | null) => void;

  /** Autosave status for the top bar. */
  saveState: { at: number | null; failed: boolean };
  setSaveState: (s: { at: number | null; failed: boolean }) => void;

  /** Bumped to ask the properties panel to focus its text field (new/double-clicked label). */
  textFocus: number;
  requestTextFocus: () => void;

  /** Transient one-line message (errors, hints). */
  toast: string | null;
  showToast: (msg: string) => void;
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;

export const useUi = create<UiStore>((set) => ({
  tool: 'select',
  setTool: (tool) => set((s) => ({ tool, selection: tool === 'select' ? s.selection : null })),

  selection: null,
  select: (selection) => set({ selection }),

  viewport: { x: 160, y: 120, zoom: 60 },
  setViewport: (viewport) => set({ viewport }),
  canvasSize: { w: 1000, h: 700 },
  setCanvasSize: (w, h) => set({ canvasSize: { w, h } }),

  snap: true,
  toggleSnap: () => set((s) => ({ snap: !s.snap })),

  cursor: null,
  setCursor: (cursor) => set({ cursor }),

  placing: null,
  setPlacing: (placing) => set({ placing, placingRotation: 0 }),
  placingRotation: 0,
  setPlacingRotation: (placingRotation) => set({ placingRotation }),

  roomMode: 'auto',
  setRoomMode: (roomMode) => set({ roomMode }),

  openingWidth: { door: 0.9, window: 1.2 },
  setOpeningWidth: (kind, w) => set((s) => ({ openingWidth: { ...s.openingWidth, [kind]: w } })),

  dialog: null,
  setDialog: (dialog) => set({ dialog }),

  saveState: { at: null, failed: false },
  setSaveState: (saveState) => set({ saveState }),

  textFocus: 0,
  requestTextFocus: () => set((s) => ({ textFocus: s.textFocus + 1 })),

  toast: null,
  showToast: (toast) => {
    set({ toast });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => set({ toast: null }), 3500);
  },
}));
