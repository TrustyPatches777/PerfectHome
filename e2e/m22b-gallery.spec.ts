import { test, expect } from '@playwright/test';
import { fresh } from './helpers';

/* eslint-disable @typescript-eslint/no-explicit-any */
// A visual check of every furniture model: each category laid out in rows and photographed from the front.

const GROUPS: Record<string, string[]> = {
  bedroom_living: ['Bedroom', 'Living'],
  kitchen_office: ['Kitchen & dining', 'Office'],
  bath_utility: ['Bathroom', 'Utility'],
  light_tech: ['Lighting', 'Electrical', 'Plumbing', 'Other'],
  cars_garden: ['Garage & cars', 'Outdoor'],
};

for (const [name, categories] of Object.entries(GROUPS)) {
  test(`gallery: ${name}`, async ({ page }) => {
    test.setTimeout(90_000);
    await fresh(page);
    const info = await page.evaluate((categories) => {
      const store = (window as any).__ph.design.getState();
      const cat: any[] = (window as any).__ph.catalog;
      const items = cat.filter((c) => categories.includes(c.category));
      const F = store.design.floors[0].id;
      let x = 0;
      let y = 0;
      let rowH = 0;
      const placed: any[] = [];
      for (const c of items) {
        const gap = 0.7;
        const big = c.w > 4 || c.d > 4;
        if (x + c.w > 15) {
          x = 0;
          y += rowH + 1.0;
          rowH = 0;
        }
        placed.push({ id: `g-${c.type}`, floor: F, type: c.type, x: x + c.w / 2, y: y + c.d / 2, w: c.w, d: c.d, rotation: 0, color: c.color, label: '' });
        x += c.w + gap;
        rowH = Math.max(rowH, c.d, big ? c.d : 0);
      }
      store.update((d: any) => {
        d.furniture.push(...placed);
        d.layers.rooms.visible = true;
        d.zones.push({ id: 'floor', floor: F, kind: 'terrace', name: '', color: '#ece8df', points: [{ x: -3, y: -3 }, { x: 22, y: -3 }, { x: 22, y: y + rowH + 4 }, { x: -3, y: y + rowH + 4 }] });
      });
      return { count: placed.length, w: 15, h: y + rowH };
    }, categories);
    expect(info.count).toBeGreaterThan(5);
    await page.getByTestId('view-3d').click();
    await expect.poll(() => page.evaluate(() => (window as any).__ph3d?.stats().meshes ?? 0)).toBeGreaterThan(info.count * 2);
    await page.evaluate(
      ([w, h]) => {
        (window as any).__ph.ui.getState().setTimeOfDay(13);
        const s = (window as any).__ph3d.scene;
        const cx = w / 2;
        const cz = h / 2;
        const dist = Math.max(w * 1.15, h * 1.15, 12);
        s.setView([cx, dist * 0.85, cz + dist * 0.55], [cx, 0, cz]);
      },
      [info.w, info.h],
    );
    await page.waitForTimeout(300);
    await page.screenshot({ path: `e2e/.results/gallery-${name}.png`, clip: { x: 0, y: 52, width: 1180, height: 820 } });
  });
}
