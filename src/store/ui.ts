import { useMemo } from 'react';
import { create } from 'zustand';
import { loadIdentity, type Identity } from '../identity';
import { setNotifier } from './notice';
import type { SkylightKind, CustomItem, Design, ItemKind, ItemRef, OpeningKind, Point, RoofKind, StairKind, StripKind, WallFinish, WallType, ZoneKind } from '../model';
import { STRIP_DEFAULT_WIDTH, type GateKind, type PathSurface } from '../model';
import type { WindowKind } from '../windows';
import type { Bounds } from '../geometry';
import type { DesignDiff } from '../snapshots';
import { onTextureLoaded } from '../paintSpec';

/** A modal question or message. Rendered by components/Dialogs.tsx. */
export type DialogState =
  | { type: 'share'; url: string; copied: boolean; long: boolean }
  | { type: 'areas' }
  | { type: 'find' }
  | { type: 'rooms' }
  | { type: 'snapshots' }
  | { type: 'print' }
  | { type: 'drawing' }
  | { type: 'live' }
  | { type: 'floor-roof'; floorName: string; canAttic: boolean; choose: (what: 'attic' | 'move') => void }
  | { type: 'identity'; then?: Point }
  | { type: 'custom-item'; editId: string | null; preset?: Partial<CustomItem> }
  | { type: 'confirm'; title: string; message: string; confirmLabel: string; onConfirm: () => void }
  | { type: 'link-conflict'; incoming: Design; current: Design; sameDesign: boolean; choose: (useShared: boolean) => void };

import { DEFAULT_DRAWING_OPTIONS, DEFAULT_PRINT, type DrawingOptions, type PrintOptions } from '../printLayout';

export type Tool = 'select' | 'wall' | 'door' | 'window' | 'room' | 'furniture' | 'measure' | 'text' | 'zone' | 'strip' | 'gate' | 'stairs' | 'roof' | 'skylight' | 'paint' | 'note' | 'stretch' | 'split-room' | 'section';

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

  roomMode: 'auto' | 'draw' | 'box';
  setRoomMode: (m: 'auto' | 'draw' | 'box') => void;

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

  /** Time of day shown by the sun layer (solar hours 0..24) and whether the day is playing. Not saved. */
  timeOfDay: number;
  setTimeOfDay: (h: number) => void;
  sunPlaying: boolean;
  setSunPlaying: (p: boolean) => void;

  /** Plan (2D) or the house in 3D. The 3D view only shows; all editing happens in 2D. Not saved. */
  view: '2d' | '3d';
  setView: (v: '2d' | '3d') => void;
  /** 3D: hide the floors above the one being edited (a cut-away). */
  cutaway: boolean;
  setCutaway: (v: boolean) => void;
  /** 3D: the floors pulled apart by this many meters (0 = the house as it is). */
  explode3d: number;
  setExplode3d: (v: number) => void;
  /** 3D: the floor shown as a dollhouse (its walls cut low, nothing above it, no roof), or null. */
  dollhouse: string | null;
  setDollhouse: (floor: string | null) => void;
  /** 3D: walk through the house instead of orbiting around it. */
  walking: boolean;
  setWalking: (v: boolean) => void;
  /** 3D walking: invert the up/down look direction. */
  invertLook: boolean;
  setInvertLook: (v: boolean) => void;
  /** 3D: cast shadows. */
  shadows3d: boolean;
  setShadows3d: (v: boolean) => void;

  /** Who is using this browser (signs sticky notes). */
  me: Identity | null;
  setMe: (me: Identity) => void;

  /** Choices in the print dialog (not saved). */
  printOptions: PrintOptions;
  setPrintOptions: (patch: Partial<PrintOptions>) => void;
  /** Choices in the elevation / section drawing dialog (not saved). */
  drawingOptions: DrawingOptions;
  setDrawingOptions: (patch: Partial<DrawingOptions>) => void;

  /** Plan check: look for problems, the narrowest passage in meters, and boundary distances shown on the plan. */
  showChecks: boolean;
  setShowChecks: (v: boolean) => void;
  minPassage: number;
  setMinPassage: (v: number) => void;
  showSetbacks: boolean;
  setShowSetbacks: (v: boolean) => void;

  /** What is shown on the plan (remembered between visits). */
  showRulers: boolean;
  showGuides: boolean;
  showAllDims: boolean;
  setShowRulers: (v: boolean) => void;
  setShowGuides: (v: boolean) => void;
  setShowAllDims: (v: boolean) => void;

  /** True while the plan is being panned (for the cursor). */
  panning: boolean;
  setPanning: (p: boolean) => void;

  /** Width (meters) of newly placed doors, windows and other openings, per kind. */
  openingWidth: Record<OpeningKind, number>;
  setOpeningWidth: (kind: OpeningKind, w: number) => void;
  /** Which kind the Door tool places, and which the Window tool places. */
  doorKind: Exclude<OpeningKind, WindowKind>;
  setDoorKind: (k: Exclude<OpeningKind, WindowKind>) => void;
  windowKind: WindowKind;
  setWindowKind: (k: WindowKind) => void;
  /** Wall tool: one wall at a time ('line') or four joined walls from two corners ('rect', optionally with its room). */
  wallMode: 'line' | 'rect' | 'winter';
  setWallMode: (m: 'line' | 'rect' | 'winter') => void;
  /** New roofs are made of glass (a winter garden). */
  roofGlass: boolean;
  setRoofGlass: (v: boolean) => void;
  wallRoom: boolean;
  setWallRoom: (v: boolean) => void;
  /** Walls drawn one by one keep to right angles (the same as holding Ctrl/Cmd). */
  wallOrtho: boolean;
  setWallOrtho: (v: boolean) => void;
  /** Skylight tool: which size to put on a roof (index into SKYLIGHT_SIZES). */
  skylightSize: number;
  /** What the skylight tool puts on a roof. */
  skylightKind: SkylightKind;
  setSkylightKind: (k: SkylightKind) => void;
  setSkylightSize: (i: number) => void;
  /** Paint tool: what to cover walls with ('clear' takes the covering off). */
  paintFinish: WallFinish | 'clear';
  paintColor: string;
  setPaint: (finish: WallFinish | 'clear', color?: string) => void;
  /** Which kind of roof the Roof tool makes. */
  roofKind: RoofKind;
  setRoofKind: (k: RoofKind) => void;
  /** Widths of the left and right sidebars in pixels (dragged by the splitters; remembered). */
  leftWidth: number;
  rightWidth: number;
  setSidebarWidth: (side: 'left' | 'right', px: number) => void;
  /** Height of the tools section in the left sidebar in pixels (the furniture list takes the rest; dragged by a splitter; remembered). */
  toolsHeight: number;
  setToolsHeight: (px: number) => void;
  /** 3D: floors switched off in the view (ids). */
  hiddenFloors: string[];
  setFloorShown: (id: string, shown: boolean) => void;
  showAllFloors: () => void;
  /** 3D: show the roofs. */
  showRoof3d: boolean;
  /** 3D: draw the ceilings (always while walking). */
  showCeilings3d: boolean;
  setShowCeilings3d: (v: boolean) => void;
  setShowRoof3d: (v: boolean) => void;
  /** Bumped when an uploaded picture (a floor or wall covering) has loaded, so that what shows it is drawn again. */
  texturesVersion: number;
  bumpTextures: () => void;
  /** The tracing picture: bumped when it is replaced (so the canvas loads it again), and whether it is being dragged. */
  traceVersion: number;
  bumpTrace: () => void;
  traceMove: boolean;
  setTraceMove: (v: boolean) => void;
  /** The differences between the plan and a snapshot, drawn on the plan while comparing. */
  compare: { name: string; diff: DesignDiff } | null;
  setCompare: (c: { name: string; diff: DesignDiff } | null) => void;
  /** The Stretch tool: the box that has been drawn (a second drag inside it pulls what is in it). */
  stretchBox: Bounds | null;
  setStretchBox: (b: Bounds | null) => void;
  /** The room the Split tool is cutting (you draw the line next). */
  splitRoomId: string | null;
  setSplitRoomId: (id: string | null) => void;
  /** Bumped when the saved templates change, so the palette redraws. */
  templatesVersion: number;
  bumpTemplates: () => void;
  /** The Gate tool: which kind of gate and how wide; and what the next footpath is made of. */
  gateKind: GateKind;
  setGateKind: (k: GateKind) => void;
  gateWidth: number;
  setGateWidth: (w: number) => void;
  pathSurface: PathSurface;
  setPathSurface: (s: PathSurface) => void;
  /** Which kind of staircase the Stairs tool places. */
  stairKind: StairKind;
  /** The Stairs tool puts a short flight of entrance steps instead (three steps up to a door). */
  stairEntrance: boolean;
  setStairEntrance: (v: boolean) => void;
  setStairKind: (k: StairKind) => void;
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

onTextureLoaded(() => useUi.getState().bumpTextures());

let toastTimer: ReturnType<typeof setTimeout> | undefined;

export const SIDEBAR_WIDTH = { left: { min: 150, max: 460, def: 214 }, right: { min: 200, max: 560, def: 260 } };
const clampWidth = (side: 'left' | 'right', v: unknown): number => {
  const r = SIDEBAR_WIDTH[side];
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(r.max, Math.max(r.min, Math.round(v))) : r.def;
};

export const TOOLS_HEIGHT = { min: 60, max: 600, def: 250 };
const clampToolsHeight = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? Math.min(TOOLS_HEIGHT.max, Math.max(TOOLS_HEIGHT.min, Math.round(v))) : TOOLS_HEIGHT.def);

const PREFS_KEY = 'perfect-home:prefs';
const prefs: Record<string, unknown> = (() => {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}');
  } catch {
    return {};
  }
})();

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
  wallMode: 'line',
  setWallMode: (wallMode) => set({ wallMode }),
  roofGlass: false,
  setRoofGlass: (roofGlass) => set({ roofGlass }),
  wallRoom: true,
  setWallRoom: (wallRoom) => set({ wallRoom }),
  wallOrtho: false,
  setWallOrtho: (wallOrtho) => set({ wallOrtho }),
  setRoomMode: (roomMode) => set({ roomMode }),

  zoneKind: 'lawn',
  zoneShape: 'rect',
  stripKind: 'road',
  stripWidth: { ...STRIP_DEFAULT_WIDTH },
  texturesVersion: 0,
  bumpTextures: () => set((s) => ({ texturesVersion: s.texturesVersion + 1 })),
  traceVersion: 0,
  bumpTrace: () => set((s) => ({ traceVersion: s.traceVersion + 1 })),
  traceMove: false,
  setTraceMove: (traceMove) => set({ traceMove }),
  compare: null,
  setCompare: (compare) => set({ compare }),
  stretchBox: null,
  setStretchBox: (stretchBox) => set({ stretchBox }),
  splitRoomId: null,
  setSplitRoomId: (splitRoomId) => set({ splitRoomId }),
  templatesVersion: 0,
  bumpTemplates: () => set((s) => ({ templatesVersion: s.templatesVersion + 1 })),
  gateKind: 'single',
  setGateKind: (gateKind) => set({ gateKind }),
  gateWidth: 1.2,
  setGateWidth: (gateWidth) => set({ gateWidth }),
  pathSurface: 'plain',
  setPathSurface: (pathSurface) => set({ pathSurface }),
  setZoneKind: (zoneKind) => set({ zoneKind }),
  setZoneShape: (zoneShape) => set({ zoneShape }),
  setStripKind: (stripKind) => set({ stripKind }),
  setStripWidth: (k, w) => set((s) => ({ stripWidth: { ...s.stripWidth, [k]: w } })),

  typed: null,
  setTyped: (typed) => set({ typed }),

  printOptions: DEFAULT_PRINT,
  setPrintOptions: (patch) => set((s) => ({ printOptions: { ...s.printOptions, ...patch } })),
  drawingOptions: DEFAULT_DRAWING_OPTIONS,
  setDrawingOptions: (patch) => set((s) => ({ drawingOptions: { ...s.drawingOptions, ...patch } })),

  showChecks: false,
  setShowChecks: (showChecks) => set({ showChecks }),
  minPassage: 0.7,
  setMinPassage: (minPassage) => set({ minPassage }),
  showSetbacks: false,
  setShowSetbacks: (showSetbacks) => set({ showSetbacks }),

  timeOfDay: 15,
  setTimeOfDay: (timeOfDay) => set({ timeOfDay }),
  sunPlaying: false,
  setSunPlaying: (sunPlaying) => set({ sunPlaying }),

  view: '2d',
  setView: (view) => set({ view, walking: false }),
  cutaway: false,
  setCutaway: (cutaway) => set({ cutaway }),
  explode3d: 0,
  setExplode3d: (v) => {
    const explode3d = Math.max(0, Math.min(8, v));
    set(explode3d > 0 ? { explode3d, dollhouse: null } : { explode3d });
  },
  dollhouse: null,
  setDollhouse: (dollhouse) => set(dollhouse ? { dollhouse, walking: false, explode3d: 0 } : { dollhouse: null }),
  walking: false,
  setWalking: (walking) => set(walking ? { walking, explode3d: 0, dollhouse: null } : { walking }),
  invertLook: false,
  setInvertLook: (invertLook) => set({ invertLook }),
  shadows3d: true,
  setShadows3d: (shadows3d) => set({ shadows3d }),

  me: loadIdentity(),
  setMe: (me) => set({ me }),

  leftWidth: clampWidth('left', prefs.leftWidth),
  rightWidth: clampWidth('right', prefs.rightWidth),
  setSidebarWidth: (side, px) => set(side === 'left' ? { leftWidth: clampWidth('left', px) } : { rightWidth: clampWidth('right', px) }),
  toolsHeight: clampToolsHeight(prefs.toolsHeight),
  setToolsHeight: (px) => set({ toolsHeight: clampToolsHeight(px) }),
  showRulers: prefs.showRulers !== false,
  showGuides: prefs.showGuides !== false,
  showAllDims: prefs.showAllDims === true,
  setShowRulers: (showRulers) => set({ showRulers }),
  setShowGuides: (showGuides) => set({ showGuides }),
  setShowAllDims: (showAllDims) => set({ showAllDims }),

  panning: false,
  setPanning: (panning) => set({ panning }),

  openingWidth: { door: 0.9, main: 1.0, garden: 0.9, double: 1.6, french: 1.6, sliding: 1.8, window: 1.2, casement: 1.4, sash: 1.0, picture: 1.8, bay: 1.6, highwin: 1.2, floorwin: 1.2, garage: 2.5, gap: 1.0 },
  setOpeningWidth: (kind, w) => set((s) => ({ openingWidth: { ...s.openingWidth, [kind]: w } })),
  doorKind: 'door',
  setDoorKind: (doorKind) => set({ doorKind }),
  windowKind: 'window',
  setWindowKind: (windowKind) => set({ windowKind }),
  skylightKind: 'window',
  setSkylightKind: (skylightKind) => set({ skylightKind, skylightSize: 1 }),
  skylightSize: 1,
  setSkylightSize: (skylightSize) => set({ skylightSize }),
  paintFinish: 'paint',
  paintColor: '#e9d8b8',
  setPaint: (paintFinish, color) => set((s) => ({ paintFinish, paintColor: color ?? s.paintColor })),
  roofKind: 'gable',
  setRoofKind: (roofKind) => set({ roofKind }),
  hiddenFloors: [],
  setFloorShown: (id, shown) => set((s) => ({ hiddenFloors: shown ? s.hiddenFloors.filter((f) => f !== id) : [...s.hiddenFloors.filter((f) => f !== id), id] })),
  showAllFloors: () => set({ hiddenFloors: [] }),
  showCeilings3d: false,
  setShowCeilings3d: (showCeilings3d) => set({ showCeilings3d }),
  showRoof3d: true,
  setShowRoof3d: (showRoof3d) => set({ showRoof3d }),
  stairEntrance: false,
  setStairEntrance: (stairEntrance) => set({ stairEntrance }),
  stairKind: 'straight',
  setStairKind: (stairKind) => set({ stairKind }),
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

// Remember the view switches between visits.
useUi.subscribe((s, prev) => {
  if (s.showRulers === prev.showRulers && s.showGuides === prev.showGuides && s.showAllDims === prev.showAllDims && s.leftWidth === prev.leftWidth && s.rightWidth === prev.rightWidth && s.toolsHeight === prev.toolsHeight) return;
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ showRulers: s.showRulers, showGuides: s.showGuides, showAllDims: s.showAllDims, leftWidth: s.leftWidth, rightWidth: s.rightWidth, toolsHeight: s.toolsHeight }));
  } catch {
    /* storage unavailable: the switches just reset next time */
  }
});

setNotifier((m) => useUi.getState().showToast(m));
