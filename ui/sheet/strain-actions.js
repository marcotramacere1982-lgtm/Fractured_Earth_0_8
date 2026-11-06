// Sheet actions for Strain (decision 266). Merged into `actions` (./actions.js); same signature: (draft, data, args).
// A gain waits as a card (strainAsks) — the player steadies it with a Mental Strength roll (halved) or takes it; the
// maximum opens a breaking point (a d6, a Scar a second d6, rolled or typed); relief comes from a safe new scene, a
// crewmate's Steady (a boon card) and downtime. Everything is logged in English for the GM.

import { addStrain, steadied, breakingResult, scarFor } from '../../rules/strain.js';
import { stampNew } from '../../rules/condition-time.js';
import { log } from './actions.js';

const SEEN_MAX = 40;
const text = (v, n) => String(v ?? '').slice(0, n);

export const strainActions = {
  /** A gain to answer (from the app or the GM). @returns true when new. */
  strainAsk(c, data, { id, n, why }) {
    const amount = Math.max(1, Math.min(5, Math.round(Number(n) || 0)));
    if (!data.strain || !id || !Number(n)) return false;
    c.play.strainAsks ??= [];
    if (c.play.strainAsks.some((a) => a.id === id) || (c.play.strainSeen ?? []).includes(id)) return false;
    c.play.strainAsks.push({ id: text(id, 40), n: amount, why: text(why, 120) });
    return true;
  },
  /** Answer the first card: steady = the Mental Strength roll succeeded (halved). */
  strainTake(c, data, { id, steady = false, rollText = '' }) {
    const a = (c.play.strainAsks ?? []).find((x) => x.id === id);
    if (!a) return null;
    c.play.strainAsks = c.play.strainAsks.filter((x) => x !== a);
    c.play.strainSeen = [...(c.play.strainSeen ?? []), a.id].slice(-SEEN_MAX);
    const n = steady ? steadied(a.n) : a.n;
    const r = addStrain(c.play.strain, n, data.strain);
    c.play.strain = r.value;
    if (r.broke) c.play.breaking = { step: 'roll' };
    log(c, `Strain +${n}${steady ? ` (steadied: MST ${rollText})` : rollText ? ` (MST ${rollText}: failed)` : ''} — ${a.why} → ${r.value}/${data.strain.max} ${r.to.name}${r.broke ? ' · BREAKING POINT' : ''}`, n ? 'bad' : 'ok');
    return r;
  },
  /** Strain comes down (a safe scene, downtime, a hand fix). */
  strainRelief(c, data, { n, why }) {
    const before = c.play.strain ?? 0;
    c.play.strain = Math.max(0, before - Math.max(0, Math.round(Number(n) || 0)));
    if (c.play.strain !== before) log(c, `Strain −${before - c.play.strain} — ${why} → ${c.play.strain}/${data.strain.max}`, 'ok');
  },
  /** By hand (a fix), seen by the GM like any hand edit. */
  strainHand(c, data, { delta }) {
    const before = c.play.strain ?? 0;
    c.play.strain = Math.max(0, Math.min(data.strain.max, before + Number(delta)));
    if (c.play.strain !== before) log(c, `By hand: Strain ${before} → ${c.play.strain}`, 'warn', { hand: { kind: 'strain', from: before, to: c.play.strain } });
  },
  /** The breaking point's d6. A Scar waits for its own d6; the rest ends it (Strain drops). */
  breakingRoll(c, data, { roll, rollText = '' }) {
    const res = breakingResult(Number(roll), data.strain);
    if (res.id === 'scar') { c.play.breaking = { step: 'scar', roll: Number(roll) }; log(c, `BREAKING POINT ${rollText}: a Scar — roll for it`, 'bad'); return res; }
    if (res.condition && !c.play.conditions.includes(res.condition)) {
      c.play.conditions = [...c.play.conditions, res.condition];
      c.play.condTimes = stampNew(c.play.conditions, c.play.condTimes, { round: c.play.turn?.round ?? 0, own: true }, data);
    }
    endBreak(c, data, { id: res.id, text: res.text }, `BREAKING POINT ${rollText}: ${res.text}`);
    return res;
  },
  scarRoll(c, data, { roll, rollText = '' }) {
    const s = scarFor(Number(roll), data.strain);
    c.play.scars = [...(c.play.scars ?? []), { id: s.id, text: s.text, at: Date.now() }];
    endBreak(c, data, { id: 'scar', text: s.text }, `SCAR ${rollText}: ${s.text}`);
    return s;
  },
  breakingSeen(c) { c.play.lastBreak = null; },
  /** The GM's durable `strain` message: a card to answer. */
  receiveStrain(c, data, { msg }) { return strainActions.strainAsk(c, data, { id: msg?.id, n: msg?.n, why: msg?.why || 'The GM' }); },
};

function endBreak(c, data, last, line) {
  c.play.strain = data.strain.afterBreak;
  c.play.breaking = null;
  c.play.lastBreak = last;
  log(c, `${line} → Strain ${data.strain.afterBreak}`, 'bad');
}
