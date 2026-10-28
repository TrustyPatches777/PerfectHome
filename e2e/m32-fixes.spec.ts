import { test, expect } from '@playwright/test';
import { clickAt, design, fresh, pickFurniture } from './helpers';

/* eslint-disable @typescript-eslint/no-explicit-any */

test.beforeEach(async ({ page }) => {
  await fresh(page);
});

test('walls: holding Ctrl keeps them at right angles, and the "right angles" switch does the same without a key', async ({ page }) => {
  await page.getByTestId('tool-wall').click();
  // Ctrl held: the second click is a little off the horizontal line, the wall is still level
  await clickAt(page, 2, 2);
  await page.keyboard.down('Control');
  await clickAt(page, 6.3, 2.6);
  await page.keyboard.up('Control');
  let walls = (await design(page)).walls;
  expect(walls).toHaveLength(1);
  expect(walls[0].b.y).toBeCloseTo(walls[0].a.y, 6);
  expect(walls[0].b.x - walls[0].a.x).toBeGreaterThan(3.5);
  // without it the same click gives a slanted wall
  await clickAt(page, 7.6, 5.4); // next corner, free
  walls = (await design(page)).walls;
  expect(Math.abs(walls[1].b.x - walls[1].a.x)).toBeGreaterThan(0.05);
  await page.keyboard.press('Escape');

  // the switch: no key needed
  await page.getByTestId('wall-ortho').check();
  await clickAt(page, 8, 2);
  await clickAt(page, 10.4, 3.7);
  walls = (await design(page)).walls;
  const last = walls[walls.length - 1];
  expect(Math.abs(last.b.x - last.a.x) < 1e-6 || Math.abs(last.b.y - last.a.y) < 1e-6).toBe(true);
});

test('a lawn drawn after a pond or a patio goes behind them, and in 3D it does not hide the pond', async ({ page }) => {
  await page.evaluate(() => {
    (window as any).__ph.design.getState().update((d: any) => {
      const F = d.floors[0].id;
      d.zones.push({ id: 'pond', floor: F, kind: 'water', name: '', color: '#bfe0f5', points: [{ x: 4, y: 3 }, { x: 7, y: 3 }, { x: 7, y: 5 }, { x: 4, y: 5 }] });
      d.zones.push({ id: 'patio', floor: F, kind: 'terrace', name: '', color: '#e4dccb', points: [{ x: 9, y: 3 }, { x: 11, y: 3 }, { x: 11, y: 5 }, { x: 9, y: 5 }] });
      // the lawn comes last, an L-shaped garden round both
      d.zones.push({ id: 'lawn', floor: F, kind: 'lawn', name: '', color: '#cfe8c4', points: [{ x: 1, y: 1 }, { x: 13, y: 1 }, { x: 13, y: 8 }, { x: 8, y: 8 }, { x: 8, y: 6 }, { x: 1, y: 6 }] });
    });
  });
  const fills = await page.evaluate(() => {
    const stage = (window as any).__ph.stage();
    return stage.find('Line').filter((l: any) => l.closed() && ['#bfe0f5', '#e4dccb', '#cfe8c4'].includes(l.fill())).map((l: any) => l.fill());
  });
  expect(fills[0]).toBe('#cfe8c4');
  expect(fills).toContain('#bfe0f5');
  expect(fills).toContain('#e4dccb');
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__ph3d?.stats().meshes ?? 0)).toBeGreaterThan(3);
  await page.evaluate(() => (window as any).__ph3d.scene.setView([7, 14, 14], [7, 0, 4]));
  await page.screenshot({ path: 'e2e/.results/m32-lawn-pond.png' });
});

test('the new catalog: categories, search, a worktop that snaps to a wall, an appliance that stands on it (3D)', async ({ page }) => {
  for (const cat of ['Built-in', 'Heating & cooling', 'People & pets', 'Window dressing']) await expect(page.getByTestId(`cat-${cat}`)).toHaveCount(1);
  await page.getByLabel('Search furniture').fill('coffee');
  await expect(page.getByTestId('furn-coffee-machine')).toBeVisible();
  await page.getByLabel('Search furniture').fill('');
  await page.evaluate(() => {
    (window as any).__ph.design.getState().update((d: any) => {
      d.walls.push({ id: 'n', floor: d.floors[0].id, a: { x: 1, y: 1 }, b: { x: 9, y: 1 }, thickness: 0.2, type: 'interior', height: 2.5 });
    });
  });
  await pickFurniture(page, 'worktop');
  await clickAt(page, 4, 1.5); // the cursor is south of the wall, within reach: the worktop goes on that face with its back to it
  let f = (await design(page)).furniture;
  expect(f).toHaveLength(1);
  expect(f[0].type).toBe('worktop');
  expect(f[0].y).toBeCloseTo(1 + 0.1 + 0.3, 1); // wall face + half the depth
  expect(((f[0].rotation % 360) + 360) % 360).toBeCloseTo(0, 5);
  await page.keyboard.press('Escape');
  await page.getByTestId('tool-select').click();
  await page.evaluate(() => {
    (window as any).__ph.design.getState().update((d: any) => {
      d.furniture.push({ id: 'cm', floor: d.floors[0].id, type: 'coffee-machine', x: f0x(d), y: 1.4, w: 0.3, d: 0.38, rotation: 0, color: '#374151', label: '' });
      function f0x(dd: any) { return dd.furniture[0].x; }
    });
  });
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__ph3d?.stats().meshes ?? 0)).toBeGreaterThan(10);
  await page.evaluate(() => (window as any).__ph3d.scene.setView([4, 2.2, 4.5], [4, 0.9, 1.4]));
  await page.screenshot({ path: 'e2e/.results/m32-worktop.png' });
});
