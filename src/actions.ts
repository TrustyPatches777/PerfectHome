/** Commands that act on the current selection. Used by keyboard shortcuts and the properties panel. */
import { LAYER_OF, newId, type Design, type ItemKind, type ItemRef, type LayerId, type Point, type Wall } from './model';
import { allRefsOnFloor, mirrorCenter, mirrorRefs, type Axis } from './mirror';
import { mergeRooms } from './roomEdit';
import { floorCenter, scaleFloor } from './resize';
import { refitRooms } from './shapes';
import { alignWall, cutCorner, joinWalls, meetWalls, offsetWall, setThickness, spaceOpenings, splitWall } from './wallEdit';
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
  sameRef,
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

// ---- mirror -------------------------------------------------------------------------------------------------------------------------

/** Turn the selection over, left-right (`x`) or top-bottom (`y`), about its own middle. */
export function mirrorSelection(axis: Axis) {
  const refs = editableSelection().filter((r) => r.kind !== 'opening');
  if (!refs.length) return;
  const base = useDesign.getState().design;
  const c = mirrorCenter(base, refs, axis);
  if (c === null) return;
  useDesign.getState().update((d) => mirrorRefs(d, refs, axis, c));
}

/** Turn the whole active floor over (its walls, rooms, furniture, stairs, roofs and everything else), about its middle. */
export function mirrorFloor(axis: Axis) {
  const floor = floorId();
  const base = useDesign.getState().design;
  const refs = allRefsOnFloor(base, floor);
  const c = mirrorCenter(base, refs, axis);
  if (c === null) return useUi.getState().showToast('This floor is empty.');
  useDesign.getState().update((d) => mirrorRefs(d, refs, axis, c));
  useUi.getState().select(null);
}

// ---- groups -------------------------------------------------------------------------------------------------------------------------

/** The other members of the group an item is in (including itself), or an empty list when it is not in one. */
export function groupMembers(d: Design, ref: ItemRef): ItemRef[] {
  const g = d.groups.find((x) => x.refs.some((r) => sameRef(r, ref)));
  return g ? g.refs.filter((r) => itemExists(d, r)) : [];
}

function itemExists(d: Design, r: ItemRef): boolean {
  const lists: Partial<Record<ItemRef['kind'], { id: string }[]>> = { wall: d.walls, room: d.rooms, furniture: d.furniture, zone: d.zones, strip: d.strips, stair: d.stairs, roof: d.roofs, skylight: d.skylights, label: d.labels, dimension: d.dimensions, note: d.notes };
  return !!lists[r.kind]?.some((x) => x.id === r.id);
}

/** Select an item and everything that is grouped with it. */
export function selectWithGroup(ref: ItemRef) {
  const members = groupMembers(useDesign.getState().design, ref);
  if (members.length > 1) useUi.getState().setSelected(members);
  else useUi.getState().select(ref);
}

export function groupSelection() {
  const refs = editableSelection().filter((r) => r.kind !== 'opening' && r.kind !== 'guide');
  if (refs.length < 2) return useUi.getState().showToast('Select two or more things to group.');
  useDesign.getState().update((d) => {
    // an item is in one group only: it leaves the group it was in
    for (const g of d.groups) g.refs = g.refs.filter((r) => !refs.some((x) => sameRef(x, r)));
    d.groups = d.groups.filter((g) => g.refs.length >= 2);
    d.groups.push({ id: newId(), name: 'Group', refs: refs.map((r) => ({ kind: r.kind, id: r.id })) });
  });
  useUi.getState().showToast('Grouped: they move together now.');
}

export function ungroupSelection() {
  const sel = useUi.getState().selected;
  useDesign.getState().update((d) => {
    d.groups = d.groups.filter((g) => !g.refs.some((r) => sel.some((x) => sameRef(x, r))));
  });
}

export const selectionInGroup = (): boolean => {
  const d = useDesign.getState().design;
  return useUi.getState().selected.some((r) => d.groups.some((g) => g.refs.some((x) => sameRef(x, r))));
};

// ---- templates: a group you keep to place again -----------------------------------------------------------------------------------------

const TEMPLATES_KEY = 'perfect-home:templates';
export interface Template {
  id: string;
  name: string;
  clip: Clipboard;
}

export function loadTemplates(): Template[] {
  try {
    const list = JSON.parse(localStorage.getItem(TEMPLATES_KEY) ?? '[]') as Template[];
    return Array.isArray(list) ? list.filter((t) => t && t.clip && Array.isArray(t.clip.walls)) : [];
  } catch {
    return [];
  }
}

function storeTemplates(list: Template[]) {
  try {
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(list));
  } catch {
    useUi.getState().showToast('Could not save the template (the browser storage is full).');
  }
  useUi.getState().bumpTemplates();
}

export function saveTemplate(name: string): boolean {
  const refs = editableSelection().filter((r) => r.kind !== 'opening');
  if (!refs.length) return false;
  const clip = copyRefs(useDesign.getState().design, refs);
  storeTemplates([...loadTemplates(), { id: newId(), name: name.trim() || 'Template', clip }]);
  useUi.getState().showToast('Saved as a template: find it at the top of the furniture list.');
  return true;
}

export function deleteTemplate(id: string) {
  storeTemplates(loadTemplates().filter((t) => t.id !== id));
}

export function placeTemplate(id: string) {
  const t = loadTemplates().find((x) => x.id === id);
  if (!t) return;
  clipboard = t.clip;
  lastPaste = null;
  pasteSelection();
  // the pieces of a template stay together
  const added = useUi.getState().selected;
  if (added.length > 1) useDesign.getState().update((d) => void d.groups.push({ id: newId(), name: t.name, refs: added.filter((r) => r.kind !== 'opening').map((r) => ({ kind: r.kind, id: r.id })) }));
}

// ---- wall tools -------------------------------------------------------------------------------------------------------------------------

const selectedWalls = () => useUi.getState().selected.filter((r) => r.kind === 'wall').map((r) => r.id);

function wallToolDone(floor: string | undefined) {
  if (floor) useDesign.getState().update((d) => void refitRooms(d, floor));
}

export function splitWallAt(wallId: string, s: number): boolean {
  let id: string | null = null;
  useDesign.getState().update((d) => {
    id = splitWall(d, wallId, s);
  });
  if (!id) useUi.getState().showToast('Cannot cut there: too near an end, or in the middle of a door or window.');
  return !!id;
}

export function joinSelectedWalls(): boolean {
  const [a, b] = selectedWalls();
  if (!a || !b) return false;
  let ok: string | null = null;
  useDesign.getState().update((d) => {
    ok = joinWalls(d, a, b);
  });
  if (!ok) useUi.getState().showToast('These two walls do not meet end to end in a straight line.');
  else useUi.getState().select({ kind: 'wall', id: ok });
  return !!ok;
}

export function meetSelectedWalls(): boolean {
  const [a, b] = selectedWalls();
  if (!a || !b) return false;
  const floor = useDesign.getState().design.walls.find((w) => w.id === a)?.floor;
  let ok = false;
  useDesign.getState().update((d) => {
    ok = meetWalls(d, a, b);
  });
  if (!ok) useUi.getState().showToast('These walls are parallel (or curved): they never meet.');
  else wallToolDone(floor);
  return ok;
}

export function cutSelectedCorner(size: number, round: boolean): boolean {
  const [a, b] = selectedWalls();
  if (!a || !b) return false;
  const floor = useDesign.getState().design.walls.find((w) => w.id === a)?.floor;
  let id: string | null = null;
  useDesign.getState().update((d) => {
    id = cutCorner(d, a, b, size, round);
  });
  if (!id) useUi.getState().showToast('Cannot cut that corner: the walls must meet at an angle, and be longer than the cut.');
  else wallToolDone(floor);
  return !!id;
}

export function alignSelectedWalls(square: boolean): boolean {
  const [a, b] = selectedWalls();
  if (!a || !b) return false;
  const floor = useDesign.getState().design.walls.find((w) => w.id === a)?.floor;
  let ok = false;
  useDesign.getState().update((d) => {
    ok = alignWall(d, a, b, square);
  });
  if (!ok) useUi.getState().showToast('That only works for two straight walls.');
  else wallToolDone(floor);
  return ok;
}

/** Offset a wall sideways, or change its thickness with one face (or the middle) staying put; the rooms follow. */
export function reshapeWall(wallId: string, change: { offset?: number; thickness?: number; keep?: 'l' | 'r' | 'middle' }) {
  const floor = useDesign.getState().design.walls.find((w) => w.id === wallId)?.floor;
  useDesign.getState().update((d) => {
    if (change.offset) offsetWall(d, wallId, change.offset);
    if (change.thickness) setThickness(d, wallId, change.thickness, change.keep ?? 'middle');
  });
  wallToolDone(floor);
}

export function spaceWallOpenings(wallId: string, ids?: string[]) {
  let n = 0;
  useDesign.getState().update((d) => {
    n = spaceOpenings(d, wallId, ids);
  });
  if (!n) useUi.getState().showToast('They do not fit on the wall with gaps between them.');
}

/** Change the same property of every selected wall at once. */
export function editSelectedWalls(fn: (w: Wall) => void) {
  const ids = new Set(selectedWalls());
  useDesign.getState().update((d) => {
    for (const w of d.walls) if (ids.has(w.id)) fn(w);
  });
}

// ---- select all like this --------------------------------------------------------------------------------------------------------

/** Select everything on this floor that is the same kind of thing (every window, every socket, every wall of this type...). */
export function selectAllLike(ref: ItemRef): number {
  const d = useDesign.getState().design;
  const floor = floorId();
  const refs: ItemRef[] = [];
  const same = (a: ItemRef) => refs.push(a);
  if (ref.kind === 'opening') {
    const o = d.openings.find((x) => x.id === ref.id);
    const onFloor = new Set(d.walls.filter((w) => w.floor === floor).map((w) => w.id));
    for (const x of d.openings) if (o && x.kind === o.kind && onFloor.has(x.wallId)) same({ kind: 'opening', id: x.id });
  } else if (ref.kind === 'wall') {
    const w = d.walls.find((x) => x.id === ref.id);
    for (const x of d.walls) if (w && x.floor === floor && x.type === w.type) same({ kind: 'wall', id: x.id });
  } else if (ref.kind === 'furniture') {
    const f = d.furniture.find((x) => x.id === ref.id);
    for (const x of d.furniture) if (f && x.floor === floor && x.type === f.type) same({ kind: 'furniture', id: x.id });
  } else if (ref.kind === 'room') {
    const r = d.rooms.find((x) => x.id === ref.id);
    for (const x of d.rooms) if (r && x.floor === floor && (x.type ?? 'other') === (r.type ?? 'other')) same({ kind: 'room', id: x.id });
  } else {
    for (const x of selectableRefs(d, floor)) if (x.kind === ref.kind) same(x);
  }
  const free = refs.filter((r) => !isRefLocked(d, r));
  useUi.getState().setSelected(free);
  return free.length;
}

// ---- rooms ---------------------------------------------------------------------------------------------------------------------------

export function mergeSelectedRooms(): boolean {
  const rooms = useUi.getState().selected.filter((r) => r.kind === 'room');
  if (rooms.length !== 2) return false;
  let ok = false;
  useDesign.getState().update((d) => {
    ok = mergeRooms(d, rooms[0].id, rooms[1].id);
  });
  if (!ok) useUi.getState().showToast('Those rooms do not share a stretch of wall, so they cannot be merged.');
  else useUi.getState().select({ kind: 'room', id: rooms[0].id });
  return ok;
}

// ---- scale the floor ---------------------------------------------------------------------------------------------------------------

export function scaleActiveFloor(factor: number): boolean {
  if (!(factor > 0.1 && factor < 10) || Math.abs(factor - 1) < 1e-6) return false;
  const floor = floorId();
  const c = floorCenter(useDesign.getState().design, floor);
  if (!c) return false;
  useDesign.getState().update((d) => scaleFloor(d, floor, factor, c));
  return true;
}
