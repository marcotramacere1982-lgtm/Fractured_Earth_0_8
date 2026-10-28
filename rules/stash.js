// Stashes (decision 144): somewhere safe to leave gear and cash — a character's own stash now, the crew's later.
// A stash holds rows shaped like inventory rows ({ kind, id, qty, official?, name?, note?, unique? }). Pure.

import { nextIsOfficial } from './economy.js';

export const emptyStash = () => ({ name: '', cash: 0, items: [] });

/** One unit of a row as it travels: a registered unit stays registered, a custom item keeps its name, a unique its stats. */
export function unitOf(row) {
  return {
    kind: row.kind,
    id: row.id,
    ...(nextIsOfficial(row) ? { official: true } : {}),
    ...(row.kind === 'custom' ? { name: row.name, note: row.note ?? '' } : {}),
    ...(row.unique ? { unique: row.unique } : {}),
  };
}

/** Puts one unit into a list of rows (stacks with the same kind + id). */
export function putUnit(list, unit) {
  const row = list.find((x) => x.kind === unit.kind && x.id === unit.id);
  if (row) row.qty += 1;
  else list.push({ kind: unit.kind, id: unit.id, qty: 1, ...(unit.kind === 'custom' ? { name: unit.name, note: unit.note } : {}), ...(unit.unique ? { unique: unit.unique } : {}) });
  const to = row ?? list.at(-1);
  if (unit.official) to.official = (to.official ?? 0) + 1;
  return list;
}

/** Takes one unit out of a list of rows (street units leave first, as when selling). @returns the unit, or null. */
export function takeUnit(list, kind, id) {
  const i = list.findIndex((x) => x.kind === kind && x.id === id);
  if (i < 0) return null;
  const row = list[i];
  const unit = unitOf(row);
  row.qty -= 1;
  if ((row.official ?? 0) > row.qty) row.official = row.qty;
  if (!row.official) delete row.official;
  if (row.qty <= 0) list.splice(i, 1);
  return unit;
}

/** How much cash can move: a whole, positive amount no bigger than what's there. @returns 0 when nothing can. */
export const cashToMove = (amount, available) => Math.max(0, Math.min(Math.floor(Number(amount) || 0), available));
