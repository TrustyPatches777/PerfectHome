import { test, expect } from '@playwright/test';
import { at, clickAt, design, dragWorld, drawBox, fresh, moveTo, ui } from './helpers';

test.beforeEach(async ({ page }) => {
  await fresh(page);
});

test('draw walls with grid snapping and close a loop', async ({ page }) => {
  await page.getByTestId('tool-wall').click();
  // clicks are slightly off-grid on purpose
  await clickAt(page, 1.03, 1.04);
  await clickAt(page, 5.02, 0.97);
  await clickAt(page, 5.0, 4.01);
  await clickAt(page, 1.0, 4.0);
  await clickAt(page, 1.0, 1.0); // back on the first corner closes the loop
  const d = await design(page);
  expect(d.walls).toHaveLength(4);
  expect(d.walls[0].a).toEqual({ x: 1, y: 1 });
  expect(d.walls[0].b).toEqual({ x: 5, y: 1 });
  expect(d.walls[2].b).toEqual({ x: 1, y: 4 });
  expect(d.walls[0].thickness).toBe(0.15);
  // loop closed: next click starts a fresh chain instead of extending the old one
  await clickAt(page, 8, 8);
  await clickAt(page, 9, 8);
  expect((await design(page)).walls).toHaveLength(5);
  await page.keyboard.press('Escape');
  await page.screenshot({ path: 'e2e/.results/m2-walls.png' });
});

test('wall thickness is adjustable for new and existing walls', async ({ page }) => {
  await page.getByTestId('tool-wall').click();
  await page.getByTestId('opt-thickness').fill('25');
  await page.getByTestId('opt-thickness').press('Enter');
  await clickAt(page, 1, 1);
  await clickAt(page, 4, 1);
  await page.keyboard.press('Enter');
  expect((await design(page)).walls[0].thickness).toBe(0.25);

  await page.getByTestId('tool-select').click();
  await clickAt(page, 2.5, 1);
  await expect(page.getByTestId('wall-thickness')).toHaveValue('25');
  await page.getByTestId('wall-thickness').fill('10');
  await page.getByTestId('wall-thickness').press('Enter');
  expect((await design(page)).walls[0].thickness).toBe(0.1);
  await expect(page.getByTestId('wall-length')).toHaveValue('300');
});

test('auto-detect a room, show its area, rename and recolor it', async ({ page }) => {
  await drawBox(page, 1, 1, 5, 4);
  await page.getByTestId('tool-room').click();
  await clickAt(page, 3, 2.5);
  const d = await design(page);
  expect(d.rooms).toHaveLength(1);
  expect(d.rooms[0].points).toHaveLength(4);
  // 4 x 3 m centerlines, 15 cm walls -> 3.85 x 2.85 inside = 10.97 m²
  await expect(page.getByTestId('room-area')).toContainText('10.9');
  await page.getByTestId('tool-select').click();
  await clickAt(page, 3, 2.5);
  await page.getByTestId('room-name').fill('Living room');
  await page.getByRole('button', { name: 'Color #dbe7f4' }).click();
  const r = (await design(page)).rooms[0];
  expect(r.name).toBe('Living room');
  expect(r.color).toBe('#dbe7f4');
  await page.screenshot({ path: 'e2e/.results/m2-room.png' });

  // clicking outside any closed area does not create a room
  await page.getByTestId('tool-room').click();
  await clickAt(page, 9, 9);
  expect((await design(page)).rooms).toHaveLength(1);
  await expect(page.locator('.statusbar')).toContainText('No closed room');
});

test('draw a room by hand', async ({ page }) => {
  await page.getByTestId('tool-room').click();
  await page.getByTestId('room-draw').click();
  await clickAt(page, 1, 1);
  await clickAt(page, 4, 1);
  await clickAt(page, 4, 3);
  await clickAt(page, 1, 3);
  await page.keyboard.press('Enter');
  const d = await design(page);
  expect(d.rooms).toHaveLength(1);
  await expect(page.getByTestId('room-area')).toContainText('6.00 m²');
});

test('doors and windows sit on walls; doors show a swing and can be flipped', async ({ page }) => {
  await drawBox(page, 1, 1, 5, 4);
  await page.getByTestId('tool-room').click();
  await clickAt(page, 3, 2.5);

  await page.getByTestId('tool-door').click();
  await moveTo(page, 2, 1.3); // inside the room, below the top wall
  await clickAt(page, 2, 1.3);
  let d = await design(page);
  expect(d.openings).toHaveLength(1);
  const door = d.openings[0];
  expect(door.kind).toBe('door');
  expect(door.wallId).toBe(d.walls[0].id);
  expect(door.pos).toBeCloseTo(1, 1); // 2 m along from x=1
  expect(door.swing).toBe(1); // cursor on the +y (right of a→b) side
  expect(door.width).toBe(0.9);

  // a second door at the same spot is refused
  await clickAt(page, 2, 1.3);
  expect((await design(page)).openings).toHaveLength(1);

  await page.getByTestId('tool-window').click();
  await clickAt(page, 5, 2.5);
  d = await design(page);
  expect(d.openings).toHaveLength(2);
  expect(d.openings[1].kind).toBe('window');
  expect(d.openings[1].width).toBe(1.2);

  // select the door, flip it
  await page.getByTestId('tool-select').click();
  await clickAt(page, 2, 1);
  await expect(page.getByTestId('properties')).toContainText('Door');
  await page.getByTestId('flip-swing').click();
  await page.getByTestId('flip-hinge').click();
  const o = (await design(page)).openings[0];
  expect(o.swing).toBe(-1);
  expect(o.hinge).toBe('b');

  // drag it along the wall
  await dragWorld(page, [2, 1], [3, 1]);
  expect((await design(page)).openings[0].pos).toBeCloseTo(2, 1);
  await page.screenshot({ path: 'e2e/.results/m2-openings.png' });
});

test('undo and redo, via buttons and keyboard', async ({ page }) => {
  await page.getByTestId('tool-wall').click();
  await clickAt(page, 1, 1);
  await clickAt(page, 4, 1);
  await clickAt(page, 4, 3);
  await page.keyboard.press('Enter');
  expect((await design(page)).walls).toHaveLength(2);

  await page.keyboard.press('Control+z');
  expect((await design(page)).walls).toHaveLength(1);
  await page.keyboard.press('Control+z');
  expect((await design(page)).walls).toHaveLength(0);
  await expect(page.getByTestId('undo')).toBeDisabled();
  await page.getByTestId('redo').click();
  await page.keyboard.press('Control+y');
  expect((await design(page)).walls).toHaveLength(2);
  await page.keyboard.press('Control+z');
  await page.keyboard.press('Control+Shift+z');
  expect((await design(page)).walls).toHaveLength(2);
});

test('moving a wall is a single undo step and keeps joined walls attached', async ({ page }) => {
  await drawBox(page, 1, 1, 5, 4);
  await page.getByTestId('tool-select').click();
  // drag the right wall 1 m to the right
  await dragWorld(page, [5, 2.5], [6, 2.5]);
  let d = await design(page);
  const right = d.walls[1];
  expect(right.a.x).toBeCloseTo(6);
  expect(right.b.x).toBeCloseTo(6);
  // top and bottom walls stretched to follow
  expect(d.walls[0].b).toEqual({ x: 6, y: 1 });
  expect(d.walls[2].a).toEqual({ x: 6, y: 4 });
  expect(d.walls[0].a).toEqual({ x: 1, y: 1 });
  await page.keyboard.press('Control+z');
  d = await design(page);
  expect(d.walls[1].a.x).toBeCloseTo(5);
  expect(d.walls[0].b).toEqual({ x: 5, y: 1 });
});

test('dragging a corner handle moves the joined corner of both walls', async ({ page }) => {
  await drawBox(page, 1, 1, 5, 4);
  await clickAt(page, 3, 1); // select top wall
  await dragWorld(page, [5, 1], [6, 0]);
  const d = await design(page);
  expect(d.walls[0].b).toEqual({ x: 6, y: 0 });
  expect(d.walls[1].a).toEqual({ x: 6, y: 0 });
});

test('delete and deselect', async ({ page }) => {
  await drawBox(page, 1, 1, 5, 4);
  await clickAt(page, 3, 1);
  expect((await ui(page)).selection?.kind).toBe('wall');
  await page.keyboard.press('Delete');
  expect((await design(page)).walls).toHaveLength(3);
  const p = await at(page, 8, 8);
  await page.mouse.click(p.x, p.y);
  expect((await ui(page)).selection).toBeNull();
});

test('rooms cannot overlap: clicking a room again selects it, and overlapping drawn rooms are refused', async ({ page }) => {
  await drawBox(page, 1, 1, 5, 4);
  await page.getByTestId('tool-room').click();
  await clickAt(page, 3, 2.5);
  expect((await design(page)).rooms).toHaveLength(1);
  const id = (await design(page)).rooms[0].id;

  // click the same room again with the room tool: no second room, the existing one is selected
  await page.keyboard.press('Escape');
  await page.getByTestId('tool-room').click();
  await clickAt(page, 2, 3.5);
  expect((await design(page)).rooms).toHaveLength(1);
  await expect(page.locator('.statusbar')).toContainText('already a room');
  expect((await ui(page)).selection).toEqual({ kind: 'room', id });

  // a hand-drawn room overlapping it is refused
  await page.getByTestId('tool-room').click();
  await page.getByTestId('room-draw').click();
  await clickAt(page, 4, 3);
  await clickAt(page, 7, 3);
  await clickAt(page, 7, 6);
  await clickAt(page, 4, 6);
  await page.keyboard.press('Enter');
  expect((await design(page)).rooms).toHaveLength(1);
  await expect(page.locator('.statusbar')).toContainText('overlap');

  // ...but one next to it, outside the walls, is fine
  await clickAt(page, 6, 1);
  await clickAt(page, 9, 1);
  await clickAt(page, 9, 4);
  await clickAt(page, 6, 4);
  await page.keyboard.press('Enter');
  expect((await design(page)).rooms).toHaveLength(2);
});
