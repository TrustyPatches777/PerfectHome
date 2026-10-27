/**
 * What a covering looks like, as one string. A wall face or a floor has a base color and, depending on what it is, a second color (the
 * grout between tiles, the pattern on wallpaper), a pattern layout (stripes, herringbone...) and a picture you uploaded. The string is what
 * the drawing code passes around and caches by: `#rrggbb` alone, or `base|second|pattern|picture`.
 *
 * Uploaded pictures are kept in this browser only (a link would get far too long), so on another device a covering made of a picture shows
 * as its plain base color.
 */
import type { WallFinish } from './model';

export interface PaintSpec {
  base: string;
  /** Grout between tiles, or the second color of a checkerboard or of a wallpaper pattern. */
  second?: string;
  /** Layout of tiles (`grid`, `subway`, `herringbone`, `diagonal`) or the pattern of wallpaper (`stripes`, `floral`, `dots`, `check`, `damask`). */
  pattern?: string;
  /** Id of an uploaded picture. */
  texture?: string;
}

export const encodeSpec = (s: PaintSpec): string => (s.second || s.pattern || s.texture ? [s.base, s.second ?? '', s.pattern ?? '', s.texture ?? ''].join('|') : s.base);

export function parseSpec(str: string): PaintSpec {
  const [base, second, pattern, texture] = str.split('|');
  return { base, ...(second ? { second } : {}), ...(pattern ? { pattern } : {}), ...(texture ? { texture } : {}) };
}

/** The spec of a painted wall face. */
export const skinSpec = (skin: { color: string; grout?: string; pattern?: string; texture?: string }): string => encodeSpec({ base: skin.color, second: skin.grout, pattern: skin.pattern, texture: skin.texture });

/** The spec of a floor. */
export const roomSpec = (room: { color: string; grout?: string; texture?: string }): string => encodeSpec({ base: room.color, second: room.grout, texture: room.texture });

/** The pattern layouts offered for the wall finishes that have some. */
export const WALL_PATTERNS: Partial<Record<WallFinish, { id: string; label: string }[]>> = {
  wallpaper: [
    { id: 'stripes', label: 'Stripes' },
    { id: 'floral', label: 'Flowers' },
    { id: 'dots', label: 'Dots' },
    { id: 'check', label: 'Check' },
    { id: 'damask', label: 'Damask' },
  ],
  tiles: [
    { id: 'grid', label: 'Square tiles' },
    { id: 'subway', label: 'Brick bond (subway)' },
    { id: 'herringbone', label: 'Herringbone' },
    { id: 'diagonal', label: 'Diagonal' },
  ],
};

/** Finishes that have a second color, and what to call it. */
export const SECOND_COLOR_LABEL: Partial<Record<string, string>> = { tiles: 'Grout', marble: 'Grout between slabs', wallpaper: 'Pattern color', brick: 'Mortar', stone: 'Joints' };

// ---- uploaded pictures --------------------------------------------------------------------------------------------------------------------

const key = (id: string) => `perfect-home:tex:${id}`;

export function saveTexture(id: string, dataUrl: string): boolean {
  try {
    localStorage.setItem(key(id), dataUrl);
    return true;
  } catch {
    return false;
  }
}

const images = new Map<string, HTMLImageElement | 'loading' | 'missing'>();
let notify: (() => void) | null = null;

/** Called when a picture has finished loading, so that whatever was drawn without it can be drawn again. */
export function onTextureLoaded(fn: () => void) {
  notify = fn;
}

/** The decoded picture, or null while it loads (the caller draws its plain color meanwhile) or when it is not on this device. */
export function textureImage(id: string): HTMLImageElement | null {
  if (typeof document === 'undefined') return null;
  const hit = images.get(id);
  if (hit && hit !== 'loading' && hit !== 'missing') return hit;
  if (hit) return null;
  let url: string | null = null;
  try {
    url = localStorage.getItem(key(id));
  } catch {
    /* no storage */
  }
  if (!url) {
    images.set(id, 'missing');
    return null;
  }
  images.set(id, 'loading');
  const img = new Image();
  img.onload = () => {
    images.set(id, img);
    notify?.();
  };
  img.onerror = () => images.set(id, 'missing');
  img.src = url;
  return null;
}

/** Forget what is known about a picture (after it was added or removed). */
export function forgetTexture(id: string) {
  images.delete(id);
}

export const hasTexture = (id: string): boolean => {
  try {
    return localStorage.getItem(key(id)) !== null;
  } catch {
    return false;
  }
};
