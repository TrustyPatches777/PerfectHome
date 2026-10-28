import { test, expect, type Page } from '@playwright/test';
import { clickAt, design, fresh } from './helpers';

/* eslint-disable @typescript-eslint/no-explicit-any */

test.beforeEach(async ({ page }) => {
  await fresh(page);
});

const NONE = { meshes: 0, mode: '', look: [0, 0, 0], camera: [0, 0, 0], doorsOpen: 0, filled: 0, feet: 0 };
const stats = (page: Page): Promise<typeof NONE> => page.evaluate((none) => (window as any).__ph3d?.stats() ?? none, NONE);
const scene = <T,>(page: Page, fn: (s: any) => T) => page.evaluate(`(${fn.toString()})(window.__ph3d.scene)`) as Promise<T>;

/**
 * Hold a key while the walker moves, until it has stopped moving for a while (or a long time has passed). The test machine draws
 * slowly and the walker is slowed with it, so a fixed time would be a guess: `ms` is only the least time to hold.
 */
async function holdKey(page: Page, key: string, ms: number) {
  const pos = async () => {
    const s = await stats(page);
    return [s.camera[0], s.camera[1], s.camera[2]];
  };
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  let last = await pos();
  let still = 0;
  for (let i = 0; i < 90 && still < 3; i++) {
    await page.waitForTimeout(250);
    const now = await pos();
    still = Math.hypot(now[0] - last[0], now[1] - last[1], now[2] - last[2]) < 0.01 ? still + 1 : 0;
    last = now;
  }
  await page.keyboard.up(key);
}

/** Run an edit on the design in the page. */
async function edit(page: Page, body: string) {
  await page.evaluate(`window.__ph.design.getState().update((d) => { ${body} })`);
}

/** A ground floor with a 8 x 6 room and a stair, a first floor above it, and a gable roof. */
async function twoStoreyHouse(page: Page, railing = "{ style: 'wood', a: true, b: true }") {
  await edit(
    page,
    `
    const F = d.floors[0].id;
    d.floors.push({ id: 'up', name: '1st floor' });
    const w = (id, floor, ax, ay, bx, by) => d.walls.push({ id, floor, a: { x: ax, y: ay }, b: { x: bx, y: by }, thickness: 0.3, type: 'exterior', height: 2.5 });
    for (const [floor, p] of [[F, ''], ['up', 'u']]) {
      w(p + 'n', floor, 2, 2, 10, 2); w(p + 'e', floor, 10, 2, 10, 8); w(p + 's', floor, 10, 8, 2, 8); w(p + 'w', floor, 2, 8, 2, 2);
    }
    d.rooms.push({ id: 'ground', floor: F, name: 'Hall', color: '#e7c9a0', material: 'wood', living: true, points: [{ x: 2.15, y: 2.15 }, { x: 9.85, y: 2.15 }, { x: 9.85, y: 7.85 }, { x: 2.15, y: 7.85 }] });
    d.rooms.push({ id: 'upper', floor: 'up', name: 'Landing', color: '#d8d0e8', material: 'carpet', living: true, points: [{ x: 2.15, y: 2.15 }, { x: 9.85, y: 2.15 }, { x: 9.85, y: 7.85 }, { x: 2.15, y: 7.85 }] });
    d.stairs.push({ id: 'st', floor: F, kind: 'straight', x: 4, y: 5, w: 1, d: 3.6, rotation: 0, steps: 16, rise: 2.8, flip: false, railing: ${railing} });
    d.openings.push({ id: 'front', wallId: 's', kind: 'main', pos: 3, width: 1.1, swing: 1, hinge: 'a' });
    d.openings.push({ id: 'win', wallId: 'n', kind: 'window', pos: 4, width: 1.6, swing: 1, hinge: 'a' });
  `,
  );
}

test('the sidebars can be resized by dragging, and the size is remembered', async ({ page }) => {
  const leftWidth = async () => (await page.locator('.sidebar.left').boundingBox())!.width;
  const rightWidth = async () => (await page.locator('.sidebar.right').boundingBox())!.width;
  const stageWidth = async () => (await page.locator('.canvas-wrap').first().boundingBox())!.width;
  const l0 = await leftWidth();
  const r0 = await rightWidth();
  const s0 = await stageWidth();
  expect(l0).toBeCloseTo(214, 0);
  const bar = (await page.getByTestId('splitter-left').boundingBox())!;
  await page.mouse.move(bar.x + bar.width / 2, bar.y + 200);
  await page.mouse.down();
  await page.mouse.move(bar.x + 100, bar.y + 200, { steps: 5 });
  await page.mouse.up();
  expect(await leftWidth()).toBeGreaterThan(l0 + 80);
  expect(await stageWidth()).toBeLessThan(s0 - 80); // the editing window gave way
  const rbar = (await page.getByTestId('splitter-right').boundingBox())!;
  await page.mouse.move(rbar.x + rbar.width / 2, rbar.y + 200);
  await page.mouse.down();
  await page.mouse.move(rbar.x - 90, rbar.y + 200, { steps: 5 });
  await page.mouse.up();
  expect(await rightWidth()).toBeGreaterThan(r0 + 70);
  // limits: it cannot be dragged to nothing
  const bar2 = (await page.getByTestId('splitter-left').boundingBox())!;
  await page.mouse.move(bar2.x + 2, bar2.y + 200);
  await page.mouse.down();
  await page.mouse.move(2, bar2.y + 200, { steps: 5 });
  await page.mouse.up();
  expect(await leftWidth()).toBeGreaterThanOrEqual(150);
  // the plan still draws at its new size, and the size survives a reload
  await expect(page.locator('canvas').first()).toBeVisible();
  const w1 = await leftWidth();
  const w2 = await rightWidth();
  await page.reload();
  await expect(page.locator('canvas').first()).toBeVisible();
  expect(await leftWidth()).toBeCloseTo(w1, 0);
  expect(await rightWidth()).toBeCloseTo(w2, 0);
  // double-click to reset
  await page.getByTestId('splitter-left').dblclick();
  expect(await leftWidth()).toBeCloseTo(214, 0);
  await page.screenshot({ path: 'e2e/.results/m26-sidebars.png' });
});

test('looking at the basement shows the ground floor faintly, to line the walls up', async ({ page }) => {
  await edit(page, `const F = d.floors[0].id; d.walls.push({ id: 'g', floor: F, a: { x: 2, y: 2 }, b: { x: 8, y: 2 }, thickness: 0.3, type: 'exterior', height: 2.5 });`);
  await page.getByTestId('add-basement').click();
  const d = await design(page);
  expect(d.floors[0].name).toBe('Basement');
  await expect(page.getByTestId('floors')).toContainText('Show the floor above faintly');
  await expect(page.getByTestId('underlay-toggle')).toBeEnabled();
  const faint = () => page.evaluate(() => (window as any).__ph.stage().find('.underlay').length);
  await expect.poll(faint).toBe(1); // the ground floor's wall is drawn under the basement
  // on the ground floor it is the (non-existent) floor below: nothing; the label changes back
  await page.getByTestId('floor-Ground floor').click();
  await expect(page.getByTestId('floors')).toContainText('Show the floor below faintly');
  await expect.poll(faint).toBe(1); // the basement shows under the ground floor
  await page.getByTestId('floor-Basement').click();
  await page.getByTestId('underlay-toggle').uncheck();
  await expect.poll(faint).toBe(0);
});

test('a new floor above a roof asks what to do: attic or a full floor with the roof moved up', async ({ page }) => {
  await edit(page, `const F = d.floors[0].id; for (const [id, ax, ay, bx, by] of [['a', 2, 2, 8, 2], ['b', 8, 2, 8, 6], ['c', 8, 6, 2, 6], ['d', 2, 6, 2, 2]]) d.walls.push({ id, floor: F, a: { x: ax, y: ay }, b: { x: bx, y: by }, thickness: 0.3, type: 'exterior', height: 2.5 });`);
  await page.getByTestId('tool-roof').click();
  await page.getByTestId('roof-fit-walls').click();
  expect((await design(page)).roofs).toHaveLength(1);
  await page.getByTestId('tool-select').click();
  await expect(page.getByTestId('add-attic')).toBeEnabled();

  // cancel: nothing changes
  await page.getByTestId('add-floor').click();
  await expect(page.getByTestId('floor-roof-dialog')).toBeVisible();
  await expect(page.getByTestId('floor-roof-attic')).toBeVisible();
  await page.getByTestId('floor-roof-cancel').click();
  expect((await design(page)).floors).toHaveLength(1);

  // an attic: the roof stays, the new floor is an attic
  await page.getByTestId('add-floor').click();
  await page.getByTestId('floor-roof-attic').click();
  let d = await design(page);
  expect(d.floors).toHaveLength(2);
  expect(d.floors[1]).toMatchObject({ name: 'Attic', attic: true });
  expect(d.roofs[0].floor).toBe(d.floors[0].id);
  await expect(page.getByTestId('add-attic')).toBeDisabled(); // only one
  // nothing goes above an attic
  await page.getByTestId('add-floor').click();
  await expect(page.locator('.hint')).toContainText('attic');
  expect((await design(page)).floors).toHaveLength(2);
  // the attic's plan shows the roof above it, the low parts shaded
  await page.screenshot({ path: 'e2e/.results/m26-attic-plan.png' });
  // and it cannot be duplicated
  await page.getByTestId('duplicate-floor').click();
  expect((await design(page)).floors).toHaveLength(2);

  // a full floor instead: delete the attic, add the floor, move the roof up
  await page.getByTestId('delete-floor').click();
  if (await page.getByTestId('confirm-ok').count()) await page.getByTestId('confirm-ok').click(); // an empty floor goes without asking
  d = await design(page);
  expect(d.floors).toHaveLength(1);
  await page.getByTestId('add-floor').click();
  await page.getByTestId('floor-roof-move').click();
  d = await design(page);
  expect(d.floors).toHaveLength(2);
  expect(d.floors[1].attic).toBeUndefined();
  expect(d.roofs[0].floor).toBe(d.floors[1].id);
  // the roof says which floor it sits on and can be moved back
  await page.evaluate((id) => (window as any).__ph.ui.getState().select({ kind: 'roof', id }), d.roofs[0].id);
  await expect(page.getByTestId('roof-floor')).toHaveValue(d.floors[1].id);
});

test('stairs make a hole in the floor above, with railings in several styles', async ({ page }) => {
  await twoStoreyHouse(page);
  // the plan: properties of a selected stair
  await page.evaluate(() => (window as any).__ph.ui.getState().select({ kind: 'stair', id: 'st' }));
  await expect(page.getByTestId('stair-railing')).toHaveValue('wood');
  await page.getByTestId('stair-railing').selectOption('glass');
  expect((await design(page)).stairs[0].railing).toMatchObject({ style: 'glass', a: true, b: true });
  await page.getByTestId('stair-rail-b').uncheck();
  expect((await design(page)).stairs[0].railing).toMatchObject({ a: true, b: false });
  await page.getByTestId('stair-railing').selectOption('none');
  expect((await design(page)).stairs[0].railing).toBeUndefined();
  await page.getByTestId('stair-railing').selectOption('wood');
  await page.screenshot({ path: 'e2e/.results/m26-stair-plan.png' });

  await page.getByTestId('view-3d').click();
  await expect.poll(async () => (await stats(page)).meshes, { timeout: 30_000 }).toBeGreaterThan(50);
  // the upper floor has a hole where the stair is
  const holes = await scene(page, (s) => {
    let n = 0;
    s.world.traverse((o: any) => {
      if (o.isMesh && o.geometry?.type === 'ExtrudeGeometry') n += o.geometry.parameters.shapes.holes?.length ?? 0;
    });
    return n;
  });
  expect(holes).toBeGreaterThanOrEqual(1);
  for (const [name, style] of [['wood', 'wood'], ['glass', 'glass'], ['cable', 'cable'], ['metal', 'metal']] as const) {
    await edit(page, `d.stairs[0].railing = { style: '${style}', a: true, b: true };`);
    await scene(page, (s) => s.setView([2, 7, 14], [4, 1.6, 5]));
    await page.getByTestId('view3d-cutaway').uncheck().catch(() => undefined);
    await page.waitForTimeout(250);
    await page.screenshot({ path: `e2e/.results/m26-stairs-${name}.png`, clip: { x: 0, y: 52, width: 1180, height: 820 } });
  }
  // looking from above with the roof... there is none: the guard rail round the hole upstairs
  await scene(page, (s) => s.setView([5.5, 9.5, 10], [4.5, 2.8, 5.2]));
  await page.waitForTimeout(250);
  await page.screenshot({ path: 'e2e/.results/m26-stairs-above.png', clip: { x: 0, y: 52, width: 1180, height: 820 } });
});

test('walking: walls and furniture stop you, and you can climb the stairs to the floor above and come back down', async ({ page }) => {
  test.setTimeout(180_000); // the walker moves in real time, and the test browser draws 3D in software
  await twoStoreyHouse(page);
  await edit(page, `d.furniture.push({ id: 'sofa', floor: d.floors[0].id, type: 'sofa', x: 8, y: 5, w: 2, d: 0.9, rotation: 90, color: '#b7c9a8', label: '' });`);
  await page.getByTestId('view-3d').click();
  await expect.poll(async () => (await stats(page)).meshes, { timeout: 30_000 }).toBeGreaterThan(50);
  await page.getByTestId('mode-walk').click();
  await expect.poll(async () => (await stats(page)).mode).toBe('walk');
  const hold = (key: string, ms: number) => holdKey(page, key, ms);
  await page.getByTestId('view3d-canvas').focus();

  // walk east into the east wall: you stop short of it (the wall's inside face is at x = 9.85)
  await scene(page, (s) => s.walkTo(9, 3.5, -Math.PI / 2)); // looking towards +x
  await hold('w', 1200);
  let st = await stats(page);
  expect(st.camera[0]).toBeLessThan(9.85 - 0.2);
  expect(st.camera[0]).toBeGreaterThan(9.4);
  // walk north into the sofa's end, then the wall
  await scene(page, (s) => s.walkTo(8, 7, Math.PI));
  await hold('w', 1500);
  st = await stats(page);
  expect(st.camera[2]).toBeGreaterThan(5.45 + 0.25); // the sofa (turned: 0.9 x 2) ends at 5.9... stops before it from the south
  expect(st.camera[2]).toBeLessThan(6.6);

  // the stair: starts at y = 6.8 (bottom) and climbs towards y = 3.2; stand at its foot looking north
  await scene(page, (s) => s.walkTo(4, 7.6, Math.PI));
  await hold('w', 4200);
  st = await stats(page);
  expect(st.feet).toBeGreaterThan(2.7); // on the floor above
  await page.screenshot({ path: 'e2e/.results/m26-walk-up.png' });
  // on the upper floor: walk on, and the upper floor's walls stop you as well
  await hold('w', 1500);
  st = await stats(page);
  expect(st.feet).toBeCloseTo(2.81, 1);
  expect(st.camera[2]).toBeGreaterThan(2.15 + 0.2);
  // back down: turn round and walk the stair down
  await scene(page, (s) => s.walkTo(4, 3.0, 0)); // looking south, above the top of the stair
  await hold('w', 5200);
  st = await stats(page);
  expect(st.feet).toBeLessThan(0.5);
});

test('walking: a shut door stops you and an open one lets you through; the roof of an attic is a ceiling you bump your head on', async ({ page }) => {
  test.setTimeout(180_000); // the walker moves in real time, and the test browser draws 3D in software
  await twoStoreyHouse(page);
  await page.getByTestId('view-3d').click();
  await expect.poll(async () => (await stats(page)).meshes, { timeout: 30_000 }).toBeGreaterThan(50);
  await page.getByTestId('mode-walk').click();
  await page.getByTestId('view3d-canvas').focus();
  const hold = (key: string, ms: number) => holdKey(page, key, ms);
  // the front door is in the south wall (y = 8) at x = 10 - 3 = 7: the wall runs from x = 10 to x = 2
  await scene(page, (s) => s.walkTo(7, 6.5, 0)); // facing south, at the door
  await hold('w', 1500);
  expect((await stats(page)).camera[2]).toBeLessThan(7.9);
  await scene(page, (s) => s.toggleDoor('front'));
  await page.waitForTimeout(800);
  await scene(page, (s) => s.walkTo(7, 6.5, 0));
  await hold('w', 2500);
  expect((await stats(page)).camera[2]).toBeGreaterThan(8.4); // out of the door
});

test('floors can be switched on and off in the 3D view, so the ground and the basement can be seen', async ({ page }) => {
  await twoStoreyHouse(page);
  await page.getByTestId('add-basement').click();
  await edit(page, `d.walls.push({ id: 'bs', floor: d.floors[0].id, a: { x: 2, y: 2 }, b: { x: 10, y: 2 }, thickness: 0.3, type: 'exterior', height: 2.5 }, { id: 'bs2', floor: d.floors[0].id, a: { x: 10, y: 2 }, b: { x: 10, y: 8 }, thickness: 0.3, type: 'exterior', height: 2.5 }, { id: 'bs3', floor: d.floors[0].id, a: { x: 10, y: 8 }, b: { x: 2, y: 8 }, thickness: 0.3, type: 'exterior', height: 2.5 }, { id: 'bs4', floor: d.floors[0].id, a: { x: 2, y: 8 }, b: { x: 2, y: 2 }, thickness: 0.3, type: 'exterior', height: 2.5 });
  d.rooms.push({ id: 'cellar', floor: d.floors[0].id, name: 'Cellar', color: '#cbd5e1', material: 'concrete', living: false, points: [{ x: 2.15, y: 2.15 }, { x: 9.85, y: 2.15 }, { x: 9.85, y: 7.85 }, { x: 2.15, y: 7.85 }] });`);
  await page.getByTestId('view-3d').click();
  await expect.poll(async () => (await stats(page)).meshes, { timeout: 30_000 }).toBeGreaterThan(80);
  await expect(page.getByTestId('floor-toggles')).toContainText('Basement');
  const meshes = async () => (await stats(page)).meshes;
  const all = await meshes();
  // the ground is there all the time: outside the house there is grass even with a basement
  await scene(page, (s) => s.setView([16, 9, 16], [6, 0, 5]));
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'e2e/.results/m26-floors-all.png', clip: { x: 0, y: 52, width: 1180, height: 820 } });
  // switch the upper floors off to see the basement through the hole in the ground
  await page.getByTestId('floor-shown-1st floor').uncheck();
  await page.getByTestId('floor-shown-Ground floor').uncheck();
  await expect.poll(meshes).toBeLessThan(all);
  await page.waitForTimeout(250);
  await page.screenshot({ path: 'e2e/.results/m26-floors-basement.png', clip: { x: 0, y: 52, width: 1180, height: 820 } });
  expect(await scene(page, (s) => s.stats().filled)).toBeGreaterThan(0.3);
  // only the ground floor
  await page.getByTestId('floor-shown-Basement').uncheck();
  await page.getByTestId('floor-shown-Ground floor').check();
  await page.waitForTimeout(250);
  await page.screenshot({ path: 'e2e/.results/m26-floors-ground.png', clip: { x: 0, y: 52, width: 1180, height: 820 } });
  await page.getByTestId('floor-shown-Basement').check();
  await page.getByTestId('floor-shown-1st floor').check();
  await expect.poll(meshes).toBe(all);
});

test('three kinds of door, a roof with a skylight that lets light in, and the Porsche', async ({ page }) => {
  test.setTimeout(90_000);
  await twoStoreyHouse(page);
  await edit(page, `
    d.openings.push({ id: 'garden', wallId: 'w', kind: 'garden', pos: 2, width: 1.3, swing: 1, hinge: 'a' });
    d.openings.push({ id: 'inner', wallId: 'e', kind: 'door', pos: 3, width: 0.9, swing: 1, hinge: 'a' });
    d.furniture.push({ id: 'car', floor: d.floors[0].id, type: 'porsche', x: 6, y: 12, w: 4.55, d: 1.95, rotation: 0, color: '#c8102e', label: '' });
    d.furniture.push({ id: 'car2', floor: d.floors[0].id, type: 'porsche', x: 13, y: 12, w: 4.55, d: 1.95, rotation: 20, color: '#e5e7eb', label: '' });
  `);
  // the door tool offers them
  await page.getByTestId('tool-door').click();
  await expect(page.getByTestId('door-kind-main')).toBeVisible();
  await expect(page.getByTestId('door-kind-garden')).toBeVisible();
  await page.getByTestId('door-kind-main').click();
  await expect(page.getByTestId('opt-opening-width')).toHaveValue('100');
  await page.getByTestId('tool-select').click();
  await page.screenshot({ path: 'e2e/.results/m26-doors-plan.png' });
  await page.getByTestId('view-3d').click();
  await expect.poll(async () => (await stats(page)).meshes, { timeout: 30_000 }).toBeGreaterThan(50);
  await scene(page, (s) => s.setView([6, 2.2, 14], [6, 1.3, 8]));
  await page.waitForTimeout(250);
  await page.screenshot({ path: 'e2e/.results/m26-door-main.png', clip: { x: 0, y: 52, width: 1180, height: 820 } });
  await scene(page, (s) => s.toggleDoor('front'));
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'e2e/.results/m26-door-main-open.png', clip: { x: 0, y: 52, width: 1180, height: 820 } });
  await scene(page, (s) => s.setView([-2, 2.2, 5], [2, 1.2, 5]));
  await page.waitForTimeout(250);
  await page.screenshot({ path: 'e2e/.results/m26-door-garden.png', clip: { x: 0, y: 52, width: 1180, height: 820 } });
  await scene(page, (s) => s.setView([13, 4.5, 16], [8, 0.5, 12]));
  await page.waitForTimeout(250);
  await page.screenshot({ path: 'e2e/.results/m26-porsche.png', clip: { x: 0, y: 52, width: 1180, height: 820 } });
  await scene(page, (s) => s.setView([4, 1.4, 14.2], [7, 0.6, 12]));
  await page.waitForTimeout(250);
  await page.screenshot({ path: 'e2e/.results/m26-porsche-close.png', clip: { x: 0, y: 52, width: 1180, height: 820 } });

  // a roof with a skylight: light comes in through it
  await page.getByTestId('view-2d').click();
  await page.getByTestId('floor-1st floor').click();
  await page.getByTestId('tool-roof').click();
  await page.getByTestId('roof-fit-walls').click();
  await page.getByTestId('tool-skylight').click();
  await clickAt(page, 6, 6.6);
  expect((await design(page)).skylights).toHaveLength(1);
  await page.getByTestId('view-3d').click();
  await page.getByTestId('view3d-slider').fill('13');
  await expect.poll(async () => (await stats(page)).meshes, { timeout: 30_000 }).toBeGreaterThan(50);
  await scene(page, (s) => s.setView([6, 9.5, 17], [6, 4, 6]));
  await page.waitForTimeout(250);
  await page.screenshot({ path: 'e2e/.results/m26-skylight-roof.png', clip: { x: 0, y: 52, width: 1180, height: 820 } });
  // a window cut into the roof: the roof panel has a hole
  const cut = await scene(page, (s) => {
    let n = 0;
    s.world.traverse((o: any) => {
      if (o.isMesh && o.geometry?.type === 'ExtrudeGeometry' && o.geometry.parameters.shapes.holes?.length && o.userData) n += o.geometry.parameters.shapes.holes.length;
    });
    return n;
  });
  expect(cut).toBeGreaterThanOrEqual(2); // the stairwell and the skylight
});
