import { test, expect, type Page } from '@playwright/test';
import { fresh } from './helpers';

/* eslint-disable @typescript-eslint/no-explicit-any */

test.beforeEach(async ({ page }) => {
  await fresh(page);
});

const edit = (page: Page, body: string) => page.evaluate(`window.__ph.design.getState().update((d) => { ${body} })`);
const stats = (page: Page) => page.evaluate(() => (window as any).__ph3d.stats());
const shot = async (page: Page, name: string) => {
  await page.evaluate(() => (window as any).__ph3d.scene.renderNow());
  await page.screenshot({ path: `e2e/.results/m38-${name}.png` });
};

/** A house with a lawn, a tree, a window and a sofa, seen from outside. */
async function house(page: Page) {
  await edit(page, `
    const g = d.floors[0].id;
    const pts = [[0, 0], [8, 0], [8, 6], [0, 6]];
    pts.forEach((p, i) => { const q = pts[(i + 1) % 4]; d.walls.push({ id: 'w' + i, floor: g, a: { x: p[0], y: p[1] }, b: { x: q[0], y: q[1] }, thickness: 0.3, type: 'exterior', height: 2.5 }); });
    d.rooms.push({ id: 'r', floor: g, name: 'Living', color: '#f1e6d0', material: 'wood', living: true, points: [{ x: 0.15, y: 0.15 }, { x: 7.85, y: 0.15 }, { x: 7.85, y: 5.85 }, { x: 0.15, y: 5.85 }] });
    d.openings.push({ id: 'win', wallId: 'w2', kind: 'window', pos: 3, width: 1.4, swing: 1, hinge: 'a' });
    d.openings.push({ id: 'door', wallId: 'w0', kind: 'door', pos: 4, width: 0.9, swing: 1, hinge: 'a' });
    d.furniture.push({ id: 'sofa', floor: g, type: 'sofa', x: 3, y: 3, w: 2.2, d: 0.95, rotation: 0, color: '#8aa0b8', label: '' });
    d.zones.push({ id: 'z', floor: g, kind: 'lawn', name: 'Lawn', color: '#7fbf6a', points: [{ x: -6, y: -5 }, { x: 14, y: -5 }, { x: 14, y: 12 }, { x: -6, y: 12 }] });
    d.roofs.push({ id: 'rf', floor: g, kind: 'gable', x: 4, y: 3, w: 8, d: 6, rotation: 0, pitch: 35, overhang: 0.4, thickness: 0.15, material: 'tiles', color: '#b5523b', chimney: false, parapet: false });`);
}

test('3D: the house is lit by the whole sky, not just the sun', async ({ page }) => {
  test.setTimeout(90_000);
  await house(page);
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__ph3d?.stats().meshes ?? 0)).toBeGreaterThan(10);

  // colors are kept (neutral tone mapping), a sky image lights the scene, the shadow map is as sharp as the graphics card allows
  const s = await stats(page);
  expect(s.skyImage).toBe(true);
  expect(s.glassSky).toBeGreaterThan(0); // the window shows the sky
  expect(s.toneMapping).toBe(7); // THREE.NeutralToneMapping
  expect(s.shadowMap).toBeGreaterThanOrEqual(2048);
  expect(s.filled).toBeGreaterThan(0.05);
  await shot(page, 'noon');

  // the picture changes with the time of day, in the same session
  const at = async (hour: number) => {
    await page.evaluate((h) => (window as any).__ph.ui.getState().setTimeOfDay(h), hour);
    await page.getByTestId('view3d-shadows').check();
    await expect.poll(async () => (await stats(page)).dark).toBeDefined();
  };
  await at(18.5);
  await shot(page, 'evening');
  expect((await stats(page)).skyImage).toBe(true);
  await at(23.5);
  await shot(page, 'night');
  expect((await stats(page)).filled).toBeGreaterThan(0.02); // the house is still there at night
  await at(12);

  // rain: grey sky light, no sun spot, and the picture still draws
  await edit(page, `d.site.weather = 'rain';`);
  await page.waitForTimeout(300);
  await shot(page, 'rain');
  expect((await stats(page)).filled).toBeGreaterThan(0.05);
});
