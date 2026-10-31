// The loadout window (decision 192), drawn over the sheet: weapons in their slots and the abilities equipped.
// Two uses: when the GM starts a fight, it opens by itself and can't be skipped (only "I'm ready" closes it, once
// per fight, kept on the character) — so nobody walks into a fight with the wrong gun or abilities;
// and from the Class bookmark's "Swap abilities", abilities only, closed with Done. The controls are the sheet's own
// (slot pickers, Equip / Unequip, suggested loadouts), so every change is the same action as on the Setup tab.

import { html, raw } from '../dom.js';
import { t } from '../../i18n/index.js';
import { icon } from './parts.js';
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
    <div class="spread spread--wrap"><span class="label">${t('engine.equipped')} ${c.play.abilities.length}/${s.abilityLimit}</span>${kitButtons(c, data)}</div>
    <ul class="loadout__abilities">${[...all.filter(on), ...all.filter((a) => !on(a))].map((a) => html`<li class="loadout__ability ${on(a) ? 'is-on' : ''}">
      <div class="loadout__ability-text"><strong>${abilityEffects(a).map((id) => icon(data, id, 'ico--fx'))}${a.name}</strong>
        <span class="cluster loadout__chips">${abilityChips(c, s, data, a)}</span>
        <span class="muted st-small">${abilityLine(c, s, a)}</span></div>
      <button class="btn btn--sm ${on(a) ? '' : 'btn--primary'}" data-action="equip" data-id="${a.id}" ${!on(a) && full ? raw('disabled') : ''}>${on(a) ? t('engine.unequip') : t('engine.equip')}</button></li>`)}</ul>
    ${full ? html`<p class="hint">${t('loadout.full', { n: s.abilityLimit })}</p>` : ''}
  </div>`;
}

/** The window, or '' when nothing is open. combat: the table's combat state for this sheet. */
export function loadoutOverlay(c, s, data, combat) {
  const fight = pendingFight(c, combat);
  if (!fight && !(swapOpen && loadoutOpen(c.play.turn))) return ''; // decision 194: no swapping mid-fight
  if (!c.classId && !fight) return '';
  return html`<div class="loadout" role="dialog" aria-modal="true" aria-labelledby="loadout-title">
    <div class="loadout__box ${fight ? 'loadout__box--fight' : ''}">
      <header class="loadout__head"><h2 id="loadout-title" class="loadout__title">${fight ? `⚔ ${t('loadout.fightTitle')}` : t('loadout.swapTitle')}</h2>
        ${fight ? html`<p class="loadout__lead">${t('loadout.fightLead')}</p>` : ''}</header>
      <div class="loadout__body">
        ${fight ? html`<section class="stack"><h3 class="label">1 · ${t('loadout.weapons')}</h3>${weaponsCard(c, s, data)}</section>` : ''}
        ${c.classId ? html`<section class="stack">${fight ? html`<h3 class="label">2 · ${t('loadout.abilities')}</h3>` : ''}${abilityList(c, s, data)}</section>` : ''}
      </div>
      <footer class="loadout__foot">${fight
        ? html`<button class="btn btn--primary loadout__go" data-action="combatReady" data-id="${fight}">${t('loadout.ready')}</button>`
        : html`<button class="btn btn--primary" data-action="loadoutClose">${t('loadout.done')}</button>`}</footer>
    </div>
  </div>`;
}
