/**
 * Where the sun is. Standard approximations (declination and hour angle), good to about a degree, which is
 * plenty for drawing shadows. Pure, so it is easy to test.
 *
 * Conventions: azimuth is in degrees clockwise from true north (north 0, east 90, south 180, west 270);
 * elevation is degrees above the horizon (negative at night); `hour` is solar time (12 = the sun is due south
 * in the northern hemisphere), 0..24.
 */

const DEG = Math.PI / 180;
const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function dayOfYear(month: number, day: number): number {
  const m = Math.min(12, Math.max(1, Math.round(month)));
  let n = 0;
  for (let i = 0; i < m - 1; i++) n += MONTH_DAYS[i];
  return n + Math.min(MONTH_DAYS[m - 1], Math.max(1, Math.round(day)));
}

/** Declination of the sun in degrees (about +23.4° at the June solstice, -23.4° in December). */
export function declination(month: number, day: number): number {
  return 23.44 * Math.sin(((2 * Math.PI) / 365) * (284 + dayOfYear(month, day)));
}

export interface SunPosition {
  azimuth: number;
  elevation: number;
}

export function sunPosition(lat: number, month: number, day: number, hour: number): SunPosition {
  const phi = lat * DEG;
  const delta = declination(month, day) * DEG;
  const H = (hour - 12) * 15 * DEG;
  const sinEl = Math.sin(phi) * Math.sin(delta) + Math.cos(phi) * Math.cos(delta) * Math.cos(H);
  const elevation = Math.asin(Math.max(-1, Math.min(1, sinEl)));
  // measured from north, clockwise
  let az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(delta) * Math.cos(phi)) + Math.PI;
  az = ((az % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  return { azimuth: az / DEG, elevation: elevation / DEG };
}

/** Sunrise and sunset in solar hours, or a flag for the polar day / night. */
export function sunTimes(lat: number, month: number, day: number): { sunrise: number; sunset: number } | 'polar-day' | 'polar-night' {
  const x = -Math.tan(lat * DEG) * Math.tan(declination(month, day) * DEG);
  if (x <= -1) return 'polar-day';
  if (x >= 1) return 'polar-night';
  const H0 = Math.acos(x) / DEG / 15; // hours between noon and sunset
  return { sunrise: 12 - H0, sunset: 12 + H0 };
}

/**
 * How dark it is, 0 (full daylight) to 1 (night): fades through twilight between 6° above the horizon and
 * 12° below it.
 */
export function darkness(elevation: number): number {
  const t = Math.min(1, Math.max(0, (6 - elevation) / 18));
  return t * t * (3 - 2 * t); // smoothstep
}

/** Strength of the warm light near sunrise and sunset: 0 at 12° and above, 1 at the horizon, back to 0 below -4°. */
export function goldenHour(elevation: number): number {
  if (elevation >= 12 || elevation <= -4) return 0;
  return elevation >= 0 ? 1 - elevation / 12 : 1 + elevation / 4;
}

/** The shadow of something `height` meters tall: where its top lands relative to its base. Null when the sun is too low or down. */
export function shadowOffset(sun: SunPosition, northOnPlan: number, height: number, maxLength = 40): { dx: number; dy: number } | null {
  if (sun.elevation < 1.5 || height <= 0) return null;
  const length = Math.min(maxLength, height / Math.tan(sun.elevation * DEG));
  // the sun is in direction (north + azimuth) clockwise from "up" on screen; shadows fall the other way
  const bearing = (northOnPlan + sun.azimuth) * DEG;
  return { dx: -Math.sin(bearing) * length, dy: Math.cos(bearing) * length };
}

/** "14:30" from a number of hours. */
export function formatHour(h: number): string {
  const total = Math.round(((h % 24) + 24) % 24 * 60);
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

const POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
/** "SW" for an azimuth. */
export const compassPoint = (az: number) => POINTS[Math.round((((az % 360) + 360) % 360) / 45) % 8];
