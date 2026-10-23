import { test, expect, type Page } from '@playwright/test';
import { at, clickAt, design, dragWorld, drawBox, fresh, moveTo, ui } from './helpers';

test.beforeEach(async ({ page }) => {
  await fresh(page);
});

async function place(page: Page, type: string, x: number, y: number, opts: { shift?: boolean } = {}) {
  await page.getByTestId(`furn-${type}`).click();
  await moveTo(page, x, y);
  if (opts.shift) await page.keyboard.down('Shift');
  await clickAt(page, x, y);
  if (opts.shift) await page.keyboard.up('Shift');
}

test('palette lists real-world sizes and places an item at the snapped cursor position', async ({ page }) => {
  await expect(page.getByTestId('palette')).toContainText('Bathtub');
  await expect(page.getByTestId('furn-bed-double')).toHaveAttribute('title', /160 × 200 cm/);
  await place(page, 'bed-double', 3.04, 3.02);
  const d = await design(page);
  expect(d.furniture).toHaveLength(1);
  expect(d.furniture[0]).toMatchObject({ type: 'bed-double', x: 3, y: 3, w: 1.6, d: 2, rotation: 0 });
  // placed item is selected and the select tool is active again
  expect((await ui(page)).tool).toBe('select');
  expect((await ui(page)).selection).toEqual({ kind: 'furniture', id: d.furniture[0].id });
  await expect(page.getByTestId('properties')).toContainText('Furniture');
  await expect(page.getByTestId('furn-w')).toHaveValue('160');
});

test('click selects, drag moves (snapped), keyboard shortcuts work', async ({ page }) => {
  await place(page, 'sofa', 3, 3);
  await page.keyboard.press('Escape'); // deselect
  expect((await ui(page)).selection).toBeNull();
  await clickAt(page, 3, 3);
  expect((await ui(page)).selection?.kind).toBe('furniture');

  await dragWorld(page, [3, 3], [4.02, 4.51]);
  let f = (await design(page)).furniture[0];
  expect(f.x).toBeCloseTo(4, 5);
  expect(f.y).toBeCloseTo(4.5, 5);
  await page.keyboard.press('Control+z'); // whole drag is one undo step
  f = (await design(page)).furniture[0];
  expect(f.x).toBeCloseTo(3, 5);

  await page.keyboard.press('r');
  expect((await design(page)).furniture[0].rotation).toBe(90);
  await page.keyboard.press('Shift+r');
  expect((await design(page)).furniture[0].rotation).toBe(0);
  await page.keyboard.press(']');
  expect((await design(page)).furniture[0].rotation).toBe(15);
  await page.keyboard.press('ArrowRight');
  expect((await design(page)).furniture[0].x).toBeCloseTo(3.1, 5);
  await page.keyboard.press('Shift+ArrowDown');
  expect((await design(page)).furniture[0].y).toBeCloseTo(3.5, 5);

  // duplicate (Ctrl+D) then delete the copy
  await page.keyboard.press('Control+d');
  let d = await design(page);
  expect(d.furniture).toHaveLength(2);
  expect((await ui(page)).selection?.id).toBe(d.furniture[1].id);
  await page.keyboard.press('Delete');
  d = await design(page);
  expect(d.furniture).toHaveLength(1);
  expect((await ui(page)).selection).toBeNull();
});

test('properties: label, size, rotation and color', async ({ page }) => {
  await place(page, 'desk', 3, 3);
  await page.getByTestId('furn-label').fill('Paul desk');
  await page.getByTestId('furn-w').fill('150');
  await page.getByTestId('furn-w').press('Enter');
  await page.getByTestId('furn-d').fill('80');
  await page.getByTestId('furn-d').press('Enter');
  await page.getByTestId('furn-rotation').fill('30');
  await page.getByTestId('furn-rotation').press('Enter');
  await page.getByRole('button', { name: 'Color #9ca3af' }).click();
  const f = (await design(page)).furniture[0];
  expect(f).toMatchObject({ label: 'Paul desk', w: 1.5, d: 0.8, rotation: 30, color: '#9ca3af' });
  await page.getByRole('button', { name: 'Reset size' }).click();
  expect((await design(page)).furniture[0]).toMatchObject({ w: 1.4, d: 0.7 });
});

test('resize and rotate with the on-canvas handles', async ({ page }) => {
  await place(page, 'bed-double', 3, 3); // 1.6 x 2.0, so right edge at x=3.8
  // grab the middle-right anchor and pull it 0.5 m outwards
  await dragWorld(page, [3.8, 3], [4.3, 3]);
  let f = (await design(page)).furniture[0];
  expect(f.w).toBeGreaterThan(2.0);
  expect(f.w).toBeLessThan(2.2);
  expect(f.d).toBe(2);
  expect(f.rotation).toBe(0);
  // opposite edge stays put: left edge was at 2.2
  expect(f.x - f.w / 2).toBeCloseTo(2.2, 1);

  // rotate handle sits above the top edge
  const top = await at(page, f.x, f.y - f.d / 2);
  await page.mouse.move(top.x, top.y - 26);
  await page.mouse.down();
  const right = await at(page, f.x + 2, f.y);
  await page.mouse.move(right.x, right.y, { steps: 6 });
  await page.mouse.up();
  f = (await design(page)).furniture[0];
  expect(f.rotation).toBeCloseTo(90, 0);
});

test('shift+click keeps placing; Esc stops; R rotates the ghost', async ({ page }) => {
  await page.getByTestId('furn-chair').click();
  await page.keyboard.press('r');
  expect((await ui(page)).placingRotation).toBe(90);
  await moveTo(page, 2, 2);
  await page.keyboard.down('Shift');
  await clickAt(page, 2, 2);
  await clickAt(page, 3, 2);
  await clickAt(page, 4, 2);
  await page.keyboard.up('Shift');
  const d = await design(page);
  expect(d.furniture).toHaveLength(3);
  expect(d.furniture.every((f) => f.rotation === 90 && f.type === 'chair')).toBe(true);
  expect((await ui(page)).tool).toBe('furniture');
  await page.keyboard.press('Escape');
  expect((await ui(page)).tool).toBe('select');
});

test('furniture can be placed inside a furnished room (visual check)', async ({ page }) => {
  await drawBox(page, 1, 1, 7, 6);
  await page.getByTestId('tool-room').click();
  await clickAt(page, 4, 3.5);
  await place(page, 'bed-double', 2.2, 2.3);
  await place(page, 'bedside', 3.3, 1.5);
  await place(page, 'wardrobe', 5.6, 1.45);
  await place(page, 'sofa', 3, 5.4);
  await place(page, 'coffee-table', 3, 4.2);
  await place(page, 'dining-table', 5.6, 4.2);
  await place(page, 'chair', 5.1, 3.4);
  await place(page, 'desk', 6.2, 5.55);
  await place(page, 'plant', 1.5, 5.5);
  await place(page, 'toilet', 4.7, 2.2);
  await place(page, 'bathtub', 4.4, 1.6);
  expect((await design(page)).furniture).toHaveLength(11);
  await page.keyboard.press('Escape');
  await page.screenshot({ path: 'e2e/.results/m3-furnished.png' });
});
