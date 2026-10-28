import { describe, expect, it } from 'vitest';
import { CATALOG, catalogItem, furnitureHeight } from './catalog';
import { createDesign, parseDesign, type Design } from './model';
import { computeShadows } from './shadows';
import { DECIDUOUS, groundColor, isFoliage, isSnowy, leafColor, mixHex, moodOf, seasonOf, snowColor } from './sky';
import { sceneChunks, seasonalTree } from './view3d/build';
import { horizonParts, HORIZON_RADIUS } from './view3d/skyline';
import type { Part } from './view3d/parts';

const base = (): Design => {
  const d = createDesign();
  d.floors[0].id = 'f';
  return d;
};
const chunk = (d: Design, key: string): Part[] => sceneChunks(d).find((c) => c.key === key)!.make();

describe('seasons', () => {
  it('follow the date, the other way round in the south, unless chosen', () => {
    expect(seasonOf({ month: 1, lat: 50 })).toBe('winter');
    expect(seasonOf({ month: 4, lat: 50 })).toBe('spring');
    expect(seasonOf({ month: 7, lat: 50 })).toBe('summer');
    expect(seasonOf({ month: 10, lat: 50 })).toBe('autumn');
    expect(seasonOf({ month: 12, lat: 50 })).toBe('winter');
    expect(seasonOf({ month: 7, lat: -34 })).toBe('winter');
    expect(seasonOf({ month: 1, lat: -34 })).toBe('summer');
    expect(seasonOf({ month: 7, lat: 50, season: 'autumn' })).toBe('autumn');
    expect(seasonOf({ month: 7, lat: 50, season: 'auto' })).toBe('summer');
  });

  it('change the leaves: lighter in spring, warm in autumn, none in winter', () => {
    expect(leafColor('summer', '#4f9d5d', 0)).toBe('#4f9d5d');
    expect(leafColor('winter', '#4f9d5d', 0)).toBeNull();
    expect(leafColor('autumn', '#4f9d5d', 0)).not.toBe(leafColor('autumn', '#4f9d5d', 1));
    expect(isFoliage(leafColor('spring', '#4f9d5d', 0)!)).toBe(true);
    expect(isFoliage('#6b4f3a')).toBe(false); // a trunk
    expect(isFoliage('#e5e7eb')).toBe(false); // a birch trunk
    expect(isFoliage('#4f9d5d')).toBe(true);
    expect(DECIDUOUS.has('tree-oak')).toBe(true);
    expect(DECIDUOUS.has('tree-pine')).toBe(false); // evergreens keep their needles
  });

  it('trees in 3D follow the season: leaves, warm leaves, a trunk with bare branches', () => {
    const d = base();
    d.furniture.push({ id: 't', floor: 'f', type: 'tree-oak', x: 0, y: 0, w: 5, d: 5, rotation: 0, color: '#4f9d5d', label: '' });
    const greens = (parts: Part[]) => parts.filter((p) => (p.t === 'ball' || p.t === 'cyl') && isFoliage(p.color)).length;
    const summer = chunk(d, 'fur:t');
    expect(greens(summer)).toBeGreaterThan(2);
    d.site.season = 'autumn';
    const autumn = chunk(d, 'fur:t');
    expect(greens(autumn)).toBe(0);
    expect(autumn.length).toBe(summer.length);
    d.site.season = 'winter';
    const winter = chunk(d, 'fur:t');
    expect(greens(winter)).toBe(0);
    expect(winter.filter((p) => p.t === 'beam').length).toBeGreaterThanOrEqual(8); // bare branches
    d.furniture[0].type = 'tree-pine';
    expect(greens(chunk(d, 'fur:t'))).toBeGreaterThan(0); // still green in winter
    // the chunk is rebuilt when the season changes
    d.furniture[0].type = 'tree-oak';
    d.site.season = 'summer';
    const a = sceneChunks(d).find((c) => c.key === 'fur:t')!.deps;
    d.site.season = 'winter';
    const b = sceneChunks(d).find((c) => c.key === 'fur:t')!.deps;
    expect(a).not.toEqual(b);
    expect(seasonalTree(summer, 'summer', false, { hw: 2, hd: 2, h: 8 })).toBe(summer);
  });
});

describe('weather', () => {
  it('overcast skies are greyer and give weaker, shadowless sun; fog is close, rain and snow fall', () => {
    expect(moodOf().sun).toBe(1);
    expect(moodOf('clear').shadows).toBe(true);
    for (const w of ['cloudy', 'rain', 'snow', 'fog'] as const) {
      expect(moodOf(w).sun, w).toBeLessThan(0.5);
      expect(moodOf(w).shadows, w).toBe(false);
      expect(moodOf(w).clouds, w).toBeGreaterThan(moodOf('clear').clouds);
    }
    expect(moodOf('rain').precip).toBe('rain');
    expect(moodOf('snow').precip).toBe('snow');
    expect(moodOf('cloudy').precip).toBeNull();
    expect(moodOf('fog').fog).toBeLessThan(150);
    expect(isSnowy({ weather: 'snow' })).toBe(true);
    expect(isSnowy({})).toBe(false);
  });

  it('snow whitens the ground, the areas of the plot and the roofs', () => {
    const d = base();
    d.zones.push({ id: 'l', floor: 'f', kind: 'lawn', name: '', color: '#7fbf6a', points: [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 6 }, { x: 0, y: 6 }] });
    d.zones.push({ id: 'p', floor: 'f', kind: 'water', name: '', color: '#3b82f6', points: [{ x: 8, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 2 }, { x: 8, y: 2 }] });
    d.roofs.push({ id: 'r', floor: 'f', kind: 'gable', x: 3, y: 3, w: 6, d: 4, rotation: 0, pitch: 35, overhang: 0.4, thickness: 0.15, material: 'tiles', color: '#b5523b', chimney: false, parapet: false });
    const roofPanels = (parts: Part[]) => parts.filter((p) => p.t === 'panel' && p.color === '#f6f8fb').length;
    expect(roofPanels(chunk(d, 'roof:r'))).toBe(0);
    const lawnColor = () => (chunk(d, 'zone:l')[0] as Extract<Part, { t: 'prism' }>).color;
    expect(lawnColor()).toBe('#7fbf6a');
    const groundBefore = (chunk(d, 'ground')[0] as Extract<Part, { t: 'prism' }>).color;
    d.site.weather = 'snow';
    expect(roofPanels(chunk(d, 'roof:r'))).toBe(2); // both slopes
    expect(lawnColor()).toBe(snowColor('#7fbf6a'));
    expect(lawnColor()).not.toBe('#7fbf6a');
    expect(groundColor('summer', true)).toBe('#f2f5f8');
    expect((chunk(d, 'ground')[0] as Extract<Part, { t: 'prism' }>).color).not.toBe(groundBefore);
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080');
  });
});

describe('the horizon', () => {
  it('is a ring of far-away scenery, unlit and out of the fog, the same every time, and nothing when open', () => {
    expect(horizonParts('none', 0, 0)).toEqual([]);
    for (const kind of ['hills', 'mountains', 'city', 'forest', 'sea'] as const) {
      const parts = horizonParts(kind, 10, 20);
      expect(parts.length, kind).toBeGreaterThan(0);
      expect(parts.every((p) => p.t !== 'light' && p.sky === true), kind).toBe(true);
      expect(horizonParts(kind, 10, 20), kind).toEqual(parts);
    }
    expect(horizonParts('city', 0, 0).length).toBeGreaterThan(80);
    const far = horizonParts('mountains', 0, 0).filter((p) => p.t === 'cyl') as Extract<Part, { t: 'cyl' }>[];
    expect(Math.min(...far.map((p) => Math.hypot(p.x, p.z)))).toBeGreaterThan(HORIZON_RADIUS - 150);
    const d = base();
    d.rooms.push({ id: 'r', floor: 'f', name: 'R', color: '#eee', material: 'plain', living: true, points: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 }] });
    expect(sceneChunks(d).some((c) => c.key === 'horizon')).toBe(false);
    d.site.horizon = 'hills';
    expect(sceneChunks(d).some((c) => c.key === 'horizon')).toBe(true);
  });
});

describe('neighbouring buildings', () => {
  it('are catalog items with their real height, and they cast shadows on the plan', () => {
    for (const t of ['nb-house', 'nb-house-modern', 'nb-terrace', 'nb-block', 'nb-tower', 'nb-garage', 'nb-wall', 'nb-fence']) expect(CATALOG.some((c) => c.type === t), t).toBe(true);
    expect(catalogItem('nb-block').category).toBe('Surroundings');
    expect(furnitureHeight({ type: 'nb-tower' })).toBe(48);
    const d = base();
    d.furniture.push({ id: 'n', floor: 'f', type: 'nb-house', x: 0, y: 0, w: 9, d: 7.5, rotation: 0, color: '#e8e0d0', label: '' });
    const s = computeShadows(d, 'f', { azimuth: 180, elevation: 30 });
    expect(s.shadows.length).toBeGreaterThan(0); // a 7 m house at 30 degrees throws a long shadow
  });
});

describe('saved and loaded', () => {
  it('keeps the weather, season and horizon, repairs junk, and an old design loads as before', () => {
    const d = base();
    d.site.weather = 'rain';
    d.site.season = 'autumn';
    d.site.horizon = 'city';
    const back = parseDesign(JSON.parse(JSON.stringify(d)));
    expect(back.site).toMatchObject({ weather: 'rain', season: 'autumn', horizon: 'city' });
    const raw = JSON.parse(JSON.stringify(d));
    raw.site.weather = 'hail';
    raw.site.season = 'monsoon';
    raw.site.horizon = 'moon';
    const fixed = parseDesign(raw);
    expect([fixed.site.weather, fixed.site.season, fixed.site.horizon]).toEqual([undefined, undefined, undefined]);
    const plain = parseDesign(JSON.parse(JSON.stringify(base())));
    expect([plain.site.weather, plain.site.season, plain.site.horizon]).toEqual([undefined, undefined, undefined]);
  });
});
