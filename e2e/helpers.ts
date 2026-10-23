import { expect, type Page } from '@playwright/test';

/* eslint-disable @typescript-eslint/no-explicit-any */
export const design = (page: Page) => page.evaluate(() => (window as any).__ph.design.getState().design);
export const ui = (page: Page) => page.evaluate(() => (window as any).__ph.ui.getState());

/** Page coordinates for a world position (meters), using the live camera. */
export async function at(page: Page, wx: number, wy: number) {
  const v = await page.evaluate(() => (window as any).__ph.ui.getState().viewport);
  const box = (await page.locator('.canvas-wrap').boundingBox())!;
  return { x: box.x + v.x + wx * v.zoom, y: box.y + v.y + wy * v.zoom };
}

export async function clickAt(page: Page, wx: number, wy: number, opts: { button?: 'left' | 'right'; clickCount?: number } = {}) {
  const p = await at(page, wx, wy);
  await page.mouse.click(p.x, p.y, opts);
}

export async function moveTo(page: Page, wx: number, wy: number) {
  const p = await at(page, wx, wy);
  await page.mouse.move(p.x, p.y);
}

export async function dragWorld(page: Page, from: [number, number], to: [number, number]) {
  const a = await at(page, ...from);
  const b = await at(page, ...to);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 3 });
  await page.mouse.move(b.x, b.y, { steps: 4 });
  await page.mouse.up();
}

export async function fresh(page: Page) {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('__cleared')) {
      localStorage.clear();
      sessionStorage.setItem('__cleared', '1');
    }
  });
  await page.goto('/');
  await expect(page.locator('canvas').first()).toBeVisible();
}

/** Draw a closed rectangle of walls with the wall tool (world meters). */
export async function drawBox(page: Page, x0: number, y0: number, x1: number, y1: number) {
  await page.getByTestId('tool-wall').click();
  for (const [x, y] of [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
    [x0, y0],
  ]) {
    await clickAt(page, x, y);
  }
  await page.getByTestId('tool-select').click();
}

/** Click a furniture tile, opening collapsed palette categories first if needed. */
export async function pickFurniture(page: Page, type: string) {
  const tile = page.getByTestId(`furn-${type}`);
  if (!(await tile.count())) {
    const closed = page.locator('.cat-head[aria-expanded="false"]');
    for (let i = 0; i < 12 && (await closed.count()); i++) await closed.first().click(); // a live query: each click shrinks it
  }
  await tile.click();
}
