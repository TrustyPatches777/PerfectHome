import { useMemo } from 'react';
import { create } from 'zustand';
import type { Design, ItemKind, ItemRef, OpeningKind, Point, StripKind, WallType, ZoneKind } from '../model';
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

  /** Everything selected. */
  selected: ItemRef[];
  /** The selected item when exactly ONE thing is selected (the properties panel and handles work on it), else null. */
  selection: ItemRef | null;
  select: (s: ItemRef | null) => void;
  setSelected: (refs: ItemRef[]) => void;
  /** Add the item to the selection, or remove it when it is already part of it. */
  toggleSelected: (ref: ItemRef) => void;

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

  /** Text being typed to give an exact length while drawing (null = not typing). */
  typed: string | null;
  setTyped: (t: string | null) => void;

  /** True while the plan is being panned (for the cursor). */
  panning: boolean;
  setPanning: (p: boolean) => void;

  /** Width (meters) of newly placed doors, windows and other openings, per kind. */
  openingWidth: Record<OpeningKind, number>;
  setOpeningWidth: (kind: OpeningKind, w: number) => void;
  /** Which kind the Door tool places, and which the Window tool places. */
  doorKind: Exclude<OpeningKind, 'window' | 'bay'>;
  setDoorKind: (k: Exclude<OpeningKind, 'window' | 'bay'>) => void;
  windowKind: 'window' | 'bay';
  setWindowKind: (k: 'window' | 'bay') => void;
  /** Type of the walls being drawn (their thickness is a separate, editable setting). */
  wallType: WallType;
  setWallType: (t: WallType) => void;

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
  setTool: (tool) => set(tool === 'select' ? { tool } : { tool, selection: null, selected: [] }),

  selected: [],
  selection: null,
  select: (ref) => set({ selected: ref ? [ref] : [], selection: ref }),
  setSelected: (refs) => set({ selected: refs, selection: refs.length === 1 ? refs[0] : null }),
  toggleSelected: (ref) =>
    set((s) => {
      const has = s.selected.some((r) => r.kind === ref.kind && r.id === ref.id);
      const refs = has ? s.selected.filter((r) => !(r.kind === ref.kind && r.id === ref.id)) : [...s.selected, ref];
      return { selected: refs, selection: refs.length === 1 ? refs[0] : null };
    }),

  activeFloor: '',
  setActiveFloor: (activeFloor) => set({ activeFloor, selection: null, selected: [] }),
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

  typed: null,
  setTyped: (typed) => set({ typed }),

  panning: false,
  setPanning: (panning) => set({ panning }),

  openingWidth: { door: 0.9, double: 1.6, french: 1.6, sliding: 1.8, window: 1.2, bay: 1.6, garage: 2.5, gap: 1.0 },
  setOpeningWidth: (kind, w) => set((s) => ({ openingWidth: { ...s.openingWidth, [kind]: w } })),
  doorKind: 'door',
  setDoorKind: (doorKind) => set({ doorKind }),
  windowKind: 'window',
  setWindowKind: (windowKind) => set({ windowKind }),
  wallType: 'interior',
  setWallType: (wallType) => set({ wallType }),

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

/** The ids of the selected items of one kind (a stable Set between selection changes). */
export function useSelectedIds(kind: ItemKind): Set<string> {
  const selected = useUi((s) => s.selected);
  return useMemo(() => new Set(selected.filter((r) => r.kind === kind).map((r) => r.id)), [selected, kind]);
}

/** True while more than one thing is selected (single items get handles/transformers; groups get outlines). */
export const useIsMulti = () => useUi((s) => s.selected.length > 1);
