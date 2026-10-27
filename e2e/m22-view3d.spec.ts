import { test, expect, type Page } from '@playwright/test';
import { design, fresh } from './helpers';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** A furnished two-storey house with a garden, built straight into the design. */
async function furnishedHouse(page: Page) {
  await page.evaluate(() => {
    const store = (window as any).__ph.design.getState();
    store.update((d: any) => {
      const F = d.floors[0].id;
      d.floors.push({ id: 'up', name: '1st floor' });
      const wall = (id: string, floor: string, a: number[], b: number[], type = 'interior', t = 0.15) =>
        d.walls.push({ id, floor, a: { x: a[0], y: a[1] }, b: { x: b[0], y: b[1] }, thickness: t, type, height: 2.5 });
      // ground floor 10 x 7 m
      wall('n', F, [0, 0], [10, 0], 'exterior', 0.3);
      wall('e', F, [10, 0], [10, 7], 'exterior', 0.3);
      wall('s', F, [10, 7], [0, 7], 'exterior', 0.3);
      wall('w', F, [0, 7], [0, 0], 'exterior', 0.3);
      wall('mid', F, [5, 0], [5, 7]);
      wall('mid2', F, [5, 4], [10, 4]);
      const open = (id: string, wallId: string, kind: string, pos: number, width: number, swing = 1) => d.openings.push({ id, wallId, kind, pos, width, swing, hinge: 'a' });
      open('door-front', 's', 'door', 7.5, 1);
      open('win-n1', 'n', 'window', 2.5, 1.6);
      open('win-n2', 'n', 'window', 7.5, 1.2);
      open('french', 'w', 'french', 3.5, 1.8);
      open('mid-door', 'mid', 'door', 5.5, 0.9);
      open('bath-door', 'mid2', 'door', 7.5, 0.8);
      open('bay', 'e', 'bay', 2, 1.8);
      open('win-s', 's', 'window', 2.5, 1.4);
      const room = (id: string, floor: string, name: string, material: string, color: string, x0: number, y0: number, x1: number, y1: number) =>
        d.rooms.push({ id, floor, name, material, color, living: true, points: [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }] });
      room('living', F, 'Living', 'wood', '#e7c9a0', 0.15, 0.15, 4.93, 6.85);
      room('kitchen', F, 'Kitchen', 'tile', '#dbe3ea', 5.08, 0.15, 9.85, 3.93);
      room('bath', F, 'Bath', 'tile', '#cfe3ee', 5.08, 4.08, 9.85, 6.85);
      const fur = (type: string, x: number, y: number, w: number, dd: number, rotation = 0, color = '#cbd5e1', floor = F) =>
        d.furniture.push({ id: `${type}-${x}-${y}`, floor, type, x, y, w, d: dd, rotation, color, label: '' });
      fur('rug', 2.5, 4.2, 2.6, 1.8, 0, '#c9b8a3');
      fur('sofa', 2.5, 5.9, 2, 0.9, 180, '#b7c9a8');
      fur('coffee-table', 2.5, 4.4, 1.1, 0.6, 0, '#d9c7b0');
      fur('armchair', 4.2, 4.4, 0.85, 0.85, 90, '#e6c9c9');
      fur('tv-unit', 2.5, 3.0, 1.6, 0.4, 0, '#9ca3af');
      fur('bookshelf', 0.45, 1.3, 0.3, 1.2, 270, '#d9c7b0');
      fur('floor-lamp', 4.4, 6.3, 0.4, 0.4, 0, '#fde68a');
      fur('side-table', 4.3, 5.4, 0.5, 0.5, 0, '#d9c7b0');
      fur('lamp-table', 4.3, 5.4, 0.3, 0.3, 0, '#fde68a');
      fur('plant', 0.6, 6.3, 0.5, 0.5, 0, '#86c08a');
      fur('dining-set-4', 2.5, 1.5, 1.7, 1.5, 0, '#d9c7b0');
      fur('lamp-pendant', 2.5, 1.5, 0.55, 0.55, 0, '#fde68a');
      fur('piano', 0.9, 3.3, 1.5, 0.65, 270, '#1f2937');
      fur('counter', 7.0, 0.45, 3.2, 0.6, 0, '#e5e7eb');
      fur('fridge', 9.4, 0.5, 0.7, 0.7, 0, '#d1d5db');
      fur('stove', 5.5, 0.45, 0.6, 0.6, 0, '#d1d5db');
      fur('kitchen-sink', 7.0, 0.45, 0.9, 0.6, 0, '#d1d5db');
      fur('kitchen-island', 7.5, 2.4, 1.9, 0.95, 0, '#93a3b8');
      fur('bar-stool', 7.0, 3.1, 0.4, 0.4, 0, '#6b7280');
      fur('bar-stool', 8.0, 3.1, 0.4, 0.4, 0, '#6b7280');
      fur('bathtub', 8.9, 6.4, 1.7, 0.75, 0, '#ffffff');
      fur('toilet', 5.5, 4.45, 0.4, 0.7, 0, '#ffffff');
      fur('bath-sink', 6.6, 4.35, 0.55, 0.45, 0, '#ffffff');
      fur('shower', 5.6, 6.35, 0.9, 0.9, 0, '#dbeafe');
      fur('washer', 9.4, 4.5, 0.6, 0.6, 0, '#f5f5f4');
      fur('radiator', 2.5, 6.78, 1.0, 0.12, 180, '#ffffff');
      fur('socket', 0.25, 3.3, 0.22, 0.1, 90, '#ffffff');
      d.stairs.push({ id: 'st', floor: F, kind: 'straight', x: 7.6, y: 5.3, w: 1.0, d: 2.2, rotation: 0, steps: 14, rise: 2.8, flip: false });
      // first floor: a bedroom and an office
      wall('un', 'up', [0, 0], [10, 0], 'exterior', 0.3);
      wall('ue', 'up', [10, 0], [10, 7], 'exterior', 0.3);
      wall('us', 'up', [10, 7], [0, 7], 'exterior', 0.3);
      wall('uw', 'up', [0, 7], [0, 0], 'exterior', 0.3);
      wall('umid', 'up', [5, 0], [5, 7]);
      open('uwin1', 'un', 'window', 2.5, 1.6);
      open('uwin2', 'us', 'window', 7.5, 1.6);
      open('udoor', 'umid', 'door', 3.5, 0.9);
      room('bed', 'up', 'Bedroom', 'carpet', '#d8d0e8', 0.15, 0.15, 4.93, 6.85);
      room('office', 'up', 'Office', 'parquet', '#e7c9a0', 5.08, 0.15, 9.85, 6.85);
      fur('bed-double', 2.4, 1.2, 1.6, 2.0, 0, '#c7d7ee', 'up');
      fur('bedside', 1.2, 0.5, 0.45, 0.4, 0, '#d9c7b0', 'up');
      fur('bedside', 3.6, 0.5, 0.45, 0.4, 0, '#d9c7b0', 'up');
      fur('wardrobe', 2.5, 6.6, 1.8, 0.6, 180, '#d9c7b0', 'up');
      fur('lamp-ceiling', 2.5, 3.5, 0.4, 0.4, 0, '#fde68a', 'up');
      fur('desk', 8.0, 0.6, 1.4, 0.7, 0, '#d9c7b0', 'up');
      fur('office-chair', 8.0, 1.4, 0.55, 0.55, 180, '#6b7280', 'up');
      fur('filing-cabinet', 9.5, 3.0, 0.45, 0.6, 270, '#9ca3af', 'up');
      // the garden
      d.zones.push({ id: 'lawn', floor: F, kind: 'lawn', name: '', color: '#cfe8c4', points: [{ x: -6, y: 8 }, { x: 16, y: 8 }, { x: 16, y: 16 }, { x: -6, y: 16 }] });
      d.zones.push({ id: 'terrace', floor: F, kind: 'terrace', name: '', color: '#e4dccb', points: [{ x: 10.2, y: 0 }, { x: 14, y: 0 }, { x: 14, y: 5 }, { x: 10.2, y: 5 }] });
      d.zones.push({ id: 'drive', floor: F, kind: 'driveway', name: '', color: '#d4d6da', points: [{ x: 6.5, y: 7.2 }, { x: 8.5, y: 7.2 }, { x: 8.5, y: 16 }, { x: 6.5, y: 16 }] });
      d.strips.push({ id: 'road', floor: F, kind: 'road', points: [{ x: -10, y: 19 }, { x: 22, y: 19 }], width: 6 });
      d.strips.push({ id: 'fence', floor: F, kind: 'fence', points: [{ x: -6, y: 16 }, { x: 16, y: 16 }, { x: 16, y: -4 }], width: 0.1 });
      d.strips.push({ id: 'hedge', floor: F, kind: 'hedge', points: [{ x: -6, y: -4 }, { x: -6, y: 16 }], width: 0.6 });
      fur('tree', -3, 11, 3, 3, 0, '#7fb77e');
      fur('tree-large', 13, 12, 6, 6, 0, '#6aa96a');
      fur('bush', 11.5, 1, 1, 1, 0, '#6aa96a');
      fur('car', 7.5, 12, 4.5, 1.9, 90, '#9db4d6');
      fur('patio-set', 12.2, 2.5, 2, 2, 0, '#f2e2a8');
      fur('parasol', 12.2, 2.5, 2.5, 2.5, 0, '#f4e6b0');
      fur('bbq', 13.2, 4.2, 0.9, 0.5, 0, '#374151');
      fur('lamp-garden', 6.0, 9.5, 0.3, 0.3, 0, '#fde68a');
    });
  });
}

test.beforeEach(async ({ page }) => {
  await fresh(page);
});

const NONE = { meshes: 0, chunks: 0, lamps: 0, mode: '', camera: [0, 0, 0], target: [0, 0, 0], shadows: false, dark: 0, filled: 0 };
/** Numbers from the 3D view (zeros until it has loaded). */
const stats = (page: Page): Promise<typeof NONE> => page.evaluate((none) => (window as any).__ph3d?.stats() ?? none, NONE);

test('the house shows in 3D, can be viewed from above, orbited, cut away and walked through', async ({ page }) => {
  await furnishedHouse(page);
  await page.getByTestId('view-3d').click();
  await expect(page.getByTestId('view3d-canvas')).toBeVisible();
  await expect.poll(async () => (await stats(page)).meshes).toBeGreaterThan(300);
  await expect.poll(async () => (await stats(page)).filled).toBeGreaterThan(0.3);
  await page.screenshot({ path: 'e2e/.results/m22-overview.png' });

  // from above: the camera is straight over the house
  await page.getByTestId('view3d-top').click();
  const top = await stats(page);
  expect(top.camera[1]).toBeGreaterThan(15);
  expect(Math.abs(top.camera[0] - top.target[0])).toBeLessThan(0.5);
  await page.screenshot({ path: 'e2e/.results/m22-top.png' });

  // cut-away: hide the first floor, see into the ground floor
  const before = (await stats(page)).meshes;
  await page.getByTestId('view3d-cutaway').check();
  await expect.poll(async () => (await stats(page)).meshes).toBeLessThan(before);
  await page.getByTestId('view3d-reset').click();
  await page.screenshot({ path: 'e2e/.results/m22-cutaway.png' });
  await page.getByTestId('view3d-cutaway').uncheck();
  await expect.poll(async () => (await stats(page)).meshes).toBe(before);

  // walking: eye height in the first room of the floor
  await page.getByTestId('mode-walk').click();
  await expect.poll(async () => (await stats(page)).mode).toBe('walk');
  const walk = await stats(page);
  expect(walk.camera[1]).toBeCloseTo(1.6, 1);
  const start = walk.camera.slice();
  await page.getByTestId('view3d-canvas').focus();
  // (the start is right in front of the TV unit now: furniture stops you, so go sideways)
  await page.keyboard.down('d');
  // the walker moves with the frame rate, which is slow on a test machine: wait until it has gone a little way
  await expect.poll(async () => { const c = (await stats(page)).camera; return Math.hypot(c[0] - start[0], c[2] - start[2]); }, { timeout: 20_000 }).toBeGreaterThan(0.2);
  await page.keyboard.up('d');
  await page.screenshot({ path: 'e2e/.results/m22-walk.png' });
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await stats(page)).mode).toBe('orbit');
});

test('close-ups of the rooms, for a look at the furniture models', async ({ page }) => {
  await furnishedHouse(page);
  await page.getByTestId('view-3d').click();
  await expect.poll(async () => (await stats(page)).meshes).toBeGreaterThan(300);
  await page.getByTestId('view3d-cutaway').check();
  const look = async (name: string, pos: number[], target: number[]) => {
    await page.evaluate(([p, t]) => (window as any).__ph3d.scene.setView(p, t), [pos, target]);
    await page.waitForTimeout(150);
    await page.screenshot({ path: `e2e/.results/m22-${name}.png`, clip: { x: 0, y: 52, width: 1180, height: 820 } });
  };
  await look('living', [-2.5, 6.5, 9], [2.6, 0.4, 3.6]);
  await look('kitchen', [7.5, 6.5, 7.5], [7.5, 0.4, 1.8]);
  await look('bath', [13, 5, 9], [7.5, 0.3, 5.3]);
  await page.getByTestId('view3d-cutaway').uncheck();
  await page.getByTestId('view3d-cutaway').check();
  await page.evaluate(() => (window as any).__ph.ui.getState().setActiveFloor('up'));
  await page.getByTestId('view3d-cutaway').uncheck();
  await look('upstairs', [-1, 10, 14], [5, 3.2, 3.5]);
  await look('garden', [20, 6, 20], [10, 0.5, 6]);
});

test('time of day: shadows by day, lamps and a dark sky at night', async ({ page }) => {
  await furnishedHouse(page);
  await page.getByTestId('view-3d').click();
  await expect.poll(async () => (await stats(page)).meshes).toBeGreaterThan(300);
  await page.getByTestId('view3d-slider').fill('15');
  await expect.poll(async () => (await stats(page)).shadows).toBe(true);
  expect((await stats(page)).dark).toBeLessThan(0.1);
  await page.getByTestId('view3d-shadows').uncheck();
  await expect.poll(async () => (await stats(page)).shadows).toBe(false);
  await page.getByTestId('view3d-shadows').check();

  await page.getByTestId('view3d-slider').fill('23');
  await expect.poll(async () => (await stats(page)).dark).toBeGreaterThan(0.9);
  expect((await stats(page)).shadows).toBe(false);
  expect((await stats(page)).lamps).toBeGreaterThan(0);
  await expect(page.getByTestId('view3d-clock')).toHaveText('23:00');
  await page.screenshot({ path: 'e2e/.results/m22-night.png' });

  await page.getByTestId('view3d-slider').fill('18.5');
  await page.screenshot({ path: 'e2e/.results/m22-evening.png' });
});

test('the 3D view follows the design and respects layers and floors', async ({ page }) => {
  await furnishedHouse(page);
  await page.getByTestId('view-3d').click();
  await expect.poll(async () => (await stats(page)).meshes).toBeGreaterThan(300);
  const all = (await stats(page)).meshes;

  // move one sofa in the data: only a little changes, and the picture stays
  await page.evaluate(() => (window as any).__ph.design.getState().update((d: any) => void (d.furniture.find((f: any) => f.type === 'sofa').x = 3)));
  await expect.poll(async () => (await stats(page)).meshes).toBe(all);

  // hiding the furniture layer takes the furniture out of the picture
  await page.evaluate(() => (window as any).__ph.design.getState().update((d: any) => void (d.layers.furniture.visible = false)));
  await expect.poll(async () => (await stats(page)).meshes).toBeLessThan(all * 0.6);
  await page.evaluate(() => (window as any).__ph.design.getState().update((d: any) => void (d.layers.furniture.visible = true)));
  await expect.poll(async () => (await stats(page)).meshes).toBe(all);

  // back to the plan and forth: nothing is lost
  await page.keyboard.press('2');
  await expect(page.locator('canvas').first()).toBeVisible();
  expect((await design(page)).walls.length).toBe(11);
  await page.keyboard.press('3');
  await expect.poll(async () => (await stats(page)).meshes).toBe(all);
});
