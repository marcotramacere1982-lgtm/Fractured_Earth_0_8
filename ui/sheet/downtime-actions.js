// Sheet actions for downtime (decision 46): apply what the GM sends at the end of a downtime, and pay a
// debt instalment by choice. Merged into `actions` (./actions.js); same signature: (draft, data, args).
// Healing and armor repair are automatic. Decision 331: payday from the character's job. Decision 332: the player
// ticks one option of their event (locked once chosen; the GM can reopen it), pays what it costs in cash, Credit
// Score or both, rolls what it asks, and the debt pressure moves where the option says so; upkeep is paid the same way.

import { RuleError } from '../../rules/messages.js';
import { emptyDowntime, stageOf } from '../../rules/downtime.js';
import { log } from './actions.js';
import { strainActions } from './strain-actions.js'; // decision 266
import { downtimeRelief } from '../../rules/strain.js';
import { catchRelief, payday, jobOf, monthsBetween, applyFor, hiredAs } from '../../rules/jobs.js'; // decision 331
import { optionMeta, payWays, pressureAfter, applies } from '../../rules/downtime-choice.js'; // decision 332
import { lifestyleUpkeep } from '../../rules/economy.js';

const SEEN_MAX = 60;
const TIMELINE_MAX = 80;
const ensure = (c) => { c.downtime ??= emptyDowntime(); c.play.inbox ??= []; };
const money = (p) => [p.cash ? `$${p.cash}` : '', p.crs ? `${p.crs} CRS` : ''].filter(Boolean).join(' + ') || 'nothing';

const careerLabel = (k) => (k ? `${k.category}${k.name !== 'Standard' ? ` — ${k.name}` : ''}` : 'a job');

/** Hired: the job (a record turns an entry roll into Gig work; the GM's Hire doesn't). */
function hire(c, data, careerId, { anyway = false, why }) {
  const o = c.downtime.open;
  const as = hiredAs(c, careerId, data, { anyway });
  c.job = { ...as, since: o.worldDate ?? null, failures: c.job?.failures ?? {} };
  o.work.state = 'hired';
  o.work.as = as.status;
  const career = data.careers.careers.find((k) => k.id === careerId);
  log(c, `${why} — ${as.status === 'gig' ? `${careerLabel(career)} won't take a record: gig work` : `${as.status} as ${careerLabel(career)}`}`, 'ok');
  return true;
}

/** The timeline entry of a downtime's event ('event' | 'crew'). */
const entryOf = (c, mid, kind) => (c.downtime?.timeline ?? []).find((e) => e.mid === mid && e.kind === kind);

/** Pays { cash, crs } by one of the ways payWays offers; throws when it can't. */
function pay(c, data, cost, way) {
  const w = payWays(cost, c, data).find((x) => x.id === way);
  if (!w) throw new RuleError('payHow', {}, 'Choose how to pay.');
  if (!w.ok) throw new RuleError('cantPay', { cash: w.cash, crs: w.crs }, `You can't pay that way (${money(w)}).`);
  c.play.cash -= w.cash;
  c.attributes.CRS -= w.crs;
  return { cash: w.cash, crs: w.crs };
}

/**
 * Applies the branches of an option that match the roll so far (rolled: undefined before a roll). A cost that comes
 * with the roll's outcome and no way to pay yet is left owed (`chosen.owe`) — the roll is kept, the card asks to pay;
 * the pressure waits for the payment.
 */
function settle(c, data, meta, chosen, rolled, way) {
  const out = [];
  if (meta.cost && !chosen.paid && applies(meta.costWhen, rolled)) {
    if (!way && rolled !== undefined) { chosen.owe = meta.cost; out.push(`owes $${meta.cost}`); return out; }
    chosen.paid = pay(c, data, meta.cost, way);
    delete chosen.owe;
    out.push(`paid ${money(chosen.paid)}`);
  }
  if (meta.pressure && !chosen.pressure && c.debtId && applies(meta.pressureWhen, rolled)) {
    const from = c.downtime.pressure;
    c.downtime.pressure = pressureAfter(from, meta.pressure, data);
    chosen.pressure = { from, to: c.downtime.pressure };
    if (from !== c.downtime.pressure) out.push(`debt pressure ${from} → ${c.downtime.pressure}`);
  }
  return out;
}

export const downtimeActions = {
  /**
   * The GM's downtime report: { mid, duration, durationName, months, worldDate, pressure, upkeep: { cr, crs },
   * healInjuries, event?: { id, title, text, options }, crew?: { id, title, text, options } }. Idempotent by message id.
   */
  applyDowntime(c, data, { msg }) {
    ensure(c);
    if (msg.mid && c.downtime.seen.includes(msg.mid)) return null;
    if (msg.mid) c.downtime.seen = [...c.downtime.seen, msg.mid].slice(-SEEN_MAX);
    if (msg.op === 'crewResult') return downtimeActions.crewResult(c, data, msg); // decision 333
    if (msg.op === 'reopen') return downtimeActions.reopenDowntime(c, data, msg); // decision 332, the GM's button
    if (msg.op === 'job') return downtimeActions.gmJob(c, data, msg); // decision 334
    if (msg.op === 'jobStrike') return downtimeActions.jobStrike(c, data, msg);
    if (msg.op === 'jobAnswer') return downtimeActions.jobAnswer(c, data, msg); // owner 2026-11-16: the GM answers an application
    const mid = msg.mid ?? `dt${Date.now()}`;
    // time passes: HP and armor come back; broken limbs too after long enough
    c.play.hp = null;
    c.play.conditions = c.play.conditions.filter((x) => x !== 'wounded');
    c.play.armorDamage = 0;
    const treated = msg.healInjuries ? (c.play.injuries ?? []).length : 0;
    if (msg.healInjuries) c.play.injuries = [];
    const pressureFrom = c.downtime.pressure;
    if (Number.isInteger(msg.pressure)) c.downtime.pressure = Math.max(0, Math.min(data.downtime.debt.max, msg.pressure));
    const strainFrom = c.play.strain ?? 0;
    if (data.strain && c.play.strain) { // decision 266: rest — by how long, and a better home helps
      const home = lifestyleUpkeep(c.play.lifestyle ?? [], data).entries.find((x) => x.category === 'housing')?.tier ?? 0;
      strainActions.strainRelief(c, data, { n: Math.max(0, downtimeRelief(msg.duration, home, data.strain) + (data.jobs ? catchRelief(c, data) : 0)), why: `downtime (${msg.durationName ?? msg.duration})` });
    }
    // decision 331: payday — the job's pay for the time that passed, debts take their share of the cash
    let pay = null;
    if (data.jobs) {
      const months = msg.months ?? data.downtime.durations.find((d) => d.id === msg.duration)?.months ?? 0;
      const job = jobOf(c, data);
      if (msg.worldDate && c.job?.status && !c.job.since) c.job.since = msg.worldDate; // trust counts from the first payday
      pay = payday(c, data, { months, monthsOnBooks: monthsBetween(c.job?.since, msg.worldDate) });
      if (pay.crs || pay.gross) {
        c.attributes.CRS += pay.crs;
        c.play.cash += pay.cash;
        log(c, `Payday (${job.status}, ${msg.durationName ?? msg.duration}): +${pay.crs} CRS${pay.trust ? ` (trust +${pay.trust}/month)` : ''}${pay.gross ? `, $${pay.gross}${pay.garnished ? ` − $${pay.garnished} garnished = $${pay.cash}` : ''}` : ''}`, 'ok');
      }
    }
    const t = Date.now();
    for (const [kind, e] of [['event', msg.event], ['crew', msg.crew]]) {
      if (e) c.downtime.timeline = [...c.downtime.timeline, { t, mid, kind, ...(kind === 'crew' && msg.batch ? { batch: msg.batch } : {}), id: e.id ?? null, title: e.title, text: e.text, options: e.options ?? [], chosen: null }].slice(-TIMELINE_MAX);
    }
    // what is left to settle on the sheet (decision 332): the choice and the upkeep
    c.downtime.open = { mid, t, durationName: msg.durationName ?? msg.duration, worldDate: msg.worldDate ?? null, work: null, done: false,
      report: { strain: data.strain ? { from: strainFrom, to: c.play.strain ?? 0 } : null, pay, treated }, // the receipt's first lines (owner 2026-11-16)
      upkeep: msg.upkeep?.cr || msg.upkeep?.crs ? { cr: msg.upkeep.cr, crs: msg.upkeep.crs } : null, upkeepPaid: null };
    const stage = stageOf(c.downtime.pressure, data);
    // the report pops up like a GM message
    c.play.inbox = [{
      id: mid, t, private: true, tone: null, kind: 'downtime',
      title: msg.durationName ?? 'Downtime',
      text: [msg.event?.title, msg.crew?.title].filter(Boolean).join(' · '),
      downtime: {
        event: msg.event ?? null, crew: msg.crew ?? null, upkeep: msg.upkeep ?? null, treated, pressure: c.downtime.pressure, pressureFrom, stage: stage?.name ?? null, instalment: stage?.instalment ?? null,
        strain: data.strain ? { from: strainFrom, to: c.play.strain ?? 0 } : null, pay, choose: Boolean(msg.event?.options?.length),
      },
    }, ...c.play.inbox].slice(0, 20);
    log(c, `Downtime (${msg.durationName ?? msg.duration}): HP and armor restored${treated ? `, ${treated} injur${treated === 1 ? 'y' : 'ies'} treated` : ''}${c.debtId ? `, debt pressure ${c.downtime.pressure}` : ''}${msg.event ? ` · event: ${msg.event.title}` : ''}${msg.crew ? ` · crew: ${msg.crew.title}` : ''}`, 'warn');
    return { pressure: c.downtime.pressure, treated };
  },

  /**
   * Decision 332: the player ticks an option of their downtime event. way: how to pay ('cash' | 'crs' | 'mix') when it
   * costs something now. Locked once chosen. @returns the line the GM reads.
   */
  chooseDowntime(c, data, { mid, kind = 'event', index, way }) {
    ensure(c);
    const e = entryOf(c, mid, kind);
    if (!e) throw new RuleError('noDowntime', {}, 'That downtime is gone.');
    if (e.chosen) throw new RuleError('downtimeChosen', {}, 'You already chose — ask the GM to reopen it.');
    const option = e.options[index];
    if (option == null) throw new RuleError('noOption', {}, 'No such option.');
    const meta = optionMeta(option, data);
    const chosen = { i: index, label: meta.label, at: Date.now(), paid: null, pressure: null, roll: null, skills: meta.skills };
    const done = settle(c, data, meta, chosen, undefined, way);
    e.chosen = chosen;
    const line = `Downtime choice (${e.title}): ${meta.label}${done.length ? ` — ${done.join(', ')}` : ''}${meta.skills.length ? ' — a roll to make' : ''}${meta.hook ? ' — could become a mission' : ''}`;
    log(c, line, 'ok');
    return line;
  },

  /** The roll an option asks for: once. way: how to pay a cost that comes with a success (or a failure). */
  downtimeRoll(c, data, { mid, kind = 'event', skill, success, rollText = '', way }) {
    ensure(c);
    const e = entryOf(c, mid, kind);
    if (!e?.chosen) throw new RuleError('noDowntime', {}, 'Choose an option first.');
    if (e.chosen.roll) throw new RuleError('downtimeRolled', {}, 'Already rolled.');
    const meta = optionMeta(e.options[e.chosen.i], data);
    const name = data.skills.skills.find((k) => k.id === skill)?.nameEn ?? data.skills.skills.find((k) => k.id === skill)?.name ?? skill;
    const done = settle(c, data, meta, e.chosen, Boolean(success), way);
    e.chosen.roll = { skill, name, success: Boolean(success), text: rollText };
    const line = `Downtime roll (${e.chosen.label}): ${name} ${rollText} → ${success ? 'success' : 'failure'}${done.length ? ` — ${done.join(', ')}` : ''}`;
    log(c, line, success ? 'ok' : 'bad');
    return line;
  },

  /** Pays what a roll left owed (decision 332); the pressure that came with it follows. */
  payDowntime(c, data, { mid, kind = 'event', way }) {
    const e = entryOf(c, mid, kind);
    if (!e?.chosen?.owe) throw new RuleError('noOwe', {}, 'Nothing to pay.');
    const meta = optionMeta(e.options[e.chosen.i], data);
    const done = settle(c, data, meta, e.chosen, e.chosen.roll?.success, way);
    const line = `Downtime choice (${e.chosen.label}): ${done.join(', ')}`;
    log(c, line, 'ok');
    return line;
  },

  /**
   * Decision 334: the player's work in this downtime, once — look for a job (the career's requirements and entry roll,
   * as in the life path; the GM's waivers count), take gig work, quit, or keep things as they are.
   * what: 'look' (careerId, success, rollText) | 'gig' | 'quit' | 'keep'. @returns the line the GM reads.
   */
  downtimeWork(c, data, { what, careerId = null, success, rollText = '' }) {
    ensure(c);
    const o = c.downtime.open;
    if (!o) throw new RuleError('noDowntime', {}, 'That downtime is gone.');
    if (o.work) throw new RuleError('workDone', {}, 'You already sorted out your work this downtime.');
    const failures = c.job?.failures ?? {};
    const since = o.worldDate ?? null;
    let line;
    if (what === 'look') { // owner 2026-11-16: an application — the GM answers (ask the roll · hire · turn down)
      const career = data.careers.careers.find((k) => k.id === careerId);
      if (!career || applyFor(c, careerId, data).reason === 'offBooks') throw new RuleError('jobNotEligible', {}, "You can't apply for that one.");
      o.work = { what: 'apply', careerId, state: 'pending' };
      line = `Downtime work: applied as ${careerLabel(career)} — waiting for the GM`;
      log(c, line, 'info');
      return line;
    } else if (what === 'gig') {
      if ((c.attributes?.CRS ?? 0) < data.jobs.flaggedBelow) throw new RuleError('jobNotEligible', {}, "You can't apply for that one.");
      c.job = { status: 'gig', careerId: null, since, failures };
      line = 'Downtime work: took gig work';
    } else if (what === 'quit') {
      c.job = { status: 'unregistered', careerId: null, since: null, failures };
      line = 'Downtime work: quit — off the books';
    } else {
      line = `Downtime work: kept things as they are (${jobOf(c, data).status})`;
    }
    o.work = { what, careerId: null, state: 'done' };
    log(c, line, 'ok');
    return line;
  },

  /** Owner 2026-11-16: the GM's answer to an application — answer: 'roll' (they roll on the sheet) | 'hire' | 'down'. */
  jobAnswer(c, data, { careerId, answer }) {
    const o = c.downtime?.open;
    const w = o?.work;
    if (!w || w.what !== 'apply' || w.careerId !== careerId || !['pending', 'roll'].includes(w.state)) return null;
    const career = data.careers.careers.find((k) => k.id === careerId);
    if (answer === 'roll') { w.state = 'roll'; log(c, `From the GM: job application (${careerLabel(career)}) — make the entry roll`, 'info'); return true; }
    if (answer === 'hire') return hire(c, data, careerId, { anyway: true, why: 'From the GM: hired' });
    w.state = 'down';
    log(c, `From the GM: job application (${careerLabel(career)}) — turned down`, 'bad');
    return true;
  },

  /** The entry roll the GM asked for. @returns the line the GM reads. */
  jobRolled(c, data, { success, rollText = '' }) {
    const w = c.downtime?.open?.work;
    if (w?.what !== 'apply' || w.state !== 'roll') throw new RuleError('jobRoll', {}, 'No entry roll to make.');
    const career = data.careers.careers.find((k) => k.id === w.careerId);
    if (!success) {
      w.state = 'down';
      const line = `Downtime work: entry roll as ${careerLabel(career)} — ${rollText} → turned down`;
      log(c, line, 'bad');
      return line;
    }
    hire(c, data, w.careerId, { why: `Downtime work: entry roll — ${rollText} → hired` });
    return c.play.log[0].text;
  },

  /** Owner 2026-11-16: the player has read the receipt — the card goes. */
  closeDowntime(c) {
    if (c.downtime?.open) c.downtime.open.done = true;
    return true;
  },

  /** Decision 334: the GM sets the character's work. job: { status, careerId } or null (back to the life path). */
  gmJob(c, data, { job, worldDate = null }) {
    const failures = c.job?.failures ?? {};
    if (!job?.status || !data.jobs.statuses.some((s) => s.id === job.status)) {
      c.job = Object.keys(failures).length ? { failures } : null;
      log(c, 'From the GM: work — back to what the life path says', 'warn');
      return true;
    }
    const same = c.job?.status === job.status && (c.job?.careerId ?? null) === (job.careerId ?? null);
    c.job = { status: job.status, careerId: job.careerId ?? null, since: same ? c.job.since ?? worldDate : worldDate, failures };
    const career = data.careers.careers.find((k) => k.id === job.careerId);
    log(c, `From the GM: work — ${data.jobs.statuses.find((s) => s.id === job.status).name}${career ? ` (${career.category}${career.name !== 'Standard' ? `, ${career.name}` : ''})` : ''}`, 'warn');
    return true;
  },

  /** Decision 334: the GM noticed an absence at work — a warning, or fired (→ Unregistered). Counted per job. */
  jobStrike(c, data, { outcome = 'warning' }) {
    const job = jobOf(c, data);
    const key = job.careerId ?? job.status;
    const failures = { ...(c.job?.failures ?? {}), [key]: (c.job?.failures?.[key] ?? 0) + 1 };
    if (outcome === 'fired') c.job = { status: 'unregistered', careerId: null, since: null, failures };
    else c.job = { ...(c.job?.status ? c.job : { status: job.status, careerId: job.careerId, since: null }), failures };
    log(c, `From the GM: noticed absence at work — ${outcome === 'fired' ? 'fired' : 'a warning'} (${failures[key]} at this job)`, 'bad');
    return true;
  },

  /** Decision 333: the GM confirms what the crew chose (after the secret vote). msg: { batch, index, votes? } */
  crewResult(c, data, { batch, index, votes = null }) {
    const e = (c.downtime?.timeline ?? []).find((x) => x.kind === 'crew' && x.batch === batch);
    if (!e || e.options[index] == null) return null;
    const label = optionMeta(e.options[index], data).label;
    e.chosen = { i: index, label, at: Date.now(), crew: true, votes };
    log(c, `Crew choice (${e.title}): ${label}`, 'ok');
    return true;
  },

  /** The GM reopens a choice (decision 332): what was paid stays paid — the GM settles any refund by hand. */
  reopenDowntime(c, data, { mid, entry, kind = 'event' }) {
    const e = entryOf(c, entry ?? mid, kind); // from the GM's message, `entry` is the downtime's id (its own mid is the message's)
    if (!e?.chosen) return null;
    log(c, `From the GM: downtime choice reopened (${e.chosen.label})`, 'warn');
    e.chosen = null;
    return true;
  },

  /** Upkeep for the downtime (decision 332): all cash, all Credit Score (official) or half and half. */
  payUpkeep(c, data, { way }) {
    ensure(c);
    const o = c.downtime.open;
    if (!o?.upkeep) throw new RuleError('noUpkeep', {}, 'No upkeep to pay.');
    if (o.upkeepPaid) throw new RuleError('upkeepPaid', {}, 'Upkeep already paid.');
    const ways = upkeepWays(c, o.upkeep);
    const w = ways.find((x) => x.id === way);
    if (!w?.ok) throw new RuleError('cantPay', { cash: w?.cash ?? 0, crs: w?.crs ?? 0 }, "You can't pay that way.");
    c.play.cash -= w.cash;
    c.attributes.CRS -= w.crs;
    o.upkeepPaid = { cash: w.cash, crs: w.crs };
    const line = `Upkeep paid (${o.durationName}): ${money(w)}`;
    log(c, line, 'ok');
    return line;
  },

  /**
   * A debt instalment, paid by the player's choice: the current stage's amount, pressure −1. Owner 2026-11-16: cash,
   * Credit Score or half and half, like every downtime payment (way; cash when left out).
   */
  payInstalment(c, data, { way = 'cash' } = {}) {
    ensure(c);
    if (!c.debtId) throw new RuleError('noDebt', {}, 'No debt chosen.');
    const stage = stageOf(c.downtime.pressure, data);
    if (!stage) throw new RuleError('noPressure', {}, 'No pressure on your debt right now.');
    if (way === 'cash' && c.play.cash < stage.instalment) throw new RuleError('cashTooLow', { have: c.play.cash, need: stage.instalment }, `Not enough cash (${c.play.cash} < ${stage.instalment}).`);
    const paid = pay(c, data, stage.instalment, way);
    c.downtime.pressure -= 1;
    log(c, `Debt instalment paid: ${money(paid)}, pressure ${c.downtime.pressure + 1} → ${c.downtime.pressure}`, 'ok');
    return { paid: stage.instalment, ...paid, pressure: c.downtime.pressure };
  },
};

/** Upkeep's ways to pay: cash, the official Credit Score cost, or half of each. */
export function upkeepWays(c, upkeep) {
  const half = Math.floor(upkeep.cr / 2 / 10) * 10;
  const ways = [
    { id: 'cash', cash: upkeep.cr, crs: 0 },
    { id: 'crs', cash: 0, crs: upkeep.crs },
    ...(half > 0 && upkeep.crs > 1 ? [{ id: 'mix', cash: half, crs: Math.ceil(upkeep.crs / 2) }] : []),
  ];
  return ways.map((w) => ({ ...w, ok: w.cash <= (c.play.cash ?? 0) && w.crs <= (c.attributes.CRS ?? 0) }));
}
