/**
 * Named snapshots of a design, kept in this browser (not in the link), and a comparison between two versions of a design.
 * A snapshot is the whole design compressed, so a few dozen of them fit.
 */
import LZString from 'lz-string';
import type { Bounds } from './geometry';
import { parseDesign, type Design, type ItemKind, type ItemRef } from './model';
import { itemBounds } from './selection';

export interface Snapshot {
  id: string;
  name: string;
  /** Unix ms. */
  time: number;
  data: string;
}

const key = (designId: string) => `perfect-home:snapshots:${designId}`;

export function loadSnapshots(designId: string): Snapshot[] {
  try {
    const list = JSON.parse(localStorage.getItem(key(designId)) ?? '[]') as Snapshot[];
    return Array.isArray(list) ? list.filter((s) => s && typeof s.data === 'string') : [];
  } catch {
    return [];
  }
}

function store(designId: string, list: Snapshot[]): boolean {
  try {
    localStorage.setItem(key(designId), JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

/** Keep the design as it is now. Returns false when the browser has no room left. */
export function saveSnapshot(design: Design, name: string, now = Date.now()): boolean {
  const snap: Snapshot = { id: Math.random().toString(36).slice(2, 9), name: name.trim() || 'Snapshot', time: now, data: LZString.compressToUTF16(JSON.stringify(design)) };
  return store(design.id, [snap, ...loadSnapshots(design.id)].slice(0, 40));
}

export function deleteSnapshot(designId: string, id: string) {
  store(designId, loadSnapshots(designId).filter((s) => s.id !== id));
}

export function snapshotDesign(s: Snapshot): Design | null {
  try {
    return parseDesign(JSON.parse(LZString.decompressFromUTF16(s.data) ?? 'null'));
  } catch {
    return null;
  }
}

// ---- comparing ------------------------------------------------------------------------------------------------------------------------

export interface DiffEntry {
  ref: ItemRef;
  /** Where it is, in the design it comes from (the old one for what was removed). */
  box: Bounds | null;
  floor: string;
}
export interface DesignDiff {
  added: DiffEntry[];
  removed: DiffEntry[];
  changed: DiffEntry[];
}

const LISTS: [ItemKind, keyof Design][] = [
  ['wall', 'walls'],
  ['opening', 'openings'],
  ['room', 'rooms'],
  ['furniture', 'furniture'],
  ['label', 'labels'],
  ['dimension', 'dimensions'],
  ['zone', 'zones'],
  ['strip', 'strips'],
  ['stair', 'stairs'],
  ['roof', 'roofs'],
  ['skylight', 'skylights'],
  ['note', 'notes'],
];

/** What differs between an older design and a newer one: items added, removed and changed (by their identity). */
export function diffDesigns(older: Design, newer: Design): DesignDiff {
  const out: DesignDiff = { added: [], removed: [], changed: [] };
  const floorOf = (d: Design, item: { floor?: string; wallId?: string }) => item.floor ?? d.walls.find((w) => w.id === item.wallId)?.floor ?? d.floors[0].id;
  for (const [kind, name] of LISTS) {
    const a = older[name] as unknown as { id: string; floor?: string; wallId?: string }[];
    const b = newer[name] as unknown as { id: string; floor?: string; wallId?: string }[];
    const old = new Map(a.map((x) => [x.id, x]));
    const now = new Map(b.map((x) => [x.id, x]));
    const entry = (d: Design, x: { id: string; floor?: string; wallId?: string }): DiffEntry => ({ ref: { kind, id: x.id }, box: itemBounds(d, { kind, id: x.id }) ?? wallBox(d, x), floor: floorOf(d, x) });
    for (const x of b) {
      const before = old.get(x.id);
      if (!before) out.added.push(entry(newer, x));
      else if (JSON.stringify(before) !== JSON.stringify(x)) out.changed.push(entry(newer, x));
    }
    for (const x of a) if (!now.has(x.id)) out.removed.push(entry(older, x));
  }
  return out;
}

/** An opening has no place of its own: use its wall's. */
function wallBox(d: Design, x: { wallId?: string }): Bounds | null {
  return x.wallId ? itemBounds(d, { kind: 'wall', id: x.wallId }) : null;
}

export const diffCount = (diff: DesignDiff) => diff.added.length + diff.removed.length + diff.changed.length;
