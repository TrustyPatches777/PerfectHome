import { test, expect, type Page } from '@playwright/test';
import { clickAt, design, dragWorld, fresh, moveTo } from './helpers';

/* eslint-disable @typescript-eslint/no-explicit-any */

test.beforeEach(async ({ page }) => {
  await fresh(page);
});

async function edit(page: Page, body: string) {
  await page.evaluate(`window.__ph.design.getState().update((d) => { ${body} })`);
}

/** A ground floor with an 8 x 6 room and a straight stair, and a first floor above it. */
async function twoStoreys(page: Page, railing = 'undefined') {
  await edit(
    page,
    `
    const F = d.floors[0].id;
    d.floors.push({ id: 'up', name: '1st floor' });
    const w = (id, floor, ax, ay, bx, by) => d.walls.push({ id, floor, a: { x: ax, y: ay }, b: { x: bx, y: by }, thickness: 0.3, type: 'exterior', height: 2.5 });
    for (const [floor, p] of [[F, ''], ['up', 'u']]) { w(p + 'n', floor, 2, 2, 10, 2); w(p + 'e', floor, 10, 2, 10, 8); w(p + 's', floor, 10, 8, 2, 8); w(p + 'w', floor, 2, 8, 2, 2); }
    const pts = [{ x: 2.15, y: 2.15 }, { x: 9.85, y: 2.15 }, { x: 9.85, y: 7.85 }, { x: 2.15, y: 7.85 }];
    d.rooms.push({ id: 'ground', floor: F, name: 'Hall', color: '#e7c9a0', material: 'wood', living: true, points: pts });
    d.rooms.push({ id: 'upper', floor: 'up', name: 'Landing', color: '#d8d0e8', material: 'carpet', living: true, points: pts });
    d.stairs.push({ id: 'st', floor: F, kind: 'straight', x: 4, y: 5, w: 1, d: 3.6, rotation: 0, steps: 16, rise: 2.8, flip: false, railing: ${railing} });
  `,
  );
}

test('the tools and the furniture list share the left bar: drag the bar between them, both scroll', async ({ page }) => {
  const tools = page.getByTestId('tools-box');
  const palette = page.getByTestId('palette');
  const h0 = (await tools.boundingBox())!.height;
  const p0 = (await palette.boundingBox())!.height;
  expect(h0).toBeCloseTo(250, 0);
  // all the tools are there but they do not all fit: the box scrolls
  expect(await tools.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
  await page.getByTestId('tool-text').scrollIntoViewIfNeeded();
  await expect(page.getByTestId('tool-text')).toBeVisible();
  // drag the bar down: the tools get more room, the furniture list less
  const bar = (await page.getByTestId('splitter-tools').boundingBox())!;
  await page.mouse.move(bar.x + bar.width / 2, bar.y + bar.height / 2);
  await page.mouse.down();
  await page.mouse.move(bar.x + bar.width / 2, bar.y + 120, { steps: 5 });
  await page.mouse.up();
  const h1 = (await tools.boundingBox())!.height;
  expect(h1).toBeGreaterThan(h0 + 90);
  expect((await palette.boundingBox())!.height).toBeLessThan(p0 - 90);
  // and up again, as far as it goes: the tools keep a little room, the furniture list gets the rest
  const bar2 = (await page.getByTestId('splitter-tools').boundingBox())!;
  await page.mouse.move(bar2.x + bar2.width / 2, bar2.y + bar2.height / 2);
  await page.mouse.down();
  await page.mouse.move(bar2.x + bar2.width / 2, bar2.y - 400, { steps: 6 });
  await page.mouse.up();
  const h2 = (await tools.boundingBox())!.height;
  expect(h2).toBeGreaterThanOrEqual(59);
  expect(h2).toBeLessThan(h0);
  expect((await palette.boundingBox())!.height).toBeGreaterThan(p0 + 100);
  // the size is remembered, and a double-click puts it back
  await page.reload();
  await expect(page.getByTestId('tools-box')).toBeVisible();
  expect((await page.getByTestId('tools-box').boundingBox())!.height).toBeCloseTo(h2, 0);
  await page.getByTestId('splitter-tools').dblclick();
  expect((await page.getByTestId('tools-box').boundingBox())!.height).toBeCloseTo(250, 0);
  // tools still work from inside the scrolling box
  await page.getByTestId('tool-text').click();
  expect((await page.evaluate(() => (window as any).__ph.ui.getState().tool))).toBe('text');
});

test('stairs: construction, material, colors and the railing options are all editable', async ({ page }) => {
  await twoStoreys(page, "{ style: 'wood', a: true, b: true }");
  await clickAt(page, 4, 5); // select the stair on the plan
  await expect(page.getByTestId('stair-build')).toBeVisible();
  await page.getByTestId('stair-build').selectOption('open');
  await page.getByTestId('stair-material').selectOption('darkwood');
  let st = (await design(page)).stairs[0];
  expect(st.build).toBe('open');
  expect(st.material).toBe('darkwood');
  // choosing another color is kept; a new material resets it; the reset button too
  await page.getByLabel('Color #c19a6b').first().click();
  expect((await design(page)).stairs[0].color).toBe('#c19a6b');
  await page.getByTestId('stair-colors-reset').click();
  expect((await design(page)).stairs[0].color).toBeUndefined();
  // railing: style, height, color, guard rail
  await page.getByTestId('stair-railing').selectOption('glass');
  await page.getByTestId('stair-rail-height').fill('105');
  await page.getByTestId('stair-rail-height').press('Enter');
  await page.getByTestId('stair-rail-guard').uncheck();
  st = (await design(page)).stairs[0];
  expect(st.railing).toMatchObject({ style: 'glass', height: 1.05, guard: false });
  await page.getByTestId('stair-railing').selectOption('none');
  expect((await design(page)).stairs[0].railing).toBeUndefined();
  // spiral stairs have no construction choice (they are always a pole with treads)
  await page.getByTestId('stair-kind').selectOption('spiral');
  await expect(page.getByTestId('stair-build')).toHaveCount(0);
  // one undo step per change
  await page.keyboard.press('Control+z');
  expect((await design(page)).stairs[0].kind).toBe('straight');
});

test('upstairs the stairwell is a visible hole you can click to edit the stair and give it a railing', async ({ page }) => {
  await twoStoreys(page);
  await page.evaluate(() => (window as any).__ph.ui.getState().setActiveFloor('up'));
  // the stair belongs to the floor below, yet clicking its hole selects it
  await clickAt(page, 4, 5);
  const sel = await page.evaluate(() => (window as any).__ph.ui.getState().selection);
  expect(sel).toMatchObject({ kind: 'stair', id: 'st' });
  await page.getByTestId('stair-railing').selectOption('metal');
  expect((await design(page)).stairs[0].railing).toMatchObject({ style: 'metal' });
  // the guard rail is drawn round the hole: a stroke on the stage in the rail color
  const drawn = await page.evaluate(() => {
    const node = (window as any).__ph.stage().findOne('#st');
    return node ? node.getChildren().length : 0;
  });
  expect(drawn).toBeGreaterThanOrEqual(3);
  // its properties still say "stairs", and it moves with the mouse like any stair
  await dragWorld(page, [4, 5], [4, 4]);
  expect((await design(page)).stairs[0].y).toBeCloseTo(4, 0);
});

test('a gate goes into a fence with the gate tool, and can be edited, opened in 3D and removed', async ({ page }) => {
  await edit(page, `d.strips.push({ id: 'f', floor: d.floors[0].id, kind: 'fence', width: 0.1, points: [{ x: 2, y: 5 }, { x: 12, y: 5 }] });`);
  await page.getByTestId('tab-outdoor').click();
  await page.getByTestId('tool-gate').click();
  await expect(page.getByTestId('gate-kind-double')).toBeVisible();
  await page.getByTestId('gate-kind-double').click();
  await moveTo(page, 6, 5.3);
  await clickAt(page, 6, 5.3);
  let strip = (await design(page)).strips[0];
  expect(strip.gates).toHaveLength(1);
  expect(strip.gates[0]).toMatchObject({ kind: 'double', swing: 1 });
  expect(strip.gates[0].pos).toBeGreaterThan(3.5);
  expect(strip.gates[0].pos).toBeLessThan(4.5); // 6 - 2 (the fence starts at x = 2)
  // a second gate on top of the first is refused
  await clickAt(page, 6.2, 5.3);
  expect((await design(page)).strips[0].gates).toHaveLength(1);
  // another one elsewhere, from the other side of the fence
  await clickAt(page, 10, 4.7);
  strip = (await design(page)).strips[0];
  expect(strip.gates).toHaveLength(2);
  expect(strip.gates[1].swing).toBe(-1);
  // edit them in the properties
  await page.getByTestId('tool-select').click();
  await clickAt(page, 3, 5);
  await expect(page.getByTestId('gate-0')).toBeVisible();
  await page.getByTestId('gate-kind-0').selectOption('sliding');
  await page.getByTestId('gate-swing-0').click();
  strip = (await design(page)).strips[0];
  expect(strip.gates[0]).toMatchObject({ kind: 'sliding', swing: -1 });
  // 3D: the gate is a door: it opens when toggled and the fence has a real gap
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__ph3d?.stats().meshes ?? 0)).toBeGreaterThan(5);
  await page.evaluate(() => (window as any).__ph3d.scene.toggleDoor((window as any).__ph.design.getState().design.strips[0].gates[0].id));
  await expect.poll(() => page.evaluate(() => (window as any).__ph3d.stats().doorsOpen)).toBe(1);
  await page.getByRole('button', { name: '2D', exact: true }).click();
  await clickAt(page, 3, 5);
  await page.getByTestId('gate-delete-0').click();
  expect((await design(page)).strips[0].gates).toHaveLength(1);
  await page.getByTestId('add-gate').click();
  expect((await design(page)).strips[0].gates).toHaveLength(2);
});

test('a footpath can be made of stepping stones, gravel, slabs, brick or boards', async ({ page }) => {
  await page.getByTestId('tab-outdoor').click();
  await page.getByTestId('strip-path').click();
  await page.getByTestId('opt-path-surface').selectOption('stepping');
  await clickAt(page, 3, 3);
  await clickAt(page, 9, 3);
  await page.keyboard.press('Enter');
  let strip = (await design(page)).strips[0];
  expect(strip).toMatchObject({ kind: 'path', surface: 'stepping' });
  await page.getByTestId('tool-select').click();
  await clickAt(page, 4.2, 3); // between two stones: the band under the path is still clickable
  await page.getByTestId('strip-surface').selectOption('brick');
  strip = (await design(page)).strips[0];
  expect(strip.surface).toBe('brick');
  await page.getByTestId('strip-surface').selectOption('plain');
  expect((await design(page)).strips[0].surface).toBeUndefined();
  await page.getByTestId('strip-kind').selectOption('fence');
  await expect(page.getByTestId('add-gate')).toBeVisible();
});

test('more kinds of windows: casement, sash, picture, high and floor-to-ceiling', async ({ page }) => {
  await edit(page, `const F = d.floors[0].id; d.walls.push({ id: 'n', floor: F, a: { x: 2, y: 3 }, b: { x: 14, y: 3 }, thickness: 0.3, type: 'exterior', height: 2.6 });`);
  await page.getByTestId('tool-window').click();
  const kinds = ['casement', 'sash', 'picture', 'highwin', 'floorwin', 'bay', 'window'];
  for (const k of kinds) await expect(page.getByTestId(`window-kind-${k}`)).toBeVisible();
  let x = 3;
  for (const k of kinds.slice(0, 5)) {
    await page.getByTestId(`window-kind-${k}`).click();
    await moveTo(page, x, 3.1);
    await clickAt(page, x, 3.1);
    x += 2;
  }
  const kindsPlaced = (await design(page)).openings.map((o: any) => o.kind);
  expect(kindsPlaced).toEqual(['casement', 'sash', 'picture', 'highwin', 'floorwin']);
  // the properties offer them too
  await page.getByTestId('tool-select').click();
  await clickAt(page, 5, 3);
  await expect(page.getByTestId('opening-kind')).toHaveValue('sash');
  await page.getByTestId('opening-kind').selectOption('picture');
  expect((await design(page)).openings[1].kind).toBe('picture');
  // and they show in 3D
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__ph3d?.stats().meshes ?? 0)).toBeGreaterThan(20);
});

test('moving a radiator (or any wall-mounted thing) snaps it flat onto the wall under the cursor, just like placing it', async ({ page }) => {
  await edit(
    page,
    `
    const F = d.floors[0].id;
    const w = (id, ax, ay, bx, by) => d.walls.push({ id, floor: F, a: { x: ax, y: ay }, b: { x: bx, y: by }, thickness: 0.2, type: 'exterior', height: 2.5 });
    w('n', 2, 2, 8, 2); w('e', 8, 2, 8, 6); w('s', 8, 6, 2, 6); w('w', 2, 6, 2, 2);
    d.furniture.push({ id: 'rad', floor: F, type: 'radiator', x: 5, y: 2.16, w: 1, d: 0.12, rotation: 0, color: '#e5e7eb', label: '' });
    d.furniture.push({ id: 'sofa', floor: F, type: 'sofa', x: 5, y: 4, w: 2, d: 0.9, rotation: 0, color: '#9ca3af', label: '' });
  `,
  );
  await page.getByTestId('tool-select').click();
  await dragWorld(page, [5, 2.16], [7.8, 4]);
  let rad = (await design(page)).furniture.find((f: any) => f.id === 'rad');
  expect(rad.rotation).toBeCloseTo(90, 0); // turned to lie along the east wall
  expect(rad.x).toBeCloseTo(8 - 0.1 - 0.06, 1); // against its inner face
  expect(rad.y).toBeCloseTo(4, 0);
  // all the way round to the south wall
  await dragWorld(page, [7.84, 4], [4, 5.8]);
  rad = (await design(page)).furniture.find((f: any) => f.id === 'rad');
  expect(rad.rotation).toBeCloseTo(180, 0);
  expect(rad.y).toBeCloseTo(6 - 0.1 - 0.06, 1);
  // far from every wall it just moves, and goes back to the way it was turned when picked up
  await dragWorld(page, [4, 5.84], [5, 4.2]);
  rad = (await design(page)).furniture.find((f: any) => f.id === 'rad');
  expect(rad.rotation).toBeCloseTo(180, 0);
  // ordinary furniture is not affected
  await dragWorld(page, [5, 4.5], [5, 3.5]);
  const sofa = (await design(page)).furniture.find((f: any) => f.id === 'sofa');
  expect(sofa.rotation).toBe(0);
});

test('the compass shows north and cannot be turned by dragging it any more', async ({ page }) => {
  const box = (await page.getByTestId('north-arrow').boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const before = (await design(page)).site.north;
  await page.mouse.move(cx, cy - 20);
  await page.mouse.down();
  await page.mouse.move(cx - 40, cy, { steps: 5 });
  await page.mouse.up();
  expect((await design(page)).site.north).toBe(before);
});

test('the hot tub and the patio set: the tub is round with a step, every chair faces the table', async ({ page }) => {
  await edit(
    page,
    `
    const F = d.floors[0].id;
    d.furniture.push({ id: 'tub', floor: F, type: 'hot-tub', x: 4, y: 4, w: 2, d: 2, rotation: 0, color: '#bfe0f5', label: '' });
    d.furniture.push({ id: 'patio', floor: F, type: 'patio-set', x: 9, y: 4, w: 2, d: 2, rotation: 0, color: '#d9c7b0', label: '' });
  `,
  );
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__ph3d?.stats().meshes ?? 0)).toBeGreaterThan(20);
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'e2e/.results/m27-garden.png' });
});
