// Air (decision 273): the sheet's side of holding your breath — start (by hand, or a Submerged zone the GM's map
// noticed), a round passing, the CON roll, the drowning dice, and air. Numbers from rules/breath.js.

import { startBreath, tickBreath, answerCheck, answerDrown } from '../../rules/breath.js';
import { deriveSheet } from '../../state/character.js';
import { log } from './actions.js';

const text = (v, n) => String(v ?? '').slice(0, n);
const INCAP = 'incapacitated';

export const breathActions = {
  /** Start holding it (nothing changes if you already are). */
  breathStart(c, data, { surprised = false, why = '' } = {}) {
    if (c.play.breath) return false;
    const s = deriveSheet(c, data);
    c.play.breath = { ...startBreath(s.attributes.CON, surprised, data.body.breath), why: text(why, 60) };
    log(c, `Holding your breath${why ? ` (${text(why, 60)})` : ''}: ${c.play.breath.max} round${c.play.breath.max === 1 ? '' : 's'}${surprised ? ' — caught by surprise' : ''}`, 'warn');
    return true;
  },
  /** A round passes: one fewer left, or a CON roll, or the drowning dice. */
  breathTick(c, data) {
    if (!c.play.breath) return null;
    if (c.play.breathRecover) { c.play.breathRecover = false; }
    const { b, event } = tickBreath(c.play.breath, data.body.breath);
    c.play.breath = b;
    if (event === 'count') log(c, `Holding your breath: ${b.left} round${b.left === 1 ? '' : 's'} left`, b.left ? 'info' : 'warn');
    return event;
  },
  /** The CON roll after the air ran out. */
  breathCheck(c, data, { success, rollText = '' }) {
    if (c.play.breath?.ask?.kind !== 'check') return;
    const penalty = c.play.breath.ask.penalty;
    c.play.breath = answerCheck(c.play.breath, success);
    log(c, `Out of air — CON ${penalty} (${rollText}): ${success ? 'still holding on' : 'you black out'}`, success ? 'warn' : 'bad');
    if (!success && !c.play.conditions.includes(INCAP)) c.play.conditions.push(INCAP);
  },
  /** The drowning dice: straight off HP, armor never helps. */
  breathDrown(c, data, { n, rollText = '' }) {
    if (c.play.breath?.ask?.kind !== 'drown') return;
    c.play.breath = answerDrown(c.play.breath);
    const s = deriveSheet(c, data);
    const hp = s.hp.current - Math.max(0, Math.round(Number(n) || 0));
    c.play.hp = hp >= s.hp.max ? null : hp;
    log(c, `Drowning: −${n} HP (${rollText})`, 'bad');
  },
  /** Air: the hold ends; if you were out, you come round (Incapacitated goes, while you still have HP). */
  breathEnd(c, data, { why = '' } = {}) {
    if (!c.play.breath) return false;
    const wasOut = c.play.breath.out;
    c.play.breath = null;
    const s = deriveSheet(c, data);
    if (wasOut && s.hp.current > 0) c.play.conditions = c.play.conditions.filter((x) => x !== INCAP);
    log(c, `Air${why ? ` (${text(why, 60)})` : ''}${wasOut ? (s.hp.current > 0 ? ' — you come round, coughing' : '') : ''}`, 'ok');
    return true;
  },
  /** The GM's map: a Submerged zone (start) or out of it (end). @returns true when something changed. */
  receiveBreath(c, data, { msg }) {
    if (!msg?.id || c.play.lastBreath === msg.id) return false;
    c.play.lastBreath = text(msg.id, 40);
    if (msg.end) return breathActions.breathEnd(c, data, { why: text(msg.why, 60) });
    return breathActions.breathStart(c, data, { surprised: Boolean(msg.surprised), why: text(msg.why, 60) });
  },
};
