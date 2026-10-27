/**
 * Mirroring: turn items (a room, a whole floor) over, left-right (`axis: 'x'`, about the vertical line x = c) or top-bottom
 * (`axis: 'y'`, about the horizontal line y = c). Pure operations on a design or an immer draft.
 *
 * A piece of furniture ends up where the mirror image would be and facing the mirrored way; what is inside an asymmetric piece (the side
 * the chaise of a corner sofa is on) is not turned over.
 */
import type { Draft } from 'immer';
import type { Design, ItemRef, Point } from './model';
import { itemBounds, unionBounds } from './selection';

type Mutable = Draft<Design> | Design;
export type Axis = 'x' | 'y';

const norm = (deg: number) => (((Math.round(deg * 100) / 100) % 360) + 360) % 360;

/** The rotation of something that has been mirrored: turning it over about a vertical line reverses its turn, about a horizontal one too and adds a half turn. */
export const mirroredRotation = (rotation: number, axis: Axis): number => norm(axis === 'x' ? -rotation : 180 - rotation);

/** Mirror the items in `refs` about the line through `c`. (Openings travel with their wall; guides and anything else are left alone.) */
export function mirrorRefs(d: Mutable, refs: ItemRef[], axis: Axis, c: number) {
  const flip = (p: Point): Point => (axis === 'x' ? { x: 2 * c - p.x, y: p.y } : { x: p.x, y: 2 * c - p.y });
  const set = (o: { x: number; y: number }) => {
    const p = flip(o);
    o.x = p.x;
    o.y = p.y;
  };
  const ids = (kind: ItemRef['kind']) => new Set(refs.filter((r) => r.kind === kind).map((r) => r.id));
  const walls = ids('wall');
  for (const w of d.walls) {
    if (!walls.has(w.id)) continue;
    w.a = flip(w.a);
    w.b = flip(w.b);
    if (w.bulge) w.bulge = -w.bulge; // an arc that bulged to the right of a→b now bulges to its left
    if (w.paint) w.paint = { ...(w.paint.r ? { l: w.paint.r } : {}), ...(w.paint.l ? { r: w.paint.l } : {}) };
  }
  for (const o of d.openings) {
    if (!walls.has(o.wallId)) continue;
    o.swing = o.swing === 1 ? -1 : 1;
  }
  const rooms = ids('room');
  for (const r of d.rooms) {
    if (!rooms.has(r.id)) continue;
    r.points = r.points.map(flip).reverse(); // keep the way round
    if (r.seed) r.seed = flip(r.seed);
  }
  const zones = ids('zone');
  for (const z of d.zones) if (zones.has(z.id)) z.points = z.points.map(flip).reverse();
  const strips = ids('strip');
  for (const s of d.strips) {
    if (!strips.has(s.id)) continue;
    s.points = s.points.map(flip);
    for (const g of s.gates ?? []) g.swing = g.swing === 1 ? -1 : 1;
  }
  const furniture = ids('furniture');
  for (const f of d.furniture) {
    if (!furniture.has(f.id)) continue;
    set(f);
    f.rotation = mirroredRotation(f.rotation, axis);
  }
  const stairs = ids('stair');
  for (const s of d.stairs) {
    if (!stairs.has(s.id)) continue;
    set(s);
    s.rotation = mirroredRotation(s.rotation, axis);
    s.flip = !s.flip; // the stair itself is turned over too (which way an L or U turns)
  }
  const roofs = ids('roof');
  for (const r of d.roofs) {
    if (!roofs.has(r.id)) continue;
    set(r);
    r.rotation = mirroredRotation(r.rotation, axis);
  }
  const skylights = ids('skylight');
  for (const s of d.skylights) if (skylights.has(s.id)) set(s);
  const labels = ids('label');
  for (const l of d.labels) if (labels.has(l.id)) set(l); // the text itself stays readable
  const notes = ids('note');
  for (const n of d.notes) if (notes.has(n.id)) set(n);
  const dims = ids('dimension');
  for (const m of d.dimensions) {
    if (!dims.has(m.id)) continue;
    m.a = flip(m.a);
    m.b = flip(m.b);
  }
}

/** The middle line of a set of items on the axis perpendicular to the mirror: where the mirror stands so the group stays put. */
export function mirrorCenter(d: Design, refs: ItemRef[], axis: Axis): number | null {
  const box = unionBounds(refs.map((r) => itemBounds(d, r)).filter((b): b is NonNullable<typeof b> => !!b));
  if (!box) return null;
  return axis === 'x' ? (box.minX + box.maxX) / 2 : (box.minY + box.maxY) / 2;
}

/** Everything that lives on a floor (locked layers included: mirroring a floor turns the whole floor). */
export function allRefsOnFloor(d: Design, floor: string): ItemRef[] {
  const on = <T extends { id: string; floor: string }>(kind: ItemRef['kind'], list: T[]): ItemRef[] => list.filter((i) => i.floor === floor).map((i) => ({ kind, id: i.id }));
  return [
    ...on('wall', d.walls),
    ...on('room', d.rooms),
    ...on('zone', d.zones),
    ...on('strip', d.strips),
    ...on('furniture', d.furniture),
    ...on('stair', d.stairs),
    ...on('roof', d.roofs),
    ...on('skylight', d.skylights),
    ...on('label', d.labels),
    ...on('dimension', d.dimensions),
    ...on('note', d.notes),
  ];
}
