// What a fallen enemy leaves (owner, 2026-11-18; decision 345). An entry's preset `loot` (cleanLoot format, plus a
// `cashRoll` like "2d20" rolled once when the body is made) and, for the NPC generator's entries, the weapons they
// carried (`gear.weapons`). Weapons drop by their rarity (economy.bodyLoot.dropChance %): junk always, the best
// almost never — when one doesn't, a line says why. A weapon with a lock (smart / biometric) arrives as its own copy:
// locked, tracked and hot until it's unlocked and washed. Pure: rng is passed in.

import { roll } from './dice.js';
import { findGear, magazineId } from './economy.js';

export const LOCKS = ['smart', 'biometric'];
const DICE = /^\d{0,2}d\d{1,3}([+-]\d{1,3})?$/i;

/** A cash roll as written ("2d20", "1d6+5"), or null. */
export const cashRollOf = (v) => (typeof v === 'string' && DICE.test(v.replace(/\s+/g, '')) ? v.replace(/\s+/g, '') : null);

/** Does this weapon drop usable? d100 against the chance for its rarity. */
export function drops(rec, data, rng = Math.random) {
  const pct = data.economy?.bodyLoot?.dropChance?.[rec?.rarity ?? 'F'] ?? 100;
  return pct >= 100 || Math.floor(rng() * 100) + 1 <= pct;
}

/** A looted locked weapon: its own copy, locked, tracked and hot (decision 345). */
export function lockedCopy(rec, lock, from) {
  return {
    ...structuredClone(rec), unique: true, forgedFrom: rec.forgedFrom ?? rec.id, rarity: rec.unique ? rec.rarity : 'U',
    lock, tracked: true, hot: true,
    note: `${lock === 'biometric' ? 'Biometric lock' : 'Smart lock'} · tracked${from ? ` · taken from ${from}` : ''}`.slice(0, 120),
  };
}

const WHY = ['wrecked in the fight', 'its owner bricked it with a last input', 'lost in the fall'];

/**
 * The body's loot (cleanLoot shape) and the lines that tell the GM what didn't make it.
 * template: the bestiary entry · name: the fallen's label ("Watch Patrolman #2")
 */
export function bodyLoot(template, name, data, rng = Math.random) {
  const preset = template?.loot ?? {};
  const lines = [];
  const rollCash = (part) => (Number(part?.cash) || 0) + (cashRollOf(part?.cashRoll) ? Math.max(0, roll(cashRollOf(part.cashRoll), rng).total) : 0);
  const rowsOf = (part) => (part?.items ?? []).flatMap((r) => {
    if (r.kind !== 'weapon') return [r];
    const rec = r.unique ?? findGear('weapon', r.id, data);
    if (!rec) return [];
    if (!drops(rec, data, rng)) { lines.push(`${rec.name}: ${WHY[Math.floor(rng() * WHY.length)]}`); return []; }
    return LOCKS.includes(r.lock) || LOCKS.includes(rec.lock)
      ? [{ kind: 'weapon', id: 'unique', name: rec.name, qty: 1, unique: lockedCopy(rec, LOCKS.includes(r.lock) ? r.lock : rec.lock, name) }]
      : [r];
  });
  // the generator's entries: the weapons they carried drop too, with a magazine when they take one
  const carried = (template?.gear?.weapons ?? []).flatMap((g) => {
    const rec = g.unique ?? findGear('weapon', g.id, data);
    if (!rec) return [];
    const row = g.unique ? { kind: 'weapon', id: 'unique', name: rec.name, qty: 1, unique: g.unique, ...(LOCKS.includes(g.lock) ? { lock: g.lock } : {}) } : { kind: 'weapon', id: rec.id, name: rec.name, qty: 1, ...(LOCKS.includes(g.lock) ? { lock: g.lock } : {}) };
    const mag = rec.magSize ? [{ kind: 'ammo', id: magazineId(rec.forgedFrom ?? rec.id), name: '', qty: 1 }] : [];
    return [row, ...mag];
  });
  const seen = { items: rowsOf({ items: [...carried, ...(preset.items ?? [])] }), cash: rollCash(preset) };
  const hidden = { items: rowsOf(preset.hidden), cash: rollCash(preset.hidden), check: preset.hidden?.check ?? 'skill:perception_awareness' };
  return { loot: { ...seen, hidden }, lines };
}

/** Is there anything at all on the body? */
export const anyLoot = (l) => Boolean(l && (l.items.length || l.cash || l.hidden.items.length || l.hidden.cash));

/** Tracked things a character carries that are calling home now: none while a shielding bag carries them. */
export function trackedCarried(inventory, shielded = false) {
  if (shielded) return [];
  return (inventory ?? []).filter((r) => r.qty > 0 && (r.unique?.tracked || r.tracked)).map((r) => r.unique?.name ?? r.name ?? r.id);
}

/** A smart lock broken in the field: it fires now — still tracked and hot until it's washed. Biometric locks don't break. */
export function unlocked(rec) {
  if (rec?.lock !== 'smart') return null;
  const { lock: _gone, ...rest } = rec;
  return { ...rest, note: String(rec.note ?? '').replace(/^Smart lock/, 'Lock broken').slice(0, 120) };
}
