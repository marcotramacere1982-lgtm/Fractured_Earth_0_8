// The Use item flow (decision 58): pick the item → its option → on me / on an ally → the heal dice (rolled or
// typed) → done. Each step is a small window; the rules live in rules/items.js and item-actions.js.

import { html } from '../dom.js';
import { openDialog, openChoice } from './dialogs.js';
import { usableItems } from '../../rules/items.js';
import { roll, typedRoll, formatRoll } from '../../rules/dice.js';
import { t } from '../../i18n/index.js';

/** Rolls or takes typed dice for one expression; onDone(rollObject). */
function openDice(title, expr, onDone) {
  const state = { typed: '', error: '' };
  const d = openDialog(() => html`
    <header class="card__head"><h2 class="card__title">${title}</h2><button class="btn btn--ghost btn--icon" data-action="close" aria-label="${t('common.close')}">✕</button></header>
    <div class="dialog__body stack">
      <label class="flow-dice__row"><span class="mono">${expr}</span>
        <input class="input input--num" type="number" inputmode="numeric" value="${state.typed}" data-action="typed" aria-label="${t('flow.typedLabel', { dice: expr })}" placeholder="—"></label>
      <div class="cluster"><button class="btn btn--primary" data-action="roll">${t('flow.roll')}</button><button class="btn" data-action="enter">${t('flow.enter')}</button><span class="hint">${t('flow.typedHint')}</span></div>
      ${state.error ? html`<p class="notice notice--danger">${state.error}</p>` : ''}
    </div>`, {
    click: {
      roll: () => { d.close(); onDone(roll(expr)); },
      enter: () => {
        try { const r = typedRoll(expr, state.typed); d.close(); onDone(r); } catch (e) { state.error = t('flow.outOfRange', { range: e.message }); d.redraw(); }
      },
    },
    input: { typed: (_, e) => { state.typed = e.target.value; } },
  });
}

/** A result to read out (using an item on an ally: they enter it on their own sheet). */
function openResult(title, text) {
  const d = openDialog(() => html`
    <header class="card__head"><h2 class="card__title">${title}</h2></header>
    <div class="dialog__body stack"><p class="roll-extra">${text}</p><p class="hint">${t('use.tellThem')}</p>
      <button class="btn btn--primary btn--block" data-action="close">${t('common.done')}</button></div>`, { click: {} });
  return d;
}

/**
 * ctx: { character(), data, run(name, args) → result, onlyId? (start from one item: the inventory's Use button),
 *        onUsed?(item) — after it was used (a flare drops a light on the table map) }
 */
export function startUseItem({ character, data, run, onlyId = null, onUsed = null }) {
  const c = character();
  const list = usableItems(c.play.inventory, data.items).filter((x) => !onlyId || x.item.id === onlyId);
  if (!list.length) { openResult(t('action.use_item'), t('use.nothing')); return; }

  const finish = (item, opt, target, limb) => {
    const go = (healRoll) => {
      const text = run('useItem', { id: item.id, option: opt.id, target, limb, heal: healRoll?.total ?? null, healText: healRoll ? formatRoll(healRoll) : '' });
      if (text != null) onUsed?.(item);
      if (text && target === 'ally') openResult(item.name, text);
    };
    if (opt.heal) openDice(`${item.name} · ${t('use.heal')}`, opt.heal, go); else go(null);
  };
  const pickLimb = (item, opt, target) => {
    const injuries = character().play.injuries ?? [];
    if (target !== 'self' || opt.treatLimb !== 1 || injuries.length < 2) { finish(item, opt, target, injuries[0] ?? null); return; }
    openChoice(t('use.whichLimb'), injuries.map((id) => ({ value: id, label: data.body.locations.find((l) => l.id === id)?.name ?? id })), (limb) => finish(item, opt, target, limb));
  };
  const pickTarget = (item, opt) => {
    if (!item.use.ally || opt.table) { pickLimb(item, opt, 'self'); return; }
    openChoice(item.name, [{ value: 'self', label: t('use.onMe') }, { value: 'ally', label: t('use.onAlly') }], (target) => pickLimb(item, opt, target));
  };
  const pickOption = (item) => {
    const opts = item.use.options;
    if (opts.length === 1) { pickTarget(item, opts[0]); return; }
    openChoice(item.name, opts.map((o) => ({ value: o.id, label: o.text })), (v) => pickTarget(item, opts.find((o) => o.id === v)));
  };
  if (list.length === 1) { pickOption(list[0].item); return; }
  openChoice(t('action.use_item'), list.map(({ row, item }) => ({ value: item.id, label: `${item.name} ×${row.qty}`, sub: item.use.options.map((o) => o.text).join(' · ') })),
    (id) => pickOption(list.find((x) => x.item.id === id).item));
}
