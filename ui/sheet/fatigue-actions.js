// Sheet actions for Fatigue (decision 362). Merged into `actions` (./actions.js); same signature: (draft, data, args).
// The body's track beside Strain: a fight's end adds to it (more when it ran long or you dropped below half HP), a
// Push buys +2 on a roll or one more action for +1, a stim's crash +1; a breather (once per scene) takes 2 off — unless
// a stim already took that one —, sleep or downtime clear it. Everything is logged in English for the GM.

import { addFatigue, breatherRelief, fightGain } from '../../rules/fatigue.js';
import { log } from './actions.js';

const text = (v, n) => String(v ?? '').slice(0, n);

export const fatigueActions = {
  /** Fatigue goes up (or down with a negative n). @returns the change (rules/fatigue.js → addFatigue). */
  fatigueAdd(c, data, { n, why }) {
    const d = data.fatigue;
    if (!d || !Number(n)) return null;
    const r = addFatigue(c.play.fatigue, Math.round(Number(n)), d);
    if (r.value === (c.play.fatigue ?? 0)) return r;
    const delta = r.value - (c.play.fatigue ?? 0);
    c.play.fatigue = r.value;
    log(c, `Fatigue ${delta > 0 ? '+' : '−'}${Math.abs(delta)} — ${text(why, 120)} → ${r.value}/${d.max} ${r.to.name}`, delta > 0 ? (r.worse ? 'bad' : 'info') : 'ok');
    return r;
  },
  /** A breather: −2, once per scene (the GM's safe New scene or the GM's Breather). A stim took this one: nothing comes off. */
  fatigueBreather(c, data, { why = 'a breather', scene = null } = {}) {
    const d = data.fatigue;
    if (!d) return false;
    const key = scene ?? c.play.lastScene ?? 'none';
    if (c.play.breatherScene === key) return false; // once per scene
    c.play.breatherScene = key;
    const r = breatherRelief(c.play, d);
    if (r.stim) { c.play.stimmed = false; log(c, `Breather — the stim's lift is gone; nothing comes off this time`, 'info'); return true; }
    if (c.play.fatigue) fatigueActions.fatigueAdd(c, data, { n: -r.n, why });
    return true;
  },
  /** Sleep or downtime: back to 0. */
  fatigueRest(c, data, { why = 'a night’s sleep' } = {}) {
    if (!data.fatigue) return;
    c.play.stimmed = false;
    if (c.play.fatigue) fatigueActions.fatigueAdd(c, data, { n: -c.play.fatigue, why });
  },
  /** By hand (a fix), seen by the GM like any hand edit. */
  fatigueHand(c, data, { delta }) {
    fatigueActions.fatigueAdd(c, data, { n: Math.sign(Number(delta) || 0), why: 'by hand' });
  },
  /** A fight ended: +1, +1 more if it ran long or you dropped below half HP in it. */
  fatigueFightEnd(c, data) {
    const d = data.fatigue;
    if (!d) return;
    const rounds = c.play.turn?.round ?? 0;
    const bloodied = Boolean(c.play.fightBloodied);
    c.play.fightBloodied = false;
    fatigueActions.fatigueAdd(c, data, { n: fightGain({ rounds, bloodied }, d), why: `a fight${rounds >= d.gains.longRounds ? ` of ${rounds} rounds` : ''}${bloodied ? ', badly hurt' : ''}` });
  },
  /** Push for a roll (the check window's tick): +1 Fatigue, logged with the roll. */
  fatiguePushRoll(c, data, { what = 'a roll' } = {}) {
    if (!data.fatigue) return;
    fatigueActions.fatigueAdd(c, data, { n: data.fatigue.gains.push, why: `pushed: +${data.fatigue.push.tn} on ${text(what, 60)}` });
  },
  /** Push for one more action this turn (in a fight, once per turn): +1 Fatigue. */
  fatiguePushAction(c, data) {
    const d = data.fatigue;
    const turn = c.play.turn;
    if (!d || !turn?.inCombat || turn.pushed === turn.round) return false;
    c.play.turn = { ...turn, used: (turn.used ?? 0) - d.push.actions, pushed: turn.round };
    fatigueActions.fatigueAdd(c, data, { n: d.gains.push, why: 'pushed: one more action this turn' });
    return true;
  },
  /** The GM's card (durable `fatigue`): op add | breather | rest. @returns true when new. */
  receiveFatigue(c, data, { msg }) {
    if (!data.fatigue || !msg?.id) return false;
    c.play.fatigueSeen ??= [];
    if (c.play.fatigueSeen.includes(msg.id)) return false;
    c.play.fatigueSeen = [...c.play.fatigueSeen, msg.id].slice(-40);
    if (msg.op === 'breather') fatigueActions.fatigueBreather(c, data, { why: text(msg.why, 80) || 'a breather', scene: `gm${msg.id}` });
    else if (msg.op === 'rest') fatigueActions.fatigueRest(c, data, { why: text(msg.why, 80) || 'a night’s sleep' });
    else fatigueActions.fatigueAdd(c, data, { n: Math.max(1, Math.min(3, Math.round(Number(msg.n) || 1))), why: text(msg.why, 120) || 'The GM' });
    return true;
  },
};
