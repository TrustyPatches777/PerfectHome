/**
 * A winter garden in one go: four glass walls round a rectangle, a tiled floor, a French door in the middle of a long side and a glass roof.
 * Everything is made of the ordinary pieces (walls of type "glass", a room, an opening, a roof of material "glass"), so each can be changed afterwards.
 */
import { newId, WALL_TYPE_THICKNESS, type Design, type Opening, type Point } from './model';
import { newRoof } from './roofActions';
import { addRoomTo, rectWalls } from './shapes';
import { detectRoom, wallLength } from './geometry';
import { useDesign } from './store/design';
import { useUi } from './store/ui';
import { wallHeightFor } from './storey';

export const WINTER_FLOOR = { material: 'tile' as const, color: '#d9d2c5' };

/** Add a winter garden between two opposite corners (on the given floor) and select its roof. */
export function addWinterGarden(a: Point, b: Point, floor: string): void {
  const thickness = WALL_TYPE_THICKNESS.glass;
  const roofId = newId();
  useDesign.getState().update((d: Design) => {
    const height = wallHeightFor('glass', d.settings.storeyHeight);
    const walls = rectWalls(a, b, floor, thickness, 'glass', height);
    d.walls.push(...walls);
    // the room inside
    const middle = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const poly = detectRoom(middle, d.walls.filter((w) => w.floor === floor));
    if (poly) {
      addRoomTo(d, floor, poly, { x: Math.round(middle.x * 1000) / 1000, y: Math.round(middle.y * 1000) / 1000 }, WINTER_FLOOR.color);
      const room = d.rooms[d.rooms.length - 1];
      room.name = 'Winter garden';
      room.material = WINTER_FLOOR.material;
      room.color = WINTER_FLOOR.color;
    }
    // a French door in the middle of the longest wall
    const longest = walls.reduce((best, w) => (wallLength(w) > wallLength(best) ? w : best), walls[0]);
    const door: Opening = { id: newId(), wallId: longest.id, kind: 'french', pos: wallLength(longest) / 2, width: Math.min(1.8, wallLength(longest) - 0.6), swing: 1, hinge: 'a' };
    d.openings.push(door);
    // the glass roof: ridge along the longer side, over the outside of the walls
    const w = Math.abs(a.x - b.x) + thickness;
    const dd = Math.abs(a.y - b.y) + thickness;
    const box = w >= dd ? { x: middle.x, y: middle.y, w, d: dd, rotation: 0 } : { x: middle.x, y: middle.y, w: dd, d: w, rotation: 90 };
    const roof = newRoof(floor, box, 'gable', 'glass');
    roof.id = roofId;
    d.roofs.push(roof);
  });
  useUi.getState().setTool('select');
  useUi.getState().select({ kind: 'roof', id: roofId });
}
