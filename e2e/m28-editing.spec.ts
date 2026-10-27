import { test, expect, type Page } from '@playwright/test';
import { clickAt, design, dragWorld, fresh } from './helpers';

/* eslint-disable @typescript-eslint/no-explicit-any */

test.beforeEach(async ({ page }) => {
  await fresh(page);
});

async function edit(page: Page, body: string) {
  await page.evaluate(`window.__ph.design.getState().update((d) => { ${body} })`);
}
const select = (page: Page, refs: { kind: string; id: string }[]) => page.evaluate((r) => (window as any).__ph.ui.getState().setSelected(r), refs);
const fill = async (page: Page, testId: string, value: string) => {
  await page.getByTestId(testId).fill(value);
  await page.getByTestId(testId).press('Enter');
};

const box = `
  const F = d.floors[0].id;
  const w = (id, ax, ay, bx, by) => d.walls.push({ id, floor: F, a: { x: ax, y: ay }, b: { x: bx, y: by }, thickness: 0.2, type: 'interior', height: 2.5 });
  w('n', 2, 2, 10, 2); w('e', 10, 2, 10, 7); w('s', 10, 7, 2, 7); w('w', 2, 7, 2, 2);
`;

test('mirror: a selection (key H) and a whole floor turn over, and undo puts them back', async ({ page }) => {
  await edit(page, `${box} d.furniture.push({ id: 'sofa', floor: F, type: 'sofa', x: 3, y: 3, w: 2, d: 1, rotation: 90, color: '#9ca3af', label: '' });`);
  await page.getByTestId('mirror-floor-x').click();
  let d = await design(page);
  const sofa = () => d.furniture.find((f: any) => f.id === 'sofa');
  expect(sofa().x).toBeCloseTo(9, 1); // 3 on the left side becomes 9 on the right
  expect(sofa().rotation).toBe(270);
  expect(d.walls.find((w: any) => w.id === 'w').a.x).toBeCloseTo(10);
  await page.keyboard.press('Control+z');
  d = await design(page);
  expect(sofa().x).toBe(3);
  // top to bottom, with the key: one item turns about its own middle
  await page.getByTestId('tool-select').click();
  await clickAt(page, 3, 3);
  await page.keyboard.press('Shift+H');
  d = await design(page);
  expect(sofa()).toMatchObject({ x: 3, y: 3, rotation: 90 });
  await page.keyboard.press('h');
  d = await design(page);
  expect(sofa().rotation).toBe(270);
  // the whole floor, top to bottom
  await page.getByTestId('mirror-floor-y').click();
  d = await design(page);
  expect(sofa().y).toBeCloseTo(5.9, 1); // 6 = as far from the bottom as it was from the top, then the wall pushes the 2 m long sofa 10 cm back
  expect(d.walls.find((w: any) => w.id === 'n').a.y).toBeCloseTo(7);
});

test('group things so they move as one, and keep an arrangement as a template', async ({ page }) => {
  await edit(page, `${box}
    d.furniture.push({ id: 'bed', floor: F, type: 'bed-double', x: 4, y: 4, w: 1.6, d: 2, rotation: 0, color: '#bfdbfe', label: '' });
    d.furniture.push({ id: 'table', floor: F, type: 'bedside-table', x: 5.3, y: 3.3, w: 0.5, d: 0.5, rotation: 0, color: '#d6c2a8', label: '' });
    d.furniture.push({ id: 'lamp', floor: F, type: 'bedside-table', x: 8, y: 6, w: 0.5, d: 0.5, rotation: 0, color: '#d6c2a8', label: '' });`);
  await page.keyboard.press('Control+a');
  await select(page, [{ kind: 'furniture', id: 'bed' }, { kind: 'furniture', id: 'table' }]);
  await page.keyboard.press('Control+g');
  expect((await design(page)).groups).toHaveLength(1);
  await page.getByTestId('tool-select').click();
  await page.keyboard.press('Escape');
  // clicking one of them selects both; dragging moves both
  await clickAt(page, 4, 4.4);
  expect(await page.evaluate(() => (window as any).__ph.ui.getState().selected.length)).toBe(2);
  await dragWorld(page, [4, 4.4], [4, 5.4]);
  let d = await design(page);
  expect(d.furniture.find((f: any) => f.id === 'bed').y).toBeCloseTo(5, 1);
  expect(d.furniture.find((f: any) => f.id === 'table').y).toBeCloseTo(4.3, 1);
  expect(d.furniture.find((f: any) => f.id === 'lamp').y).toBe(6);
  // a template of the group
  await page.getByTestId('template-name').fill('Bed with table');
  await page.getByTestId('template-save').click();
  await expect(page.getByTestId('templates')).toBeVisible();
  const before = d.furniture.length;
  await page.getByTestId('template-place').click();
  d = await design(page);
  expect(d.furniture.length).toBe(before + 2);
  expect(d.groups).toHaveLength(2); // the new pair is a group too
  // ungroup
  await select(page, [{ kind: 'furniture', id: 'bed' }, { kind: 'furniture', id: 'table' }]);
  await page.keyboard.press('Control+Shift+g');
  expect((await design(page)).groups).toHaveLength(1);
});

test('wall tools: cut, join, meet at a corner, chamfer and round, bulk changes', async ({ page }) => {
  await edit(page, `
    const F = d.floors[0].id;
    const w = (id, ax, ay, bx, by) => d.walls.push({ id, floor: F, a: { x: ax, y: ay }, b: { x: bx, y: by }, thickness: 0.2, type: 'interior', height: 2.5 });
    w('a', 2, 2, 10, 2); w('b', 10, 2, 10, 7); w('c', 2, 9, 7, 9); w('d', 8, 8.5, 12, 8.5);
    d.openings.push({ id: 'door', wallId: 'a', kind: 'door', pos: 6.5, width: 1, swing: 1, hinge: 'a' });`);
  // cut in two and join again
  await select(page, [{ kind: 'wall', id: 'a' }]);
  await page.getByTestId('wall-split-at').fill('300');
  await page.getByTestId('wall-split-at').press('Enter');
  let d = await design(page);
  expect(d.walls.filter((w: any) => w.floor === d.floors[0].id)).toHaveLength(5);
  expect(d.walls[0].b.x).toBeCloseTo(5);
  expect(d.openings[0].wallId).not.toBe('a'); // the door is on the second piece
  const second = d.walls[1].id;
  await select(page, [{ kind: 'wall', id: 'a' }, { kind: 'wall', id: second }]);
  await page.getByTestId('walls-join').click();
  d = await design(page);
  expect(d.walls).toHaveLength(4);
  expect(d.walls[0].b.x).toBeCloseTo(10);
  expect(d.openings[0]).toMatchObject({ wallId: 'a', pos: 6.5 });
  // two walls that miss each other meet in a corner
  await select(page, [{ kind: 'wall', id: 'c' }, { kind: 'wall', id: 'd' }]);
  await page.getByTestId('walls-parallel').click();
  d = await design(page);
  expect(d.walls.find((w: any) => w.id === 'd').b.y).toBeCloseTo(d.walls.find((w: any) => w.id === 'd').a.y);
  // a corner cut off, and rounded
  await select(page, [{ kind: 'wall', id: 'a' }, { kind: 'wall', id: 'b' }]);
  await fill(page, 'corner-size', '100');
  await page.getByTestId('corner-chamfer').click();
  d = await design(page);
  expect(d.walls).toHaveLength(5);
  expect(d.walls[0].b.x).toBeCloseTo(9);
  await page.keyboard.press('Control+z');
  await select(page, [{ kind: 'wall', id: 'a' }, { kind: 'wall', id: 'b' }]);
  await page.getByTestId('corner-round').click();
  d = await design(page);
  expect(d.walls[d.walls.length - 1].bulge).toBeTruthy();
  // change several walls at once
  await select(page, [{ kind: 'wall', id: 'a' }, { kind: 'wall', id: 'b' }, { kind: 'wall', id: 'c' }]);
  await fill(page, 'bulk-thickness', '30');
  d = await design(page);
  expect(['a', 'b', 'c'].map((id) => d.walls.find((w: any) => w.id === id).thickness)).toEqual([0.3, 0.3, 0.3]);
  await page.getByTestId('bulk-wall-type').selectOption('partition');
  d = await design(page);
  expect(d.walls.find((w: any) => w.id === 'c')).toMatchObject({ type: 'partition', thickness: 0.1 });
});

test('walls that miss each other can be made to meet, and offset or thickened keeping a face', async ({ page }) => {
  await edit(page, `
    const F = d.floors[0].id;
    d.walls.push({ id: 'a', floor: F, a: { x: 2, y: 2 }, b: { x: 8, y: 2 }, thickness: 0.2, type: 'interior', height: 2.5 });
    d.walls.push({ id: 'b', floor: F, a: { x: 10, y: 3 }, b: { x: 10, y: 8 }, thickness: 0.2, type: 'interior', height: 2.5 });`);
  await select(page, [{ kind: 'wall', id: 'a' }, { kind: 'wall', id: 'b' }]);
  await page.getByTestId('walls-meet').click();
  let d = await design(page);
  expect(d.walls[0].b).toEqual({ x: 10, y: 2 });
  expect(d.walls[1].a).toEqual({ x: 10, y: 2 });
  // thicker, the left face stays: the middle moves right (down on the plan for a wall that runs left to right)
  await select(page, [{ kind: 'wall', id: 'a' }]);
  await page.getByTestId('wall-keep').selectOption('l');
  await fill(page, 'wall-thickness', '40');
  d = await design(page);
  expect(d.walls[0].thickness).toBeCloseTo(0.4);
  expect(d.walls[0].a.y).toBeCloseTo(2.1);
  await fill(page, 'wall-offset', '-50');
  d = await design(page);
  expect(d.walls[0].a.y).toBeCloseTo(1.6);
});

test('resizing: scale a whole floor, and stretch a part of it', async ({ page }) => {
  await edit(page, `${box} d.furniture.push({ id: 'sofa', floor: F, type: 'sofa', x: 9, y: 4, w: 2, d: 1, rotation: 0, color: '#9ca3af', label: '' });
    d.openings.push({ id: 'door', wallId: 's', kind: 'door', pos: 4, width: 1, swing: 1, hinge: 'a' });`);
  await fill(page, 'scale-percent', '150');
  await page.getByTestId('scale-floor').click();
  let d = await design(page);
  const len = (w: any) => Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y);
  expect(len(d.walls[0])).toBeCloseTo(12, 1); // 8 m × 1.5
  expect(d.walls[0].thickness).toBe(0.2);
  expect(d.furniture[0].w).toBe(2);
  await page.keyboard.press('Control+z');
  d = await design(page);
  expect(len(d.walls[0])).toBeCloseTo(8, 1);
  // stretch: a box round the east wall pulled 3 m to the right
  await page.keyboard.press('x');
  await dragWorld(page, [9, 1], [11, 8]);
  await dragWorld(page, [10, 4.5], [13, 4.5]);
  d = await design(page);
  const east = d.walls.find((w: any) => w.id === 'e');
  expect(east.a.x).toBeCloseTo(13);
  expect(d.walls.find((w: any) => w.id === 'n').b.x).toBeCloseTo(13);
  expect(d.walls.find((w: any) => w.id === 'n').a.x).toBeCloseTo(2);
  expect(d.furniture[0].x).toBeCloseTo(12); // the sofa was in the box: it came along
  expect(d.openings[0].pos).toBeCloseTo(4); // the door on the south wall stays where it is along it
  await page.keyboard.press('Escape');
});

test('find things by name or kind, and select all of a kind', async ({ page }) => {
  await edit(page, `${box}
    d.rooms.push({ id: 'k', floor: F, name: 'Kitchen', color: '#fde68a', material: 'tile', living: true, points: [{ x: 2.1, y: 2.1 }, { x: 6, y: 2.1 }, { x: 6, y: 6.9 }, { x: 2.1, y: 6.9 }] });
    d.openings.push({ id: 'w1', wallId: 'n', kind: 'window', pos: 2, width: 1.2, swing: 1, hinge: 'a' }, { id: 'w2', wallId: 'n', kind: 'window', pos: 5, width: 1.2, swing: 1, hinge: 'a' }, { id: 'd1', wallId: 's', kind: 'door', pos: 3, width: 1, swing: 1, hinge: 'a' });
    d.floors.push({ id: 'up', name: '1st floor' });
    d.rooms.push({ id: 'b', floor: 'up', name: 'Bedroom', color: '#bfdbfe', material: 'carpet', living: true, points: [{ x: 2.1, y: 2.1 }, { x: 6, y: 2.1 }, { x: 6, y: 6.9 }, { x: 2.1, y: 6.9 }] });`);
  await page.keyboard.press('Control+f');
  await expect(page.getByTestId('find-dialog')).toBeVisible();
  await page.getByTestId('find-query').fill('kitchen');
  await expect(page.getByTestId('find-count')).toHaveText('1 found');
  await page.getByTestId('find-query').fill('bedroom');
  await page.getByTestId('find-item').first().click(); // jumps to the first floor and selects it
  expect((await page.evaluate(() => (window as any).__ph.ui.getState().selection))).toMatchObject({ kind: 'room', id: 'b' });
  expect(await page.evaluate(() => (window as any).__ph.ui.getState().activeFloor)).toBe('up');
  // all windows on a floor
  await page.evaluate(() => (window as any).__ph.ui.getState().setActiveFloor((window as any).__ph.design.getState().design.floors[0].id));
  await page.keyboard.press('Control+f');
  await page.getByTestId('find-kind').selectOption('opening');
  await page.getByTestId('find-query').fill('window');
  await expect(page.getByTestId('find-count')).toHaveText('2 found');
  await page.getByTestId('find-select-all').click();
  expect(await page.evaluate(() => (window as any).__ph.ui.getState().selected.length)).toBe(2);
  // from one item: select all like it
  await select(page, [{ kind: 'opening', id: 'd1' }]);
  await page.getByTestId('select-like').click();
  expect(await page.evaluate(() => (window as any).__ph.ui.getState().selected.length)).toBe(1);
  await select(page, [{ kind: 'opening', id: 'w1' }]);
  await page.getByTestId('select-like').click();
  expect(await page.evaluate(() => (window as any).__ph.ui.getState().selected.length)).toBe(2);
});

test('rooms: the table, types that the plan check understands, split and merge', async ({ page }) => {
  await edit(page, `${box}
    d.rooms.push({ id: 'r1', floor: F, name: 'Room 1', color: '#fde68a', material: 'plain', living: true, points: [{ x: 2.1, y: 2.1 }, { x: 6, y: 2.1 }, { x: 6, y: 6.9 }, { x: 2.1, y: 6.9 }] });
    d.rooms.push({ id: 'r2', floor: F, name: 'Room 2', color: '#bfdbfe', material: 'plain', living: true, points: [{ x: 6, y: 2.1 }, { x: 9.9, y: 2.1 }, { x: 9.9, y: 6.9 }, { x: 6, y: 6.9 }] });`);
  await page.getByTestId('view-menu').click();
  await page.getByTestId('menu-rooms').click();
  await expect(page.getByTestId('rooms-dialog')).toBeVisible();
  await page.getByTestId('room-name-0').fill('Main bedroom');
  await page.getByTestId('room-name-0').press('Enter');
  await page.getByTestId('room-type-0').selectOption('bedroom');
  await page.getByTestId('bulk-material').selectOption('wood');
  await fill(page, 'bulk-ceiling', '260');
  let d = await design(page);
  expect(d.rooms[0]).toMatchObject({ name: 'Main bedroom', type: 'bedroom', material: 'wood', ceiling: 2.6 });
  expect(d.rooms[1]).toMatchObject({ material: 'wood', ceiling: 2.6 });
  await page.getByRole('button', { name: 'Done' }).click();
  // a bedroom with no window shows in the plan check
  await page.getByTestId('checks-toggle').check();
  await expect(page.getByTestId('issue-count')).toContainText('to look at');
  await edit(page, `d.openings.push({ id: 'w', wallId: 'n', kind: 'window', pos: 2, width: 1.2, swing: 1, hinge: 'a' });`);
  await expect(page.getByTestId('issue-count')).toHaveText('all clear');
  // merge
  await select(page, [{ kind: 'room', id: 'r1' }, { kind: 'room', id: 'r2' }]);
  await page.getByTestId('rooms-merge').click();
  d = await design(page);
  expect(d.rooms).toHaveLength(1);
  // split with a line through the middle
  await page.getByTestId('tool-select').click();
  await clickAt(page, 4, 4);
  await page.getByTestId('room-split').click();
  await clickAt(page, 6, 1);
  await clickAt(page, 6, 8);
  d = await design(page);
  expect(d.rooms).toHaveLength(2);
  const area = (r: any) => Math.abs(r.points.reduce((s: number, p: any, i: number) => s + (p.x * r.points[(i + 1) % r.points.length].y - r.points[(i + 1) % r.points.length].x * p.y), 0)) / 2;
  expect(area(d.rooms[0])).toBeCloseTo(area(d.rooms[1]), 0);
});

test('doors and windows: sill and lintel heights, an arch, a frame color, even spacing', async ({ page }) => {
  await edit(page, `${box}
    d.openings.push({ id: 'a', wallId: 'n', kind: 'window', pos: 1, width: 1, swing: 1, hinge: 'a' }, { id: 'b', wallId: 'n', kind: 'window', pos: 2, width: 1, swing: 1, hinge: 'a' }, { id: 'c', wallId: 'n', kind: 'window', pos: 7, width: 1, swing: 1, hinge: 'a' });`);
  await select(page, [{ kind: 'opening', id: 'a' }]);
  await fill(page, 'opening-sill', '40');
  await fill(page, 'opening-head', '230');
  await page.getByTestId('opening-arch').check();
  await page.getByLabel('Color #6b4a2f').first().click();
  let d = await design(page);
  expect(d.openings[0]).toMatchObject({ sill: 0.4, head: 2.3, arch: true, frame: '#6b4a2f' });
  await page.getByTestId('opening-heights-reset').click();
  await page.getByTestId('opening-frame-reset').click();
  d = await design(page);
  expect(d.openings[0].sill).toBeUndefined();
  expect(d.openings[0].frame).toBeUndefined();
  // spread the three evenly along the wall
  await select(page, [{ kind: 'wall', id: 'n' }]);
  await page.getByTestId('wall-space').click();
  d = await design(page);
  const pos = d.openings.map((o: any) => o.pos);
  expect(pos[0]).toBeCloseTo(8 / 4 * 1 - 0.5 + 0.5 + 0, 0); // gap = (8 - 3) / 4 = 1.25, so the first is centred at 1.75
  expect(pos[1] - pos[0]).toBeCloseTo(2.25);
  expect(pos[2] - pos[1]).toBeCloseTo(2.25);
  // several selected: the group panel spaces them too
  await select(page, [{ kind: 'opening', id: 'a' }, { kind: 'opening', id: 'b' }]);
  await expect(page.getByTestId('openings-space')).toBeVisible();
});

test('stairs: landing, winder and ladder, and steps in the first flight', async ({ page }) => {
  await edit(page, `${box} d.stairs.push({ id: 'st', floor: F, kind: 'straight', x: 4, y: 4.5, w: 1, d: 4, rotation: 0, steps: 16, rise: 2.8, flip: false });`);
  await clickAt(page, 4, 4.5);
  for (const kind of ['landing', 'winder', 'ladder', 'l', 'u'] as const) {
    await page.getByTestId('stair-kind').selectOption(kind);
    expect((await design(page)).stairs[0].kind).toBe(kind);
  }
  await page.getByTestId('stair-kind').selectOption('l');
  await fill(page, 'stair-first-flight', '5');
  expect((await design(page)).stairs[0].firstFlight).toBe(5);
  await page.getByTestId('stair-kind').selectOption('ladder');
  await expect(page.getByTestId('stair-first-flight')).toHaveCount(0);
  await expect(page.getByTestId('stair-check')).toContainText(/ladder/i);
  // they show in 3D
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__ph3d?.stats().meshes ?? 0)).toBeGreaterThan(10);
});

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

test('trace a picture: add it, size it from a measurement, move, fade, remove', async ({ page }) => {
  await page.getByTestId('trace-file').setInputFiles({ name: 'plan.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.getByTestId('trace-box')).toBeVisible();
  let d = await design(page);
  expect(d.floors[0].trace).toMatchObject({ visible: true, rotation: 0 });
  const key = `perfect-home:trace:${d.id}:${d.floors[0].id}`;
  expect(await page.evaluate((k) => localStorage.getItem(k), key)).toMatch(/^data:image\/jpeg/);
  // it is drawn on the plan (a Konva image in the 'underlay' group)
  await expect.poll(() => page.evaluate(() => (window as any).__ph.stage().find('Image').length)).toBe(1);
  // size it: a measurement of 4 m on the plan is really 2 m
  const w0 = d.floors[0].trace.w;
  await edit(page, `d.dimensions.push({ id: 'm', floor: d.floors[0].id, a: { x: 0, y: 0 }, b: { x: 4, y: 0 } });`);
  await select(page, [{ kind: 'dimension', id: 'm' }]);
  await page.evaluate(() => (window as any).__ph.ui.getState().select({ kind: 'dimension', id: 'm' }));
  await fill(page, 'trace-known', '2');
  await page.getByTestId('trace-calibrate').click();
  d = await design(page);
  expect(d.floors[0].trace.w).toBeCloseTo(w0 / 2, 3);
  await page.getByTestId('trace-opacity').fill('80');
  expect((await design(page)).floors[0].trace.opacity).toBeCloseTo(0.8);
  await page.getByTestId('trace-visible').uncheck();
  await expect.poll(() => page.evaluate(() => (window as any).__ph.stage().find('Image').length)).toBe(0);
  await page.getByTestId('trace-remove').click();
  d = await design(page);
  expect(d.floors[0].trace).toBeUndefined();
  expect(await page.evaluate((k) => localStorage.getItem(k), key)).toBeNull();
});

test('snapshots: keep the plan, change it, see what is different, go back', async ({ page }) => {
  await edit(page, `${box}`);
  await page.getByTestId('file-menu').click();
  await page.getByTestId('menu-snapshots').click();
  await page.getByTestId('snapshot-name').fill('Four walls');
  await page.getByTestId('snapshot-take').click();
  await expect(page.getByTestId('snapshot-row')).toHaveCount(1);
  await page.getByRole('button', { name: 'Close' }).click();
  await edit(page, `d.walls.push({ id: 'x', floor: d.floors[0].id, a: { x: 0, y: 0 }, b: { x: 2, y: 0 }, thickness: 0.2, type: 'interior', height: 2.5 }); d.walls[0].thickness = 0.4;`);
  await page.getByTestId('file-menu').click();
  await page.getByTestId('menu-snapshots').click();
  await page.getByTestId('snapshot-compare').click();
  await expect(page.getByTestId('compare-result')).toContainText('1 added');
  await expect(page.getByTestId('compare-result')).toContainText('1 changed');
  // the differences are drawn on the plan
  await expect.poll(() => page.evaluate(() => (window as any).__ph.ui.getState().compare?.diff.added.length)).toBe(1);
  await page.getByTestId('snapshot-restore').click();
  expect((await design(page)).walls).toHaveLength(4);
  expect((await design(page)).walls[0].thickness).toBe(0.2);
  await page.keyboard.press('Control+z'); // the plan before going back is one undo away
  expect((await design(page)).walls).toHaveLength(5);
});
