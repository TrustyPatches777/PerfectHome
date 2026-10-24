import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { at, design, dragWorld, fresh } from './helpers';

/* eslint-disable @typescript-eslint/no-explicit-any */
// Two windows of the same browser talk through a BroadcastChannel; the internet part is switched off for these tests
// (m21b checks the real peer-to-peer connection).

const F = (page: Page) => page.evaluate(() => (window as any).__ph.design.getState().design.floors[0].id as string);

async function startSession(page: Page) {
  await page.evaluate(() => localStorage.setItem('perfect-home:p2p', 'off'));
  await page.getByTestId('live').click();
  await page.getByTestId('live-start').click();
  const url = await page.getByTestId('live-url').inputValue();
  await page.getByTestId('live-dialog').getByRole('button', { name: 'Done' }).click();
  return url;
}

async function openSecond(context: BrowserContext, url: string) {
  const b = await context.newPage();
  await b.addInitScript(() => localStorage.setItem('perfect-home:p2p', 'off'));
  await b.goto(url);
  await expect(b.locator('canvas').first()).toBeVisible();
  return b;
}

async function seed(page: Page) {
  const floor = await F(page);
  await page.evaluate((floor) => {
    (window as any).__ph.design.getState().update((d: any) => {
      for (const [id, ax, ay, bx, by] of [['w1', 0, 0, 6, 0], ['w2', 6, 0, 6, 4], ['w3', 6, 4, 0, 4], ['w4', 0, 4, 0, 0]])
        d.walls.push({ id, floor, a: { x: ax, y: ay }, b: { x: bx, y: by }, thickness: 0.15, type: 'interior', height: 2.5 });
      d.furniture.push({ id: 'sofa1', floor, type: 'sofa', x: 3, y: 2, w: 2, d: 0.9, rotation: 0, color: '#b7c9a8', label: '' });
    });
  }, floor);
}

test('a second window joins and then both see each other\'s changes, field by field', async ({ page, context }) => {
  await fresh(page);
  await seed(page);
  const url = await startSession(page);
  expect(url).toMatch(/#live=[a-z0-9]+\.[a-z0-9]+$/);

  const b = await openSecond(context, url);
  await expect(b.getByTestId('live')).toContainText('Live');
  await expect.poll(async () => (await design(b)).walls.length).toBe(4);
  expect((await design(b)).furniture[0]).toMatchObject({ id: 'sofa1', x: 3 });
  await expect(page.getByTestId('live')).toContainText('2'); // two people are here

  // A moves the sofa, B recolors it: both survive on both sides
  await page.evaluate(() => (window as any).__ph.design.getState().update((d: any) => void (d.furniture[0].x = 4.5)));
  await b.evaluate(() => (window as any).__ph.design.getState().update((d: any) => void (d.furniture[0].color = '#ff0000')));
  for (const p of [page, b]) {
    await expect.poll(async () => (await design(p)).furniture[0]).toMatchObject({ x: 4.5, color: '#ff0000' });
  }

  // adding and deleting travel too
  await b.evaluate(() => (window as any).__ph.design.getState().update((d: any) => void (d.walls = d.walls.filter((w: any) => w.id !== 'w4'))));
  await expect.poll(async () => (await design(page)).walls.map((w: any) => w.id)).toEqual(['w1', 'w2', 'w3']);

  // the name of the design and the layer switches are shared as well
  await page.getByLabel('Design name').fill('Our home');
  await expect.poll(async () => (await design(b)).name).toBe('Our home');
  await page.screenshot({ path: 'e2e/.results/m21-live-a.png' });
  await b.screenshot({ path: 'e2e/.results/m21-live-b.png' });
});

test('undo only takes back your own changes, and a mouse drag is one step', async ({ page, context }) => {
  await fresh(page);
  await seed(page);
  const url = await startSession(page);
  const b = await openSecond(context, url);
  await expect.poll(async () => (await design(b)).walls.length).toBe(4);

  // A drags the sofa with the mouse (many small writes), then B adds a wall
  await page.getByTestId('tool-select').click();
  await dragWorld(page, [3, 2], [5, 2.5]);
  await expect.poll(async () => (await design(b)).furniture[0].x).toBeCloseTo(5, 0);
  const moved = (await design(page)).furniture[0].x;
  expect(moved).not.toBe(3);
  await b.evaluate(() => {
    const d = (window as any).__ph.design.getState();
    d.update((x: any) => void x.walls.push({ id: 'bw', floor: x.floors[0].id, a: { x: 0, y: 6 }, b: { x: 4, y: 6 }, thickness: 0.15, type: 'interior', height: 2.5 }));
  });
  await expect.poll(async () => (await design(page)).walls.length).toBe(5);

  // B has something to undo; A's undo removes A's drag in one step and leaves B's wall alone
  await expect(page.getByTestId('undo')).toBeEnabled();
  await page.getByTestId('undo').click();
  await expect.poll(async () => (await design(page)).furniture[0].x).toBe(3);
  await expect.poll(async () => (await design(b)).furniture[0].x).toBe(3);
  expect((await design(page)).walls.map((w: any) => w.id)).toContain('bw');
  // the seed (the design as it was when the session began) is not an undo step: A has nothing more to undo
  await expect(page.getByTestId('undo')).toBeDisabled();
  await expect(page.getByTestId('redo')).toBeEnabled();
  await page.getByTestId('redo').click();
  await expect.poll(async () => (await design(b)).furniture[0].x).toBe(moved);

  // B undoes B's wall; A's sofa stays where it is
  await b.getByTestId('undo').click();
  await expect.poll(async () => (await design(page)).walls.map((w: any) => w.id)).not.toContain('bw');
  expect((await design(page)).furniture[0].x).toBe(moved);
});

test('you see the other person\'s name and pointer, and deleting what somebody selected does not break anything', async ({ page, context }) => {
  await fresh(page);
  await seed(page);
  await page.getByTestId('user-chip').click();
  await page.getByTestId('identity-name').fill('Paul');
  await page.getByTestId('identity-save').click();
  const url = await startSession(page);
  const b = await openSecond(context, url);
  await expect.poll(async () => (await design(b)).walls.length).toBe(4);

  const p = await at(page, 2, 2);
  await page.mouse.move(p.x, p.y);
  await page.mouse.move(p.x + 10, p.y + 6);
  await expect(b.getByTestId('remote-cursor')).toHaveCount(1);
  await expect(b.getByTestId('remote-cursor')).toContainText('Paul');
  await expect(b.getByTestId('live')).toContainText('2');

  // B selects the sofa; A deletes it
  await b.evaluate(() => (window as any).__ph.ui.getState().select({ kind: 'furniture', id: 'sofa1' }));
  await page.evaluate(() => (window as any).__ph.design.getState().update((d: any) => void (d.furniture = [])));
  await expect.poll(async () => (await design(b)).furniture.length).toBe(0);
  expect(await b.evaluate(() => (window as any).__ph.ui.getState().selected.length)).toBe(0);
});

test('leaving stops sharing, and a design cannot be replaced while live', async ({ page, context }) => {
  await fresh(page);
  await seed(page);
  const url = await startSession(page);
  const b = await openSecond(context, url);
  await expect.poll(async () => (await design(b)).walls.length).toBe(4);

  // "New design" would replace it for everybody: refused
  await page.getByTestId('file-menu').click();
  await page.getByTestId('menu-new').click();
  await expect(page.locator('.hint')).toContainText('live session');
  expect((await design(page)).walls).toHaveLength(4);

  await page.getByTestId('live').click();
  await page.getByTestId('live-leave').click();
  await expect(page.getByTestId('live')).toHaveText('Live');
  expect(page.url()).not.toContain('#live');
  // still has the design; further edits stay private
  expect((await design(page)).walls).toHaveLength(4);
  await page.evaluate(() => (window as any).__ph.design.getState().update((d: any) => void (d.furniture[0].x = 1)));
  await page.waitForTimeout(300);
  expect((await design(b)).furniture[0].x).toBe(3);
  // undo works the normal way again
  await expect(page.getByTestId('undo')).toBeEnabled();
});

test('a reload rejoins the session with the saved copy', async ({ page, context }) => {
  await fresh(page);
  await seed(page);
  await startSession(page);
  await expect(page.getByTestId('live')).toContainText('●');
  await page.evaluate(() => (window as any).__ph.design.getState().update((d: any) => void (d.furniture[0].x = 2)));
  await page.waitForTimeout(500); // let the browser store the change
  await page.reload();
  await expect(page.getByTestId('live')).toContainText('●');
  await expect.poll(async () => (await design(page)).furniture[0]?.x).toBe(2);
  void context;
});
