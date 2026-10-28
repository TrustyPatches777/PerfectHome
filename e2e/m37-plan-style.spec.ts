import fs from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
import { clickAt, design, fresh, ui } from './helpers';

/* eslint-disable @typescript-eslint/no-explicit-any */

test.beforeEach(async ({ page }) => {
  await fresh(page);
});

const edit = (page: Page, body: string) => page.evaluate(`window.__ph.design.getState().update((d) => { ${body} })`);

/** A small house with a room, a door, a window, a sofa and a lawn. */
async function house(page: Page) {
  await edit(page, `
    const F = d.floors[0].id;
    const pts = [[0, 0], [8, 0], [8, 6], [0, 6]];
    pts.forEach((p, i) => { const q = pts[(i + 1) % 4]; d.walls.push({ id: 'w' + i, floor: F, a: { x: p[0], y: p[1] }, b: { x: q[0], y: q[1] }, thickness: 0.3, type: 'exterior', height: 2.5 }); });
    d.walls.push({ id: 'mid', floor: F, a: { x: 4, y: 0 }, b: { x: 4, y: 6 }, thickness: 0.15, type: 'interior', height: 2.5 });
    d.rooms.push({ id: 'r1', floor: F, name: 'Living room', color: '#f1e6d0', material: 'wood', living: true, points: [{ x: 0.15, y: 0.15 }, { x: 3.925, y: 0.15 }, { x: 3.925, y: 5.85 }, { x: 0.15, y: 5.85 }] });
    d.rooms.push({ id: 'r2', floor: F, name: 'Kitchen', color: '#dbe7f4', material: 'tile', living: true, points: [{ x: 4.075, y: 0.15 }, { x: 7.85, y: 0.15 }, { x: 7.85, y: 5.85 }, { x: 4.075, y: 5.85 }] });
    d.openings.push({ id: 'win', wallId: 'w2', kind: 'window', pos: 2, width: 1.4, swing: 1, hinge: 'a' });
    d.openings.push({ id: 'door', wallId: 'w0', kind: 'door', pos: 2, width: 0.9, swing: 1, hinge: 'a' });
    d.furniture.push({ id: 'sofa', floor: F, type: 'sofa', x: 2, y: 4.5, w: 2.2, d: 0.95, rotation: 0, color: '#8aa0b8', label: '' });
    d.zones.push({ id: 'z', floor: F, kind: 'lawn', name: 'Lawn', color: '#7fbf6a', points: [{ x: -4, y: -1 }, { x: -1, y: -1 }, { x: -1, y: 7 }, { x: -4, y: 7 }] });`);
  await page.evaluate(() => (window as any).__ph.ui.getState().setViewport({ x: 280, y: 160, zoom: 50 }));
}

test('the plan style panel switches the look of the plan, and it is part of the design', async ({ page }) => {
  await house(page);
  await page.getByTestId('style-panel').locator('summary').click();
  expect((await design(page)).style).toBeUndefined();
  await page.screenshot({ path: 'e2e/.results/m37-colour.png' });

  await page.getByTestId('style-architectural').click();
  expect((await design(page)).style).toEqual({ preset: 'architectural' });
  await expect(page.getByTestId('style-rooms')).toHaveValue('none');
  await expect(page.getByTestId('style-furniture')).toHaveValue('plain');
  await page.screenshot({ path: 'e2e/.results/m37-architectural.png' });

  await page.getByTestId('style-blueprint').click();
  expect((await design(page)).style).toEqual({ preset: 'blueprint' });
  await expect(page.getByTestId('style-walls')).toHaveValue('outline');
  await page.screenshot({ path: 'e2e/.results/m37-blueprint.png' });

  // single choices on top of a preset
  await page.getByTestId('style-walls').selectOption('hatch');
  await page.getByTestId('style-lines').selectOption('heavy');
  await page.getByTestId('style-labels').selectOption('name');
  await page.getByTestId('style-font').selectOption('serif');
  expect((await design(page)).style).toEqual({ preset: 'blueprint', walls: 'hatch', lines: 'heavy', labels: 'name', font: 'serif' });
  await page.screenshot({ path: 'e2e/.results/m37-blueprint-hatch.png' });
  // choosing what the preset does anyway leaves nothing behind
  await page.getByTestId('style-walls').selectOption('outline');
  expect((await design(page)).style.walls).toBeUndefined();
  await page.getByTestId('style-reset').click();
  expect((await design(page)).style).toEqual({ preset: 'blueprint' });

  // one undo step per change, and back to colour leaves no style in the design
  await page.getByTestId('style-colour').click();
  expect((await design(page)).style).toBeUndefined();
  await page.keyboard.press('Control+z');
  expect((await design(page)).style).toEqual({ preset: 'blueprint' });
});

test('walls can still be selected in the outline style, and the exports use the style', async ({ page }) => {
  await house(page);
  await edit(page, `d.style = { preset: 'blueprint' };`);
  await expect(page.getByTestId('style-panel')).toBeVisible();
  // a click on the middle wall (4, 3) selects it, although only its outline is drawn
  await clickAt(page, 4, 4);
  expect((await ui(page)).selection).toMatchObject({ kind: 'wall', id: 'mid' });

  await page.getByTestId('file-menu').click();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('menu-export-svg').click()]);
  const text = fs.readFileSync((await dl.path())!, 'utf8');
  expect(text).toContain('fill="#1b4b8f"/>'); // the blue sheet
  expect(text).toContain('LIVING ROOM'); // capital letters
  expect(text).not.toContain('url(#mat-'); // no floor materials
  fs.writeFileSync('e2e/.results/m37-blueprint.svg', text);

  // the print dialog shows the same style
  await page.getByTestId('file-menu').click();
  await page.getByTestId('menu-print').click();
  await expect(page.getByTestId('print-preview').locator('rect[fill="#1b4b8f"]').first()).toBeVisible();
});

test('a preset and a choice are stored together in the design', async ({ page }) => {
  await house(page);
  await page.getByTestId('style-panel').locator('summary').click();
  await page.getByTestId('style-architectural').click();
  await page.getByTestId('style-lines').selectOption('fine');
  const json = await page.evaluate(() => (window as any).__ph.design.getState().design.style);
  expect(json).toEqual({ preset: 'architectural', lines: 'fine' });
});
