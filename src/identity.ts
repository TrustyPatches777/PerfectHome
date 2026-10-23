/** Who is using this browser: a name and a color, used to sign sticky notes. Stored only on this device. */

export interface Identity {
  name: string;
  color: string;
}

const KEY = 'perfect-home:me';

/** Note colors to choose from (one per person). */
export const IDENTITY_COLORS = ['#facc15', '#f472b6', '#60a5fa', '#4ade80', '#fb923c', '#a78bfa', '#2dd4bf', '#f87171'];

export function loadIdentity(): Identity | null {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Identity> | null;
    if (!raw || typeof raw.name !== 'string' || !raw.name.trim()) return null;
    return { name: raw.name.trim().slice(0, 40), color: typeof raw.color === 'string' && /^#[0-9a-f]{6}$/i.test(raw.color) ? raw.color : IDENTITY_COLORS[0] };
  } catch {
    return null;
  }
}

export function saveIdentity(me: Identity) {
  try {
    localStorage.setItem(KEY, JSON.stringify(me));
  } catch {
    /* storage unavailable: the identity just lasts for this visit */
  }
}

/** Black or white, whichever reads better on `hex`. */
export function readableOn(hex: string): string {
  const n = parseInt(hex.replace('#', '').slice(0, 6), 16);
  const lum = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return lum > 150 ? '#1f2937' : '#ffffff';
}
