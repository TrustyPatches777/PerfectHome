/** Mouse-driven edits of existing items: moving walls, dragging endpoints, sliding doors along walls. */
import type { Draft } from 'immer';
import type { Design, Point } from '../model';
import { clampOpeningPos, openingOverlaps, projectOnWall, samePoint, wallFrame, wallLength } from '../geometry';
import { useDesign } from '../store/design';
import { newId } from '../model';
import { useUi } from '../store/ui';
import { RULER_SIZE, clientToWorld, dragSession, snapScalar, snapWorld } from './input';
import { getStage } from './stage';

type End = 'a' | 'b';

/** Keep every opening of the given walls inside its (possibly shorter) wall. */
export function fixOpenings(d: Draft<Design>, wallIds: Set<string>) {
  for (const o of d.openings) {
    if (!wallIds.has(o.wallId)) continue;
    const wall = d.walls.find((w) => w.id === o.wallId);
    if (wall) o.pos = clampOpeningPos(o.pos, o.width, wallLength(wall));
  }
}

/** All wall endpoints that sit exactly on `p` (so connected walls move together). */
function endsAt(d: Design, p: Point, floor: string): { id: string; end: End }[] {
  const out: { id: string; end: End }[] = [];
  for (const w of d.walls) {
    if (w.floor !== floor) continue;
    if (samePoint(w.a, p)) out.push({ id: w.id, end: 'a' });
    if (samePoint(w.b, p)) out.push({ id: w.id, end: 'b' });
  }
  return out;
}

/** Change a wall's length by moving its `b` end (and any walls joined there). */
export function setWallLength(wallId: string, length: number) {
  useDesign.getState().update((d) => {
    const w = d.walls.find((x) => x.id === wallId);
    if (!w || length < 0.05 || w.bulge) return; // a curved wall's length follows from its curve
    const f = wallFrame(w);
    const nb = { x: w.a.x + f.u.x * length, y: w.a.y + f.u.y * length };
    const touched = new Set([wallId]);
    for (const e of endsAt(d as Design, w.b, w.floor)) {
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
  const ends = [...endsAt(d0, a0, wall.floor), ...endsAt(d0, b0, wall.floor)].filter((e) => e.id !== wallId);
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
  const ends = endsAt(d0, origin, wall.floor);
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
    const L = wallLength(wall);
    const pos = clampOpeningPos(snapScalar(s), opening.width, L);
    const others = useDesign.getState().design.openings.filter((o) => o.wallId === wall.id);
    if (openingOverlaps(others, pos, opening.width, openingId)) return;
    useDesign.getState().update((d) => void (d.openings.find((o) => o.id === openingId)!.pos = pos));
  });
}

type PolyKind = 'room' | 'zone' | 'strip';

const polyList = (d: Draft<Design>, kind: PolyKind) => (kind === 'room' ? d.rooms : kind === 'zone' ? d.zones : d.strips);

/** Drag one corner/point of a room, outdoor area or street/fence line. */
export function startPointDrag(evt: MouseEvent, kind: PolyKind, id: string, index: number) {
  const item = (polyList(useDesign.getState().design as Draft<Design>, kind) as { id: string; points: Point[] }[]).find((x) => x.id === id);
  if (!item) return;
  const origin = { ...item.points[index] };
  let current = origin; // the point's own latest position must not act as a snap target
  dragSession(evt, (world) => {
    const p = snapWorld(world, { ignore: (q) => samePoint(q, origin) || samePoint(q, current), faces: kind !== 'room' }).p;
    current = p;
    useDesign.getState().update((d) => {
      const r = (polyList(d, kind) as { id: string; points: Point[] }[]).find((x) => x.id === id);
      if (r) r.points[index] = { ...p };
    });
  });
}

/** Drag a whole outdoor area or line feature. */
export function startPolyMove(evt: MouseEvent, kind: 'zone' | 'strip', id: string) {
  const item = (polyList(useDesign.getState().design as Draft<Design>, kind) as { id: string; points: Point[] }[]).find((x) => x.id === id);
  if (!item) return;
  const orig = item.points.map((p) => ({ ...p }));
  dragSession(evt, (world, start) => {
    const raw = { x: orig[0].x + world.x - start.x, y: orig[0].y + world.y - start.y };
    const snapped = snapWorld(raw, { ignore: () => true }).p; // grid only
    const dx = snapped.x - orig[0].x;
    const dy = snapped.y - orig[0].y;
    useDesign.getState().update((d) => {
      const r = (polyList(d, kind) as { id: string; points: Point[] }[]).find((x) => x.id === id);
      if (r) r.points = orig.map((p) => ({ x: p.x + dx, y: p.y + dy }));
    });
  });
}

/** Drag one end of a measurement. */
export function startDimensionEndpointDrag(evt: MouseEvent, id: string, end: End) {
  const dim = useDesign.getState().design.dimensions.find((m) => m.id === id);
  if (!dim) return;
  let current = { ...dim[end] };
  dragSession(evt, (world) => {
    const p = snapWorld(world, { ignore: (q) => samePoint(q, current) }).p;
    current = p;
    useDesign.getState().update((d) => {
      const m = d.dimensions.find((x) => x.id === id);
      if (m) m[end] = { ...p };
    });
  });
}

/** Bend a wall by dragging the handle at its middle: the wall's bulge follows the cursor (snaps back to straight near 0). */
export function startCurveDrag(evt: MouseEvent, wallId: string) {
  const wall = useDesign.getState().design.walls.find((w) => w.id === wallId);
  if (!wall) return;
  const f = wallFrame({ ...wall, bulge: undefined }); // the straight chord a→b
  const mid = { x: (wall.a.x + wall.b.x) / 2, y: (wall.a.y + wall.b.y) / 2 };
  const chord = Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y);
  dragSession(evt, (world) => {
    let h = (world.x - mid.x) * f.n.x + (world.y - mid.y) * f.n.y;
    h = Math.round(h / 0.05) * 0.05; // 5 cm steps
    h = Math.max(-chord, Math.min(chord, h));
    useDesign.getState().update((d) => {
      const w = d.walls.find((x) => x.id === wallId);
      if (!w) return;
      if (Math.abs(h) < 0.04) delete w.bulge;
      else w.bulge = Math.round(h * 100) / 100;
      fixOpenings(d, new Set([wallId]));
    });
  });
}

/**
 * Move (or create) a guide line with the mouse. Dropping it back onto the ruler it came from removes it.
 * The whole drag is one undo step.
 */
function guideSession(startEvt: MouseEvent, existingId: string | null, newAxis?: 'x' | 'y') {
  const store = useDesign.getState();
  let id = existingId;
  let axis = newAxis;
  if (id) {
    const g = store.design.guides.find((x) => x.id === id);
    if (!g) return;
    axis = g.axis;
  }
  const wrap = getStage()!.container().getBoundingClientRect();
  const edge = useUi.getState().showRulers ? RULER_SIZE : 0;
  const overRuler = (e: MouseEvent) => (axis === 'y' ? e.clientY < wrap.top + edge : e.clientX < wrap.left + edge);
  const posAt = (e: MouseEvent) => {
    const w = clientToWorld(e.clientX, e.clientY);
    return Math.round(snapScalar(axis === 'x' ? w.x : w.y) * 1000) / 1000;
  };
  let started = false;
  const begin = () => {
    started = true;
    useDesign.getState().beginTx();
  };
  if (!id) {
    id = newId();
    const created = id;
    begin();
    useDesign.getState().update((d) => void d.guides.push({ id: created, axis: axis!, pos: posAt(startEvt) }));
    useUi.getState().select({ kind: 'guide', id });
  }
  const guideId = id;
  const move = (e: MouseEvent) => {
    if (!started) {
      if (Math.hypot(e.clientX - startEvt.clientX, e.clientY - startEvt.clientY) < 3) return;
      begin();
    }
    const pos = posAt(e);
    useDesign.getState().update((d) => {
      const g = d.guides.find((x) => x.id === guideId);
      if (g) g.pos = pos;
    });
  };
  const up = (e: MouseEvent) => {
    window.removeEventListener('mousemove', move);
    window.removeEventListener('mouseup', up);
    if (!started) return;
    if (overRuler(e)) {
      useDesign.getState().update((d) => void (d.guides = d.guides.filter((x) => x.id !== guideId)));
      useUi.getState().select(null);
    }
    useDesign.getState().endTx();
  };
  window.addEventListener('mousemove', move);
  window.addEventListener('mouseup', up);
}

export const startGuideDrag = (evt: MouseEvent, id: string) => guideSession(evt, id);
export const startGuideFromRuler = (evt: MouseEvent, axis: 'x' | 'y') => guideSession(evt, null, axis);
