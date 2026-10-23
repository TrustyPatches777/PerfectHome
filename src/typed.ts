/**
 * Parsing for exact values typed while drawing ("3.5", "350", "2,4m", "80cm", "3.5<45", "5x3").
 * Pure, so it is easy to test.
 */
import type { Point } from './model';

export interface TypedValue {
  /** Length in meters. */
  length: number;
  /** Direction in degrees (clockwise from "right" on screen) when `<angle` was typed. */
  angle: number | null;
}

/**
 * Plain numbers are meters when they have a decimal point or are small ("3.5", "4"), and centimeters when
 * they are whole numbers of 30 or more ("350", "80"). An explicit unit always wins: "40m", "40cm", "400mm".
 */
export function parseTypedLength(text: string): TypedValue | null {
  const m = /^\s*(\d*[.,]?\d*)\s*(mm|cm|m)?\s*(?:<\s*(-?\d*[.,]?\d*))?\s*$/i.exec(text);
  if (!m || m[1] === '' || m[1] === '.' || m[1] === ',') return null;
  const n = Number(m[1].replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return null;
  const unit = m[2]?.toLowerCase();
  let meters: number;
  if (unit === 'mm') meters = n / 1000;
  else if (unit === 'cm') meters = n / 100;
  else if (unit === 'm') meters = n;
  else meters = /[.,]/.test(m[1]) || n < 30 ? n : n / 100;
  let angle: number | null = null;
  if (m[3] !== undefined) {
    const a = Number(m[3].replace(',', '.'));
    if (m[3] === '' || m[3] === '-' || !Number.isFinite(a)) return null;
    angle = a;
  }
  return { length: Math.round(meters * 1e6) / 1e6, angle };
}

/** "5x3" or "5 x 3" or "500x300cm" (width x depth) for rectangles. */
export function parseTypedSize(text: string): { w: number; d: number } | null {
  const parts = text.toLowerCase().split('x');
  if (parts.length !== 2) return null;
  const unit = /(mm|cm|m)\s*$/.exec(parts[1])?.[1] ?? '';
  const a = parseTypedLength(parts[0] + unit);
  const b = parseTypedLength(parts[1]);
  return a && b ? { w: a.length, d: b.length } : null;
}

/** Text shown while typing: how the input is understood. */
export function describeTyped(text: string): string {
  const size = text.toLowerCase().includes('x') ? parseTypedSize(text) : null;
  if (size) return `${fmt(size.w)} × ${fmt(size.d)}`;
  const v = parseTypedLength(text);
  if (!v) return '…';
  return v.angle === null ? fmt(v.length) : `${fmt(v.length)} at ${v.angle}°`;
}

const fmt = (m: number) => `${(Math.round(m * 1000) / 1000).toString()} m`;

/** The point `length` away from `from`, in the direction of `towards`, or along `angle` degrees when given. */
export function pointAtDistance(from: Point, towards: Point | null, length: number, angle: number | null, fallbackAngle = 0): Point {
  let ux: number;
  let uy: number;
  if (angle !== null) {
    ux = Math.cos((angle * Math.PI) / 180);
    uy = Math.sin((angle * Math.PI) / 180);
  } else {
    const dx = towards ? towards.x - from.x : 0;
    const dy = towards ? towards.y - from.y : 0;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) {
      ux = Math.cos((fallbackAngle * Math.PI) / 180);
      uy = Math.sin((fallbackAngle * Math.PI) / 180);
    } else {
      ux = dx / len;
      uy = dy / len;
    }
  }
  const round = (v: number) => Math.round(v * 1e6) / 1e6;
  return { x: round(from.x + ux * length), y: round(from.y + uy * length) };
}
