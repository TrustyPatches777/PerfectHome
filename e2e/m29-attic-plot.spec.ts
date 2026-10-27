import { test, expect, type Page } from '@playwright/test';
import { design, fresh } from './helpers';

/* eslint-disable @typescript-eslint/no-explicit-any */

test.beforeEach(async ({ page }) => {
  await fresh(page);
});

async function edit(page: Page, body: string) {
  await page.evaluate(`window.__ph.design.getState().update((d) => { ${body} })`);
}

const house = `
  const F = d.floors[0].id;
  for (const [id, ax, ay, bx, by] of [['a', 2, 2, 10, 2], ['b', 10, 2, 10, 7], ['c', 10, 7, 2, 7], ['d', 2, 7, 2, 2]]) d.walls.push({ id, floor: F, a: { x: ax, y: ay }, b: { x: bx, y: by }, thickness: 0.3, type: 'exterior', height: 2.5 });
  d.rooms.push({ id: 'r1', floor: F, name: 'Hall', color: '#e7c9a0', material: 'wood', living: true, points: [{ x: 2.15, y: 2.15 }, { x: 6, y: 2.15 }, { x: 6, y: 6.85 }, { x: 2.15, y: 6.85 }] });
  d.rooms.push({ id: 'r2', floor: F, name: 'Lounge', color: '#bfdbfe', material: 'wood', living: true, points: [{ x: 6, y: 2.15 }, { x: 9.85, y: 2.15 }, { x: 9.85, y: 6.85 }, { x: 6, y: 6.85 }] });
`;

test('an attic is built by itself: a roof is fitted when there is none, and the attic floor is the house outline', async ({ page }) => {
  await edit(page, house);
  expect((await design(page)).roofs).toHaveLength(0);
  await expect(page.getByTestId('add-attic')).toBeEnabled();
  await page.getByTestId('add-attic').click();
  let d = await design(page);
  expect(d.floors[1]).toMatchObject({ name: 'Attic', attic: true });
  expect(d.roofs).toHaveLength(1);
  expect(d.roofs[0]).toMatchObject({ kind: 'gable', floor: d.floors[0].id });
  // the two rooms below are one attic floor
  const attic = d.rooms.filter((r: any) => r.floor === d.floors[1].id);
  expect(attic).toHaveLength(1);
  expect(attic[0].name).toBe('Attic');
  const xs = attic[0].points.map((p: any) => p.x);
  expect(Math.min(...xs)).toBeCloseTo(2.15);
  expect(Math.max(...xs)).toBeCloseTo(9.85);
  // it shows in 3D under the roof, and can be rebuilt after the house changes
  await edit(page, `d.rooms = d.rooms.filter((r) => r.floor !== d.floors[1].id);`);
  expect((await design(page)).rooms.filter((r: any) => r.floor === d.floors[1].id)).toHaveLength(0);
  await page.getByTestId('rebuild-attic').click();
  d = await design(page);
  expect(d.rooms.filter((r: any) => r.floor === d.floors[1].id)).toHaveLength(1);
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__ph3d?.stats().meshes ?? 0)).toBeGreaterThan(10);
  await page.screenshot({ path: 'e2e/.results/m29-attic.png' });
});

test('with no walls there is nothing to build an attic from', async ({ page }) => {
  await expect(page.getByTestId('add-attic')).toBeDisabled();
});

test('the plot boundary is always behind the areas inside it, whenever it was drawn', async ({ page }) => {
  await edit(page, `
    const F = d.floors[0].id;
    d.zones.push({ id: 'pool', floor: F, kind: 'water', name: '', color: '#bfe0f5', points: [{ x: 3, y: 3 }, { x: 6, y: 3 }, { x: 6, y: 5 }, { x: 3, y: 5 }] });
    d.zones.push({ id: 'plot', floor: F, kind: 'plot', name: '', color: '#f4f1e6', points: [{ x: 0, y: 0 }, { x: 12, y: 0 }, { x: 12, y: 9 }, { x: 0, y: 9 }] });`);
  // the pool is later in the list than the plot, but the plot was drawn after it: look at the order the shapes are drawn in
  const order = await page.evaluate(() => {
    const stage = (window as any).__ph.stage();
    const fills = stage.find('Line').filter((l: any) => l.closed() && ['#bfe0f5', '#f4f1e6'].includes(l.fill()));
    return fills.map((l: any) => l.fill());
  });
  expect(order).toEqual(['#f4f1e6', '#bfe0f5']);
});
