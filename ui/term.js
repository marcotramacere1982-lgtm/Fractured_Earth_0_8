// Game terms on screen. Decision 242: skills and conditions keep their English name (`nameEn`, data/index.js).
// Decision 349 (owner, 2026-11-18): Italian reads as Italian — the English term is one tap away. A game word in running
// text is a `gloss`: dotted underline; a tap (a hover with a mouse) opens the shared popover (ui/ref.js) with the word,
// its English name in another language, the glossary's one line and a link to the manual. Per device, the Display menu's
// *Game terms*: on tap (default) · English beside · plain — set on <html data-terms>, so CSS does the rest (no redraw).
// Text strings mark a term with [[id]] or [[id|the words shown]] (tg()).

import { html, raw, escape } from './dom.js';
import { t } from '../i18n/index.js';

const KEY = 'fe.terms';
export const TERM_MODES = ['tap', 'beside', 'off'];
let chosen = null; // this visit's choice, when the browser keeps nothing (private mode)
export const termMode = () => { if (chosen) return chosen; try { const v = localStorage.getItem(KEY); return TERM_MODES.includes(v) ? v : 'tap'; } catch { return 'tap'; } };
const applyMode = () => { if (typeof document !== 'undefined') document.documentElement.dataset.terms = termMode(); };

let glossary = new Map();
/** The glossary (data.glossary), once at start. */
export function useGlossary(g) { glossary = new Map((g?.terms ?? []).map((x) => [x.id, x])); }
/** One glossary entry (the popover reads it). */
export const glossEntry = (id) => glossary.get(id) ?? null;

const en = (g) => (g?.nameEn && g.nameEn !== g.name ? g.nameEn : '');
/** The span for a term, as an HTML string; label: already escaped. */
const glossHtml = (id, label) => {
  const g = glossary.get(id);
  if (!g) return label;
  return `<span class="gloss" data-gloss="${escape(id)}" tabindex="0">${label}${en(g) ? `<span class="term-en">${escape(en(g))}</span>` : ''}</span>`;
};

/** A game word in a template: gloss('scene'), or gloss('scene', 'scenes') to show other words. */
export const gloss = (id, label) => raw(glossHtml(id, escape(label ?? glossary.get(id)?.name ?? id)));

/** t() with its [[id]] / [[id|words]] marks turned into glossary words. */
export function tg(key, vars) {
  return raw(escape(t(key, vars)).replace(/\[\[([a-z0-9_]+)(?:\|([^\]]+))?\]\]/g, (_, id, words) => glossHtml(id, words ?? escape(glossary.get(id)?.name ?? id))));
}
/** The same marks dropped, for plain text (titles, aria labels). */
export const plain = (s) => String(s ?? '').replace(/\[\[([a-z0-9_]+)(?:\|([^\]]+))?\]\]/g, (_, id, words) => words ?? glossary.get(id)?.name ?? id);

/** A record's English name as a small aside — shown only with *English beside* (CSS); '' in English. */
export const enTerm = (rec) => (rec?.nameEn && rec.nameEn !== rec.name ? html`<span class="term-en">${rec.nameEn}</span>` : '');
/** "Furtività · Stealth" as plain text (titles, tooltips); just the name in English. */
export const bothNames = (rec) => (rec?.nameEn && rec.nameEn !== rec.name ? `${rec.name} · ${rec.nameEn}` : rec?.name ?? '');

/** The Display menu's row (player app). */
export const termsRow = () => html`<label class="field"><span class="label">${t('display.terms')}</span>
  <select class="input display-menu__select" data-ui-terms aria-label="${t('display.terms')}">${TERM_MODES.map((m) => html`<option value="${m}" ${termMode() === m ? 'selected' : ''}>${t(`display.terms.${m}`)}</option>`)}</select></label>`;

/** Once at start: the page knows the mode, and the menu changes it. */
export function installTerms() {
  applyMode();
  document.addEventListener('change', (e) => {
    if (!e.target.matches?.('[data-ui-terms]')) return;
    chosen = TERM_MODES.includes(e.target.value) ? e.target.value : 'tap';
    try { localStorage.setItem(KEY, chosen); } catch { /* private mode: this visit only */ }
    applyMode();
  });
}
