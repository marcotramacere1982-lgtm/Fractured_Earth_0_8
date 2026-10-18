// Character creation flow: quiz scoring, adolescence rolls, career terms.
// Every function returns { character, entries, pending } where `entries` are log lines for the console
// and `pending` are events that need a player choice before they can be applied.

import { roll } from './dice.js';
import { findEvent, applyEvent, careerChecks, applyCareerTerm, applyAging } from './creation.js';
import { findSubclass } from './classes.js';

// ------------------------------------------------------------------ quiz

/** Ranks subclasses by quiz answers ({ q1: 'A', ... }). Returns [{ key: 'soldier.officer', classId, subclassId, score }]. */
export function scoreQuiz(answers, quizData) {
  const totals = {};
  for (const q of quizData.questions) {
    const opt = q.options.find((o) => o.id === answers[q.id]);
    if (!opt) continue;
    for (const [key, pts] of Object.entries(opt.scores)) totals[key] = (totals[key] ?? 0) + pts;
  }
  return Object.entries(totals)
    .map(([key, score]) => { const [classId, subclassId] = key.split('.'); return { key, classId, subclassId, score }; })
    .sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));
}

// ------------------------------------------------------------------ log entries

/** A console line: English text (tests, fallback) plus an optional code + vars the screen translates. */
const line = (kind, text, code = null, vars = {}) => (code ? { kind, text, code, vars } : { kind, text });
const fromMessage = (kind, m) => line(kind, m.text, m.code, m.vars);

function describeEvent(e, rollResult, manual) {
  const head = manual
    ? line('warn', `[MANUAL] Event #${e.roll} selected`, 'manualPick', { n: e.roll })
    : line('roll', `Rolling ${rollResult.expr}… [${rollResult.rolls.join(', ')}] = ${rollResult.total}`, 'rolling', { expr: rollResult.expr, rolls: rollResult.rolls.join(', '), total: rollResult.total });
  return [head, line('event', `${e.name} — ${e.text}`)];
}

/**
 * Applies one event, or returns it as pending if it needs a choice.
 * pick = { roll } to force a specific event (advanced mode).
 */
export function resolveEvent(character, eventsData, data, { rng = Math.random, pick = null } = {}) {
  const rollResult = pick ? null : roll(eventsData.dice, rng);
  const event = findEvent(eventsData, pick ? pick.roll : rollResult.total);
  const entries = describeEvent(event, rollResult, Boolean(pick));
  if (event.effects?.choice) {
    entries.push(line('warn', `Choose +${event.effects.choice.amount} among ${event.effects.choice.of.join(' / ')}.`, 'chooseAmong', { n: event.effects.choice.amount, of: event.effects.choice.of.join(' / ') }));
    return { character, entries, pending: [event], record: { roll: event.roll, eventId: event.id } };
  }
  const res = applyEvent(character, event, { rng });
  res.log.forEach((m) => entries.push(fromMessage('mod', m)));
  if (!res.log.length) entries.push(line('dim', 'No mechanical effect.', 'noEffect'));
  return { character: res.character, entries, pending: [], record: { roll: event.roll, eventId: event.id } };
}

/** Applies a previously pending choice event. */
export function resolveChoice(character, event, choices) {
  const res = applyEvent(character, event, { choices });
  return { character: res.character, entries: [line('mod', 'Choice applied:', 'choiceApplied'), ...res.log.map((m) => fromMessage('mod', m))] };
}

// ------------------------------------------------------------------ adolescence

export function runAdolescence(character, data, { rng = Math.random, picks = null } = {}) {
  const t = data.adolescence;
  let c = character;
  const entries = [line('sys', `> ADOLESCENCE.EXE — ${t.rolls} life events up to age ${t.startAge}`, 'adolescenceStart', { n: t.rolls, age: t.startAge })];
  const pending = [];
  for (let i = 0; i < t.rolls; i++) {
    entries.push(line('sys', `> Event ${i + 1}/${t.rolls}`, 'eventOf', { i: i + 1, n: t.rolls }));
    const r = resolveEvent(c, t, data, { rng, pick: picks?.[i] ?? null });
    c = { ...r.character, history: { ...r.character.history, adolescence: [...r.character.history.adolescence, r.record] } };
    entries.push(...r.entries);
    pending.push(...r.pending);
  }
  entries.push(line('sys', '> Adolescence complete.', 'adolescenceDone'));
  return { character: c, entries, pending };
}

// ------------------------------------------------------------------ careers

/** Whether the character can take another career term (an event may have ended the career phase). */
export const careerClosed = (character) => character.tags.includes('Career ended');

/**
 * One full career term: requirements → term (+2 years, modifiers) → events → aging.
 * opts: { rng, picks: [{roll}, {roll}], ignoreRequirements }
 */
export function runCareerTerm(character, career, data, { rng = Math.random, picks = null, ignoreRequirements = false } = {}) {
  const entries = [line('sys', `> CAREER.EXE — ${career.category}${career.name !== 'Standard' ? ` / ${career.name}` : ''}`)];
  const { eligible, checks } = careerChecks(character, career, data.careers);
  if (!eligible && !ignoreRequirements) {
    const missing = checks.filter((x) => !x.met);
    return { character, entries: [...entries, line('bad', `Requirements not met: ${missing.map((x) => x.label).join(', ')}`, 'reqNotMet', { list: missing })], pending: [], ok: false };
  }
  if (!eligible) entries.push(line('warn', '[MANUAL] Requirements ignored.', 'reqIgnored'));

  const term = applyCareerTerm(character, career, data.careers);
  let c = term.character;
  term.log.forEach((m) => entries.push(fromMessage('mod', m)));

  const pending = [];
  const termIdx = c.history.careers.length - 1;
  for (let i = 0; i < data.careers.eventsPerTerm; i++) {
    entries.push(line('sys', `> Term event ${i + 1}/${data.careers.eventsPerTerm}`, 'termEventOf', { i: i + 1, n: data.careers.eventsPerTerm }));
    const r = resolveEvent(c, data.careerEvents, data, { rng, pick: picks?.[i] ?? null });
    c = r.character;
    const careers = c.history.careers.map((h, k) => (k === termIdx ? { ...h, events: [...h.events, r.record] } : h));
    c = { ...c, history: { ...c.history, careers } };
    entries.push(...r.entries);
    pending.push(...r.pending);
    const ev = data.careerEvents.events.find((e) => e.id === r.record.eventId);
    if (ev?.effects?.endsCareer && !c.tags.includes('Career ended')) {
      c = { ...c, tags: [...c.tags, 'Career ended'] };
      entries.push(line('bad', 'Career phase over: you hit the streets now.', 'careerOver'));
    }
  }

  entries.push(line('sys', `> Aging check — age ${c.age}`, 'agingCheck', { age: c.age }));
  const aging = applyAging(c, data.aging);
  c = aging.character;
  aging.log.forEach((m) => entries.push(fromMessage('mod', m)));
  if (!aging.log.length) entries.push(line('dim', 'No aging effects.', 'noAging'));
  if (aging.deathCheck) entries.push(line('bad', 'DEATH CHECK required at this age — ask the GM.', 'deathCheck'));
  entries.push(line('sys', '> Term complete.', 'termDone'));
  return { character: c, entries, pending, ok: true };
}

// ------------------------------------------------------------------ class recommendation helpers

export function recommendationLabel(rec, classesData) {
  const found = findSubclass(classesData, rec.subclassId);
  return found ? `${found.cls.name} · ${found.sub.name}` : rec.key;
}
