// Side bookmarks (decision 190): the panels around a map live in two rails of bookmarks, left and right. Tap a
// bookmark and its panel slides over the map's edge, the column's full height; tap it again (or ✕) to fold it.
// One open panel per side, so nothing is squeezed: the map keeps its size and never re-fits. Screens can open or
// close panels when something happens (combat starts, your turn, a piece selected): railOpen / railClose.
// Every panel is drawn, only the open one shows, so a tap just flips classes — no re-render, no lost scroll.
// The open panels are remembered per device.

import { html, raw } from './dom.js';
import { t } from '../i18n/index.js';

const KEY = 'fe.rails';
let state = {};
try { state = JSON.parse(localStorage.getItem(KEY) ?? '{}') ?? {}; } catch { state = {}; }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode: this session only */ } };

/** The panel open on one side of a layout, or null. */
export const railOf = (layout, side) => state[`${layout}:${side}`] ?? null;

/** Opens a panel (and folds the other one on its side); a screen calls it when something happens. */
export function railOpen(layout, side, id) {
  state[`${layout}:${side}`] = id;
  save();
  sync(layout);
}
export function railClose(layout, side) {
  delete state[`${layout}:${side}`];
  save();
  sync(layout);
}

/** Brings the drawing on screen in line with the state (after a tap, or railOpen from code). */
function sync(layout) {
  for (const root of document.querySelectorAll(`[data-rails="${layout}"]`)) {
    for (const side of ['left', 'right']) {
      const open = railOf(layout, side);
      const known = root.querySelector(`.rails__drawer--${side} [data-rail-panel="${open}"]`);
      root.querySelector(`.rails__drawer--${side}`)?.classList.toggle('is-open', Boolean(known));
      root.querySelectorAll(`.rails__drawer--${side} [data-rail-panel]`).forEach((p) => { p.hidden = p.dataset.railPanel !== open; });
      root.querySelectorAll(`.rails__tabs--${side} [data-rail-tab]`).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.railTab === open)));
    }
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('click', (e) => {
    const tab = e.target.closest('[data-rail-tab]');
    const shut = e.target.closest('[data-rail-close]');
    const root = (tab ?? shut)?.closest('[data-rails]');
    if (!root) return;
    const { rails: layout } = root.dataset;
    const side = (tab ?? shut).dataset.side;
    if (shut || railOf(layout, side) === tab.dataset.railTab) railClose(layout, side);
    else railOpen(layout, side, tab.dataset.railTab);
  });
}

/**
 * A map with rails. panels: [{ id, icon (an emoji or an <svg> string), label, body, badge? }] per side; main: the map.
 * @param {string} layout  one name per screen (e.g. 'tac', 'deploy', 'builder'): the open panels are kept under it
 */
export function railLayout(layout, { left = [], right = [], main, className = '' }) {
  const tabs = (side, list) => html`<nav class="rails__tabs rails__tabs--${side}" aria-label="${t(side === 'left' ? 'rails.left' : 'rails.right')}">
    ${list.map((p) => html`<button type="button" class="rails__tab" data-rail-tab="${p.id}" data-side="${side}" aria-pressed="${railOf(layout, side) === p.id}" title="${p.label}">
      <span class="rails__icon" aria-hidden="true">${p.icon.startsWith('<') ? raw(p.icon) : p.icon}</span><span class="rails__label">${p.label}</span>${p.badge ? html`<span class="rails__badge">${p.badge}</span>` : ''}</button>`)}</nav>`;
  const drawer = (side, list) => {
    const open = list.some((p) => p.id === railOf(layout, side)) ? railOf(layout, side) : null;
    return html`<aside class="rails__drawer rails__drawer--${side} ${open ? 'is-open' : ''}">
      ${list.map((p) => html`<section class="rails__panel" data-rail-panel="${p.id}" ${p.id === open ? '' : raw('hidden')} aria-label="${p.label}">
        <header class="rails__head"><h3 class="rails__title">${p.label}</h3><button type="button" class="btn btn--sm btn--ghost rails__close" data-rail-close data-side="${side}" aria-label="${t('rails.close')}">✕</button></header>
        <div class="rails__body">${p.body}</div></section>`)}</aside>`;
  };
  return html`<div class="rails ${className}" data-rails="${layout}">
    ${left.length ? tabs('left', left) : ''}
    <div class="rails__stage">${main}${left.length ? drawer('left', left) : ''}${right.length ? drawer('right', right) : ''}</div>
    ${right.length ? tabs('right', right) : ''}
  </div>`;
}
