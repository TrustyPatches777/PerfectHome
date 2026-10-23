import { describe, expect, it } from 'vitest';
import { mountOnWall } from './mount';
import type { Wall } from './model';

const wall = (over: Partial<Wall> = {}): Wall => ({ id: 'w', floor: 'f', a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, thickness: 0.2, type: 'interior', height: 2.5, ...over });

describe('mounting on walls', () => {
  it('sits flush on the wall face on the cursor side, back to the wall', () => {
    const below = mountOnWall({ x: 2, y: 0.4 }, [wall()], 0.1)!; // cursor on the +y side
    expect(below.x).toBeCloseTo(2, 9);
    expect(below.y).toBeCloseTo(0.1 + 0.05, 9); // half the wall + half the item
    expect(below.rotation).toBe(0);
    const above = mountOnWall({ x: 2, y: -0.4 }, [wall()], 0.1)!;
    expect(above.y).toBeCloseTo(-0.15, 9);
    expect(above.rotation).toBe(180);
  });

  it('works on vertical and curved walls', () => {
    const v = mountOnWall({ x: 0.3, y: 2 }, [wall({ a: { x: 0, y: 0 }, b: { x: 0, y: 4 } })], 0.1)!;
    expect(v.rotation).toBe(270); // wall heads down (90 deg); the cursor is on its left (-x) side, so 90 + 180
    expect(v.x).toBeCloseTo(0.15, 9);
    const arc = mountOnWall({ x: 2, y: 1.3 }, [wall({ bulge: 1 })], 0.1)!;
    expect(arc.y).toBeGreaterThan(1.1); // outside the apex of the arc
    expect(arc.rotation).toBeCloseTo(0, 5);
  });

  it('snaps along the wall and stays on it', () => {
    expect(mountOnWall({ x: 2.13, y: 0.3 }, [wall()], 0.1, 0.6, 0.5)!.x).toBeCloseTo(2, 9);
    expect(mountOnWall({ x: 6, y: 0.3 }, [wall()], 0.1, 3)!.x).toBeCloseTo(4, 9); // clamped to the wall's end
  });

  it('does nothing away from walls', () => {
    expect(mountOnWall({ x: 2, y: 3 }, [wall()], 0.1)).toBeNull();
    expect(mountOnWall({ x: 2, y: 0.4 }, [], 0.1)).toBeNull();
  });

  it('picks the nearest of several walls', () => {
    const walls = [wall({ id: 'a' }), wall({ id: 'b', a: { x: 0, y: 1 }, b: { x: 4, y: 1 } })];
    expect(mountOnWall({ x: 2, y: 0.8 }, walls, 0.1)!.wallId).toBe('b');
  });
});
