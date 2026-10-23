/** Mouse-driven edits of existing items: moving walls, dragging endpoints, sliding doors along walls. */
import type { Draft } from 'immer';
import type { Design, Point } from '../model';
import { clampOpeningPos, openingOverlaps, projectOnWall, samePoint, wallFrame } from '../geometry';
import { useDesign } from '../store/design';
import { dragSession, snapScalar, snapWorld } from './input';

type End = 'a' | 'b';

/** Keep every opening of the given walls inside its (possibly shorter) wall. */
export function fixOpenings(d: Draft<Design>, wallIds: Set<string>) {
  for (const o of d.openings) {
    if (!wallIds.has(o.wallId)) continue;
    const wall = d.walls.find((w) => w.id === o.wallId);
    if (wall) o.pos = clampOpeningPos(o.pos, o.width, wallFrame(wall).length);
  }
}

/** All wall endpoints that sit exactly on `p` (so connected walls move together). */
function endsAt(d: Design, p: Point): { id: string; end: End }[] {
  const out: { id: string; end: End }[] = [];
  for (const w of d.walls) {
    if (samePoint(w.a, p)) out.push({ id: w.id, end: 'a' });
    if (samePoint(w.b, p)) out.push({ id: w.id, end: 'b' });
  }
  return out;
}

/** Change a wall's length by moving its `b` end (and any walls joined there). */
export function setWallLength(wallId: string, length: number) {
  useDesign.getState().update((d) => {
    const w = d.walls.find((x) => x.id === wallId);
    if (!w || length < 0.05) return;
    const f = wallFrame(w);
    const nb = { x: w.a.x + f.u.x * length, y: w.a.y + f.u.y * length };
    const touched = new Set([wallId]);
    for (const e of endsAt(d as Design, w.b)) {
      if (e.id === wallId) continue;
      d.walls.find((x) => x.id === e.id)![e.end] = { ...nb };
      touched.add(e.id);
    }
    w.b = nb;
    fixOpenings(d, touched);
  });
}

/** Drag a whole wall; walls joined at its ends follow (stretch) so corners stay closed. */
export function startWallMove(evt: MouseEvent, wallId: string) {
  const d0 = useDesign.getState().design;
  const wall = d0.walls.find((w) => w.id === wallId);
  if (!wall) return;
  const a0 = { ...wall.a };
  const b0 = { ...wall.b };
  const ends = [...endsAt(d0, a0), ...endsAt(d0, b0)].filter((e) => e.id !== wallId);
  const origins = new Map(ends.map((e) => [`${e.id}${e.end}`, { ...d0.walls.find((w) => w.id === e.id)![e.end] }]));

  dragSession(evt, (world, start) => {
    const raw = { x: a0.x + world.x - start.x, y: a0.y + world.y - start.y };
    const snapped = snapWorld(raw, { grid: true, ignore: () => true }).p; // grid only
    const dx = snapped.x - a0.x;
    const dy = snapped.y - a0.y;
    useDesign.getState().update((d) => {
      const w = d.walls.find((x) => x.id === wallId)!;
      w.a = { x: a0.x + dx, y: a0.y + dy };
      w.b = { x: b0.x + dx, y: b0.y + dy };
      const touched = new Set([wallId]);
      for (const e of ends) {
        const o = origins.get(`${e.id}${e.end}`)!;
        d.walls.find((x) => x.id === e.id)![e.end] = { x: o.x + dx, y: o.y + dy };
        touched.add(e.id);
      }
      fixOpenings(d, touched);
    });
  });
}

/** Drag one corner of a wall; every wall end joined there moves with it. */
export function startEndpointDrag(evt: MouseEvent, wallId: string, end: End) {
  const d0 = useDesign.getState().design;
  const wall = d0.walls.find((w) => w.id === wallId);
  if (!wall) return;
  const origin = { ...wall[end] };
  const ends = endsAt(d0, origin);
  let current = origin; // the corner's own latest position must not act as a snap target
  dragSession(evt, (world) => {
    const p = snapWorld(world, { ignore: (q) => samePoint(q, origin) || samePoint(q, current) }).p;
    current = p;
    useDesign.getState().update((d) => {
      const touched = new Set<string>();
      for (const e of ends) {
        d.walls.find((x) => x.id === e.id)![e.end] = { ...p };
        touched.add(e.id);
      }
      fixOpenings(d, touched);
    });
  });
}

/** Slide a door/window along its wall. */
export function startOpeningDrag(evt: MouseEvent, openingId: string) {
  const d0 = useDesign.getState().design;
  const opening = d0.openings.find((o) => o.id === openingId);
  const wall = opening && d0.walls.find((w) => w.id === opening.wallId);
  if (!opening || !wall) return;
  dragSession(evt, (world) => {
    const { s } = projectOnWall(wall, world);
    const L = wallFrame(wall).length;
    const pos = clampOpeningPos(snapScalar(s), opening.width, L);
    const others = useDesign.getState().design.openings.filter((o) => o.wallId === wall.id);
    if (openingOverlaps(others, pos, opening.width, openingId)) return;
    useDesign.getState().update((d) => void (d.openings.find((o) => o.id === openingId)!.pos = pos));
  });
}

/** Drag a corner of a room polygon. */
export function startRoomVertexDrag(evt: MouseEvent, roomId: string, index: number) {
  const room = useDesign.getState().design.rooms.find((r) => r.id === roomId);
  if (!room) return;
  const origin = { ...room.points[index] };
  let current = origin;
  dragSession(evt, (world) => {
    const p = snapWorld(world, { ignore: (q) => samePoint(q, origin) || samePoint(q, current) }).p;
    current = p;
    useDesign.getState().update((d) => {
      const r = d.rooms.find((x) => x.id === roomId);
      if (r) r.points[index] = { ...p };
    });
  });
}
