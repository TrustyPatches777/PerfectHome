import { test, expect, type Page } from '@playwright/test';
import { at, clickAt, design, dragWorld, fresh, moveTo, pickFurniture, ui } from './helpers';

/* eslint-disable @typescript-eslint/no-explicit-any */

test.beforeEach(async ({ page }) => {
  await fresh(page);
});

const area = (pts: { x: number; y: number }[]) => Math.abs(pts.reduce((s, p, i) => s + (p.x * pts[(i + 1) % pts.length].y - pts[(i + 1) % pts.length].x * p.y), 0) / 2);

/** The wall tool in rectangle mode, then a drag from one corner to the opposite one. */
async function rectangle(page: Page, from: [number, number], to: [number, number], withRoom = true) {
  await page.getByTestId('tool-wall').click();
  await page.getByTestId('wall-mode-rect').click();
  const box = page.getByTestId('wall-rect-room');
  if ((await box.isChecked()) !== withRoom) await box.setChecked(withRoom);
  await dragWorld(page, from, to);
  await page.getByTestId('tool-select').click();
}

test('draw a whole room in one drag: four walls and the room inside them', async ({ page }) => {
  await rectangle(page, [1, 1], [6, 5]);
  let d = await design(page);
  expect(d.walls).toHaveLength(4);
  expect(d.rooms).toHaveLength(1);
  expect(area(d.rooms[0].points)).toBeCloseTo((5 - 0.15) * (4 - 0.15), 1);
  // the walls close up into a loop
  d.walls.forEach((w: any, i: number) => expect(w.b).toEqual(d.walls[(i + 1) % 4].a));
  await page.screenshot({ path: 'e2e/.results/m24-rect.png' });

  // without the room, and the tool stays in rectangle mode
  await rectangle(page, [8, 1], [11, 4], false);
  d = await design(page);
  expect(d.walls).toHaveLength(8);
  expect(d.rooms).toHaveLength(1);
  // one undo takes back one rectangle
  await page.getByTestId('undo').click();
  expect((await design(page)).walls).toHaveLength(4);
  await page.getByTestId('undo').click();
  expect((await design(page)).walls).toHaveLength(0);
  expect((await design(page)).rooms).toHaveLength(0);

  // type the size: click a corner, then 4x3 + Enter
  await page.getByTestId('tool-wall').click();
  await clickAt(page, 1, 8);
  await moveTo(page, 3, 10);
  await page.keyboard.type('4x3');
  await page.keyboard.press('Enter');
  d = await design(page);
  expect(d.walls).toHaveLength(4);
  const xs = d.walls.flatMap((w: any) => [w.a.x, w.b.x]);
  const ys = d.walls.flatMap((w: any) => [w.a.y, w.b.y]);
  expect([Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]).toEqual([1, 5, 8, 11]);
});

test('the room tool can drag a box too, and refuses to overlap another room', async ({ page }) => {
  await page.getByTestId('tool-room').click();
  await page.getByTestId('room-box').click();
  await dragWorld(page, [1, 1], [4, 3]);
  expect((await design(page)).rooms).toHaveLength(1);
  expect((await design(page)).walls).toHaveLength(0);
  expect(area((await design(page)).rooms[0].points)).toBeCloseTo(6, 1);
  await dragWorld(page, [3, 2], [6, 5]); // overlaps
  expect((await design(page)).rooms).toHaveLength(1);
  await expect(page.locator('.hint')).toContainText('overlap');
});

test('drag a wall sideways: the walls joined to it stretch and the room grows with it', async ({ page }) => {
  await rectangle(page, [1, 1], [6, 5]);
  const before = await design(page);
  const areaBefore = area(before.rooms[0].points);
  // drag the right wall to the right (and a bit down: it only moves straight out)
  await dragWorld(page, [6, 3], [8, 3.7]);
  const after = await design(page);
  const east = after.walls[1];
  expect(east.a.x).toBeCloseTo(8, 1);
  expect(east.b.x).toBeCloseTo(8, 1);
  expect(east.a.y).toBe(1); // it did not move down
  expect(east.b.y).toBe(5);
  expect(after.walls[0].b.x).toBeCloseTo(8, 1); // the top and bottom walls stretched
  expect(after.walls[2].a.x).toBeCloseTo(8, 1);
  expect(after.walls[3].a.x).toBe(1); // the far side stayed
  expect(area(after.rooms[0].points)).toBeCloseTo((7 - 0.15) * (4 - 0.15), 1);
  expect(area(after.rooms[0].points)).toBeGreaterThan(areaBefore + 5);
  // one undo takes the whole move back, room included
  await page.getByTestId('undo').click();
  const undone = await design(page);
  expect(undone.walls[1].a.x).toBe(6);
  expect(area(undone.rooms[0].points)).toBeCloseTo(areaBefore, 3);
  // drag the top wall up
  await dragWorld(page, [3.5, 1], [3.5, -0.5]);
  const up = await design(page);
  expect(up.walls[0].a.y).toBeCloseTo(-0.5, 1);
  expect(up.walls[1].a.y).toBeCloseTo(-0.5, 1);
  expect(area(up.rooms[0].points)).toBeCloseTo((5 - 0.15) * (5.5 - 0.15), 1);
});

test('drag the side of a room, a lawn or a pond to push it out', async ({ page }) => {
  await page.evaluate(() => {
    (window as any).__ph.design.getState().update((d: any) => {
      const F = d.floors[0].id;
      d.rooms.push({ id: 'room', floor: F, name: 'Room 1', color: '#e8eef7', material: 'plain', living: true, points: [{ x: 1, y: 1 }, { x: 5, y: 1 }, { x: 5, y: 4 }, { x: 1, y: 4 }] });
      d.zones.push({ id: 'lawn', floor: F, kind: 'lawn', name: '', color: '#cfe8c4', points: [{ x: 7, y: 1 }, { x: 11, y: 1 }, { x: 11, y: 4 }, { x: 7, y: 4 }] });
    });
  });
  // the room: select it, then drag the handle in the middle of its bottom side down
  await page.evaluate(() => (window as any).__ph.ui.getState().select({ kind: 'room', id: 'room' }));
  await dragWorld(page, [3, 4], [3, 6]);
  let d = await design(page);
  expect(d.rooms[0].points.map((p: any) => [p.x, p.y])).toEqual([[1, 1], [5, 1], [5, 6], [1, 6]]);
  // the lawn: its right side
  await page.evaluate(() => (window as any).__ph.ui.getState().select({ kind: 'zone', id: 'lawn' }));
  await dragWorld(page, [11, 2.5], [12.5, 3]);
  d = await design(page);
  expect(d.zones[0].points.map((p: any) => [p.x, p.y])).toEqual([[7, 1], [12.5, 1], [12.5, 4], [7, 4]]);
  // and a side can go inwards too
  await dragWorld(page, [12.5, 2.5], [10, 2.5]);
  expect((await design(page)).zones[0].points[1].x).toBeCloseTo(10, 1);
  await page.screenshot({ path: 'e2e/.results/m24-edges.png' });
  // a room will not grow into another room
  await page.evaluate(() => (window as any).__ph.design.getState().update((x: any) => void x.rooms.push({ id: 'next', floor: x.floors[0].id, name: 'Room 2', color: '#eee', material: 'plain', living: true, points: [{ x: 5.5, y: 1 }, { x: 6.5, y: 1 }, { x: 6.5, y: 4 }, { x: 5.5, y: 4 }] })));
  await page.evaluate(() => (window as any).__ph.ui.getState().select({ kind: 'room', id: 'room' }));
  await dragWorld(page, [5, 3.5], [7, 3.5]);
  expect((await design(page)).rooms[0].points[1].x).toBeLessThan(5.5);
});

test('exterior and load-bearing walls are one type now', async ({ page }) => {
  await page.getByTestId('tool-wall').click();
  await expect(page.getByTestId('wall-type-exterior')).toContainText('Exterior / load-bearing');
  await expect(page.getByTestId('wall-type-load')).toHaveCount(0);
  await expect(page.locator('[data-testid^="wall-type-"]')).toHaveCount(4);
});

test('paint walls: pick a covering and a color, click a face', async ({ page }) => {
  await rectangle(page, [2, 2], [8, 6], false);
  await page.getByTestId('tool-paint').click();
  await page.getByTestId('paint-finish').selectOption('brick');
  await page.getByTestId('paint-color-#c7d7ee').click();
  // the bottom wall runs right to left, so its right-hand face (the one looking at the room) is the upper one
  await clickAt(page, 5, 5.93);
  let walls = (await design(page)).walls;
  expect(walls[2].paint).toEqual({ r: { finish: 'brick', color: '#c7d7ee' } });
  // the outer face of the same wall
  await page.getByTestId('paint-finish').selectOption('stone');
  await clickAt(page, 5, 6.07);
  walls = (await design(page)).walls;
  expect(walls[2].paint.l).toMatchObject({ finish: 'stone' });
  expect(walls[2].paint.r).toMatchObject({ finish: 'brick' });
  // Shift paints both faces of another wall
  await page.getByTestId('paint-finish').selectOption('wood');
  const p = await at(page, 2, 4);
  await page.keyboard.down('Shift');
  await page.mouse.click(p.x, p.y);
  await page.keyboard.up('Shift');
  walls = (await design(page)).walls;
  expect(walls[3].paint.l).toMatchObject({ finish: 'wood' });
  expect(walls[3].paint.r).toMatchObject({ finish: 'wood' });
  await page.screenshot({ path: 'e2e/.results/m24-paint-plan.png' });
  // take a covering off
  await page.getByTestId('paint-finish').selectOption('clear');
  await clickAt(page, 5, 5.93);
  expect((await design(page)).walls[2].paint).toEqual({ l: { finish: 'stone', color: '#a8a29a' } }); // changing the covering brings its usual color
  // the properties of a wall show both faces and can change them
  await page.getByTestId('tool-select').click();
  await clickAt(page, 5, 6);
  await expect(page.getByTestId('wall-finish-l')).toHaveValue('stone');
  await page.getByTestId('wall-finish-r').selectOption('tiles');
  expect((await design(page)).walls[2].paint.r.finish).toBe('tiles');
  await page.getByTestId('wall-finish-l').selectOption('none');
  expect((await design(page)).walls[2].paint.l).toBeUndefined();
  // undo works step by step
  await page.getByTestId('undo').click();
  expect((await design(page)).walls[2].paint.l.finish).toBe('stone');
});

test('furniture cannot be put or dragged into walls, and does not go where it does not fit', async ({ page }) => {
  await rectangle(page, [1, 1], [8, 6], false);
  const sofa = async () => (await design(page)).furniture[0];
  // dropped on the top wall: pushed down against its inner face (wall center y=1, half thickness 0.075, half depth 0.45)
  await pickFurniture(page, 'sofa');
  await clickAt(page, 4, 1.05);
  expect((await sofa()).y).toBeCloseTo(1 + 0.075 + 0.45, 1);
  // drag it into the right wall: it stops against it (a 2 m wide sofa: center at 8 - 0.075 - 1)
  await dragWorld(page, [4, 1.5], [9, 1.5]);
  expect((await sofa()).x).toBeCloseTo(8 - 0.075 - 1, 1);
  // and out through the top: it stays inside
  await dragWorld(page, [6.9, 1.5], [6.9, -2]);
  expect((await sofa()).y).toBeGreaterThanOrEqual(1 + 0.075 + 0.45 - 0.01);
  // turn it to face the wall and it moves out of the way instead of going through
  await page.keyboard.press('r');
  const turned = await sofa();
  expect(turned.rotation).toBe(90);
  expect(turned.y).toBeGreaterThanOrEqual(1 + 0.075 + 1 - 0.01);

  // a narrow slot between two walls: 60 cm. A sofa does not fit; a small bedside table does.
  await page.evaluate(() => (window as any).__ph.design.getState().update((d: any) => {
    const F = d.floors[0].id;
    d.walls.push({ id: 'p1', floor: F, a: { x: 10, y: 0 }, b: { x: 14, y: 0 }, thickness: 0.15, type: 'interior', height: 2.5 }, { id: 'p2', floor: F, a: { x: 10, y: 0.8 }, b: { x: 14, y: 0.8 }, thickness: 0.15, type: 'interior', height: 2.5 });
  }));
  await page.keyboard.press('Escape');
  await pickFurniture(page, 'sofa');
  await clickAt(page, 12, 0.4);
  expect((await design(page)).furniture).toHaveLength(1);
  await expect(page.locator('.hint')).toContainText('does not fit');
  await page.keyboard.press('Escape');
  await pickFurniture(page, 'bedside');
  await clickAt(page, 12, 0.4);
  expect((await design(page)).furniture).toHaveLength(2);

  // wall-mounted things and lamps may touch walls
  await pickFurniture(page, 'socket');
  await clickAt(page, 4, 1.1);
  expect((await design(page)).furniture).toHaveLength(3);
});
