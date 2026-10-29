import { beforeAll, describe, expect, it } from 'vitest';
import { N_, getLang, localeOf, localizedTexts, localize, setLang, t } from './i18n';
import { KO } from './i18n/ko';

/** Every file that registers a table of labels with localize(): imported here so its texts are known. */
const TABLE_MODULES = import.meta.glob(
  [
    './catalog.ts',
    './find.ts',
    './floors.ts',
    './model.ts',
    './outdoor.ts',
    './paintSpec.ts',
    './planStyle.ts',
    './printLayout.ts',
    './roofActions.ts',
    './roofs.ts',
    './section.ts',
    './shortcuts.ts',
    './sky.ts',
    './stairs.ts',
    './sun.ts',
    './walls.ts',
    './windows.ts',
    './components/Dialogs.tsx',
    './components/GroupPanel.tsx',
    './components/MaterialPicker.tsx',
    './components/PlanStylePanel.tsx',
    './components/Properties.tsx',
    './components/StatusBar.tsx',
    './components/ToolBar.tsx',
    './components/ToolOptions.tsx',
  ],
  { eager: true },
);

/** The source of every file (not the tests, not the dictionary itself), as text. */
const SOURCES = import.meta.glob(['./**/*.ts', './**/*.tsx', '!./**/*.test.ts', '!./**/*.test.tsx', '!./i18n/**'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

/** The English texts written in the code: t('...') and N_('...') with a plain string. */
function writtenKeys(): Map<string, string> {
  const keys = new Map<string, string>();
  const re = /\b(?:t|tx|N_)\(\s*('(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*")/g;
  for (const [file, code] of Object.entries(SOURCES)) {
    for (const m of code.matchAll(re)) {
      const key = new Function(`return ${m[1]}`)() as string;
      if (!keys.has(key)) keys.set(key, file);
    }
  }
  return keys;
}

const placeholders = (s: string) => new Set([...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]));
/** A text with no words in it (keys like "V" or "Esc", numbers) is the same in every language. */
const hasWords = (s: string) => /[A-Za-z]{2,}/.test(s.replace(/\{\w+\}/g, ''));

describe('the dictionary (Korean)', () => {
  it('knows every file that registers a table of labels', () => {
    const listed = new Set(Object.keys(TABLE_MODULES));
    const missing = Object.entries(SOURCES).filter(([file, code]) => /\blocalize\(/.test(code) && !listed.has(file) && file !== './i18n.ts');
    expect(missing.map(([file]) => file)).toEqual([]);
  });

  it('has a Korean text for everything written as t("...") or N_("...")', () => {
    const missing = [...writtenKeys()].filter(([key]) => hasWords(key) && !KO[key]).map(([key, file]) => `${file}: ${key}`);
    expect(missing).toEqual([]);
  });

  it('has a Korean text for every label in the tables (the furniture catalog, wall types, roof kinds...)', () => {
    const missing = [...new Set(localizedTexts())].filter((key) => hasWords(key) && !KO[key]);
    expect(missing).toEqual([]);
  });

  it('keeps the {values} of a text: the Korean one uses no value that the English one does not have', () => {
    // `number` is handed to the floor names for languages that count from 1 (the English text is '4th floor', Korean says 5층)
    const given = new Set(['number']);
    const wrong = Object.entries(KO).filter(([en, ko]) => [...placeholders(ko)].some((p) => !placeholders(en).has(p) && !given.has(p)));
    expect(wrong.map(([en]) => en)).toEqual([]);
  });

  it('has no leftovers: every entry belongs to a text that is still in the code', () => {
    const used = new Set([...writtenKeys().keys(), ...localizedTexts()]);
    expect(Object.keys(KO).filter((key) => !used.has(key))).toEqual([]);
  });

  it('has no empty or untranslated-by-accident entries', () => {
    const empty = Object.entries(KO).filter(([, v]) => !v.trim());
    expect(empty.map(([k]) => k)).toEqual([]);
  });
});

describe('t()', () => {
  beforeAll(async () => {
    await setLang('en');
  });

  it('gives the English text and fills in {values}', () => {
    expect(t('Undo')).toBe('Undo');
    expect(t('Copied {n} items.', { n: 3 })).toBe('Copied 3 items.');
    expect(t('Saved {x}{y}', { x: 'a', y: false })).toBe('Saved a');
    expect(t('{a} and {missing}', { a: 1 })).toBe('1 and {missing}');
    expect(N_('Walls')).toBe('Walls');
  });

  it('switches the language, the tables and the locale, and goes back', async () => {
    const table = localize([{ label: 'Walls' }, { label: 'Doors & windows' }], ['label']);
    expect(getLang()).toBe('en');
    expect(localeOf()).toBeUndefined();
    await setLang('ko');
    expect(getLang()).toBe('ko');
    expect(localeOf()).toBe('ko-KR');
    expect(t('Undo')).toBe(KO['Undo']);
    expect(t('Undo')).not.toBe('Undo');
    expect(table[0].label).toBe(KO['Walls']);
    expect(t('a text nobody has translated')).toBe('a text nobody has translated'); // never blank
    await setLang('en');
    expect(table[0].label).toBe('Walls');
    expect(t('Undo')).toBe('Undo');
  });
});
