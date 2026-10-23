import { test, expect } from '@playwright/test';
import { clickAt, design, drawBox, fresh, ui } from './helpers';

test.beforeEach(async ({ page }) => {
  await fresh(page);
});

const floorNames = async (page: any) => (await design(page)).floors.map((f: any) => f.name);

test('add floors; each floor has its own walls, rooms and furniture; the floor below shows faintly', async ({ page }) => {
  expect(await floorNames(page)).toEqual(['Ground floor']);
  await expect(page.getByTestId('floor-switcher')).toHaveCount(0); // only shown with 2+ floors
  await expect(page.getByTestId('delete-floor')).toBeDisabled();

  await drawBox(page, 1, 1, 6, 5);
  await page.getByTestId('tool-room').click();
  await clickAt(page, 3.5, 3);
  await page.getByTestId('furn-sofa').click();
  await clickAt(page, 3.5, 4.3);

  await page.getByTestId('add-floor').click();
  expect(await floorNames(page)).toEqual(['Ground floor', '1st floor']);
  await expect(page.getByTestId('floor-current')).toHaveText('1st floor');
  const d0 = await design(page);
  const [ground, first] = d0.floors.map((f: any) => f.id);
  expect((await ui(page)).activeFloor).toBe(first);

  // draw a similar box on the new floor: the same room spot is allowed because rooms only conflict per floor
  await drawBox(page, 1, 1, 6, 5);
  await page.getByTestId('tool-room').click();
  await clickAt(page, 3.5, 3);
  const d1 = await design(page);
  expect(d1.walls.filter((w: any) => w.floor === first)).toHaveLength(4);
  expect(d1.walls.filter((w: any) => w.floor === ground)).toHaveLength(4);
  expect(d1.rooms).toHaveLength(2);
  expect(d1.furniture.filter((f: any) => f.floor === first)).toHaveLength(0);
  await page.getByTestId('tool-select').click();
  await page.screenshot({ path: 'e2e/.results/m7-floor1-underlay.png' });

  // the sofa of the ground floor cannot be clicked from upstairs
  await clickAt(page, 3.5, 4.3);
  expect((await ui(page)).selection?.kind).not.toBe('furniture');

  // Page Down goes to the ground floor, where the sofa is selectable again
  await page.keyboard.press('PageDown');
  await expect(page.getByTestId('floor-current')).toHaveText('Ground floor');
  await clickAt(page, 3.5, 4.3);
  expect((await ui(page)).selection?.kind).toBe('furniture');
  await page.keyboard.press('PageUp');
  await expect(page.getByTestId('floor-current')).toHaveText('1st floor');
  expect((await ui(page)).selection).toBeNull(); // switching floors clears the selection
});

test('basement, rename, duplicate floor and delete floor (with confirmation and undo)', async ({ page }) => {
  await drawBox(page, 1, 1, 5, 4);
  await page.getByTestId('tool-door').click();
  await clickAt(page, 3, 1.3);
  await page.getByTestId('tool-select').click();

  await page.getByTestId('add-basement').click();
  expect(await floorNames(page)).toEqual(['Basement', 'Ground floor']);
  await page.getByTestId('floor-Ground floor').click();

  await page.getByTestId('duplicate-floor').click();
  let d = await design(page);
  expect(d.floors.map((f: any) => f.name)).toEqual(['Basement', 'Ground floor', 'Ground floor copy']);
  const copy = d.floors[2].id;
  expect(d.walls).toHaveLength(8);
  expect(d.openings).toHaveLength(2);
  // the copied door sits on a copied wall (not on the original's)
  const copiedWallIds = d.walls.filter((w: any) => w.floor === copy).map((w: any) => w.id);
  expect(d.openings.filter((o: any) => copiedWallIds.includes(o.wallId))).toHaveLength(1);

  await page.getByTestId('floor-name').fill('Attic');
  expect(await floorNames(page)).toEqual(['Basement', 'Ground floor', 'Attic']);

  // delete asks first, removes everything on that floor, and Undo brings it back
  await page.getByTestId('delete-floor').click();
  await expect(page.getByTestId('confirm-dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  expect((await design(page)).floors).toHaveLength(3);
  await page.getByTestId('delete-floor').click();
  await page.getByTestId('confirm-ok').click();
  d = await design(page);
  expect(d.floors).toHaveLength(2);
  expect(d.walls).toHaveLength(4);
  expect(d.openings).toHaveLength(1);
  expect((await ui(page)).activeFloor).toBe(d.floors[1].id);
  await page.keyboard.press('Control+z');
  d = await design(page);
  expect(d.floors).toHaveLength(3);
  expect(d.walls).toHaveLength(8);

  // an empty floor is deleted without asking
  await page.getByTestId('floor-Basement').click();
  await page.getByTestId('delete-floor').click();
  await expect(page.getByTestId('confirm-dialog')).toHaveCount(0);
  expect((await design(page)).floors).toHaveLength(2);
});

test('floors survive sharing, reload and the JSON export', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await drawBox(page, 1, 1, 5, 4);
  await page.getByTestId('add-floor').click();
  await drawBox(page, 2, 2, 4, 3);
  await expect(page.getByTestId('save-state')).toContainText('Saved');
  const before = await design(page);
  await page.reload();
  const after = await design(page);
  expect(after.floors).toEqual(before.floors);
  expect(after.walls).toHaveLength(8);
  // after a reload we start on the lowest floor
  await expect(page.getByTestId('floor-current')).toHaveText('Ground floor');
});

test('garage door, double door and open passage', async ({ page }) => {
  await drawBox(page, 1, 1, 9, 5);
  await page.getByTestId('tool-door').click();

  await page.getByTestId('door-kind-garage').click();
  await clickAt(page, 3, 4.7);
  await page.getByTestId('door-kind-double').click();
  await clickAt(page, 6.5, 1.3);
  await page.getByTestId('door-kind-gap').click();
  await clickAt(page, 9.0, 3);
  let d = await design(page);
  expect(d.openings.map((o: any) => [o.kind, o.width])).toEqual([
    ['garage', 2.5],
    ['double', 1.6],
    ['gap', 1],
  ]);

  // change a type from the properties panel
  await page.getByTestId('tool-select').click();
  await clickAt(page, 9, 3);
  await expect(page.getByTestId('opening-kind')).toHaveValue('gap');
  await page.getByTestId('opening-kind').selectOption('window');
  expect((await design(page)).openings[2].kind).toBe('window');
  await page.screenshot({ path: 'e2e/.results/m7-openings.png' });

  // double doors can be flipped but have no single hinge
  await clickAt(page, 6.5, 1);
  await expect(page.getByTestId('flip-swing')).toBeVisible();
  await expect(page.getByTestId('flip-hinge')).toHaveCount(0);
  d = await design(page);
  expect(d.openings[1].swing).toBe(1);
});
