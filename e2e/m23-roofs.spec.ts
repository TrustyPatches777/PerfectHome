import { test, expect, type Page } from '@playwright/test';
import { design, dragWorld, drawBox, fresh, ui } from './helpers';

/* eslint-disable @typescript-eslint/no-explicit-any */

test.beforeEach(async ({ page }) => {
  await fresh(page);
});

const roofs = async (page: Page) => (await design(page)).roofs as any[];

test('"Fit to walls" makes a roof that covers the house; type, slope and covering can be changed', async ({ page }) => {
  // no walls yet: it says what is missing
  await page.getByTestId('tool-roof').click();
  await page.getByTestId('roof-fit-walls').click();
  expect(await roofs(page)).toHaveLength(0);
  await expect(page.locator('.hint')).toContainText('Draw some walls');

  await drawBox(page, 2, 2, 10, 7);
  await page.getByTestId('tool-roof').click();
  await page.getByTestId('roof-tool-kind').selectOption('hip');
  await page.getByTestId('roof-fit-walls').click();
  const [r] = await roofs(page);
  expect(r.kind).toBe('hip');
  expect(r.w).toBeCloseTo(8.15, 1); // 8 m between the wall centers + one wall thickness
  expect(r.d).toBeCloseTo(5.15, 1);
  expect(r.rotation).toBe(0);
  expect(r.x).toBeCloseTo(6, 1);
  expect(r.y).toBeCloseTo(4.5, 1);
  expect((await ui(page)).selection).toMatchObject({ kind: 'roof', id: r.id });
  expect((await ui(page)).tool).toBe('select');
  await page.screenshot({ path: 'e2e/.results/m23-plan.png' });

  // the properties follow the roof
  await expect(page.getByTestId('roof-kind')).toHaveValue('hip');
  await page.getByTestId('roof-kind').selectOption('gable');
  expect((await roofs(page))[0]).toMatchObject({ kind: 'gable', pitch: 35 });
  await page.getByTestId('roof-kind').selectOption('flat');
  expect((await roofs(page))[0]).toMatchObject({ kind: 'flat', material: 'gravel' }); // a flat roof gets its usual gravel
  await expect(page.getByTestId('roof-parapet')).toBeVisible();
  await expect(page.getByTestId('roof-pitch')).toHaveCount(0);
  await page.getByTestId('roof-parapet').check();
  expect((await roofs(page))[0].parapet).toBe(true);
  await page.getByTestId('roof-kind').selectOption('mansard');
  expect((await roofs(page))[0]).toMatchObject({ kind: 'mansard', parapet: false, material: 'slate' });

  await page.getByTestId('roof-pitch').fill('28');
  await page.getByTestId('roof-pitch').press('Enter');
  await page.getByTestId('roof-overhang').fill('60');
  await page.getByTestId('roof-overhang').press('Enter');
  expect((await roofs(page))[0]).toMatchObject({ pitch: 28, overhang: 0.6 });
  await page.getByTestId('roof-material').selectOption('thatch');
  expect((await roofs(page))[0]).toMatchObject({ material: 'thatch', color: '#c9a86a' });
  await page.getByTestId('roof-kind').selectOption('gable');
  await page.getByTestId('roof-chimney').check();
  expect((await roofs(page))[0].chimney).toBe(true);

  // turn the ridge, then fit again
  await page.getByTestId('roof-turn').click();
  expect((await roofs(page))[0]).toMatchObject({ rotation: 90 });
  expect((await roofs(page))[0].w).toBeCloseTo(5.15, 1);
  await page.getByTestId('roof-fit').click();
  expect((await roofs(page))[0]).toMatchObject({ rotation: 0 });
  expect((await roofs(page))[0].w).toBeCloseTo(8.15, 1);

  // undo goes step by step
  await page.getByTestId('undo').click();
  expect((await roofs(page))[0].rotation).toBe(90);
});

test('a roof can be drawn by dragging, moved, copied and deleted; it never blocks clicks on what is under it', async ({ page }) => {
  await drawBox(page, 2, 2, 10, 7);
  await page.getByTestId('tool-roof').click();
  await dragWorld(page, [1, 1], [11, 8.5]);
  const [r] = await roofs(page);
  expect(r).toMatchObject({ kind: 'gable', rotation: 0 });
  expect(r.w).toBeCloseTo(10, 1);
  expect(r.d).toBeCloseTo(7.5, 1);

  // a tall box makes the ridge run along its long side, so the roof is turned
  await page.getByTestId('tool-roof').click();
  await dragWorld(page, [11.5, 0.5], [12.8, 5]);
  const tall = (await roofs(page))[1];
  expect(tall.rotation).toBe(90);
  expect(tall.w).toBeCloseTo(4.5, 1);
  expect(tall.d).toBeCloseTo(1.3, 1);

  // a wall under the roof can still be selected by clicking it (the roof only reacts at its outline)
  await page.getByTestId('tool-select').click();
  const p = await page.evaluate(() => {
    const v = (window as any).__ph.ui.getState().viewport;
    return { x: v.x + 6 * v.zoom, y: v.y + 2 * v.zoom };
  });
  const box = (await page.locator('.canvas-wrap').boundingBox())!;
  await page.mouse.click(box.x + p.x, box.y + p.y);
  expect((await ui(page)).selection).toMatchObject({ kind: 'wall' });

  // select the roof by its edge, move it with the arrow keys, duplicate it, delete it
  const edge = await page.evaluate((id) => {
    const v = (window as any).__ph.ui.getState().viewport;
    const r = (window as any).__ph.design.getState().design.roofs.find((x: any) => x.id === id);
    return { x: v.x + (r.x - r.w / 2 - r.overhang) * v.zoom, y: v.y + r.y * v.zoom };
  }, r.id);
  await page.mouse.click(box.x + edge.x, box.y + edge.y);
  expect((await ui(page)).selection).toMatchObject({ kind: 'roof', id: r.id });
  await page.keyboard.press('ArrowRight');
  expect((await roofs(page))[0].x).toBeCloseTo(r.x + 0.1, 5);
  await page.keyboard.press('Control+d');
  expect(await roofs(page)).toHaveLength(3);
  await page.keyboard.press('Delete');
  expect(await roofs(page)).toHaveLength(2);
});

test('roofs follow their floor and their layer', async ({ page }) => {
  await drawBox(page, 2, 2, 10, 7);
  await page.getByTestId('tool-roof').click();
  await page.getByTestId('roof-fit-walls').click();
  expect(await roofs(page)).toHaveLength(1);

  // the roofs layer can be locked: the tool refuses
  await page.evaluate(() => (window as any).__ph.design.getState().update((d: any) => void (d.layers.roofs.locked = true)));
  await page.getByTestId('tool-roof').click();
  await dragWorld(page, [11.5, 0.5], [12.8, 5]);
  expect(await roofs(page)).toHaveLength(1);
  await page.evaluate(() => (window as any).__ph.design.getState().update((d: any) => void (d.layers.roofs.locked = false)));
  await expect(page.getByTestId('layers')).toContainText('Roofs');

  // duplicating a floor copies its roof; deleting the floor removes it
  await page.getByTestId('tool-select').click();
  await page.getByRole('button', { name: 'Duplicate floor' }).click();
  expect(await roofs(page)).toHaveLength(2);
  const floors = (await design(page)).floors;
  expect((await roofs(page)).map((x) => x.floor).sort()).toEqual([floors[0].id, floors[1].id].sort());
  // the roof sits on its own floor: only that floor's plan shows it
  await page.evaluate((id) => (window as any).__ph.ui.getState().setActiveFloor(id), floors[0].id);
  await page.getByRole('button', { name: 'Delete floor' }).click();
  await page.getByTestId('confirm-ok').click();
  expect(await roofs(page)).toHaveLength(1);
});

const ROOF_LOOKS = ['gable', 'hip', 'flat', 'shed', 'gambrel', 'mansard'] as const;

test('every roof type shows in 3D, and the roof can be switched off or cut away', async ({ page }) => {
  test.setTimeout(120_000);
  await drawBox(page, 2, 2, 11, 8);
  await page.getByTestId('tool-roof').click();
  await page.getByTestId('roof-fit-walls').click();
  await page.evaluate(() => (window as any).__ph.design.getState().update((d: any) => {
    d.roofs[0].chimney = true;
    // some furniture so the scene is not empty
    d.furniture.push({ id: 'sofa', floor: d.floors[0].id, type: 'sofa', x: 6, y: 5, w: 2, d: 0.9, rotation: 0, color: '#b7c9a8', label: '' });
  }));
  await page.getByTestId('view-3d').click();
  await expect.poll(() => page.evaluate(() => (window as any).__ph3d?.stats().meshes ?? 0)).toBeGreaterThan(5);
  const meshes = () => page.evaluate(() => (window as any).__ph3d.stats().meshes as number);
  const withRoof = await meshes();

  for (const kind of ROOF_LOOKS) {
    await page.evaluate((k) => (window as any).__ph.design.getState().update((d: any) => {
      d.roofs[0].kind = k;
      d.roofs[0].parapet = k === 'flat';
      d.roofs[0].pitch = { gable: 35, hip: 30, flat: 5, shed: 15, gambrel: 20, mansard: 20 }[k as string];
    }), kind);
    await page.evaluate(() => {
      const s = (window as any).__ph3d.scene;
      s.setView([-4, 11, 20], [6.5, 1.5, 5]);
    });
    await page.waitForTimeout(250);
    expect(await page.evaluate(() => (window as any).__ph3d.stats().filled)).toBeGreaterThan(0.2);
    await page.screenshot({ path: `e2e/.results/m23-roof-${kind}.png`, clip: { x: 0, y: 52, width: 1180, height: 820 } });
  }

  // switch the roof off (checkbox) and on again
  await page.getByTestId('view3d-roof').uncheck();
  await expect.poll(meshes).toBeLessThan(withRoof);
  await page.getByTestId('view3d-roof').check();
  await expect.poll(meshes).toBeGreaterThan(withRoof - 2);

  // hiding the roofs layer in the plan also hides them in 3D
  const roofOn = await meshes();
  await page.evaluate(() => (window as any).__ph.design.getState().update((d: any) => void (d.layers.roofs.visible = false)));
  await expect.poll(meshes).toBeLessThan(roofOn);
  await page.evaluate(() => (window as any).__ph.design.getState().update((d: any) => void (d.layers.roofs.visible = true)));
  await expect.poll(meshes).toBe(roofOn);

  // the cut-away takes off the roof of the floor you are on
  await page.evaluate(() => (window as any).__ph.design.getState().update((d: any) => void (d.roofs[0].kind = 'gable')));
  await page.evaluate(() => (window as any).__ph.design.getState().update((d: any) => void d.floors.push({ id: 'up', name: '1st floor' })));
  const gableOn = await meshes();
  await page.getByTestId('view3d-cutaway').check();
  await expect.poll(meshes).toBeLessThan(gableOn);
});
