import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { areaReport, reportToCsv, reportToText } from './areas';
import { findIssues } from './checks';
import { findItems } from './find';
import { createDesign, parseDesign, type Design, type Opening, type Room, type Wall } from './model';
import { removeRefs } from './selection';
import { deleteSnapshot, diffCount, diffDesigns, loadSnapshots, saveSnapshot, snapshotDesign } from './snapshots';
import { calibrateTrace } from './trace';
import { sceneChunks } from './view3d/build';
import { partsBounds, type Part } from './view3d/parts';

const wall = (id: string, ax: number, ay: number, bx: number, by: number, extra: Partial<Wall> = {}): Wall => ({ id, floor: 'f', a: { x: ax, y: ay }, b: { x: bx, y: by }, thickness: 0.3, type: 'exterior', height: 2.5, ...extra });
const room = (id: string, x0: number, y0: number, x1: number, y1: number, extra: Partial<Room> = {}): Room => ({ id, floor: 'f', name: id, color: '#eee', material: 'plain', living: true, points: [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }], ...extra });
const op = (id: string, wallId: string, kind: Opening['kind'], pos: number, width = 1, extra: Partial<Opening> = {}): Opening => ({ id, wallId, kind, pos, width, swing: 1, hinge: 'a', ...extra });
function base(): Design {
  const d = createDesign();
  d.floors[0].id = 'f';
  return d;
}

describe('the new fields are saved and repaired', () => {
  it('groups, room type and ceiling, opening heights, arch and frame, floor trace', () => {
    const d = base();
    d.walls.push(wall('w', 0, 0, 6, 0));
    d.openings.push(op('o', 'w', 'window', 3, 1.2, { sill: 0.5, head: 2.4, arch: true, frame: '#112233' }));
    d.rooms.push(room('r', 0, 0, 4, 4, { type: 'bedroom', ceiling: 2.7 }), room('s', 4, 0, 8, 4));
    d.furniture.push({ id: 'f1', floor: 'f', type: 'sofa', x: 1, y: 1, w: 2, d: 1, rotation: 0, color: '#ccc', label: '' });
    d.groups.push({ id: 'g', name: 'Lounge', refs: [{ kind: 'room', id: 'r' }, { kind: 'furniture', id: 'f1' }] });
    d.floors[0].trace = { x: 3, y: 2, w: 12, rotation: 10, opacity: 0.4, visible: false };
    const back = parseDesign(JSON.parse(JSON.stringify(d)));
    expect(back.openings[0]).toMatchObject({ sill: 0.5, head: 2.4, arch: true, frame: '#112233' });
    expect(back.rooms[0]).toMatchObject({ type: 'bedroom', ceiling: 2.7 });
    expect(back.groups).toEqual(d.groups);
    expect(back.floors[0].trace).toEqual({ x: 3, y: 2, w: 12, rotation: 10, opacity: 0.4, visible: false });

    const raw = JSON.parse(JSON.stringify(d));
    raw.openings[0] = { ...raw.openings[0], sill: 'low', head: 99, arch: 'yes', frame: 'red' };
    raw.rooms[0] = { ...raw.rooms[0], type: 'dungeon', ceiling: 99 };
    raw.groups = [{ id: 'x', refs: [{ kind: 'room', id: 'r' }] }, { id: 'y', refs: [{ kind: 'opening', id: 'o' }, { kind: 'room', id: 'r' }, { kind: 'furniture', id: 'f1' }, 'junk'] }, 'junk'];
    raw.floors[0].trace = { w: -4, opacity: 7 };
    const fixed = parseDesign(raw);
    expect(fixed.openings[0].sill).toBeUndefined();
    expect(fixed.openings[0].head).toBe(6);
    expect(fixed.openings[0].arch).toBeUndefined();
    expect(fixed.openings[0].frame).toBeUndefined();
    expect(fixed.rooms[0].type).toBeUndefined();
    expect(fixed.rooms[0].ceiling).toBe(12);
    expect(fixed.groups).toHaveLength(1); // one member is not a group; an opening cannot be in one
    expect(fixed.groups[0].refs).toEqual([{ kind: 'room', id: 'r' }, { kind: 'furniture', id: 'f1' }]);
    expect(fixed.floors[0].trace).toMatchObject({ w: 0.1, opacity: 1, visible: true });
    // a design from before any of this
    const old = JSON.parse(JSON.stringify(createDesign()));
    delete old.groups;
    expect(parseDesign(old).groups).toEqual([]);
  });

  it('removing items takes them out of their groups, and a group of one is no group', () => {
    const d = base();
    d.rooms.push(room('r', 0, 0, 1, 1), room('s', 2, 0, 3, 1), room('t', 4, 0, 5, 1));
    d.groups.push({ id: 'g', name: 'G', refs: [{ kind: 'room', id: 'r' }, { kind: 'room', id: 's' }, { kind: 'room', id: 't' }] });
    removeRefs(d, [{ kind: 'room', id: 's' }]);
    expect(d.groups[0].refs.map((r) => r.id)).toEqual(['r', 't']);
    removeRefs(d, [{ kind: 'room', id: 'r' }]);
    expect(d.groups).toEqual([]);
  });
});

describe('find', () => {
  const d = base();
  d.walls.push(wall('w', 0, 0, 8, 0, { type: 'interior' }));
  d.openings.push(op('win', 'w', 'window', 2), op('door', 'w', 'door', 5));
  d.rooms.push(room('r', 0, 0, 4, 4, { name: 'Kitchen', type: 'kitchen' }), room('s', 4, 0, 8, 4, { name: 'Bedroom 1', type: 'bedroom' }));
  d.furniture.push({ id: 'f1', floor: 'f', type: 'sofa', x: 6, y: 2, w: 2, d: 1, rotation: 0, color: '#ccc', label: 'Grey sofa' });
  d.labels.push({ id: 'l', floor: 'f', text: 'Kitchen island here', x: 1, y: 1, size: 0.2, rotation: 0, color: '#000' });
  d.floors.push({ id: 'up', name: '1st floor' });
  d.rooms.push(room('u', 0, 0, 4, 4, { name: 'Study', floor: 'up', type: 'office' }));

  it('by name, by kind, and on one floor', () => {
    expect(findItems(d, 'kitchen').map((f) => f.ref.id).sort()).toEqual(['l', 'r']);
    expect(findItems(d, 'kitchen', 'room').map((f) => f.ref.id)).toEqual(['r']);
    expect(findItems(d, 'window', 'opening')).toHaveLength(1);
    expect(findItems(d, '', 'opening')).toHaveLength(2);
    expect(findItems(d, 'sofa')[0].label).toBe('Grey sofa');
    expect(findItems(d, 'bedroom')[0].what).toBe('Bedroom');
    expect(findItems(d, 'study')[0]).toMatchObject({ floor: 'up', floorName: '1st floor' });
    expect(findItems(d, '', 'room', 'f')).toHaveLength(2);
    expect(findItems(d, 'kitchen grey')).toEqual([]); // every word has to match
    expect(findItems(d, 'zzz')).toEqual([]);
  });

  it('an opening is found where its wall is', () => {
    const win = findItems(d, 'window', 'opening')[0];
    expect(win.at.x).toBeCloseTo(2);
    expect(win.floor).toBe('f');
  });
});

describe('snapshots and comparing', () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('keeps named copies per design, newest first, and gives them back', () => {
    const d = base();
    d.walls.push(wall('w', 0, 0, 5, 0));
    expect(saveSnapshot(d, 'Before', 1000)).toBe(true);
    d.walls.push(wall('v', 5, 0, 5, 5));
    expect(saveSnapshot(d, '  ', 2000)).toBe(true);
    const list = loadSnapshots(d.id);
    expect(list.map((s) => s.name)).toEqual(['Snapshot', 'Before']);
    expect(snapshotDesign(list[1])!.walls).toHaveLength(1);
    expect(snapshotDesign(list[0])!.walls).toHaveLength(2);
    expect(loadSnapshots('other')).toEqual([]);
    deleteSnapshot(d.id, list[1].id);
    expect(loadSnapshots(d.id)).toHaveLength(1);
    store.set(`perfect-home:snapshots:${d.id}`, 'junk');
    expect(loadSnapshots(d.id)).toEqual([]);
  });

  it('says what was added, changed and removed since', () => {
    const older = base();
    older.walls.push(wall('a', 0, 0, 5, 0), wall('b', 5, 0, 5, 5), wall('c', 5, 5, 0, 5));
    older.rooms.push(room('r', 0, 0, 5, 5));
    older.openings.push(op('o', 'a', 'door', 2));
    const newer = JSON.parse(JSON.stringify(older)) as Design;
    newer.walls.splice(2, 1); // c removed
    newer.walls[0].thickness = 0.4; // a changed
    newer.walls.push(wall('d', 0, 5, 0, 0)); // d added
    newer.openings[0].pos = 3; // an opening changed: it is shown where its wall is
    const diff = diffDesigns(older, newer);
    expect(diff.added.map((e) => e.ref.id)).toEqual(['d']);
    expect(diff.removed.map((e) => e.ref.id)).toEqual(['c']);
    expect(diff.changed.map((e) => e.ref.id).sort()).toEqual(['a', 'o']);
    expect(diff.changed.find((e) => e.ref.id === 'o')!.box).not.toBeNull();
    expect(diffCount(diff)).toBe(4);
    expect(diffCount(diffDesigns(older, JSON.parse(JSON.stringify(older))))).toBe(0);
  });
});

describe('a picture to trace', () => {
  it('is made the right size about a point: a measurement of 2 m that is 4 m on the plan halves it', () => {
    const next = calibrateTrace({ x: 10, y: 10, w: 20 }, { x: 0, y: 0 }, { x: 4, y: 0 }, 2)!;
    expect(next).toEqual({ x: 5, y: 5, w: 10 });
    expect(calibrateTrace({ x: 0, y: 0, w: 5 }, { x: 1, y: 1 }, { x: 1, y: 1 }, 2)).toBeNull();
    expect(calibrateTrace({ x: 0, y: 0, w: 5 }, { x: 0, y: 0 }, { x: 1, y: 0 }, 0)).toBeNull();
  });
});

describe('what a room is for', () => {
  const house = () => {
    const d = base();
    d.walls.push(wall('n', 0, 0, 4, 0), wall('e', 4, 0, 4, 4), wall('s', 4, 4, 0, 4), wall('w', 0, 4, 0, 0));
    return d;
  };
  const kinds = (d: Design) => findIssues(d, 'f').map((i) => i.kind);

  it('a bedroom with no window, and one that is too small, are flagged; rooms with no type are left alone', () => {
    const d = house();
    d.rooms.push(room('r', 0.15, 0.15, 3.85, 3.85, { type: 'bedroom' }));
    expect(kinds(d)).toContain('no-window');
    d.openings.push(op('win', 'n', 'window', 2, 1.2));
    expect(kinds(d)).not.toContain('no-window');
    d.rooms[0].type = undefined;
    d.openings = [];
    expect(kinds(d)).toEqual([]);
    d.rooms[0].type = 'bathroom'; // does not need daylight
    expect(kinds(d)).not.toContain('no-window');
    d.rooms[0] = room('r', 0.15, 0.15, 2, 2, { type: 'bedroom' });
    expect(kinds(d)).toContain('small-room');
  });

  it('a window of another room, or one far from this room, does not count; glass doors do', () => {
    const d = house();
    d.walls.push(wall('far', 20, 0, 24, 0));
    d.rooms.push(room('r', 0.15, 0.15, 3.85, 3.85, { type: 'living' }));
    d.openings.push(op('w', 'far', 'window', 2, 1.2));
    expect(kinds(d)).toContain('no-window');
    d.openings.push(op('g', 'e', 'french', 2, 1.6));
    expect(kinds(d)).not.toContain('no-window');
  });

  it('a low ceiling is flagged', () => {
    const d = house();
    d.rooms.push(room('r', 0.15, 0.15, 3.85, 3.85, { type: 'storage', ceiling: 1.9 }));
    expect(kinds(d)).not.toContain('low-ceiling');
    d.rooms[0].type = 'office';
    d.openings.push(op('w', 'n', 'window', 2, 1.2));
    expect(kinds(d)).toContain('low-ceiling');
  });

  it('the area table shows the type, ceiling and volume', () => {
    const d = house();
    d.rooms.push(room('r', 0, 0, 4, 4, { name: 'Main bedroom', type: 'bedroom', ceiling: 3 }), room('s', 4, 0, 6, 4));
    const r = areaReport(d).floors[0].rooms;
    expect(r[0]).toMatchObject({ type: 'bedroom', ceiling: 3 });
    expect(r[0].volume).toBeCloseTo(48);
    expect(r[1].ceiling).toBe(2.5);
    expect(reportToText(areaReport(d), 'X')).toContain('Main bedroom [Bedroom]: 16.00 m²');
    expect(reportToCsv(areaReport(d))).toContain('Main bedroom,16.00,yes,Bedroom,3.00,48.0');
  });
});

describe('doors and windows with their own heights, a round top and a frame color', () => {
  const one = (extra: Partial<Opening>, kind: Opening['kind'] = 'window'): Part[] => {
    const d = base();
    d.walls.push(wall('w', 0, 0, 8, 0, { height: 2.6 }));
    d.openings.push(op('o', 'w', kind, 4, 1.2, extra));
    return sceneChunks(d).find((c) => c.key === 'wall:w')!.make();
  };
  const glassBottom = (parts: Part[]) => Math.min(...parts.filter((p) => p.t === 'box' && p.glass && Math.abs(p.x - 4) < 0.7).map((p) => (p.t === 'box' ? p.y - p.sy / 2 : 9)));
  const glassTop = (parts: Part[]) => Math.max(...parts.filter((p) => p.t === 'box' && p.glass && Math.abs(p.x - 4) < 0.7).map((p) => (p.t === 'box' ? p.y + p.sy / 2 : -9)));

  it('a sill height and a lintel height move the glass', () => {
    expect(glassBottom(one({}))).toBeCloseTo(0.9 + 0.03, 1);
    expect(glassBottom(one({ sill: 0.4 }))).toBeCloseTo(0.4 + 0.03, 1);
    expect(glassTop(one({ head: 1.8 }))).toBeLessThan(1.8);
    expect(glassTop(one({ head: 2.4 }))).toBeGreaterThan(2.2);
  });

  it('an arch is a half circle on top: wall pieces beside the curve, glass inside it, and the glass reaches the head', () => {
    const plain = one({ head: 2.2 });
    const arched = one({ head: 2.2, arch: true });
    expect(arched.length).toBeGreaterThan(plain.length + 10);
    expect(glassTop(arched)).toBeGreaterThan(2.1);
    expect(glassTop(arched)).toBeLessThanOrEqual(2.2 + 1e-6);
    // the glass narrows towards the top
    const widths = arched.filter((p) => p.t === 'box' && p.glass && p.y > 1.8).map((p) => (p.t === 'box' ? p.sx : 0));
    expect(Math.min(...widths)).toBeLessThan(Math.max(...widths) - 0.3);
    // a door with an arch has its fanlight in the arch, the leaf below
    const door = one({ arch: true }, 'door');
    expect(door.filter((p) => p.glass).length).toBeGreaterThan(5);
    expect(partsBounds(door).maxY).toBeLessThanOrEqual(2.6 + 1e-6);
    // too low for an arch: it is just a plain opening
    expect(one({ head: 1.0, sill: 0.5, arch: true }).length).toBe(one({ head: 1.0, sill: 0.5 }).length);
  });

  it('the frame takes the color you chose', () => {
    expect(one({}).some((p) => p.color === '#112233')).toBe(false);
    expect(one({ frame: '#112233' }).filter((p) => p.color === '#112233').length).toBeGreaterThan(3);
  });
});
