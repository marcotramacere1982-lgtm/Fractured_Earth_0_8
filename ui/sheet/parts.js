// Small shared view fragments for the sheet.

import { html, raw } from '../dom.js';
import { info } from '../ref.js';
import { t } from '../../i18n/index.js';

/** − value + counter. Extra args become data-* attributes on both buttons. */
export function counter({ action, value, args = {}, min = null, max = null, label = '', size = '' }) {
  const attrs = raw(Object.entries(args).map(([k, v]) => `data-${k}="${String(v).replace(/"/g, '&quot;')}"`).join(' '));
  return html`
    <span class="counter ${size ? `counter--${size}` : ''}" role="group" aria-label="${label}">
      <button class="counter__btn" data-action="${action}" data-delta="-1" ${attrs} ${min !== null && value <= min ? raw('disabled') : ''} aria-label="${t('common.decrease', { name: label })}">−</button>
      <span class="counter__value">${value}</span>
      <button class="counter__btn" data-action="${action}" data-delta="1" ${attrs} ${max !== null && value >= max ? raw('disabled') : ''} aria-label="${t('common.increase', { name: label })}">+</button>
    </span>`;
}

/**
 * Tappable pip track. kind 'hp' (red, can go up and down) or 'armor' (blue, can only be knocked off).
 * Tapping pip n sets the value to n; tapping the top filled pip removes it.
 * For armor, pips above the current value are shown as lost and are not tappable.
 */
/** restorable: lost armor marks can be tapped back (GM console); players restore them with Repair armor. */
export function pips({ kind, value, max, args, label, restorable = false }) {
  const attrs = raw(Object.entries(args).map(([k, v]) => `data-${k}="${v}"`).join(' '));
  if (max <= 0) return html`<span class="pips pips--empty">${kind === 'armor' ? t('pips.noArmor') : '—'}</span>`;
  return html`<span class="pips pips--${kind}" role="group" aria-label="${label} ${value}/${max}">
    ${Array.from({ length: max }, (_, i) => {
      const n = i + 1;
      const filled = n <= value;
      const target = n === value ? n - 1 : n;
      const lost = kind === 'armor' && !filled && !restorable;
      return html`<button class="pip ${filled ? 'is-filled' : lost ? 'is-lost' : ''}" data-action="pip" data-value="${target}" ${attrs}
        ${lost ? raw('disabled') : ''} aria-label="${label}: ${t('pips.setTo', { n: target })}" title="${lost ? t('pips.destroyed') : t('pips.setTo', { n: target })}"></button>`;
    })}
  </span>`;
}

export function meter(value, max, kind = '') {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return html`<div class="meter" role="meter" aria-valuenow="${value}" aria-valuemin="0" aria-valuemax="${max}"><div class="meter__fill ${kind ? `meter__fill--${kind}` : ''}" style="width: ${pct}%"></div></div>`;
}

export function card(title, body, { sub = '', actions = '', flush = false, id = '', ref = '' } = {}) {
  return html`
    <section class="card" ${id ? raw(`id="${id}"`) : ''}>
      <header class="card__head"><h2 class="card__title">${title}${sub ? html`<small>${sub}</small>` : ''}${ref ? info(ref, title) : ''}</h2>${actions}</header>
      <div class="card__body ${flush ? 'card__body--flush' : ''}">${body}</div>
    </section>`;
}

export function segmented(action, options, current, extra = {}) {
  const attrs = raw(Object.entries(extra).map(([k, v]) => `data-${k}="${v}"`).join(' '));
  return html`<div class="segmented" role="group">
    ${options.map((o) => html`<button class="segmented__opt" data-action="${action}" data-value="${o.value}" ${attrs} aria-pressed="${String(o.value) === String(current)}">${o.label}</button>`)}
  </div>`;
}

export const nameOf = (list, id) => list.find((x) => x.id === id)?.name ?? id;
