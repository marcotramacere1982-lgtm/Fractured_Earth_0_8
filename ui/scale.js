// UI scale (decision 199): the whole interface grows or shrinks together — text, panels, tiles, icons, spacing — by
// changing the root font size every `rem` hangs from (the way browser zoom felt right on small screens). *Auto* picks
// from the window's height (the tight dimension on 13" laptops and 10" tablets); − / + override it in 5 % steps,
// 85–120 %, remembered per device. Touch targets keep a floor (tokens.css → --touch). One Display menu (Aa) holds the
// size and the day / night switch, in the player app and the GM console alike.

import { html } from './dom.js';
import { t } from '../i18n/index.js';
import { THEMES, setTheme, theme } from './themes.js';

const KEY = 'fe.uiScale';
export const STEPS = [0.85, 0.9, 0.95, 1, 1.05, 1.1, 1.15, 1.2];

let pref = (() => { try { const v = localStorage.getItem(KEY); return v && v !== 'auto' && STEPS.includes(Number(v)) ? Number(v) : 'auto'; } catch { return 'auto'; } })();

/** Auto: by the window's height, a little smaller again on narrow windows. */
export function autoScale(height = window.innerHeight, width = window.innerWidth) {
  const byHeight = height >= 900 ? 1 : height >= 820 ? 0.95 : height >= 740 ? 0.9 : 0.85;
  return width < 1100 ? Math.min(byHeight, 0.9) : byHeight;
}
export const currentScale = () => (pref === 'auto' ? autoScale() : pref);
const percent = () => `${Math.round(currentScale() * 100)}%`;

function apply() {
  document.documentElement.style.setProperty('--ui-scale', String(currentScale()));
  for (const el of document.querySelectorAll('[data-ui-scale-now]')) el.textContent = `${percent()}${pref === 'auto' ? ` · ${t('display.auto')}` : ''}`;
  window.dispatchEvent(new Event('resize')); // the map and the panels measure themselves again
}
function set(next) {
  pref = next;
  try { localStorage.setItem(KEY, String(next)); } catch { /* private mode: this session only */ }
  apply();
}

/** Starts the scale (once, at boot) and the Display menu's buttons, wherever the menu is drawn. */
export function installScale() {
  apply();
  let last = currentScale();
  window.addEventListener('resize', () => { if (pref === 'auto' && autoScale() !== last) { last = autoScale(); apply(); } });
  // decision 225: the theme dropdown (any copy of the menu: the header's, the Tactical view's)
  document.addEventListener('change', (e) => {
    if (!e.target.matches?.('[data-ui-theme-pick]')) return;
    setTheme(e.target.value);
    for (const x of document.querySelectorAll('[data-ui-theme-pick]')) x.value = theme();
    window.dispatchEvent(new Event('resize'));
  });
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-ui-scale]');
    if (!b) return;

    const step = b.dataset.uiScale;
    if (step === 'auto') { set('auto'); return; }
    const i = STEPS.indexOf(STEPS.reduce((best, s) => (Math.abs(s - currentScale()) < Math.abs(best - currentScale()) ? s : best), 1));
    set(STEPS[Math.max(0, Math.min(STEPS.length - 1, i + Number(step)))]);
  });
}

/**
 * The Display menu: size − / + / Auto, and the theme (decision 219). A <details>, so it opens and closes without code.
 * themes: the theme ids offered (all of them by default). Decision 225: the theme is one dropdown.
 */
export const displayMenu = ({ themes = THEMES.map((x) => x.id) } = {}) => html`<details class="display-menu" data-keep="display-menu">
  <summary class="btn btn--sm display-menu__btn" title="${t('display.title')}" aria-label="${t('display.title')}">${t('display.button')}</summary>
  <div class="display-menu__panel">
    <span class="label">${t('display.size')}</span>
    <div class="cluster display-menu__row">
      <button type="button" class="btn btn--sm" data-ui-scale="-1" aria-label="${t('display.smaller')}">A−</button>
      <span class="mono display-menu__now" data-ui-scale-now>${percent()}${pref === 'auto' ? ` · ${t('display.auto')}` : ''}</span>
      <button type="button" class="btn btn--sm" data-ui-scale="1" aria-label="${t('display.bigger')}">A+</button>
    </div>
    <button type="button" class="btn btn--sm btn--ghost" data-ui-scale="auto">${t('display.useAuto')}</button>
    <label class="field"><span class="label">${t('display.theme')}</span>
      <select class="input display-menu__select" data-ui-theme-pick aria-label="${t('display.theme')}">${themes.map((id) => html`<option value="${id}" ${theme() === id ? 'selected' : ''}>${t(`theme.${id}`)}</option>`)}</select></label>
  </div>
</details>`;
