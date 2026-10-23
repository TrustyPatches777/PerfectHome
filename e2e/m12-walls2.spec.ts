import { test, expect } from '@playwright/test';
import { clickAt, design, dragWorld, fresh, moveTo, ui } from './helpers';

test.beforeEach(async ({ page }) => {
  await fresh(page);
});

async function wall(page: any, a: [number, number], b: [number, number]) {
  await clickAt(page, ...a);
  await clickAt(page, ...b);
  await page.keyboard.press('Enter');
}

test('wall types: each has its usual thickness, can be changed later, custom thickness is kept', async ({ page }) => {
  await page.getByTestId('tool-wall').click();
  await page.getByTestId('wall-type-exterior').click();
  await expect(page.getByTestId('opt-thickness')).toHaveValue('30');
  await wall(page, [1, 1], [6, 1]);
  await page.getByTestId('wall-type-partition').click();
  await expect(page.getByTestId('opt-thickness')).toHaveValue('10');
  await wall(page, [1, 3], [6, 3]);
  await page.getByTestId('wall-type-railing').click();
  await wall(page, [1, 5], [6, 5]);
  const d = await design(page);
  expect(d.walls.map((w: any) => [w.type, w.thickness, w.height])).toEqual([
    ['exterior', 0.3, 2.5],
    ['partition', 0.1, 2.5],
    ['railing', 0.06, 1],
  ]);

  await page.getByTestId('tool-select').click();
  await clickAt(page, 3.5, 3);
  await expect(page.getByTestId('wall-type')).toHaveValue('partition');
  await page.getByTestId('wall-type').selectOption('load');
  expect((await design(page)).walls[1]).toMatchObject({ type: 'load', thickness: 0.24 });
  // a thickness you typed yourself survives a type change
  await page.getByTestId('wall-thickness').fill('17');
  await page.getByTestId('wall-thickness').press('Enter');
  await page.getByTestId('wall-type').selectOption('interior');
  expect((await design(page)).walls[1]).toMatchObject({ type: 'interior', thickness: 0.17 });
  await page.screenshot({ path: 'e2e/.results/m12-wall-types.png' });
});

test('curved walls: type a curve, drag the handle, straighten; length follows the curve', async ({ page }) => {
  await page.getByTestId('tool-wall').click();
  await wall(page, [1, 1], [5, 1]);
  await page.getByTestId('tool-select').click();
  await clickAt(page, 3, 1);
  await expect(page.getByTestId('wall-length')).toHaveValue('400');

  await page.getByTestId('wall-curve').fill('100');
  await page.getByTestId('wall-curve').press('Enter');
  expect((await design(page)).walls[0].bulge).toBe(1);
  // arc length for chord 4 and rise 1: 2.5 * 2 * asin(0.8) = 4.64 m
  await expect(page.getByTestId('wall-length-curved')).toContainText('4.64 m');
  await page.screenshot({ path: 'e2e/.results/m12-curved.png' });

  // drag the handle in the middle of the arc (now at (3, 2)) up to y = 1.5 -> bulge 0.5
  await dragWorld(page, [3, 2], [3, 1.52]);
  expect((await design(page)).walls[0].bulge).toBe(0.5);
  // dragging back to the chord straightens it
  await dragWorld(page, [3, 1.5], [3, 1.0]);
  expect((await design(page)).walls[0].bulge).toBeUndefined();

  await page.getByTestId('wall-curve').fill('-60');
  await page.getByTestId('wall-curve').press('Enter');
  expect((await design(page)).walls[0].bulge).toBe(-0.6);
  await page.getByTestId('wall-straighten').click();
  expect((await design(page)).walls[0].bulge).toBeUndefined();
  await page.keyboard.press('Control+z');
  expect((await design(page)).walls[0].bulge).toBe(-0.6);
});

test('a room bounded by a straight and a curved wall is detected; doors sit on the curve', async ({ page }) => {
  await page.getByTestId('tool-wall').click();
  await wall(page, [1, 3], [5, 3]);
  await wall(page, [5, 3], [1, 3]); // second wall back along the same line, to become the arc
  await page.getByTestId('tool-select').click();
  // select the second wall: the straight one is under it, so use the properties of the last wall via a click on the arc later
  const id = (await design(page)).walls[1].id;
  await page.evaluate((i) => (window as any).__ph.ui.getState().select({ kind: 'wall', id: i }), id);
  await page.getByTestId('wall-curve').fill('200');
  await page.getByTestId('wall-curve').press('Enter');
  expect((await design(page)).walls[1].bulge).toBe(2);

  await page.getByTestId('tool-room').click();
  await clickAt(page, 3, 1.5); // inside the half circle above the straight wall
  const d = await design(page);
  expect(d.rooms).toHaveLength(1);
  // inner radius 1.925 -> a bit under half a circle
  await expect(page.getByTestId('room-area')).toContainText(/5\.[0-9]{2} m²/);

  await page.getByTestId('tool-door').click();
  await moveTo(page, 3, 1.15); // near the top of the arc, inside
  await clickAt(page, 3, 1.15);
  const o = (await design(page)).openings;
  expect(o).toHaveLength(1);
  expect(o[0].wallId).toBe(d.walls[1].id);
  expect(o[0].pos).toBeGreaterThan(2);
  expect(o[0].pos).toBeLessThan(4.5); // somewhere around the middle of the arc (about 6.3 m long)
  await page.getByTestId('tool-select').click();
  await page.screenshot({ path: 'e2e/.results/m12-d-room.png' });
});

test('more openings: French and sliding doors, bay window', async ({ page }) => {
  await page.getByTestId('tool-wall').click();
  await wall(page, [1, 1], [10, 1]);
  await page.getByTestId('tool-door').click();
  await page.getByTestId('door-kind-french').click();
  await clickAt(page, 3, 1.3);
  await page.getByTestId('door-kind-sliding').click();
  await clickAt(page, 6, 1.3);
  await page.getByTestId('tool-window').click();
  await page.getByTestId('window-kind-bay').click();
  await expect(page.getByTestId('opt-opening-width')).toHaveValue('160');
  await clickAt(page, 8.5, 0.7); // from outside (above): the bay projects outwards, to the cursor side
  const d = await design(page);
  expect(d.openings.map((o: any) => [o.kind, o.width, o.swing])).toEqual([
    ['french', 1.6, 1],
    ['sliding', 1.8, 1],
    ['bay', 1.6, -1],
  ]);
  await page.getByTestId('tool-select').click();
  await clickAt(page, 8.5, 1);
  await expect(page.getByTestId('opening-kind')).toHaveValue('bay');
  await page.getByTestId('opening-kind').selectOption('window');
  expect((await design(page)).openings[2].kind).toBe('window');
  await page.screenshot({ path: 'e2e/.results/m12-openings.png' });
  expect((await ui(page)).selection?.kind).toBe('opening');
});
