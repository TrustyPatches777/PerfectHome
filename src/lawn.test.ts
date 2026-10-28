import { describe, expect, it } from 'vitest';
import { createDesign, type Design, type Zone } from './model';
import { plotFirst } from './outdoor';
import { sceneChunks } from './view3d/build';

const square = (x0: number, y0: number, x1: number, y1: number) => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
const zone = (id: string, kind: Zone['kind'], points: Zone['points']): Zone => ({ id, floor: 'f', kind, name: '', color: '#cfe8c4', points });

function garden(): Design {
  const d = createDesign();
  d.floors[0].id = 'f';
  return d;
}

describe('a lawn can go round other areas', () => {
  it('lawns are drawn behind the other areas, however they were drawn, and the plot behind everything', () => {
    const order = plotFirst([zone('pool', 'water', square(0, 0, 1, 1)), zone('patio', 'terrace', square(2, 0, 3, 1)), zone('lawn', 'lawn', square(-5, -5, 9, 9)), zone('plot', 'plot', square(-9, -9, 12, 12))]);
    expect(order.map((z) => z.id)).toEqual(['plot', 'lawn', 'pool', 'patio']);
    expect(plotFirst([zone('a', 'lawn', square(0, 0, 1, 1)), zone('b', 'lawn', square(0, 0, 1, 1))]).map((z) => z.id)).toEqual(['a', 'b']); // lawns keep their own order
  });

  const lawnPart = (d: Design) => {
    const p = sceneChunks(d).find((c) => c.key === 'zone:lawn')!.make()[0];
    return p.t === 'prism' ? p : null;
  };

  it('in 3D a lawn is cut open over a pond or pool inside it, so it does not hide it', () => {
    const d = garden();
    d.zones.push(zone('lawn', 'lawn', square(0, 0, 20, 12)));
    expect(lawnPart(d)?.holes ?? []).toHaveLength(0);
    d.zones.push(zone('pond', 'water', square(4, 3, 8, 6)));
    d.furniture.push({ id: 'pool', floor: 'f', type: 'pool', x: 14, y: 6, w: 5, d: 3, rotation: 0, color: '#bfe0f5', label: '' });
    expect(lawnPart(d)?.holes).toHaveLength(2);
    // an area that is not water stays on top of the lawn instead (it is higher)
    d.zones.push(zone('patio', 'terrace', square(10, 1, 13, 3)));
    expect(lawnPart(d)?.holes).toHaveLength(2);
  });

  it('a pond only partly inside the lawn is left alone, and the lawn chunk follows the pond when it moves', () => {
    const d = garden();
    d.zones.push(zone('lawn', 'lawn', square(0, 0, 10, 10)), zone('pond', 'water', square(8, 8, 12, 12)));
    expect(lawnPart(d)?.holes ?? []).toHaveLength(0);
    const before = sceneChunks(d).find((c) => c.key === 'zone:lawn')!.deps;
    d.zones[1] = { ...d.zones[1], points: square(2, 2, 4, 4) };
    const after = sceneChunks(d).find((c) => c.key === 'zone:lawn')!.deps;
    expect(after.length).toBeGreaterThan(before.length);
    expect(lawnPart(d)?.holes).toHaveLength(1);
  });
});
