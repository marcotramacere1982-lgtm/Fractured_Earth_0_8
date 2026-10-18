// Sheet actions for downtime (decision 46): apply what the GM sends at the end of a downtime, and pay a
// debt instalment by choice. Merged into `actions` (./actions.js); same signature: (draft, data, args).
// Healing and armor repair are automatic; upkeep and event options are only shown, never charged.

import { RuleError } from '../../rules/messages.js';
import { emptyDowntime, stageOf } from '../../rules/downtime.js';
import { log } from './actions.js';

const SEEN_MAX = 60;
const TIMELINE_MAX = 80;
const ensure = (c) => { c.downtime ??= emptyDowntime(); c.play.inbox ??= []; };

export const downtimeActions = {
  /**
   * The GM's downtime report: { mid, duration, durationName, pressure, upkeep: { cr, crs }, healInjuries,
   * event?: { id, title, text, options }, crew?: { id, title, text, options } }. Idempotent by message id.
   */
  applyDowntime(c, data, { msg }) {
    ensure(c);
    if (msg.mid && c.downtime.seen.includes(msg.mid)) return null;
    if (msg.mid) c.downtime.seen = [...c.downtime.seen, msg.mid].slice(-SEEN_MAX);
    // time passes: HP and armor come back; broken limbs too after long enough
    c.play.hp = null;
    c.play.conditions = c.play.conditions.filter((x) => x !== 'wounded');
    c.play.armorDamage = 0;
    const treated = msg.healInjuries ? (c.play.injuries ?? []).length : 0;
    if (msg.healInjuries) c.play.injuries = [];
    if (Number.isInteger(msg.pressure)) c.downtime.pressure = Math.max(0, Math.min(data.downtime.debt.max, msg.pressure));
    const t = Date.now();
    for (const [kind, e] of [['event', msg.event], ['crew', msg.crew]]) {
      if (e) c.downtime.timeline = [...c.downtime.timeline, { t, kind, id: e.id ?? null, title: e.title, text: e.text, options: e.options ?? [] }].slice(-TIMELINE_MAX);
    }
    const stage = stageOf(c.downtime.pressure, data);
    // the report pops up like a GM message
    c.play.inbox = [{
      id: msg.mid ?? `dt${t}`, t, private: true, tone: null, kind: 'downtime',
      title: msg.durationName ?? 'Downtime',
      text: [msg.event?.title, msg.crew?.title].filter(Boolean).join(' · '),
      downtime: { event: msg.event ?? null, crew: msg.crew ?? null, upkeep: msg.upkeep ?? null, treated, pressure: c.downtime.pressure, stage: stage?.name ?? null, instalment: stage?.instalment ?? null },
    }, ...c.play.inbox].slice(0, 20);
    log(c, `Downtime (${msg.durationName ?? msg.duration}): HP and armor restored${treated ? `, ${treated} injur${treated === 1 ? 'y' : 'ies'} treated` : ''}${c.debtId ? `, debt pressure ${c.downtime.pressure}` : ''}${msg.event ? ` · event: ${msg.event.title}` : ''}${msg.crew ? ` · crew: ${msg.crew.title}` : ''}`, 'warn');
    return { pressure: c.downtime.pressure, treated };
  },

  /** A debt instalment, paid by the player's choice: cash for the current stage, pressure −1. */
  payInstalment(c, data) {
    ensure(c);
    if (!c.debtId) throw new RuleError('noDebt', {}, 'No debt chosen.');
    const stage = stageOf(c.downtime.pressure, data);
    if (!stage) throw new RuleError('noPressure', {}, 'No pressure on your debt right now.');
    if (c.play.cash < stage.instalment) throw new RuleError('cashTooLow', { have: c.play.cash, need: stage.instalment }, `Not enough cash (${c.play.cash} < ${stage.instalment}).`);
    c.play.cash -= stage.instalment;
    c.downtime.pressure -= 1;
    log(c, `Debt instalment paid: −${stage.instalment} cash, pressure ${c.downtime.pressure + 1} → ${c.downtime.pressure}`, 'ok');
    return { paid: stage.instalment, pressure: c.downtime.pressure };
  },
};
