// Native <dialog>s: skill/attribute checks and the market.

import { html, raw, render, delegate, cleanup, signed } from '../dom.js';
import { segmented } from './parts.js';
import { resolveCheck } from '../../rules/checks.js';
import { roll, formatRoll, typedRoll } from '../../rules/dice.js';
import { priceOptions, findGear, magazineId, creditScoreCost, lifestyleSlot } from '../../rules/economy.js';
import { catalog, describe, kindLabel } from './gear.js';
import { marketGroups } from './market-groups.js';
import { info } from '../ref.js';
import { t } from '../../i18n/index.js';
import { ruleText } from '../rule-text.js';

export function openDialog(draw, handlers, { wide = false } = {}) {
  const dlg = document.createElement('dialog');
  dlg.className = wide ? 'dialog dialog--wide' : 'dialog';
  document.body.append(dlg);
  // decision 160: a redraw keeps the window's scroll (the market jumped to the top after every purchase)
  const redraw = () => {
    const top = dlg.querySelector('.dialog__body')?.scrollTop ?? 0;
    render(dlg, draw());
    const body = dlg.querySelector('.dialog__body');
    if (body && top) body.scrollTop = top;
  };
  const off = cleanup(
    delegate(dlg, 'click', { close: () => dlg.close(), ...handlers.click }),
    delegate(dlg, 'input', handlers.input ?? {}),
    delegate(dlg, 'change', handlers.change ?? {}),
  );
  dlg.addEventListener('close', () => { off(); dlg.remove(); });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); }); // backdrop
  redraw();
  dlg.showModal();
  return { redraw, close: () => dlg.close(), toTop: () => { const b = dlg.querySelector('.dialog__body'); if (b) b.scrollTop = 0; } };
}

/**
 * Check dialog. target = { name, tn, sub }. onResult(result) is called once per roll (for logging / actions).
 * Supports an app roll or entering a physical die result.
 * opts.once: only one roll (an action was spent); opts.after(result) → extra HTML under the result.
 * opts.tools: carried tools that fit this roll ([{ id, name, tn, when, always }], decision 59) — tick boxes, one counts.
 * opts.flow: what follows a success, step by step (damage, Exploit, hit location…), each step rolled by the app
 *   or typed from physical dice: { next(answers) → step | null, summary(answers) → HTML, complete(answers) }.
 *   step = { id, title, hint?, dice?: [{ key, label, expr }], choose?: [{ value, label }], recap?(answer) → text }
 */
/**
 * light (decision 76): { kind, options: [{ id, tn }], pick } from rules/darkness.js → lightOptions — a Light row
 * with the suggested option chosen; the player can change it.
 */
/** aim (decision 97): { options: [{ id, tn, label }], pick, onPick(id) } — Body / ⌖ Location for an attack. */
/** foe (decision 153): { options: [{ id, label }], pick, onPick(id) } — which enemy an attack goes at (told to the GM). */
export function openCheck(target, data, onResult, { tier = 0, once = false, after = null, flow = null, tools = [], light = null, boosts = [], aim = null, notice = '', foe = null } = {}) {
  const state = { tier, result: null, manual: '', extra: '', answers: {}, typed: {}, flowError: '', finished: false,
    tool: tools.find((x) => x.always)?.id ?? null, light: light?.pick ?? null, aim: aim?.pick ?? null, foe: foe?.pick ?? '' };
  const aimOpt = () => aim?.options.find((o) => o.id === state.aim) ?? null;
  const tool = () => tools.find((x) => x.id === state.tool) ?? null;
  const lightOpt = () => light?.options.find((o) => o.id === state.light) ?? null;
  const foeOpt = () => foe?.options.find((o) => o.id === (state.foe ?? '')) ?? null;
  const tn = () => target.tn + (tool()?.tn ?? 0) + (lightOpt()?.tn ?? 0) + (aimOpt()?.tn ?? 0) + (foeOpt()?.tn ?? 0); // foe: its conditions (decision 158)
  const flowOn = () => Boolean(flow && state.result?.success);
  const step = () => (flowOn() ? flow.next(state.answers) : null);
  const finish = () => { if (flowOn() && !step() && !state.finished) { state.finished = true; flow.complete(state.answers); } };
  const tiers = data.difficulty.tiers;
  const resolve = (value, dice = null) => {
    if (once && state.result) return;
    const lo = lightOpt();
    state.result = { ...resolveCheck(tn(), value, state.tier, data.difficulty), dice, tool: tool(), light: lo?.tn ? { tn: lo.tn, label: t(`light.${light.kind}.${lo.id}`) } : null };
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
  /** Decision 156: once rolled, the setup folds into one line — the flow below needs the room. */
  const summaryLine = () => [foe ? foe.options.find((o) => o.id === (state.foe ?? ''))?.label : '', aimOpt()?.label, tool()?.name, light ? t(`light.${light.kind}.${state.light}`) : '',
    tiers.find((x) => x.id === state.tier)?.name].filter(Boolean).join(' · ');
  const draw = () => {
    const tier = tiers.find((x) => x.id === state.tier);
    const r = state.result;
    return html`
      <header class="card__head"><h2 class="card__title">${target.name}<small>${target.sub ?? ''}</small></h2><button class="btn btn--ghost btn--icon" data-action="close" aria-label="${t('common.close')}">✕</button></header>
      <div class="dialog__body stack">
        ${notice ? html`<p class="notice notice--ok">${notice}</p>` : ''}
        <div class="cluster cluster--gap">
          <div class="stat"><span class="label">TN</span><span class="stat__value">${tn()}</span>${tool() ? html`<span class="stat__sub text-success">+${tool().tn} ${tool().name}</span>` : ''}</div>
          <div class="stat"><span class="label">${t('check.difficulty')}</span><span class="stat__value ${tier.penalty > 0 ? 'stat__value--danger' : tier.penalty < 0 ? 'text-success' : ''}">${signed(-tier.penalty)}</span></div>
          <div class="stat"><span class="label">${t('check.rollUnder')}</span><span class="stat__value stat__value--accent">${tn() - tier.penalty}</span></div>
        </div>
        ${boosts.length ? html`<p class="check-boosts"><span class="label">${t('check.inPlay')}</span> ${boosts.map((b) => html`<span class="pill ${b.delta > 0 ? 'pill--success' : 'pill--danger'}">${b.name} ${b.delta > 0 ? '+' : '−'}${Math.abs(b.delta)}</span>`)}
          <span class="hint">${t('check.inPlayHint')}</span></p>` : ''}
        ${once && r ? html`<p class="check-summary muted">${summaryLine()}</p>` : html`<div class="check-setup">
        ${foe ? html`<div class="stack stack--tight check-setup__wide"><span class="label">${t('attack.foe')}</span>
          <div class="foe-chips" role="group" aria-label="${t('attack.foe')}">${foe.options.map((o) => html`<button class="foe-chip" data-action="foePick" data-id="${o.id}" aria-pressed="${(state.foe ?? '') === o.id}">
            ${o.img ? html`<img src="${o.img}" alt="" loading="lazy">` : o.letter ? html`<span class="foe-chip__letter">${o.letter}</span>` : ''}<span>${o.label}</span></button>`)}</div></div>` : ''}
        ${aim ? html`<div class="stack stack--tight ${state.aim === 'located' && aim.table ? 'check-setup__wide' : ''}"><span class="label">${t('attack.aim')}${info('location-attack', t('attack.aim'))}</span>
          <div class="segmented" role="group" aria-label="${t('attack.aim')}">${aim.options.map((o) => html`<button class="segmented__opt" data-action="aim" data-id="${o.id}" aria-pressed="${state.aim === o.id}">${o.label}${o.tn ? ` ${o.tn > 0 ? '+' : '−'}${Math.abs(o.tn)}` : ''}</button>`)}</div>
          ${state.aim === 'located' && aim.table ? aim.table(state.foe) : aimOpt()?.hint ? html`<p class="hint">${aimOpt().hint}</p>` : ''}</div>` : ''}
        ${tools.length ? html`<div class="stack stack--tight"><span class="label">${t('tools.title')}</span>
          <div class="tool-list">${tools.map((x) => html`<label class="tool ${state.tool === x.id ? 'is-on' : ''}" title="${t('tools.hint')}">
            <input type="checkbox" data-action="tool" data-id="${x.id}" ${state.tool === x.id ? 'checked' : ''}>
            <span><strong>${x.name} +${x.tn}</strong> <span class="muted">· ${x.when}</span></span></label>`)}</div></div>` : ''}
        ${light ? html`<div class="stack stack--tight"><span class="label">${t('light.title')}${info('darkness', t('light.title'))}</span>
          <div class="segmented" role="group" aria-label="${t('light.title')}">${light.options.map((o) => html`<button class="segmented__opt" data-action="light" data-id="${o.id}" aria-pressed="${state.light === o.id}" title="${t('light.suggested', { option: t(`light.${light.kind}.${light.pick}`) })}">${t(`light.${light.kind}.${o.id}`)}${o.tn ? ` ${o.tn > 0 ? '+' : '−'}${Math.abs(o.tn)}` : ''}</button>`)}</div></div>` : ''}
        <label class="stack stack--tight"><span class="label">${t('table.difficulty')}${info('difficulty', t('check.difficulty'))}</span>
          <select class="select" data-action="tierPick" aria-label="${t('table.difficulty')}" title="${tier.example}">${tiers.map((x) => html`<option value="${x.id}" ${x.id === state.tier ? raw('selected') : ''}>${x.name}${x.penalty ? ` (${signed(-x.penalty)})` : ''}</option>`)}</select></label>
        </div>`}
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
      tool: ({ id }) => { if (once && state.result) return; state.tool = state.tool === id ? null : id; state.result = null; d.redraw(); },
      light: ({ id }) => { if (once && state.result) return; state.light = id; state.result = null; d.redraw(); },
      foePick: ({ id }) => { if (once && state.result) return; state.foe = id; foe.onPick?.(id); state.result = null; d.redraw(); }, // decision 153
      aim: ({ id }) => { if (once && state.result) return; state.aim = id; aim.onPick?.(id); state.result = null; d.redraw(); },
      flowChoose: ({ value }) => answer(value),
      flowRoll: () => diceAnswer(false),
      flowEnter: () => diceAnswer(true),
    },
    change: {
      tierPick: (_, e) => { if (once && state.result) return; state.tier = Number(e.target.value); state.result = null; d.redraw(); }, // decision 156: one dropdown
    },
    input: {
      manual: (_, e) => { state.manual = e.target.value; },
      flowTyped: ({ key }, e) => { state.typed[key] = e.target.value; },
    },
  }, { wide: Boolean(foe || aim || tools.length || light) });
}

/** A small choice (Reload / swap…): choices [{ value, label, why }] — a choice with a `why` shows disabled with it. */
export function openChoice(title, choices, onPick) {
  const d = openDialog(() => html`
    <header class="card__head"><h2 class="card__title">${title}</h2><button class="btn btn--ghost btn--icon" data-action="close" aria-label="${t('common.close')}">✕</button></header>
    <div class="dialog__body stack">${choices.map((ch) => html`
      <button class="btn btn--block choice ${ch.why ? '' : 'btn--primary'}" data-action="pick" data-value="${ch.value}" ${ch.why ? 'disabled' : ''}>${ch.label}${ch.sub ? html`<small class="choice__sub">${ch.sub}</small>` : ''}</button>
      ${ch.why ? html`<p class="hint">${ch.why}</p>` : ''}`)}</div>`, {
    click: { pick: ({ value }) => { d.close(); onPick(value); } },
  });
}

/** Market dialog. free = add without paying (GM-granted gear). onBuy({kind,id,method,multiplier}) may throw. */
export function openShop({ kind = 'weapon', free = false }, character, data, onBuy) {
  const state = { kind, query: '', multiplier: data.economy.cash.defaultMultiplier, message: '', custom: { name: '', note: '', qty: 1 } };
  const kinds = free ? ['weapon', 'weaponMod', 'ammo', 'armor', 'item', 'deck', 'deckMod', 'drone', 'droneMod', 'optic', 'custom'] : ['weapon', 'weaponMod', 'ammo', 'armor', 'item', 'deck', 'deckMod', 'drone', 'droneMod', 'optic', 'lifestyle', 'custom'];
  /** + Custom (decision 55): a misc item with no price and no rules. */
  const customForm = () => html`<div class="stack">
    <p class="hint">${t('shop.customHint')}</p>
    <label class="field"><span class="label">${t('shop.customName')}</span><input class="input" maxlength="60" value="${state.custom.name}" data-action="cField" data-field="name" placeholder="${t('shop.customNamePh')}"></label>
    <label class="field"><span class="label">${t('shop.customNote')}</span><input class="input" maxlength="200" value="${state.custom.note}" data-action="cField" data-field="note"></label>
    <label class="field"><span class="label">${t('gear.qty')}</span><input class="input input--num" type="number" min="1" max="99" value="${state.custom.qty}" data-action="cField" data-field="qty"></label>
    <button class="btn btn--primary" data-action="addCustom">${t('shop.customAdd')}</button></div>`;
  /** The list price means nothing to players (they see CRS and $): weapons show a spare magazine's street price instead,
   *  lifestyle its monthly upkeep. */
  const metaPrice = (e) => {
    if (state.kind === 'lifestyle') return ` · ${t('shop.monthly', { cash: e.cost.cr, crs: creditScoreCost(e, 'lifestyle', data.economy) ?? '—' })}`;
    if (state.kind !== 'weapon' || !e.magSize) return '';
    const mag = findGear('ammo', magazineId(e.id), data);
    return mag ? ` · ${t('shop.spareMag', { cash: priceOptions(mag, 'ammo', data.economy, state.multiplier).cash.cash })}` : '';
  };
  /** Lifestyle (decision 86): does this entry add to the others, or replace one? */
  const addsUp = (e) => lifestyleSlot(e, data) === `entry:${e.id}`;
  const draw = () => {
    const c = character();
    // decision 160: what this class needs in action (★) and what it can't use — buying stays open to everyone
    const cls = data.classes.classes.find((k) => k.id === c.classId) ?? null;
    const need = (k) => Boolean(cls?.market?.need.includes(k));
    const skip = (k) => Boolean(cls?.market?.skip.includes(k));
    const guns = new Set(c.play.inventory.filter((x) => x.kind === 'weapon').map((x) => x.id));
    const fits = (e) => state.kind === 'ammo' && guns.has(e.weaponId);
    const list = state.kind === 'custom' ? [] : catalog(state.kind, data)
      .filter((e) => !state.query || `${e.name} ${e.type ?? ''} ${e.category ?? ''} ${e.ammo ?? ''}`.toLowerCase().includes(state.query.toLowerCase()))
      .sort((a, b) => (fits(b) - fits(a)) || a.cost.cr - b.cost.cr); // ammo: magazines for your guns first
    return html`
      <header class="card__head"><h2 class="card__title">${free ? t('shop.addGear') : t('shop.market')}<small>${free ? t('shop.freeSub') : `${t('stat.cash')} $${c.play.cash} · CRS ${c.attributes.CRS}`}</small></h2>
        <button class="btn btn--ghost btn--icon" data-action="close" aria-label="${t('common.close')}">✕</button></header>
      <div class="dialog__body stack">
        <div class="tabs tabs--wrap dialog__sticky" role="tablist">${kinds.map((k) => html`<button class="tab ${need(k) ? 'tab--need' : skip(k) ? 'tab--skip' : ''}" role="tab" data-action="kind" data-value="${k}" aria-selected="${k === state.kind}" title="${need(k) ? t('shop.needHint', { cls: cls?.name ?? '' }) : skip(k) ? t('shop.skipHint', { cls: cls?.name ?? '' }) : ''}">${need(k) ? '★ ' : ''}${kindLabel(k)}</button>`)}</div>
        ${need(state.kind) ? html`<p class="notice notice--ok">★ ${t('shop.needHint', { cls: cls.name })}</p>` : skip(state.kind) ? html`<p class="notice">${t('shop.skipHint', { cls: cls.name })}</p>` : ''}
        <div class="cluster cluster--gap">
          <input class="input" type="search" placeholder="${t('common.search')}…" value="${state.query}" data-action="query" aria-label="${t('common.search')}">
          ${free || state.kind === 'lifestyle' ? '' : html`<div class="cluster"><span class="label">${t('shop.markup')}</span>${segmented('mult', [3, 5, 7, 10].map((m) => ({ value: m, label: `×${m}` })), state.multiplier)}</div>`}
        </div>
        ${state.message ? html`<p class="notice ${state.message.startsWith('✓') ? 'notice--ok' : 'notice--danger'}">${state.message}</p>` : ''}
        ${state.kind === 'custom' ? customForm() : html`<div class="rows">
          ${marketGroups(state.kind, list, data, fits).map((g) => html`${g.label ? html`<h3 class="market-group">${g.label} <span class="muted">· ${g.items.length}</span></h3>` : ''}
          ${g.items.map((e) => {
            const p = priceOptions(e, state.kind, data.economy, state.multiplier);
            return html`<div class="row row--wrap">
              <div class="row__main">
                <div class="row__title">${e.name} ${fits(e) ? html`<span class="pill pill--success">${t('shop.fits')}</span>` : ''}${e.rarity ? html`<span class="pill ${['A', 'B'].includes(e.rarity) ? 'pill--danger' : ''}">${e.rarity}</span>` : ''}${e.provisional ? html` <span class="pill">${t('shop.provisional')}</span>` : ''}</div>
                <div class="row__meta">${describe(state.kind, e, data)}${metaPrice(e)}${state.kind === 'lifestyle' ? ` · ${t(addsUp(e) ? 'shop.addsUp' : 'shop.replaces')}` : ''}</div>
              </div>
              <div class="cluster">${state.kind === 'lifestyle' ? (c.play.lifestyle ?? []).includes(e.id)
                ? html`<span class="pill pill--success">✓ ${t('shop.current')}</span><button class="btn btn--sm btn--ghost" data-action="dropLife" data-id="${e.id}" aria-label="${t('common.remove')}: ${e.name}">✕</button>`
                : html`<button class="btn btn--sm btn--primary" data-action="buy" data-id="${e.id}" data-method="choose">${t('shop.choose')}</button>`
              : free ? html`<button class="btn btn--sm btn--primary" data-action="buy" data-id="${e.id}" data-method="free">${t('common.add')}</button>` : html`
                <button class="btn btn--sm" data-action="buy" data-id="${e.id}" data-method="official" ${p.official ? '' : 'disabled'} title="${p.official ? t('shop.officialHint') : t('shop.blackOnly')}">${p.official ? `${p.official.crs} CRS` : t('shop.noOfficial')}</button>
                <button class="btn btn--sm btn--primary" data-action="buy" data-id="${e.id}" data-method="cash" title="${t('shop.streetPrice', { n: p.cash.multiplier })}">$${p.cash.cash}</button>`}
              </div></div>`;
          })}`)}
          ${list.length ? '' : html`<p class="muted">${t('common.noMatch')}</p>`}
        </div>`}
      </div>`;
  };
  const d = openDialog(draw, {
    click: {
      kind: ({ value }) => { state.kind = value; state.message = ''; d.redraw(); d.toTop(); }, // a new list starts at the top
      mult: ({ value }) => { state.multiplier = Number(value); d.redraw(); },
      addCustom: () => {
        try { state.message = `✓ ${onBuy({ kind: 'custom', method: 'custom', ...state.custom })}`; state.custom = { name: '', note: '', qty: 1 }; }
        catch (err) { state.message = ruleText(err); }
        d.redraw();
      },
      dropLife: ({ id }) => { try { state.message = `✓ ${onBuy({ kind: 'lifestyle', id, method: 'drop' })}`; } catch (err) { state.message = ruleText(err); } d.redraw(); },
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
