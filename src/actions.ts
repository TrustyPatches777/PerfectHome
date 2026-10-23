/** Commands that act on the current selection. Used by keyboard shortcuts and the properties panel. */
import type { Draft } from 'immer';
import { LAYER_OF, newId, type Design, type ItemKind, type ItemRef } from './model';
import { useDesign } from './store/design';
import { useUi } from './store/ui';

export const isLayerLocked = (kind: ItemKind) => useDesign.getState().design.layers[LAYER_OF[kind]].locked;

function removeItem(d: Draft<Design>, ref: ItemRef) {
  const drop = <T extends { id: string }>(arr: T[]) => {
    const i = arr.findIndex((x) => x.id === ref.id);
    if (i >= 0) arr.splice(i, 1);
  };
  switch (ref.kind) {
    case 'wall':
      drop(d.walls);
      d.openings = d.openings.filter((o) => o.wallId !== ref.id);
      break;
    case 'opening':
      drop(d.openings);
      break;
    case 'room':
      drop(d.rooms);
      break;
    case 'furniture':
      drop(d.furniture);
      break;
    case 'label':
      drop(d.labels);
      break;
    case 'dimension':
      drop(d.dimensions);
      break;
  }
}

export function deleteSelection() {
  const sel = useUi.getState().selection;
  if (!sel || isLayerLocked(sel.kind)) return;
  useDesign.getState().update((d) => removeItem(d, sel));
  useUi.getState().select(null);
}

/** Copy the selected item, offset a little, and select the copy. */
export function duplicateSelection() {
  const sel = useUi.getState().selection;
  if (!sel || isLayerLocked(sel.kind) || sel.kind === 'opening') return;
  const off = Math.max(useDesign.getState().design.settings.gridStep, 0.3);
  const id = newId();
  useDesign.getState().update((d) => {
    const shift = (p: { x: number; y: number }) => ({ x: p.x + off, y: p.y + off });
    switch (sel.kind) {
      case 'furniture': {
        const f = d.furniture.find((x) => x.id === sel.id);
        if (f) d.furniture.push({ ...f, id, x: f.x + off, y: f.y + off });
        break;
      }
      case 'label': {
        const l = d.labels.find((x) => x.id === sel.id);
        if (l) d.labels.push({ ...l, id, x: l.x + off, y: l.y + off });
        break;
      }
      case 'wall': {
        const w = d.walls.find((x) => x.id === sel.id);
        if (w) d.walls.push({ ...w, id, a: shift(w.a), b: shift(w.b) });
        break;
      }
      case 'room': {
        const r = d.rooms.find((x) => x.id === sel.id);
        if (r) d.rooms.push({ ...r, id, name: `${r.name} copy`, points: r.points.map(shift), seed: undefined });
        break;
      }
      case 'dimension': {
        const m = d.dimensions.find((x) => x.id === sel.id);
        if (m) d.dimensions.push({ id, a: shift(m.a), b: shift(m.b) });
        break;
      }
    }
  });
  useUi.getState().select({ kind: sel.kind, id });
}

/** Move the selected item by (dx, dy) meters. */
export function nudgeSelection(dx: number, dy: number) {
  const sel = useUi.getState().selection;
  if (!sel || isLayerLocked(sel.kind)) return;
  const mv = (p: { x: number; y: number }) => {
    p.x += dx;
    p.y += dy;
  };
  useDesign.getState().update((d) => {
    switch (sel.kind) {
      case 'furniture':
        d.furniture.filter((f) => f.id === sel.id).forEach(mv);
        break;
      case 'label':
        d.labels.filter((l) => l.id === sel.id).forEach(mv);
        break;
      case 'wall': {
        const w = d.walls.find((x) => x.id === sel.id);
        if (w) {
          mv(w.a);
          mv(w.b);
        }
        break;
      }
      case 'room':
        d.rooms.find((r) => r.id === sel.id)?.points.forEach(mv);
        break;
      case 'dimension': {
        const m = d.dimensions.find((x) => x.id === sel.id);
        if (m) {
          mv(m.a);
          mv(m.b);
        }
        break;
      }
    }
  });
}

/** Rotate the selected furniture/label by `deg` degrees. */
export function rotateSelection(deg: number) {
  const sel = useUi.getState().selection;
  if (!sel || isLayerLocked(sel.kind)) return;
  const norm = (r: number) => ((Math.round(r * 100) / 100) % 360 + 360) % 360;
  useDesign.getState().update((d) => {
    if (sel.kind === 'furniture') {
      const f = d.furniture.find((x) => x.id === sel.id);
      if (f) f.rotation = norm(f.rotation + deg);
    } else if (sel.kind === 'label') {
      const l = d.labels.find((x) => x.id === sel.id);
      if (l) l.rotation = norm(l.rotation + deg);
    }
  });
}
