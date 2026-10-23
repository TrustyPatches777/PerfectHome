import { describe, expect, it } from 'vitest';
import { describeTyped, parseTypedLength, parseTypedSize, pointAtDistance } from './typed';

describe('typed lengths', () => {
  it('reads plain numbers sensibly', () => {
    expect(parseTypedLength('3.5')?.length).toBe(3.5);
    expect(parseTypedLength('3,5')?.length).toBe(3.5);
    expect(parseTypedLength('4')?.length).toBe(4);
    expect(parseTypedLength('12')?.length).toBe(12);
    expect(parseTypedLength('350')?.length).toBe(3.5); // whole numbers from 30 up are centimeters
    expect(parseTypedLength('80')?.length).toBe(0.8);
    expect(parseTypedLength('.5')?.length).toBe(0.5);
  });
  it('lets an explicit unit win', () => {
    expect(parseTypedLength('40m')?.length).toBe(40);
    expect(parseTypedLength('40 cm')?.length).toBe(0.4);
    expect(parseTypedLength('400mm')?.length).toBe(0.4);
    expect(parseTypedLength('2.4M')?.length).toBe(2.4);
    expect(parseTypedLength('5cm')?.length).toBe(0.05);
  });
  it('reads an optional angle', () => {
    expect(parseTypedLength('3.5<45')).toEqual({ length: 3.5, angle: 45 });
    expect(parseTypedLength('2m < -90')).toEqual({ length: 2, angle: -90 });
    expect(parseTypedLength('3.5')?.angle).toBeNull();
  });
  it('rejects nonsense', () => {
    for (const bad of ['', '.', 'abc', '0', '-3', '3.5<', '3..5', '3m4', '<45', '1x2']) expect(parseTypedLength(bad), bad).toBeNull();
  });
  it('reads rectangle sizes', () => {
    expect(parseTypedSize('5x3')).toEqual({ w: 5, d: 3 });
    expect(parseTypedSize('500x300cm')).toEqual({ w: 5, d: 3 });
    expect(parseTypedSize('4.5 X 2.25')).toEqual({ w: 4.5, d: 2.25 });
    expect(parseTypedSize('5x')).toBeNull();
    expect(parseTypedSize('5')).toBeNull();
  });
  it('explains what it understood', () => {
    expect(describeTyped('350')).toBe('3.5 m');
    expect(describeTyped('3.5<45')).toBe('3.5 m at 45°');
    expect(describeTyped('5x3')).toBe('5 m × 3 m');
    expect(describeTyped('3.')).toBe('3 m');
    expect(describeTyped('abc')).toBe('…');
  });
});

describe('pointAtDistance', () => {
  const o = { x: 1, y: 1 };
  it('goes the exact length toward a target', () => {
    expect(pointAtDistance(o, { x: 9, y: 1 }, 3.5, null)).toEqual({ x: 4.5, y: 1 });
    const p = pointAtDistance(o, { x: 4, y: 5 }, 10, null);
    expect(Math.hypot(p.x - 1, p.y - 1)).toBeCloseTo(10, 5);
    expect((p.y - 1) / (p.x - 1)).toBeCloseTo(4 / 3, 5);
  });
  it('uses the typed angle when given (clockwise from right, y down)', () => {
    expect(pointAtDistance(o, { x: 9, y: 1 }, 2, 90)).toEqual({ x: 1, y: 3 });
    expect(pointAtDistance(o, null, 2, 180)).toEqual({ x: -1, y: 1 });
  });
  it('falls back to a direction when the target is the start itself', () => {
    expect(pointAtDistance(o, o, 2, null, 0)).toEqual({ x: 3, y: 1 });
    expect(pointAtDistance(o, null, 2, null, 90)).toEqual({ x: 1, y: 3 });
  });
});
