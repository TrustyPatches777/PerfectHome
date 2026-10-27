/** Making and changing roofs: from a box you drag, from the walls of the floor, kind changes that keep the look sensible. */
import { floorId } from './store/floor';
import { atticOutlines } from './floors';
import { isRectilinear, wingsOf } from './roofWings';
import { newId, type Roof, type RoofKind, type SkylightKind } from './model';
import { ROOF_MATERIAL_STYLES, ROOF_STYLES, fitRoofToWalls, skylightPlacement, type RoofBox } from './roofs';
import { useDesign } from './store/design';
import { useUi } from './store/ui';

/** The usual sizes of a roof window (width x length up the slope, in meters). */
export const SKYLIGHT_SIZES = [
  { label: 'Small', w: 0.55, d: 0.78 },
  { label: 'Standard', w: 0.78, d: 1.18 },
  { label: 'Large', w: 1.14, d: 1.4 },
];

/** Solar panels: one panel (about 1.7 x 1.0 m) and a row of three. */
export const SOLAR_SIZES = [
  { label: 'One panel', w: 1.0, d: 1.7 },
  { label: 'Two panels', w: 2.0, d: 1.7 },
  { label: 'Row of three', w: 3.0, d: 1.7 },
];

/** Dormers: width and the height of the front wall. */
export const DORMER_SIZES = [
  { label: 'Small', w: 1.1, d: 1.1 },
  { label: 'Standard', w: 1.5, d: 1.3 },
  { label: 'Wide', w: 2.2, d: 1.4 },
];

export const SIZES_OF = { window: SKYLIGHT_SIZES, solar: SOLAR_SIZES, dormer: DORMER_SIZES } as const;

/** Put a skylight, a row of solar panels or a dormer on the roof under a plan point. Null (with a hint) when there is no roof there. */
export function addSkylight(p: { x: number; y: number }, size: { w: number; d: number }, kind: SkylightKind = 'window'): string | null {
  const d0 = useDesign.getState().design;
  const floor = floorId();
  if (!skylightPlacement(d0.roofs, floor, p)) {
    useUi.getState().showToast('Click on a roof to put a skylight there.');
    return null;
  }
  const id = newId();
  const placed = skylightPlacement(d0.roofs, floor, p);
  if (kind === 'dormer' && placed?.flat) {
    useUi.getState().showToast('A dormer needs a sloping roof.');
    return null;
  }
  useDesign.getState().update((d) => void d.skylights.push({ id, floor, x: p.x, y: p.y, w: size.w, d: size.d, ...(kind !== 'window' ? { kind } : {}) }));
  useUi.getState().select({ kind: 'skylight', id });
  return id;
}

/** A roof with the usual settings for its kind. */
export function newRoof(floor: string, box: RoofBox, kind: RoofKind): Roof {
  const style = ROOF_STYLES[kind];
  return {
    id: newId(),
    floor,
    kind,
    ...box,
    pitch: style.pitch,
    overhang: 0.4,
    thickness: kind === 'flat' ? 0.25 : 0.15,
    material: style.material,
    color: ROOF_MATERIAL_STYLES[style.material].color,
    chimney: false,
    parapet: false,
  };
}

/** Add a roof of `box` size on the active floor and select it. */
export function addRoof(box: RoofBox, kind: RoofKind): string {
  const roof = newRoof(floorId(), box, kind);
  useDesign.getState().update((d) => void d.roofs.push(roof));
  useUi.getState().setTool('select');
  useUi.getState().select({ kind: 'roof', id: roof.id });
  return roof.id;
}

/** A roof that covers the walls of the active floor. Says so when there is nothing to cover. */
export function addRoofFromWalls(kind: RoofKind): string | null {
  const box = fitRoofToWalls(useDesign.getState().design, floorId());
  if (!box) {
    useUi.getState().showToast('Draw some walls on this floor first: the roof is fitted to them.');
    return null;
  }
  return addRoof(box, kind);
}

const edit = (id: string, fn: (r: Roof) => void) =>
  useDesign.getState().update((d) => {
    const r = d.roofs.find((x) => x.id === id);
    if (r) fn(r);
  });

/** Change the kind of a roof. Slope, material and thickness follow, unless the roof had been set up by hand. */
export function setRoofKind(id: string, kind: RoofKind) {
  edit(id, (r) => {
    const old = ROOF_STYLES[r.kind];
    const usual = r.pitch === old.pitch && r.material === old.material && r.color === ROOF_MATERIAL_STYLES[old.material].color;
    r.kind = kind;
    if (usual) {
      const next = ROOF_STYLES[kind];
      r.pitch = next.pitch;
      r.material = next.material;
      r.color = ROOF_MATERIAL_STYLES[next.material].color;
    }
    if (kind !== 'flat') r.parapet = false;
  });
}

/** A new covering: its usual color comes with it unless the color was picked by hand. */
export function setRoofMaterial(id: string, material: Roof['material']) {
  edit(id, (r) => {
    const wasUsual = r.color === ROOF_MATERIAL_STYLES[r.material].color;
    r.material = material;
    if (wasUsual) r.color = ROOF_MATERIAL_STYLES[material].color;
  });
}

/** Refit a roof to the walls of its floor, keeping its settings. */
export function refitRoof(id: string): boolean {
  const d = useDesign.getState().design;
  const roof = d.roofs.find((r) => r.id === id);
  const box = roof && fitRoofToWalls(d, roof.floor);
  if (!box) {
    useUi.getState().showToast('There are no walls on that floor to fit the roof to.');
    return false;
  }
  edit(id, (r) => void Object.assign(r, box));
  return true;
}

/** Put a roof (and the skylights in it) on the walls of another floor. */
export function moveRoofToFloor(id: string, floor: string) {
  const d0 = useDesign.getState().design;
  const roof = d0.roofs.find((r) => r.id === id);
  if (!roof || roof.floor === floor) return;
  const mine = new Set(d0.skylights.filter((s) => s.floor === roof.floor && skylightPlacement(d0.roofs, s.floor, s)?.roof.id === id).map((s) => s.id));
  useDesign.getState().update((d) => {
    const r = d.roofs.find((x) => x.id === id);
    if (r) r.floor = floor;
    for (const s of d.skylights) if (mine.has(s.id)) s.floor = floor;
  });
}

/** Turn the ridge a quarter turn (the roof's sides swap). */
export function turnRoof(id: string) {
  edit(id, (r) => {
    [r.w, r.d] = [r.d, r.w];
    r.rotation = (r.rotation + 90) % 360;
  });
}

/**
 * Roofs for a house made of wings (an L, a T, a U): the outline of the rooms of this floor is cut into rectangles and each gets a roof,
 * the ones that run into another wing made long enough to meet it in a valley. Returns how many roofs it made.
 */
export function addRoofWings(kind: RoofKind): number {
  const d = useDesign.getState().design;
  const floor = floorId();
  const outlines = atticOutlines(d, floor).filter((p) => isRectilinear(p));
  const wings = outlines.flatMap((p) => wingsOf(p));
  if (!wings.length) {
    useUi.getState().showToast('Wing roofs need rooms with square corners on this floor. For other shapes draw the roofs with the roof tool.');
    return 0;
  }
  const roofs = wings.map((box) => newRoof(floor, box, kind));
  useDesign.getState().update((draft) => void draft.roofs.push(...roofs));
  useUi.getState().select({ kind: 'roof', id: roofs[0].id });
  return roofs.length;
}
