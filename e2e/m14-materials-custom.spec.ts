import { test, expect } from '@playwright/test';
import { clickAt, design, drawBox, fresh, pickFurniture, ui } from './helpers';

test.beforeEach(async ({ page }) => {
  await fresh(page);
});

test('floor materials: pick a pattern, the color follows, and living-area flag', async ({ page }) => {
  const mats = ['wood', 'tile', 'carpet'];
  let x = 1;
  for (const m of mats) {
    await drawBox(page, x, 1, x + 3, 4);
    await page.getByTestId('tool-room').click();
    await clickAt(page, x + 1.5, 2.5);
    await page.getByTestId(`material-${m}`).click();
    x += 3.5;
  }
  await page.keyboard.press('Escape');
  const rooms = (await design(page)).rooms;
  expect(rooms.map((r: any) => r.material)).toEqual(mats);
  expect(rooms[0].color).toBe('#c9a27a'); // a wood color was chosen for the default pastel
  expect(rooms[1].color).toBe('#d6dde2');
  await page.screenshot({ path: 'e2e/.results/m14-floors.png' });

  // a color of your own is kept when switching material
  await clickAt(page, 2.5, 2.5);
  await page.getByRole('button', { name: 'Color #8d6e4f' }).click();
  await page.getByTestId('material-parquet').click();
  expect((await design(page)).rooms[0]).toMatchObject({ material: 'parquet', color: '#8d6e4f' });
  await page.getByTestId('material-plain').click();
  expect((await design(page)).rooms[0].material).toBe('plain');

  await expect(page.getByTestId('room-living')).toBeChecked();
  await page.getByTestId('room-living').uncheck();
  expect((await design(page)).rooms[0].living).toBe(false);
});

test('custom furniture: create, place, edit, reuse after a reload', async ({ page }) => {
  await page.getByTestId('new-custom').click();
  await expect(page.getByTestId('custom-dialog')).toBeVisible();
  await page.getByTestId('custom-name').fill('Paul shelf');
  await page.getByTestId('custom-shape-round').click();
  for (const [id, v] of [['custom-w', '80'], ['custom-d', '30'], ['custom-h', '190']]) {
    await page.getByTestId(id).fill(v);
    await page.getByTestId(id).press('Enter');
  }
  await page.getByTestId('custom-dialog').getByRole('button', { name: 'Color #b7c9a8' }).click();
  await page.getByTestId('custom-save-place').click();
  let d = await design(page);
  expect(d.custom).toHaveLength(1);
  expect(d.custom[0]).toMatchObject({ label: 'Paul shelf', w: 0.8, d: 0.3, height: 1.9, shape: 'round', color: '#b7c9a8' });
  expect((await ui(page)).tool).toBe('furniture');
  expect((await ui(page)).placing).toBe(`custom:${d.custom[0].id}`);

  await clickAt(page, 3, 3);
  d = await design(page);
  expect(d.furniture[0]).toMatchObject({ type: `custom:${d.custom[0].id}`, w: 0.8, d: 0.3, color: '#b7c9a8' });
  await expect(page.getByTestId('furn-label')).toHaveAttribute('placeholder', 'Paul shelf');
  await expect(page.getByTestId('furn-height')).toHaveValue('190');

  // it is in the palette under My items, and can be edited from there
  await expect(page.getByTestId('cat-My items')).toBeVisible();
  await page.getByTestId(`edit-custom:${d.custom[0].id}`).click({ force: true });
  await page.getByTestId('custom-name').fill('Shelf (tall)');
  await page.getByTestId('custom-save').click();
  expect((await design(page)).custom[0].label).toBe('Shelf (tall)');
  await expect(page.getByTestId('furn-label')).toHaveAttribute('placeholder', 'Shelf (tall)');

  // survives a reload (and so also a shared link: it is part of the design)
  await expect(page.getByTestId('save-state')).toContainText('Saved');
  await page.reload();
  await expect(page.getByTestId(`furn-custom:${(await design(page)).custom[0].id}`)).toBeVisible();
  expect((await design(page)).furniture[0].type).toContain('custom:');

  // deleting a definition that is still in use is refused
  await clickAt(page, 3, 3);
  await page.getByTestId('edit-custom').click();
  await page.getByTestId('custom-delete').click();
  await expect(page.locator('.statusbar')).toContainText('is used 1 time');
  expect((await design(page)).custom).toHaveLength(1);
  await page.getByTestId('custom-dialog').getByRole('button', { name: 'Cancel' }).click();
  await page.keyboard.press('Delete');
  await page.getByTestId(`edit-custom:${(await design(page)).custom[0].id}`).click({ force: true });
  await page.getByTestId('custom-delete').click();
  expect((await design(page)).custom).toHaveLength(0);
});

test('save a resized catalog item as your own, and copy custom items between designs', async ({ page }) => {
  await pickFurniture(page, 'bed-double');
  await clickAt(page, 3, 3);
  await page.getByTestId('furn-w').fill('150');
  await page.getByTestId('furn-w').press('Enter');
  await page.getByTestId('furn-label').fill('Guest bed');
  await page.getByTestId('save-as-custom').click();
  const d = await design(page);
  expect(d.custom).toHaveLength(1);
  expect(d.custom[0]).toMatchObject({ label: 'Guest bed', w: 1.5, d: 2, shape: 'symbol', base: 'bed-double' });
  await expect(page.getByTestId('cat-My items')).toBeVisible();

  // copy/paste brings the definition along
  await page.keyboard.press('Control+c');
  await page.getByTestId('file-menu').click();
  await page.getByTestId('menu-new').click();
  expect((await design(page)).custom).toHaveLength(0);
  await page.keyboard.press('Control+v');
  const after = await design(page);
  expect(after.furniture).toHaveLength(1);
  expect(after.custom).toHaveLength(0); // pasted item has the normal bed type: no definition needed
});
