import { create } from 'zustand';
import type { Design, ItemRef, OpeningKind, Point, StripKind, ZoneKind } from '../model';
import { STRIP_DEFAULT_WIDTH } from '../model';

/** A modal question or message. Rendered by components/Dialogs.tsx. */
export type DialogState =
  | { type: 'share'; url: string; copied: boolean; long: boolean }
  | { type: 'confirm'; title: string; message: string; confirmLabel: string; onConfirm: () => void }
  | { type: 'link-conflict'; incoming: Design; current: Design; sameDesign: boolean; choose: (useShared: boolean) => void };

export type Tool = 'select' | 'wall' | 'door' | 'window' | 'room' | 'furniture' | 'measure' | 'text' | 'zone' | 'strip';

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

  /** The floor being edited ('' until a design is loaded; see store/floor.ts for the validated value). */
  activeFloor: string;
  setActiveFloor: (id: string) => void;
  /** Show the floor below as a faint underlay for alignment. */
  showUnderlay: boolean;
  setShowUnderlay: (v: boolean) => void;

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

  /** Outdoor tools: which kind of area / line feature is being drawn, and how areas are drawn. */
  zoneKind: ZoneKind;
  zoneShape: 'rect' | 'poly';
  stripKind: StripKind;
  stripWidth: Record<StripKind, number>;
  setZoneKind: (k: ZoneKind) => void;
  setZoneShape: (s: 'rect' | 'poly') => void;
  setStripKind: (k: StripKind) => void;
  setStripWidth: (k: StripKind, w: number) => void;

  /** True while the plan is being panned (for the cursor). */
  panning: boolean;
  setPanning: (p: boolean) => void;

  /** Width (meters) of newly placed doors, windows and other openings, per kind. */
  openingWidth: Record<OpeningKind, number>;
  setOpeningWidth: (kind: OpeningKind, w: number) => void;
  /** Which kind the Door tool places. */
  doorKind: Exclude<OpeningKind, 'window'>;
  setDoorKind: (k: Exclude<OpeningKind, 'window'>) => void;

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

  activeFloor: '',
  setActiveFloor: (activeFloor) => set({ activeFloor, selection: null }),
  showUnderlay: true,
  setShowUnderlay: (showUnderlay) => set({ showUnderlay }),

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

  zoneKind: 'lawn',
  zoneShape: 'rect',
  stripKind: 'road',
  stripWidth: { ...STRIP_DEFAULT_WIDTH },
  setZoneKind: (zoneKind) => set({ zoneKind }),
  setZoneShape: (zoneShape) => set({ zoneShape }),
  setStripKind: (stripKind) => set({ stripKind }),
  setStripWidth: (k, w) => set((s) => ({ stripWidth: { ...s.stripWidth, [k]: w } })),

  panning: false,
  setPanning: (panning) => set({ panning }),

  openingWidth: { door: 0.9, double: 1.6, window: 1.2, garage: 2.5, gap: 1.0 },
  setOpeningWidth: (kind, w) => set((s) => ({ openingWidth: { ...s.openingWidth, [kind]: w } })),
  doorKind: 'door',
  setDoorKind: (doorKind) => set({ doorKind }),

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
