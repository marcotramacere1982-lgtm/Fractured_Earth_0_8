// Official work (decision 331, owner 2026-11-15). A job is the character's place in the system between missions: it
// pays a little Credit Score and a cash wage per month of downtime — never enough to live well (staying in the system
// costs ~7 CRS a month), it only slows the bleed. Where the job comes from: the life path's last career, unless the
// GM (or a downtime choice) has set one (`character.job`). Pure: given the character and data.

import { careerChecks, entryTarget } from './creation.js';

const LADDER = ['employed', 'gig', 'unregistered']; // a criminal record moves one step down

/** The career family a career belongs to (jobs.json `families` by category). */
export function familyOf(careerId, data) {
  const career = data.careers.careers.find((c) => c.id === careerId);
  return career ? data.jobs.families.find((f) => f.categories.includes(career.category)) ?? null : null;
}

/**
 * What the life path suggests: the last career → Employed in it; Student → Student; Criminal / Unemployed →
 * Unregistered; a criminal record one step down; a Credit Score under `flaggedBelow` → Flagged.
 * @returns {{ status: string, careerId: string|null }}
 */
export function suggestJob(character, data) {
  const last = character.history?.careers?.at(-1)?.careerId ?? null;
  const fam = last ? familyOf(last, data) : null;
  let status = !fam || fam.id === 'street' ? 'unregistered' : fam.id === 'student' ? 'student' : 'employed';
  if (character.criminalRecord && status !== 'unregistered') status = status === 'student' ? 'gig' : LADDER[LADDER.indexOf(status) + 1];
  if ((character.attributes?.CRS ?? 0) < data.jobs.flaggedBelow) status = 'flagged';
  return { status, careerId: status === 'employed' || status === 'student' ? last : null };
}

/**
 * The job now: the one set on the character (by the GM or a downtime choice), else the suggestion.
 * @returns {{ status, careerId, since: string|null, set: boolean, failures: object }}
 */
export function jobOf(character, data) {
  const j = character.job;
  if (j?.status) return { status: j.status, careerId: j.careerId ?? null, since: j.since ?? null, set: true, failures: j.failures ?? {} };
  return { ...suggestJob(character, data), since: null, set: false, failures: j?.failures ?? {} };
}

/** Monthly pay of a job: { crs, cash }. Employed / Student by career family, Gig flat, the rest nothing. */
export function payFor(job, data) {
  const J = data.jobs;
  if (job.status === 'gig') return { crs: J.gig.crs, cash: J.gig.cash };
  if (job.status !== 'employed' && job.status !== 'student') return { crs: 0, cash: 0 };
  const fam = familyOf(job.careerId, data);
  return fam ? { crs: fam.crs, cash: fam.cash } : { crs: 0, cash: 0 };
}

/** Whole in-world months between two ISO dates (0 when either is missing). */
export function monthsBetween(from, to) {
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  if (!iso.test(from ?? '') || !iso.test(to ?? '')) return 0;
  const [y1, m1, d1] = from.split('-').map(Number);
  const [y2, m2, d2] = to.split('-').map(Number);
  return Math.max(0, (y2 - y1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0));
}

/** Trust: +step CRS a month for every `everyMonths` unbroken months on the books, at most `max`. Employed only. */
export function trustBonus(job, monthsOnBooks, data) {
  if (job.status !== 'employed') return 0;
  const t = data.jobs.trust;
  return Math.min(t.max, Math.floor((monthsOnBooks ?? 0) / t.everyMonths) * t.step);
}

/** The share of legal cash income a debt takes: the debt's own `garnish`, else the default; 0 without a debt. */
export function garnishOf(character, data) {
  if (!character.debtId) return 0;
  return data.debts.find((d) => d.id === character.debtId)?.garnish ?? data.jobs.garnish;
}

/**
 * Payday for a stretch of downtime. months: how long (downtime.json's duration, in months); monthsOnBooks: unbroken
 * in-world months in this job so far. Fractions of a month round down for CRS, cash is paid pro rata.
 * @returns {{ status, crs, trust, gross, garnished, cash, garnish }}
 */
export function payday(character, data, { months = 0, monthsOnBooks = 0 } = {}) {
  const job = jobOf(character, data);
  const pay = payFor(job, data);
  const trust = trustBonus(job, monthsOnBooks, data);
  const crs = Math.floor((pay.crs + trust) * months);
  const gross = Math.round(pay.cash * months);
  const garnish = garnishOf(character, data);
  const garnished = Math.round(gross * garnish);
  return { status: job.status, careerId: job.careerId, crs, trust, gross, garnished, cash: gross - garnished, garnish };
}

/**
 * Looking for a job in downtime: the career's requirements (as in the life path) and its entry roll. Owner 2026-11-16:
 * the life path's waivers stay in creation — in play the GM is the waiver (Hire). The age cap is left out too.
 * Criminal / Unemployed careers aren't jobs on the books.
 * @returns {{ ok: boolean, checks: object[], roll: object|null, reason?: string }}
 */
export function applyFor(character, careerId, data) {
  character = { ...character, waivers: [] };
  const career = data.careers.careers.find((c) => c.id === careerId);
  if (!career) return { ok: false, checks: [], roll: null, reason: 'unknown' };
  const fam = familyOf(careerId, data);
  if (!fam || fam.id === 'street') return { ok: false, checks: [], roll: null, reason: 'offBooks' };
  if ((character.attributes?.CRS ?? 0) < data.jobs.flaggedBelow) return { ok: false, checks: [], roll: null, reason: 'flagged' };
  // the life path's age cap is about starting young — a downtime job leaves it out
  const { checks: all, waived } = careerChecks(character, career, data.careers);
  const checks = all.filter((x) => x.code !== 'maxAge');
  const ok = waived || checks.every((x) => x.met);
  return { ok, checks, roll: ok ? entryTarget(character, career, data.careers) : null };
}

/**
 * What a hire becomes (owner 2026-11-16): a Student career → Student; else Employed — but an entry roll with a criminal
 * record only gets Gig work. The GM's own Hire (anyway = true) ignores the record.
 */
export function hiredAs(character, careerId, data, { anyway = false } = {}) {
  const career = data.careers.careers.find((k) => k.id === careerId);
  if (career?.category === 'Student') return { status: 'student', careerId };
  if (character.criminalRecord && !anyway) return { status: 'gig', careerId: null };
  return { status: 'employed', careerId };
}

/**
 * What the GM reads about an application (English, GM-only): the career, what's missing, the entry roll, the record,
 * a Flagged score. @returns {{ career, text, roll, ok }}
 */
export function jobApplication(character, careerId, data) {
  const k = data.careers.careers.find((x) => x.id === careerId);
  const career = k ? `${k.category}${k.name !== 'Standard' ? ` — ${k.name}` : ''}` : careerId;
  const a = applyFor(character, careerId, data);
  const roll = entryTarget({ ...character, waivers: [] }, k ?? { id: careerId }, data.careers);
  const bits = [
    a.reason === 'flagged' ? 'Flagged (Credit Score under 10)' : a.ok ? 'requirements met' : `missing: ${a.checks.filter((x) => !x.met).map((x) => x.label).join(', ')}`,
    roll ? `entry roll d20 ≤ ${roll.tn} (${roll.stat})` : 'no entry roll',
    character.criminalRecord && k?.category !== 'Student' ? 'criminal record: a roll only gets gig work' : '',
  ].filter(Boolean);
  return { career, text: `${career} — ${bits.join(' · ')}`, roll, ok: a.ok };
}

/** The lifestyle catches in use (decision 331): the cheapest plans cost you something besides money. */
export function lifestyleCatches(character, data) {
  const entries = data.lifestyle?.entries ?? [];
  return (character.play?.lifestyle ?? []).map((id) => entries.find((e) => e.id === id)).filter((e) => e?.catch).map((e) => ({ id: e.id, ...e.catch }));
}

/** Skill changes from the catches: { skillId: n }. */
export function catchSkills(character, data) {
  const out = {};
  for (const c of lifestyleCatches(character, data)) for (const [k, v] of Object.entries(c.skills ?? {})) out[k] = (out[k] ?? 0) + v;
  return out;
}

/** Strain relief change in downtime from the catches (scrip food: −1). */
export const catchRelief = (character, data) => lifestyleCatches(character, data).reduce((s, c) => s + (c.strainRelief ?? 0), 0);
