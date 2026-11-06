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
  builder: 'builder.json', // decision 169: the builder's optional pictures
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
  weaponMods: 'weapon-mods.json', // decision 173
  kits: 'kits.json', // decision 183: starter kits
  intel: 'intel.json', // decision 197: what characters know about enemy types
  drones: 'drones.json', // decision 172: the Tech Wizard's drone
  droneMods: 'drone-mods.json',
  optics: 'optics.json',
  economy: 'economy.json',
  lifestyle: 'lifestyle.json',
  difficulty: 'difficulty.json',
  conditions: 'conditions.json',
  icons: 'icons.json',
  gearIcons: 'gear-icons.json', // decision 222: inventory icons (which silhouette for which gear)
  uiIcons: 'ui-icons.json', // decision 229: the detailed icons that replace line ones in icons.json
  environment: 'environment.json', // decision 237: the table environment's weather and hazards
  refs: 'rules-ref.json',
  actions: 'actions.json',
  encounter: 'encounter.json',
  progress: 'progress.json',
  talents: 'talents.json',
  downtime: 'downtime.json',
  crew: 'crew.json',
  strain: 'strain.json', // decision 266
  chase: 'chase.json', // decision 275
  tours: 'tours.json',
  map: 'map.json',
  props: 'props.json',
  collection: 'collection.json',
};

let cache = null;

/** Languages with data overlays in i18n/<lang>/ (same file names as DATA_FILES, listed in its index.json). */
export const DATA_LANGS = ['it'];

/**
 * Loads every table once; with a language, its translation overlays are laid over the English text.
 * Names the GM sees stay English by convention (decision 32), so saved logs stay English too.
 */
/**
 * Decision 242: skills and conditions show an Italian name with the English one beside it; the English stays on each
 * record as `nameEn` — what the sheet's log, the table and the GM use (`nameEn(rec)`).
 */
const BILINGUAL = { skills: (t) => t.skills, conditions: (t) => t };
function keepEnglishNames(key, base, out) {
  if (!BILINGUAL[key]) return out;
  const en = new Map(BILINGUAL[key](base).map((r) => [r.id, r.name]));
  const add = (list) => list.map((r) => ({ ...r, nameEn: en.get(r.id) ?? r.name }));
  return key === 'skills' ? { ...out, skills: add(out.skills) } : add(out);
}
/** A skill's or condition's English name (what logs and the table use), whatever the language on screen. */
export const nameEn = (rec) => rec?.nameEn ?? rec?.name ?? '';

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
      return [key, keepEnglishNames(key, table, applyOverlay(table, overlay))];
    }),
  );
  const tables = Object.fromEntries(entries);
  // decision 229: an id in ui-icons.json draws from the detailed sprite instead of its line drawing in icons.json
  const sprite = new URL('../images/ui-icons.svg', import.meta.url).href;
  tables.icons = { ...tables.icons, ...Object.fromEntries(Object.keys(tables.uiIcons.sources).map((id) => [id, `<svg viewBox="0 0 512 512" fill="currentColor" focusable="false"><use href="${sprite}#ui-${id}"/></svg>`])) };
  cache = Object.freeze(tables);
  return cache;
}
