import { test, expect, type Page } from '@playwright/test';
import { clickAt, design, fresh, ui } from './helpers';

test.beforeEach(async ({ page }) => {
  await fresh(page);
});

async function becomeSomeone(page: Page, name: string, color: string) {
  await page.getByTestId('user-chip').click();
  await page.getByTestId('identity-name').fill(name);
  await page.getByTestId(`identity-color-${color}`).click();
  await page.getByTestId('identity-save').click();
}

test('the first note asks who you are, then signs the note with your name and color', async ({ page }) => {
  await expect(page.getByTestId('user-chip')).toContainText('Who are you?');
  await page.getByTestId('tool-note').click();
  await clickAt(page, 3, 3);
  await expect(page.getByTestId('identity-dialog')).toBeVisible();
  expect((await design(page)).notes).toHaveLength(0);
  await page.getByTestId('identity-name').fill('Paul');
  await page.getByTestId('identity-color-#60a5fa').click();
  await page.getByTestId('identity-save').click();

  // the note was placed where you clicked, and its text box is ready to type into
  const d = await design(page);
  expect(d.notes).toHaveLength(1);
  expect(d.notes[0]).toMatchObject({ x: 3, y: 3, author: 'Paul', color: '#60a5fa', text: '', done: false });
  await expect(page.getByTestId('note-text')).toBeFocused();
  await page.keyboard.type('Window here?');
  expect((await design(page)).notes[0].text).toBe('Window here?');
  await expect(page.getByTestId('note-author')).toContainText('Paul');
  await expect(page.getByTestId('user-chip')).toContainText('Paul');
  await expect(page.getByTestId('notes-panel')).toContainText('Window here?');
  await page.screenshot({ path: 'e2e/.results/m17-note.png' });

  // the identity is remembered after a reload; the next note needs no dialog
  await expect(page.getByTestId('save-state')).toContainText('Saved');
  await page.reload();
  await expect(page.getByTestId('user-chip')).toContainText('Paul');
  await page.getByTestId('tool-note').click();
  await clickAt(page, 5, 3);
  await expect(page.getByTestId('identity-dialog')).toHaveCount(0);
  expect((await design(page)).notes).toHaveLength(2);
});

test('two people, two colors; open and done notes; the list jumps to a note', async ({ page }) => {
  await becomeSomeone(page, 'Paul', '#60a5fa');
  await page.getByTestId('tool-note').click();
  await clickAt(page, 2, 2);
  await expect(page.getByTestId('note-text')).toBeFocused();
  await page.keyboard.type('Where does the sofa go?');
  await page.keyboard.press('Escape');

  await becomeSomeone(page, 'Anna', '#f472b6');
  await page.getByTestId('tool-note').click();
  await clickAt(page, 6, 4);
  await expect(page.getByTestId('note-text')).toBeFocused();
  await page.keyboard.type('Plants by the window!');
  await page.keyboard.press('Escape');

  const d = await design(page);
  expect(d.notes.map((n: any) => [n.author, n.color])).toEqual([
    ['Paul', '#60a5fa'],
    ['Anna', '#f472b6'],
  ]);
  await expect(page.getByTestId('notes-panel')).toContainText('2 open');

  // mark Paul's note done: it leaves the open list
  await clickAt(page, 2, 2);
  expect((await ui(page)).selection?.kind).toBe('note');
  await page.getByTestId('note-done').click();
  await expect(page.getByTestId('notes-panel')).toContainText('1 open');
  await expect(page.getByTestId('note-item')).toHaveCount(1);
  await page.getByTestId('show-done').check();
  await expect(page.getByTestId('note-item')).toHaveCount(2);
  await page.getByTestId('note-done').click(); // reopen
  expect((await design(page)).notes[0].done).toBe(false);

  // the list centers the plan on a note and selects it
  await page.keyboard.press('Escape');
  await page.evaluate(() => (window as any).__ph.ui.getState().setViewport({ x: -3000, y: -3000, zoom: 60 }));
  await page.getByTestId('note-item').nth(1).click();
  const s = await ui(page);
  expect(s.selection).toEqual({ kind: 'note', id: d.notes[1].id });
  const v = s.viewport;
  expect((s.canvasSize.w / 2 - v.x) / v.zoom).toBeCloseTo(6, 3);
});

test('notes are on their own layer: hide it, lock it; and they belong to a floor', async ({ page }) => {
  await becomeSomeone(page, 'Paul', '#4ade80');
  await page.getByTestId('tool-note').click();
  await clickAt(page, 4, 4);
  await page.keyboard.press('Escape');

  await page.getByTestId('lock-comments').click();
  await clickAt(page, 4, 4);
  expect((await ui(page)).selection).toBeNull();
  await page.getByTestId('tool-note').click();
  await clickAt(page, 7, 4);
  expect((await design(page)).notes).toHaveLength(1);
  await expect(page.locator('.statusbar')).toContainText('locked');
  await page.keyboard.press('Escape');
  await page.getByTestId('lock-comments').click();

  await page.getByTestId('hide-comments').click();
  await clickAt(page, 4, 4);
  expect((await ui(page)).selection).toBeNull();
  await expect(page.getByTestId('notes-panel')).toContainText('hidden');
  await page.getByTestId('hide-comments').click();
  await clickAt(page, 4, 4);
  expect((await ui(page)).selection?.kind).toBe('note');

  // a note on the upper floor is listed with its floor and the list switches floors
  await page.getByTestId('add-floor').click();
  await page.getByTestId('tool-note').click();
  await clickAt(page, 3, 3);
  await expect(page.getByTestId('note-text')).toBeFocused();
  await page.keyboard.type('Check the stairs');
  await page.keyboard.press('Escape');
  await page.keyboard.press('PageDown');
  await expect(page.getByTestId('floor-current')).toHaveText('Ground floor');
  const item = page.getByTestId('note-item').filter({ hasText: 'Check the stairs' });
  await expect(item).toContainText('1st floor');
  await item.click();
  await expect(page.getByTestId('floor-current')).toHaveText('1st floor');
  expect((await ui(page)).selection?.kind).toBe('note');
});
