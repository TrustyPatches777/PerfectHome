/**
 * Pure operations on groups of items: bounds, moving, rotating, aligning, copy & paste.
 * Works on plain `Design` objects (immer drafts included), so it is easy to test.
 */
import type { Draft } from 'immer';
import { catalogLayer } from './catalog';
import { rotatePoint, textBox, wallOutlinePoints, type Bounds } from './geometry';
import { LAYER_OF, newId, type Design, type ItemKind, type ItemRef, type LayerId, type Point } from './model';

type Mutable = Draft<Design> | Design;

export const sameRef = (a: ItemRef, b: ItemRef) => a.kind === b.kind && a.id === b.id;

/** The layer an item lives on (furniture can be on the lamps/electrical layer). */
export function layerOfRef(d: Design, ref: ItemRef): LayerId {
  if (ref.kind === 'furniture') {
    const f = d.furniture.find((x) => x.id === ref.id);
    return f ? catalogLayer(f.type) : 'furniture';
  }
  return LAYER_OF[ref.kind];
}

export const isRefLocked = (d: Design, ref: ItemRef) => d.layers[layerOfRef(d, ref)].locked;

function find<T extends { id: string }>(list: T[], id: string): T | undefined {
  return list.find((x) => x.id === id);
}

export function rectCorners(x: number, y: number, w: number, h: number, rotation: number): Point[] {
  const c = { x, y };
  return [
    { x: x - w / 2, y: y - h / 2 },
    { x: x + w / 2, y: y - h / 2 },
    { x: x + w / 2, y: y + h / 2 },
    { x: x - w / 2, y: y + h / 2 },
  ].map((p) => rotatePoint(p, c, rotation));
}

/** Outline points of an item (used for bounds). Null for things without a place of their own (openings). */
export function itemPoints(d: Design, ref: ItemRef): Point[] | null {
  switch (ref.kind) {
    case 'wall': {
      const w = find(d.walls, ref.id);
      return w ? wallOutlinePoints(w) : null;
    }
    case 'room':
      return find(d.rooms, ref.id)?.points ?? null;
    case 'zone':
      return find(d.zones, ref.id)?.points ?? null;
    case 'strip': {
      const s = find(d.strips, ref.id);
      if (!s) return null;
      const h = s.width / 2;
      return s.points.flatMap((p) => [
        { x: p.x - h, y: p.y - h },
        { x: p.x + h, y: p.y + h },
      ]);
    }
    case 'furniture': {
      const f = find(d.furniture, ref.id);
      return f ? rectCorners(f.x, f.y, f.w, f.d, f.rotation) : null;
    }
    case 'stair': {
      const s = find(d.stairs, ref.id);
      return s ? rectCorners(s.x, s.y, s.w, s.d, s.rotation) : null;
    }
    case 'roof': {
      const r = find(d.roofs, ref.id);
      return r ? rectCorners(r.x, r.y, r.w + 2 * r.overhang, r.d + 2 * r.overhang, r.rotation) : null;
    }
    case 'label': {
      const l = find(d.labels, ref.id);
      if (!l) return null;
      const b = textBox(l);
      return rectCorners(l.x, l.y, b.w, b.h, l.rotation);
    }
    case 'dimension': {
      const m = find(d.dimensions, ref.id);
      return m ? [m.a, m.b] : null;
    }
    case 'note': {
      const n = find(d.notes, ref.id);
      return n ? rectCorners(n.x, n.y, 0.5, 0.5, 0) : null;
    }
    default:
      return null;
  }
}

export function pointsBounds(pts: Point[]): Bounds | null {
  if (!pts.length) return null;
  return {
    minX: Math.min(...pts.map((p) => p.x)),
    minY: Math.min(...pts.map((p) => p.y)),
    maxX: Math.max(...pts.map((p) => p.x)),
    maxY: Math.max(...pts.map((p) => p.y)),
  };
}

export const itemBounds = (d: Design, ref: ItemRef): Bounds | null => {
  const pts = itemPoints(d, ref);
  return pts && pointsBounds(pts);
};

export function unionBounds(list: Bounds[]): Bounds | null {
  if (!list.length) return null;
  return {
    minX: Math.min(...list.map((b) => b.minX)),
    minY: Math.min(...list.map((b) => b.minY)),
    maxX: Math.max(...list.map((b) => b.maxX)),
    maxY: Math.max(...list.map((b) => b.maxY)),
  };
}

/** Everything you can select with the box or Ctrl+A on one floor: visible, unlocked layers only. */
export function selectableRefs(d: Design, floor: string): ItemRef[] {
  const refs: ItemRef[] = [];
  const add = <T extends { id: string; floor: string }>(kind: ItemKind, list: T[]) => {
    for (const item of list) {
      if (item.floor !== floor) continue;
      const ref = { kind, id: item.id };
      const layer = d.layers[layerOfRef(d, ref)];
      if (layer.visible && !layer.locked) refs.push(ref);
    }
  };
  add('wall', d.walls);
  add('room', d.rooms);
  add('zone', d.zones);
  add('strip', d.strips);
  add('furniture', d.furniture);
  add('stair', d.stairs);
  add('roof', d.roofs);
  add('label', d.labels);
  add('dimension', d.dimensions);
  add('note', d.notes);
  return refs;
}

export const boundsTouch = (a: Bounds, b: Bounds) => a.minX <= b.maxX && b.minX <= a.maxX && a.minY <= b.maxY && b.minY <= a.maxY;

export function refsInRect(d: Design, floor: string, rect: Bounds): ItemRef[] {
  return selectableRefs(d, floor).filter((ref) => {
    const b = itemBounds(d, ref);
    return b && boundsTouch(b, rect);
  });
}

// ---------------------------------------------------------------------------
// Moving & rotating
// ---------------------------------------------------------------------------

const shiftPoints = (pts: Point[], dx: number, dy: number): Point[] => pts.map((p) => ({ x: p.x + dx, y: p.y + dy }));

/**
 * Set an item to its position in `base` plus (dx, dy). Using the unmodified `base` (instead of adding
 * small steps) keeps long drags free of rounding drift. Openings move with their wall.
 */
export function moveFromBase(d: Mutable, base: Design, ref: ItemRef, dx: number, dy: number) {
  const set = <T extends { id: string }>(list: T[], baseList: T[], fn: (item: T, orig: T) => void) => {
    const item = find(list, ref.id);
    const orig = find(baseList, ref.id);
    if (item && orig) fn(item, orig);
  };
  switch (ref.kind) {
    case 'wall':
      return set(d.walls, base.walls, (w, o) => {
        w.a = { x: o.a.x + dx, y: o.a.y + dy };
        w.b = { x: o.b.x + dx, y: o.b.y + dy };
      });
    case 'room':
      return set(d.rooms, base.rooms, (r, o) => {
        r.points = shiftPoints(o.points, dx, dy);
        if (o.seed) r.seed = { x: o.seed.x + dx, y: o.seed.y + dy };
      });
    case 'zone':
      return set(d.zones, base.zones, (z, o) => void (z.points = shiftPoints(o.points, dx, dy)));
    case 'strip':
      return set(d.strips, base.strips, (s, o) => void (s.points = shiftPoints(o.points, dx, dy)));
    case 'furniture':
      return set(d.furniture, base.furniture, (f, o) => {
        f.x = o.x + dx;
        f.y = o.y + dy;
      });
    case 'stair':
      return set(d.stairs, base.stairs, (s, o) => {
        s.x = o.x + dx;
        s.y = o.y + dy;
      });
    case 'roof':
      return set(d.roofs, base.roofs, (s, o) => {
        s.x = o.x + dx;
        s.y = o.y + dy;
      });
    case 'label':
      return set(d.labels, base.labels, (l, o) => {
        l.x = o.x + dx;
        l.y = o.y + dy;
      });
    case 'dimension':
      return set(d.dimensions, base.dimensions, (m, o) => {
        m.a = { x: o.a.x + dx, y: o.a.y + dy };
        m.b = { x: o.b.x + dx, y: o.b.y + dy };
      });
    case 'note':
      return set(d.notes, base.notes, (n, o) => {
        n.x = o.x + dx;
        n.y = o.y + dy;
      });
  }
}

/** A reference point of an item, used to snap a group drag: where the item "is". */
export function anchorOf(d: Design, ref: ItemRef): Point | null {
  const b = itemBounds(d, ref);
  return b && { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
}

/** Rotate an item by `deg` about the point `c` (positions and own rotation). */
export function rotateAbout(d: Mutable, ref: ItemRef, deg: number, c: Point) {
  const norm = (r: number) => (((Math.round(r * 100) / 100) % 360) + 360) % 360;
  const rot = (p: Point) => rotatePoint(p, c, deg);
  switch (ref.kind) {
    case 'wall': {
      const w = find(d.walls, ref.id);
      if (w) {
        w.a = rot(w.a);
        w.b = rot(w.b);
      }
      return;
    }
    case 'room': {
      const r = find(d.rooms, ref.id);
      if (r) {
        r.points = r.points.map(rot);
        if (r.seed) r.seed = rot(r.seed);
      }
      return;
    }
    case 'zone': {
      const z = find(d.zones, ref.id);
      if (z) z.points = z.points.map(rot);
      return;
    }
    case 'strip': {
      const s = find(d.strips, ref.id);
      if (s) s.points = s.points.map(rot);
      return;
    }
    case 'dimension': {
      const m = find(d.dimensions, ref.id);
      if (m) {
        m.a = rot(m.a);
        m.b = rot(m.b);
      }
      return;
    }
    case 'furniture':
    case 'stair':
    case 'roof':
    case 'label': {
      const item = (ref.kind === 'furniture' ? find(d.furniture, ref.id) : ref.kind === 'stair' ? find(d.stairs, ref.id) : ref.kind === 'roof' ? find(d.roofs, ref.id) : find(d.labels, ref.id)) as
        | { x: number; y: number; rotation: number }
        | undefined;
      if (item) {
        const p = rot({ x: item.x, y: item.y });
        item.x = p.x;
        item.y = p.y;
        item.rotation = norm(item.rotation + deg);
      }
      return;
    }
    case 'note': {
      const n = find(d.notes, ref.id);
      if (n) {
        const p = rot({ x: n.x, y: n.y });
        n.x = p.x;
        n.y = p.y;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Align & distribute
// ---------------------------------------------------------------------------

export type AlignMode = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';

/** Move every item so its edge/center lines up with the selection's edge/center. */
export function alignRefs(d: Mutable, refs: ItemRef[], mode: AlignMode) {
  const boxes = refs.map((ref) => ({ ref, b: itemBounds(d as Design, ref) })).filter((x): x is { ref: ItemRef; b: Bounds } => !!x.b);
  const all = unionBounds(boxes.map((x) => x.b));
  if (!all || boxes.length < 2) return;
  const base = JSON.parse(JSON.stringify(d)) as Design; // positions before any move
  for (const { ref, b } of boxes) {
    let dx = 0;
    let dy = 0;
    if (mode === 'left') dx = all.minX - b.minX;
    if (mode === 'right') dx = all.maxX - b.maxX;
    if (mode === 'center') dx = (all.minX + all.maxX) / 2 - (b.minX + b.maxX) / 2;
    if (mode === 'top') dy = all.minY - b.minY;
    if (mode === 'bottom') dy = all.maxY - b.maxY;
    if (mode === 'middle') dy = (all.minY + all.maxY) / 2 - (b.minY + b.maxY) / 2;
    if (dx || dy) moveFromBase(d, base, ref, dx, dy);
  }
}

/** Spread items so the gaps between them are equal, keeping the outermost two in place. */
export function distributeRefs(d: Mutable, refs: ItemRef[], axis: 'x' | 'y') {
  const boxes = refs.map((ref) => ({ ref, b: itemBounds(d as Design, ref) })).filter((x): x is { ref: ItemRef; b: Bounds } => !!x.b);
  if (boxes.length < 3) return;
  const lo = axis === 'x' ? (b: Bounds) => b.minX : (b: Bounds) => b.minY;
  const hi = axis === 'x' ? (b: Bounds) => b.maxX : (b: Bounds) => b.maxY;
  boxes.sort((p, q) => lo(p.b) - lo(q.b));
  const first = boxes[0];
  const last = boxes[boxes.length - 1];
  const total = hi(last.b) - lo(first.b);
  const sizes = boxes.reduce((s, x) => s + (hi(x.b) - lo(x.b)), 0);
  const gap = (total - sizes) / (boxes.length - 1);
  const base = JSON.parse(JSON.stringify(d)) as Design;
  let cursor = lo(first.b);
  for (const { ref, b } of boxes) {
    const delta = cursor - lo(b);
    if (Math.abs(delta) > 1e-9) moveFromBase(d, base, ref, axis === 'x' ? delta : 0, axis === 'y' ? delta : 0);
    cursor += hi(b) - lo(b) + gap;
  }
}

// ---------------------------------------------------------------------------
// Copy & paste
// ---------------------------------------------------------------------------

/** A self-contained copy of some items (JSON-safe, so it can also live in localStorage). */
export interface Clipboard {
  v: 1;
  walls: Design['walls'];
  openings: Design['openings'];
  rooms: Design['rooms'];
  furniture: Design['furniture'];
  stairs: Design['stairs'];
  /** Absent in clipboards made before roofs existed. */
  roofs?: Design['roofs'];
  labels: Design['labels'];
  dimensions: Design['dimensions'];
  zones: Design['zones'];
  strips: Design['strips'];
  notes: Design['notes'];
  /** Custom furniture definitions the copied items use, so they still draw when pasted elsewhere. */
  custom: Design['custom'];
}

export const clipboardSize = (c: Clipboard) =>
  c.walls.length + c.rooms.length + c.furniture.length + c.stairs.length + (c.roofs?.length ?? 0) + c.labels.length + c.dimensions.length + c.zones.length + c.strips.length + c.notes.length;

export function copyRefs(d: Design, refs: ItemRef[]): Clipboard {
  const ids = (kind: ItemKind) => new Set(refs.filter((r) => r.kind === kind).map((r) => r.id));
  const pick = <T extends { id: string }>(list: T[], kind: ItemKind): T[] => {
    const set = ids(kind);
    return JSON.parse(JSON.stringify(list.filter((x) => set.has(x.id))));
  };
  const walls = pick(d.walls, 'wall');
  const wallIds = new Set(walls.map((w) => w.id));
  const furniture = pick(d.furniture, 'furniture');
  const customIds = new Set(furniture.filter((f) => f.type.startsWith('custom:')).map((f) => f.type.slice(7)));
  return {
    v: 1,
    walls,
    openings: JSON.parse(JSON.stringify(d.openings.filter((o) => wallIds.has(o.wallId)))),
    rooms: pick(d.rooms, 'room'),
    furniture,
    stairs: pick(d.stairs, 'stair'),
    roofs: pick(d.roofs, 'roof'),
    labels: pick(d.labels, 'label'),
    dimensions: pick(d.dimensions, 'dimension'),
    zones: pick(d.zones, 'zone'),
    strips: pick(d.strips, 'strip'),
    notes: pick(d.notes, 'note'),
    custom: JSON.parse(JSON.stringify(d.custom.filter((c) => customIds.has(c.id)))),
  };
}

/** Bounding box of everything in a clipboard (to paste it centered where the cursor is). */
export function clipboardBounds(c: Clipboard): Bounds | null {
  const tmp = { ...emptyShell(), ...c } as unknown as Design;
  const refs: ItemRef[] = [
    ...c.walls.map((x) => ({ kind: 'wall' as const, id: x.id })),
    ...c.rooms.map((x) => ({ kind: 'room' as const, id: x.id })),
    ...c.furniture.map((x) => ({ kind: 'furniture' as const, id: x.id })),
    ...c.stairs.map((x) => ({ kind: 'stair' as const, id: x.id })),
    ...(c.roofs ?? []).map((x) => ({ kind: 'roof' as const, id: x.id })),
    ...c.labels.map((x) => ({ kind: 'label' as const, id: x.id })),
    ...c.dimensions.map((x) => ({ kind: 'dimension' as const, id: x.id })),
    ...c.zones.map((x) => ({ kind: 'zone' as const, id: x.id })),
    ...c.strips.map((x) => ({ kind: 'strip' as const, id: x.id })),
    ...c.notes.map((x) => ({ kind: 'note' as const, id: x.id })),
  ];
  return unionBounds(refs.map((r) => itemBounds(tmp, r)).filter((b): b is Bounds => !!b));
}

function emptyShell() {
  return { walls: [], openings: [], rooms: [], furniture: [], stairs: [], roofs: [], labels: [], dimensions: [], zones: [], strips: [], notes: [], custom: [], guides: [], layers: {} };
}

/**
 * Add copies of a clipboard's items to the design on `floor`, shifted by (dx, dy), with fresh ids.
 * Returns what was added, so it can be selected.
 */
export function pasteClipboard(d: Draft<Design>, clip: Clipboard, dx: number, dy: number, floor: string): ItemRef[] {
  const added: ItemRef[] = [];
  const mv = (p: Point): Point => ({ x: p.x + dx, y: p.y + dy });
  const wallMap = new Map<string, string>();
  for (const w of clip.walls) {
    const id = newId();
    wallMap.set(w.id, id);
    d.walls.push({ ...w, id, floor, a: mv(w.a), b: mv(w.b) });
    added.push({ kind: 'wall', id });
  }
  for (const o of clip.openings) {
    const wallId = wallMap.get(o.wallId);
    if (wallId) d.openings.push({ ...o, id: newId(), wallId });
  }
  for (const r of clip.rooms) {
    const id = newId();
    d.rooms.push({ ...r, id, floor, points: r.points.map(mv), seed: r.seed && mv(r.seed) });
    added.push({ kind: 'room', id });
  }
  for (const z of clip.zones) {
    const id = newId();
    d.zones.push({ ...z, id, floor, points: z.points.map(mv) });
    added.push({ kind: 'zone', id });
  }
  for (const s of clip.strips) {
    const id = newId();
    d.strips.push({ ...s, id, floor, points: s.points.map(mv) });
    added.push({ kind: 'strip', id });
  }
  for (const c of clip.custom) if (!d.custom.some((x) => x.id === c.id)) d.custom.push(c);
  for (const f of clip.furniture) {
    const id = newId();
    d.furniture.push({ ...f, id, floor, x: f.x + dx, y: f.y + dy });
    added.push({ kind: 'furniture', id });
  }
  for (const s of clip.stairs) {
    const id = newId();
    d.stairs.push({ ...s, id, floor, x: s.x + dx, y: s.y + dy });
    added.push({ kind: 'stair', id });
  }
  for (const r of clip.roofs ?? []) {
    const id = newId();
    d.roofs.push({ ...r, id, floor, x: r.x + dx, y: r.y + dy });
    added.push({ kind: 'roof', id });
  }
  for (const l of clip.labels) {
    const id = newId();
    d.labels.push({ ...l, id, floor, x: l.x + dx, y: l.y + dy });
    added.push({ kind: 'label', id });
  }
  for (const m of clip.dimensions) {
    const id = newId();
    d.dimensions.push({ ...m, id, floor, a: mv(m.a), b: mv(m.b) });
    added.push({ kind: 'dimension', id });
  }
  for (const n of clip.notes) {
    const id = newId();
    d.notes.push({ ...n, id, floor, x: n.x + dx, y: n.y + dy });
    added.push({ kind: 'note', id });
  }
  return added;
}

/** Remove items (and what hangs on them). */
export function removeRefs(d: Draft<Design>, refs: ItemRef[]) {
  const ids = (kind: ItemKind) => new Set(refs.filter((r) => r.kind === kind).map((r) => r.id));
  const walls = ids('wall');
  const openings = ids('opening');
  d.openings = d.openings.filter((o) => !openings.has(o.id) && !walls.has(o.wallId));
  d.walls = d.walls.filter((x) => !walls.has(x.id));
  const rm = <T extends { id: string }>(list: T[], kind: ItemKind): T[] => {
    const set = ids(kind);
    return list.filter((x) => !set.has(x.id));
  };
  d.rooms = rm(d.rooms, 'room');
  d.zones = rm(d.zones, 'zone');
  d.strips = rm(d.strips, 'strip');
  d.furniture = rm(d.furniture, 'furniture');
  d.stairs = rm(d.stairs, 'stair');
  d.roofs = rm(d.roofs, 'roof');
  d.labels = rm(d.labels, 'label');
  d.dimensions = rm(d.dimensions, 'dimension');
  d.notes = rm(d.notes, 'note');
  d.guides = rm(d.guides, 'guide');
}
