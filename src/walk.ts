/**
 * Walking through the house in 3D: what you cannot walk through (walls, closed doors, windows, furniture, railings, fences), and how
 * high the ground is under your feet (floors, stairs, the garden, pools, holes in the floor). Pure maths, so it can be tested; the
 * viewer (view3d/scene.ts) asks this every frame.
 */
import { furnitureHeight } from './catalog';
import { exemptFromWalls, footprint, pushOut } from './fit';
import { pointInPolygon, wallLength, wallRangePieces, wallSolidSegments } from './geometry';
import type { Design, Point, Stair } from './model';
import { atticClearance } from './roofs';
import { densify, guardEdges, railPaths, stairOutline, stairSteps, stairTopAt } from './stairs';
import { POOL_DEPTH } from './view3d/furniture3d';

/** How close to a wall you can get (the radius of the walker, in meters). */
export const WALKER_RADIUS = 0.28;
/** The highest step you walk up without jumping, and the least headroom you can walk under in an attic. */
export const STEP_UP = 0.55;
export const HEAD_ROOM = 1.5;

interface Obstacle {
  poly: Point[];
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

const obstacle = (poly: Point[]): Obstacle => ({
  poly,
  minX: Math.min(...poly.map((p) => p.x)),
  maxX: Math.max(...poly.map((p) => p.x)),
  minY: Math.min(...poly.map((p) => p.y)),
  maxY: Math.max(...poly.map((p) => p.y)),
});

/** A stair-box point (0..w, 0..d) on the plan. */
function stairToPlan(s: Stair, p: Point): Point {
  const c = Math.cos((s.rotation * Math.PI) / 180);
  const sn = Math.sin((s.rotation * Math.PI) / 180);
  const lx = p.x - s.w / 2;
  const ly = p.y - s.d / 2;
  return { x: s.x + lx * c - ly * sn, y: s.y + lx * sn + ly * c };
}

/** A plan point in a stair's box. */
function planToStair(s: Stair, p: Point): Point {
  const c = Math.cos((s.rotation * Math.PI) / 180);
  const sn = Math.sin((s.rotation * Math.PI) / 180);
  const dx = p.x - s.x;
  const dy = p.y - s.y;
  return { x: dx * c + dy * sn + s.w / 2, y: -dx * sn + dy * c + s.d / 2 };
}

/** A thin rectangle along a line (rails, fences). */
function bar(a: Point, b: Point, width: number): Point[] {
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const nx = (-(b.y - a.y) / len) * (width / 2);
  const ny = ((b.x - a.x) / len) * (width / 2);
  return [{ x: a.x + nx, y: a.y + ny }, { x: b.x + nx, y: b.y + ny }, { x: b.x - nx, y: b.y - ny }, { x: a.x - nx, y: a.y - ny }];
}

export interface WalkWorld {
  /** The highest place to stand at (x, z) that you can reach from height `y`, stepping up or falling down. Null when there is nothing at all. */
  heightAt: (x: number, z: number, y: number) => number | null;
  /** True where you cannot stand (under a roof that is too low). */
  blockedAt: (x: number, z: number, y: number) => boolean;
  /** Move a walker standing at height `y` by (dx, dz), sliding along whatever is in the way. */
  move: (x: number, z: number, y: number, dx: number, dz: number) => { x: number; z: number };
  /** Index of the floor you are on when your feet are at `y`. */
  floorIndexAt: (y: number) => number;
  /** The nearest place to (x, z) where you can stand without being inside something (it is (x, z) itself when that is free). */
  freeSpot: (x: number, z: number, y: number) => { x: number; z: number };
}

const circle = (c: Point, r: number): Point[] => Array.from({ length: 12 }, (_, i) => ({ x: c.x + Math.cos((i * Math.PI) / 6) * r, y: c.y + Math.sin((i * Math.PI) / 6) * r }));

/**
 * Everything solid and every surface, for a design with some doors open (`openDoors` are opening ids).
 * Build it once per change of the design or of a door, not every frame.
 */
export function buildWalkWorld(d: Design, openDoors: ReadonlySet<string>, elev: ReadonlyMap<string, number>): WalkWorld {
  const floors = d.floors.map((f, i) => ({ id: f.id, index: i, elev: elev.get(f.id) ?? 0, attic: !!f.attic }));
  const byFloor = (id: string) => floors.find((f) => f.id === id);

  // ---- what blocks the way, floor by floor
  const solids: Obstacle[][] = floors.map(() => []);
  const add = (index: number, poly: Point[]) => solids[index]?.push(obstacle(poly));

  for (const w of d.walls) {
    const f = byFloor(w.floor);
    if (!f) continue;
    const ops = d.openings.filter((o) => o.wallId === w.id);
    for (const [a, b] of wallSolidSegments(w, ops)) if (b - a > 0.005) for (const p of wallRangePieces(w, a, b)) add(f.index, p);
    // openings: windows always stop you, doors do while they are shut, open passages never
    const L = wallLength(w);
    for (const o of ops) {
      const shut = o.kind === 'window' || o.kind === 'bay' || (o.kind !== 'gap' && !openDoors.has(o.id));
      if (!shut) continue;
      const s0 = Math.max(0, o.pos - o.width / 2);
      const s1 = Math.min(L, o.pos + o.width / 2);
      if (s1 - s0 > 0.01) for (const p of wallRangePieces(w, s0, s1)) add(f.index, p);
    }
  }

  for (const fu of d.furniture) {
    const f = byFloor(fu.floor);
    if (!f) continue;
    if (/^tree/.test(fu.type)) {
      add(f.index, footprint({ x: fu.x, y: fu.y, w: 0.35, d: 0.35, rotation: 0 })); // only the trunk
      continue;
    }
    if (exemptFromWalls(fu) || furnitureHeight(fu) < 0.35) continue;
    add(f.index, footprint(fu));
  }
  for (const st of d.strips) {
    const f = byFloor(st.floor);
    if (!f || (st.kind !== 'fence' && st.kind !== 'hedge')) continue;
    for (let i = 0; i + 1 < st.points.length; i++) add(f.index, bar(st.points[i], st.points[i + 1], Math.max(st.width, 0.08)));
  }
  // railings along the flights (they belong to the floor the stair starts on and to the one above) and the guard rails round the stairwell
  for (const st of d.stairs) {
    const f = byFloor(st.floor);
    if (!f || !st.railing || st.railing.style === 'none') continue;
    const paths = railPaths(st);
    for (const [on, path] of [[st.railing.a, paths.a], [st.railing.b, paths.b]] as const) {
      if (!on || path.length < 2) continue;
      const dense = densify(path, 0.4).map((p) => stairToPlan(st, p));
      for (let i = 0; i + 1 < dense.length; i++) {
        add(f.index, bar(dense[i], dense[i + 1], 0.08));
        add(f.index + 1, bar(dense[i], dense[i + 1], 0.08));
      }
    }
    if (f.index + 1 < floors.length) for (const [p, q] of guardEdges(st)) add(f.index + 1, bar(stairToPlan(st, p), stairToPlan(st, q), 0.08));
  }

  // ---- surfaces
  const stairsOf = (floorId: string) => d.stairs.filter((s) => s.floor === floorId);
  const stepsOf = new Map(d.stairs.map((s) => [s.id, stairSteps(s)]));
  const outlineOf = new Map(d.stairs.map((s) => [s.id, stairOutline(s).map((q) => stairToPlan(s, q))]));
  const stairHole = (floorIndex: number, p: Point): boolean => (floorIndex > 0 ? stairsOf(floors[floorIndex - 1].id).some((s) => pointInPolygon(p, outlineOf.get(s.id)!)) : false);
  const pools = d.furniture.filter((f) => f.type === 'pool' && (byFloor(f.floor)?.elev ?? 0) === 0);
  const ponds = d.zones.filter((z) => z.kind === 'water' && (byFloor(z.floor)?.elev ?? 0) === 0);
  const basementRooms = d.rooms.filter((r) => (byFloor(r.floor)?.elev ?? 0) < -0.01);

  const candidates = (x: number, z: number): number[] => {
    const p = { x, y: z };
    const out: number[] = [];
    // the ground, except where there is a pool, a pond or a basement under it
    const pool = pools.find((f) => pointInPolygon(p, footprint(f)));
    const pond = ponds.find((zn) => pointInPolygon(p, zn.points));
    if (pool) out.push(-POOL_DEPTH);
    else if (pond) out.push(-0.9);
    else if (!basementRooms.some((r) => pointInPolygon(p, r.points))) out.push(0);
    for (const f of floors) {
      for (const r of d.rooms) {
        if (r.floor !== f.id || !pointInPolygon(p, r.points) || stairHole(f.index, p)) continue;
        out.push(f.elev + 0.01);
      }
      for (const s of stairsOf(f.id)) {
        const top = stairTopAt(s, planToStair(s, p), 0, stepsOf.get(s.id));
        if (top !== null) out.push(f.elev + top);
      }
    }
    return out;
  };

  const floorIndexAt = (y: number) => {
    let best = 0;
    for (const f of floors) if (f.elev <= y + 0.6) best = f.index;
    return best;
  };

  const heightAt = (x: number, z: number, y: number): number | null => {
    const ys = candidates(x, z);
    if (!ys.length) return null;
    const reachable = ys.filter((v) => v <= y + STEP_UP);
    return reachable.length ? Math.max(...reachable) : Math.min(...ys);
  };

  const blockedAt = (x: number, z: number, y: number): boolean => {
    const f = floors[floorIndexAt(y)];
    if (!f?.attic) return false;
    const room = atticClearance(d, f.id, { x, y: z });
    return room !== null && room < HEAD_ROOM;
  };

  const move = (x: number, z: number, y: number, dx: number, dz: number) => {
    const list = solids[floorIndexAt(y)] ?? [];
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.05));
    let cx = x;
    let cz = z;
    for (let i = 0; i < steps; i++) {
      let nx = cx + dx / steps;
      let nz = cz + dz / steps;
      for (let pass = 0; pass < 3; pass++) {
        const poly = circle({ x: nx, y: nz }, WALKER_RADIUS);
        let moved = false;
        for (const o of list) {
          if (o.maxX < nx - WALKER_RADIUS || o.minX > nx + WALKER_RADIUS || o.maxY < nz - WALKER_RADIUS || o.minY > nz + WALKER_RADIUS) continue;
          const push = pushOut(poly, o.poly);
          if (push) {
            nx += push.x;
            nz += push.y;
            moved = true;
            break;
          }
        }
        if (!moved) break;
      }
      if (blockedAt(nx, nz, y)) continue; // too low to stand up in an attic there
      cx = nx;
      cz = nz;
    }
    return { x: cx, z: cz };
  };

  const freeSpot = (x: number, z: number, y: number) => {
    const list = solids[floorIndexAt(y)] ?? [];
    const free = (px: number, pz: number) => {
      const poly = circle({ x: px, y: pz }, WALKER_RADIUS);
      return !blockedAt(px, pz, y) && !list.some((o) => !(o.maxX < px - WALKER_RADIUS || o.minX > px + WALKER_RADIUS || o.maxY < pz - WALKER_RADIUS || o.minY > pz + WALKER_RADIUS) && pushOut(poly, o.poly));
    };
    if (free(x, z)) return { x, z };
    // look outwards in rings for the nearest free place that is still on a floor
    for (let r = 0.25; r <= 5; r += 0.25) {
      for (let k = 0; k < 16; k++) {
        const px = x + Math.cos((k * Math.PI) / 8) * r;
        const pz = z + Math.sin((k * Math.PI) / 8) * r;
        if (free(px, pz) && candidates(px, pz).some((v) => Math.abs(v - y) < STEP_UP)) return { x: px, z: pz };
      }
    }
    return { x, z };
  };

  return { heightAt, blockedAt, move, floorIndexAt, freeSpot };
}
