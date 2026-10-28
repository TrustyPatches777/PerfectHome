/**
 * One picture with a dollhouse shot of every floor, side by side, each with its name: for showing the whole house at a glance.
 * The scene is switched from floor to floor, photographed, and put back as it was.
 */
import { contentBounds } from '../bounds';
import type { Design } from '../model';
import type { BuildOptions } from './build';
import { floorElevations } from './build';
import type { Scene3D } from './scene';

type Options = BuildOptions & { floorElevation?: number };

/** The middle and the size of the ball that holds a floor (what the dollhouse camera looks at). */
export function floorBall(d: Design, floor: string): { c: [number, number, number]; radius: number } | null {
  const b = contentBounds(d, floor);
  if (!b) return null;
  const y = floorElevations(d).get(floor) ?? 0;
  return { c: [(b.minX + b.maxX) / 2, y + 0.6, (b.minY + b.maxY) / 2], radius: Math.max(3, Math.hypot(b.maxX - b.minX, b.maxY - b.minY) / 2) };
}

export interface Tile {
  name: string;
  image: ImageBitmap;
}

const TILE_W = 900;
const GAP = 24;
const HEAD = 70;
const CAPTION = 44;

/** Lay the shots out in a grid (one column for a single floor, else two) under the name of the design. */
export async function composeSheet(title: string, tiles: Tile[]): Promise<Blob | null> {
  if (!tiles.length) return null;
  const cols = tiles.length === 1 ? 1 : 2;
  const rows = Math.ceil(tiles.length / cols);
  const th = Math.round((TILE_W * tiles[0].image.height) / tiles[0].image.width);
  const canvas = document.createElement('canvas');
  canvas.width = GAP + cols * (TILE_W + GAP);
  canvas.height = HEAD + rows * (th + CAPTION + GAP);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#1f2937';
  ctx.font = '600 34px system-ui, "Segoe UI", Arial, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, GAP, HEAD / 2 + 4);
  tiles.forEach((t, i) => {
    const x = GAP + (i % cols) * (TILE_W + GAP);
    const y = HEAD + Math.floor(i / cols) * (th + CAPTION + GAP);
    ctx.drawImage(t.image, x, y + CAPTION, TILE_W, th);
    ctx.strokeStyle = '#d6dbe3';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y + CAPTION, TILE_W, th);
    ctx.fillStyle = '#1f2937';
    ctx.font = '600 26px system-ui, "Segoe UI", Arial, sans-serif';
    ctx.fillText(t.name, x, y + CAPTION / 2);
  });
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

/**
 * Photograph every floor that has something on it as a dollhouse, top floor first, then put the scene back (`restore`) and the camera where it was.
 * `optionsFor(floor)` gives the build options of that floor's dollhouse.
 */
export async function floorSheet(scene: Scene3D, d: Design, optionsFor: (floor: string) => Options, restore: () => void): Promise<Blob | null> {
  const view = scene.getView();
  const tiles: Tile[] = [];
  try {
    for (const f of [...d.floors].reverse()) {
      const ball = floorBall(d, f.id);
      if (!ball) continue;
      scene.setDesign(d, optionsFor(f.id));
      scene.frameBall(ball.c, ball.radius);
      const blob = await scene.toBlob();
      if (blob) tiles.push({ name: f.name, image: await createImageBitmap(blob) });
    }
  } finally {
    restore();
    scene.setView(view.pos, view.target);
  }
  return composeSheet(d.name, tiles);
}
