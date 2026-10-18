// Interface text. t('sheet.tab.play') looks the key up in the chosen language, then English, then
// returns the key itself (so a missing string is visible but never breaks a screen).
// Strings live in app/i18n/<lang>.json (flat "area.thing" keys); tests/i18n.test.mjs keeps them in sync.
// Game terms stay English in every language (decision 32). Text saved into a character (logs) stays English.

export const LANGS = [
  { id: 'en', label: 'EN', name: 'English' },
  { id: 'it', label: 'IT', name: 'Italiano' },
];
const KEY = 'fe.lang';

let lang = 'en';
let strings = {};
let base = {};

function pick() {
  try {
    const saved = localStorage.getItem(KEY);
    if (LANGS.some((l) => l.id === saved)) return saved;
  } catch { /* storage blocked */ }
  const nav = (navigator.language || 'en').slice(0, 2).toLowerCase();
  return LANGS.some((l) => l.id === nav) ? nav : 'en';
}

const load = async (id) => (await fetch(new URL(`./${id}.json`, import.meta.url))).json();

/** Loads English plus the chosen language. Call once at boot, before the first render. force: fixed language (GM console). */
export async function loadI18n({ force = null } = {}) {
  lang = force ?? pick();
  base = await load('en');
  strings = lang === 'en' ? base : { ...base, ...(await load(lang).catch(() => ({}))) };
  document.documentElement.lang = lang;
}

export const getLang = () => lang;

/** True when English defines this key (for labels that may or may not be translatable). */
export const hasKey = (key) => key in base;

/** Switches language: remembered on this device; the page reloads (all state is saved). */
export function setLang(id) {
  try { localStorage.setItem(KEY, id); } catch { /* storage blocked */ }
  location.reload();
}

const missing = new Set(); // keys asked for but absent from English (checked by tests)

/** Tests: use these strings without fetching, and read back any key that was missing. */
export function useStrings(en, chosen = en) { base = en; strings = { ...en, ...chosen }; missing.clear(); }
export const missingKeys = () => [...missing];

/** Text for a key in the chosen language; {name} placeholders are filled from vars. */
export function t(key, vars) {
  if (!(key in base)) missing.add(key);
  const s = strings[key] ?? base[key] ?? key;
  return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : s;
}

/** Plural: uses `key.one` when n === 1, else `key.other`; {n} is filled in. */
export const tn = (key, n, vars = {}) => t(`${key}.${n === 1 ? 'one' : 'other'}`, { n, ...vars });
