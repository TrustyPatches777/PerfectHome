/** Commands that act on the current selection. Used by keyboard shortcuts and the properties panel. */
import { LAYER_OF, type ItemKind, type ItemRef, type LayerId, type Point } from './model';
import {
  alignRefs,
  clipboardBounds,
  clipboardSize,
  copyRefs,
  distributeRefs,
  isRefLocked,
  itemBounds,
  layerOfRef,
  moveFromBase,
  pasteClipboard,
  removeRefs,
  rotateAbout,
  selectableRefs,
  unionBounds,
  type AlignMode,
  type Clipboard,
} from './selection';
import { snapPoint } from './geometry';
import { useDesign } from './store/design';
import { floorId } from './store/floor';
import { useUi } from './store/ui';

const CLIPBOARD_KEY = 'perfect-home:clipboard';

export const isLayerLocked = (ref: ItemRef) => isRefLocked(useDesign.getState().design, ref);

/** The selected items you are allowed to change (those on locked layers are left alone). */
export function editableSelection(): ItemRef[] {
  const d = useDesign.getState().design;
  return useUi.getState().selected.filter((r) => !isRefLocked(d, r));
}

// ---- layers --------------------------------------------------------------------------------

function blocksLayer(layer: LayerId): boolean {
  const l = useDesign.getState().design.layers[layer];
  if (l.locked || !l.visible) {
    useUi.getState().showToast(`That layer is ${l.locked ? 'locked' : 'hidden'}. Change it in the Layers panel.`);
    return true;
  }
  return false;
}

/**
 * Drawing tools call this before adding anything. Returns true (after telling the user why) when the
 * target layer is locked or hidden, so new items can never be added to a layer that looks frozen.
 * Pass an item kind, or a layer id (e.g. for lamps, which sit on the 'tech' layer).
 */
export function layerBlocksEditing(target: ItemKind | LayerId): boolean {
  return blocksLayer(target in LAYER_OF ? LAYER_OF[target as ItemKind] : (target as LayerId));
}

/** Hide/lock a layer; anything selected on it is deselected. */
export function setLayerFlag(layer: LayerId, flag: 'visible' | 'locked', value: boolean) {
  useDesign.getState().update((d) => void (d.layers[layer][flag] = value));
  if (flag === 'locked' || !value) {
    const d = useDesign.getState().design;
    const ui = useUi.getState();
    ui.setSelected(ui.selected.filter((r) => layerOfRef(d, r) !== layer));
  }
}

// ---- delete / select all ---------------------------------------------------------------------

export function deleteSelection() {
  const refs = editableSelection();
  if (!refs.length) return;
  useDesign.getState().update((d) => removeRefs(d, refs));
  useUi.getState().select(null);
}

export function selectAll() {
  useUi.getState().setSelected(selectableRefs(useDesign.getState().design, floorId()));
}

// ---- copy / cut / paste / duplicate ------------------------------------------------------------

let clipboard: Clipboard | null = null;
let lastPaste: { x: number; y: number; n: number } | null = null;

function readStoredClipboard(): Clipboard | null {
  try {
    const raw = localStorage.getItem(CLIPBOARD_KEY);
    const c = raw ? (JSON.parse(raw) as Clipboard) : null;
    return c && c.v === 1 && Array.isArray(c.walls) ? c : null;
  } catch {
    return null;
  }
}

export function copySelection(): boolean {
  const refs = editableSelection();
  if (!refs.length) return false;
  clipboard = copyRefs(useDesign.getState().design, refs);
  lastPaste = null;
  try {
    localStorage.setItem(CLIPBOARD_KEY, JSON.stringify(clipboard)); // so it also works in another tab or design
  } catch {
    /* storage unavailable: the in-memory copy still works */
  }
  const n = clipboardSize(clipboard);
  useUi.getState().showToast(`Copied ${n} item${n > 1 ? 's' : ''}.`);
  return true;
}

export function cutSelection() {
  if (copySelection()) deleteSelection();
}

/** Paste so the copied items are centered on the cursor (or shifted a little when the cursor is off the plan). */
export function pasteSelection() {
  const clip = clipboard ?? readStoredClipboard();
  if (!clip || !clipboardSize(clip)) return useUi.getState().showToast('Nothing copied yet.');
  const ui = useUi.getState();
  const { gridStep } = useDesign.getState().design.settings;
  const bounds = clipboardBounds(clip);
  let dx = Math.max(gridStep, 0.3);
  let dy = dx;
  if (bounds && ui.cursor) {
    const target = ui.snap ? snapPoint(ui.cursor, gridStep) : ui.cursor;
    dx = target.x - (bounds.minX + bounds.maxX) / 2;
    dy = target.y - (bounds.minY + bounds.maxY) / 2;
    // pasting again on the same spot: step aside so the copies do not hide each other
    const repeated = lastPaste && Math.hypot(lastPaste.x - target.x, lastPaste.y - target.y) < 0.05;
    const n = repeated ? lastPaste!.n + 1 : 0;
    dx += n * 0.3;
    dy += n * 0.3;
    lastPaste = { x: target.x, y: target.y, n };
  }
  let added: ItemRef[] = [];
  useDesign.getState().update((d) => {
    added = pasteClipboard(d, clip, dx, dy, floorId());
  });
  ui.setSelected(added);
}

/** Copy the selection and paste it right next to the original. */
export function duplicateSelection() {
  const refs = editableSelection().filter((r) => r.kind !== 'opening');
  if (!refs.length) return;
  const { gridStep } = useDesign.getState().design.settings;
  const off = Math.max(gridStep, 0.3);
  const clip = copyRefs(useDesign.getState().design, refs);
  let added: ItemRef[] = [];
  useDesign.getState().update((d) => {
    added = pasteClipboard(d, clip, off, off, floorId());
  });
  useUi.getState().setSelected(added);
}

// ---- move / rotate / align ---------------------------------------------------------------------

/** Move the selection by (dx, dy) meters. */
export function nudgeSelection(dx: number, dy: number) {
  const refs = editableSelection().filter((r) => r.kind !== 'opening');
  if (!refs.length) return;
  const base = useDesign.getState().design;
  useDesign.getState().update((d) => {
    for (const r of refs) moveFromBase(d, base, r, dx, dy);
  });
}

/** Rotate the selection by `deg` degrees about its center (a single item turns on the spot). */
export function rotateSelection(deg: number) {
  const refs = editableSelection().filter((r) => r.kind !== 'opening');
  if (!refs.length) return;
  const base = useDesign.getState().design;
  const box = unionBounds(refs.map((r) => itemBounds(base, r)).filter((b): b is NonNullable<typeof b> => !!b));
  if (!box) return;
  const c: Point = { x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2 };
  useDesign.getState().update((d) => {
    for (const r of refs) rotateAbout(d, r, deg, c);
  });
}

export function alignSelection(mode: AlignMode) {
  const refs = editableSelection().filter((r) => r.kind !== 'opening');
  useDesign.getState().update((d) => alignRefs(d, refs, mode));
}

export function distributeSelection(axis: 'x' | 'y') {
  const refs = editableSelection().filter((r) => r.kind !== 'opening');
  useDesign.getState().update((d) => distributeRefs(d, refs, axis));
}
