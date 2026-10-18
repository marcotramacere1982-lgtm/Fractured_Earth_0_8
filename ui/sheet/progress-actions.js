// Sheet actions for advancement and talents (decision 44): buy a talent, raise an attribute, use a
// talent at the table, and apply what the GM sends (XP, a gifted talent, level-up opened / closed).
// Merged into `actions` (./actions.js); same signature: (draft character, data, args).

import { RuleError } from '../../rules/messages.js';
import { roll, formatRoll } from '../../rules/dice.js';
import { talentStatus, canRaise, progressStatus, emptyProgress } from '../../rules/progress.js';
import { deriveSheet } from '../../state/character.js';
import { log, spend } from './actions.js';

const SEEN_MAX = 60;
const ensure = (c) => { c.progress ??= emptyProgress(); c.play.talentUses ??= {}; };
const talentOf = (data, id) => {
  const t = data.talents.find((x) => x.id === id);
  if (!t) throw new Error(`Unknown talent: ${id}`);
  return t;
};
const cap = (s) => s[0].toUpperCase() + s.slice(1);

/** Once-per-round / combat / mission talents become available again. */
export function resetUses(c, data, scope) {
  ensure(c);
  for (const t of data.talents) if (t.use === scope) delete c.play.talentUses[t.id];
}

/** One-off effects of taking a talent (Clean Slate). */
function onTake(c, t) {
  const fx = t.effects?.onBuy;
  if (!fx) return '';
  if (fx.crs) c.attributes.CRS = Math.min(100, c.attributes.CRS + fx.crs);
  if (fx.clearRecord) c.criminalRecord = false;
  return ` (Credit Score +${fx.crs ?? 0}${fx.clearRecord ? ', record cleared' : ''})`;
}

export const progressActions = {
  /** Spends a talent point at level-up. */
  buyTalent(c, data, { id }) {
    ensure(c);
    const t = talentOf(data, id);
    const st = talentStatus(c, t, data);
    if (!st.ok) throw new RuleError(`talent${cap(st.code)}`, st.vars, `${t.name}: not available (${st.code}).`);
    c.progress.talents.push(id);
    log(c, `Talent: ${t.name}${onTake(c, t)}`, 'ok');
  },
  /** Spends an attribute point at level-up (+1, normal caps and aging still apply later). */
  raiseAttribute(c, data, { key }) {
    ensure(c);
    if (!data.attributes.attributes.some((a) => a.id === key) || key === 'CRS') throw new Error(`Not a raisable attribute: ${key}`);
    const ok = canRaise(c, data);
    if (!ok.ok) throw new RuleError(`talent${cap(ok.code)}`, {}, 'No attribute point to spend right now.');
    c.attributes[key] += 1;
    c.progress.raises.push(key);
    log(c, `Level-up: ${key} +1 (now ${c.attributes[key]})`, 'ok');
  },
  /**
   * Uses a once-per-round / combat / mission talent. Second Wind heals (and takes an action in combat),
   * Poker Face nudges the pendulum; the others are marked as used for the GM to see.
   * @returns {{ rolled?: object }} for the screen
   */
  useTalent(c, data, { id }) {
    ensure(c);
    const t = talentOf(data, id);
    if (!progressStatus(c, data).owned.includes(id)) throw new Error(`${t.name} is not one of your talents.`);
    if ((c.play.talentUses[id] ?? 0) >= 1) throw new RuleError('talentUsed', { name: t.name, scope: t.use }, `${t.name}: already used this ${t.use}.`);
    let detail = '';
    let rolled = null;
    if (t.effects?.heal) {
      const prefix = spend(c, data, { kind: 'other', name: t.name });
      const s = deriveSheet(c, data);
      rolled = roll(t.effects.heal);
      const hp = Math.min(s.hp.max, s.hp.current + rolled.total);
      c.play.hp = hp >= s.hp.max ? null : hp;
      detail = `${prefix ? ` ${prefix.trim()}` : ''} healed ${formatRoll(rolled)}`;
    }
    if (t.effects?.pendulumToZero && c.classId === 'smuggler') {
      const p = c.play.resources.pendulum ?? 0;
      c.play.resources.pendulum = p > 0 ? p - 1 : p < 0 ? p + 1 : 0;
      detail = ` pendulum ${p} → ${c.play.resources.pendulum}`;
    }
    c.play.talentUses[id] = (c.play.talentUses[id] ?? 0) + 1;
    log(c, `Talent used: ${t.name}${detail}`, 'warn');
    return { rolled };
  },
  /**
   * A `progress` message from the GM: { xp, reason, gift, open, mission }. Idempotent by message id.
   * @returns a summary for the screen, or null when it was already applied
   */
  applyProgress(c, data, { msg }) {
    ensure(c);
    if (msg.mid && c.progress.seen.includes(msg.mid)) return null;
    if (msg.mid) c.progress.seen = [...c.progress.seen, msg.mid].slice(-SEEN_MAX);
    const before = progressStatus(c, data).level;
    const out = { xp: 0, levelUp: false, gift: null, open: null };
    if (Number(msg.xp)) {
      c.progress.xp = Math.max(0, c.progress.xp + Number(msg.xp));
      out.xp = Number(msg.xp);
      log(c, `XP ${out.xp > 0 ? '+' : ''}${out.xp}${msg.reason ? ` — ${msg.reason}` : ''} (total ${c.progress.xp})`, 'ok');
    }
    if (msg.gift) {
      const t = talentOf(data, msg.gift);
      if (!progressStatus(c, data).owned.includes(t.id)) {
        c.progress.gifts.push(t.id);
        out.gift = t.name;
        log(c, `Talent gift from the GM: ${t.name}${onTake(c, t)}`, 'ok');
      }
    }
    if ('open' in msg) {
      c.progress.open = Boolean(msg.open);
      out.open = c.progress.open;
      log(c, c.progress.open ? 'The GM opened level-up (downtime)' : 'The GM closed level-up', 'warn');
    }
    if (msg.mission) resetUses(c, data, 'mission');
    out.levelUp = progressStatus(c, data).level > before;
    if (out.levelUp) log(c, `Level ${progressStatus(c, data).level} reached`, 'ok');
    return out;
  },
};
