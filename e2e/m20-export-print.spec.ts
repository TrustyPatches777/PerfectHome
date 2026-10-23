import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import { clickAt, drawBox, fresh, pickFurniture } from './helpers';

/* eslint-disable @typescript-eslint/no-explicit-any */

test.beforeEach(async ({ page }) => {
  await fresh(page);
});

async function house(page: Page) {
  await drawBox(page, 1, 1, 9, 6);
  await page.getByTestId('tool-room').click();
  await clickAt(page, 5, 3.5);
  await page.getByTestId('tool-door').click();
  await clickAt(page, 3, 1.3);
  await page.getByTestId('tool-window').click();
  await clickAt(page, 6.5, 1.3);
  await page.getByTestId('tool-select').click();
  await pickFurniture(page, 'sofa');
  await clickAt(page, 5, 5);
  await page.keyboard.press('Escape');
}

test('Export SVG downloads a valid vector drawing of the floor', async ({ page }) => {
  await house(page);
  await page.getByTestId('file-menu').click();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('menu-export-svg').click()]);
  expect(dl.suggestedFilename()).toBe('my-home.svg');
  const text = fs.readFileSync((await dl.path())!, 'utf8');
  expect(text.startsWith('<?xml version="1.0"')).toBe(true);
  const result = await page.evaluate((t) => {
    const doc = new DOMParser().parseFromString(t, 'image/svg+xml');
    const root = doc.documentElement;
    return { error: !!doc.querySelector('parsererror'), tag: root.tagName, viewBox: root.getAttribute('viewBox'), polygons: doc.querySelectorAll('polygon').length, texts: [...doc.querySelectorAll('text')].map((x) => x.textContent) };
  }, text);
  expect(result.error).toBe(false);
  expect(result.tag).toBe('svg');
  expect(result.viewBox).toMatch(/^[-\d. ]+$/);
  expect(result.polygons).toBeGreaterThan(5);
  expect(result.texts).toEqual(expect.arrayContaining(['My home', 'Room 1', 'Sofa', 'N']));
  fs.mkdirSync('e2e/.results', { recursive: true });
  fs.writeFileSync('e2e/.results/m20-export.svg', text);

  // an empty floor gives a message instead of an empty file
  await page.getByTestId('file-menu').click();
  await page.getByTestId('menu-new').click();
  await page.getByTestId('file-menu').click();
  await page.getByTestId('menu-export-svg').click();
  await expect(page.locator('.statusbar')).toContainText('Nothing to export');
});

test('print dialog: paper, scale, true-size pages in a hidden frame', async ({ page }) => {
  await house(page);
  await page.getByTestId('file-menu').click();
  await page.getByTestId('menu-print').click();
  const dialog = page.getByTestId('print-dialog');
  await expect(dialog).toBeVisible();
  // fit: the 8 m x 5 m plan (+ 1.2 m margin = 9.2 x 6.2) on A4 landscape (277 x 166 mm) needs about 1:37 -> 1:50
  await expect(page.getByTestId('print-scale')).toHaveValue('fit');
  await expect(page.getByTestId('print-info')).toContainText(/At 1:50 the plan is 184 × 1\d\d mm/);
  await expect(page.getByTestId('print-info')).toContainText('It fits');
  await page.screenshot({ path: 'e2e/.results/m20-print.png' });

  // a scale that is too big is called out
  await page.getByTestId('print-scale').selectOption('20');
  await expect(page.getByTestId('print-info')).toContainText('too big');
  await page.getByTestId('print-scale').selectOption('100');
  await expect(page.getByTestId('print-info')).toContainText(/At 1:100 the plan is 92 × \d\d mm/);
  await page.getByTestId('print-paper').selectOption('A3');
  await page.getByTestId('print-portrait').click();
  await page.getByTestId('print-dims').check();

  await page.getByTestId('print-go').click();
  await expect(dialog).toHaveCount(0);
  const html = await page.evaluate(() => (document.querySelector('iframe.print-frame') as HTMLIFrameElement | null)?.srcdoc ?? '');
  expect(html).toContain('size: 297mm 420mm'); // A3 portrait
  expect(html).toMatch(/class="frame" style="width:92mm;height:\d+(\.\d+)?mm"/);
  expect(html).toContain('Scale 1:100');
  expect(html).toContain('A3 portrait');
  expect(html).toContain('>8</text>'); // the wall length from "include dimensions"
  expect(html).toContain('Room 1');
});

test('print: all floors makes one page per floor, and an empty floor cannot be printed', async ({ page }) => {
  await house(page);
  await page.getByTestId('add-floor').click();
  await drawBox(page, 2, 2, 6, 5);
  await page.getByTestId('file-menu').click();
  await page.getByTestId('menu-print').click();
  await page.getByTestId('print-all-floors').click();
  await expect(page.getByTestId('print-info')).toContainText('2 pages');
  await page.getByTestId('print-go').click();
  const pages = await page.evaluate(() => ((document.querySelector('iframe.print-frame') as HTMLIFrameElement).srcdoc.match(/<section class="page">/g) ?? []).length);
  expect(pages).toBe(2);

  // a floor with nothing on it
  await page.getByTestId('add-floor').click();
  await page.getByTestId('file-menu').click();
  await page.getByTestId('menu-print').click();
  await page.getByTestId('print-this-floor').click(); // the dialog remembers "All floors", which would still print the others
  await expect(page.getByTestId('print-dialog')).toContainText('nothing on this floor to print');
  await expect(page.getByTestId('print-go')).toBeDisabled();
});
