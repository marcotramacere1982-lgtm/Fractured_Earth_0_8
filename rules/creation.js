// Character creation: point buy, life events, careers, aging.
// All functions are pure: they take a character and return a new one plus a log.

import { message } from './messages.js';
import { roll } from './dice.js';
import { BASE_ATTRIBUTES } from './stats.js';

const clone = (c) => structuredClone(c);

// ------------------------------------------------------------------ point buy

export function pointsSpent(attributes, rules) {
  const base = BASE_ATTRIBUTES.reduce((s, k) => s + (attributes[k] - rules.start), 0);
  return base - (rules.crs.start - attributes.CRS); // lowering CRS refunds points
}

export function pointsRemaining(attributes, rules) {
  return rules.pool - pointsSpent(attributes, rules);
}

export function canAdjust(attributes, key, delta, rules) {
  const next = attributes[key] + delta;
  if (key === 'CRS') {
    if (next > rules.crs.max || next < 0) return false;
  } else if (next < rules.min || next > rules.max) {
    return false;
  }
  // raising a stat or raising CRS back both cost a point
  return delta < 0 || pointsRemaining(attributes, rules) >= delta;
}

// ------------------------------------------------------------------ events

export function findEvent(eventsData, rollTotal) {
  return eventsData.events.find((e) => e.roll === rollTotal) ?? null;
}

/**
 * Applies an event's effects. `choices` resolves `choice` effects, e.g. { INT: 2 }.
 * Attributes never drop below `floor` during creation; CRS is clamped to [0, 100].
 */
export function applyEvent(character, event, { choices = null, floor = 6, rng = Math.random } = {}) {
  const c = clone(character);
  const fx = event.effects ?? {};
  const log = [];
  const set = (k, v, why) => {
    const before = c.attributes[k];
    const after = k === 'CRS' ? Math.max(0, Math.min(100, v)) : Math.max(floor, v);
    c.attributes[k] = after;
    if (after !== before) log.push(message('attrChange', { attr: k, from: before, to: after }, `${k} ${before} → ${after}${why ? ` (${why})` : ''}`));
  };

  for (const [k, v] of Object.entries(fx.attributes ?? {})) set(k, c.attributes[k] + v);
  for (const [k, v] of Object.entries(fx.minAttributes ?? {})) if (c.attributes[k] < v) set(k, v, `raised to ${v}`);
  for (const [k, v] of Object.entries(fx.setAttributes ?? {})) set(k, v, 'set');
  if (fx.choice) {
    const picked = choices ?? {};
    const total = Object.values(picked).reduce((s, v) => s + v, 0);
    const valid = total === fx.choice.amount && Object.keys(picked).every((k) => fx.choice.of.includes(k));
    if (!valid) throw new Error(`Event ${event.id} needs a choice of +${fx.choice.amount} among ${fx.choice.of.join('/')}`);
    for (const [k, v] of Object.entries(picked)) set(k, c.attributes[k] + v, 'choice');
  }
  for (const [k, v] of Object.entries(fx.rowOffsets ?? {})) {
    c.rowOffsets[k] = (c.rowOffsets[k] ?? 0) + v;
    log.push(message('row', { stat: k.toUpperCase(), n: `${v > 0 ? '+' : ''}${v}` }, `${k.toUpperCase()} row ${v > 0 ? '+' : ''}${v}`));
  }
  if (fx.maxHp) { c.mods.maxHp += fx.maxHp; log.push(message('maxHp', { n: `${fx.maxHp > 0 ? '+' : ''}${fx.maxHp}` }, `Max HP ${fx.maxHp > 0 ? '+' : ''}${fx.maxHp}`)); }
  if (fx.locationHp) { c.mods.locationHp += fx.locationHp; log.push(message('locationHp', { n: fx.locationHp }, `+${fx.locationHp} HP per body location`)); }
  if (fx.criminalRecord === 'add') { c.criminalRecord = true; log.push(message('record', {}, 'Criminal record')); }
  if (fx.criminalRecord === 'clear') { c.criminalRecord = false; log.push(message('recordCleared', {}, 'Criminal record cleared')); }
  if (fx.credential && !c.credentials.includes(fx.credential)) { c.credentials.push(fx.credential); log.push(message('credential', { name: fx.credential }, `Credential: ${fx.credential}`)); }
  if (fx.tag && !c.tags.includes(fx.tag)) { c.tags.push(fx.tag); log.push(message('tag', { tag: fx.tag }, `Tag: ${fx.tag}`)); }
  if (fx.waives) { c.waivers.push(...fx.waives.filter((w) => !c.waivers.includes(w))); log.push(message('waived', {}, 'Career requirements waived')); }
  if (fx.ageDice) {
    const r = roll(fx.ageDice, rng);
    c.age += r.total;
    log.push(message('years', { n: r.total, dice: fx.ageDice }, `+${r.total} years (${fx.ageDice})`));
  }
  return { character: c, log };
}

/** Rolls the event die and returns the matching event. */
export function rollEvent(eventsData, rng = Math.random) {
  const r = roll(eventsData.dice, rng);
  return { roll: r, event: findEvent(eventsData, r.total) };
}

// ------------------------------------------------------------------ careers

/** Requirement checklist for a career. A waiver ("*" or the career id) bypasses every check. */
export function careerChecks(character, career, careersData) {
  const req = career.requirements;
  const checks = [];
  for (const [k, v] of Object.entries(req.minStats ?? {})) checks.push({ label: `${k} ≥ ${v}`, met: character.attributes[k] >= v });
  if (req.maxAge) checks.push({ code: 'maxAge', vars: { n: req.maxAge }, label: `Age ≤ ${req.maxAge}`, met: character.age <= req.maxAge });
  if (req.minCRS) checks.push({ label: `Credit Score ≥ ${req.minCRS}`, met: character.attributes.CRS >= req.minCRS });
  if (req.credential) {
    const name = careersData.credentials.find((c) => c.id === req.credential)?.name ?? req.credential;
    checks.push({ label: name, met: character.credentials.includes(req.credential) });
  }
  if (req.anyCredential) checks.push({ code: 'anyEducation', label: 'Any higher education', met: character.credentials.length > 0 });
  if (req.cleanRecord) checks.push({ code: 'cleanRecord', label: 'No criminal record', met: !character.criminalRecord });
  const waived = character.waivers.includes('*') || character.waivers.includes(career.id);
  return { checks, waived, eligible: waived || checks.every((c) => c.met) };
}

/** Applies a career term (age, modifiers, credential) without the events. */
export function applyCareerTerm(character, career, careersData) {
  const c = clone(character);
  const log = [];
  c.age += careersData.termYears;
  log.push(message('age', { from: character.age, to: c.age }, `Age ${character.age} → ${c.age}`));
  for (const [k, v] of Object.entries(career.modifiers)) {
    const before = c.attributes[k];
    c.attributes[k] = k === 'CRS' ? Math.max(0, Math.min(100, before + v)) : before + v;
    log.push(message('attrChange', { attr: k, from: before, to: c.attributes[k] }, `${k} ${before} → ${c.attributes[k]}`));
  }
  if (career.grantsCredential && !c.credentials.includes(career.grantsCredential)) {
    c.credentials.push(career.grantsCredential);
    log.push(message('credential', { name: career.grantsCredential }, `Credential: ${career.grantsCredential}`));
  }
  // a used waiver for this specific career (or a one-shot "*") is consumed
  c.waivers = c.waivers.filter((w) => w !== career.id && w !== '*');
  c.history.careers.push({ careerId: career.id, events: [] });
  return { character: c, log };
}

// ------------------------------------------------------------------ aging

export function agingBracket(age, agingData) {
  return agingData.brackets.find((b) => age >= b.min && age <= b.max) ?? null;
}

/**
 * Applies the aging bracket for the character's current age.
 * Brackets are cumulative per term: each career term re-applies its bracket's modifiers.
 */
export function applyAging(character, agingData) {
  const bracket = agingBracket(character.age, agingData);
  const c = clone(character);
  const log = [];
  if (!bracket) return { character: c, log, deathCheck: false };
  for (const [k, v] of Object.entries(bracket.modifiers)) {
    const before = c.attributes[k];
    c.attributes[k] = Math.max(1, before + v);
    log.push(message('agingChange', { attr: k, from: before, to: c.attributes[k] }, `${k} ${before} → ${c.attributes[k]} (aging)`));
  }
  for (const [k, cap] of Object.entries(bracket.caps)) {
    if (c.attributes[k] > cap) {
      log.push(message('capped', { attr: k, n: cap }, `${k} capped at ${cap}`));
      c.attributes[k] = cap;
    }
  }
  return { character: c, log, deathCheck: bracket.deathCheck };
}
