import { describe, expect, it } from 'vitest';
import { autoDimensions, plainMeters, rectangleSize } from './dims';
import { createDesign } from './model';

function house() {
  const d = createDesign();
  const F = d.floors[0].id;
  const wall = (id: string, ax: number, ay: number, bx: number, by: number) => d.walls.push({ id, floor: F, a: { x: ax, y: ay }, b: { x: bx, y: by }, thickness: 0.2, type: 'interior', height: 2.5 });
  wall('t', 0, 0, 4, 0);
  wall('r', 4, 0, 4, 3);
  wall('b', 4, 3, 0, 3);
  wall('l', 0, 3, 0, 0);
  d.rooms.push({ id: 'room', floor: F, name: 'Room', color: '#fff', material: 'plain', living: true, points: [{ x: 0.1, y: 0.1 }, { x: 3.9, y: 0.1 }, { x: 3.9, y: 2.9 }, { x: 0.1, y: 2.9 }] });
  return { d, F };
}

describe('automatic dimensions', () => {
  it('formats plain meters', () => {
    expect(plainMeters(3.2)).toBe('3.2');
    expect(plainMeters(0.4567)).toBe('0.46');
    expect(plainMeters(4)).toBe('4');
  });

  it('detects axis-aligned rectangles', () => {
    expect(rectangleSize([{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 }])).toEqual({ w: 4, h: 3 });
    expect(rectangleSize([{ x: 0, y: 0 }, { x: 4, y: 1 }, { x: 4, y: 3 }, { x: 0, y: 3 }])).toBeNull();
    expect(rectangleSize([{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }])).toBeNull();
  });

  it('labels every wall on the outside of the room, upright, with its length', () => {
    const { d, F } = house();
    const labels = autoDimensions(d, F, 60).filter((l) => l.kind === 'wall');
    expect(labels).toHaveLength(4);
    const top = labels.find((l) => l.text === '4' && l.y < 0)!; // top wall: label above (outside), not inside the room
    expect(top).toBeDefined();
    expect(top.x).toBeCloseTo(2, 9);
    expect(top.y).toBeCloseTo(-0.32, 9);
    expect(top.angle).toBe(0);
    const right = labels.find((l) => l.text === '3' && l.x > 4)!;
    expect(right.angle).toBe(90); // vertical text reads bottom-to-top... or top-to-bottom, never upside down
    expect(labels.every((l) => l.angle >= -90 && l.angle <= 90)).toBe(true);
    // none of the labels sits inside the room
    for (const l of labels) expect(l.x < 0.1 || l.x > 3.9 || l.y < 0.1 || l.y > 2.9).toBe(true);
  });

  it('gives rectangular rooms their size, and skips labels that would not fit when zoomed out', () => {
    const { d, F } = house();
    expect(autoDimensions(d, F, 60).find((l) => l.kind === 'room')!.text).toBe('3.8 × 2.8');
    expect(autoDimensions(d, F, 2).filter((l) => l.kind === 'wall')).toHaveLength(0);
  });

  it('only describes the given floor, and sizes furniture and zones', () => {
    const { d, F } = house();
    d.furniture.push({ id: 'f', floor: F, type: 'sofa', x: 2, y: 1.5, w: 2, d: 0.9, rotation: 0, color: '#fff', label: '' });
    d.zones.push({ id: 'z', floor: F, kind: 'lawn', name: '', color: '#cfc', points: [{ x: 5, y: 0 }, { x: 9, y: 0 }, { x: 9, y: 4 }, { x: 5, y: 4 }] });
    d.strips.push({ id: 's', floor: F, kind: 'road', width: 6, points: [{ x: 0, y: 8 }, { x: 10, y: 8 }] });
    const labels = autoDimensions(d, F, 60);
    expect(labels.find((l) => l.kind === 'furniture')!.text).toBe('200 × 90');
    expect(labels.filter((l) => l.kind === 'zone').map((l) => l.text).sort()).toEqual(['4', '4']);
    expect(labels.find((l) => l.kind === 'strip')!.text).toBe('10');
    expect(autoDimensions(d, 'other-floor', 60)).toEqual([]);
    expect(autoDimensions(d, F, 20).some((l) => l.kind === 'furniture')).toBe(false); // too small to read when zoomed out
  });
});
