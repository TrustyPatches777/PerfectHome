import { test, expect, type Page } from '@playwright/test';
import { design, dragWorld, fresh, clickAt } from './helpers';

/* eslint-disable @typescript-eslint/no-explicit-any */

test.beforeEach(async ({ page }) => {
  await fresh(page);
});

const edit = (page: Page, body: string) => page.evaluate(`window.__ph.design.getState().update((d) => { ${body} })`);
const select = (page: Page, refs: { kind: string; id: string }[]) => page.evaluate((r) => (window as any).__ph.ui.getState().setSelected(r), refs);

test('terrain areas: draw one, give it a height and a slope, and the plan shows them', async ({ page }) => {
  await page.getByTestId('tab-outdoor').click();
  await page.getByTestId('zone-terrain').click();
  await dragWorld(page, [1, 1], [8, 6]);
  let d = await design(page);
  expect(d.zones).toHaveLength(1);
  expect(d.zones[0].kind).toBe('terrain');
  await page.getByTestId('tool-select').click();
  await clickAt(page, 4.5, 3.5);
  await page.getByTestId('zone-height').fill('120');
  await page.getByTestId('zone-height').press('Enter');
  await page.getByTestId('zone-slope').fill('8');
  await page.getByTestId('zone-slope').press('Enter');
  await page.getByTestId('zone-slope-dir').fill('90');
  await page.getByTestId('zone-slope-dir').press('Enter');
  d = await design(page);
  expect(d.zones[0]).toMatchObject({ height: 1.2, slope: { dir: 90, pct: 8 } });
  // the plan labels the height and the fall
  const label = await page.evaluate(() => (window as any).__ph.stage().find('Text').map((t: any) => t.text()).filter((t: string) => /\+1\.20 m/.test(t)));
  expect(label.length).toBe(1);
  expect(label[0]).toMatch(/8% /);
  // and goes back to the ground under it
  await page.getByTestId('zone-height-reset').click();
  expect((await design(page)).zones[0].height).toBeUndefined();
});

test('a light well is a sunk area, and a raised ground floor gets entrance steps that reach the door', async ({ page }) => {
  await edit(page, `
    d.floors = [{ id: 'b', name: 'Basement' }, { id: 'g', name: 'Ground floor' }];
    for (const f of ['b', 'g']) {
      for (const [id, ax, ay, bx, by] of [['n', 2, 2, 10, 2], ['e', 10, 2, 10, 7], ['s', 10, 7, 2, 7], ['w', 2, 7, 2, 2]]) d.walls.push({ id: f + id, floor: f, a: { x: ax, y: ay }, b: { x: bx, y: by }, thickness: 0.3, type: 'exterior', height: 2.5 });
      d.rooms.push({ id: 'r' + f, floor: f, name: f, color: '#e7c9a0', material: 'plain', living: true, points: [{ x: 2.15, y: 2.15 }, { x: 9.85, y: 2.15 }, { x: 9.85, y: 6.85 }, { x: 2.15, y: 6.85 }] });
    }
    d.openings.push({ id: 'door', wallId: 'gs', kind: 'main', pos: 4, width: 1, swing: 1, hinge: 'a' });`);
  await page.evaluate(() => (window as any).__ph.ui.getState().setActiveFloor('g'));
  await expect(page.getByTestId('ground-level')).toHaveValue('0');
  await page.getByTestId('ground-level').fill('140');
  await page.getByTestId('ground-level').press('Enter');
  expect((await design(page)).settings.groundLevel).toBe(1.4);

  // entrance steps next to the door: measured from the height to climb, snapped to the door
  await page.getByTestId('tool-stairs').click();
  await page.getByTestId('stair-kind-entrance').click();
  await clickAt(page, 6.3, 8.4); // the south wall runs from x = 10 to x = 2: the door at 4 m is at x = 6
  const d = await design(page);
  const st = d.stairs[0];
  expect(st.kind).toBe('straight');
  expect(st.rise).toBeCloseTo(1.4);
  expect(st.steps).toBe(8);
  expect(st.x).toBeCloseTo(6, 0);
  expect(st.y).toBeCloseTo(7 + 0.15 + st.d / 2, 1);
  expect(st.rotation).toBe(0);

  // change the level: the steps follow; the field of the stair offers to reach the floor
  await page.getByTestId('ground-level').fill('100');
  await page.getByTestId('ground-level').press('Enter');
  expect((await design(page)).stairs[0].rise).toBeCloseTo(1.0);

  // a light well along the cellar wall: drawn on the basement it is a sunk area
  await page.evaluate(() => (window as any).__ph.ui.getState().setActiveFloor('b'));
  await page.getByTestId('tab-outdoor').click();
  await page.getByTestId('zone-lightwell').click();
  await dragWorld(page, [3, 7.2], [8, 8.4]);
  await page.getByTestId('tool-select').click();
  await clickAt(page, 5.5, 7.8);
  await expect(page.getByTestId('zone-height')).toHaveValue('-120');
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__ph3d?.stats().meshes ?? 0)).toBeGreaterThan(20);
  await page.evaluate(() => (window as any).__ph3d.scene.setView([-2, 5, 14], [6, 0, 6]));
  await page.screenshot({ path: 'e2e/.results/m34-semi-basement.png' });
});

test('a dais: a room can lie higher or lower than the floor of its storey', async ({ page }) => {
  await edit(page, `
    const F = d.floors[0].id;
    for (const [id, ax, ay, bx, by] of [['n', 1, 1, 7, 1], ['e', 7, 1, 7, 5], ['s', 7, 5, 1, 5], ['w', 1, 5, 1, 1]]) d.walls.push({ id, floor: F, a: { x: ax, y: ay }, b: { x: bx, y: by }, thickness: 0.15, type: 'interior', height: 2.5 });
    d.rooms.push({ id: 'r', floor: F, name: 'Lounge', color: '#e7c9a0', material: 'plain', living: true, points: [{ x: 1.1, y: 1.1 }, { x: 6.9, y: 1.1 }, { x: 6.9, y: 4.9 }, { x: 1.1, y: 4.9 }] });`);
  await select(page, [{ kind: 'room', id: 'r' }]);
  await page.getByTestId('room-level').fill('15');
  await page.getByTestId('room-level').press('Enter');
  expect((await design(page)).rooms[0].level).toBeCloseTo(0.15);
  const label = await page.evaluate(() => (window as any).__ph.stage().find('Text').map((t: any) => t.text()).filter((t: string) => /\+15 cm/.test(t)));
  expect(label.length).toBe(1);
  await page.getByTestId('room-level').fill('0');
  await page.getByTestId('room-level').press('Enter');
  expect((await design(page)).rooms[0].level).toBeUndefined();
});
