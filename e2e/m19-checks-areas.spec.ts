import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import { clickAt, design, dragWorld, drawBox, fresh, pickFurniture, ui } from './helpers';

/* eslint-disable @typescript-eslint/no-explicit-any */

test.beforeEach(async ({ page }) => {
  await fresh(page);
  await page.evaluate(() => (window as any).__ph.ui.getState().setViewport({ x: 160, y: 120, zoom: 40 }));
});

async function livingRoom(page: Page) {
  await drawBox(page, 1, 1, 8, 6);
  await page.getByTestId('tool-room').click();
  await clickAt(page, 4, 3);
  await page.getByTestId('tool-door').click();
  await clickAt(page, 4, 1.3); // door in the top wall, swinging down into the room
  await page.getByTestId('tool-select').click();
  await page.keyboard.press('Escape');
}

test('plan check: a blocked door shows up, can be selected from the list, and clears when fixed', async ({ page }) => {
  await livingRoom(page);
  await expect(page.getByTestId('checks-panel')).toBeVisible();
  await page.getByTestId('checks-toggle').check();
  await expect(page.getByTestId('issue-count')).toHaveText('all clear');

  await pickFurniture(page, 'wardrobe');
  await clickAt(page, 4, 1.7); // right in front of the door
  await page.keyboard.press('Escape');
  // the door cannot open, and the wardrobe is only 60 cm from the wall: two things to look at
  await expect(page.getByTestId('issue-count')).toHaveText('2 to look at');
  await expect(page.getByTestId('checks-panel')).toContainText('cannot open fully: Wardrobe');
  await page.screenshot({ path: 'e2e/.results/m19-check.png' });

  await page.keyboard.press('Escape');
  await page.getByTestId('issue').first().click(); // selects what is in the way
  expect((await ui(page)).selection?.kind).toBe('furniture');
  await dragWorld(page, [4, 1.7], [4, 4]);
  await expect(page.getByTestId('issue-count')).toHaveText('all clear');
  await page.getByTestId('checks-toggle').uncheck();
  await expect(page.getByTestId('issue-count')).toHaveCount(0);
});

test('plan check: narrow passages follow the minimum you set; furniture inside a wall is flagged', async ({ page }) => {
  await livingRoom(page);
  await page.getByTestId('checks-toggle').check();
  await pickFurniture(page, 'wardrobe');
  await clickAt(page, 2.0, 3.5); // 1.8 x 0.6 against the left wall
  await pickFurniture(page, 'sofa');
  await clickAt(page, 2.1, 4.65); // 2 x 0.9, against the wall, leaving a 40 cm gap: (4.65 - 0.45) - (3.5 + 0.3)
  await page.keyboard.press('Escape');
  const text = await page.getByTestId('checks-panel').innerText();
  expect(text).toMatch(/Only \d+ cm between Wardrobe and Sofa/);
  await page.getByTestId('min-passage').fill('30');
  await page.getByTestId('min-passage').press('Enter');
  await expect(page.getByTestId('issue-count')).toHaveText('all clear');

  // a bed pushed into the bottom wall
  await pickFurniture(page, 'bed-double');
  await clickAt(page, 6.5, 5.6);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('checks-panel')).toContainText('overlaps a wall');
});

test('area table: rooms per floor, living area, outdoor areas and plot figures', async ({ page }) => {
  await livingRoom(page);
  // a second room beside it, flagged as not living area
  await drawBox(page, 9, 1, 13, 6);
  await page.getByTestId('tool-room').click();
  await clickAt(page, 11, 3);
  await page.getByTestId('room-name').fill('Garage');
  await page.getByTestId('room-living').uncheck();
  await page.keyboard.press('Escape');
  await page.getByTestId('tab-outdoor').click();
  await page.getByTestId('zone-plot').click();
  await dragWorldRaw(page, [0, 0], [15, 9]);
  await page.getByTestId('zone-lawn').click();
  await dragWorldRaw(page, [1, 6.5], [8, 8.5]);

  await page.getByTestId('file-menu').click();
  await page.getByTestId('menu-areas').click();
  const dialog = page.getByTestId('area-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId('area-floor-Ground floor')).toContainText('Garage');
  // inner sizes: (7 - 0.15) x (5 - 0.15) = 33.22, (4 - 0.15) x (5 - 0.15) = 18.67
  await expect(dialog.getByTestId('area-totals')).toContainText('51.9');
  await expect(dialog.getByTestId('area-living')).toContainText('33.22 m²');
  await expect(dialog).toContainText('Lawn');
  await expect(dialog.getByTestId('plot-area')).toHaveText('135.00 m²');
  await expect(dialog.getByTestId('plot-footprint')).toContainText(/58\.\d\d m²/); // outer size of both houses: 7.15 x 5.15 + 4.15 x 5.15
  await expect(dialog.getByTestId('plot-coverage')).toContainText(/4\d\.\d %/);
  const edges = dialog.getByTestId('plot-edge');
  await expect(edges).toHaveCount(4);
  await expect(edges.first()).toContainText(/0\.9[23] m/); // top wall's outer face (y = 0.925) to the plot's top edge at y = 0
  await page.screenshot({ path: 'e2e/.results/m19-areas.png' });

  // distances can be drawn on the plan
  await dialog.getByTestId('show-setbacks').check();
  expect((await ui(page)).showSetbacks).toBe(true);

  // copy as text, and CSV
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await dialog.getByTestId('area-copy').click();
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  expect(clip).toContain('Garage: 18.67 m² (not counted as living area)');
  const [dl] = await Promise.all([page.waitForEvent('download'), dialog.getByTestId('area-csv').click()]);
  expect(dl.suggestedFilename()).toBe('my-home-areas.csv');
  const csv = fs.readFileSync((await dl.path())!, 'utf8');
  expect(csv.split('\r\n')[0]).toBe('Floor,Room,Area (m2),Living area');
  expect(csv).toContain('Ground floor,Garage,18.67,no');
  expect(csv).toContain('Ground floor,Room 1,33.22,yes');
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).toHaveCount(0);

  // editing the plan changes the numbers
  await clickAt(page, 4, 3);
  await page.getByTestId('room-living').uncheck();
  await page.keyboard.press('Escape');
  await page.getByTestId('file-menu').click();
  await page.getByTestId('menu-areas').click();
  await expect(page.getByTestId('area-living')).toContainText('0.00 m²');
  expect((await design(page)).rooms.filter((r: any) => r.living)).toHaveLength(0);
});

async function dragWorldRaw(page: Page, from: [number, number], to: [number, number]) {
  const v = await page.evaluate(() => (window as any).__ph.ui.getState().viewport);
  const box = (await page.locator('.canvas-wrap').boundingBox())!;
  const px = (w: [number, number]) => ({ x: box.x + v.x + w[0] * v.zoom, y: box.y + v.y + w[1] * v.zoom });
  const a = px(from);
  const b = px(to);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 4 });
  await page.mouse.move(b.x, b.y, { steps: 4 });
  await page.mouse.up();
}
