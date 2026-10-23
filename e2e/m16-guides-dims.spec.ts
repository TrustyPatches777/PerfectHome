import { test, expect, type Page } from '@playwright/test';
import { at, clickAt, design, drawBox, fresh, pickFurniture, ui } from './helpers';

test.beforeEach(async ({ page }) => {
  await fresh(page);
});

/** Press on a ruler and drag to a world position (only the part of the position that matters is used). */
async function dragFromRuler(page: Page, ruler: 'ruler-top' | 'ruler-left', toWorld: [number, number]) {
  const box = (await page.getByTestId(ruler).boundingBox())!;
  const target = await at(page, ...toWorld);
  const startX = ruler === 'ruler-top' ? target.x : box.x + 10;
  const startY = ruler === 'ruler-top' ? box.y + 10 : target.y;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 6 });
  await page.mouse.up();
}

test('rulers are shown and track the cursor', async ({ page }) => {
  await expect(page.getByTestId('ruler-top')).toBeVisible();
  await expect(page.getByTestId('ruler-left')).toBeVisible();
  const top = (await page.getByTestId('ruler-top').boundingBox())!;
  const wrap = (await page.locator('.canvas-wrap').boundingBox())!;
  expect(top.y).toBeCloseTo(wrap.y, 0);
  expect(top.height).toBe(22);
  await page.screenshot({ path: 'e2e/.results/m16-rulers.png' });
});

test('pull guides out of the rulers, snap to them, move them, and drag them back to remove', async ({ page }) => {
  await dragFromRuler(page, 'ruler-top', [4, 3.04]);
  await dragFromRuler(page, 'ruler-left', [6.97, 4]);
  let d = await design(page);
  expect(d.guides.map((g: any) => [g.axis, g.pos])).toEqual([
    ['y', 3],
    ['x', 7],
  ]);

  // things snap to guides: a chair dropped close to the crossing lands exactly on it
  await pickFurniture(page, 'chair');
  await clickAt(page, 7.08, 2.92);
  d = await design(page);
  expect(d.furniture[0].x).toBe(7);
  expect(d.furniture[0].y).toBe(3);
  await page.keyboard.press('Escape');

  // a click selects a guide; its position can be typed
  await clickAt(page, 2, 3); // on the horizontal guide, away from other things
  expect((await ui(page)).selection?.kind).toBe('guide');
  await expect(page.getByTestId('guide-pos')).toHaveValue('300');
  await page.getByTestId('guide-pos').fill('350');
  await page.getByTestId('guide-pos').press('Enter');
  expect((await design(page)).guides[0].pos).toBe(3.5);

  // drag it to a new place
  const a = await at(page, 2, 3.5);
  const b = await at(page, 2, 2);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 5 });
  await page.mouse.up();
  expect((await design(page)).guides[0].pos).toBe(2);

  // drag it back onto the ruler: removed; undo brings it back
  const c = await at(page, 2, 2);
  const ruler = (await page.getByTestId('ruler-top').boundingBox())!;
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  await page.mouse.move(c.x, ruler.y + 8, { steps: 6 });
  await page.mouse.up();
  expect((await design(page)).guides.map((g: any) => g.axis)).toEqual(['x']);
  await page.keyboard.press('Control+z');
  expect((await design(page)).guides).toHaveLength(2);

  // Delete removes the selected one
  await clickAt(page, 2, 2);
  await page.keyboard.press('Delete');
  expect((await design(page)).guides).toHaveLength(1);
});

test('guides follow the layer lock and the View menu; view choices are remembered', async ({ page }) => {
  await dragFromRuler(page, 'ruler-left', [5, 4]);
  expect((await design(page)).guides).toHaveLength(1);

  await page.getByTestId('lock-notes').click();
  await clickAt(page, 5, 6);
  expect((await ui(page)).selection).toBeNull();
  await page.getByTestId('lock-notes').click();

  // guides off: no longer snapped to
  await page.getByTestId('view-menu').click();
  await page.getByTestId('view-guides').locator('input').uncheck();
  await page.keyboard.press('Escape');
  await pickFurniture(page, 'chair');
  await clickAt(page, 5.07, 3);
  expect((await design(page)).furniture[0].x).toBeCloseTo(5.1, 5); // the grid, not the guide at 5
  await page.keyboard.press('Escape');

  await page.getByTestId('view-menu').click();
  await page.getByTestId('view-rulers').locator('input').uncheck();
  await page.getByTestId('view-dims').locator('input').check();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('ruler-top')).toHaveCount(0);

  // remembered after a reload
  await expect(page.getByTestId('save-state')).toContainText('Saved');
  await page.reload();
  await expect(page.getByTestId('ruler-top')).toHaveCount(0);
  const s = await ui(page);
  expect([s.showRulers, s.showGuides, s.showAllDims]).toEqual([false, false, true]);
  // the guide itself is part of the design and is still there
  expect((await design(page)).guides).toHaveLength(1);
});

test('show all dimensions labels walls, rooms and furniture', async ({ page }) => {
  await drawBox(page, 1, 1, 6, 5);
  await page.getByTestId('tool-room').click();
  await clickAt(page, 3.5, 3);
  await page.keyboard.press('Escape');
  await pickFurniture(page, 'sofa');
  await clickAt(page, 3.5, 4.2);
  await page.keyboard.press('Escape');
  await page.getByTestId('view-menu').click();
  await page.getByTestId('view-dims').locator('input').check();
  await page.keyboard.press('Escape');
  expect((await ui(page)).showAllDims).toBe(true);
  await page.screenshot({ path: 'e2e/.results/m16-dims.png' });
});
