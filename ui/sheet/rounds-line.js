// Decision 365: exploration rounds on the sheet's Map tab — the round, your plan (change it until the GM resolves),
// the crew's plans, and "something else" in a few words. Moves and doors are planned the usual way: drag, tap a door.

import { html } from '../dom.js';
import { t } from '../../i18n/index.js';
import { openDialog } from './dialogs.js';
import { OTHER_MAX } from '../../rules/rounds.js';
import { PACES } from '../../rules/stealth.js'; // decision 367

const words = (p) => (p.kind === 'move' ? t('rounds.plan.move', { col: p.to.x + 1, row: p.to.y + 1 })
  : p.kind === 'door' ? t(p.open ? 'rounds.plan.doorOpen' : 'rounds.plan.doorClose') : p.kind === 'device' ? t('rounds.plan.device') : p.text);

export function roundsLine(map, id) {
  const r = map?.rounds;
  if (!r) return '';
  const mine = r.plans?.[id];
  const pace = r.pace?.[id] === 'move' ? 'move' : 'sneak'; // decision 367
  const shadow = r.shadow?.[id] ?? 0;
  const waiting = (r.waiting ?? []).includes(id);
  const spotted = (r.spots?.[id] ?? []).map((k) => (map.tokens ?? []).find((tk) => tk.key === k)?.label).filter(Boolean); // decision 368: only those on your map
  const crew = (map.tokens ?? []).filter((tk) => tk.kind === 'player' && tk.key !== id);
  const head = r.phase === 'world' ? t('rounds.world', { n: r.n + 1 }) : t('rounds.planning', { n: r.n });
  return html`<div class="map-ctx rounds-line" data-tour="map-rounds">
    <strong>🧭 ${head}</strong>
    <span class="cluster" role="group" aria-label="${t('rounds.pace')}">${PACES.map((p) => html`<button class="btn btn--sm ${pace === p ? 'btn--primary' : 'btn--ghost'}" data-action="roundsPace" data-pace="${p}" aria-pressed="${pace === p}" title="${t(`rounds.paceHint.${p}`)}">${p === 'sneak' ? '🤫' : '🏃'} ${t(`rounds.paceName.${p}`)}</button>`)}</span>
    ${shadow ? html`<span class="pill" title="${t('rounds.shadowHint')}">🌑 ${t('rounds.shadow', { n: shadow })}</span>` : ''}
    <span>${waiting ? html`<strong class="text-warning">${t('rounds.waiting')}</strong>` : mine ? html`${t('rounds.yours')}: <strong>${words(mine)}</strong>` : html`<span class="muted">${t('rounds.none')}</span>`}</span>
    <span class="cluster"><button class="btn btn--sm" data-action="roundsOther">✎ ${t('rounds.other')}</button>
      ${mine ? html`<button class="btn btn--sm btn--ghost" data-action="roundsClear">✕ ${t('rounds.clear')}</button>` : ''}</span>
    ${spotted.length ? html`<strong class="text-success">👁 ${t('rounds.spot', { who: spotted.join(', ') })}</strong>` : ''}
    ${crew.length ? html`<span class="muted st-small">${crew.map((tk) => `${tk.name ?? tk.label}: ${r.plans?.[tk.key] ? words(r.plans[tk.key]) : '…'}`).join(' · ')}</span>` : ''}
  </div>`;
}

/** "Something else": a few words for the GM (search the desk, keep watch, hack the panel…). */
export function openPlanOther(send) {
  const d = openDialog(() => html`<header class="card__head"><h2 class="card__title">${t('rounds.other')}</h2>
      <button class="btn btn--ghost btn--icon" data-action="close" aria-label="${t('common.close')}">✕</button></header>
    <div class="dialog__body stack"><p class="hint">${t('rounds.otherHint')}</p>
      <input class="input" type="text" maxlength="${OTHER_MAX}" data-plan-text autofocus placeholder="${t('rounds.otherPlaceholder')}">
      <div class="cluster"><button class="btn btn--primary" data-action="planOk">${t('rounds.otherOk')}</button></div></div>`, {
    click: { planOk: () => { const text = d.el.querySelector('[data-plan-text]')?.value.trim(); if (text) send(text); d.close(); } },
  });
  d.el.querySelector('[data-plan-text]')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); d.el.querySelector('[data-action="planOk"]')?.click(); } });
}
