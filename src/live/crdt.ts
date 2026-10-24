/**
 * The design as a Yjs document, for working together live. Pure: no network, no stores (tested with two documents).
 *
 * Layout of the document:
 *  - `meta` (Y.Map): every non-list value of the Design, objects flattened to dotted keys ("layers.walls.locked", "site.north").
 *  - one Y.Map per list ("c:walls", ...): item id -> Y.Map of that item's fields (+ `__o`, its place in the list).
 *
 * Edits are merged FIELD by FIELD: she can recolor a sofa while you move it and both changes survive; two people changing the
 * same field of the same item at the same moment end up with one of the two values (everybody sees the same one).
 * A list item deleted by one person and edited by the other stays deleted.
 *
 * The store keeps working on a plain immutable `Design`; this file only translates changes (`writeChange`) and rebuilds the
 * design from the document (`readDesign`). Whatever arrives goes through `parseDesign`, like links and files do.
 */
import * as Y from 'yjs';
import { createDesign, parseDesign, type Design } from '../model';

/** Origin of changes made on this computer (the undo manager tracks only these). */
export const LOCAL = 'local';
/** Origin of the first write that puts an existing design into a new room (not undoable). */
export const SEED = 'seed';

const ORDER = '__o';

type Json = unknown;
type Item = Record<string, Json> & { id: string };

/** Names of the Design fields that are lists of items with ids (walls, rooms, floors ...). */
export const COLLECTIONS: string[] = Object.entries(createDesign())
  .filter(([, v]) => Array.isArray(v))
  .map(([k]) => k);

export const metaMap = (doc: Y.Doc) => doc.getMap<Json>('meta');
export const listMap = (doc: Y.Doc, name: string) => doc.getMap<Y.Map<Json>>(`c:${name}`);

/** Every Yjs type that holds design data (what the undo manager watches). */
export const designTypes = (doc: Y.Doc): Y.Map<unknown>[] => [metaMap(doc), ...COLLECTIONS.map((c) => listMap(doc, c))] as Y.Map<unknown>[];

export function deepEqual(a: Json, b: Json): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a as object).filter((k) => (a as Record<string, Json>)[k] !== undefined);
  const kb = Object.keys(b as object).filter((k) => (b as Record<string, Json>)[k] !== undefined);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => deepEqual((a as Record<string, Json>)[k], (b as Record<string, Json>)[k]));
}

// ---- meta (everything that is not a list) -------------------------------------------------------

/** { name: "x", settings: { gridStep: 0.1 } } -> { name: "x", "settings.gridStep": 0.1 }. Arrays and primitives are leaves. */
export function flattenMeta(d: Design): Record<string, Json> {
  const out: Record<string, Json> = {};
  const walk = (value: Json, path: string) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const [k, v] of Object.entries(value)) walk(v, path ? `${path}.${k}` : k);
    } else if (value !== undefined) out[path] = value;
  };
  for (const [k, v] of Object.entries(d)) if (!COLLECTIONS.includes(k)) walk(v, k);
  return out;
}

function unflatten(flat: Record<string, Json>): Record<string, Json> {
  const out: Record<string, Json> = {};
  for (const [path, value] of Object.entries(flat)) {
    const keys = path.split('.');
    let at = out;
    for (const k of keys.slice(0, -1)) at = (at[k] ??= {}) as Record<string, Json>;
    at[keys[keys.length - 1]] = value;
  }
  return out;
}

// ---- writing --------------------------------------------------------------------------------------

/** Y.Map of one item. */
function writeFields(map: Y.Map<Json>, prev: Item | null, next: Item) {
  for (const [k, v] of Object.entries(next)) {
    if (v === undefined) continue;
    if (!prev || !deepEqual(prev[k], v)) map.set(k, v);
  }
  if (prev) for (const k of Object.keys(prev)) if (next[k] === undefined && prev[k] !== undefined) map.delete(k);
}

const orderOf = (m: Y.Map<Json> | undefined): number | null => {
  const o = m?.get(ORDER);
  return typeof o === 'number' ? o : null;
};

/**
 * Write the difference between two designs into the document (one Yjs transaction). `prev` null writes everything.
 * Unchanged items are skipped by reference first (immer keeps them identical), so a drag only touches one item.
 */
export function writeChange(doc: Y.Doc, prev: Design | null, next: Design, origin: unknown = LOCAL) {
  doc.transact(() => {
    // meta
    const meta = metaMap(doc);
    const a = prev ? flattenMeta(prev) : {};
    const b = flattenMeta(next);
    for (const [k, v] of Object.entries(b)) if (!(k in a) || !deepEqual(a[k], v)) meta.set(k, v);
    for (const k of Object.keys(a)) if (!(k in b)) meta.delete(k);

    // lists
    for (const name of COLLECTIONS) {
      const before = ((prev as unknown as Record<string, Item[]> | null)?.[name] ?? []) as Item[];
      const after = (next as unknown as Record<string, Item[]>)[name] as Item[];
      if (before === after) continue;
      const map = listMap(doc, name);
      const old = new Map(before.map((i) => [i.id, i]));
      const keep = new Set(after.map((i) => i.id));
      for (const id of old.keys()) if (!keep.has(id)) map.delete(id);

      after.forEach((item, i) => {
        const was = old.get(item.id);
        if (was === item) return;
        let m = map.get(item.id);
        if (!m) {
          m = new Y.Map<Json>();
          map.set(item.id, m);
          // a place between the neighbours that are already in the document
          let lo: number | null = null;
          for (let j = i - 1; j >= 0 && lo === null; j--) lo = orderOf(map.get(after[j].id));
          let hi: number | null = null;
          for (let j = i + 1; j < after.length && hi === null; j++) hi = orderOf(map.get(after[j].id));
          m.set(ORDER, lo !== null && hi !== null && hi > lo ? (lo + hi) / 2 : lo !== null ? lo + 1 : hi !== null ? hi - 1 : 0);
        }
        writeFields(m, was ?? null, item);
      });
    }
  }, origin);
}

// ---- reading --------------------------------------------------------------------------------------

/** True once the document holds a design (a new room is empty until the first person's data arrives). */
export const hasDesign = (doc: Y.Doc) => metaMap(doc).has('v');

/** The plain object the document describes, before validation. */
export function readRaw(doc: Y.Doc): Record<string, Json> {
  const raw = unflatten(Object.fromEntries(metaMap(doc).entries()));
  for (const name of COLLECTIONS) {
    const rows: { o: number; item: Item }[] = [];
    for (const m of listMap(doc, name).values()) {
      const json = m.toJSON() as Item;
      const o = typeof json[ORDER] === 'number' ? (json[ORDER] as number) : 0;
      delete json[ORDER];
      if (typeof json.id === 'string') rows.push({ o, item: json });
    }
    rows.sort((p, q) => p.o - q.o || (p.item.id < q.item.id ? -1 : 1));
    raw[name] = rows.map((r) => r.item);
  }
  return raw;
}

/**
 * The document as a validated Design, reusing the objects of `prev` wherever nothing changed (so React and Konva only redraw
 * what really changed). Null while the document is still empty or unreadable.
 */
export function readDesign(doc: Y.Doc, prev: Design | null): Design | null {
  if (!hasDesign(doc)) return null;
  let next: Design;
  try {
    next = parseDesign(readRaw(doc));
  } catch {
    return null;
  }
  return prev ? reuse(prev, next) : next;
}

/** `next` with every part that is deep-equal to the same part of `prev` replaced by prev's object. */
export function reuse(prev: Design, next: Design): Design {
  const out = { ...next } as unknown as Record<string, Json>;
  let same = true;
  for (const key of Object.keys(next) as (keyof Design)[]) {
    const p = prev[key] as Json;
    const n = next[key] as Json;
    if (Array.isArray(n) && Array.isArray(p)) {
      const byId = new Map((p as Item[]).map((i) => [i.id, i]));
      const items = (n as Item[]).map((item) => {
        const old = byId.get(item.id);
        return old && deepEqual(old, item) ? old : item;
      });
      const unchanged = items.length === p.length && items.every((it, i) => it === p[i]);
      out[key] = unchanged ? p : items;
      if (!unchanged) same = false;
    } else if (deepEqual(p, n)) out[key] = p;
    else same = false;
  }
  return same ? prev : (out as unknown as Design);
}
