// Trade window for one inventory item (decision 55): sell it (half the list price; custom items: type an
// amount) or hand it to another player at the table (a durable gift; an Interact action in combat).

import { html } from '../dom.js';
import { openDialog } from './dialogs.js';
import { t } from '../../i18n/index.js';
import { ruleText } from '../rule-text.js';

/**
 * item: { name, price: number | null (custom: typed) }. players(): Promise<[{ id, name, online }]> (others only),
 * or null when not at a table. onSell(price) / onGift(player) may throw (shown) or return a confirmation.
 */
export function openTrade(item, { players = null, inCombat = false, onSell, onGift }) {
  const state = { price: item.price ?? '', list: null, message: '', done: false };
  const draw = () => html`
    <header class="card__head"><h2 class="card__title">${t('trade.title')}<small>${item.name}</small></h2>
      <button class="btn btn--ghost btn--icon" data-action="close" aria-label="${t('common.close')}">✕</button></header>
    <div class="dialog__body stack">
      ${state.message ? html`<p class="notice ${state.done ? 'notice--ok' : 'notice--danger'}">${state.message}</p>` : ''}
      ${state.done ? html`<button class="btn btn--primary btn--block" data-action="close">${t('common.done')}</button>` : html`
      <section class="stack stack--tight">
        <span class="label">${t('trade.sell')}</span>
        ${item.price == null ? html`<div class="cluster"><span class="muted">$</span>
          <input class="input input--num" type="number" min="0" inputmode="numeric" value="${state.price}" data-action="tPrice" aria-label="${t('trade.price')}">
          <button class="btn" data-action="tSell">${t('trade.sellBtn')}</button></div>
          <p class="hint">${t('trade.customPrice')}</p>`
        : html`<button class="btn" data-action="tSell">${t('trade.sellFor', { n: item.price })}</button><p class="hint">${t(item.registered ? 'trade.quarterPrice' : 'trade.halfPrice')}</p>`}
      </section>
      <section class="stack stack--tight">
        <span class="label">${t('trade.gift')}</span>
        ${!players ? html`<p class="hint">${t('trade.needTable')}</p>`
          : state.list === null ? html`<p class="muted">${t('trade.loading')}</p>`
          : state.list.length ? html`<div class="cluster">${state.list.map((p) => html`<button class="btn" data-action="tGift" data-id="${p.id}">${p.name}${p.online ? '' : html` <span class="muted">(${t('trade.offline')})</span>`}</button>`)}</div>
            <p class="hint">${t(inCombat ? 'trade.giftCombat' : 'trade.giftHint')}</p>`
          : html`<p class="hint">${t('trade.nobody')}</p>`}
      </section>`}
    </div>`;
  const act = async (fn) => {
    try { state.message = await fn(); state.done = true; } catch (err) { state.message = ruleText(err); }
    d.redraw();
  };
  const d = openDialog(draw, {
    click: {
      tSell: () => act(() => onSell(Number(state.price) || 0)),
      tGift: ({ id }) => act(() => onGift(state.list.find((p) => p.id === id))),
    },
    input: { tPrice: (_, e) => { state.price = e.target.value; } },
  });
  if (players) players().then((list) => { state.list = list; d.redraw(); });
}
