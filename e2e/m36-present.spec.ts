import fs from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
import { clickAt, design, fresh } from './helpers';

/* eslint-disable @typescript-eslint/no-explicit-any */

test.beforeEach(async ({ page }) => {
  await fresh(page);
});

const edit = (page: Page, body: string) => page.evaluate(`window.__ph.design.getState().update((d) => { ${body} })`);

/** A two-storey house, 8 x 6 m, with a roof, a window, a door and a sofa. */
async function house(page: Page) {
  await edit(page, `
    const g = d.floors[0].id;
    d.floors.push({ id: 'up', name: 'First floor' });
    const box = (floor, pre, name) => {
      const pts = [[0, 0], [8, 0], [8, 6], [0, 6]];
      pts.forEach((p, i) => { const q = pts[(i + 1) % 4]; d.walls.push({ id: pre + i, floor, a: { x: p[0], y: p[1] }, b: { x: q[0], y: q[1] }, thickness: 0.3, type: 'exterior', height: 2.5 }); });
      d.rooms.push({ id: pre + 'r', floor, name, color: '#f1e6d0', material: 'wood', living: true, points: [{ x: 0.15, y: 0.15 }, { x: 7.85, y: 0.15 }, { x: 7.85, y: 5.85 }, { x: 0.15, y: 5.85 }] });
    };
    box(g, 'a', 'Living'); box('up', 'b', 'Bedroom');
    d.openings.push({ id: 'win', wallId: 'a2', kind: 'window', pos: 3, width: 1.4, swing: 1, hinge: 'a' });
    d.openings.push({ id: 'door', wallId: 'a0', kind: 'door', pos: 4, width: 0.9, swing: 1, hinge: 'a' });
    d.furniture.push({ id: 'sofa', floor: g, type: 'sofa', x: 3, y: 3, w: 2.2, d: 0.95, rotation: 0, color: '#8aa0b8', label: '' });
    d.roofs.push({ id: 'rf', floor: 'up', kind: 'gable', x: 4, y: 3, w: 8, d: 6, rotation: 0, pitch: 35, overhang: 0.4, thickness: 0.15, material: 'tiles', color: '#b5523b', chimney: false, parapet: false });`);
}

const topOfWorld = (page: Page) =>
  page.evaluate(() => {
    let top = -Infinity;
    (window as any).__ph3d.scene.world.traverse((o: any) => {
      if (!o.isMesh) return;
      o.geometry.computeBoundingBox();
      top = Math.max(top, o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld).max.y);
    });
    return top as number;
  });

test('3D: a dollhouse of a floor, floors pulled apart, and camera positions you can come back to', async ({ page }) => {
  await house(page);
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__ph3d?.stats().meshes ?? 0)).toBeGreaterThan(20);
  const whole = await topOfWorld(page);
  expect(whole).toBeGreaterThan(7); // two storeys and a roof

  // the dollhouse of the ground floor: no roof, no floor above, walls cut low
  await page.getByTestId('present-button').click();
  await page.getByTestId('dollhouse-Ground floor').click();
  await expect.poll(() => topOfWorld(page)).toBeLessThan(1.5);
  expect(await page.evaluate(() => (window as any).__ph.ui.getState().dollhouse)).toBe((await design(page)).floors[0].id);
  await page.evaluate(() => (window as any).__ph3d.scene.renderNow());
  await page.screenshot({ path: 'e2e/.results/m36-dollhouse.png' });
  // the first floor as a dollhouse still has the ground floor under it, whole
  await page.getByTestId('dollhouse-First floor').click();
  await expect.poll(() => topOfWorld(page)).toBeGreaterThan(3.5);
  await expect.poll(() => topOfWorld(page)).toBeLessThan(4.5);
  await page.getByTestId('dollhouse-off').click();
  await expect.poll(() => topOfWorld(page)).toBeCloseTo(whole, 1);

  // exploded: the floors and the roof lift, the ground floor stays
  const slider = page.getByTestId('explode-slider');
  await slider.fill('3');
  await expect(page.getByTestId('explode-value')).toContainText('3 m apart');
  await expect.poll(() => topOfWorld(page)).toBeCloseTo(whole + 3, 1);
  await page.evaluate(() => (window as any).__ph3d.scene.renderNow());
  await page.screenshot({ path: 'e2e/.results/m36-exploded.png' });
  await slider.fill('0');
  await expect.poll(() => topOfWorld(page)).toBeCloseTo(whole, 1);

  // saved views: save, turn the camera, go back, rename, delete
  await page.evaluate(() => (window as any).__ph3d.scene.setView([20, 6, 18], [4, 1, 3]));
  await page.getByTestId('view-save-camera').click();
  expect((await design(page)).views).toHaveLength(1);
  const saved = (await design(page)).views[0];
  expect(saved.pos).toEqual([20, 6, 18]);
  await page.evaluate(() => (window as any).__ph3d.scene.setView([-10, 4, -12], [4, 1, 3]));
  await page.getByTestId('view-go-View 1').click();
  const now = await page.evaluate(() => (window as any).__ph3d.scene.getView());
  expect(now.pos[0]).toBeCloseTo(20, 3);
  expect(now.pos[2]).toBeCloseTo(18, 3);
  const name = page.getByTestId('view-name').first();
  await name.fill('From the street');
  await name.press('Enter');
  await expect.poll(async () => (await design(page)).views[0].name).toBe('From the street');
  await page.getByTestId('view-delete-From the street').click();
  expect((await design(page)).views).toHaveLength(0);
});

test('3D: one picture with a dollhouse of every floor', async ({ page }) => {
  await house(page);
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__ph3d?.stats().meshes ?? 0)).toBeGreaterThan(20);
  await page.getByTestId('present-button').click();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('floor-sheet').click()]);
  expect(dl.suggestedFilename()).toBe('my-home-floors.png');
  const png = fs.readFileSync((await dl.path())!);
  expect(png.subarray(1, 4).toString()).toBe('PNG');
  expect(png.length).toBeGreaterThan(5000);
  fs.writeFileSync('e2e/.results/m36-floors-sheet.png', png);
  // the scene is back as it was: the whole house again
  await expect.poll(() => topOfWorld(page)).toBeGreaterThan(7);
});

test('elevations and sections: draw a section line, see the drawing, flip it, save it', async ({ page }) => {
  await house(page);
  await page.evaluate(() => (window as any).__ph.ui.getState().setViewport({ x: 200, y: 160, zoom: 50 }));
  // from the File menu: the south elevation
  await page.getByTestId('file-menu').click();
  await page.getByTestId('menu-drawing').click();
  await expect(page.getByTestId('drawing-dialog')).toBeVisible();
  await expect(page.getByTestId('drawing-info')).toContainText('It fits');
  const polygons = () => page.getByTestId('drawing-preview').locator('polygon').count();
  await expect.poll(polygons).toBeGreaterThan(20);
  await page.getByTestId('drawing-view').selectOption('W');
  await expect(page.getByTestId('drawing-preview').locator('text', { hasText: 'West elevation' })).toBeVisible();
  await page.getByTestId('drawing-view').selectOption('S');
  await page.getByTestId('drawing-scale').selectOption('50');
  await expect(page.getByTestId('drawing-info')).toContainText('1:50');
  await page.getByTestId('drawing-scale').selectOption('fit');

  // the section tool: the dialog opens by itself after the second click
  await page.getByTestId('section-new').click();
  await expect(page.getByTestId('drawing-dialog')).toHaveCount(0);
  await expect(page.getByTestId('tool-section')).toHaveClass(/active/);
  await clickAt(page, 4.5, -1);
  await clickAt(page, 4.5, 7);
  await expect(page.getByTestId('drawing-dialog')).toBeVisible();
  const d = await design(page);
  expect(d.sections).toHaveLength(1);
  expect(d.sections[0].name).toBe('A');
  expect(d.sections[0].a.x).toBeCloseTo(4.5, 1);
  await expect(page.getByTestId('drawing-view')).toHaveValue(d.sections[0].id);
  await expect(page.getByTestId('drawing-preview').locator('text', { hasText: 'Section A–A' })).toBeVisible();
  await expect.poll(() => page.getByTestId('drawing-preview').locator('polygon[fill="url(#cut)"]').count()).toBeGreaterThan(4); // the cut walls and slabs
  const before = await page.getByTestId('drawing-preview').innerHTML();

  // the other way round shows the other half of the house
  await page.getByTestId('section-flip').click();
  expect((await design(page)).sections[0].flip).toBe(true);
  await expect.poll(async () => (await page.getByTestId('drawing-preview').innerHTML()) !== before).toBe(true);
  await page.getByTestId('section-name').fill('b');
  await expect(page.getByTestId('drawing-preview').locator('text', { hasText: 'Section B–B' })).toBeVisible();
  await page.getByTestId('drawing-colour').click();
  await page.screenshot({ path: 'e2e/.results/m36-section-dialog.png' });

  // save it as a vector file
  const [svg] = await Promise.all([page.waitForEvent('download'), page.getByTestId('drawing-svg').click()]);
  expect(svg.suggestedFilename()).toBe('my-home-section-b-b.svg');
  const text = fs.readFileSync((await svg.path())!, 'utf8');
  expect(text.startsWith('<?xml')).toBe(true);
  expect(text).toContain('Section B–B');
  fs.writeFileSync('e2e/.results/m36-section.svg', text);
  const [png] = await Promise.all([page.waitForEvent('download'), page.getByTestId('drawing-png').click()]);
  expect(fs.readFileSync((await png.path())!).subarray(1, 4).toString()).toBe('PNG');

  // the line stays on the plan; clicking it opens the drawing again
  await page.getByTestId('drawing-dialog').getByRole('button', { name: 'Close' }).click();
  await expect(page.getByTestId('drawing-dialog')).toHaveCount(0);
  await clickAt(page, 4.5, 3);
  await expect(page.getByTestId('drawing-dialog')).toBeVisible();
  await page.getByTestId('section-delete').click();
  expect((await design(page)).sections).toHaveLength(0);
  await expect(page.getByTestId('drawing-view')).toHaveValue('S');
});

test('section lines show in the SVG plan, and views and sections are kept', async ({ page }) => {
  await house(page);
  await edit(page, `d.sections.push({ id: 's1', name: 'A', a: { x: 4.5, y: -1 }, b: { x: 4.5, y: 7 } }); d.views.push({ id: 'v1', name: 'Front', pos: [20, 6, 18], target: [4, 1, 3] });`);
  await page.getByTestId('file-menu').click();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('menu-export-svg').click()]);
  const text = fs.readFileSync((await dl.path())!, 'utf8');
  expect(text).toContain('stroke-dasharray="0.3 0.08 0.06 0.08"'); // the section line
});
