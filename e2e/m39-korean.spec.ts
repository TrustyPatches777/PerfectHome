import { test, expect, type Page } from '@playwright/test';
import { fresh } from './helpers';

/* eslint-disable @typescript-eslint/no-explicit-any */

test.beforeEach(async ({ page }) => {
  await fresh(page);
});

const edit = (page: Page, body: string) => page.evaluate(`window.__ph.design.getState().update((d) => { ${body} })`);

/** A two-storey house with one of most kinds of things, so every panel has something to show. */
async function house(page: Page) {
  await edit(page, `
    const F = d.floors[0].id;
    d.floors.push({ id: 'up', name: '1st floor' });
    const pts = [[0, 0], [8, 0], [8, 6], [0, 6]];
    pts.forEach((p, i) => { const q = pts[(i + 1) % 4]; d.walls.push({ id: 'w' + i, floor: F, a: { x: p[0], y: p[1] }, b: { x: q[0], y: q[1] }, thickness: 0.3, type: 'exterior', height: 2.5 }); });
    d.walls.push({ id: 'mid', floor: F, a: { x: 4, y: 0 }, b: { x: 4, y: 6 }, thickness: 0.15, type: 'interior', height: 2.5 });
    d.rooms.push({ id: 'r1', floor: F, name: 'Living room', type: 'living', color: '#f1e6d0', material: 'wood', living: true, points: [{ x: 0.15, y: 0.15 }, { x: 3.925, y: 0.15 }, { x: 3.925, y: 5.85 }, { x: 0.15, y: 5.85 }] });
    d.rooms.push({ id: 'r2', floor: F, name: 'Kitchen', type: 'kitchen', color: '#dbe7f4', material: 'tile', living: true, points: [{ x: 4.075, y: 0.15 }, { x: 7.85, y: 0.15 }, { x: 7.85, y: 5.85 }, { x: 4.075, y: 5.85 }] });
    d.openings.push({ id: 'win', wallId: 'w2', kind: 'window', pos: 2, width: 1.4, swing: 1, hinge: 'a' });
    d.openings.push({ id: 'door', wallId: 'w0', kind: 'door', pos: 2, width: 0.9, swing: 1, hinge: 'a' });
    d.furniture.push({ id: 'sofa', floor: F, type: 'sofa', x: 2, y: 4.5, w: 2.2, d: 0.95, rotation: 0, color: '#8aa0b8', label: '' });
    d.furniture.push({ id: 'lamp', floor: F, type: 'lamp-floor', x: 1, y: 1, w: 0.4, d: 0.4, rotation: 0, color: '#f5e6a8', label: '' });
    d.zones.push({ id: 'z', floor: F, kind: 'lawn', name: 'Lawn', color: '#7fbf6a', points: [{ x: -4, y: -1 }, { x: -1, y: -1 }, { x: -1, y: 7 }, { x: -4, y: 7 }] });
    d.strips.push({ id: 'st', floor: F, kind: 'fence', points: [{ x: -5, y: -2 }, { x: 10, y: -2 }], width: 0.1 });
    d.stairs.push({ id: 'sw', floor: F, kind: 'straight', x: 6, y: 4, w: 1, d: 3, rotation: 0, steps: 14, rise: 2.8, flip: false });
    d.roofs.push({ id: 'rf', floor: 'up', kind: 'gable', x: 4, y: 3, w: 8, d: 6, rotation: 0, pitch: 35, overhang: 0.4, thickness: 0.15, material: 'tiles', color: '#b5523b', chimney: false, parapet: false });
    d.labels.push({ id: 'lb', floor: F, x: 2, y: 2, text: '안녕', size: 0.3, color: '#1f2937' });
    d.dimensions.push({ id: 'dm', floor: F, a: { x: 0, y: -1 }, b: { x: 8, y: -1 } });
    d.notes.push({ id: 'nt', floor: F, x: 7, y: 1, text: '페인트 사기', author: '나', color: '#fde68a', time: 1700000000000, done: false });
    d.guides.push({ id: 'gd', axis: 'x', pos: 2 });`);
  await page.evaluate(() => (window as any).__ph.ui.getState().setViewport({ x: 300, y: 200, zoom: 50 }));
}

/**
 * The words of the screen that are still English. Names and numbers a person typed or picked are not looked at (inputs, the plan's own
 * text), and a few things are the same in every language (units, file kinds, key names, the name of the app).
 */
const SAME_EVERYWHERE =
  /\b(Perfect Home|PNG|SVG|JSON|CSV|PDF|TURN|VPN|URL|WebRTC|Ctrl|Cmd|Shift|Alt|Esc|Enter|Page Up|Page Down|Space|Delete|Backspace|WASD|cm|mm|m|m²|m³|SUV|TV|in|turn|turns|transport|tcp|A2|A3|A4|Tab|English)\b/g;

async function english(page: Page): Promise<string[]> {
  const found = await page.evaluate(() => {
    const out = new Set<string>();
    const visible = (el: Element) => {
      const r = (el as HTMLElement).getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
    };
    const root = document.body;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement;
      if (!el || ['SCRIPT', 'STYLE', 'TEXTAREA', 'OPTION'].includes(el.tagName) && el.tagName !== 'OPTION') continue;
      if (!visible(el)) continue;
      if (el.closest('[data-user-text], .name-input')) continue;
      const text = (n.nodeValue ?? '').trim();
      if (text) out.add(text);
    }
    for (const el of Array.from(root.querySelectorAll('[title], [aria-label], [placeholder], option'))) {
      if (el.tagName !== 'OPTION' && !visible(el)) continue;
      for (const a of ['title', 'aria-label', 'placeholder']) {
        const v = el.getAttribute(a);
        if (v) out.add(v);
      }
      if (el.tagName === 'OPTION' && el.textContent) out.add(el.textContent.trim());
    }
    return [...out];
  });
  return found
    .map((s) => s.replace(SAME_EVERYWHERE, ' ').replace(/https?:\S+/g, ' ').replace(/#[0-9a-f]{3,8}\b/gi, ' '))
    .filter((s) => /[A-Za-z]{2,}/.test(s))
    .map((s) => s.trim());
}

test('a Korean toggle switches the whole interface, is remembered, and goes back', async ({ page }) => {
  await expect(page.getByTestId('lang-toggle')).toHaveText('한국어');
  await expect(page.getByTestId('undo')).toHaveText('Undo');
  expect(await page.evaluate(() => document.documentElement.lang)).toBe('en');

  await page.getByTestId('lang-toggle').click();
  await expect(page.getByTestId('undo')).toHaveText('실행 취소');
  await expect(page.getByTestId('lang-toggle')).toHaveText('English');
  expect(await page.evaluate(() => document.documentElement.lang)).toBe('ko');
  await page.screenshot({ path: 'e2e/.results/m39-korean-home.png' });

  // remembered after a reload (and nothing of it is in the design)
  await page.reload();
  await expect(page.getByTestId('undo')).toHaveText('실행 취소');
  expect(JSON.stringify(await page.evaluate(() => (window as any).__ph.design.getState().design))).not.toContain('ko');

  await page.getByTestId('lang-toggle').click();
  await expect(page.getByTestId('undo')).toHaveText('Undo');
  await page.reload();
  await expect(page.getByTestId('undo')).toHaveText('Undo');
});

test('in Korean the panels, tools, dialogs and the 3D bar have no English left', async ({ page }) => {
  test.setTimeout(240_000);
  await house(page);
  await page.getByTestId('lang-toggle').click();
  await expect(page.getByTestId('undo')).toHaveText('실행 취소');
  const left = new Map<string, string>();
  const t0 = Date.now();
  const check = async (where: string) => {
    console.log('CHECK', where, Date.now() - t0);
    for (const s of await english(page)) if (!left.has(s)) left.set(s, where);
  };

  await check('home');
  // every tool: its options bar and its hint
  for (const tool of await page.locator('[data-testid^="tool-"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')!))) {
    await page.getByTestId(tool).click();
    await check(tool);
  }
  await page.getByTestId('tool-select').click();
  // the panels on the right (open the ones that fold)
  for (const summary of await page.locator('summary').all()) if (await summary.isVisible()) await summary.click({ timeout: 1500 }).catch(() => {});
  await check('panels');
  // what a selection shows in the properties panel, for one thing of each kind
  const refs: [string, string][] = [['wall', 'w0'], ['wall', 'mid'], ['opening', 'win'], ['opening', 'door'], ['room', 'r1'], ['furniture', 'sofa'], ['furniture', 'lamp'], ['zone', 'z'], ['strip', 'st'], ['stair', 'sw'], ['roof', 'rf'], ['label', 'lb'], ['dimension', 'dm'], ['note', 'nt'], ['guide', 'gd']];
  for (const [kind, id] of refs) {
    await page.evaluate(([k, i]) => (window as any).__ph.ui.getState().select({ kind: k, id: i }), [kind, id]);
    await check(`selected ${kind} ${id}`);
  }
  await page.evaluate(() => (window as any).__ph.ui.getState().setSelected([{ kind: 'wall', id: 'w0' }, { kind: 'wall', id: 'w1' }, { kind: 'furniture', id: 'sofa' }]));
  await check('several selected');
  await page.evaluate(() => (window as any).__ph.ui.getState().select(null));
  // the menus and the dialogs
  await page.getByTestId('file-menu').click();
  await check('file menu');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /^보기 ▾$/ }).click();
  await check('view menu');
  await page.keyboard.press('Escape');
  for (const dialog of ['areas', 'find', 'rooms', 'snapshots', 'print', 'drawing', 'live', 'identity']) {
    await page.evaluate((type) => (window as any).__ph.ui.getState().setDialog({ type }), dialog);
    await page.waitForTimeout(250);
    await check(`dialog ${dialog}`);
    await page.evaluate(() => (window as any).__ph.ui.getState().setDialog(null));
  }
  await page.evaluate(() => (window as any).__ph.ui.getState().setDialog({ type: 'custom-item', editId: null }));
  await check('dialog custom item');
  await page.evaluate(() => (window as any).__ph.ui.getState().setDialog(null));
  await page.keyboard.press('?');
  await check('help');
  await page.keyboard.press('?'); // the same key closes it
  await expect(page.locator('.modal-backdrop')).toHaveCount(0);
  // the furniture palette: every category, and the search
  for (const cat of await page.locator('[data-testid^="cat-"]').all()) {
    await cat.click({ timeout: 1500 }).catch(() => {});
    await check('palette');
  }
  // 3D: the bar, the Present menu and the sky panel
  await page.getByTestId('view-3d').click();
  await expect.poll(() => page.evaluate(() => (window as any).__ph3d?.stats().meshes ?? 0), { timeout: 30_000 }).toBeGreaterThan(10);
  await check('3D');
  await page.getByTestId('present-button').click();
  await check('3D present menu');
  await page.screenshot({ path: 'e2e/.results/m39-korean-3d.png' });

  const report = [...left].map(([s, where]) => `${where}: ${s}`);
  expect(report).toEqual([]);
});

test('in Korean the messages, warnings and the less common screens have no English left either', async ({ page }) => {
  test.setTimeout(240_000);
  page.setDefaultTimeout(8000); // a step that cannot be done should fail at once, not wait for the test timeout
  await house(page);
  await page.getByTestId('lang-toggle').click();
  await expect(page.getByTestId('undo')).toHaveText('실행 취소');
  const left = new Map<string, string>();
  const check = async (where: string) => {
    for (const s of await english(page)) if (!left.has(s)) left.set(s, where);
  };
  const ui = (fn: string) => page.evaluate(`(${fn})(window.__ph.ui.getState())`);

  // messages (toasts) from things that do not work out
  await page.getByTestId('tool-select').click();
  await page.keyboard.press('Control+v'); // nothing copied yet
  await check('toast: paste with nothing copied');
  await page.keyboard.press('Control+g'); // nothing to group
  await check('toast: group nothing');
  // the plan check with real findings: a wardrobe in the swing of the door, a kitchen without a window, a low ceiling
  await edit(page, `
    const F = d.floors[0].id;
    d.furniture.push({ id: 'blocker', floor: F, type: 'wardrobe', x: 2, y: 0.9, w: 1.2, d: 0.6, rotation: 0, color: '#d9c7b0', label: '' });
    d.rooms.find((r) => r.id === 'r2').ceiling = 1.9;
    d.zones.push({ id: 'plot', floor: F, kind: 'plot', name: '', color: '#e5e7eb', points: [{ x: -2, y: -2 }, { x: 11, y: -2 }, { x: 11, y: 9 }, { x: -2, y: 9 }] });`);
  await ui('(s) => s.setShowChecks(true)');
  await page.waitForTimeout(300);
  await check('plan check');
  // sun and shadows, the sky panel
  await page.getByTestId('sun-toggle').check();
  await check('sun');
  await page.getByTestId('sun-play').click();
  await page.getByTestId('sun-play').click();
  await check('sun playing');
  // the area table with a plot, and the printed pages
  await ui("(s) => s.setDialog({ type: 'areas' })");
  await page.waitForTimeout(250);
  await check('areas with a plot');
  await ui('(s) => s.setDialog(null)');
  // a floor with something on it asks before it is deleted
  await page.getByTestId('delete-floor').click();
  await check('confirm');
  await page.getByTestId('confirm-dialog').getByRole('button', { name: '취소' }).click();
  await expect(page.locator('.modal-backdrop')).toHaveCount(0);
  // opening kinds, wall types, roof kinds, stair kinds, zone kinds: each with its own properties
  const kinds = [
    ['openings', 'win', 'kind', ['casement', 'sash', 'picture', 'bay', 'highwin', 'floorwin', 'door', 'main', 'garden', 'double', 'french', 'sliding', 'garage', 'gap'], 'opening'],
    ['walls', 'mid', 'type', ['exterior', 'partition', 'slats', 'glass', 'railing'], 'wall'],
    ['roofs', 'rf', 'kind', ['hip', 'flat', 'shed', 'gambrel', 'mansard'], 'roof'],
    ['stairs', 'sw', 'kind', ['landing', 'l', 'u', 'winder', 'spiral', 'ladder'], 'stair'],
    ['zones', 'z', 'kind', ['terrace', 'balcony', 'porch', 'driveway', 'flowerbed', 'water', 'terrain', 'lightwell'], 'zone'],
  ] as const;
  for (const [list, id, prop, values, ref] of kinds) {
    for (const v of values) {
      await edit(page, `const x = d.${list}.find((i) => i.id === '${id}'); if (x) x.${prop} = '${v}';`);
      await page.evaluate(([k, i]) => (window as any).__ph.ui.getState().select({ kind: k, id: i }), [ref, id]);
      await check(`${ref} ${v}`);
    }
  }
  // the fence with a gate, and the rail of the stair
  await edit(page, `const s = d.strips.find((i) => i.id === 'st'); s.gates = [{ id: 'g1', pos: 3, width: 1, kind: 'single', swing: 1, hinge: 'a' }];`);
  await page.evaluate(() => (window as any).__ph.ui.getState().select({ kind: 'strip', id: 'st' }));
  await check('fence with a gate');
  // 3D: walking, the cut-away, the sky panel
  await page.getByTestId('view-3d').click();
  await expect.poll(() => page.evaluate(() => (window as any).__ph3d?.stats().meshes ?? 0), { timeout: 30_000 }).toBeGreaterThan(10);
  await page.getByTestId('mode-walk').click();
  await check('3D walking');
  await page.getByTestId('mode-orbit').click();
  await check('3D orbit');

  const report = [...left].map(([s, where]) => `${where}: ${s}`);
  expect(report).toEqual([]);
});
