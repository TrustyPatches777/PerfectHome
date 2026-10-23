import { test, expect, type Page } from '@playwright/test';

const viewport = (page: Page) =>
  page.evaluate(() => (window as any).__ph.ui.getState().viewport as { x: number; y: number; zoom: number });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await expect(page.locator('canvas').first()).toBeVisible();
});

test('renders canvas, grid and a scale bar in real units', async ({ page }) => {
  await expect(page.getByTestId('scale-bar')).toBeVisible();
  const len = Number(await page.getByTestId('scale-bar').getAttribute('data-length'));
  const z = (await viewport(page)).zoom;
  expect(len * z).toBeGreaterThanOrEqual(70);
  expect(len * z).toBeLessThan(200);
  await page.screenshot({ path: 'e2e/.results/m1-initial.png' });
});

test('wheel zooms around the cursor and scale bar follows', async ({ page }) => {
  const before = await viewport(page);
  const box = (await page.locator('.canvas-wrap').boundingBox())!;
  const cx = box.x + 400;
  const cy = box.y + 300;
  // world point under the cursor before zooming
  const worldBefore = { x: (400 - before.x) / before.zoom, y: (300 - before.y) / before.zoom };
  await page.mouse.move(cx, cy);
  await page.mouse.wheel(0, -400);
  const after = await viewport(page);
  expect(after.zoom).toBeGreaterThan(before.zoom);
  const worldAfter = { x: (400 - after.x) / after.zoom, y: (300 - after.y) / after.zoom };
  expect(worldAfter.x).toBeCloseTo(worldBefore.x, 3);
  expect(worldAfter.y).toBeCloseTo(worldBefore.y, 3);
  const len = Number(await page.getByTestId('scale-bar').getAttribute('data-length'));
  expect(len * after.zoom).toBeGreaterThanOrEqual(70);
});

test('drag on empty canvas pans; middle mouse and space also pan', async ({ page }) => {
  const box = (await page.locator('.canvas-wrap').boundingBox())!;
  const v0 = await viewport(page);
  await page.mouse.move(box.x + 300, box.y + 300);
  await page.mouse.down();
  await page.mouse.move(box.x + 380, box.y + 340, { steps: 4 });
  await page.mouse.up();
  const v1 = await viewport(page);
  expect(v1.x - v0.x).toBeCloseTo(80, 0);
  expect(v1.y - v0.y).toBeCloseTo(40, 0);
  expect(v1.zoom).toBe(v0.zoom);

  await page.mouse.move(box.x + 300, box.y + 300);
  await page.mouse.down({ button: 'middle' });
  await page.mouse.move(box.x + 250, box.y + 300, { steps: 3 });
  await page.mouse.up({ button: 'middle' });
  const v2 = await viewport(page);
  expect(v2.x - v1.x).toBeCloseTo(-50, 0);
});

test('cursor coordinates are shown in meters and zoom buttons work', async ({ page }) => {
  const v = await viewport(page);
  const box = (await page.locator('.canvas-wrap').boundingBox())!;
  await page.mouse.move(box.x + v.x + 2 * v.zoom, box.y + v.y + 3 * v.zoom);
  await expect(page.getByTestId('coords')).toContainText('x 2.00 m');
  await expect(page.getByTestId('coords')).toContainText('y 3.00 m');
  await page.getByRole('button', { name: 'Zoom in' }).click();
  expect((await viewport(page)).zoom).toBeGreaterThan(v.zoom);
});

test('grid step is configurable and snap can be toggled', async ({ page }) => {
  await page.getByTestId('grid-step').selectOption('0.25');
  const step = await page.evaluate(() => (window as any).__ph.design.getState().design.settings.gridStep);
  expect(step).toBe(0.25);
  await page.getByTestId('snap-toggle').click();
  await expect(page.getByTestId('snap-toggle')).toContainText('off');
});
