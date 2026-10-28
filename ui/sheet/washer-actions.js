// Sheet actions for the washer (decision 143): an offer arrives from the GM, the player picks how many points, then
// takes it or walks away. Cash and Credit Score change together and the log says why (the GM's audit reads it).

import { normalizeDeal, dealQuote } from '../../rules/washer.js';
import { log } from './actions.js';

const cap = (data) => data.attributes.creation.crs.max;

export const washerActions = {
  /** A durable `deal` message from the GM: kept until the player answers (the same offer twice is kept once). */
  receiveDeal(c, data, { msg }) {
    const deal = normalizeDeal(msg, data.economy);
    c.play.offers ??= [];
    if (c.play.offers.some((o) => o.id === deal.id)) return false;
    c.play.offers.push({ ...deal, points: 1 });
    log(c, `A fixer offers to ${deal.direction === 'wash' ? 'wash cash into Credit Score' : 'cash out Credit Score'}`);
    return true;
  },
  dealPoints(c, _d, { id, value }) {
    const o = (c.play.offers ?? []).find((x) => x.id === id);
    if (o) o.points = Math.max(1, Math.min(o.max, Math.round(Number(value)) || 1));
  },
  acceptDeal(c, data, { id }) {
    const o = (c.play.offers ?? []).find((x) => x.id === id);
    if (!o) return;
    const q = dealQuote(o, o.points ?? 1, { cash: c.play.cash, crs: c.attributes.CRS }, cap(data));
    if (!q.ok) return;
    c.play.cash += q.cash;
    c.attributes.CRS += q.crs;
    c.play.offers = c.play.offers.filter((x) => x !== o);
    log(c, o.direction === 'wash'
      ? `Washer: washed ${q.points} CRS for ${-q.cash} cash (commission ${q.fee})`
      : `Washer: cashed out ${q.points} CRS for ${q.cash} cash (commission ${q.fee})`, 'warn');
  },
  declineDeal(c, _d, { id }) {
    if (!(c.play.offers ?? []).some((x) => x.id === id)) return;
    c.play.offers = c.play.offers.filter((x) => x.id !== id);
    log(c, 'Walked away from a fixer\'s offer');
  },
};
