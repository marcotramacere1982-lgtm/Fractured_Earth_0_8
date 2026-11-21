// Carrying bulky things (owner, 2026-11-18): two-handed weapons and anything marked `bulky` don't fit in a pocket.
// Everyone carries economy.carry.freeBulky of them without trouble; one bag adds its `bulkyRoom` (only the best bag
// counts: you can't usefully wear two). More than that and you are Slowed — for as long as you stay over. Put
// something down and it ends. Pistols, SMGs, blades, magazines, cash and small loot never count. Pure.

import { findGear } from './economy.js';

/** Is this record bulky? Two-handed weapons, and any record marked `bulky`. */
export const isBulky = (kind, rec) => Boolean(rec?.bulky) || (kind === 'weapon' && rec?.hands === 2);

/** The record an inventory row stands for (a unique carries its own). */
const recordOf = (row, data) => row.unique ?? (row.kind === 'custom' ? row : findGear(row.kind, row.id, data));

/**
 * What a character carries: { bulky, room, over, items: [{ kind, id, name, qty }], bag: record | null, shielded }.
 * shielded: the bag blocks tracked items' signals (a Shielded duffel).
 */
export function carryLoad(inventory, data) {
  const items = [];
  let bag = null;
  for (const row of inventory ?? []) {
    const rec = recordOf(row, data);
    if (!rec || !(row.qty > 0)) continue;
    if (isBulky(row.kind, rec)) items.push({ kind: row.kind, id: row.id, name: rec.name, qty: row.qty });
    if (rec.bulkyRoom > (bag?.bulkyRoom ?? 0) || (rec.bulkyRoom === bag?.bulkyRoom && rec.shields && !bag?.shields)) bag = rec;
  }
  const bulky = items.reduce((n, x) => n + x.qty, 0);
  const room = (data.economy?.carry?.freeBulky ?? 1) + (bag?.bulkyRoom ?? 0);
  return { bulky, room, over: bulky > room, items, bag, shielded: Boolean(bag?.shields) };
}

/** The conditions that count right now: the sheet's own, plus Slowed while carrying too much. */
export const conditionsNow = (conditions, load) => (load?.over && !conditions.includes('slowed') ? [...conditions, 'slowed'] : conditions);
