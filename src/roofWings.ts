/**
 * Roofs for a house that is not a single box: an L, a T or a U built of rectangles gets one roof for each wing. The outline of the floor
 * (its rooms joined together) is cut into rectangles; every rectangle becomes a roof with its ridge along the longer side, and a wing
 * whose ridge runs into the side of another wing is made longer by half the width of that wing, so that its ridge ends in the other roof
 * and the two meet in a valley.
 */
import type { Point } from './model';
import { pointInPolygon } from './geometry';

export interface Wing {
  /** The rectangle in plan, with its middle, size and the turn of the ridge (0 = along x, 90 = along y). */
  x: number;
  y: number;
  w: number;
  d: number;
  rotation: number;
}

interface Rect {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

const near = (a: number, b: number) => Math.abs(a - b) < 0.02;

/** True when every side of the polygon runs along x or along y. */
export const isRectilinear = (pts: Point[]): boolean => pts.length >= 4 && pts.every((p, i) => near(p.x, pts[(i + 1) % pts.length].x) || near(p.y, pts[(i + 1) % pts.length].y));

/** A rectilinear polygon as non-overlapping rectangles (as few as the two simple ways of cutting give). */
export function decompose(poly: Point[]): Rect[] {
  const uniq = (vals: number[]) => [...vals].sort((a, b) => a - b).filter((v, i, arr) => !i || v - arr[i - 1] > 0.02);
  const xs = uniq(poly.map((p) => p.x));
  const ys = uniq(poly.map((p) => p.y));
  const filled = (i: number, j: number) => pointInPolygon({ x: (xs[i] + xs[i + 1]) / 2, y: (ys[j] + ys[j + 1]) / 2 }, poly);
  const grid = (xs.length - 1) * (ys.length - 1) > 0 ? Array.from({ length: xs.length - 1 }, (_, i) => Array.from({ length: ys.length - 1 }, (_, j) => filled(i, j))) : [];
  // rows first: runs of cells along x, then runs of equal rows stacked; or columns first
  const cut = (rowsFirst: boolean): Rect[] => {
    const nx = xs.length - 1;
    const ny = ys.length - 1;
    const used = grid.map((c) => c.map(() => false));
    const out: Rect[] = [];
    for (let a = 0; a < (rowsFirst ? ny : nx); a++) {
      for (let b = 0; b < (rowsFirst ? nx : ny); b++) {
        const [i, j] = rowsFirst ? [b, a] : [a, b];
        if (!grid[i][j] || used[i][j]) continue;
        // grow along the first direction, then along the second while the whole run is free
        let len = 1;
        while ((rowsFirst ? i + len < nx : j + len < ny) && grid[rowsFirst ? i + len : i][rowsFirst ? j : j + len] && !used[rowsFirst ? i + len : i][rowsFirst ? j : j + len]) len++;
        let rows = 1;
        const ok = (k: number) => Array.from({ length: len }, (_, q) => (rowsFirst ? [i + q, j + k] : [i + k, j + q])).every(([ii, jj]) => ii < nx && jj < ny && grid[ii][jj] && !used[ii][jj]);
        while (ok(rows)) rows++;
        for (let k = 0; k < rows; k++) for (let q = 0; q < len; q++) used[rowsFirst ? i + q : i + k][rowsFirst ? j + k : j + q] = true;
        out.push(rowsFirst ? { x0: xs[i], x1: xs[i + len], y0: ys[j], y1: ys[j + rows] } : { x0: xs[i], x1: xs[i + rows], y0: ys[j], y1: ys[j + len] });
      }
    }
    return out;
  };
  const a = cut(true);
  const b = cut(false);
  return b.length < a.length ? b : a;
}

/** One roof per rectangle of the outline, the ridge along the longer side, with wings that end in another wing made to reach its ridge. */
export function wingsOf(poly: Point[]): Wing[] {
  const rects = decompose(poly).filter((r) => r.x1 - r.x0 > 0.5 && r.y1 - r.y0 > 0.5);
  const wings = rects.map((r) => {
    const w = r.x1 - r.x0;
    const d = r.y1 - r.y0;
    const square = near(w, d);
    let along = w >= d; // the ridge runs along x
    if (square) {
      // a square has no longer side: let its ridge run across the ridge of an oblong wing it touches, so the two meet in a valley
      const touching = rects.find((o) => o !== r && !near(o.x1 - o.x0, o.y1 - o.y0) && o.x0 < r.x1 + 0.02 && o.x1 > r.x0 - 0.02 && o.y0 < r.y1 + 0.02 && o.y1 > r.y0 - 0.02);
      if (touching) along = touching.x1 - touching.x0 < touching.y1 - touching.y0;
    }
    return { rect: r, along, len: along ? w : d, width: along ? d : w, cx: (r.x0 + r.x1) / 2, cy: (r.y0 + r.y1) / 2 };
  });
  return wings.map((me) => {
    let grow0 = 0; // how far the ridge is made longer at its start and at its end
    let grow1 = 0;
    for (const other of wings) {
      if (other === me || other.along === me.along) continue; // ridges that run the same way only meet side by side
      const r = me.rect;
      const o = other.rect;
      // my ridge runs into the other wing when the other wing touches one end of mine and overlaps it sideways
      const touchStart = me.along ? near(r.x0, o.x1) && o.y0 < r.y1 - 0.02 && o.y1 > r.y0 + 0.02 : near(r.y0, o.y1) && o.x0 < r.x1 - 0.02 && o.x1 > r.x0 + 0.02;
      const touchEnd = me.along ? near(r.x1, o.x0) && o.y0 < r.y1 - 0.02 && o.y1 > r.y0 + 0.02 : near(r.y1, o.y0) && o.x0 < r.x1 - 0.02 && o.x1 > r.x0 + 0.02;
      if (touchStart) grow0 = Math.max(grow0, other.width / 2);
      if (touchEnd) grow1 = Math.max(grow1, other.width / 2);
    }
    const len = me.len + grow0 + grow1;
    const shift = (grow1 - grow0) / 2;
    return me.along ? { x: me.cx + shift, y: me.cy, w: len, d: me.width, rotation: 0 } : { x: me.cx, y: me.cy + shift, w: len, d: me.width, rotation: 90 };
  });
}
