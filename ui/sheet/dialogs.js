// Native <dialog>s: skill/attribute checks and the market.

import { html, render, delegate, cleanup } from '../dom.js';
import { segmented } from './parts.js';
import { resolveCheck } from '../../rules/checks.js';
import { roll, formatRoll, typedRoll } from '../../rules/dice.js';
import { priceOptions } from '../../rules/economy.js';
import { catalog, describe, kindLabel } from './gear.js';
import { info } from '../ref.js';
import { t } from '../../i18n/index.js';
import { ruleText } from '../rule-text.js';

export function openDialog(draw, handlers) {
  const dlg = document.createElement('dialog');
  dlg.className = 'dialog';
  document.body.append(dlg);
  const redraw = () => render(dlg, draw());
  const off = cleanup(
    delegate(dlg, 'click', { close: () => dlg.close(), ...handlers.click }),
    delegate(dlg, 'input', handlers.input ?? {}),
    delegate(dlg, 'change', handlers.change ?? {}),
  );
  dlg.addEventListener('close', () => { off(); dlg.remove(); });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); }); // backdrop
  redraw();
  dlg.showModal();
  return { redraw, close: () => dlg.close() };
}

/**
 * Check dialog. target = { name, tn, sub }. onResult(result) is called once per roll (for logging / actions).
 * Supports an app roll or entering a physical die result.
 * opts.once: only one roll (an action was spent); opts.after(result) → extra HTML under the result.
 * opts.flow: what follows a success, step by step (damage, Exploit, hit location…), each step rolled by the app
 *   or typed from physical dice: { next(answers) → step | null, summary(answers) → HTML, complete(answers) }.
 *   step = { id, title, hint?, dice?: [{ key, label, expr }], choose?: [{ value, label }], recap?(answer) → text }
 */
export function openCheck(target, data, onResult, { tier = 0, once = false, after = null, flow = null } = {}) {
  const state = { tier, result: null, manual: '', extra: '', answers: {}, typed: {}, flowError: '', finished: false };
  const flowOn = () => Boolean(flow && state.result?.success);
  const step = () => (flowOn() ? flow.next(state.answers) : null);
  const finish = () => { if (flowOn() && !step() && !state.finished) { state.finished = true; flow.complete(state.answers); } };
  const tiers = data.difficulty.tiers;
  const resolve = (value, dice = null) => {
    if (once && state.result) return;
    state.result = { ...resolveCheck(target.tn, value, state.tier, data.difficulty), dice };
    state.extra = after ? after(state.result) : '';
    onResult(state.result);
    finish();
    d.redraw();
  };
  const answer = (value) => { state.answers[step().id] = value; state.typed = {}; state.flowError = ''; finish(); d.redraw(); };
  const flowView = () => {
    if (!flowOn()) return '';
    const done = Object.entries(state.answers).map(([id, a]) => flow.recap?.(id, a)).filter(Boolean);
    const s = step();
    return html`
      ${done.length ? html`<ul class="flow-done">${done.map((x) => html`<li class="mono">${x}</li>`)}</ul>` : ''}
      ${s ? html`<div class="flow-step">
        <span class="label">${s.title}</span>
        ${s.hint ? html`<p class="hint">${s.hint}</p>` : ''}
        ${s.choose ? html`<div class="cluster">${s.choose.map((o) => html`<button class="btn ${o.primary ? 'btn--primary' : ''}" data-action="flowChoose" data-value="${o.value}">${o.label}</button>`)}</div>` : ''}
        ${s.dice ? html`
          <div class="flow-dice">${s.dice.map((g) => html`<label class="flow-dice__row"><span>${g.label} <span class="mono muted">${g.expr}</span></span>
            <input class="input input--num" type="number" inputmode="numeric" value="${state.typed[g.key] ?? ''}" data-action="flowTyped" data-key="${g.key}" aria-label="${t('flow.typedLabel', { dice: g.expr })}" placeholder="—"></label>`)}</div>
          <div class="cluster"><button class="btn btn--primary" data-action="flowRoll">${t('flow.roll')}</button>
            <button class="btn" data-action="flowEnter">${t('flow.enter')}</button><span class="hint">${t('flow.typedHint')}</span></div>
          ${state.flowError ? html`<p class="notice notice--danger">${state.flowError}</p>` : ''}` : ''}
      </div>` : flow.summary(state.answers)}`;
  };
  /** Dice step: typed totals where given, the app rolls the rest (enter = typed only). */
  const diceAnswer = (typedOnly) => {
    const s = step();
    try {
      const out = {};
      for (const g of s.dice) {
        const v = state.typed[g.key];
        if (v === undefined || v === '') {
          if (typedOnly) throw new RangeError(t('flow.missing', { dice: g.expr }));
          out[g.key] = roll(g.expr);
        } else out[g.key] = typedRoll(g.expr, v);
      }
      answer(out);
    } catch (err) {
      state.flowError = err instanceof RangeError && /: \d+–/.test(err.message) ? t('flow.outOfRange', { range: err.message }) : err.message;
      d.redraw();
    }
  };
  const draw = () => {
    const tier = tiers.find((x) => x.id === state.tier);
    const r = state.result;
    return html`
      <header class="card__head"><h2 class="card__title">${target.name}<small>${target.sub ?? ''}</small></h2><button class="btn btn--ghost btn--icon" data-action="close" aria-label="${t('common.close')}">✕</button></header>
      <div class="dialog__body stack">
        <div class="cluster cluster--gap">
          <div class="stat"><span class="label">TN</span><span class="stat__value">${target.tn}</span></div>
          <div class="stat"><span class="label">${t('check.difficulty')}</span><span class="stat__value stat__value--danger">−${tier.penalty}</span></div>
          <div class="stat"><span class="label">${t('check.rollUnder')}</span><span class="stat__value stat__value--accent">${target.tn - tier.penalty}</span></div>
        </div>
        <div class="stack stack--tight"><span class="label">${t('table.difficulty')}${info('difficulty', t('check.difficulty'))}</span>
          ${segmented('tier', tiers.map((x) => ({ value: x.id, label: `${x.name}` })), state.tier)}
          <p class="hint">${tier.example}</p></div>
        ${once && r ? '' : html`<div class="cluster">
          <button class="btn btn--primary" data-action="roll">${t('check.roll')}</button>
          <span class="muted">${t('check.physical')}</span>
          <input class="input input--num" type="number" min="1" max="20" inputmode="numeric" value="${state.manual}" data-action="manual" aria-label="${t('check.physicalLabel')}">
          <button class="btn" data-action="enter">${t('check.resolve')}</button>
        </div>`}
        ${r ? html`<div class="roll ${r.success ? 'roll--success' : 'roll--failure'}">
          <span class="roll__die">${r.roll}</span>
          <div class="stack stack--tight">
            <strong>${r.success ? t('check.success') : t('check.failure')} · ${t('check.margin')} ${r.margin >= 0 ? '+' : ''}${r.margin}</strong>
            <span class="muted">${r.natural === 'crit-success' ? t('check.nat1') : r.natural === 'crit-failure' ? t('check.nat20') : r.nearMiss ? t('check.nearMiss') : r.bigSuccess ? t('check.big') : ''}</span>
            ${r.dice ? html`<span class="mono muted">${formatRoll(r.dice)}</span>` : ''}
          </div></div>${state.extra}${flowView()}${once && (!flowOn() || state.finished) ? html`<button class="btn btn--primary btn--block" data-action="close">${t('common.done')}</button>` : ''}` : ''}
      </div>`;
  };
  const d = openDialog(draw, {
    click: {
      tier: ({ value }) => { if (once && state.result) return; state.tier = Number(value); state.result = null; d.redraw(); },
      roll: () => { const dice = roll('1d20'); resolve(dice.total, dice); },
      enter: () => { const v = Number(state.manual); if (v >= 1 && v <= 20) resolve(v); },
      flowChoose: ({ value }) => answer(value),
      flowRoll: () => diceAnswer(false),
      flowEnter: () => diceAnswer(true),
    },
    input: {
      manual: (_, e) => { state.manual = e.target.value; },
      flowTyped: ({ key }, e) => { state.typed[key] = e.target.value; },
    },
  });
}

/** A small choice (Reload / swap…): choices [{ value, label, why }] — a choice with a `why` shows disabled with it. */
export function openChoice(title, choices, onPick) {
  const d = openDialog(() => html`
    <header class="card__head"><h2 class="card__title">${title}</h2><button class="btn btn--ghost btn--icon" data-action="close" aria-label="${t('common.close')}">✕</button></header>
    <div class="dialog__body stack">${choices.map((ch) => html`
      <button class="btn btn--block ${ch.why ? '' : 'btn--primary'}" data-action="pick" data-value="${ch.value}" ${ch.why ? 'disabled' : ''}>${ch.label}</button>
      ${ch.why ? html`<p class="hint">${ch.why}</p>` : ''}`)}</div>`, {
    click: { pick: ({ value }) => { d.close(); onPick(value); } },
  });
}

/** Market dialog. free = add without paying (GM-granted gear). onBuy({kind,id,method,multiplier}) may throw. */
export function openShop({ kind = 'weapon', free = false }, character, data, onBuy) {
  const state = { kind, query: '', multiplier: data.economy.cash.defaultMultiplier, message: '', custom: { name: '', note: '', qty: 1 } };
  const kinds = free ? ['weapon', 'ammo', 'armor', 'item', 'deck', 'deckMod', 'optic', 'custom'] : ['weapon', 'ammo', 'armor', 'item', 'deck', 'deckMod', 'optic', 'lifestyle', 'custom'];
  /** + Custom (decision 55): a misc item with no price and no rules. */
  const customForm = () => html`<div class="stack">
    <p class="hint">${t('shop.customHint')}</p>
    <label class="field"><span class="label">${t('shop.customName')}</span><input class="input" maxlength="60" value="${state.custom.name}" data-action="cField" data-field="name" placeholder="${t('shop.customNamePh')}"></label>
    <label class="field"><span class="label">${t('shop.customNote')}</span><input class="input" maxlength="200" value="${state.custom.note}" data-action="cField" data-field="note"></label>
    <label class="field"><span class="label">${t('gear.qty')}</span><input class="input input--num" type="number" min="1" max="99" value="${state.custom.qty}" data-action="cField" data-field="qty"></label>
    <button class="btn btn--primary" data-action="addCustom">${t('shop.customAdd')}</button></div>`;
  const draw = () => {
    const c = character();
    const guns = new Set(c.play.inventory.filter((x) => x.kind === 'weapon').map((x) => x.id));
    const fits = (e) => state.kind === 'ammo' && guns.has(e.weaponId);
    const list = state.kind === 'custom' ? [] : catalog(state.kind, data)
      .filter((e) => !state.query || `${e.name} ${e.type ?? ''} ${e.category ?? ''} ${e.ammo ?? ''}`.toLowerCase().includes(state.query.toLowerCase()))
      .sort((a, b) => (fits(b) - fits(a)) || a.cost.cr - b.cost.cr); // ammo: magazines for your guns first
    return html`
      <header class="card__head"><h2 class="card__title">${free ? t('shop.addGear') : t('shop.market')}<small>${free ? t('shop.freeSub') : `${t('stat.cash')} $${c.play.cash} · CRS ${c.attributes.CRS}`}</small></h2>
        <button class="btn btn--ghost btn--icon" data-action="close" aria-label="${t('common.close')}">✕</button></header>
      <div class="dialog__body stack">
        <div class="tabs" role="tablist">${kinds.map((k) => html`<button class="tab" role="tab" data-action="kind" data-value="${k}" aria-selected="${k === state.kind}">${kindLabel(k)}</button>`)}</div>
        <div class="cluster cluster--gap">
          <input class="input" type="search" placeholder="${t('common.search')}…" value="${state.query}" data-action="query" aria-label="${t('common.search')}">
          ${free ? '' : html`<div class="cluster"><span class="label">${t('shop.markup')}</span>${segmented('mult', [3, 5, 7, 10].map((m) => ({ value: m, label: `×${m}` })), state.multiplier)}</div>`}
        </div>
        ${state.message ? html`<p class="notice ${state.message.startsWith('✓') ? 'notice--ok' : 'notice--danger'}">${state.message}</p>` : ''}
        ${state.kind === 'custom' ? customForm() : html`<div class="rows">
          ${list.map((e) => {
            const p = priceOptions(e, state.kind, data.economy, state.multiplier);
            return html`<div class="row row--wrap">
              <div class="row__main">
                <div class="row__title">${e.name} ${fits(e) ? html`<span class="pill pill--success">${t('shop.fits')}</span>` : ''}${e.rarity ? html`<span class="pill ${['A', 'B'].includes(e.rarity) ? 'pill--danger' : ''}">${e.rarity}</span>` : ''}${e.provisional ? html` <span class="pill">${t('shop.provisional')}</span>` : ''}</div>
                <div class="row__meta">${describe(state.kind, e, data)} · ${t('shop.list')} ${e.cost.cr} Cr${state.kind === 'lifestyle' ? `/${t('gear.month')}` : ''}</div>
              </div>
              <div class="cluster">${free ? html`<button class="btn btn--sm btn--primary" data-action="buy" data-id="${e.id}" data-method="free">${t('common.add')}</button>` : html`
                <button class="btn btn--sm" data-action="buy" data-id="${e.id}" data-method="official" ${p.official ? '' : 'disabled'} title="${p.official ? t('shop.officialHint') : t('shop.blackOnly')}">${p.official ? `${p.official.crs} CRS` : t('shop.noOfficial')}</button>
                <button class="btn btn--sm btn--primary" data-action="buy" data-id="${e.id}" data-method="cash" title="${t('shop.streetPrice', { n: p.cash.multiplier })}">$${p.cash.cash}</button>`}
              </div></div>`;
          })}
          ${list.length ? '' : html`<p class="muted">${t('common.noMatch')}</p>`}
        </div>`}
      </div>`;
  };
  const d = openDialog(draw, {
    click: {
      kind: ({ value }) => { state.kind = value; state.message = ''; d.redraw(); },
      mult: ({ value }) => { state.multiplier = Number(value); d.redraw(); },
      addCustom: () => {
        try { state.message = `✓ ${onBuy({ kind: 'custom', method: 'custom', ...state.custom })}`; state.custom = { name: '', note: '', qty: 1 }; }
        catch (err) { state.message = ruleText(err); }
        d.redraw();
      },
      buy: ({ id, method }) => {
        try { state.message = `✓ ${onBuy({ kind: state.kind, id, method, multiplier: state.multiplier })}`; }
        catch (err) { state.message = ruleText(err); }
        d.redraw();
      },
    },
    input: {
      cField: ({ field }, e) => { state.custom[field] = e.target.value; },
      query: (_, e) => {
        state.query = e.target.value;
        const pos = e.target.selectionStart;
        d.redraw();
        const el = document.querySelector('dialog [data-action="query"]');
        el?.focus(); el?.setSelectionRange(pos, pos);
      },
    },
  });
}
