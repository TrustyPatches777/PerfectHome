import { test, expect } from '@playwright/test';
import { clickAt, design, dragWorld, fresh, moveTo, ui } from './helpers';

test.beforeEach(async ({ page }) => {
  await fresh(page);
});

test('place a straight staircase with sensible defaults and a comfort check', async ({ page }) => {
  await page.getByTestId('tool-stairs').click();
  await expect(page.getByTestId('stair-kind-straight')).toBeVisible();
  await moveTo(page, 3, 4);
  await page.keyboard.press('r'); // rotate the ghost before placing
  expect((await ui(page)).placingRotation).toBe(90);
  await clickAt(page, 3.02, 4.01);
  const d = await design(page);
  expect(d.stairs).toHaveLength(1);
  expect(d.stairs[0]).toMatchObject({ kind: 'straight', x: 3, y: 4, w: 1, d: 4, steps: 16, rotation: 90, rise: 2.8, flip: false });
  expect((await ui(page)).tool).toBe('select');
  expect((await ui(page)).selection).toEqual({ kind: 'stair', id: d.stairs[0].id });
  await expect(page.getByTestId('stair-check')).toContainText('Step height 17.5 cm');
  await expect(page.getByTestId('stair-check')).toContainText('Comfortable');
  await page.screenshot({ path: 'e2e/.results/m13-stair.png' });
});

test('every kind can be placed; the comfort check warns when it is too steep', async ({ page }) => {
  let x = 2;
  for (const kind of ['straight', 'l', 'u', 'spiral']) {
    await page.keyboard.press('Escape');
    await page.getByTestId('tool-stairs').click();
    await page.getByTestId(`stair-kind-${kind}`).click();
    await clickAt(page, x, 4);
    x += 3.2;
  }
  const d = await design(page);
  expect(d.stairs.map((s: any) => s.kind)).toEqual(['straight', 'l', 'u', 'spiral']);
  await page.keyboard.press('Escape');
  await page.screenshot({ path: 'e2e/.results/m13-stair-kinds.png' });

  // edit the L stair: fewer steps = steeper
  await clickAt(page, 5.2 + 0.2, 4 - 0.9); // inside the L-stair's landing area
  expect((await ui(page)).selection?.kind).toBe('stair');
  await expect(page.getByTestId('stair-kind')).toHaveValue('l');
  await page.getByTestId('stair-steps').fill('10');
  await page.getByTestId('stair-steps').press('Enter');
  await expect(page.getByTestId('stair-check')).toContainText('higher than 20 cm');
  await page.getByTestId('stair-flip').click();
  expect((await design(page)).stairs[1].flip).toBe(true);
  await page.getByTestId('stair-steps').fill('16');
  await page.getByTestId('stair-steps').press('Enter');
  await page.getByTestId('stair-kind').selectOption('u');
  expect((await design(page)).stairs[1].kind).toBe('u');
});

test('stairs move, resize with the handles, and copy; the floor above shows the stairwell', async ({ page }) => {
  await page.getByTestId('tool-stairs').click();
  await clickAt(page, 4, 4);
  await dragWorld(page, [4, 4], [6, 5]);
  expect((await design(page)).stairs[0]).toMatchObject({ x: 6, y: 5 });
  await page.keyboard.press('Control+d');
  expect((await design(page)).stairs).toHaveLength(2);
  await page.keyboard.press('Delete');
  expect((await design(page)).stairs).toHaveLength(1);

  // locked structure layer protects stairs too
  await page.getByTestId('lock-structure').click();
  await dragWorld(page, [6, 5], [8, 5]);
  expect((await design(page)).stairs[0].x).toBe(6);
  await page.getByTestId('lock-structure').click();

  await page.getByTestId('add-floor').click();
  expect((await design(page)).stairs).toHaveLength(1); // stairs belong to the lower floor
  await page.screenshot({ path: 'e2e/.results/m13-stairwell.png' });
  // the stairwell upstairs can be clicked: it selects the stair of the floor below (to edit it and its railings)
  await clickAt(page, 6, 5);
  expect((await ui(page)).selection).toMatchObject({ kind: 'stair' });
});
