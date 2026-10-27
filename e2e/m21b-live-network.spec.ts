import { test, expect } from '@playwright/test';
import { design, fresh } from './helpers';

/* eslint-disable @typescript-eslint/no-explicit-any */
// The real thing: two separate browser profiles (no shared storage, no shared tabs) find each other through the public
// relays and connect with WebRTC. Needs internet access; it can fail when the free relays are down.

test('two separate browsers edit the same design over a real peer-to-peer connection', async ({ page, browser }) => {
  test.setTimeout(120_000);
  await fresh(page);
  const floor = await page.evaluate(() => (window as any).__ph.design.getState().design.floors[0].id);
  await page.evaluate((floor) => {
    (window as any).__ph.design.getState().update((d: any) => {
      d.walls.push({ id: 'w1', floor, a: { x: 0, y: 0 }, b: { x: 5, y: 0 }, thickness: 0.15, type: 'interior', height: 2.5 });
      d.furniture.push({ id: 'sofa1', floor, type: 'sofa', x: 2, y: 2, w: 2, d: 0.9, rotation: 0, color: '#b7c9a8', label: '' });
    });
  }, floor);
  await page.getByTestId('live').click();
  await page.getByTestId('live-start').click();
  const url = await page.getByTestId('live-url').inputValue();
  // while nobody has come yet the dialog says whether this browser can reach the services that introduce people to each other
  await expect(page.getByTestId('live-network')).toContainText(/Connection services reachable: [1-9]/, { timeout: 20_000 });
  await page.getByTestId('live-dialog').getByRole('button', { name: 'Done' }).click();

  // a different browser profile: nothing in common with the first
  const other = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const b = await other.newPage();
  await b.goto(url);
  await expect(b.locator('canvas').first()).toBeVisible();

  await expect.poll(async () => (await design(b)).furniture.length, { timeout: 60_000, intervals: [500] }).toBe(1);
  expect((await design(b)).walls).toHaveLength(1);
  await expect(b.getByTestId('live')).toContainText('2', { timeout: 20_000 });
  await expect(page.getByTestId('live')).toContainText('2', { timeout: 20_000 });

  await b.evaluate(() => (window as any).__ph.design.getState().update((d: any) => void (d.furniture[0].color = '#ff0000')));
  await page.evaluate(() => (window as any).__ph.design.getState().update((d: any) => void (d.furniture[0].x = 3.5)));
  for (const p of [page, b]) await expect.poll(async () => (await design(p)).furniture[0], { timeout: 15_000 }).toMatchObject({ x: 3.5, color: '#ff0000' });
  await other.close();
});
