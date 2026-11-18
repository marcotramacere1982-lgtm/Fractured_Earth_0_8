// Found loot as a window (decision 320): when the GM opens a container or a story point, the players there get a
// window with what's in it — each thing with its note, Take or Give… (take it and hand it to someone), all the cash,
// Take all — instead of a stash to dig out of Sheet → Inventory → Stashes. The loot is still the crew's shared
// stash (the table server checks every take, so two players can't take the same thing); what's left stays there.

import { html } from '../dom.js';
import { openDialog } from './dialogs.js';
import { iconFor } from '../gear-icon.js';
import { findGear } from '../../rules/economy.js';
import { withUniques } from '../../rules/uniques.js';
import { t } from '../../i18n/index.js';

/** found: { stash, name } · ctx: { table, character(), data, run, toast, give(kind, id) } → the dialog (redraw() on table changes). */
export function openLootWindow(found, ctx) {
  const stashNow = () => (ctx.table?.state.stashes ?? []).find((s) => s.id === found.stash) ?? null;
  const entryOf = (r) => (r.kind === 'custom' ? r : r.unique ? { ...r.unique } : findGear(r.kind, r.id, withUniques(ctx.data, ctx.character())));
  const nameOf = (r) => (r.kind === 'custom' ? r.name : r.unique?.name ?? entryOf(r)?.name ?? r.id);
  const inFight = () => { if (!ctx.character().play.turn?.inCombat) return false; ctx.toast(t('rule.stashCombat'), 'danger'); return true; };
  const ask = async (op) => {
    const res = await ctx.table.stash(op);
    if (!res.ok) ctx.toast(t(`crewStash.why.${res.why}`), 'danger');
    return res.ok ? res : null;
  };
  async function take(kind, id) {
    const r = stashNow()?.items.find((x) => x.kind === kind && x.id === id);
    const res = await ask({ op: 'take', stash: found.stash, kind, id, label: r ? nameOf(r) : '' });
    if (res) ctx.run('crewTake', { unit: res.unit, stash: res.stash });
    return res;
  }

  const d = openDialog(() => {
    const s = stashNow();
    const items = s?.items ?? [];
    const empty = !s || (!items.length && !s.cash);
    return html`<header class="card__head"><h2 class="card__title">🔍 ${t('loot.title', { name: found.name || s?.name || '' })}</h2>
        <button class="btn btn--ghost btn--icon" data-action="close" aria-label="${t('common.close')}">✕</button></header>
      <div class="dialog__body stack">
        ${empty ? html`<p class="muted">${t('loot.empty')}</p>` : html`
          <div class="rows">${items.map((r) => html`<div class="row row--wrap">
            ${iconFor(r.kind, entryOf(r), ctx.data, 'gi--row')}
            <div class="row__main"><div class="row__title">${nameOf(r)}${r.qty > 1 ? html` <span class="mono">×${r.qty}</span>` : ''}</div>
              ${r.note ? html`<div class="row__meta loot-note">“${r.note}”</div>` : ''}</div>
            <span class="cluster"><button class="btn btn--sm btn--primary" data-action="lootTake" data-kind="${r.kind}" data-id="${r.id}">${t('loot.take')}</button>
              <button class="btn btn--sm" data-action="lootGive" data-kind="${r.kind}" data-id="${r.id}" title="${t('loot.giveHint')}">${t('loot.give')}</button></span>
          </div>`)}</div>
          ${s.cash ? html`<div class="spread"><span>💵 <strong class="mono">$${s.cash}</strong></span><button class="btn btn--sm btn--primary" data-action="lootCash">${t('loot.takeCash')}</button></div>` : ''}
          <div class="cluster"><button class="btn" data-action="lootAll">${t('loot.takeAll')}</button></div>
          <p class="hint">${t('loot.hint')}</p>`}
        <button class="btn btn--block" data-action="close">${t('common.done')}</button>
      </div>`;
  }, {
    click: {
      lootTake: async ({ kind, id }) => { if (!inFight()) { await take(kind, id); d.redraw(); } },
      lootGive: async ({ kind, id }) => {
        if (inFight()) return;
        const res = await take(kind, id);
        d.redraw();
        if (res) ctx.give(res.unit.kind, res.unit.id); // the usual give window (who, sell, trade)
      },
      lootCash: async () => {
        const s = stashNow();
        if (!s?.cash || inFight()) return;
        const res = await ask({ op: 'takeCash', stash: found.stash, amount: s.cash });
        if (res) ctx.run('crewCash', { amount: s.cash, dir: 'take', stash: res.stash });
        d.redraw();
      },
      lootAll: async () => {
        if (inFight()) return;
        for (;;) { // one at a time: the server checks each
          const r = stashNow()?.items[0];
          if (!r || !(await take(r.kind, r.id))) break;
        }
        const s = stashNow();
        if (s?.cash) { const res = await ask({ op: 'takeCash', stash: found.stash, amount: s.cash }); if (res) ctx.run('crewCash', { amount: s.cash, dir: 'take', stash: res.stash }); }
        d.redraw();
      },
    },
  });
  return d;
}
