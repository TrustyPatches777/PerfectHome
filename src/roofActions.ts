/** Making and changing roofs: from a box you drag, from the walls of the floor, kind changes that keep the look sensible. */
import { floorId } from './store/floor';
import { newId, type Roof, type RoofKind } from './model';
import { ROOF_MATERIAL_STYLES, ROOF_STYLES, fitRoofToWalls, type RoofBox } from './roofs';
import { useDesign } from './store/design';
import { useUi } from './store/ui';

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

/** Turn the ridge a quarter turn (the roof's sides swap). */
export function turnRoof(id: string) {
  edit(id, (r) => {
    [r.w, r.d] = [r.d, r.w];
    r.rotation = (r.rotation + 90) % 360;
  });
}
