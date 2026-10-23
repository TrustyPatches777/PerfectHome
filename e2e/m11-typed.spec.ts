import { test, expect } from '@playwright/test';
import { clickAt, design, fresh, moveTo, ui } from './helpers';

test.beforeEach(async ({ page }) => {
  await fresh(page);
});

test('type exact wall lengths: meters, centimeters, units and angles', async ({ page }) => {
  await page.getByTestId('tool-wall').click();
  await clickAt(page, 1, 1);
  await moveTo(page, 6, 1); // direction: to the right
  await page.keyboard.type('3.5');
  await expect(page.getByTestId('typed-box')).toBeVisible();
  await expect(page.getByTestId('typed-box')).toContainText('= 3.5 m');
  await page.keyboard.press('Enter');
  let d = await design(page);
  expect(d.walls).toHaveLength(1);
  expect(d.walls[0].a).toEqual({ x: 1, y: 1 });
  expect(d.walls[0].b).toEqual({ x: 4.5, y: 1 });
  await expect(page.getByTestId('typed-box')).toHaveCount(0);

  // whole numbers from 30 up are centimeters; the chain continues from the last corner
  await moveTo(page, 4.5, 6); // now toward the bottom
  await page.keyboard.type('250');
  await expect(page.getByTestId('typed-box')).toContainText('= 2.5 m');
  await page.keyboard.press('Enter');
  d = await design(page);
  expect(d.walls[1].b).toEqual({ x: 4.5, y: 3.5 });

  // explicit unit and angle; the "m" must not switch to the measure tool
  await page.keyboard.type('2.4m<180');
  await expect(page.getByTestId('typed-box')).toContainText('2.4 m at 180°');
  expect((await ui(page)).tool).toBe('wall');
  await page.keyboard.press('Enter');
  d = await design(page);
  expect(d.walls[2].b.x).toBeCloseTo(2.1, 6);
  expect(d.walls[2].b.y).toBeCloseTo(3.5, 6);
  expect(d.walls).toHaveLength(3);
  await page.screenshot({ path: 'e2e/.results/m11-typed.png' });
});

test('typing can be corrected and cancelled without ending the wall', async ({ page }) => {
  await page.getByTestId('tool-wall').click();
  await clickAt(page, 1, 1);
  await moveTo(page, 5, 1);
  await page.keyboard.type('3.5<');
  await page.keyboard.press('Enter'); // not understood: nothing is drawn, the text stays
  await expect(page.locator('.statusbar')).toContainText('Could not read');
  expect((await design(page)).walls).toHaveLength(0);
  await expect(page.getByTestId('typed-text')).toHaveText('3.5<');
  await page.keyboard.press('Backspace');
  await page.keyboard.press('Backspace');
  await page.keyboard.type('2');
  await expect(page.getByTestId('typed-text')).toHaveText('3.2');
  await page.keyboard.press('Escape'); // cancels the typing only
  await expect(page.getByTestId('typed-box')).toHaveCount(0);
  expect((await ui(page)).tool).toBe('wall');
  await clickAt(page, 5, 1); // the wall is still being drawn
  expect((await design(page)).walls).toHaveLength(1);
});

test('rectangles by size, and measurements by length', async ({ page }) => {
  await page.getByTestId('tab-outdoor').click();
  await page.getByTestId('zone-lawn').click();
  await clickAt(page, 1, 1);
  await moveTo(page, 8, 6);
  await page.keyboard.type('5x3');
  await expect(page.getByTestId('typed-box')).toContainText('5 m × 3 m');
  await page.keyboard.press('Enter');
  let d = await design(page);
  expect(d.zones).toHaveLength(1);
  expect(d.zones[0].points).toEqual([
    { x: 1, y: 1 },
    { x: 6, y: 1 },
    { x: 6, y: 4 },
    { x: 1, y: 4 },
  ]);

  await page.getByTestId('tool-measure').click();
  await clickAt(page, 1, 8);
  await moveTo(page, 6, 8);
  await page.keyboard.type('2.4m');
  await page.keyboard.press('Enter');
  d = await design(page);
  expect(d.dimensions).toHaveLength(1);
  expect(d.dimensions[0].b).toEqual({ x: 3.4, y: 8 });
});
