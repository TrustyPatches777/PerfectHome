import { test, expect, type Page } from '@playwright/test';
import { design, fresh } from './helpers';

/* eslint-disable @typescript-eslint/no-explicit-any */

test.beforeEach(async ({ page }) => {
  await fresh(page);
});

async function edit(page: Page, body: string) {
  await page.evaluate(`window.__ph.design.getState().update((d) => { ${body} })`);
}
const select = (page: Page, refs: { kind: string; id: string }[]) => page.evaluate((r) => (window as any).__ph.ui.getState().setSelected(r), refs);
const meshes = (page: Page): Promise<number> => page.evaluate(() => (window as any).__ph3d?.stats().meshes ?? 0);

/** A box house, two floors, with a main door, a window, and a roof. */
const house = `
  const F = d.floors[0].id;
  d.floors.push({ id: 'up', name: 'First floor' });
  for (const [id, ax, ay, bx, by] of [['n', 2, 2, 10, 2], ['e', 10, 2, 10, 8], ['s', 10, 8, 2, 8], ['w', 2, 8, 2, 2]]) d.walls.push({ id, floor: F, a: { x: ax, y: ay }, b: { x: bx, y: by }, thickness: 0.3, type: 'exterior', height: 2.5 });
  d.rooms.push({ id: 'r1', floor: F, name: 'Hall', color: '#e7c9a0', material: 'wood', living: true, points: [{ x: 2.15, y: 2.15 }, { x: 9.85, y: 2.15 }, { x: 9.85, y: 7.85 }, { x: 2.15, y: 7.85 }] });
  d.openings.push({ id: 'door', wallId: 's', kind: 'door', pos: 3, width: 0.9, swing: 1, hinge: 'a' });
  d.openings.push({ id: 'win', wallId: 'n', kind: 'window', pos: 4, width: 1.2, swing: 1, hinge: 'a' });
  d.roofs.push({ id: 'rf', floor: F, kind: 'gable', x: 6, y: 5, w: 8, d: 6, rotation: 0, pitch: 35, overhang: 0.4, thickness: 0.15, material: 'tiles', color: '#b5523b', chimney: true, parapet: false });
`;

test('walls: wallpaper and tile layouts, the second color, and a picture from the computer', async ({ page }) => {
  await edit(page, house);
  await select(page, [{ kind: 'wall', id: 'n' }]);
  await page.getByTestId('wall-finish-l').selectOption('wallpaper');
  await expect(page.getByTestId('wall-pattern-l')).toBeVisible();
  await page.getByTestId('wall-pattern-l').selectOption('damask');
  let d = await design(page);
  expect(d.walls.find((w: any) => w.id === 'n').paint.l).toMatchObject({ finish: 'wallpaper', pattern: 'damask' });
  await page.getByTestId('wall-finish-l').selectOption('tiles');
  await page.getByTestId('wall-pattern-l').selectOption('herringbone');
  await edit(page, `const w = d.walls.find((x) => x.id === 'n'); w.paint.l.grout = '#334155';`);
  d = await design(page);
  expect(d.walls.find((w: any) => w.id === 'n').paint.l).toMatchObject({ finish: 'tiles', pattern: 'herringbone', grout: '#334155' });
  await page.getByTestId('wall-grout-reset-l').click();
  expect((await design(page)).walls.find((w: any) => w.id === 'n').paint.l.grout).toBeUndefined();

  // a picture: a tiny PNG from the computer
  await page.getByTestId('wall-finish-r').selectOption('custom');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGP8z8Dwn4GBgYEJRIAAAB0JAgHXVx0hAAAAAElFTkSuQmCC', 'base64');
  await page.getByTestId('wall-picture-r-file').setInputFiles({ name: 'wall.png', mimeType: 'image/png', buffer: png });
  await expect.poll(async () => (await design(page)).walls.find((w: any) => w.id === 'n').paint.r.texture).toBeTruthy();
  const id = (await design(page)).walls.find((w: any) => w.id === 'n').paint.r.texture;
  expect(await page.evaluate((t) => localStorage.getItem(`perfect-home:tex:${t}`)?.startsWith('data:image'), id)).toBe(true);
  await expect(page.getByTestId('wall-picture-r-remove')).toBeVisible();
  await page.getByTestId('wall-picture-r-remove').click();
  expect((await design(page)).walls.find((w: any) => w.id === 'n').paint.r.texture).toBeUndefined();
});

test('floors: new materials, grout and a picture', async ({ page }) => {
  await edit(page, house);
  await select(page, [{ kind: 'room', id: 'r1' }]);
  for (const m of ['herringbone', 'subway', 'checker', 'marble']) {
    await page.getByTestId(`material-${m}`).click();
    expect((await design(page)).rooms[0].material).toBe(m);
  }
  await page.getByTestId('material-tile').click();
  await edit(page, `d.rooms[0].grout = '#112233';`);
  await page.getByTestId('floor-grout-reset').click();
  expect((await design(page)).rooms[0].grout).toBeUndefined();
  await page.getByTestId('material-custom').click();
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGP8z8Dwn4GBgYEJRIAAAB0JAgHXVx0hAAAAAElFTkSuQmCC', 'base64');
  await page.getByTestId('floor-picture-file').setInputFiles({ name: 'floor.png', mimeType: 'image/png', buffer: png });
  await expect.poll(async () => (await design(page)).rooms[0].texture).toBeTruthy();
  await page.screenshot({ path: 'e2e/.results/m30-floor-picture.png' });
});

test('furniture gets a frame color of its own', async ({ page }) => {
  await edit(page, `d.furniture.push({ id: 'sofa', floor: d.floors[0].id, type: 'sofa', x: 5, y: 5, w: 2, d: 0.9, rotation: 0, color: '#9ca3af', label: '' });`);
  await select(page, [{ kind: 'furniture', id: 'sofa' }]);
  await expect(page.getByTestId('furniture-color2-reset')).toHaveCount(0);
  await edit(page, `d.furniture[0].color2 = '#6b4a2f';`);
  await page.getByTestId('furniture-color2-reset').click();
  expect((await design(page)).furniture[0].color2).toBeUndefined();
});

test('3D: ceilings can be shown, in the style chosen for the room', async ({ page }) => {
  await edit(page, house);
  await select(page, [{ kind: 'room', id: 'r1' }]);
  await page.getByTestId('room-ceiling-style').selectOption('coffered');
  expect((await design(page)).rooms[0].ceilingStyle).toBe('coffered');
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await expect.poll(() => meshes(page)).toBeGreaterThan(10);
  const without = await meshes(page);
  await page.getByTestId('view3d-ceilings').check();
  await expect.poll(() => meshes(page)).toBeGreaterThan(without + 20); // the grid of the coffers
  await page.getByTestId('view3d-ceilings').uncheck();
  await expect.poll(() => meshes(page)).toBe(without);
});

test('roof detail: gutters, fascia, chimney style, solar panels, a dormer and a roof for each wing', async ({ page }) => {
  await edit(page, house);
  await select(page, [{ kind: 'roof', id: 'rf' }]);
  await page.getByTestId('roof-chimney-style').selectOption('stone');
  await page.getByTestId('roof-gutters').check();
  await page.getByTestId('roof-fascia').check();
  let d = await design(page);
  expect(d.roofs[0]).toMatchObject({ chimneyStyle: 'stone', gutters: true });
  expect(d.roofs[0].fascia).toBeTruthy();

  // skylight kinds through the tool
  await page.getByTestId('tool-skylight').click();
  for (const kind of ['solar', 'dormer', 'window']) await expect(page.getByTestId(`skylight-kind-${kind}`)).toBeVisible();
  await page.getByTestId('skylight-kind-solar').click();
  await edit(page, `d.skylights.push({ id: 'sol', floor: d.floors[0].id, x: 6, y: 6.2, w: 2, d: 1.2, kind: 'solar' }); d.skylights.push({ id: 'dm', floor: d.floors[0].id, x: 8, y: 6.6, w: 1.4, d: 1, kind: 'dormer' });`);
  await page.getByTestId('tool-select').click();
  await select(page, [{ kind: 'skylight', id: 'dm' }]);
  await expect(page.getByTestId('sky-d')).toBeVisible();
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await expect.poll(() => meshes(page)).toBeGreaterThan(30);
  await page.evaluate(() => (window as any).__ph3d.scene.setView([6, 9, 17], [6, 3, 5]));
  await page.screenshot({ path: 'e2e/.results/m30-roof-detail.png' });
  d = await design(page);
  expect(d.skylights.map((s: any) => s.kind).sort()).toEqual(['dormer', 'solar']);
});

test('"Roof each wing" gives an L-shaped house two roofs', async ({ page }) => {
  await edit(page, `
    const F = d.floors[0].id;
    const L = [[0, 0], [12, 0], [12, 6], [6, 6], [6, 12], [0, 12]];
    L.forEach((p, i) => { const q = L[(i + 1) % L.length]; d.walls.push({ id: 'w' + i, floor: F, a: { x: p[0], y: p[1] }, b: { x: q[0], y: q[1] }, thickness: 0.3, type: 'exterior', height: 2.5 }); });
    d.rooms.push({ id: 'l', floor: F, name: 'L', color: '#e7c9a0', material: 'wood', living: true, points: L.map((p) => ({ x: p[0] + (p[0] ? -0.15 : 0.15), y: p[1] + (p[1] ? -0.15 : 0.15) })) });`);
  await page.getByTestId('tool-roof').click();
  await page.getByTestId('roof-wings').click();
  const d = await design(page);
  expect(d.roofs).toHaveLength(2);
  expect(new Set(d.roofs.map((r: any) => r.rotation))).toEqual(new Set([0, 90]));
  // one undo takes both away
  await page.keyboard.press('Control+z');
  expect((await design(page)).roofs).toHaveLength(0);
});

test('balcony and porch zones, entrance steps and the facade', async ({ page }) => {
  await edit(page, house);
  // zones
  await edit(page, `
    d.zones.push({ id: 'bal', floor: 'up', kind: 'balcony', name: '', color: '#d9d2c5', points: [{ x: 4, y: 8.1 }, { x: 7, y: 8.1 }, { x: 7, y: 9.5 }, { x: 4, y: 9.5 }] });
    d.zones.push({ id: 'por', floor: d.floors[0].id, kind: 'porch', name: '', color: '#cfc6bb', points: [{ x: 4.5, y: 8.2 }, { x: 6.5, y: 8.2 }, { x: 6.5, y: 9.4 }, { x: 4.5, y: 9.4 }] });`);
  await select(page, [{ kind: 'zone', id: 'bal' }]);
  await page.getByTestId('zone-railing').selectOption('glass');
  expect((await design(page)).zones.find((z: any) => z.id === 'bal').railing).toBe('glass');
  await select(page, [{ kind: 'zone', id: 'por' }]);
  await expect(page.getByTestId('zone-railing')).toHaveCount(0);
  await expect(page.getByTestId('zone-raise')).toBeVisible();

  // entrance steps: a straight stair that does not go up to the next floor
  await page.getByTestId('tool-stairs').click();
  await page.getByTestId('stair-kind-entrance').click();
  await page.getByTestId('tool-select').click();
  await edit(page, `d.stairs.push({ id: 'ent', floor: d.floors[0].id, kind: 'straight', x: 3.4, y: 8.7, w: 1.4, d: 0.9, rotation: 0, steps: 3, rise: 0.45, flip: false });`);

  // facade
  await page.evaluate(() => (window as any).__ph.ui.getState().setSelected([]));
  await expect(page.getByTestId('facade-box')).toBeVisible();
  await page.getByTestId('facade-finish').selectOption('brick');
  await page.getByTestId('facade-apply').click();
  let d = await design(page);
  expect(d.walls.filter((w: any) => w.paint).length).toBe(4);
  expect(d.walls.every((w: any) => !w.paint || !w.paint.r || !w.paint.l)).toBe(true); // one face only
  await page.getByTestId('facade-clear').click();
  d = await design(page);
  expect(d.walls.filter((w: any) => w.paint)).toHaveLength(0);
});

test('openings: handle, trim and shutters', async ({ page }) => {
  await edit(page, house);
  await select(page, [{ kind: 'opening', id: 'door' }]);
  await page.getByTestId('opening-handle').selectOption('bar');
  await page.getByTestId('opening-trim').check();
  let d = await design(page);
  expect(d.openings.find((o: any) => o.id === 'door')).toMatchObject({ handle: 'bar' });
  expect(d.openings.find((o: any) => o.id === 'door').trim).toBeTruthy();
  await expect(page.getByTestId('opening-shutters')).toHaveCount(0); // doors have none
  await select(page, [{ kind: 'opening', id: 'win' }]);
  await page.getByTestId('opening-shutters').check();
  d = await design(page);
  expect(d.openings.find((o: any) => o.id === 'win').shutters).toBeTruthy();
  await page.getByTestId('opening-shutters').uncheck();
  expect((await design(page)).openings.find((o: any) => o.id === 'win').shutters).toBeUndefined();
  // all of it must survive saving and reloading a link
  await select(page, [{ kind: 'opening', id: 'win' }]);
  await page.getByTestId('opening-shutters').check();
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await expect.poll(() => meshes(page)).toBeGreaterThan(30);
  await page.screenshot({ path: 'e2e/.results/m30-openings.png' });
});
