import { test, expect, type Page } from '@playwright/test';
import { at, clickAt, design, drawBox, fresh, pickFurniture, ui } from './helpers';

/* eslint-disable @typescript-eslint/no-explicit-any */

test.beforeEach(async ({ page }) => {
  await fresh(page);
  await page.evaluate(() => (window as any).__ph.ui.getState().setViewport({ x: 200, y: 160, zoom: 60 }));
});

/** Red channel of what is drawn at a world position (everything on the canvas, as rendered). */
async function red(page: Page, wx: number, wy: number): Promise<number[]> {
  return page.evaluate(
    ([x, y]) => {
      const ph = (window as any).__ph;
      const v = ph.ui.getState().viewport;
      const c: HTMLCanvasElement = ph.stage().toCanvas();
      const d = c.getContext('2d')!.getImageData(Math.round(x * v.zoom + v.x), Math.round(y * v.zoom + v.y), 1, 1).data;
      return [d[0], d[1], d[2]];
    },
    [wx, wy],
  );
}

async function house(page: Page) {
  await drawBox(page, 1, 3, 6, 6);
  await page.getByTestId('tool-room').click();
  await clickAt(page, 3.5, 4.5);
  await page.getByTestId('tool-select').click();
  await page.keyboard.press('Escape');
}

async function sunOn(page: Page) {
  await page.getByTestId('sun-toggle').check();
}

const setTime = (page: Page, h: number) => page.evaluate((t) => (window as any).__ph.ui.getState().setTimeOfDay(t), h);

test('sun and shadows start off; switching them on draws the house shadow north of the house at noon', async ({ page }) => {
  await house(page);
  expect((await design(page)).layers.shadows.visible).toBe(false);
  await setTime(page, 12);
  expect((await red(page, 3.5, 2.2))[0]).toBeGreaterThan(225); // nothing yet
  await sunOn(page);
  await expect(page.getByTestId('sun-panel')).toContainText('Sun 63° high, from S');
  const shaded = await red(page, 3.5, 2.2); // 0.8 m north of the wall: inside the 1.6 m shadow
  const sunny = await red(page, 3.5, 0.4); // beyond the shadow
  const inside = await red(page, 3.5, 4.5); // inside the house: kept light
  expect(shaded[0]).toBeLessThan(200);
  expect(sunny[0]).toBeGreaterThan(225);
  expect(inside[0]).toBeGreaterThan(200);
  expect((await red(page, 3.5, 7.5))[0]).toBeGreaterThan(225); // south of the house: no shadow
  await page.screenshot({ path: 'e2e/.results/m18-noon.png' });
});

test('the date, latitude and compass change the shadows', async ({ page }) => {
  await house(page);
  await sunOn(page);
  await setTime(page, 12);
  // summer: 1.6 m shadow; (3.5, -1) is clear. Winter noon: the low sun throws a much longer shadow.
  expect((await red(page, 3.5, -1))[0]).toBeGreaterThan(225);
  await page.getByTestId('sun-winter').click();
  expect((await design(page)).site).toMatchObject({ month: 12, day: 21 });
  expect((await red(page, 3.5, -1))[0]).toBeLessThan(200);
  await page.getByTestId('sun-summer').click();
  expect((await red(page, 3.5, -1))[0]).toBeGreaterThan(225);

  // turning the compass turns the shadow: north to the right means the noon shadow falls to the right
  expect((await red(page, 6.8, 4.5))[0]).toBeGreaterThan(225);
  await page.getByTestId('sun-north').fill('90');
  await page.getByTestId('sun-north').press('Enter');
  expect((await design(page)).site.north).toBe(90);
  expect((await red(page, 6.8, 4.5))[0]).toBeLessThan(200);
  expect((await red(page, 3.5, 2.2))[0]).toBeGreaterThan(225);

  // the compass on the plan only shows north: dragging it does not turn it
  const box = (await page.getByTestId('north-arrow').boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy - 20);
  await page.mouse.down();
  await page.mouse.move(cx - 40, cy, { steps: 5 });
  await page.mouse.up();
  expect((await design(page)).site.north).toBe(90);
});

test('night is dark, lamps that are on light up their surroundings, switch them off and it is dark again', async ({ page }) => {
  await house(page);
  await pickFurniture(page, 'lamp-ceiling');
  await clickAt(page, 3.5, 4.5);
  await page.keyboard.press('Escape');
  await sunOn(page);
  await setTime(page, 14);
  const day = await red(page, 4.1, 4.5); // beside the lamp symbol
  expect(day[0]).toBeGreaterThan(200);

  await setTime(page, 23.5);
  await expect(page.getByTestId('sun-phase')).toHaveText('Night');
  const far = await red(page, 9, 8); // empty ground at night
  const near = await red(page, 4.1, 4.5); // 60 cm from the lamp
  expect(far[0]).toBeLessThan(130);
  expect(near[0]).toBeGreaterThan(200); // lit
  expect(near[2]).toBeLessThan(near[0]); // warm: less blue than red
  await page.screenshot({ path: 'e2e/.results/m18-night.png' });

  await clickAt(page, 3.5, 4.5); // select the lamp (the room under it is below)
  await page.getByTestId('lamp-on').uncheck();
  expect((await red(page, 4.1, 4.5))[0]).toBeLessThan(130);

  // hiding the layer turns the whole effect off
  await page.getByTestId('hide-shadows').click();
  expect((await red(page, 9, 8))[0]).toBeGreaterThan(225);
});

test('the time slider, quick buttons and play', async ({ page }) => {
  await sunOn(page);
  await page.getByTestId('sun-slider').fill('9');
  await expect(page.getByTestId('sun-time')).toHaveText('09:00');
  expect((await ui(page)).timeOfDay).toBe(9);
  await page.getByTestId('sun-sunrise').click();
  const rise = (await ui(page)).timeOfDay;
  expect(rise).toBeGreaterThan(3);
  expect(rise).toBeLessThan(6);
  await expect(page.getByTestId('sun-phase')).toHaveText('Sunrise');
  await page.getByTestId('sun-slider').fill('15');
  await page.getByTestId('sun-play').click();
  await page.waitForTimeout(700);
  const t = (await ui(page)).timeOfDay;
  expect(t).toBeGreaterThan(15.3);
  await page.getByTestId('sun-play').click(); // pause
  const frozen = (await ui(page)).timeOfDay;
  await page.waitForTimeout(300);
  expect((await ui(page)).timeOfDay).toBe(frozen);
  expect((await ui(page)).sunPlaying).toBe(false);
  // the time of day is a view setting, not part of the design; the date and place are
  expect(JSON.stringify((await design(page)).site)).toBe('{"north":0,"lat":50,"month":6,"day":21}');
  void at;
});
