// Intel (decision 197): what a character knows about an enemy type. Players see what's evident (type, wound band,
// conditions); Intel adds the numbers, one character at a time. Level 1 Known: armor, HP, squares, weapons.
// Level 2 Studied: also actions, initiative, behaviour, talents, immunities — and a small edge (+1 to hit that type).
// Earned by a Study action (an action and a roll, once per player per fight), from the GM, or from a character's
// background (careers, a few life events); shared with the crew whole. Facts come from the GM's bestiary through
// the table server and are kept on the character. An enemy on the board is matched by its opaque key (the same as
// its picture's), never by the bestiary id. Pure.

import { artKey } from './art.js';

export const KNOWN = 1;
export const STUDIED = 2;

/** The key an enemy type travels under: the same for its picture and its Intel. */
export const intelRef = (id) => artKey(id);

/** The facts a level reveals, from a bestiary entry. A talent marked `secret` never leaves the GM. */
export function intelFacts(e, level) {
  const known = { hp: e.hp, armor: e.armor ?? 0, sqr: e.sqr ?? null, attacks: (e.attacks ?? []).map((a) => ({ name: a.name, type: a.type, damage: a.damage, ...(a.range ? { range: a.range } : {}) })) };
  if (level < STUDIED) return known;
  return { ...known, actions: e.actions ?? 1, init: e.init ?? 0, behaviour: e.behaviour ?? '', talents: (e.talents ?? []).filter((t) => !t.secret).map((t) => ({ name: t.name, desc: t.desc })), immune: e.immune ?? [] };
}

/** One entry for a character's file: what they know about this type, at this level. */
export function intelEntry(e, level, extra = {}) {
  const lv = Math.max(KNOWN, Math.min(STUDIED, level));
  return { id: e.id, ref: intelRef(e.id), name: e.name, tag: e.tag ?? 'organic', elite: e.kind === 'elite', level: lv, facts: intelFacts(e, lv), ...extra };
}

/**
 * A character's file with one more entry: the higher level wins and keeps its facts; a rumour (the GM's own words,
 * level 0, unverified) never lowers what is known, and a real entry clears it.
 */
export function mergeIntel(intel, entry) {
  const now = intel?.[entry.id];
  const keep = now && (entry.rumour ? (now.level ?? 0) > 0 : !now.rumour && (now.level ?? 0) >= entry.level);
  return keep ? intel : { ...(intel ?? {}), [entry.id]: entry };
}

/** What this character knows about the enemy on the board with this key, or null. */
export const intelFor = (intel, ref) => (ref ? Object.values(intel ?? {}).find((x) => x.ref === ref && x.level > 0) ?? null : null);

/** Decision 197: the edge a Studied type gives (to hit), from the data. */
export const studiedEdge = (intel, ref, data) => (intelFor(intel, ref)?.level >= STUDIED ? data.intel.studiedEdge.tn : 0);

/** Next level a Study would give for this enemy, or null when there's nothing more to learn. */
export function studyLevel(intel, ref) {
  const lv = intelFor(intel, ref)?.level ?? 0;
  return lv >= STUDIED ? null : lv + 1;
}

/**
 * Background Intel from a character's life path: `auto` (Known with no roll), `picks` (one roll each on a list:
 * one per career, one per listed life event) and `nemesis` (an elite of the player's choice, no roll).
 * @returns { auto: [ids], picks: [{ source, kind: 'career' | 'event', options: [ids] }], nemesis: [ids] | null }
 */
export function backgroundIntel(c, data) {
  const D = data.intel;
  const careers = [...new Set((c.history?.careers ?? []).map((x) => x.careerId))];
  const events = [...(c.history?.adolescence ?? []), ...(c.history?.careers ?? []).flatMap((x) => x.events ?? [])].map((e) => e.eventId);
  const auto = [...new Set(careers.flatMap((id) => D.careers[id]?.auto ?? []))];
  const picks = [
    ...careers.filter((id) => D.careers[id]?.pick?.length).map((id) => ({ source: id, kind: 'career', options: D.careers[id].pick.filter((x) => !auto.includes(x)) })),
    ...[...new Set(events)].filter((id) => D.events[id]).map((id) => ({ source: id, kind: 'event', options: D.events[id].filter((x) => !auto.includes(x)) })),
  ].filter((p) => p.options.length);
  const nemesis = events.some((id) => D.nemesis.includes(id)) ? D.nemesisFrom : null;
  return { auto, picks, nemesis };
}

/**
 * Checks a background answer against the life path (the server does it before it hands out facts).
 * answer: { picks: [{ source, id, ok }], nemesis: id | null } → the ids earned, Known.
 */
export function backgroundEarned(c, data, answer) {
  const bg = backgroundIntel(c, data);
  const out = new Set(bg.auto);
  for (const p of answer?.picks ?? []) {
    const slot = bg.picks.find((x) => x.source === p.source);
    if (slot && p.ok && slot.options.includes(p.id)) out.add(p.id);
  }
  if (bg.nemesis && bg.nemesis.includes(answer?.nemesis)) out.add(answer.nemesis);
  return [...out];
}
