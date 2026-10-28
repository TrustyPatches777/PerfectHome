/**
 * The sky and the seasons (pure): what the weather does to the light and the sky, which season the date means, how trees look in each season, and
 * what snow does to the ground and the roofs. The 3D view draws it; nothing here knows about three.js.
 */
import type { Season, Site, Weather } from './model';

export const WEATHER_LABEL: Record<Weather, string> = { clear: 'Clear', cloudy: 'Cloudy', rain: 'Rain', snow: 'Snow', fog: 'Fog' };
export const SEASON_LABEL: Record<Season, string> = { auto: 'From the date', spring: 'Spring', summer: 'Summer', autumn: 'Autumn', winter: 'Winter' };
export const HORIZON_LABEL: Record<string, string> = { none: 'None (open ground)', hills: 'Hills', mountains: 'Mountains', city: 'City skyline', forest: 'Forest edge', sea: 'Sea' };

/** The season that applies: the chosen one, or from the month (the other way round in the southern hemisphere). */
export function seasonOf(site: Pick<Site, 'month' | 'lat' | 'season'>): Exclude<Season, 'auto'> {
  if (site.season && site.season !== 'auto') return site.season;
  const m = site.lat >= 0 ? site.month : ((site.month + 5) % 12) + 1; // six months on in the south
  if (m === 12 || m <= 2) return 'winter';
  if (m <= 5) return 'spring';
  if (m <= 8) return 'summer';
  return 'autumn';
}

/** Snow lies on the ground and the roofs while it snows. */
export const isSnowy = (site: Pick<Site, 'weather'>): boolean => site.weather === 'snow';

/** What the weather does to the scene. Sky colors are for midday; the view darkens them for dusk and night. */
export interface Mood {
  /** Sky color by day. */
  sky: string;
  /** How much of the direct sun gets through (1 = clear), and how much the sky lights the scene (a multiplier). */
  sun: number;
  hemi: number;
  /** Direct sun casts shadows only when it is strong enough. */
  shadows: boolean;
  /** How much of the sky is covered in cloud (0..1), and the color of the clouds by day. */
  clouds: number;
  cloudColor: string;
  /** What falls. */
  precip: 'rain' | 'snow' | null;
  /** Fog: the distance (meters) at which the ground is lost in it, or null for the usual haze of distance. */
  fog: number | null;
}

export const MOODS: Record<Weather, Mood> = {
  clear: { sky: '#cfe3f3', sun: 1, hemi: 1, shadows: true, clouds: 0.14, cloudColor: '#ffffff', precip: null, fog: null },
  cloudy: { sky: '#b4c0cb', sun: 0.4, hemi: 1.35, shadows: false, clouds: 0.75, cloudColor: '#e4e8ec', precip: null, fog: null },
  rain: { sky: '#8c97a3', sun: 0.22, hemi: 1.25, shadows: false, clouds: 0.95, cloudColor: '#a9b1ba', precip: 'rain', fog: 600 },
  snow: { sky: '#d3d9df', sun: 0.35, hemi: 1.5, shadows: false, clouds: 0.9, cloudColor: '#eef1f4', precip: 'snow', fog: 700 },
  fog: { sky: '#cbd2d8', sun: 0.3, hemi: 1.4, shadows: false, clouds: 0.3, cloudColor: '#dde2e6', precip: null, fog: 70 },
};

export const moodOf = (weather?: Weather): Mood => MOODS[weather ?? 'clear'];

// ---- colors ---------------------------------------------------------------------------------------------------------------------

const parse = (hex: string): [number, number, number] => {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** A color between `a` and `b` (t = 0 is a, 1 is b). */
export function mixHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = parse(a);
  const [br, bg, bb] = parse(b);
  const m = (x: number, y: number) => Math.round(x + (y - x) * t).toString(16).padStart(2, '0');
  return `#${m(ar, br)}${m(ag, bg)}${m(ab, bb)}`;
}

/** The ground of the plot outside the areas that were drawn. */
export function groundColor(season: Exclude<Season, 'auto'>, snowy: boolean): string {
  if (snowy) return '#f2f5f8';
  return { spring: '#cde6b0', summer: '#d4e2c6', autumn: '#d9cfa4', winter: '#cfd6c9' }[season];
}

/** The color of an area under snow (a lawn, a flower bed, paving, bare earth). */
export const snowColor = (color: string): string => mixHex(color, '#f4f7fa', 0.8);

// ---- trees and the season -----------------------------------------------------------------------------------------------------------

/** Trees that lose their leaves (the others, pines and palms, stay green all year). */
export const DECIDUOUS: ReadonlySet<string> = new Set(['tree', 'tree-small', 'tree-large', 'bush', 'tree-oak', 'tree-birch', 'tree-apple']);

/** Is this color the green of leaves (the trunks are brown, fruit red or yellow)? */
export function isFoliage(hex: string): boolean {
  const [r, g, b] = parse(hex);
  return g > r + 8 && g > b + 8;
}

const AUTUMN = ['#c2692b', '#d99a2b', '#a8452a', '#c9a227', '#b5562a'];

/**
 * The color of a leaf-colored part in a season: summer as drawn, spring fresher and lighter, autumn red, orange and yellow (a different one for each part,
 * by its number), and null in winter (the leaves are gone).
 */
export function leafColor(season: Exclude<Season, 'auto'>, color: string, index: number): string | null {
  switch (season) {
    case 'winter':
      return null;
    case 'autumn':
      return AUTUMN[index % AUTUMN.length];
    case 'spring':
      return mixHex(color, '#a6dd74', 0.55);
    default:
      return color;
  }
}
