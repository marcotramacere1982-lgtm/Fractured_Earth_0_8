// Buying gear: official (Credit Score debt, traced) or street (physical cash x3-x10, untraced).

import { RuleError, message } from './messages.js';

export const CATALOGS = { weapon: 'weapons', armor: 'armor', item: 'items', deck: 'decks', deckMod: 'deckMods', optic: 'optics', lifestyle: 'lifestyle' };

export function findGear(kind, id, data) {
  const table = data[CATALOGS[kind]];
  const list = Array.isArray(table) ? table : table?.mods ?? table?.entries;
  return list?.find((x) => x.id === id) ?? null;
}

/**
 * Credit Score cost of an official purchase: ceil(sqrt(cr / divisor) * scrutiny), minimum 1.
 * Rarest tiers (economy.official.blackMarketRarities) are cash only.
 * cost.scoreOverride replaces the formula and the rarity rule; scoreOverride: null forbids official purchase.
 * @returns {number|null}
 */
export function creditScoreCost(entry, kind, economy, cr = entry.cost.cr) {
  if ('scoreOverride' in entry.cost && cr === entry.cost.cr) return entry.cost.scoreOverride;
  const { divisor, scrutiny, blackMarketRarities = [] } = economy.official;
  if (blackMarketRarities.includes(entry.rarity)) return null; // black market only
  if (!cr) return 0;
  return Math.max(1, Math.ceil(Math.sqrt(cr / divisor) * (scrutiny[kind] ?? 1)));
}

/** Both ways to pay for an entry. */
export function priceOptions(entry, kind, economy, multiplier = economy.cash.defaultMultiplier, discount = 0) {
  const { minMultiplier, maxMultiplier } = economy.cash;
  const m = Math.min(maxMultiplier, Math.max(minMultiplier, multiplier));
  const crs = creditScoreCost(entry, kind, economy);
  return {
    official: crs === null ? null : { crs },
    cash: { cash: Math.round(entry.cost.cr * m * (1 - discount)), multiplier: m, discount, range: [entry.cost.cr * minMultiplier, entry.cost.cr * maxMultiplier] }, // discount: Fixer's Number
  };
}

/**
 * Buys one unit. method = 'official' | 'cash'.
 * @returns {{character: object, log: string, notice: object}}  log = English (saved); notice = for the screen. Throws RuleError.
 */
export function buy(character, { kind, id }, method, data, { multiplier, discount = 0 } = {}) {
  const entry = findGear(kind, id, data);
  if (!entry) throw new Error(`Unknown ${kind}: ${id}`);
  const price = priceOptions(entry, kind, data.economy, multiplier, discount);
  const c = structuredClone(character);
  let log;
  let notice;
  if (method === 'official') {
    if (!price.official) throw new RuleError('noOfficialSale', { item: entry.name }, `${entry.name} cannot be bought through official channels.`);
    if (c.attributes.CRS < price.official.crs) throw new RuleError('crsTooLow', { have: c.attributes.CRS, need: price.official.crs }, `Credit Score too low (${c.attributes.CRS} < ${price.official.crs}).`);
    c.attributes.CRS -= price.official.crs;
    log = `Bought ${entry.name} officially: Credit Score −${price.official.crs} (traced)`;
    notice = message('boughtOfficial', { item: entry.name, crs: price.official.crs }, log);
  } else if (method === 'cash') {
    if (c.play.cash < price.cash.cash) throw new RuleError('cashTooLow', { have: c.play.cash, need: price.cash.cash }, `Not enough cash (${c.play.cash} < ${price.cash.cash}).`);
    c.play.cash -= price.cash.cash;
    log = `Bought ${entry.name} on the street: −${price.cash.cash} cash (×${price.cash.multiplier})`;
    notice = message('boughtStreet', { item: entry.name, cash: price.cash.cash, n: price.cash.multiplier }, log);
  } else {
    throw new Error(`Unknown payment method: ${method}`);
  }
  if (kind === 'lifestyle') {
    if (!c.play.lifestyle.includes(id)) c.play.lifestyle.push(id);
  } else {
    const owned = c.play.inventory.find((x) => x.kind === kind && x.id === id);
    if (owned) owned.qty += 1; else c.play.inventory.push({ kind, id, qty: 1 });
  }
  return { character: c, log, notice };
}

/** Monthly cost of the character's lifestyle, both ways. */
export function lifestyleUpkeep(lifestyleIds, data) {
  const entries = lifestyleIds.map((id) => findGear('lifestyle', id, data)).filter(Boolean);
  return {
    entries,
    cr: entries.reduce((s, e) => s + e.cost.cr, 0),
    crs: entries.reduce((s, e) => s + creditScoreCost(e, 'lifestyle', data.economy), 0),
  };
}
