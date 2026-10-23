import { test, expect } from '@playwright/test';
import { clickAt, design, drawBox, fresh, moveTo, pickFurniture, ui } from './helpers';

test.beforeEach(async ({ page }) => {
  await fresh(page);
});

test('sockets and switches snap flat onto the wall face on the side of the cursor', async ({ page }) => {
  await drawBox(page, 1, 1, 7, 5); // 15 cm walls
  await pickFurniture(page, 'socket');
  await moveTo(page, 3, 1.5);
  await clickAt(page, 3, 1.5); // inside the room, below the top wall
  await page.keyboard.press('Escape');
  await pickFurniture(page, 'switch');
  await clickAt(page, 5, 0.6); // outside, above the top wall
  const f = (await design(page)).furniture;
  expect(f).toHaveLength(2);
  expect(f[0]).toMatchObject({ type: 'socket', rotation: 0 });
  expect(f[0].x).toBeCloseTo(3, 0);
  expect(f[0].y).toBeCloseTo(1 + 0.075 + 0.05, 5); // wall face + half the symbol's depth
  expect(f[1]).toMatchObject({ type: 'switch', rotation: 180 });
  expect(f[1].y).toBeCloseTo(1 - 0.075 - 0.05, 5);

  // away from any wall it is placed where you click
  await pickFurniture(page, 'tap');
  await clickAt(page, 4, 3);
  const tap = (await design(page)).furniture[2];
  expect(tap).toMatchObject({ type: 'tap', x: 4, y: 3 });
});

test('lamps, electrical and plumbing live on their own layer that can be hidden or locked', async ({ page }) => {
  await pickFurniture(page, 'lamp-ceiling');
  await clickAt(page, 3, 3);
  await expect(page.getByTestId('lamp-on')).toBeChecked();
  await page.getByTestId('lamp-on').uncheck();
  expect((await design(page)).furniture[0].on).toBe(false);
  await page.getByTestId('lamp-on').check();
  expect((await design(page)).furniture[0].on).toBeUndefined();
  await page.keyboard.press('Escape');

  await pickFurniture(page, 'sofa');
  await clickAt(page, 6, 3);
  await page.keyboard.press('Escape');

  // locking the furniture layer leaves the lamp alone, locking the tech layer protects it
  await page.getByTestId('lock-furniture').click();
  await clickAt(page, 6, 3);
  expect((await ui(page)).selection).toBeNull();
  await clickAt(page, 3, 3);
  expect((await ui(page)).selection?.kind).toBe('furniture');
  await page.keyboard.press('Escape');
  await page.getByTestId('lock-furniture').click();
  await page.getByTestId('lock-tech').click();
  await clickAt(page, 3, 3);
  expect((await ui(page)).selection).toBeNull();
  await clickAt(page, 6, 3);
  expect((await ui(page)).selection?.kind).toBe('furniture');
  await page.keyboard.press('Escape');
  // cannot add new symbols to a locked layer
  await pickFurniture(page, 'socket');
  await clickAt(page, 8, 3);
  expect((await design(page)).furniture).toHaveLength(2);
  await expect(page.locator('.statusbar')).toContainText('locked');
  await page.keyboard.press('Escape');

  // hidden: not drawn and not clickable
  await page.getByTestId('lock-tech').click();
  await page.getByTestId('hide-tech').click();
  await clickAt(page, 3, 3);
  expect((await ui(page)).selection).toBeNull();
  await page.getByTestId('hide-tech').click();
  await clickAt(page, 3, 3);
  expect((await ui(page)).selection?.kind).toBe('furniture');
});

test('the palette has Lighting, Electrical and Plumbing sections', async ({ page }) => {
  for (const cat of ['Lighting', 'Electrical', 'Plumbing']) {
    await expect(page.getByTestId(`cat-${cat}`)).toBeVisible();
  }
  await page.getByTestId('cat-Electrical').click();
  await expect(page.getByTestId('furn-socket')).toBeVisible();
  await expect(page.getByTestId('furn-data-point')).toBeVisible();
  await page.getByLabel('Search furniture').fill('lamp');
  await expect(page.getByTestId('furn-lamp-table')).toBeVisible();
  await expect(page.getByTestId('furn-floor-lamp')).toBeVisible();
});
