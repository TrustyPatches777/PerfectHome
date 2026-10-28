import { test, expect, type Page } from '@playwright/test';
import { clickAt, design, fresh } from './helpers';

/* eslint-disable @typescript-eslint/no-explicit-any */

test.beforeEach(async ({ page }) => {
  await fresh(page);
});

const NONE = { meshes: 0, mode: '', look: [0, 0, 0], camera: [0, 0, 0], doorsOpen: 0, filled: 0 };
const stats = (page: Page): Promise<typeof NONE> => page.evaluate((none) => (window as any).__ph3d?.stats() ?? none, NONE);
const scene = <T,>(page: Page, fn: (s: any) => T) => page.evaluate(`(${fn.toString()})(window.__ph3d.scene)`) as Promise<T>;

/** A small house made with the rectangle tool (walls and room in one drag), with doors and windows. */
async function house(page: Page) {
  await page.getByTestId('tool-wall').click();
  await page.getByTestId('wall-mode-rect').click();
  await page.mouse.move(0, 0);
  const a = await page.evaluate(() => (window as any).__ph.ui.getState().viewport);
  void a;
  await page.evaluate(() => {
    (window as any).__ph.design.getState().update((d: any) => {
      const F = d.floors[0].id;
      const w = (id: string, ax: number, ay: number, bx: number, by: number) => d.walls.push({ id, floor: F, a: { x: ax, y: ay }, b: { x: bx, y: by }, thickness: 0.3, type: 'exterior', height: 2.5 });
      w('n', 2, 2, 10, 2);
      w('e', 10, 2, 10, 7);
      w('s', 10, 7, 2, 7);
      w('w', 2, 7, 2, 2);
      d.rooms.push({ id: 'r', floor: F, name: 'Room 1', color: '#e7c9a0', material: 'wood', living: true, points: [{ x: 2.15, y: 2.15 }, { x: 9.85, y: 2.15 }, { x: 9.85, y: 6.85 }, { x: 2.15, y: 6.85 }] });
      d.openings.push({ id: 'front', wallId: 's', kind: 'door', pos: 2, width: 1, swing: 1, hinge: 'a' }); // the south wall runs from x=10 to x=2: pos 2 is x=8
      d.openings.push({ id: 'win', wallId: 'n', kind: 'window', pos: 3, width: 1.6, swing: 1, hinge: 'a' });
      d.openings.push({ id: 'dbl', wallId: 'e', kind: 'double', pos: 2.5, width: 1.6, swing: -1, hinge: 'a' });
      d.openings.push({ id: 'slide', wallId: 'w', kind: 'sliding', pos: 2.5, width: 2, swing: 1, hinge: 'a' });
    });
  });
  await page.getByTestId('tool-select').click();
}

async function open3d(page: Page) {
  await page.getByTestId('view-3d').click();
  await expect.poll(async () => (await stats(page)).meshes).toBeGreaterThan(10);
}

test('click a door in 3D to open or close it', async ({ page }) => {
  await house(page);
  await open3d(page);
  // stand inside, facing the front door (the south wall, +z), two meters away
  await scene(page, (s) => s.walkTo(8, 5, 0));
  const door = await scene(page, (s) => s.screenOf(8, 1.0, 7));
  await page.mouse.click(door.x, door.y);
  await expect.poll(async () => (await stats(page)).doorsOpen).toBe(1);
  // how far the leaf has swung (it moves frame by frame: wait for it instead of a fixed time, the frame rate varies)
  const swingOf = () =>
    scene(page, (s) => {
      let max = 0;
      s.world.traverse((o: any) => {
        if (o.userData?.door === 'front' && o.isGroup) max = Math.max(max, Math.abs(o.rotation.y));
      });
      return max;
    });
  await expect.poll(swingOf).toBeCloseTo(Math.PI / 2, 1); // it swings open
  await page.screenshot({ path: 'e2e/.results/m25-door-open.png' });
  // its leaf now stands across the wall: the middle of the doorway shows what is behind it
  // click the open leaf, or the doorway: the leaf is what reacts; click it again to close
  const leafNow = await scene(page, (s) => {
    let p: any = null;
    s.world.traverse((o: any) => {
      if (o.userData?.door === 'front' && o.isMesh && !p) p = o.getWorldPosition(new (o.position.constructor)());
    });
    return s.screenOf(p.x, p.y, p.z);
  });
  await page.mouse.click(leafNow.x, leafNow.y);
  await expect.poll(async () => (await stats(page)).doorsOpen).toBe(0);
  await expect.poll(swingOf).toBeCloseTo(0, 1); // it swings shut

  // a door too far away does not react
  await scene(page, (s) => s.walkTo(6.5, 2.6, 0));
  const far = await scene(page, (s) => s.screenOf(8, 1.0, 7));
  await page.mouse.click(far.x, far.y);
  await page.waitForTimeout(150);
  expect((await stats(page)).doorsOpen).toBe(0);
  await expect(page.locator('.hint')).toContainText('closer');

  // double doors, sliding doors and the view from outside work as well (orbit mode: no distance limit)
  await page.getByTestId('mode-orbit').click();
  await scene(page, (s) => s.toggleDoor('dbl'));
  await scene(page, (s) => s.toggleDoor('slide'));
  await expect.poll(async () => (await stats(page)).doorsOpen).toBe(2);
  await page.waitForTimeout(900);
  await scene(page, (s) => s.setView([16, 7, 5], [10, 1, 4.5]));
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'e2e/.results/m25-doors-double.png' });
  // a rebuilt wall keeps its open doors open
  await page.evaluate(() => (window as any).__ph.design.getState().update((d: any) => void (d.walls[1].thickness = 0.32)));
  await page.waitForTimeout(200);
  expect((await stats(page)).doorsOpen).toBe(2);
});

test('walking: dragging right or pressing the right arrow turns right, up looks up', async ({ page }) => {
  await house(page);
  await open3d(page);
  await page.getByTestId('mode-walk').click();
  await expect.poll(async () => (await stats(page)).mode).toBe('walk');
  await scene(page, (s) => s.walkTo(6, 5, Math.PI)); // looking towards the top of the plan: -z, with east (+x) on the right
  let look = (await stats(page)).look;
  expect(look[2]).toBeLessThan(-0.99);
  const c = await page.getByTestId('view3d-canvas').boundingBox();
  const cx = c!.x + c!.width / 2;
  const cy = c!.y + c!.height / 2;
  // drag to the right: the view turns to the right, towards +x
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 120, cy, { steps: 6 });
  await page.mouse.up();
  look = (await stats(page)).look;
  expect(look[0]).toBeGreaterThan(0.3);
  // the left arrow turns back
  await page.getByTestId('view3d-canvas').focus();
  await page.keyboard.down('ArrowLeft');
  // held until it has turned (the walker moves with the frame rate, which drops when the machine is busy), not for a fixed time
  await expect.poll(async () => (await stats(page)).look[0], { timeout: 10_000 }).toBeLessThan(look[0] - 0.3);
  await page.keyboard.up('ArrowLeft');
  // dragging up looks up; with "invert" it looks down
  await scene(page, (s) => s.walkTo(6, 5, Math.PI));
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx, cy - 80, { steps: 5 });
  await page.mouse.up();
  expect((await stats(page)).look[1]).toBeGreaterThan(0.2);
  await page.getByTestId('view3d-invert').check();
  await scene(page, (s) => s.walkTo(6, 5, Math.PI));
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx, cy - 80, { steps: 5 });
  await page.mouse.up();
  expect((await stats(page)).look[1]).toBeLessThan(-0.2);
  // forward goes where you look: W moves towards -z when facing the top of the plan
  await page.getByTestId('view3d-invert').uncheck();
  await scene(page, (s) => s.walkTo(6, 5, Math.PI));
  await page.getByTestId('view3d-canvas').focus();
  await page.keyboard.down('w');
  await expect.poll(async () => (await stats(page)).camera[2], { timeout: 10_000 }).toBeLessThan(4.7);
  await page.keyboard.up('w');
  await page.keyboard.down('d'); // and D to the right: +x
  await expect.poll(async () => (await stats(page)).camera[0], { timeout: 10_000 }).toBeGreaterThan(6.3);
  await page.keyboard.up('d');
});

test('a swimming pool and a pond have depth: the ground is cut away under them', async ({ page }) => {
  await page.evaluate(() => {
    (window as any).__ph.design.getState().update((d: any) => {
      const F = d.floors[0].id;
      d.furniture.push({ id: 'pool', floor: F, type: 'pool', x: 4, y: 3, w: 6, d: 3, rotation: 0, color: '#bfe0f5', label: '' });
      d.zones.push({ id: 'pond', floor: F, kind: 'water', name: '', color: '#bfe0f5', points: [{ x: 9, y: 1.5 }, { x: 12, y: 1.5 }, { x: 12, y: 4 }, { x: 9, y: 4 }] });
    });
  });
  await open3d(page);
  // the ground has holes where they are
  const holes = await scene(page, (s) => {
    let found = 0;
    s.world.traverse((o: any) => {
      if (o.isMesh && o.geometry?.type === 'ExtrudeGeometry' && o.geometry.parameters?.shapes?.holes?.length) found += o.geometry.parameters.shapes.holes.length;
    });
    return found;
  });
  expect(holes).toBe(2);
  // a low view across the water: the walls and floor of the basin are there
  await scene(page, (s) => s.setView([7, 4.5, 8], [7, -0.5, 3]));
  await page.waitForTimeout(250);
  await page.screenshot({ path: 'e2e/.results/m25-pool.png' });
  const deepest = await scene(page, (s) => {
    let min = 0;
    s.world.traverse((o: any) => {
      if (!o.isMesh) return;
      o.geometry.computeBoundingBox();
      const b = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
      min = Math.min(min, b.min.y);
    });
    return min;
  });
  expect(deepest).toBeLessThan(-1.4);
});

test('painted walls show their covering in 3D, and a skylight lies in the roof slope', async ({ page }) => {
  await house(page);
  await page.evaluate(() => (window as any).__ph.design.getState().update((d: any) => {
    d.walls[2].paint = { r: { finish: 'brick', color: '#b5603f' }, l: { finish: 'stone', color: '#a8a29a' } }; // south wall: inside brick, outside stone
    d.walls[0].paint = { r: { finish: 'paint', color: '#c7d7ee' } };
    d.walls[3].paint = { r: { finish: 'wood', color: '#a47c52' } };
    d.furniture.push({ id: 'sofa', floor: d.floors[0].id, type: 'sofa-l', x: 5, y: 5.5, w: 2.8, d: 1.9, rotation: 0, color: '#b7c9a8', label: '' });
  }));
  // a roof from the plan, then a skylight clicked onto its front slope
  await page.getByTestId('tool-roof').click();
  await page.getByTestId('roof-fit-walls').click();
  await page.getByTestId('tool-skylight').click();
  await clickAt(page, 6, 5.6); // south slope (the ridge runs along the middle at y = 4.5)
  const d = await design(page);
  expect(d.skylights).toHaveLength(1);
  expect(d.skylights[0]).toMatchObject({ w: 0.78, d: 1.18 });
  // not on a roof: refused with a hint
  await page.getByTestId('tool-skylight').click();
  await clickAt(page, 14, 2);
  expect((await design(page)).skylights).toHaveLength(1);
  await expect(page.locator('.hint')).toContainText('roof');
  // select it: the properties offer the sizes
  await page.getByTestId('tool-select').click();
  await clickAt(page, 6, 5.6);
  await expect(page.getByTestId('sky-status')).toContainText('slope');
  await page.getByTestId('sky-size-large').click();
  expect((await design(page)).skylights[0]).toMatchObject({ w: 1.14, d: 1.4 });
  await page.screenshot({ path: 'e2e/.results/m25-skylight-plan.png' });

  await open3d(page);
  await scene(page, (s) => s.setView([5, 9, 15], [6, 2.5, 5]));
  await page.waitForTimeout(250);
  await page.screenshot({ path: 'e2e/.results/m25-skylight-3d.png' });
  expect((await stats(page)).filled).toBeGreaterThan(0.2);
  // inside, with the roof off: painted walls and the corner sofa
  await page.getByTestId('view3d-roof').uncheck();
  await scene(page, (s) => s.setView([6, 7.5, 11.5], [6, 0.5, 4.5]));
  await page.waitForTimeout(250);
  await page.screenshot({ path: 'e2e/.results/m25-paint-3d.png' });
  await scene(page, (s) => s.setView([14, 2.4, 9], [8, 1, 3.5]));
  await page.waitForTimeout(250);
  await page.screenshot({ path: 'e2e/.results/m25-paint-3d-outside.png' });
});
