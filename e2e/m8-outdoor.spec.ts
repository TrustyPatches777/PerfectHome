import { test, expect } from '@playwright/test';
import { at, clickAt, design, dragWorld, drawBox, fresh, ui } from './helpers';

test.beforeEach(async ({ page }) => {
  await fresh(page);
  await page.getByTestId('tab-outdoor').click();
});

const viewport = (page: any) => page.evaluate(() => (window as any).__ph.ui.getState().viewport);

test('draw a lawn as a rectangle by dragging, then edit it', async ({ page }) => {
  await page.getByTestId('zone-lawn').click();
  await dragWorldRaw(page, [1.02, 1.03], [9.97, 6.01]);
  const d = await design(page);
  expect(d.zones).toHaveLength(1);
  expect(d.zones[0]).toMatchObject({ kind: 'lawn', name: 'Lawn', floor: d.floors[0].id });
  expect(d.zones[0].points).toEqual([
    { x: 1, y: 1 },
    { x: 10, y: 1 },
    { x: 10, y: 6 },
    { x: 1, y: 6 },
  ]);
  // it is selected afterwards, with its area shown (9 x 5 m)
  await expect(page.getByTestId('zone-area')).toContainText('45.00 m²');
  await page.getByTestId('zone-name').fill('Back garden');
  await page.getByTestId('zone-kind').selectOption('terrace');
  await page.getByRole('button', { name: 'Color #d9cdb5' }).click();
  expect((await design(page)).zones[0]).toMatchObject({ name: 'Back garden', kind: 'terrace', color: '#d9cdb5' });
});

test('click two corners also makes a rectangle; polygon mode draws any shape', async ({ page }) => {
  await page.getByTestId('zone-driveway').click();
  await clickAt(page, 2, 2);
  await clickAt(page, 6, 4);
  expect((await design(page)).zones).toHaveLength(1);
  expect((await design(page)).zones[0].kind).toBe('driveway');

  await page.getByTestId('zone-flowerbed').click();
  await page.getByTestId('zone-poly').click();
  await clickAt(page, 8, 2);
  await clickAt(page, 10, 2);
  await clickAt(page, 10, 4);
  await page.keyboard.press('Enter');
  const d = await design(page);
  expect(d.zones).toHaveLength(2);
  expect(d.zones[1].kind).toBe('flowerbed');
  expect(d.zones[1].points).toHaveLength(3);
});

test('streets, paths, fences and hedges are lines with a width', async ({ page }) => {
  await page.getByTestId('strip-road').click();
  await expect(page.getByTestId('opt-strip-width')).toHaveValue('600');
  await clickAt(page, 0, 8);
  await clickAt(page, 6, 8);
  await clickAt(page, 12, 7);
  await page.keyboard.press('Enter');
  let d = await design(page);
  expect(d.strips).toHaveLength(1);
  expect(d.strips[0]).toMatchObject({ kind: 'road', width: 6 });
  expect(d.strips[0].points).toHaveLength(3);
  await expect(page.getByTestId('strip-length')).toContainText('12.');

  await page.getByTestId('tab-outdoor').click();
  await page.getByTestId('strip-fence').click();
  await clickAt(page, 0, 1);
  await clickAt(page, 12, 1);
  await page.keyboard.press('Enter');
  d = await design(page);
  expect(d.strips[1]).toMatchObject({ kind: 'fence', width: 0.1 });

  await page.getByTestId('strip-hedge').click();
  await page.getByTestId('opt-strip-width').fill('80');
  await page.getByTestId('opt-strip-width').press('Enter');
  await clickAt(page, 0, 2);
  await clickAt(page, 4, 2);
  await page.keyboard.press('Enter');
  d = await design(page);
  expect(d.strips[2]).toMatchObject({ kind: 'hedge', width: 0.8 });

  // edit the selected hedge
  await page.getByTestId('strip-width').fill('50');
  await page.getByTestId('strip-width').press('Enter');
  expect((await design(page)).strips[2].width).toBe(0.5);
  await page.getByTestId('strip-kind').selectOption('path');
  expect((await design(page)).strips[2].kind).toBe('path');
  // a single click does not make a line
  await page.getByTestId('strip-path').click();
  await clickAt(page, 5, 5);
  await page.keyboard.press('Escape');
  expect((await design(page)).strips).toHaveLength(3);
});

test('big areas do not trap the mouse: drag over them pans, click selects, drag when selected moves', async ({ page }) => {
  await page.getByTestId('zone-lawn').click();
  await dragWorldRaw(page, [0, 0], [12, 8]);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  expect((await ui(page)).selection).toBeNull();

  // drag inside the (unselected) lawn: the plan pans, nothing moves, nothing selected
  const v0 = await viewport(page);
  await dragWorld(page, [5, 4], [6, 5]);
  const v1 = await viewport(page);
  expect(v1.x - v0.x).toBeCloseTo(60, 0);
  expect((await design(page)).zones[0].points[0]).toEqual({ x: 0, y: 0 });
  expect((await ui(page)).selection).toBeNull();

  // a plain click selects it
  await clickAt(page, 5, 4);
  expect((await ui(page)).selection?.kind).toBe('zone');

  // now dragging moves it (snapped to the grid)
  await dragWorld(page, [5, 4], [6, 5]);
  expect((await design(page)).zones[0].points[0]).toEqual({ x: 1, y: 1 });
  expect((await viewport(page)).x).toBe(v1.x);
  await page.keyboard.press('Control+z');
  expect((await design(page)).zones[0].points[0]).toEqual({ x: 0, y: 0 });

  // corner handle resizes
  await dragWorld(page, [12, 8], [13, 9]);
  expect((await design(page)).zones[0].points[2]).toEqual({ x: 13, y: 9 });
});

test('rooms also pan when dragged over, and still select on click', async ({ page }) => {
  await page.getByTestId('tab-furniture').click();
  await drawBox(page, 1, 1, 7, 5);
  await page.getByTestId('tool-room').click();
  await clickAt(page, 4, 3);
  await page.getByTestId('tool-select').click();
  await page.keyboard.press('Escape');
  const v0 = await viewport(page);
  await dragWorld(page, [4, 3], [5, 3]);
  expect((await viewport(page)).x - v0.x).toBeCloseTo(60, 0);
  await clickAt(page, 4, 3);
  expect((await ui(page)).selection?.kind).toBe('room');
});

test('the outdoor layer can be locked or hidden, and zones belong to their floor', async ({ page }) => {
  await page.getByTestId('zone-lawn').click();
  await dragWorldRaw(page, [1, 1], [6, 5]);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.getByTestId('lock-outdoor').click();
  await clickAt(page, 3, 3);
  expect((await ui(page)).selection).toBeNull();
  await page.getByTestId('zone-terrace').click();
  await dragWorldRaw(page, [7, 1], [9, 3]);
  expect((await design(page)).zones).toHaveLength(1);
  await expect(page.locator('.statusbar')).toContainText('locked');
  await page.keyboard.press('Escape');
  await page.getByTestId('lock-outdoor').click();

  // a new floor starts without the garden
  await page.getByTestId('add-floor').click();
  await clickAt(page, 3, 3);
  expect((await ui(page)).selection).toBeNull();
  await page.keyboard.press('PageDown');
  await clickAt(page, 3, 3);
  expect((await ui(page)).selection?.kind).toBe('zone');
});

/** A raw press-drag-release with the tool already active (no select-tool semantics). */
async function dragWorldRaw(page: any, from: [number, number], to: [number, number]) {
  const a = await at(page, ...from);
  const b = await at(page, ...to);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 4 });
  await page.mouse.move(b.x, b.y, { steps: 4 });
  await page.mouse.up();
}
