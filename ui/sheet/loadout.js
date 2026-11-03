// The loadout window (decision 192), drawn over the sheet: weapons in their slots and the abilities equipped.
// Two uses: when the GM starts a fight, it opens by itself and can't be skipped (only "I'm ready" closes it, once
// per fight, kept on the character) — so nobody walks into a fight with the wrong gun or abilities;
// and from the Class bookmark's "Swap abilities", abilities only, closed with Done. The controls are the sheet's own
// (slot pickers, Equip / Unequip, suggested loadouts), so every change is the same action as on the Setup tab.

import { html, raw } from '../dom.js';
import { t } from '../../i18n/index.js';
import { icon, counter } from './parts.js';
import { weaponsCard } from './play.js';
import { kitButtons, abilityChips, abilityLine } from './engine.js';
import { loadoutOpen } from '../../rules/turn.js';
import { abilityEffects } from '../../rules/ability-play.js';
import { droneAbility } from '../../rules/field-drone.js';

let swapOpen = false;

/**
 * The fight this sheet still has to get ready for, or null: a GM's fight that includes it, not yet answered with
 * "I'm ready" (decision 195: kept on the character, so a reload or another device doesn't ask again).
 */
export function pendingFight(c, combat) {
  if (!combat?.active) return null;
  const inIt = !combat.order?.length || combat.order.some((o) => o.key === c.id); // no order yet: the GM is still setting up
  const turn = c.play.turn;
  const answered = turn?.inCombat && turn.tableCombat === combat.id && turn.ready !== false;
  return inIt && !answered ? combat.id : null;
}
export const openSwap = () => { swapOpen = true; };
export const closeSwap = () => { swapOpen = false; };

/** Every ability this subclass can take, equipped first, each with what it costs and needs (decision 194) and Equip / Unequip. */
function abilityList(c, s, data) {
  const all = (data.abilities[c.classId] ?? []).filter((a) => !a.housekeeping && a.subclasses.includes(c.subclassId)).map((a) => droneAbility(a, s.drone));
  const on = (a) => c.play.abilities.includes(a.id);
  const full = c.play.abilities.length >= s.abilityLimit;
  return html`<div class="stack">
    <div class="spread spread--wrap"><span class="label">${t('engine.equipped')} ${c.play.abilities.length}/${s.abilityLimit}</span>
      <span class="cluster"><span class="label">${t('engine.brainFog')}</span>${counter({ action: 'maxAbilities', value: c.play.maxAbilities, min: 1, size: 'sm', label: t('engine.brainFog') })}</span>${kitButtons(c, data)}</div>
    <ul class="loadout__abilities">${[...all.filter(on), ...all.filter((a) => !on(a))].map((a) => html`<li class="loadout__ability ${on(a) ? 'is-on' : ''}">
      <div class="loadout__ability-text"><strong>${abilityEffects(a).map((id) => icon(data, id, 'ico--fx'))}${a.name}</strong>
        <span class="cluster loadout__chips">${abilityChips(c, s, data, a)}</span>
        <span class="muted st-small">${abilityLine(c, s, a)}</span></div>
      <button class="btn btn--sm ${on(a) ? '' : 'btn--primary'}" data-action="equip" data-id="${a.id}" ${!on(a) && full ? raw('disabled') : ''}>${on(a) ? t('engine.unequip') : t('engine.equip')}</button></li>`)}</ul>
    ${full ? html`<p class="hint">${t('loadout.full', { n: s.abilityLimit })}</p>` : ''}
  </div>`;
}

/**
 * Decision 232, step 2: the fight being prepared this sheet still has to answer, or null — the GM's Prepare (sticky
 * `prepare`), not taken over by the GM, not yet answered with "I'm ready" (kept on the character: c.play.prepared).
 */
export function pendingPrepare(c, prep) {
  // a fight running stops the window — except the head start's (round 0, decision 233): initiative comes after it
  if (!prep?.active || (prep.gm ?? []).includes(c.id) || (c.play.turn?.inCombat && c.play.turn.round !== 0)) return null;
  return c.play.prepared?.id === prep.id && c.play.prepared.ready ? null : prep.id;
}

/** Decision 232: the initiative part of the get-ready window — roll it here, or type the die rolled at the table. */
function initiativePart(c, s, data, prepId) {
  const done = c.play.prepared?.id === prepId && c.play.prepared.roll != null ? c.play.prepared : null;
  const die = data.encounter.initiativeDie;
  const init = `${s.initiative >= 0 ? '+' : '−'} ${Math.abs(s.initiative)}`;
  return html`<section class="stack init-ask"><h3 class="label">${c.classId ? 3 : 2} · ${t('init.title')}</h3>
    ${done ? html`<p class="text-success"><strong>✓ ${done.text}</strong></p>`
      : html`<p>${t('prep.rollFirst', { die, init })}</p>
      <div class="cluster">
        <button class="btn btn--primary" data-action="prepRoll">🎲 ${t('init.roll')}</button>
        <span class="muted">${t('init.or')}</span>
        <input class="input input--num" type="number" min="1" max="20" step="1" inputmode="numeric" aria-label="${t('init.typed')}" placeholder="${die}">
        <button class="btn" data-action="prepTyped">${t('init.send')}</button>
      </div>`}
  </section>`;
}

/** The window, or '' when nothing is open. combat: the table's combat state for this sheet; prep: the table's Prepare (decision 232). */
export function loadoutOverlay(c, s, data, combat, prep = null) {
  const preparing = pendingFight(c, combat) ? null : pendingPrepare(c, prep);
  const fight = pendingFight(c, combat) ?? preparing;
  if (!fight && !(swapOpen && loadoutOpen(c.play.turn))) return ''; // decision 194: no swapping mid-fight
  if (!c.classId && !fight) return '';
  const rolled = !preparing || (c.play.prepared?.id === preparing && c.play.prepared.roll != null);
  if (preparing && c.play.turn?.inCombat) { // decision 233: after a head start the loadout is set — initiative only
    return html`<div class="loadout" role="dialog" aria-modal="true" aria-labelledby="loadout-title">
      <div class="loadout__box loadout__box--fight">
        <header class="loadout__head"><h2 id="loadout-title" class="loadout__title">⚔ ${t('prep.afterHead')}</h2></header>
        <div class="loadout__body">${initiativePart(c, s, data, preparing)}</div>
        <footer class="loadout__foot">${rolled ? '' : html`<span class="muted">${t('prep.lockedHint')}</span>`}<button class="btn btn--primary loadout__go" data-action="prepReady" data-id="${preparing}" ${rolled ? '' : raw('disabled')}>${t('loadout.ready')}</button></footer>
      </div></div>`;
  }
  return html`<div class="loadout" role="dialog" aria-modal="true" aria-labelledby="loadout-title">
    <div class="loadout__box ${fight ? 'loadout__box--fight' : ''}">
      <header class="loadout__head"><h2 id="loadout-title" class="loadout__title">${fight ? `⚔ ${t('loadout.fightTitle')}` : t('loadout.swapTitle')}</h2>
        ${fight ? html`<p class="loadout__lead">${t('loadout.fightLead')}</p>` : ''}</header>
      <div class="loadout__body">
        ${fight ? html`<section class="stack"><h3 class="label">1 · ${t('loadout.weapons')}</h3>${weaponsCard(c, s, data)}</section>` : ''}
        ${c.classId ? html`<section class="stack">${fight ? html`<h3 class="label">2 · ${t('loadout.abilities')}</h3>` : ''}${abilityList(c, s, data)}</section>` : ''}
        ${preparing ? initiativePart(c, s, data, preparing) : ''}
      </div>
      <footer class="loadout__foot">${preparing
        ? html`${rolled ? '' : html`<span class="muted">${t('prep.lockedHint')}</span>`}<button class="btn btn--primary loadout__go" data-action="prepReady" data-id="${preparing}" ${rolled ? '' : raw('disabled')}>${t('loadout.ready')}</button>`
        : fight
        ? html`<button class="btn btn--primary loadout__go" data-action="combatReady" data-id="${fight}">${t('loadout.ready')}</button>`
        : html`<button class="btn btn--primary" data-action="loadoutClose">${t('loadout.done')}</button>`}</footer>
    </div>
  </div>`;
}
