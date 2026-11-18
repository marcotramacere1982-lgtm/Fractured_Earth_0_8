// Downtime choices (decision 332, owner 2026-11-15). A downtime event's options are plain sentences
// ("**Pay the instalment now** — $300; the pressure eases a step."). The player ticks one on the sheet; this reads
// what it costs, what roll it asks, and what it does to the debt pressure, so the sheet can settle it and log it.
// Anything the words don't say stays the GM's call. Pure: text and data in, plain objects out.

import { creditScoreCost } from './economy.js';

const SEP = /[;:,—(]|\. /;

/** The clause around a position: from the last separator before it to the next one after it. */
function clauseAt(text, at) {
  let a = at; while (a > 0 && !SEP.test(text[a - 1])) a--;
  let b = at; while (b < text.length && !SEP.test(text[b])) b++;
  return text.slice(a, b);
}

/** Splits an option's tail into what happens anyway, on a success ("if it works") and on a failure ("if not"). */
function branches(tail) {
  const ok = tail.search(/if it works/i);
  if (ok < 0) return { always: tail, success: '', failure: '' };
  const rest = tail.slice(ok);
  const no = rest.search(/if not/i);
  return { always: tail.slice(0, ok), success: no < 0 ? rest : rest.slice(0, no), failure: no < 0 ? '' : rest.slice(no) };
}

const money = (s) => {
  for (const m of s.matchAll(/\$([\d,]+)/g)) {
    if (/next downtime|instalment is|interest/i.test(clauseAt(s, m.index))) continue; // a warning, not a price
    return Number(m[1].replace(/,/g, ''));
  }
  return null;
};
const pressureIn = (s) => {
  if (/pressure eases a step/i.test(s)) return { ease: 1 };
  const to = /pressure drops (?:right )?(?:back )?to (\d)/i.exec(s);
  return to ? { to: Number(to[1]) } : null;
};
const crsIn = (s) => { const m = /CRS\s*[−-]\s*(\d+)/.exec(s); return m ? Number(m[1]) : null; };

/** The skills a "… roll" names: "a Mechanics or Electronics roll" → both. */
function skillsIn(text, skills) {
  const out = [];
  for (const m of text.matchAll(/\broll\b/gi)) {
    const clause = clauseAt(text, m.index).toLowerCase();
    for (const k of skills) {
      const parts = k.name.replace(/\s*\(.*\)$/, '').split(' / ').map((p) => p.toLowerCase());
      if (parts.some((p) => new RegExp(`\\b${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(clause)) && !out.includes(k.id)) out.push(k.id);
    }
  }
  return out;
}

/**
 * What an option means. @returns {{ label, text, cost, costWhen, pressure, pressureWhen, skills, hook, wayOut, crsRisk }}
 * `*When`: 'always' | 'success' | 'failure' — a cost or a pressure change that depends on the roll.
 */
export function optionMeta(text, data) {
  const s = String(text ?? '');
  const label = /\*\*(.+?)\*\*/.exec(s)?.[1] ?? s.split('—')[0].trim();
  const tail = s.includes('—') ? s.slice(s.indexOf('—') + 1) : s;
  const b = branches(tail);
  const find = (fn) => { for (const w of ['always', 'success', 'failure']) { const v = b[w] ? fn(b[w]) : null; if (v != null) return [v, w]; } return [null, null]; };
  const [cost, costWhen] = find(money);
  const [pressure, pressureWhen] = find(pressureIn);
  const [crsRisk] = find(crsIn);
  return {
    label, text: s, cost, costWhen, pressure, pressureWhen,
    skills: skillsIn(tail, data.skills?.skills ?? []),
    hook: /could become a mission/i.test(s), wayOut: /\(a way out\)/i.test(s), crsRisk,
  };
}

/** The Credit Score a cash amount costs paid officially (economy.official, scrutiny `downtime`). */
export const crsFor = (cr, data) => (cr > 0 ? creditScoreCost({ cost: { cr } }, 'downtime', data.economy) : 0);

/**
 * The ways to pay an amount: all cash, all Credit Score, half and half. Each { id, cash, crs, ok }.
 * ok: the character has the cash, and the Credit Score stays at 0 or above.
 */
export function payWays(cost, character, data) {
  if (!cost) return [];
  const cash = character.play?.cash ?? 0;
  const score = character.attributes?.CRS ?? 0;
  const half = Math.floor(cost / 2 / 10) * 10;
  const ways = [
    { id: 'cash', cash: cost, crs: 0 },
    { id: 'crs', cash: 0, crs: crsFor(cost, data) },
    ...(half > 0 ? [{ id: 'mix', cash: half, crs: crsFor(cost - half, data) }] : []),
  ];
  return ways.map((w) => ({ ...w, ok: w.cash <= cash && w.crs <= score }));
}

/** The pressure after an option's change (0…max). */
export function pressureAfter(now, change, data) {
  if (!change) return now;
  const max = data.downtime.debt.max;
  return Math.max(0, Math.min(max, change.to != null ? Math.min(now, change.to) : now - (change.ease ?? 0)));
}

/** Whether a branch applies given the roll: always, or the roll's outcome matches. */
export const applies = (when, rolled) => when === 'always' || (when === 'success' && rolled === true) || (when === 'failure' && rolled === false);
