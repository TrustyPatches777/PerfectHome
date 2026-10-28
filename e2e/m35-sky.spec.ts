import { test, expect, type Page } from '@playwright/test';
import { design, fresh } from './helpers';

/* eslint-disable @typescript-eslint/no-explicit-any */

test.beforeEach(async ({ page }) => {
  await fresh(page);
});

const edit = (page: Page, body: string) => page.evaluate(`window.__ph.design.getState().update((d) => { ${body} })`);

test('the sky panel sets the weather, the season and the horizon, and neighbours are in the furniture list', async ({ page }) => {
  await page.getByTestId('sky-panel').locator('summary').click();
  await page.getByTestId('site-weather').selectOption('snow');
  await page.getByTestId('site-season').selectOption('winter');
  await page.getByTestId('site-horizon').selectOption('mountains');
  expect((await design(page)).site).toMatchObject({ weather: 'snow', season: 'winter', horizon: 'mountains' });
  await page.getByTestId('site-weather').selectOption('clear');
  await page.getByTestId('site-season').selectOption('auto');
  await page.getByTestId('site-horizon').selectOption('none');
  const s = (await design(page)).site;
  expect([s.weather, s.season, s.horizon]).toEqual([undefined, undefined, undefined]);
  // the season "from the date" says which it is
  await expect(page.getByTestId('site-season').locator('option[value="auto"]')).toContainText('summer'); // 21 June
  await expect(page.getByTestId('cat-Surroundings')).toHaveCount(1);
  await page.getByLabel('Search furniture').fill('apartment');
  await expect(page.getByTestId('furn-nb-block')).toBeVisible();
});

test('3D: weather, season and horizon change what you see, and the panel works in 3D too', async ({ page }) => {
  await edit(page, `
    const F = d.floors[0].id;
    d.furniture.push({ id: 't', floor: F, type: 'tree-oak', x: 4, y: 6, w: 5, d: 5, rotation: 0, color: '#4f9d5d', label: '' });
    d.furniture.push({ id: 'n', floor: F, type: 'nb-house', x: -10, y: 0, w: 9, d: 7.5, rotation: 0, color: '#e8e0d0', label: '' });`);
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__ph3d?.stats().meshes ?? 0)).toBeGreaterThan(5);
  const meshes = () => page.evaluate(() => (window as any).__ph3d.stats().meshes as number);
  const clear = await meshes();
  await page.getByTestId('sky-panel').locator('summary').click();
  await page.getByTestId('site-horizon').selectOption('city');
  await expect.poll(meshes).toBeGreaterThan(clear + 80); // the skyline
  await page.getByTestId('site-horizon').selectOption('hills');
  await page.getByTestId('site-season').selectOption('winter');
  await page.getByTestId('site-weather').selectOption('snow');
  await page.evaluate(() => (window as any).__ph3d.scene.setView([4, 5, 22], [4, 3, 2]));
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'e2e/.results/m35-winter-snow.png' });
  await page.getByTestId('site-weather').selectOption('rain');
  await page.getByTestId('site-season').selectOption('autumn');
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'e2e/.results/m35-autumn-rain.png' });
  expect((await design(page)).site).toMatchObject({ weather: 'rain', season: 'autumn', horizon: 'hills' });
});
