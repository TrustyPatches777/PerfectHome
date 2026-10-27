/**
 * Sharing & persistence helpers (pure; no UI). A design travels as lz-string-compressed JSON in the URL hash:
 *   https://host/path/#d=<compressed design>
 */
import LZString from 'lz-string';
import { parseDesign, serializeDesign, type Design } from './model';

const HASH_PREFIX = '#d=';
export const AUTOSAVE_KEY = 'perfect-home:autosave';
export const BACKUP_KEY = 'perfect-home:backup';
/** Many chat apps and some servers cut off URLs beyond this. The link still works in browsers. */
export const LONG_LINK_WARNING = 8000;

export function encodeDesign(design: Design): string {
  return LZString.compressToEncodedURIComponent(serializeDesign(design));
}

/** Decode and validate. Throws an Error with a user-friendly message when the data is unusable. */
export function decodeDesign(encoded: string): Design {
  // Some apps turn "+" into a space when linkifying; lz-string also repairs this, but be explicit.
  const json = LZString.decompressFromEncodedURIComponent(encoded.trim().replace(/ /g, '+'));
  if (!json) throw new Error('This link is damaged or was cut off. Ask for it to be shared again.');
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('This link does not contain a design.');
  }
  return parseDesign(data);
}

export function shareUrl(design: Design, pageUrl: string): string {
  return `${pageUrl.split('#')[0]}${HASH_PREFIX}${encodeDesign(design)}`;
}

/** The design in a URL hash, `null` when the hash has none. Throws when it has one that is unusable. */
export function designFromHash(hash: string): Design | null {
  if (!hash.startsWith(HASH_PREFIX)) return null;
  return decodeDesign(hash.slice(HASH_PREFIX.length));
}

export function isEmptyDesign(d: Design): boolean {
  return !(d.walls.length || d.rooms.length || d.furniture.length || d.labels.length || d.dimensions.length || d.openings.length || d.zones.length || d.strips.length || d.stairs.length || d.roofs.length || d.notes.length);
}

export const sameContent = (a: Design, b: Design) => serializeDesign(a) === serializeDesign(b);

export function parseDesignJson(text: string): Design {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('That file is not valid JSON.');
  }
  return parseDesign(data);
}

// ---- localStorage ---------------------------------------------------------

export interface SavedDesign {
  design: Design;
  savedAt: number;
}

export function readSaved(key: string): SavedDesign | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { design, savedAt } = JSON.parse(raw) as { design: unknown; savedAt: number };
    return { design: parseDesign(design), savedAt: Number(savedAt) || 0 };
  } catch {
    return null;
  }
}

/** Returns false when storage is unavailable or full. */
export function writeSaved(key: string, design: Design): boolean {
  try {
    localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), design: JSON.parse(serializeDesign(design)) }));
    return true;
  } catch {
    return false;
  }
}

export const fileNameFor = (design: Design, ext: string) => {
  const slug = design.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'design';
  return `${slug}.${ext}`;
};
