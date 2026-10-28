import { test, expect, type Page } from '@playwright/test';
import { clickAt, design, dragWorld, fresh } from './helpers';

/* eslint-disable @typescript-eslint/no-explicit-any */

test.beforeEach(async ({ page }) => {
  await fresh(page);
});

const edit = (page: Page, body: string) => page.evaluate(`window.__ph.design.getState().update((d) => { ${body} })`);

test('storey height: one field moves the whole house, and undo takes it back in one step', async ({ page }) => {
  await edit(page, `
    const F = d.floors[0].id;
    d.walls.push({ id: 'a', floor: F, a: { x: 1, y: 1 }, b: { x: 6, y: 1 }, thickness: 0.2, type: 'interior', height: 2.5 });
    d.walls.push({ id: 'low', floor: F, a: { x: 1, y: 3 }, b: { x: 6, y: 3 }, thickness: 0.2, type: 'interior', height: 1.2 });
    d.stairs.push({ id: 's', floor: F, kind: 'straight', x: 3, y: 4, w: 1, d: 4, rotation: 0, steps: 16, rise: 2.8, flip: false });
    d.stairs.push({ id: 'e', floor: F, kind: 'straight', x: 5, y: 4, w: 1.4, d: 0.9, rotation: 0, steps: 3, rise: 0.45, flip: false });`);
  await expect(page.getByTestId('storey-height')).toHaveValue('280');
  await page.getByTestId('storey-height').fill('320');
  await page.getByTestId('storey-height').press('Enter');
  let d = await design(page);
  expect(d.settings.storeyHeight).toBe(3.2);
  expect(d.walls.find((w: any) => w.id === 'a').height).toBeCloseTo(2.8);
  expect(d.walls.find((w: any) => w.id === 'low').height).toBeCloseTo(1.2); // a low wall keeps its height
  expect(d.stairs.find((s: any) => s.id === 's').rise).toBeCloseTo(3.2);
  expect(d.stairs.find((s: any) => s.id === 'e').rise).toBeCloseTo(0.45); // entrance steps do not climb a storey
  await page.getByTestId('undo').click();
  d = await design(page);
  expect(d.settings.storeyHeight).toBe(2.8);
  expect(d.walls.find((w: any) => w.id === 'a').height).toBeCloseTo(2.5);
  expect(d.stairs.find((s: any) => s.id === 's').rise).toBeCloseTo(2.8);
});

test('walls: wooden slats and glass in the tool, and walls drawn after a storey change follow it', async ({ page }) => {
  await page.getByTestId('tool-wall').click();
  await page.getByTestId('wall-type-slats').click();
  await clickAt(page, 2, 2);
  await clickAt(page, 5, 2);
  await page.keyboard.press('Escape');
  await page.getByTestId('wall-type-glass').click();
  await clickAt(page, 2, 4);
  await clickAt(page, 5, 4);
  await page.keyboard.press('Escape');
  const d = await design(page);
  expect(d.walls.map((w: any) => w.type)).toEqual(['slats', 'glass']);
  expect(d.walls[0].thickness).toBeCloseTo(0.06);
  expect(d.walls[1].thickness).toBeCloseTo(0.1);
  await page.getByTestId('tool-select').click();
  await page.getByTestId('storey-height').fill('320');
  await page.getByTestId('storey-height').press('Enter');
  await page.getByTestId('tool-wall').click();
  await page.getByTestId('wall-type-interior').click();
  await clickAt(page, 2, 6);
  await clickAt(page, 5, 6);
  await page.keyboard.press('Escape');
  expect((await design(page)).walls[2].height).toBeCloseTo(2.8);
});

test('winter garden: drag a rectangle and get glass walls, a tiled floor, a French door and a glass roof, in one undo step', async ({ page }) => {
  await page.getByTestId('tool-wall').click();
  await page.getByTestId('wall-mode-winter').click();
  await dragWorld(page, [2, 2], [7, 5]);
  const d = await design(page);
  expect(d.walls).toHaveLength(4);
  expect(d.walls.every((w: any) => w.type === 'glass')).toBe(true);
  expect(d.rooms).toHaveLength(1);
  expect(d.rooms[0]).toMatchObject({ name: 'Winter garden', material: 'tile' });
  expect(d.openings).toHaveLength(1);
  expect(d.openings[0].kind).toBe('french');
  expect(d.roofs).toHaveLength(1);
  expect(d.roofs[0]).toMatchObject({ material: 'glass', kind: 'gable' });
  expect((await page.evaluate(() => (window as any).__ph.ui.getState().selection))?.kind).toBe('roof');
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__ph3d?.stats().meshes ?? 0)).toBeGreaterThan(20);
  await page.evaluate(() => (window as any).__ph3d.scene.setView([4.5, 4, 9], [4.5, 1.2, 3.5]));
  await page.screenshot({ path: 'e2e/.results/m33-winter-garden.png' });
  await page.keyboard.press('2');
  await page.getByTestId('undo').click();
  const after = await design(page);
  expect([after.walls.length, after.rooms.length, after.openings.length, after.roofs.length]).toEqual([0, 0, 0, 0]);
});

test('a glass roof from the roof tool, and the new furniture groups are in the palette', async ({ page }) => {
  await edit(page, `
    const F = d.floors[0].id;
    for (const [id, ax, ay, bx, by] of [['a', 2, 2, 8, 2], ['b', 8, 2, 8, 6], ['c', 8, 6, 2, 6], ['d', 2, 6, 2, 2]]) d.walls.push({ id, floor: F, a: { x: ax, y: ay }, b: { x: bx, y: by }, thickness: 0.3, type: 'exterior', height: 2.5 });`);
  await page.getByTestId('tool-roof').click();
  await page.getByTestId('roof-glass').check();
  await page.getByTestId('roof-fit-walls').click();
  expect((await design(page)).roofs[0].material).toBe('glass');
  for (const cat of ['Korean', 'Winter garden']) await expect(page.getByTestId(`cat-${cat}`)).toHaveCount(1);
  await page.getByLabel('Search furniture').fill('soban');
  await expect(page.getByTestId('furn-kr-soban')).toBeVisible();
  await page.getByLabel('Search furniture').fill('fountain');
  await expect(page.getByTestId('furn-wg-fountain')).toBeVisible();
});

test('the floor of a room goes on under its doors', async ({ page }) => {
  await edit(page, `
    const F = d.floors[0].id;
    d.walls.push({ id: 'mid', floor: F, a: { x: 4, y: 0 }, b: { x: 4, y: 5 }, thickness: 0.2, type: 'interior', height: 2.5 });
    d.rooms.push({ id: 'a', floor: F, name: 'A', color: '#d9b38c', material: 'parquet', living: true, points: [{ x: 0.1, y: 0.1 }, { x: 3.9, y: 0.1 }, { x: 3.9, y: 4.9 }, { x: 0.1, y: 4.9 }] });
    d.rooms.push({ id: 'b', floor: F, name: 'B', color: '#cbd5e1', material: 'tile', living: true, points: [{ x: 4.1, y: 0.1 }, { x: 7.9, y: 0.1 }, { x: 7.9, y: 4.9 }, { x: 4.1, y: 4.9 }] });
    d.openings.push({ id: 'd1', wallId: 'mid', kind: 'door', pos: 2.5, width: 0.9, swing: 1, hinge: 'a' });`);
  // the plan draws patches of floor in the doorway (non-listening lines in the rooms layer)
  const lines = await page.evaluate(() => {
    const stage = (window as any).__ph.stage();
    return stage.find('Line').filter((l: any) => l.closed() && l.listening() === false && l.opacity() === 0.92).length;
  });
  expect(lines).toBeGreaterThanOrEqual(2);
});
