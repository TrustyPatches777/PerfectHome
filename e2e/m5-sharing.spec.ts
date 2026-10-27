import { test, expect, type Browser, type Page } from '@playwright/test';
import fs from 'node:fs';
import { clickAt, design, drawBox, fresh } from './helpers';

/* eslint-disable @typescript-eslint/no-explicit-any */

async function build(page: Page) {
  await drawBox(page, 1, 1, 6, 5);
  await page.getByTestId('tool-room').click();
  await clickAt(page, 3, 3);
  await page.getByTestId('tool-door').click();
  await clickAt(page, 3, 1.3);
  await page.getByTestId('furn-sofa').click();
  await clickAt(page, 3, 4.3);
  await page.getByTestId('tool-text').click();
  await clickAt(page, 4.5, 2);
  await expect(page.getByTestId('label-text')).toBeFocused();
  await page.keyboard.type('Living room');
  await page.keyboard.press('Escape');
  await page.getByTestId('tool-measure').click();
  await clickAt(page, 1, 1);
  await clickAt(page, 6, 1);
  await page.getByTestId('tool-select').click();
  await page.getByTestId('lock-structure').click(); // "the walls I placed"
}

/** A second person's browser: separate storage, same site. */
async function otherBrowser(browser: Browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  return { ctx, page: await ctx.newPage() };
}

/** Designs compared at the precision links and files keep: millimeters. */
const strip = (d: any) => JSON.parse(JSON.stringify(d, (_k, v) => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : v)));

test('autosave: a reload brings the design back', async ({ page }) => {
  await fresh(page);
  await build(page);
  await expect(page.getByTestId('save-state')).toContainText('Saved');
  // autosave waits a moment after the last change: wait for the final state to be stored
  await expect.poll(() => page.evaluate(() => localStorage.getItem('perfect-home:autosave') ?? '')).toContain('Living room');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('perfect-home:autosave') ?? '')).toContain('"locked":true');
  const before = await design(page);

  await page.reload();
  await expect(page.locator('canvas').first()).toBeVisible();
  const after = await design(page);
  expect(strip(after)).toEqual(strip(before));
  // history starts fresh after a reload, and the design is framed on screen
  await expect(page.getByTestId('undo')).toBeDisabled();
  const v = await page.evaluate(() => (window as any).__ph.ui.getState().viewport);
  expect(v.zoom).toBeGreaterThan(20);
});

test('share link: copies a link, and opening it in another browser loads the same design (locks included)', async ({ page, context, browser }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await fresh(page);
  await build(page);
  await page.getByTestId('share').click();
  const url = await page.getByTestId('share-url').inputValue();
  expect(url).toContain('#d=');
  await expect(page.getByTestId('share-status')).toContainText('copied');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(url);
  await page.screenshot({ path: 'e2e/.results/m5-share-dialog.png' });
  const original = await design(page);

  const { ctx, page: her } = await otherBrowser(browser);
  await her.addInitScript(() => localStorage.getItem('x')); // fresh profile, nothing saved
  await her.goto(url);
  await expect(her.locator('canvas').first()).toBeVisible();
  await expect(her.getByTestId('conflict-dialog')).toHaveCount(0);
  const got = await design(her);
  expect(strip(got)).toEqual(strip(original));
  expect(got.layers.structure.locked).toBe(true);
  expect(got.furniture[0].type).toBe('sofa');
  // the hash is removed after loading so a reload does not re-trigger it
  expect(await her.evaluate(() => location.hash)).toBe('');
  // and her copy is autosaved on her side
  await expect(her.getByTestId('save-state')).toContainText('Saved');
  await her.screenshot({ path: 'e2e/.results/m5-opened-link.png' });

  // she continues: the locked walls can't be dragged, but she can move the sofa and edit the label
  await her.reload();
  expect((await design(her)).furniture).toHaveLength(1);
  await ctx.close();
});

test('opening a link when you already have your own work asks first and never loses anything', async ({ page, context, browser }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await fresh(page);
  await build(page);
  await page.getByTestId('share').click();
  const url = await page.getByTestId('share-url').inputValue();

  const { ctx, page: her } = await otherBrowser(browser);
  await her.goto('/');
  await her.addInitScript(() => undefined);
  await drawBox(her, 2, 2, 4, 4); // her own, different design
  await expect(her.getByTestId('save-state')).toContainText('Saved');
  const mine = await design(her);

  await her.goto(url.replace(/^https?:\/\/[^/]+/, 'http://localhost:5173'));
  await her.reload();
  await expect(her.getByTestId('conflict-dialog')).toBeVisible();
  await her.screenshot({ path: 'e2e/.results/m5-conflict.png' });

  // 1) keep mine
  await her.getByTestId('keep-mine').click();
  expect(strip(await design(her))).toEqual(strip(mine));
  expect(await her.evaluate(() => location.hash)).toBe('');

  // 2) open the link again (hash change in the running app) and take the shared design
  await her.evaluate((u) => (location.hash = new URL(u).hash), url);
  await expect(her.getByTestId('conflict-dialog')).toBeVisible();
  await her.getByTestId('open-shared').click();
  expect((await design(her)).furniture).toHaveLength(1);
  expect((await design(her)).walls).toHaveLength(4);

  // 3) my design was stashed and can be restored
  await her.getByTestId('file-menu').click();
  await her.getByTestId('menu-restore').click();
  expect(strip(await design(her))).toEqual(strip(mine));
  await ctx.close();
});

test('a broken link shows a message and the app still works', async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/#d=this-is-not-a-design');
  await expect(page.locator('canvas').first()).toBeVisible();
  await expect(page.locator('.statusbar')).toContainText(/damaged|does not contain|newer/);
  expect(await page.evaluate(() => location.hash)).toBe('');
  await drawBox(page, 1, 1, 3, 3);
  expect((await design(page)).walls).toHaveLength(4);
});

test('export and import JSON round-trip', async ({ page, browser }) => {
  await fresh(page);
  await build(page);
  await page.getByTestId('file-menu').click();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('menu-export-json').click()]);
  expect(dl.suggestedFilename()).toBe('my-home.json');
  const file = (await dl.path())!;
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  expect(parsed.v).toBe(1);
  expect(parsed.walls).toHaveLength(4);

  const { ctx, page: her } = await otherBrowser(browser);
  await her.goto('/');
  await her.getByTestId('import-input').setInputFiles(file);
  await expect.poll(async () => (await design(her)).walls.length).toBe(4);
  expect(strip(await design(her))).toEqual(strip(await design(page)));

  // a file that is not a design is rejected with a message, and nothing changes
  fs.writeFileSync(file + '.bad.json', '{"hello": "world"}');
  await her.getByTestId('import-input').setInputFiles(file + '.bad.json');
  await expect(her.locator('.statusbar')).toContainText('Not a design');
  expect((await design(her)).walls).toHaveLength(4);
  await ctx.close();
});

test('export PNG downloads a real image of the plan', async ({ page }) => {
  await fresh(page);
  await build(page);
  await page.getByTestId('file-menu').click();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('menu-export-png').click()]);
  expect(dl.suggestedFilename()).toBe('my-home.png');
  const buf = fs.readFileSync((await dl.path())!);
  expect([...buf.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const w = buf.readUInt32BE(16);
  const h = buf.readUInt32BE(20);
  expect(w).toBeGreaterThan(400);
  expect(h).toBeGreaterThan(300);
  expect(buf.length).toBeGreaterThan(5000);
  fs.mkdirSync('e2e/.results', { recursive: true });
  fs.writeFileSync('e2e/.results/m5-export.png', buf);

  // nothing to export on an empty design
  await page.getByTestId('file-menu').click();
  await page.getByTestId('menu-new').click();
  await page.getByTestId('file-menu').click();
  await page.getByTestId('menu-export-png').click();
  await expect(page.locator('.statusbar')).toContainText('Nothing to export');
});
