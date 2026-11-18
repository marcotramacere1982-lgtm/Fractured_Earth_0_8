// Initiative asked by the GM (decision 148): a card shown mid-screen by calls.js (decision 193) — roll it here (the breakdown shows), or type the
// die you rolled at the table. The die goes to the GM's combat setup; the sheet logs the roll. No actions imported here:
// the sheet passes `run` in (play.js imports this module).

import { html } from '../dom.js';
import { card } from './parts.js';
import { roll, typedRoll, parseDice } from '../../rules/dice.js';
import { dieView, tumbleIn } from '../dice-roll.js'; // decision 315: the initiative die tumbles too
import { t } from '../../i18n/index.js';

const signedText = (n) => `${n >= 0 ? '+' : '−'} ${Math.abs(n)}`;

export function initiativeCard(c, s, data) {
  if (!c.play.initAsk || c.play.turn?.inCombat) return '';
  const die = data.encounter.initiativeDie;
  return card(t('init.title'), html`<div class="stack init-ask">
    <p>${t('init.asked', { die, init: signedText(s.initiative) })}</p>
    <div class="cluster">
      <button class="btn btn--primary" data-action="initRoll">🎲 ${t('init.roll')}</button>
      <span class="muted">${t('init.or')}</span>
      <input class="input input--num" type="number" min="1" max="20" step="1" inputmode="numeric" aria-label="${t('init.typed')}" placeholder="${die}">
      <button class="btn" data-action="initTyped">${t('init.send')}</button>
      <span class="check-die" data-init-die>${dieView(null, 'idle', parseDice(die).sides)}</span>
    </div>
  </div>`, { ref: 'initiative' });
}

/** ctx: { character(), sheet(), data, run, table, toast } → click handlers. */
export function initiativeHandlers({ character, sheet, data, run, table, toast }) {
  async function send(r) {
    const ask = character().play.initAsk?.id;
    if (!ask) return;
    const init = sheet().initiative;
    const text = `${r.expr} ${r.typed ? `${r.total} (typed)` : `[${r.rolls.join(', ')}]`} ${signedText(init)} INIT = ${r.total + init}`;
    if (!(await table?.initiative(ask, r.total))) { toast(t('crewStash.why.offline'), 'danger'); return; }
    run('initiativeRolled', { text });
    toast(t('init.sent', { roll: text }), 'success');
  }
  return {
    initRoll: async (_, e) => { // decision 315: roll first, the die performs it, then it goes to the GM
      const slot = e.target.closest('.init-ask')?.querySelector('[data-init-die]');
      if (slot?.querySelector('.die--rolling')) return; // already rolling: one roll per tap
      const r = roll(data.encounter.initiativeDie);
      await tumbleIn(slot, r.total, parseDice(r.expr).sides);
      send(r);
    },
    initTyped: (_, e) => {
      const v = e.target.closest('.init-ask')?.querySelector('input')?.value;
      try { send(typedRoll(data.encounter.initiativeDie, v)); } catch { toast(t('init.badRoll', { die: data.encounter.initiativeDie }), 'danger'); }
    },
  };
}

/**
 * Decision 232: the GM's Prepare — initiative rolled in the get-ready window goes to the GM's setup straight away
 * (their board shows "rolled"); "I'm ready" tells the GM and closes the window.
 */
export function prepareHandlers({ character, sheet, data, run, table, toast }) {
  const prepId = () => table?.state.prepare?.id ?? null;
  async function send(r) {
    const id = prepId();
    if (!id) return;
    const init = sheet().initiative;
    const text = `${r.expr} ${r.typed ? `${r.total} (typed)` : `[${r.rolls.join(', ')}]`} ${signedText(init)} INIT = ${r.total + init}`;
    if (!(await table.initiative(id, r.total))) { toast(t('crewStash.why.offline'), 'danger'); return; }
    run('prepareRolled', { id, roll: r.total, text });
  }
  return {
    prepRoll: async (_, e) => { // decision 315
      const slot = e.target.closest('.init-ask')?.querySelector('[data-init-die]');
      if (slot?.querySelector('.die--rolling')) return; // already rolling: one roll per tap
      const r = roll(data.encounter.initiativeDie);
      await tumbleIn(slot, r.total, parseDice(r.expr).sides);
      send(r);
    },
    prepTyped: (_, e) => {
      const v = e.target.closest('.init-ask')?.querySelector('input')?.value;
      try { send(typedRoll(data.encounter.initiativeDie, v)); } catch { toast(t('init.badRoll', { die: data.encounter.initiativeDie }), 'danger'); }
    },
    async prepReady({ id }) {
      if (character().play.prepared?.id !== id || character().play.prepared.roll == null) return;
      if (!(await table.ready(id))) { toast(t('crewStash.why.offline'), 'danger'); return; }
      run('prepareReady', { id });
    },
  };
}
