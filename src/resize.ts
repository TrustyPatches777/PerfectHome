/**
 * Changing the size of the house: scale a whole floor by a factor, or stretch a part of it (everything inside a box moves, what is
 * attached to it stretches along, like the stretch command of a drawing program). Pure operations on a design or an immer draft.
 */
import type { Draft } from 'immer';
import { clampOpeningPos, wallLength, type Bounds } from './geometry';
import type { Design, Point, Wall } from './model';
import { allRefsOnFloor } from './mirror';
import { itemBounds, unionBounds } from './selection';

type Mutable = Draft<Design> | Design;

/** The middle of what is on a floor. */
export function floorCenter(d: Design, floor: string): Point | null {
  const box = unionBounds(allRefsOnFloor(d, floor).map((r) => itemBounds(d, r)).filter((b): b is Bounds => !!b));
  return box && { x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2 };
}

/**
 * Scale the plan of a floor by `factor` about `c`: walls, rooms, areas, lines and every position get further apart (or closer) but the
 * things themselves keep their size (a 2 m sofa stays 2 m, a wall stays 15 cm thick); roofs grow with the house.
 */
export function scaleFloor(d: Mutable, floor: string, factor: number, c: Point) {
  if (!(factor > 0.05 && factor < 20)) return;
  const p = (q: Point): Point => ({ x: c.x + (q.x - c.x) * factor, y: c.y + (q.y - c.y) * factor });
  const at = (o: { x: number; y: number }) => {
    const q = p(o);
    o.x = q.x;
    o.y = q.y;
  };
  const wallIds = new Set<string>();
  for (const w of d.walls) {
    if (w.floor !== floor) continue;
    wallIds.add(w.id);
    w.a = p(w.a);
    w.b = p(w.b);
    if (w.bulge) w.bulge *= factor;
  }
  for (const o of d.openings) {
    if (!wallIds.has(o.wallId)) continue;
    const w = d.walls.find((x) => x.id === o.wallId)!;
    o.pos = clampOpeningPos(o.pos * factor, o.width, wallLength(w as Wall));
  }
  for (const r of d.rooms) {
    if (r.floor !== floor) continue;
    r.points = r.points.map(p);
    if (r.seed) r.seed = p(r.seed);
  }
  for (const z of d.zones) if (z.floor === floor) z.points = z.points.map(p);
  for (const s of d.strips) {
    if (s.floor !== floor) continue;
    s.points = s.points.map(p);
    for (const g of s.gates ?? []) g.pos *= factor;
  }
  for (const list of [d.furniture, d.stairs, d.skylights, d.labels, d.notes] as { floor: string; x: number; y: number }[][]) for (const o of list) if (o.floor === floor) at(o);
  for (const r of d.roofs) {
    if (r.floor !== floor) continue;
    at(r);
    r.w *= factor;
    r.d *= factor;
  }
  for (const m of d.dimensions) {
    if (m.floor !== floor) continue;
    m.a = p(m.a);
    m.b = p(m.b);
  }
}

const inBox = (q: Point, b: Bounds) => q.x >= b.minX - 1e-9 && q.x <= b.maxX + 1e-9 && q.y >= b.minY - 1e-9 && q.y <= b.maxY + 1e-9;

/**
 * Stretch: every corner and point of the floor that lies inside `box` moves by (dx, dy) from where it is in `base` (an untouched copy,
 * so a long drag does not drift); a piece of furniture, a stair or a note moves as a whole when its middle is in the box. Walls with
 * only one end in the box get longer or shorter, and the doors and windows stay where they are along them.
 */
export function stretchFromBase(d: Mutable, base: Design, floor: string, box: Bounds, dx: number, dy: number) {
  const mv = (q: Point): Point => (inBox(q, box) ? { x: q.x + dx, y: q.y + dy } : { ...q });
  base.walls.forEach((w, i) => {
    if (w.floor !== floor) return;
    const t = d.walls.find((x) => x.id === w.id);
    if (!t) return;
    t.a = mv(w.a);
    t.b = mv(w.b);
    void i;
  });
  for (const o of d.openings) {
    const w = d.walls.find((x) => x.id === o.wallId);
    const orig = base.openings.find((x) => x.id === o.id);
    if (!w || !orig || w.floor !== floor) continue;
    o.pos = clampOpeningPos(orig.pos, o.width, wallLength(w as Wall));
  }
  for (const r of base.rooms) {
    if (r.floor !== floor) continue;
    const t = d.rooms.find((x) => x.id === r.id);
    if (!t) continue;
    t.points = r.points.map(mv);
    if (r.seed) t.seed = mv(r.seed);
  }
  for (const z of base.zones) {
    const t = z.floor === floor ? d.zones.find((x) => x.id === z.id) : undefined;
    if (t) t.points = z.points.map(mv);
  }
  for (const s of base.strips) {
    const t = s.floor === floor ? d.strips.find((x) => x.id === s.id) : undefined;
    if (t) t.points = s.points.map(mv);
  }
  const whole = <T extends { id: string; floor: string; x: number; y: number }>(baseList: T[], list: T[]) => {
    for (const o of baseList) {
      if (o.floor !== floor || !inBox(o, box)) continue;
      const t = list.find((x) => x.id === o.id);
      if (t) {
        t.x = o.x + dx;
        t.y = o.y + dy;
      }
    }
  };
  whole(base.furniture, d.furniture as typeof base.furniture);
  whole(base.stairs, d.stairs as typeof base.stairs);
  whole(base.roofs, d.roofs as typeof base.roofs);
  whole(base.skylights, d.skylights as typeof base.skylights);
  whole(base.labels, d.labels as typeof base.labels);
  whole(base.notes, d.notes as typeof base.notes);
  for (const m of base.dimensions) {
    const t = m.floor === floor ? d.dimensions.find((x) => x.id === m.id) : undefined;
    if (t) {
      t.a = mv(m.a);
      t.b = mv(m.b);
    }
  }
}
