// The Stashes card on the Gear tab: your own stash (decision 144) and the crew's (decision 145) in one card,
// each folded to one line (name · cash · items) until tapped. Crew stashes come from the table server.

import { html } from '../dom.js';
import { card } from './parts.js';
import { info } from '../ref.js';
import { findGear } from '../../rules/economy.js';
import { t } from '../../i18n/index.js';

const rowName = (r, data) => (r.kind === 'custom' ? r.name : r.unique?.name ?? findGear(r.kind, r.id, data)?.name ?? r.id);
const count = (items) => items.reduce((n, r) => n + r.qty, 0);
const historyLine = (h) => t(`crewStash.h.${h.op}`, { who: h.by === 'GM' ? t('crewStash.gm') : h.by, what: h.what ?? '', amount: h.amount ?? 0 });
const when = (ms) => new Date(ms).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** One stash, folded: the summary line, then cash in / out and the items with Take. crew: the stash's id, or '' for your own. */
function section(s, data, { key, icon, off, crew = '' }) {
  const cash = crew ? 'crewCash' : 'stashCash';
  const take = crew ? 'crewTake' : 'stashTake';
  return html`<details class="details stash" data-keep="${key}">
    <summary class="stash__summary"><span>${icon} <strong>${s.name || t('stash.title')}</strong></span>
      <span class="mono muted">$${s.cash} · ${t('stash.items', { n: count(s.items) })}</span></summary>
    <div class="stack stash__body">
      <div class="cluster stash-cash">
        <input class="input input--num" type="number" min="1" step="1" inputmode="numeric" aria-label="${t('stash.amount')}" placeholder="$" ${off}>
        <button class="btn btn--sm" data-action="${cash}" data-stash="${crew}" data-dir="put" ${off}>${t('stash.putCash')}</button>
        <button class="btn btn--sm" data-action="${cash}" data-stash="${crew}" data-dir="take" ${off}>${t('stash.takeCash')}</button>
      </div>
      ${s.items.length ? html`<div class="rows">${s.items.map((r) => html`<div class="row">
        <div class="row__main"><div class="row__title">${rowName(r, data)}${r.qty > 1 ? html` <span class="mono">×${r.qty}</span>` : ''}${r.official ? html` <span class="pill pill--info">${t('gear.registered', { n: r.official })}</span>` : ''}</div></div>
        <button class="btn btn--sm" data-action="${take}" data-stash="${crew}" data-kind="${r.kind}" data-id="${r.id}" ${off}>${t('stash.take')}</button>
      </div>`)}</div>` : html`<p class="muted">${t('stash.empty')}</p>`}
      ${s.locked ? html`<p class="hint">${t('crewStash.lockedHint')}</p>` : ''}
      ${s.history?.length ? html`<details class="details" data-keep="${key}-history"><summary class="label">${t('crewStash.history')}</summary>
        <ul class="st-small">${s.history.map((h) => html`<li><span class="mono muted">${when(h.t)}</span> ${historyLine(h)}</li>`)}</ul></details>` : ''}
    </div>
  </details>`;
}

/** crew: the sticky list from the table, or null when this sheet isn't at the table. */
export function stashesCard(c, data, crew) {
  const mine = c.play.stash ?? { name: '', cash: 0, items: [] };
  const fight = Boolean(c.play.turn?.inCombat);
  return card(t('stash.cardTitle'), html`<div class="stack">
    ${mine.name ? '' : html`<label class="field"><span class="label">${t('stash.name')}</span>
      <input class="input" type="text" maxlength="40" placeholder="${t('stash.namePlaceholder')}" data-action="stashName"></label>`}
    <div class="stash__own">${section(mine, data, { key: 'stash-own', icon: '📦', off: fight ? 'disabled' : '' })}
      ${mine.name ? html`<button class="btn btn--sm btn--ghost btn--icon" data-action="stashRename" title="${t('stash.rename')}" aria-label="${t('stash.rename')}">✎</button>` : ''}</div>
    ${crew?.length ? html`<h3 class="label">${t('crewStash.title')}${info('crewStash', t('crewStash.title'))}</h3>
      ${crew.map((s) => section(s, data, { key: `stash-${s.id}`, icon: s.locked ? '🔒' : '👥', off: fight || s.locked ? 'disabled' : '', crew: s.id }))}` : ''}
    ${fight ? html`<p class="hint">${t('stash.combat')}</p>` : ''}
  </div>`, { sub: t('stash.cardSub'), ref: 'stash' });
}
