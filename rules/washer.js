// The washer (decision 143): a fixer who turns cash into Credit Score (fake salaries) or Credit Score into cash
// (borrowing against your score). The GM makes each offer — direction, cash per CRS point, the fixer's commission,
// how many points at most — and the player picks how many points to take. Pure.

import { paying, paid } from './haggle.js';

export const DIRECTIONS = ['wash', 'cashout', 'gun']; // wash: cash → CRS · cashout: CRS → cash · gun: a hot weapon made clean (decision 345)


const int = (v, min, max, fallback) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback; };

/** An offer as it travels and is kept on the sheet: known direction, sane numbers, a short note. */
export function normalizeDeal(raw, economy) {
  const d = economy.washer;
  const direction = DIRECTIONS.includes(raw?.direction) ? raw.direction : 'wash';
  return {
    id: String(raw?.id ?? '').slice(0, 40) || `deal-${Date.now()}`,
    direction,
    rate: int(raw?.rate, 1, 100000, d[direction].rate ?? 1),
    commission: int(raw?.commission, 0, 90, direction === 'gun' ? d.gun.share : d.commission),
    max: int(raw?.max, 1, 20, d.max),
    ...(direction === 'gun' ? { risk: int(raw?.risk, 0, 20, d.gun.risk) } : {}),
    ...(raw?.note ? { note: String(raw.note).trim().slice(0, 140) } : {}),
    ...(['easy', 'tough'].includes(raw?.mood) ? { mood: raw.mood } : {}), // decision 346: how the fixer takes a haggle
  };
}

/** Decision 345: the hot weapons a washer can clean — looted copies that are hot, tracked or locked. */
export const washable = (inventory) => (inventory ?? []).filter((r) => r.kind === 'weapon' && r.unique && (r.unique.hot || r.unique.tracked || r.unique.lock));

/**
 * Washing a hot gun (decision 345): the fixer takes a share (`commission` %) of its list price, unlocks it, kills its
 * tracker and gives it a clean history. Then a d20: at or under `risk`, the trail leads back to the crew.
 * @returns { ok, why?, fee } — why: 'noItem' | 'noCash'
 */
export function gunQuote(deal, rec, cash) {
  if (!rec) return { ok: false, why: 'noItem', fee: 0 };
  const fee = paying(Math.ceil(((rec.cost?.cr ?? 0) * deal.commission) / 100), deal.haggle?.pct ?? 0); // decision 346: after a haggle
  return cash < fee ? { ok: false, why: 'noCash', fee } : { ok: true, fee };
}

/** The washed weapon: no lock, no tracker, not hot — yours now. */
export function washed(rec) {
  const { lock: _l, tracked: _t, hot: _h, ...rest } = rec;
  return { ...rest, note: 'Washed: a clean history, yours now' };
}

/**
 * What taking `points` of an offer does. Washing: you pay points × rate plus the commission, your score goes up.
 * Cashing out: your score goes down, you get points × rate minus the commission. Commissions round in the fixer's favour.
 * @returns { ok, why?, points, base, fee, cash (change), crs (change) } — why: 'max' | 'noCash' | 'cap' | 'below'
 */
export function dealQuote(deal, points, { cash, crs }, cap) {
  const n = int(points, 1, deal.max, 1);
  const base = n * deal.rate;
  const fee = Math.ceil((base * deal.commission) / 100);
  const pct = deal.haggle?.pct ?? 0; // decision 346: a haggle moves the total, in the player's favour or not
  const out = deal.direction === 'wash'
    ? { points: n, base, fee, cash: -paying(base + fee, pct), crs: n, ...(pct ? { pct } : {}) }
    : { points: n, base, fee, cash: paid(base - fee, pct), crs: -n, ...(pct ? { pct } : {}) };
  const why = Number(points) > deal.max ? 'max'
    : deal.direction === 'wash' && cash < -out.cash ? 'noCash'
      : deal.direction === 'wash' && crs + n > cap ? 'cap'
        : deal.direction === 'cashout' && crs - n < 0 ? 'below' : null;
  return why ? { ok: false, why, ...out } : { ok: true, ...out };
}
