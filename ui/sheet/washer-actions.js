// Sheet actions for the washer (decision 143): an offer arrives from the GM, the player picks how many points, then
// takes it or walks away. Cash and Credit Score change together and the log says why (the GM's audit reads it).

import { normalizeDeal, dealQuote, washable, gunQuote, washed } from '../../rules/washer.js';
import { rollDie } from '../../rules/dice.js';
import { haggleOutcome } from '../../rules/haggle.js';
import { log } from './actions.js';

const cap = (data) => data.attributes.crsScale.max; // decision 316: the play scale, not the creation cap

export const washerActions = {
  /** A durable `deal` message from the GM: kept until the player answers (the same offer twice is kept once). */
  receiveDeal(c, data, { msg }) {
    const deal = normalizeDeal(msg, data.economy);
    c.play.offers ??= [];
    if (c.play.offers.some((o) => o.id === deal.id)) return false;
    c.play.offers.push({ ...deal, points: 1 });
    log(c, `A fixer offers to ${{ wash: 'wash cash into Credit Score', cashout: 'cash out Credit Score', gun: 'wash a hot gun' }[deal.direction]}`);
    return true;
  },
  /** Decision 345: which hot gun goes to the washer. */
  dealItem(c, _d, { id, value }) {
    const o = (c.play.offers ?? []).find((x) => x.id === id);
    if (o) o.item = String(value ?? '').slice(0, 80);
  },
  dealPoints(c, _d, { id, value }) {
    const o = (c.play.offers ?? []).find((x) => x.id === id);
    if (o) o.points = Math.max(1, Math.min(o.max, Math.round(Number(value)) || 1));
  },
  acceptDeal(c, data, { id }) {
    const o = (c.play.offers ?? []).find((x) => x.id === id);
    if (!o) return;
    if (o.direction === 'gun') return washGun(c, o);
    const q = dealQuote(o, o.points ?? 1, { cash: c.play.cash, crs: c.attributes.CRS }, cap(data));
    if (!q.ok) return;
    c.play.cash += q.cash;
    c.attributes.CRS += q.crs;
    c.play.offers = c.play.offers.filter((x) => x !== o);
    log(c, o.direction === 'wash'
      ? `Washer: washed ${q.points} CRS for ${-q.cash} cash (commission ${q.fee})`
      : `Washer: cashed out ${q.points} CRS for ${q.cash} cash (commission ${q.fee})`, 'warn');
  },
  /** Decision 346: one haggle per offer — the price moves, nothing changes, it gets worse, or (a failed swindle) the fixer walks. */
  haggleDeal(c, data, { id, step, approach, success, natural, rollText }) {
    const o = (c.play.offers ?? []).find((x) => x.id === id);
    if (!o || o.haggle) return null;
    const r = haggleOutcome({ step, approach, success, natural }, data);
    const what = { wash: 'washing', cashout: 'cashing out', gun: 'a gun wash' }[o.direction];
    if (r.burned) { c.play.offers = c.play.offers.filter((x) => x !== o); log(c, `Swindled a fixer over ${what}: ${rollText} → they walked away`, 'bad'); return r; }
    o.haggle = { pct: r.pct, step, approach };
    log(c, `Haggled a fixer over ${what} (${approach}, ${step}): ${rollText} → ${r.pct > 0 ? `${r.pct}% better` : r.pct < 0 ? `${-r.pct}% worse` : 'no change'}`, r.pct > 0 ? 'ok' : r.pct < 0 ? 'bad' : 'info');
    return r;
  },
  /** Decision 346: the street, once per trip (until the next scene) — street prices and what a fence pays move together. */
  haggleStreet(c, data, { step, approach, success, natural, rollText }) {
    if (c.play.haggle) return null;
    const r = haggleOutcome({ step, approach, success, natural }, data);
    const pct = r.burned ? -data.economy.haggle.fumblePct : r.pct; // a failed swindle at the market: the dealers know your face
    c.play.haggle = { pct, step, approach };
    log(c, `Haggled on the street (${approach}, ${step}): ${rollText} → ${pct > 0 ? `${pct}% better` : pct < 0 ? `${-pct}% worse` : 'no change'} until the next scene`, pct > 0 ? 'ok' : pct < 0 ? 'bad' : 'info');
    return { ...r, pct };
  },
  declineDeal(c, _d, { id }) {
    if (!(c.play.offers ?? []).some((x) => x.id === id)) return;
    c.play.offers = c.play.offers.filter((x) => x.id !== id);
    log(c, 'Walked away from a fixer\'s offer');
  },
};

/** Decision 345: the fixer cleans a hot gun — pays their share, the gun comes back clean, then the d20 for the trail. @returns { name, fee, roll, traced } */
function washGun(c, o) {
  const row = washable(c.play.inventory).find((r) => r.id === o.item) ?? washable(c.play.inventory)[0];
  const q = gunQuote(o, row?.unique, c.play.cash);
  if (!q.ok) return undefined;
  const name = row.unique.name;
  c.play.cash -= q.fee;
  row.unique = washed(row.unique);
  c.play.offers = c.play.offers.filter((x) => x !== o);
  const roll = rollDie(20);
  const traced = roll <= (o.risk ?? 0);
  log(c, `Washer: ${name} washed for ${q.fee} cash — unlocked, untracked, yours · d20 ${roll}${traced ? ` ≤ ${o.risk}: the trail leads back to the crew` : ': clean'}`, traced ? 'bad' : 'warn');
  return { name, fee: q.fee, roll, traced };
}
