/**
 * Language of the interface (English or Korean). The English text IS the key: `t('Undo')` gives 'Undo', or the Korean entry for it when
 * Korean is on (src/i18n/ko.ts, loaded only when needed). A text that is missing in the dictionary shows in English, never blank.
 * Values go in as `{name}`: `t('Copied {n} items.', { n: 3 })`. The language is a per-browser choice (never part of a design or a link).
 */
import { Fragment, createElement, useSyncExternalStore, type ReactNode } from 'react';

export type Lang = 'en' | 'ko';

const KEY = 'perfect-home:lang';

let lang: Lang = 'en';
let ko: Record<string, string> | null = null;
const listeners = new Set<() => void>();

const saved = (): Lang => {
  try {
    return localStorage.getItem(KEY) === 'ko' ? 'ko' : 'en';
  } catch {
    return 'en';
  }
};

async function loadKorean() {
  if (!ko) ko = (await import('./i18n/ko')).KO;
}

type Vars = Record<string, string | number | boolean | null | undefined>;

/** A value inside a text: nothing for `false`, `null` and `undefined` (so `{cond && "x"}` works like in JSX). */
const show = (v: string | number | boolean | null | undefined): string => (v === false || v == null || v === true ? '' : String(v));

/** Fill in `{name}` places. */
function fill(text: string, vars?: Vars): string {
  return vars ? text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? show(vars[k]) : m)) : text;
}

/** The text in the language that is on. */
export function t(key: string, vars?: Vars): string {
  return fill(lang === 'ko' ? (ko?.[key] ?? key) : key, vars);
}

/** Like t(), for a text with parts that are not text (a bold name, a link): `tx(text, { name: <b>x</b> })` gives the pieces to render, with {name} replaced. */
export function tx(key: string, parts: Record<string, ReactNode>): ReactNode[] {
  const text = lang === 'ko' ? (ko?.[key] ?? key) : key;
  return text.split(/({w+})/).map((piece, i) => {
    const name = /^{(w+)}$/.exec(piece)?.[1];
    return createElement(Fragment, { key: i }, name !== undefined && name in parts ? parts[name] : piece);
  });
}

/**
 * Tables of labels (wall types, roof kinds, the furniture catalog...) are built once, when the code loads, but are read when something is drawn. So they
 * are registered here: the English text is kept, and every language switch writes the right text back into the table. Nothing that shows a label needs
 * to know about languages.
 *   localize(WALL_STYLE, ['label', 'hint'])   an array or record of objects: those properties
 *   localize(SIDE_NAME, '*')                  an array or record of strings: all of them
 */
interface Slot {
  owner: Record<string, unknown>;
  prop: string;
  en: string;
}
const slots: Slot[] = [];

export function localize<T extends object>(table: T, props: readonly string[] | '*' = ['label']): T {
  const from = slots.length;
  const rec = table as Record<string, unknown>;
  if (props === '*') {
    for (const k of Object.keys(rec)) if (typeof rec[k] === 'string') slots.push({ owner: rec, prop: k, en: rec[k] as string });
  } else {
    for (const row of Object.values(rec)) {
      if (!row || typeof row !== 'object') continue;
      for (const p of props) {
        const v = (row as Record<string, unknown>)[p];
        if (typeof v === 'string') slots.push({ owner: row as Record<string, unknown>, prop: p, en: v });
      }
    }
  }
  for (const s of slots.slice(from)) s.owner[s.prop] = t(s.en);
  return table;
}

/** Texts that are shown later through `t(variable)` and are not in a table (the names of the furniture categories). */
const extra: string[] = [];
export function registerTexts(texts: readonly string[]) {
  extra.push(...texts);
}

/** The English text of everything that was registered (the dictionary test checks that each has a Korean text). */
export const localizedTexts = (): string[] => [...slots.map((s) => s.en), ...extra];

/** Marks a text that is shown later through `t(variable)` (it stays as it is; the dictionary test knows it is meant to be translated). */
export const N_ = (key: string): string => key;

const applyTables = () => slots.forEach((s) => void (s.owner[s.prop] = t(s.en)));

export const getLang = (): Lang => lang;

/** Start in the language the browser remembers (call before the first render, so nothing flashes in English). */
export async function initLang() {
  lang = saved();
  if (lang === 'ko') await loadKorean();
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
  applyTables();
}

/** Switch the language; everything on the screen follows (the app re-renders from `useLang`). */
export async function setLang(next: Lang) {
  if (next === 'ko') await loadKorean();
  lang = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* the choice only lasts for this visit */
  }
  if (typeof document !== 'undefined') document.documentElement.lang = next;
  applyTables();
  listeners.forEach((f) => f());
}

const subscribe = (f: () => void) => {
  listeners.add(f);
  return () => void listeners.delete(f);
};

/** Re-renders the component when the language changes (call it once, high up: the children follow). */
export function useLang(): Lang {
  return useSyncExternalStore(subscribe, getLang, getLang);
}

/** Locale for dates and times. */
export const localeOf = (): string | undefined => (lang === 'ko' ? 'ko-KR' : undefined);
