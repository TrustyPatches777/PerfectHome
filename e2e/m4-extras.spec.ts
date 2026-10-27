import { test, expect } from '@playwright/test';
import { clickAt, design, dragWorld, drawBox, fresh, moveTo, ui } from './helpers';

test.beforeEach(async ({ page }) => {
  await fresh(page);
});

test('text labels: place, type, resize, move, rotate, delete', async ({ page }) => {
  await page.getByTestId('tool-text').click();
  await clickAt(page, 3.02, 2.98);
  let d = await design(page);
  expect(d.labels).toHaveLength(1);
  expect(d.labels[0]).toMatchObject({ x: 3, y: 3, text: 'Text' });
  // the new label is selected and its text field is focused and selected, so typing replaces it
  await expect(page.getByTestId('label-text')).toBeFocused();
  await page.keyboard.type('Living room');
  await page.getByTestId('label-size').fill('40');
  await page.getByTestId('label-size').press('Enter');
  await page.getByTestId('label-rotation').fill('90');
  await page.getByTestId('label-rotation').press('Enter');
  d = await design(page);
  expect(d.labels[0]).toMatchObject({ text: 'Living room', size: 0.4, rotation: 90 });

  // drag it (rotated 90°, so grab near the center)
  await page.getByTestId('tool-select').click();
  await dragWorld(page, [3, 3], [5, 4]);
  d = await design(page);
  expect(d.labels[0].x).toBeCloseTo(5, 5);
  expect(d.labels[0].y).toBeCloseTo(4, 5);

  await page.screenshot({ path: 'e2e/.results/m4-label.png' });
  await page.keyboard.press('Escape');
  await clickAt(page, 5, 4);
  await page.keyboard.press('Delete');
  expect((await design(page)).labels).toHaveLength(0);
});

test('measure tool snaps to wall corners, keeps the dimension, and it can be edited and deleted', async ({ page }) => {
  await drawBox(page, 1, 1, 5, 4);
  await page.getByTestId('tool-measure').click();
  await clickAt(page, 1.02, 0.97);
  await moveTo(page, 5.03, 1.02);
  await clickAt(page, 5.03, 1.02);
  let d = await design(page);
  expect(d.dimensions).toHaveLength(1);
  expect(d.dimensions[0].a).toEqual({ x: 1, y: 1 });
  expect(d.dimensions[0].b).toEqual({ x: 5, y: 1 });

  // inner wall faces are snap points too, so interior sizes can be measured: 4 m - 15 cm wall = 3.85 m
  await clickAt(page, 1.08, 1.08);
  await clickAt(page, 4.93, 1.08);
  d = await design(page);
  expect(d.dimensions).toHaveLength(2);
  expect(d.dimensions[1].a.x).toBeCloseTo(1.075, 3);
  expect(d.dimensions[1].b.x).toBeCloseTo(4.925, 3);

  // a third one, vertical
  await clickAt(page, 5, 1.5);
  await clickAt(page, 5, 4);
  d = await design(page);
  expect(d.dimensions).toHaveLength(3);
  await page.screenshot({ path: 'e2e/.results/m4-measure.png' });

  await page.keyboard.press('Escape'); // back to select
  await clickAt(page, 5, 3); // on the vertical dimension (the dimension layer sits above the walls)
  expect((await ui(page)).selection).toEqual({ kind: 'dimension', id: d.dimensions[2].id });
  await expect(page.getByTestId('dimension-length')).toContainText('2.50 m');
  // drag one end
  await dragWorld(page, [5, 4], [5, 5]);
  d = await design(page);
  expect(d.dimensions[2].b).toEqual({ x: 5, y: 5 });
  await expect(page.getByTestId('dimension-length')).toContainText('3.50 m');
  await page.keyboard.press('Delete');
  expect((await design(page)).dimensions).toHaveLength(2);
});

test('locking the walls layer protects walls but not furniture', async ({ page }) => {
  await drawBox(page, 1, 1, 5, 4);
  await page.getByTestId('furn-sofa').click();
  await clickAt(page, 3, 3);
  await page.keyboard.press('Escape');

  await page.getByTestId('lock-structure').click();
  expect((await design(page)).layers.structure.locked).toBe(true);

  // walls: cannot be selected or dragged
  const before = (await design(page)).walls.map((w: any) => [w.a, w.b]);
  await clickAt(page, 3, 1);
  expect((await ui(page)).selection).toBeNull();
  await dragWorld(page, [3, 1], [3, 0]);
  expect((await design(page)).walls.map((w: any) => [w.a, w.b])).toEqual(before);
  await page.keyboard.press('Delete');
  expect((await design(page)).walls).toHaveLength(4);

  // cannot draw walls or doors into a locked layer either
  await page.getByTestId('tool-wall').click();
  await clickAt(page, 8, 8);
  await clickAt(page, 9, 8);
  expect((await design(page)).walls).toHaveLength(4);
  await expect(page.locator('.statusbar')).toContainText('locked');
  await page.getByTestId('tool-select').click();

  // furniture is still free to move
  await dragWorld(page, [3, 3], [3.5, 3]);
  expect((await design(page)).furniture[0].x).toBeCloseTo(3.5, 5);

  // unlocking restores editing
  await page.getByTestId('lock-structure').click();
  await clickAt(page, 3, 1);
  expect((await ui(page)).selection?.kind).toBe('wall');
  await page.screenshot({ path: 'e2e/.results/m4-layers.png' });
});

test('locking deselects; hiding a layer hides and un-targets its items', async ({ page }) => {
  await page.getByTestId('furn-bed-single').click();
  await clickAt(page, 3, 3);
  expect((await ui(page)).selection?.kind).toBe('furniture');
  await page.getByTestId('lock-furniture').click();
  expect((await ui(page)).selection).toBeNull();
  await expect(page.getByTestId('lock-furniture')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('lock-furniture').click();

  await page.getByTestId('hide-furniture').click();
  await clickAt(page, 3, 3);
  expect((await ui(page)).selection).toBeNull();
  // the item is still part of the design, just not shown
  expect((await design(page)).furniture).toHaveLength(1);
  await page.getByTestId('hide-furniture').click();
  await clickAt(page, 3, 3);
  expect((await ui(page)).selection?.kind).toBe('furniture');
});
