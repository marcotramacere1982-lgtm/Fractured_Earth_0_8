// Initiative asked by the GM (decision 148): a card shown mid-screen by calls.js (decision 193) — roll it here (the breakdown shows), or type the
// die you rolled at the table. The die goes to the GM's combat setup; the sheet logs the roll. No actions imported here:
// the sheet passes `run` in (play.js imports this module).

import { html } from '../dom.js';
import { card } from './parts.js';
import { roll, typedRoll } from '../../rules/dice.js';
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
    initRoll: () => send(roll(data.encounter.initiativeDie)),
    initTyped: (_, e) => {
      const v = e.target.closest('.init-ask')?.querySelector('input')?.value;
      try { send(typedRoll(data.encounter.initiativeDie, v)); } catch { toast(t('init.badRoll', { die: data.encounter.initiativeDie }), 'danger'); }
    },
  };
}
