// Loads every data table once. Rules never import this: they receive `data` as an argument.

import { applyOverlay } from './overlay.js';

export const DATA_FILES = {
  attributes: 'attributes.json',
  skills: 'skills.json',
  combat: 'combat.json',
  body: 'body.json',
  classes: 'classes.json',
  abilities: 'abilities.json',
  quiz: 'quiz.json',
  careers: 'careers.json',
  adolescence: 'adolescence.json',
  careerEvents: 'career-events.json',
  aging: 'aging.json',
  debts: 'debts.json',
  weapons: 'weapons.json',
  armor: 'armor.json',
  items: 'items.json',
  decks: 'decks.json',
  deckMods: 'deck-mods.json',
  optics: 'optics.json',
  economy: 'economy.json',
  lifestyle: 'lifestyle.json',
  difficulty: 'difficulty.json',
  conditions: 'conditions.json',
  icons: 'icons.json',
  refs: 'rules-ref.json',
  actions: 'actions.json',
  encounter: 'encounter.json',
  progress: 'progress.json',
  talents: 'talents.json',
  downtime: 'downtime.json',
  crew: 'crew.json',
  tours: 'tours.json',
};

let cache = null;

/** Languages with data overlays in i18n/<lang>/ (same file names as DATA_FILES, listed in its index.json). */
export const DATA_LANGS = ['it'];

/**
 * Loads every table once; with a language, its translation overlays are laid over the English text.
 * Names the GM sees stay English by convention (decision 32), so saved logs stay English too.
 */
export async function loadData({ lang = 'en', base = new URL('./', import.meta.url) } = {}) {
  if (cache) return cache;
  const getJson = async (url, optional = false) => {
    const res = await fetch(url);
    if (!res.ok) { if (optional) return null; throw new Error(`Failed to load ${url}: ${res.status}`); }
    return res.json();
  };
  // i18n/<lang>/index.json lists the overlay files that exist (no 404s for tables not translated yet)
  const listed = DATA_LANGS.includes(lang) ? (await getJson(new URL(`i18n/${lang}/index.json`, base), true).catch(() => null)) ?? [] : [];
  const entries = await Promise.all(
    Object.entries(DATA_FILES).map(async ([key, file]) => {
      const [table, overlay] = await Promise.all([
        getJson(new URL(file, base)),
        listed.includes(file) ? getJson(new URL(`i18n/${lang}/${file}`, base), true).catch(() => null) : null,
      ]);
      return [key, applyOverlay(table, overlay)];
    }),
  );
  cache = Object.freeze(Object.fromEntries(entries));
  return cache;
}
