import { test, expect, type Page } from '@playwright/test';
import { design, dragWorld, fresh } from './helpers';

/* eslint-disable @typescript-eslint/no-explicit-any */

test.beforeEach(async ({ page }) => {
  await fresh(page);
});

const edit = (page: Page, body: string) => page.evaluate(`window.__ph.design.getState().update((d) => { ${body} })`);
const select = (page: Page, refs: { kind: string; id: string }[]) => page.evaluate((r) => (window as any).__ph.ui.getState().setSelected(r), refs);
const meshes = (page: Page): Promise<number> => page.evaluate(() => (window as any).__ph3d?.stats().meshes ?? 0);

const house = `
  const F = d.floors[0].id;
  for (const [id, ax, ay, bx, by] of [['a', 2, 2, 10, 2], ['b', 10, 2, 10, 7], ['c', 10, 7, 2, 7], ['d', 2, 7, 2, 2]]) d.walls.push({ id, floor: F, a: { x: ax, y: ay }, b: { x: bx, y: by }, thickness: 0.3, type: 'exterior', height: 2.5 });
  d.rooms.push({ id: 'r1', floor: F, name: 'Hall', color: '#e7c9a0', material: 'wood', living: true, points: [{ x: 2.15, y: 2.15 }, { x: 9.85, y: 2.15 }, { x: 9.85, y: 6.85 }, { x: 2.15, y: 6.85 }] });
`;

test('dragging a handle of a roof gives it a size on the grid (when snapping is on)', async ({ page }) => {
  await edit(page, house + `d.roofs.push({ id: 'rf', floor: F, kind: 'gable', x: 6, y: 4.5, w: 8.3, d: 5.3, rotation: 0, pitch: 35, overhang: 0.4, thickness: 0.15, material: 'tiles', color: '#b5523b', chimney: false, parapet: false });`);
  await select(page, [{ kind: 'roof', id: 'rf' }]);
  await dragWorld(page, [10.15, 4.5], [10.58, 4.5]); // the middle handle on the east side
  const r = (await design(page)).roofs[0];
  expect(r.w).toBeGreaterThan(8.4);
  expect(Math.abs(r.w * 10 - Math.round(r.w * 10))).toBeLessThan(1e-6);
  expect(Math.abs(r.d * 10 - Math.round(r.d * 10))).toBeLessThan(1e-6);
});

test('an attic built from the roof keeps its walls and floor under the roof (3D)', async ({ page }) => {
  await edit(page, house);
  await page.getByTestId('add-attic').click();
  await edit(page, `
    const A = d.floors[1].id;
    const pts = [[2.15, 2.15], [9.85, 2.15], [9.85, 6.85], [2.15, 6.85]];
    pts.forEach((p, i) => { const q = pts[(i + 1) % 4]; d.walls.push({ id: 'aw' + i, floor: A, a: { x: p[0], y: p[1] }, b: { x: q[0], y: q[1] }, thickness: 0.2, type: 'interior', height: 2.5 }); });`);
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await expect.poll(() => meshes(page)).toBeGreaterThan(20);
  await page.evaluate(() => (window as any).__ph3d.scene.setView([13, 5, 12], [6, 2.5, 4.5]));
  await page.screenshot({ path: 'e2e/.results/m31-attic.png' });
});

test('a flat roof sits on the walls', async ({ page }) => {
  await edit(page, house + `d.roofs.push({ id: 'fl', floor: F, kind: 'flat', x: 6, y: 4.5, w: 8.3, d: 5.3, rotation: 0, pitch: 3, overhang: 0.4, thickness: 0.25, material: 'gravel', color: '#9ca3af', chimney: false, parapet: false });`);
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await expect.poll(() => meshes(page)).toBeGreaterThan(5);
  await page.evaluate(() => (window as any).__ph3d.scene.setView([12, 5, 11], [6, 2.5, 4.5]));
  await page.screenshot({ path: 'e2e/.results/m31-flat-roof.png' });
});
