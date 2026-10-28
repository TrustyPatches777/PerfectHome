/** Commands that manage floors (levels). Items belong to a floor through their `floor` field. */
import { newId, type Design, type Floor, type ItemRef, type Point, type Roof, type Room } from './model';
import { newRoof } from './roofActions';
import { fitRoofToWalls } from './roofs';
import { mergePolygons } from './roomEdit';
import { rectCorners } from './selection';
import { useDesign } from './store/design';
import { floorIdOf } from './store/floor';
import { useUi } from './store/ui';
import { applyStoreyHeight } from './storey';

const ORDINALS = ['Ground floor', '1st floor', '2nd floor', '3rd floor'];

function nextName(count: number, basement: boolean): string {
  if (basement) return count === 0 ? 'Basement' : `Basement ${count + 1}`;
  return ORDINALS[count] ?? `${count}th floor`;
}

export const floorHasContent = (d: Design, id: string) =>
  [d.walls, d.rooms, d.furniture, d.labels, d.dimensions, d.zones, d.strips, d.stairs, d.roofs, d.skylights, d.notes].some((list) => (list as { floor: string }[]).some((i) => i.floor === id));

export function activeFloor(): string {
  return floorIdOf(useDesign.getState().design, useUi.getState().activeFloor);
}

/**
 * Add an empty floor directly above the active one ('above') or below everything ('basement'). A floor above one that has a roof
 * would be inside that roof, so the person chooses: an attic under the roof, or a full floor with the roof moved up onto it.
 */
export function addFloor(where: 'above' | 'basement') {
  if (where === 'above') {
    const d = useDesign.getState().design;
    const active = d.floors.find((f) => f.id === activeFloor())!;
    if (active.attic) return useUi.getState().showToast('An attic is the top of the house: nothing goes above it.');
    const roofs = d.roofs.filter((r) => r.floor === active.id);
    if (roofs.length) {
      const top = d.floors[d.floors.length - 1].id === active.id;
      useUi.getState().setDialog({
        type: 'floor-roof',
        floorName: active.name,
        canAttic: top && roofs.some((r) => r.kind !== 'flat'),
        choose: (what) => {
          useUi.getState().setDialog(null);
          if (what === 'attic') addAttic();
          else insertFloorAbove(true);
        },
      });
      return;
    }
    return insertFloorAbove(false);
  }
  const id = newId();
  useDesign.getState().update((draft) => {
    const basements = draft.floors.filter((f) => f.name.startsWith('Basement')).length;
    draft.floors.unshift({ id, name: nextName(basements, true) });
  });
  useUi.getState().setActiveFloor(id);
}

/** A new floor above the active one. With `moveRoofs` the roofs (and their skylights) that were on the active floor move up onto it. */
function insertFloorAbove(moveRoofs: boolean) {
  const id = newId();
  const from = activeFloor();
  useDesign.getState().update((draft) => {
    const at = draft.floors.findIndex((f) => f.id === from);
    const aboveGround = Math.max(0, draft.floors.length - draft.floors.filter((f) => f.name.startsWith('Basement')).length);
    draft.floors.splice(at + 1, 0, { id, name: nextName(aboveGround, false) });
    if (moveRoofs) {
      for (const r of draft.roofs) if (r.floor === from) r.floor = id;
      for (const s of draft.skylights) if (s.floor === from) s.floor = id;
    }
  });
  useUi.getState().setActiveFloor(id);
}

/**
 * The floor plan of an attic: where the house is, seen from above (the rooms of the floor below, joined where they touch), or the area
 * under the roof when that floor has no rooms. The low parts under the slopes are part of it (the plan shades them, and you cannot walk there).
 */
export function atticOutlines(d: Design, below: string): Point[][] {
  let polys = d.rooms.filter((r) => r.floor === below).map((r) => r.points.map((p) => ({ ...p })));
  for (let merged = true; merged && polys.length > 1; ) {
    merged = false;
    outer: for (let i = 0; i < polys.length; i++) {
      for (let j = i + 1; j < polys.length; j++) {
        const m = mergePolygons(polys[i], polys[j]);
        if (m && m.length >= 3) {
          polys = polys.filter((_, k) => k !== i && k !== j);
          polys.push(m);
          merged = true;
          break outer;
        }
      }
    }
  }
  if (polys.length) return polys;
  const roof = d.roofs.find((r) => r.floor === below && r.kind !== 'flat');
  return roof ? [rectCorners(roof.x, roof.y, roof.w, roof.d, roof.rotation)] : [];
}

const atticRoomsFor = (d: Design, below: string, floor: string): Room[] => {
  const outlines = atticOutlines(d, below);
  return outlines.map((points, i) => ({ id: newId(), floor, name: outlines.length > 1 ? `Attic ${i + 1}` : 'Attic', color: '#e8dcc8', material: 'wood' as const, living: true, points }));
};

/**
 * An attic above the top floor, built from the roof: when the floor has no pitched roof yet one is fitted to its walls, and the attic
 * gets its floor (the outline of the house) so that it is ready to use. Rebuild it with "Rebuild from the roof" after the roof or walls change.
 */
export function addAttic() {
  const d = useDesign.getState().design;
  const top = d.floors[d.floors.length - 1];
  if (top.attic) return useUi.getState().showToast('There is an attic already.');
  const roofs = d.roofs.filter((r) => r.floor === top.id);
  let roof: Roof | null = null;
  if (!roofs.some((r) => r.kind !== 'flat')) {
    const box = fitRoofToWalls(d, top.id);
    if (!box) return useUi.getState().showToast('Draw the walls of the top floor first: the attic is built under a roof fitted to them.');
    roof = newRoof(top.id, box, 'gable');
  }
  const id = newId();
  useDesign.getState().update((draft) => {
    if (roof) {
      for (const flat of draft.roofs.filter((r) => r.floor === top.id && r.kind === 'flat')) draft.roofs.splice(draft.roofs.indexOf(flat), 1); // a flat roof makes no attic
      draft.roofs.push(roof);
    }
    draft.floors.push({ id, name: 'Attic', attic: true });
    draft.rooms.push(...atticRoomsFor(draft as Design, top.id, id));
  });
  useUi.getState().setActiveFloor(id);
}

/** Set the storey height of the whole house at once: floors, full-height walls and the stairs that climb a storey follow (one undo step). */
export function setStoreyHeight(meters: number) {
  const next = Math.round(Math.min(6, Math.max(1.8, meters)) * 100) / 100;
  if (Math.abs(next - useDesign.getState().design.settings.storeyHeight) < 1e-6) return;
  let change = { walls: 0, stairs: 0 };
  useDesign.getState().update((d) => {
    change = applyStoreyHeight(d, next);
  });
  const parts = [change.walls ? `${change.walls} wall${change.walls === 1 ? '' : 's'}` : '', change.stairs ? `${change.stairs} staircase${change.stairs === 1 ? '' : 's'}` : ''].filter(Boolean);
  useUi.getState().showToast(`Storey height ${Math.round(next * 100)} cm${parts.length ? `: ${parts.join(' and ')} adjusted to fit` : ''}.`);
}

/** Make the floor of the active attic again from the rooms of the floor below (what you put in the attic stays). */
export function rebuildAttic() {
  const d = useDesign.getState().design;
  const at = d.floors.findIndex((f) => f.id === activeFloor());
  const attic = d.floors[at];
  if (!attic?.attic || at < 1) return useUi.getState().showToast('Go to the attic first.');
  const below = d.floors[at - 1].id;
  useDesign.getState().update((draft) => {
    draft.rooms = draft.rooms.filter((r) => r.floor !== attic.id);
    draft.rooms.push(...atticRoomsFor(draft as Design, below, attic.id));
  });
}

/** Copy everything on the active floor to a new floor above it (handy for stacking similar levels). */
export function duplicateFloor() {
  const source = activeFloor();
  if (useDesign.getState().design.floors.find((f) => f.id === source)?.attic) return useUi.getState().showToast('An attic cannot be copied: nothing goes above it.');
  const id = newId();
  useDesign.getState().update((d) => {
    const at = d.floors.findIndex((f) => f.id === source);
    d.floors.splice(at + 1, 0, { id, name: `${d.floors[at].name} copy` });
    const wallMap = new Map<string, string>();
    for (const w of d.walls.filter((x) => x.floor === source)) {
      const nid = newId();
      wallMap.set(w.id, nid);
      d.walls.push({ ...w, id: nid, floor: id });
    }
    for (const o of d.openings.filter((x) => wallMap.has(x.wallId))) d.openings.push({ ...o, id: newId(), wallId: wallMap.get(o.wallId)! });
    const copy = <T extends { id: string; floor: string }>(list: T[]) => {
      for (const item of list.filter((x) => x.floor === source)) list.push({ ...item, id: newId(), floor: id });
    };
    copy(d.rooms);
    copy(d.furniture);
    copy(d.labels);
    copy(d.dimensions);
    copy(d.zones);
    copy(d.strips);
    copy(d.stairs);
    // the roof stays on top of the stack: it moves up to the new floor instead of being copied
    for (const r of d.roofs) if (r.floor === source) r.floor = id;
    for (const s of d.skylights) if (s.floor === source) s.floor = id;
    copy(d.notes);
  });
  useUi.getState().setActiveFloor(id);
}

export function renameFloor(id: string, name: string) {
  useDesign.getState().update((d) => {
    const f = d.floors.find((x) => x.id === id);
    if (f) f.name = name;
  });
}

function removeFloor(id: string) {
  const d0 = useDesign.getState().design;
  const index = d0.floors.findIndex((f) => f.id === id);
  const neighbour = d0.floors[index > 0 ? index - 1 : 1].id;
  useDesign.getState().update((d) => {
    const wallIds = new Set(d.walls.filter((w) => w.floor === id).map((w) => w.id));
    d.openings = d.openings.filter((o) => !wallIds.has(o.wallId));
    d.walls = d.walls.filter((x) => x.floor !== id);
    d.rooms = d.rooms.filter((x) => x.floor !== id);
    d.furniture = d.furniture.filter((x) => x.floor !== id);
    d.labels = d.labels.filter((x) => x.floor !== id);
    d.dimensions = d.dimensions.filter((x) => x.floor !== id);
    d.zones = d.zones.filter((x) => x.floor !== id);
    d.strips = d.strips.filter((x) => x.floor !== id);
    d.stairs = d.stairs.filter((x) => x.floor !== id);
    d.roofs = d.roofs.filter((x) => x.floor !== id);
    d.skylights = d.skylights.filter((x) => x.floor !== id);
    d.notes = d.notes.filter((x) => x.floor !== id);
    d.floors = d.floors.filter((f) => f.id !== id);
  });
  useUi.getState().setActiveFloor(neighbour);
}

/** Delete a floor and everything on it (undoable). Asks first when the floor is not empty. */
export function deleteFloor(id: string) {
  const d = useDesign.getState().design;
  if (d.floors.length <= 1) return;
  const name = d.floors.find((f) => f.id === id)?.name ?? 'this floor';
  if (!floorHasContent(d, id)) return removeFloor(id);
  useUi.getState().setDialog({
    type: 'confirm',
    title: `Delete “${name}”?`,
    message: 'Everything on this floor is removed. You can bring it back with Undo.',
    confirmLabel: 'Delete floor',
    onConfirm: () => removeFloor(id),
  });
}

/** Go one floor up (+1) or down (-1). */
export function stepFloor(delta: 1 | -1) {
  const d = useDesign.getState().design;
  const i = d.floors.findIndex((f) => f.id === activeFloor());
  const next: Floor | undefined = d.floors[i + delta];
  if (next) useUi.getState().setActiveFloor(next.id);
}

/** Show an item: switch to its floor, center the view on it and select it. */
export function setActiveFloorAndFocus(floor: string, at: { x: number; y: number }, ref: ItemRef) {
  const ui = useUi.getState();
  ui.setActiveFloor(floor);
  const v = ui.viewport;
  ui.setViewport({ ...v, x: ui.canvasSize.w / 2 - at.x * v.zoom, y: ui.canvasSize.h / 2 - at.y * v.zoom });
  ui.select(ref);
}
