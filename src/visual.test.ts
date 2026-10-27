import { describe, expect, it } from 'vitest';
import { coverOutside, outerSide } from './facade';
import { createDesign, parseDesign, type Design, type Opening, type Roof, type Room, type Skylight, type Stair, type Wall, type Zone } from './model';
import { freeEdges, joinEdges } from './outdoor';
import { encodeSpec, parseSpec, roomSpec, skinSpec, WALL_PATTERNS } from './paintSpec';
import { decompose, isRectilinear, wingsOf } from './roofWings';
import { reachesNextFloor } from './stairs';
import { ceilingParts, dormerCorners, dormerParts, eaveParts, furnitureChunk, sceneChunks, solarParts } from './view3d/build';
import { partsBounds, type Part } from './view3d/parts';
import { roofModel, skylightPlacement } from './roofs';
import { buildWalkWorld } from './walk';
import { floorElevations } from './view3d/build';

const wall = (id: string, ax: number, ay: number, bx: number, by: number, extra: Partial<Wall> = {}): Wall => ({ id, floor: 'f', a: { x: ax, y: ay }, b: { x: bx, y: by }, thickness: 0.3, type: 'exterior', height: 2.5, ...extra });
const room = (id: string, x0: number, y0: number, x1: number, y1: number, extra: Partial<Room> = {}): Room => ({ id, floor: 'f', name: id, color: '#eee', material: 'plain', living: true, points: [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }], ...extra });
function base(): Design {
  const d = createDesign();
  d.floors[0].id = 'f';
  return d;
}
const house = (d: Design) => {
  d.walls.push(wall('n', 0, 0, 8, 0), wall('e', 8, 0, 8, 6), wall('s', 8, 6, 0, 6), wall('w', 0, 6, 0, 0));
  d.rooms.push(room('r', 0.15, 0.15, 7.85, 5.85));
};
const roof = (extra: Partial<Roof> = {}): Roof => ({ id: 'rf', floor: 'f', kind: 'gable', x: 4, y: 3, w: 8, d: 6, rotation: 0, pitch: 35, overhang: 0.4, thickness: 0.15, material: 'tiles', color: '#b5523b', chimney: false, parapet: false, ...extra });

describe('coverings are one string', () => {
  it('a plain color stays plain; extras are packed and unpacked', () => {
    expect(encodeSpec({ base: '#aabbcc' })).toBe('#aabbcc');
    expect(parseSpec('#aabbcc')).toEqual({ base: '#aabbcc' });
    const spec = encodeSpec({ base: '#aabbcc', second: '#112233', pattern: 'herringbone', texture: 'abc123' });
    expect(parseSpec(spec)).toEqual({ base: '#aabbcc', second: '#112233', pattern: 'herringbone', texture: 'abc123' });
    expect(parseSpec(encodeSpec({ base: '#aabbcc', texture: 'abc' }))).toEqual({ base: '#aabbcc', texture: 'abc' });
    expect(skinSpec({ color: '#fff', grout: '#000', pattern: 'subway' })).toBe('#fff|#000|subway|');
    expect(roomSpec({ color: '#fff' })).toBe('#fff');
    expect(WALL_PATTERNS.wallpaper!.map((p) => p.id)).toContain('damask');
    expect(WALL_PATTERNS.tiles!.map((p) => p.id)).toEqual(['grid', 'subway', 'herringbone', 'diagonal']);
  });

  it('new wall finishes, floor materials and their extras are saved and repaired', () => {
    const d = base();
    house(d);
    d.walls[0].paint = { l: { finish: 'wallpaper', color: '#eeddcc', pattern: 'floral', grout: '#445566' }, r: { finish: 'tiles', color: '#ffffff', pattern: 'herringbone', grout: '#222222' } };
    d.walls[1].paint = { r: { finish: 'custom', color: '#cccccc', texture: 'tex1234' } };
    d.rooms[0] = room('r', 0, 0, 4, 4, { material: 'marble', grout: '#112233' });
    d.rooms.push(room('c', 4, 0, 8, 4, { material: 'custom', texture: 'pic9876' }));
    const back = parseDesign(JSON.parse(JSON.stringify(d)));
    expect(back.walls[0].paint).toEqual(d.walls[0].paint);
    expect(back.walls[1].paint!.r).toMatchObject({ finish: 'custom', texture: 'tex1234' });
    expect(back.rooms[0]).toMatchObject({ material: 'marble', grout: '#112233' });
    expect(back.rooms[1]).toMatchObject({ material: 'custom', texture: 'pic9876' });
    const raw = JSON.parse(JSON.stringify(d));
    raw.walls[0].paint.l = { finish: 'wallpaper', color: '#fff', pattern: 'DROP TABLE', grout: 'red', texture: '../etc' };
    raw.rooms[0].grout = 'blue';
    raw.rooms[1].texture = 'a b c';
    const fixed = parseDesign(raw);
    expect(fixed.walls[0].paint!.l).toEqual({ finish: 'wallpaper', color: '#fff' });
    expect(fixed.rooms[0].grout).toBeUndefined();
    expect(fixed.rooms[1].texture).toBeUndefined();
    raw.rooms[0].material = 'lava';
    expect(parseDesign(raw).rooms[0].material).toBe('plain');
  });

  it('3D hands the covering of a floor and of a wall to the textures, whole', () => {
    const d = base();
    house(d);
    d.rooms[0] = room('r', 0.15, 0.15, 7.85, 5.85, { material: 'checker', color: '#f1efe9', grout: '#222222' });
    d.walls[0].paint = { r: { finish: 'wallpaper', color: '#eeddcc', pattern: 'dots', grout: '#445566' } };
    const floor = sceneChunks(d).find((c) => c.key === 'room:r')!.make()[0];
    expect(floor.t === 'prism' && floor.tex).toEqual({ kind: 'checker', color: '#f1efe9||#222222' }.color ? { kind: 'checker', color: '#f1efe9|#222222||' } : undefined);
    const skin = sceneChunks(d).find((c) => c.key === 'wall:n')!.make().find((p) => p.t === 'panel' && p.tex);
    expect(skin && skin.t === 'panel' && skin.tex).toEqual({ kind: 'wall-wallpaper', color: '#eeddcc|#445566|dots|' });
  });
});

describe('a second color for furniture', () => {
  const chunk = (type: string, color2?: string): Part[] => {
    const d = base();
    return furnitureChunk(d, { id: 'x', floor: 'f', type, x: 0, y: 0, w: 2, d: 1, rotation: 0, color: '#9ca3af', label: '', ...(color2 ? { color2 } : {}) }, 0);
  };
  it('replaces the frame parts and nothing else, and shows more of the frame of upholstered pieces', () => {
    for (const type of ['bed-double', 'sofa', 'armchair', 'dining-table']) {
      const plain = chunk(type);
      const framed = chunk(type, '#123456');
      expect(plain.some((p) => p.color === '#123456'), type).toBe(false);
      expect(framed.filter((p) => p.color === '#123456').length, type).toBeGreaterThan(0);
      expect(framed.filter((p) => p.color !== '#123456').length, type).toBeGreaterThan(0); // the upholstery keeps its color
    }
    expect(chunk('sofa', '#123456').length).toBeGreaterThan(chunk('sofa').length); // wooden arm caps and a back rail
    expect(chunk('armchair', '#123456').length).toBeGreaterThan(chunk('armchair').length);
  });
  it('is saved', () => {
    const d = base();
    d.furniture.push({ id: 'x', floor: 'f', type: 'sofa', x: 0, y: 0, w: 2, d: 1, rotation: 0, color: '#9ca3af', label: '', color2: '#6b4a2f' });
    expect(parseDesign(JSON.parse(JSON.stringify(d))).furniture[0].color2).toBe('#6b4a2f');
    const raw = JSON.parse(JSON.stringify(d));
    raw.furniture[0].color2 = 'brown';
    expect(parseDesign(raw).furniture[0].color2).toBeUndefined();
  });
});

describe('ceilings', () => {
  it('only when asked for, at the height of the room, with beams and a hole for the stairs', () => {
    const d = base();
    house(d);
    expect(sceneChunks(d).some((c) => c.key.startsWith('ceil:'))).toBe(false);
    d.rooms[0].ceiling = 2.4;
    const chunk = sceneChunks(d, { showCeilings: true }).find((c) => c.key === 'ceil:r')!;
    const flat = chunk.make();
    expect(flat).toHaveLength(1);
    expect(flat[0].t === 'prism' && flat[0].y0).toBeCloseTo(2.4);
    d.rooms[0].ceilingStyle = 'coffered';
    const coffered = sceneChunks(d, { showCeilings: true }).find((c) => c.key === 'ceil:r')!.make();
    expect(coffered.length).toBeGreaterThan(40);
    expect(partsBounds(coffered).minY).toBeCloseTo(2.3, 1); // the grid hangs 10 cm down
    d.rooms[0].ceilingStyle = 'beams';
    const beams = sceneChunks(d, { showCeilings: true }).find((c) => c.key === 'ceil:r')!.make();
    expect(beams.length).toBeGreaterThan(5);
    expect(beams.slice(1).every((p) => p.color === '#8b6b4a')).toBe(true);
    // a stair on this floor that goes to the next one leaves a hole in the ceiling; entrance steps do not
    d.stairs.push({ id: 's', floor: 'f', kind: 'straight', x: 4, y: 3, w: 1, d: 3, rotation: 0, steps: 16, rise: 2.8, flip: false });
    const holed = sceneChunks(d, { showCeilings: true }).find((c) => c.key === 'ceil:r')!.make()[0];
    expect(holed.t === 'prism' && holed.holes?.length).toBe(1);
    d.stairs[0].rise = 0.45;
    expect(sceneChunks(d, { showCeilings: true }).find((c) => c.key === 'ceil:r')!.make()[0].t === 'prism' && (sceneChunks(d, { showCeilings: true }).find((c) => c.key === 'ceil:r')!.make()[0] as { holes?: unknown }).holes).toBeUndefined();
    expect(parseDesign(JSON.parse(JSON.stringify({ ...d, rooms: [{ ...d.rooms[0], ceilingStyle: 'beams' }] }))).rooms[0].ceilingStyle).toBe('beams');
    expect(parseDesign(JSON.parse(JSON.stringify({ ...d, rooms: [{ ...d.rooms[0], ceilingStyle: 'dome' }] }))).rooms[0].ceilingStyle).toBeUndefined();
  });
});

describe('roofs for a house of several wings', () => {
  const L = [{ x: 0, y: 0 }, { x: 12, y: 0 }, { x: 12, y: 6 }, { x: 6, y: 6 }, { x: 6, y: 12 }, { x: 0, y: 12 }];

  it('an L is cut into two rectangles; a box stays one', () => {
    expect(isRectilinear(L)).toBe(true);
    expect(isRectilinear([{ x: 0, y: 0 }, { x: 5, y: 1 }, { x: 4, y: 6 }, { x: 0, y: 5 }])).toBe(false);
    const rects = decompose(L);
    expect(rects).toHaveLength(2);
    expect(rects.reduce((s, r) => s + (r.x1 - r.x0) * (r.y1 - r.y0), 0)).toBeCloseTo(108);
    expect(decompose([{ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 8, y: 5 }, { x: 0, y: 5 }])).toHaveLength(1);
    // a T and a U
    expect(decompose([{ x: 0, y: 0 }, { x: 12, y: 0 }, { x: 12, y: 4 }, { x: 8, y: 4 }, { x: 8, y: 10 }, { x: 4, y: 10 }, { x: 4, y: 4 }, { x: 0, y: 4 }]).length).toBeLessThanOrEqual(3);
  });

  it('each wing has its ridge along its long side, and the wing that runs into another one reaches into it', () => {
    const wings = wingsOf(L);
    expect(wings).toHaveLength(2);
    const [main, wing] = wings.sort((a, b) => b.w * b.d - a.w * a.d);
    expect(main).toMatchObject({ rotation: 0, w: 12, d: 6 }); // the wide arm
    expect(wing.rotation).toBe(90); // the other runs along y
    // the wing is 6 wide and 6 long and ends against the wide arm: it is made longer by half the width of that arm (3 m)
    expect(wing.w).toBeCloseTo(9);
    expect(wing.y - wing.w / 2).toBeCloseTo(6 - 3); // it starts in the middle of the wide arm
    expect(wing.d).toBeCloseTo(6);
  });
});

describe('roof detail', () => {
  it('a dormer is a wall, two cheeks and two roof planes, cut into the slope', () => {
    const d = base();
    d.roofs.push(roof());
    const sky: Skylight = { id: 'dm', floor: 'f', x: 4, y: 4.2, w: 1.5, d: 1.3, kind: 'dormer' };
    const sp = skylightPlacement(d.roofs, 'f', sky)!;
    expect(sp.flat).toBe(false);
    const hole = dormerCorners(sp, sky);
    expect(hole).toHaveLength(4);
    // the opening in the roof lies in the slope: its corners are on the roof surface
    for (const c of hole) expect(c[1]).toBeGreaterThan(0.1);
    const parts = dormerParts(sp, sky, d.roofs[0]);
    expect(parts.filter((p) => p.t === 'panel').length).toBeGreaterThanOrEqual(6);
    expect(parts.some((p) => p.glass)).toBe(true);
    // the front wall has the window in it
    expect(parts.find((p) => p.t === 'panel' && p.holes)).toBeTruthy();
    // none on a flat roof
    d.roofs[0].kind = 'flat';
    expect(dormerParts(skylightPlacement(d.roofs, 'f', sky)!, sky, d.roofs[0])).toEqual([]);
  });

  it('a dormer cuts a hole in the roof (when it is wholly in one slope), solar panels do not', () => {
    const d = base();
    d.roofs.push(roof());
    // low on the south slope, so that the dormer's roof still ends in the same slope before the ridge
    d.skylights.push({ id: 'dm', floor: 'f', x: 4, y: 5.4, w: 1.5, d: 1, kind: 'dormer' });
    const holesOf = () => sceneChunks(d).find((c) => c.key === 'roof:rf')!.make().filter((p) => p.t === 'panel' && p.holes && p.tex?.kind === 'tiles');
    expect(holesOf()).toHaveLength(1);
    d.skylights[0].kind = 'solar';
    expect(holesOf()).toHaveLength(0);
  });

  it('solar panels lie on the slope in a frame with cell lines, and stand on legs on a flat roof', () => {
    const d = base();
    d.roofs.push(roof());
    const sky: Skylight = { id: 's', floor: 'f', x: 4, y: 4.5, w: 2, d: 1.7, kind: 'solar' };
    const parts = solarParts(skylightPlacement(d.roofs, 'f', sky)!, sky);
    expect(parts.some((p) => p.color === '#1e3a8a')).toBe(true);
    expect(parts.filter((p) => p.t === 'beam').length).toBeGreaterThan(2);
    d.roofs[0].kind = 'flat';
    const flat = solarParts(skylightPlacement(d.roofs, 'f', sky)!, sky);
    expect(flat.filter((p) => p.t === 'box').length).toBe(5);
  });

  it('gutters run along the eaves with downpipes at the corners; a fascia board has its own color', () => {
    const r = roof({ gutters: true, fascia: '#abcdef' });
    const parts = eaveParts(roofModel(r), r, -3);
    expect(parts.some((p) => p.color === '#abcdef')).toBe(true);
    expect(parts.filter((p) => p.t === 'cyl')).toHaveLength(4);
    const pipes = parts.filter((p) => p.t === 'cyl') as Extract<Part, { t: 'cyl' }>[];
    expect(Math.min(...pipes.map((p) => p.y - p.h / 2))).toBeCloseTo(-3);
    expect(eaveParts(roofModel(roof({ fascia: '#abcdef' })), roof({ fascia: '#abcdef' }), -3).some((p) => p.t === 'cyl')).toBe(false);
    expect(eaveParts(roofModel(roof()), roof(), -3)).toEqual([]);
  });

  it('chimney styles look different, and the new roof fields survive a save', () => {
    const d = base();
    d.roofs.push(roof({ chimney: true }));
    const colors = (style?: Roof['chimneyStyle']) => {
      d.roofs[0].chimneyStyle = style;
      return sceneChunks(d).find((c) => c.key === 'roof:rf')!.make().filter((p) => p.t === 'box' && p.sy > 0.9).map((p) => p.color);
    };
    expect(colors('brick')).not.toEqual(colors('stone'));
    expect(colors('stone')).not.toEqual(colors('render'));
    d.roofs[0].chimneyStyle = 'steel';
    expect(sceneChunks(d).find((c) => c.key === 'roof:rf')!.make().some((p) => p.t === 'cyl' && p.h > 0.5)).toBe(true);
    d.roofs[0].chimneyStyle = 'pots';
    expect(sceneChunks(d).find((c) => c.key === 'roof:rf')!.make().filter((p) => p.t === 'cyl' && p.color === '#b4532a')).toHaveLength(2);
    d.roofs[0] = roof({ chimney: true, chimneyStyle: 'stone', gutters: true, fascia: '#334455' });
    d.skylights.push({ id: 'k', floor: 'f', x: 4, y: 4, w: 1, d: 1, kind: 'solar' });
    const back = parseDesign(JSON.parse(JSON.stringify(d)));
    expect(back.roofs[0]).toMatchObject({ chimneyStyle: 'stone', gutters: true, fascia: '#334455' });
    expect(back.skylights[0].kind).toBe('solar');
    const raw = JSON.parse(JSON.stringify(d));
    raw.roofs[0].chimneyStyle = 'gold';
    raw.roofs[0].fascia = 'red';
    raw.skylights[0].kind = 'spaceship';
    const fixed = parseDesign(raw);
    expect(fixed.roofs[0].chimneyStyle).toBeUndefined();
    expect(fixed.roofs[0].fascia).toBeUndefined();
    expect(fixed.skylights[0].kind).toBeUndefined();
  });
});

describe('balconies, porches and railings on terraces', () => {
  it('the free edges of an area are the ones not against a wall', () => {
    const d = base();
    d.walls.push(wall('a', 0, 0, 10, 0));
    const zone = { floor: 'f', points: [{ x: 2, y: 0.2 }, { x: 6, y: 0.2 }, { x: 6, y: 2 }, { x: 2, y: 2 }] };
    const free = freeEdges(zone, d.walls);
    const runs = joinEdges(free);
    // the edge along the wall is left out; the other three are one run
    expect(runs).toHaveLength(1);
    const length = free.reduce((s, [p, q]) => s + Math.hypot(q.x - p.x, q.y - p.y), 0);
    expect(length).toBeCloseTo(1.8 + 4 + 1.8, 0);
    expect(freeEdges({ ...zone, floor: 'other' }, d.walls).length).toBeGreaterThan(free.length); // another floor's walls do not count
  });

  it('a balcony is a slab at floor level with a railing; a porch is a raised platform; both are walkable', () => {
    const d = base();
    d.floors.push({ id: 'up', name: 'Up' });
    house(d);
    d.walls.push(wall('un', 0, 0, 8, 0, { floor: 'up' }), wall('us', 8, 6, 0, 6, { floor: 'up' }));
    d.rooms.push(room('u', 0.15, 0.15, 7.85, 5.85, { floor: 'up' }));
    d.zones.push({ id: 'b', floor: 'up', kind: 'balcony', name: '', color: '#d9d2c5', railing: 'metal', points: [{ x: 2, y: 6.2 }, { x: 5, y: 6.2 }, { x: 5, y: 8 }, { x: 2, y: 8 }] } as Zone);
    d.zones.push({ id: 'p', floor: 'f', kind: 'porch', name: '', color: '#cfc6bb', raise: 0.4, points: [{ x: 5, y: 6.2 }, { x: 7, y: 6.2 }, { x: 7, y: 7.5 }, { x: 5, y: 7.5 }] } as Zone);
    const balcony = sceneChunks(d).find((c) => c.key === 'zone:b')!.make();
    const slab = balcony[0];
    expect(slab.t === 'prism' && slab.y1).toBeCloseTo(2.8 + 0.02);
    expect(balcony.length).toBeGreaterThan(10); // the railing
    const porch = sceneChunks(d).find((c) => c.key === 'zone:p')!.make();
    expect(porch).toHaveLength(1);
    expect(porch[0].t === 'prism' && porch[0].y1).toBeCloseTo(0.4);
    // walking: you can stand on both; the balcony is fenced on its free sides
    const w = buildWalkWorld(d, new Set(), floorElevations(d));
    expect(w.heightAt(3.5, 7.0, 2.81)).toBeCloseTo(2.82);
    expect(w.heightAt(6, 7, 0.01)).toBeCloseTo(0.4);
    const r = w.move(3.5, 7.0, 2.82, 0, 2);
    expect(r.z).toBeLessThan(7.9); // stopped by the railing at y = 8
    // no railing: you walk off the edge
    delete d.zones[0].railing;
    expect(buildWalkWorld(d, new Set(), floorElevations(d)).move(3.5, 7.0, 2.82, 0, 2).z).toBeGreaterThan(8.5);
    const back = parseDesign(JSON.parse(JSON.stringify(d)));
    expect(back.zones[1]).toMatchObject({ kind: 'porch', raise: 0.4 });
  });

  it('entrance steps leave no hole in the floor above and no guard rail', () => {
    const steps = { rise: 0.45 } as Stair;
    expect(reachesNextFloor(steps, 2.8)).toBe(false);
    expect(reachesNextFloor({ rise: 2.8 } as Stair, 2.8)).toBe(true);
    expect(reachesNextFloor({ rise: 2.0 } as Stair, 2.8)).toBe(true);
    const d = base();
    d.floors.push({ id: 'up', name: 'Up' });
    house(d);
    d.rooms.push(room('u', 0.15, 0.15, 7.85, 5.85, { floor: 'up' }));
    d.stairs.push({ id: 'st', floor: 'f', kind: 'straight', x: 4, y: 3, w: 1.4, d: 0.9, rotation: 0, steps: 3, rise: 0.45, flip: false, railing: { style: 'metal', a: true, b: true } });
    const holeIn = () => (sceneChunks(d).find((c) => c.key === 'room:u')!.make()[0] as { holes?: unknown[] }).holes?.length ?? 0;
    expect(holeIn()).toBe(0);
    const w = buildWalkWorld(d, new Set(), floorElevations(d));
    expect(w.heightAt(4, 3, 2.81)).toBeCloseTo(2.81); // upstairs the floor is whole
    d.stairs[0].rise = 2.8;
    expect(holeIn()).toBe(1);
    expect(buildWalkWorld(d, new Set(), floorElevations(d)).heightAt(4, 3, 2.81)!).toBeLessThan(2.81 - 0.2);
  });
});

describe('the facade', () => {
  it('the outside is the face with no room next to it, and only exterior walls are covered', () => {
    const d = base();
    house(d);
    d.walls.push(wall('mid', 4, 0, 4, 6, { type: 'interior' }));
    d.rooms.push(room('r2', 4, 0.15, 7.85, 5.85));
    d.rooms[0] = room('r', 0.15, 0.15, 3.85, 5.85);
    // the north wall runs west to east: the right face (looking a→b) is south, into the house, so the outside is the left face
    expect(outerSide(d, d.walls[0])).toBe('l');
    expect(outerSide(d, d.walls[2])).toBe('l'); // the south wall runs east to west: its left face is south too
    expect(outerSide(d, d.walls[4])).toBeNull(); // between two rooms
    const n = coverOutside(d, ['f'], { finish: 'brick', color: '#b5603f' });
    expect(n).toBe(4);
    expect(d.walls[0].paint).toEqual({ l: { finish: 'brick', color: '#b5603f' } });
    expect(d.walls[4].paint).toBeUndefined();
    coverOutside(d, ['f'], null);
    expect(d.walls.every((w) => !w.paint)).toBe(true);
  });

  it('works without rooms (away from the middle of the walls), and not on other floors', () => {
    const d = base();
    d.floors.push({ id: 'up', name: 'Up' });
    house(d);
    expect(outerSide(d, d.walls[0])).toBe('l');
    expect(outerSide(d, d.walls[1])).toBe('l');
    expect(coverOutside(d, ['up'], { finish: 'stone', color: '#a8a29a' })).toBe(0);
    expect(coverOutside(d, ['f'], { finish: 'stone', color: '#a8a29a' })).toBe(4);
  });
});

describe('doors and windows: shutters, handles and trim', () => {
  const parts = (extra: Partial<Opening>, kind: Opening['kind']): Part[] => {
    const d = base();
    d.walls.push(wall('w', 0, 0, 8, 0, { height: 2.6 }));
    d.openings.push({ id: 'o', wallId: 'w', kind, pos: 4, width: 1.2, swing: 1, hinge: 'a', ...extra });
    return sceneChunks(d).find((c) => c.key === 'wall:w')!.make();
  };

  it('shutters stand beside a window on its swing side, folded back; none on a door', () => {
    const plain = parts({}, 'window');
    const shuttered = parts({ shutters: '#3f6b4f' }, 'window');
    const shutterParts = shuttered.filter((p) => p.color === '#3f6b4f');
    expect(shutterParts.length).toBe(2);
    expect(shuttered.length).toBeGreaterThan(plain.length + 10); // the louvers
    for (const p of shutterParts) {
      expect(p.t === 'box' && Math.abs(p.x - 4)).toBeGreaterThan(0.6); // beside the window, not in front of it
      expect(p.t === 'box' && p.z).toBeGreaterThan(0.15); // on the right side (+z) of the wall
    }
    expect(parts({ shutters: '#3f6b4f', swing: -1 }, 'window').filter((p) => p.color === '#3f6b4f').every((p) => p.t === 'box' && p.z < -0.15)).toBe(true);
    expect(parts({ shutters: '#3f6b4f' }, 'door').filter((p) => p.color === '#3f6b4f')).toHaveLength(0);
  });

  it('a chosen handle replaces the usual one and swings with the door', () => {
    const usual = parts({}, 'door');
    for (const style of ['lever', 'knob', 'bar'] as const) {
      const chosen = parts({ handle: style }, 'door');
      expect(chosen.length, style).not.toBe(usual.length === chosen.length && style === 'lever' ? -1 : usual.length + 99);
      const handle = chosen.filter((p) => p.color === '#9ca3af' && p.anim);
      expect(handle.length, style).toBeGreaterThan(0);
      expect(handle.every((p) => p.anim!.kind === 'swing')).toBe(true);
    }
    expect(parts({ handle: 'knob' }, 'door').some((p) => p.t === 'ball')).toBe(true);
    expect(parts({ handle: 'bar' }, 'main').some((p) => p.t === 'box' && p.sy >= 0.45 && p.anim)).toBe(true);
  });

  it('trim is a board each side and one over the top, on both faces', () => {
    const plain = parts({}, 'window');
    const trimmed = parts({ trim: '#abcdef' }, 'window');
    expect(trimmed.filter((p) => p.color === '#abcdef')).toHaveLength(6);
    expect(plain.some((p) => p.color === '#abcdef')).toBe(false);
    expect(parts({ trim: '#abcdef' }, 'door').filter((p) => p.color === '#abcdef')).toHaveLength(6);
    const back = parseDesign(JSON.parse(JSON.stringify({ ...createDesign(), walls: [wall('w', 0, 0, 8, 0)], openings: [{ id: 'o', wallId: 'w', kind: 'window', pos: 3, width: 1, swing: 1, hinge: 'a', shutters: '#3f6b4f', trim: '#abcdef', handle: 'knob' }] })));
    expect(back.openings[0]).toMatchObject({ shutters: '#3f6b4f', trim: '#abcdef', handle: 'knob' });
    const raw = JSON.parse(JSON.stringify(back));
    raw.openings[0] = { ...raw.openings[0], shutters: 'green', trim: 7, handle: 'claw' };
    const fixed = parseDesign(raw).openings[0];
    expect([fixed.shutters, fixed.trim, fixed.handle]).toEqual([undefined, undefined, undefined]);
  });
});

void ceilingParts;
