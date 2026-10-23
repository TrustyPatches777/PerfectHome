/**
 * "Check plan": finds things that will not work in real life. Pure analysis of a design, so it can be tested;
 * the canvas draws the markers and the panel lists the messages.
 */
import { catalogItem, catalogLayer, furnitureHeight } from './catalog';
import { doorGeometry, polygonArea, polygonsOverlap, wallOutlinePoints } from './geometry';
import type { Design, ItemRef, Point } from './model';
import { rectCorners } from './selection';
import { furnitureFootprint } from './shadows';

export type IssueKind = 'door-blocked' | 'door-collision' | 'in-wall' | 'narrow-gap';

export interface Issue {
  /** Stable key for lists. */
  id: string;
  kind: IssueKind;
  message: string;
  /** Where to look (center of the problem). */
  at: Point;
  /** Shape to highlight: the blocked door swing, or the overlapping item. */
  polygon?: Point[];
  /** For narrow gaps: a line across the gap. */
  line?: [Point, Point];
  refs: ItemRef[];
}

export const DEFAULT_MIN_PASSAGE = 0.7;

const DOORS = new Set(['door', 'double', 'french']);

interface Obstacle {
  ref: ItemRef;
  name: string;
  poly: Point[];
  height: number;
  area: number;
}

const centerOf = (poly: Point[]): Point => ({ x: poly.reduce((s, p) => s + p.x, 0) / poly.length, y: poly.reduce((s, p) => s + p.y, 0) / poly.length });

/** Things you can bump into on a floor: furniture (not rugs or wall symbols) and stairs. */
function obstacles(d: Design, floor: string): Obstacle[] {
  const out: Obstacle[] = [];
  for (const f of d.furniture.filter((x) => x.floor === floor)) {
    if (catalogLayer(f.type) === 'tech') continue;
    const h = furnitureHeight(f);
    if (h < 0.1) continue; // rugs, parking markings
    const poly = furnitureFootprint(f);
    out.push({ ref: { kind: 'furniture', id: f.id }, name: f.label || catalogItem(f.type).label, poly, height: h, area: f.w * f.d });
  }
  for (const s of d.stairs.filter((x) => x.floor === floor)) {
    const poly = rectCorners(s.x, s.y, s.w, s.d, s.rotation);
    out.push({ ref: { kind: 'stair', id: s.id }, name: 'the stairs', poly, height: 3, area: s.w * s.d });
  }
  return out;
}

/** The floor area swept by a door's leaves as polygons (a quarter circle per leaf). */
function swings(d: Design, floor: string) {
  const out: { id: string; name: string; poly: Point[]; ref: ItemRef }[] = [];
  const walls = new Map(d.walls.filter((w) => w.floor === floor).map((w) => [w.id, w]));
  for (const o of d.openings) {
    const wall = walls.get(o.wallId);
    if (!wall || !DOORS.has(o.kind)) continue;
    const leaves = o.kind === 'door' ? [o] : [{ ...o, pos: o.pos - o.width / 4, width: o.width / 2, hinge: 'a' as const }, { ...o, pos: o.pos + o.width / 4, width: o.width / 2, hinge: 'b' as const }];
    for (const leaf of leaves) {
      const g = doorGeometry(wall, leaf, 8);
      out.push({ id: o.id, name: o.kind === 'door' ? 'a door' : 'a double door', poly: [g.hinge, ...g.arc], ref: { kind: 'opening', id: o.id } });
    }
  }
  return out;
}

/** Separation of two convex polygons along their edge normals, plus how far they face each other sideways. */
function facingGap(a: Point[], b: Point[]): { gap: number; overlap: number; nx: number; ny: number } | null {
  let best: { gap: number; overlap: number; nx: number; ny: number } | null = null;
  const axes: Point[] = [];
  for (const poly of [a, b])
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i];
      const q = poly[(i + 1) % poly.length];
      const len = Math.hypot(q.x - p.x, q.y - p.y);
      if (len > 1e-6) axes.push({ x: -(q.y - p.y) / len, y: (q.x - p.x) / len });
    }
  const project = (poly: Point[], ax: Point) => {
    const v = poly.map((p) => p.x * ax.x + p.y * ax.y);
    return [Math.min(...v), Math.max(...v)] as const;
  };
  for (const n of axes) {
    const [a0, a1] = project(a, n);
    const [b0, b1] = project(b, n);
    const gap = Math.max(b0 - a1, a0 - b1);
    if (gap <= 0) continue;
    const t = { x: -n.y, y: n.x };
    const [ta0, ta1] = project(a, t);
    const [tb0, tb1] = project(b, t);
    const overlap = Math.min(ta1, tb1) - Math.max(ta0, tb0);
    if (!best || gap > best.gap) best = { gap, overlap, nx: n.x, ny: n.y };
  }
  return best;
}

export function findIssues(d: Design, floor: string, minPassage = DEFAULT_MIN_PASSAGE): Issue[] {
  const issues: Issue[] = [];
  const things = obstacles(d, floor);
  const doors = swings(d, floor);
  const cm = (m: number) => `${Math.round(m * 100)} cm`;

  // 1. doors that cannot open
  for (const s of doors) {
    for (const o of things) {
      if (polygonsOverlap(s.poly, o.poly)) {
        issues.push({
          id: `blocked:${s.id}:${o.ref.id}`,
          kind: 'door-blocked',
          message: `${s.name[0].toUpperCase()}${s.name.slice(1)} cannot open fully: ${o.name} is in its way.`,
          at: centerOf(s.poly),
          polygon: s.poly,
          refs: [s.ref, o.ref],
        });
      }
    }
  }
  // two doors that swing into each other (different doors only)
  for (let i = 0; i < doors.length; i++)
    for (let j = i + 1; j < doors.length; j++) {
      if (doors[i].id !== doors[j].id && polygonsOverlap(doors[i].poly, doors[j].poly)) {
        issues.push({
          id: `collide:${doors[i].id}:${doors[j].id}`,
          kind: 'door-collision',
          message: 'Two doors swing into each other.',
          at: centerOf(doors[i].poly),
          polygon: doors[i].poly,
          refs: [doors[i].ref, doors[j].ref],
        });
      }
    }

  // 2. furniture standing in a wall
  const walls = d.walls.filter((w) => w.floor === floor);
  for (const o of things) {
    if (o.ref.kind !== 'furniture') continue;
    for (const w of walls) {
      if (!w.bulge && polygonsOverlap(o.poly, wallOutlinePoints(w))) {
        issues.push({ id: `inwall:${o.ref.id}:${w.id}`, kind: 'in-wall', message: `${o.name[0].toUpperCase()}${o.name.slice(1)} overlaps a wall.`, at: centerOf(o.poly), polygon: o.poly, refs: [o.ref] });
        break;
      }
    }
  }

  // 3. gaps that are too narrow to walk through (big, tall things facing each other, or a wall)
  const big = things.filter((o) => o.height >= 0.45 && o.area >= 0.35);
  const wallBodies = walls.filter((w) => !w.bulge).map((w) => ({ id: w.id, poly: wallOutlinePoints(w) }));
  const gap = (a: Point[], b: Point[], nameA: string, nameB: string, refs: ItemRef[]) => {
    const g = facingGap(a, b);
    if (!g || g.gap < 0.15 || g.gap >= minPassage || g.overlap < 0.4) return;
    // a line across the gap, in the middle of where they face each other
    const ca = centerOf(a);
    const cb = centerOf(b);
    const mid = { x: (ca.x + cb.x) / 2, y: (ca.y + cb.y) / 2 };
    issues.push({
      id: `gap:${refs.map((r) => r.id).join(':')}`,
      kind: 'narrow-gap',
      message: `Only ${cm(g.gap)} between ${nameA} and ${nameB}: too narrow to walk through (minimum ${cm(minPassage)}).`,
      at: mid,
      line: [
        { x: mid.x - g.nx * g.gap * 0.5, y: mid.y - g.ny * g.gap * 0.5 },
        { x: mid.x + g.nx * g.gap * 0.5, y: mid.y + g.ny * g.gap * 0.5 },
      ],
      refs,
    });
  };
  for (let i = 0; i < big.length; i++) {
    for (let j = i + 1; j < big.length; j++) gap(big[i].poly, big[j].poly, big[i].name, big[j].name, [big[i].ref, big[j].ref]);
    for (const w of wallBodies) {
      // only against walls that run past the item, otherwise the item is simply "near a wall corner"
      if (polygonArea(w.poly) > 0.3) gap(big[i].poly, w.poly, big[i].name, 'the wall', [big[i].ref]);
    }
  }
  return dedupe(issues);
}

function dedupe(list: Issue[]): Issue[] {
  const seen = new Set<string>();
  return list.filter((i) => (seen.has(i.id) ? false : (seen.add(i.id), true)));
}
