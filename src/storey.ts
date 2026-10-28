/**
 * The storey height of the house and what follows from it. One number (`settings.storeyHeight`) fixes where every floor lies; the floor between
 * two storeys has a thickness, and a full-height wall is as tall as the storey minus that. Changing the storey height moves everything that
 * was made to fit: the walls of full height and the stairs that climb a whole storey.
 */
import type { Draft } from 'immer';
import { WALL_TYPE_HEIGHT, type Design, type WallType } from './model';

const round2 = (v: number) => Math.round(v * 100) / 100;

/** The thickness of the floor between two storeys. */
export const slabFor = (storey: number): number => Math.min(0.4, Math.max(0.12, storey - 2.5));

/** The height of a wall that fills a whole storey (up to the underside of the floor above). */
export const fullWallHeight = (storey: number): number => round2(storey - slabFor(storey));

/** The usual height of a ceiling: where the full-height walls end. */
export const usualCeiling = fullWallHeight;

/** The height a new wall of this type gets: walls that fill a storey follow the storey height, the others (railings...) keep theirs. */
export const wallHeightFor = (type: WallType, storey: number): number => (WALL_TYPE_HEIGHT[type] === 2.5 ? fullWallHeight(storey) : WALL_TYPE_HEIGHT[type]);

export interface StoreyChange {
  walls: number;
  stairs: number;
}

const near = (a: number, b: number) => Math.abs(a - b) < 0.02;

/**
 * Set the storey height and bring along the walls that fill a storey (full height before, or the usual 2.5 m) and the stairs that climb one
 * storey. Everything else keeps its size. Returns how many were changed.
 */
export function applyStoreyHeight(d: Draft<Design> | Design, next: number): StoreyChange {
  const old = d.settings.storeyHeight;
  const oldWall = fullWallHeight(old);
  const newWall = fullWallHeight(next);
  const out: StoreyChange = { walls: 0, stairs: 0 };
  d.settings.storeyHeight = next;
  for (const w of d.walls) {
    if (w.type === 'railing' || !(near(w.height, oldWall) || near(w.height, 2.5)) || near(w.height, newWall)) continue;
    w.height = newWall;
    out.walls++;
  }
  for (const s of d.stairs) {
    if (!near(s.rise, old) || near(s.rise, next)) continue;
    s.rise = next;
    out.stairs++;
  }
  return out;
}
