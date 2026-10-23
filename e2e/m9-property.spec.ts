import { test, expect } from '@playwright/test';
import { clickAt, design, drawBox, fresh, moveTo, pickFurniture, ui } from './helpers';

test.beforeEach(async ({ page }) => {
  await fresh(page);
});

test('the furniture palette has collapsible categories, search, and the new vehicle and garden items', async ({ page }) => {
  // Bedroom and Living start open, the rest are collapsed
  await expect(page.getByTestId('cat-Bedroom')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByTestId('cat-Outdoor')).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByTestId('furn-tree')).toHaveCount(0);
  await page.getByTestId('cat-Outdoor').click();
  await expect(page.getByTestId('furn-tree')).toBeVisible();
  await expect(page.getByTestId('furn-tree')).toHaveAttribute('title', /300 × 300 cm/);
  await page.getByTestId('cat-Outdoor').click();
  await expect(page.getByTestId('furn-tree')).toHaveCount(0);

  // searching opens everything that matches
  await page.getByLabel('Search furniture').fill('car');
  await expect(page.getByTestId('furn-car')).toBeVisible();
  await expect(page.getByTestId('furn-car-small')).toBeVisible();
  await expect(page.getByTestId('furn-sofa')).toHaveCount(0);
  await page.getByLabel('Search furniture').fill('zzz');
  await expect(page.getByTestId('furn-car')).toHaveCount(0);
  await page.getByLabel('Search furniture').fill('');

  // a car has realistic dimensions and can be rotated like any furniture
  await pickFurniture(page, 'car');
  await clickAt(page, 4, 3);
  let f = (await design(page)).furniture[0];
  expect(f).toMatchObject({ type: 'car', w: 4.5, d: 1.9 });
  await page.keyboard.press('r');
  f = (await design(page)).furniture[0];
  expect(f.rotation).toBe(90);
});

test('a whole property: house with attached garage, driveway, street, fence, garden', async ({ page }) => {
  const drag = async (from: [number, number], to: [number, number]) => {
    await moveTo(page, ...from);
    await page.mouse.down();
    await moveTo(page, (from[0] + to[0]) / 2, (from[1] + to[1]) / 2);
    await moveTo(page, ...to);
    await page.mouse.up();
  };
  await page.getByTestId('tool-select').click();
  // zoom out so the whole 30 x 22 m property fits on screen
  await page.evaluate(() => (window as any).__ph.ui.getState().setViewport({ x: 160, y: 40, zoom: 26 }));

  // --- outdoors, drawn from the bottom layer up
  await page.getByTestId('tab-outdoor').click();
  await page.getByTestId('zone-plot').click();
  await drag([0, 0], [24, 14]);
  await page.getByTestId('zone-lawn').click();
  await drag([0.5, 9.5], [12.5, 13.5]);
  await page.getByTestId('zone-lawn').click();
  await drag([18.5, 0.5], [23.5, 13.5]);
  await page.getByTestId('zone-driveway').click();
  await drag([13, 9.5], [18, 14]);
  await page.getByTestId('zone-terrace').click();
  await drag([2, 0.5], [10, 1.8]);
  await page.getByTestId('strip-road').click();
  await clickAt(page, -4, 17.5);
  await clickAt(page, 12, 17.5);
  await clickAt(page, 28, 17);
  await page.keyboard.press('Enter');
  await page.getByTestId('tab-outdoor').click();
  await page.getByTestId('strip-fence').click();
  for (const [x, y] of [[0, 0], [24, 0], [24, 14], [18, 14]]) await clickAt(page, x, y);
  await page.keyboard.press('Enter');
  await page.getByTestId('tab-outdoor').click();
  await page.getByTestId('strip-fence').click();
  for (const [x, y] of [[13, 14], [0, 14], [0, 0]]) await clickAt(page, x, y);
  await page.keyboard.press('Enter');
  await page.getByTestId('tab-outdoor').click();
  await page.getByTestId('strip-path').click();
  await page.getByTestId('opt-strip-width').fill('120');
  await page.getByTestId('opt-strip-width').press('Enter');
  await clickAt(page, 7, 14);
  await clickAt(page, 7, 9.5);
  await page.keyboard.press('Enter');
  await page.getByTestId('tab-outdoor').click();
  await page.getByTestId('strip-hedge').click();
  await clickAt(page, 1, 9);
  await clickAt(page, 5, 9);
  await page.keyboard.press('Enter');

  // --- house and garage
  await page.getByTestId('tab-furniture').click();
  await drawBox(page, 2, 3, 12, 9.5);
  await drawBox(page, 12, 3, 18, 9.5);
  // the shared wall x=12 is drawn twice: fine for the picture, remove the duplicate right wall of the house
  await page.getByTestId('tool-room').click();
  await clickAt(page, 7, 6);
  await clickAt(page, 15, 6);
  await page.getByTestId('tool-door').click();
  await page.getByTestId('door-kind-garage').click();
  await clickAt(page, 15, 9.2);
  await page.getByTestId('door-kind-door').click();
  await clickAt(page, 7, 9.2);
  await page.getByTestId('tool-window').click();
  await clickAt(page, 4.5, 3.3);
  await clickAt(page, 10, 3.3);
  await page.getByTestId('tool-select').click();

  // --- things
  await pickFurniture(page, 'suv');
  await page.keyboard.press('r');
  await clickAt(page, 15.5, 12);
  await pickFurniture(page, 'car-small');
  await clickAt(page, 15, 6);
  await pickFurniture(page, 'tree');
  await clickAt(page, 3, 12);
  await pickFurniture(page, 'tree-large');
  await clickAt(page, 21, 4);
  await pickFurniture(page, 'patio-set');
  await clickAt(page, 21, 10);
  await pickFurniture(page, 'bush');
  await clickAt(page, 9, 11);
  await pickFurniture(page, 'bbq');
  await clickAt(page, 6, 1.2);
  await pickFurniture(page, 'sofa');
  await clickAt(page, 5, 6);
  await pickFurniture(page, 'bed-king');
  await clickAt(page, 9.5, 5);
  await pickFurniture(page, 'workbench');
  await clickAt(page, 16.5, 3.8);

  const d = await design(page);
  expect(d.zones).toHaveLength(5);
  expect(d.strips).toHaveLength(5);
  expect(d.rooms).toHaveLength(2);
  expect(d.openings.map((o: any) => o.kind).sort()).toEqual(['door', 'garage', 'window', 'window']);
  expect(d.furniture.length).toBe(10);
  await page.keyboard.press('Escape');
  await page.keyboard.press('f');
  await page.screenshot({ path: 'e2e/.results/m9-property.png' });
  expect((await ui(page)).tool).toBe('select');
});
