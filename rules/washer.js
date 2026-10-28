// The washer (decision 143): a fixer who turns cash into Credit Score (fake salaries) or Credit Score into cash
// (borrowing against your score). The GM makes each offer — direction, cash per CRS point, the fixer's commission,
// how many points at most — and the player picks how many points to take. Pure.

export const DIRECTIONS = ['wash', 'cashout']; // wash: cash → CRS · cashout: CRS → cash

const int = (v, min, max, fallback) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback; };

/** An offer as it travels and is kept on the sheet: known direction, sane numbers, a short note. */
export function normalizeDeal(raw, economy) {
  const d = economy.washer;
  const direction = DIRECTIONS.includes(raw?.direction) ? raw.direction : 'wash';
  return {
    id: String(raw?.id ?? '').slice(0, 40) || `deal-${Date.now()}`,
    direction,
    rate: int(raw?.rate, 1, 100000, d[direction].rate),
    commission: int(raw?.commission, 0, 90, d.commission),
    max: int(raw?.max, 1, 20, d.max),
    ...(raw?.note ? { note: String(raw.note).trim().slice(0, 140) } : {}),
  };
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
  const out = deal.direction === 'wash'
    ? { points: n, base, fee, cash: -(base + fee), crs: n }
    : { points: n, base, fee, cash: base - fee, crs: -n };
  const why = Number(points) > deal.max ? 'max'
    : deal.direction === 'wash' && cash < base + fee ? 'noCash'
      : deal.direction === 'wash' && crs + n > cap ? 'cap'
        : deal.direction === 'cashout' && crs - n < 0 ? 'below' : null;
  return why ? { ok: false, why, ...out } : { ok: true, ...out };
}
