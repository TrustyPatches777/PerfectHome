import { test, expect, type Page } from '@playwright/test';
import { at, clickAt, design, drawBox, fresh, moveTo, pickFurniture, ui } from './helpers';

test.beforeEach(async ({ page }) => {
  await fresh(page);
});

/** Three chairs in a row at x = 2, 4, 7 (different gaps), plus a sofa further down. */
async function chairs(page: Page) {
  for (const [x, y] of [
    [2, 2],
    [4, 2.5],
    [7, 2],
  ]) {
    await pickFurniture(page, 'chair');
    await clickAt(page, x, y);
  }
  await page.keyboard.press('Escape');
}

async function shiftClick(page: Page, x: number, y: number) {
  await page.keyboard.down('Shift');
  await clickAt(page, x, y);
  await page.keyboard.up('Shift');
}

async function shiftDrag(page: Page, from: [number, number], to: [number, number]) {
  const a = await at(page, ...from);
  const b = await at(page, ...to);
  await page.keyboard.down('Shift');
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 3 });
  await page.mouse.move(b.x, b.y, { steps: 3 });
  await page.mouse.up();
  await page.keyboard.up('Shift');
}

const xs = async (page: Page) => (await design(page)).furniture.map((f: any) => f.x);
const selCount = async (page: Page) => (await ui(page)).selected.length;

test('shift+click adds and removes items; the group panel appears', async ({ page }) => {
  await chairs(page);
  await clickAt(page, 2, 2);
  expect(await selCount(page)).toBe(1);
  await expect(page.getByTestId('properties')).toBeVisible();
  await shiftClick(page, 4, 2.5);
  await shiftClick(page, 7, 2);
  expect(await selCount(page)).toBe(3);
  await expect(page.getByTestId('group-panel')).toContainText('3 selected');
  expect((await ui(page)).selection).toBeNull(); // no single selection while several are selected
  await shiftClick(page, 7, 2); // toggles off
  expect(await selCount(page)).toBe(2);
  await clickAt(page, 4, 2.5); // a plain click selects just that one again
  expect(await selCount(page)).toBe(1);
  await expect(page.getByTestId('group-panel')).toHaveCount(0);
});

test('shift+drag on empty space selects everything in the box; Ctrl+A selects all editable items', async ({ page }) => {
  await chairs(page);
  await shiftDrag(page, [1, 1], [5, 4]);
  expect(await selCount(page)).toBe(2);
  expect((await ui(page)).selected.map((r: any) => r.kind)).toEqual(['furniture', 'furniture']);
  // shift+drag again adds the third
  await shiftDrag(page, [6, 1], [8, 4]);
  expect(await selCount(page)).toBe(3);

  await page.keyboard.press('Escape');
  expect(await selCount(page)).toBe(0);
  await drawBox(page, 1, 6, 5, 9);
  await page.keyboard.press('Control+a');
  expect(await selCount(page)).toBe(3 + 4);
  // a locked layer is left out
  await page.getByTestId('lock-structure').click();
  await page.keyboard.press('Control+a');
  expect(await selCount(page)).toBe(3);
});

test('dragging one selected item moves the whole selection (snapped); one undo step', async ({ page }) => {
  await chairs(page);
  await shiftDrag(page, [1, 1], [8, 4]);
  expect(await selCount(page)).toBe(3);
  const a = await at(page, 4, 2.5);
  const b = await at(page, 4 + 1.02, 2.5 + 2.01);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 6 });
  await page.mouse.up();
  expect(await xs(page)).toEqual([3, 5, 8].map((v) => expect.closeTo(v, 5)));
  expect((await design(page)).furniture.map((f: any) => f.y)).toEqual([4, 4.5, 4].map((v) => expect.closeTo(v, 5)));
  expect(await selCount(page)).toBe(3);
  await page.keyboard.press('Control+z');
  expect(await xs(page)).toEqual([2, 4, 7].map((v) => expect.closeTo(v, 5)));
});

test('align, distribute and rotate a group', async ({ page }) => {
  await chairs(page);
  await page.keyboard.press('Control+a');
  await page.getByTestId('align-top').click();
  const tops = (await design(page)).furniture.map((f: any) => f.y - f.d / 2);
  expect(tops.every((t: number) => Math.abs(t - tops[0]) < 1e-9)).toBe(true);
  expect(tops[0]).toBeCloseTo(1.775, 5); // chairs are 45 cm deep

  await page.getByTestId('distribute-x').click();
  const f = (await design(page)).furniture;
  expect(f[1].x - f[0].x).toBeCloseTo(f[2].x - f[1].x, 9); // equal gaps
  expect(f[0].x).toBeCloseTo(2, 9);
  expect(f[2].x).toBeCloseTo(7, 9);

  await page.getByTestId('group-rotate').click();
  const r = (await design(page)).furniture;
  expect(r.every((c: any) => c.rotation === 90)).toBe(true);
  // the row of chairs became a column about the group's center
  expect(Math.abs(r[0].x - r[2].x)).toBeLessThan(0.01);
  expect(Math.abs(r[0].y - r[2].y)).toBeGreaterThan(4.9);
  // align is one undo step each
  await page.keyboard.press('Control+z');
  expect((await design(page)).furniture.every((c: any) => c.rotation === 0)).toBe(true);
});

test('copy and paste: pasted at the cursor, independent copies, selected afterwards; cut and delete', async ({ page }) => {
  await chairs(page);
  await shiftDrag(page, [1, 1], [5, 4]); // the first two chairs
  await page.keyboard.press('Control+c');
  await expect(page.locator('.statusbar')).toContainText('Copied 2 items');
  await moveTo(page, 6, 6);
  await page.keyboard.press('Control+v');
  let d = await design(page);
  expect(d.furniture).toHaveLength(5);
  expect(await selCount(page)).toBe(2);
  // the copies are centered on the cursor (snapped): their center is (6, 6)
  const pasted = d.furniture.slice(3);
  const cx = (Math.min(...pasted.map((c: any) => c.x)) + Math.max(...pasted.map((c: any) => c.x))) / 2;
  expect(cx).toBeCloseTo(6, 1);
  expect(pasted.every((c: any) => c.id !== d.furniture[0].id)).toBe(true);

  // pasting again on the same spot steps aside
  await page.keyboard.press('Control+v');
  d = await design(page);
  expect(d.furniture).toHaveLength(7);
  expect(Math.abs(d.furniture[5].x - d.furniture[3].x)).toBeGreaterThan(0.2);

  // duplicate (Ctrl+D) of the pasted pair
  await page.keyboard.press('Control+d');
  expect((await design(page)).furniture).toHaveLength(9);
  expect(await selCount(page)).toBe(2);

  // delete the selection, then cut the remaining original pair and paste it back
  await page.keyboard.press('Delete');
  expect((await design(page)).furniture).toHaveLength(7);
  await page.keyboard.press('Control+z');
  expect((await design(page)).furniture).toHaveLength(9);
  await page.keyboard.press('Control+z');
  await page.keyboard.press('Control+z');
  await page.keyboard.press('Control+z');
  expect((await design(page)).furniture).toHaveLength(3);
});

test('walls copy with their doors, and paste onto another floor', async ({ page }) => {
  await drawBox(page, 1, 1, 5, 4);
  await page.getByTestId('tool-door').click();
  await clickAt(page, 3, 1.3);
  await page.getByTestId('tool-select').click();
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Control+c');
  await page.getByTestId('add-floor').click();
  await moveTo(page, 6, 4);
  await page.keyboard.press('Control+v');
  const d = await design(page);
  const up = d.floors[1].id;
  const newWalls = d.walls.filter((w: any) => w.floor === up);
  expect(newWalls).toHaveLength(4);
  expect(d.openings).toHaveLength(2);
  const ids = new Set(newWalls.map((w: any) => w.id));
  expect(d.openings.filter((o: any) => ids.has(o.wallId))).toHaveLength(1);
  // pasted around the cursor: the copy's center is (6,4)
  const minX = Math.min(...newWalls.flatMap((w: any) => [w.a.x, w.b.x]));
  const maxX = Math.max(...newWalls.flatMap((w: any) => [w.a.x, w.b.x]));
  expect((minX + maxX) / 2).toBeCloseTo(6, 0);
});

test('locked layers are never changed by group commands', async ({ page }) => {
  await drawBox(page, 1, 1, 5, 4);
  await chairs(page);
  await page.keyboard.press('Control+a');
  expect(await selCount(page)).toBe(4 + 3);
  await page.getByTestId('lock-structure').click(); // locking removes walls from the selection
  expect(await selCount(page)).toBe(3);
  await page.getByTestId('group-delete').click();
  const d = await design(page);
  expect(d.furniture).toHaveLength(0);
  expect(d.walls).toHaveLength(4);
});
