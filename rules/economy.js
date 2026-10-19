// Buying gear: official (Credit Score debt, traced) or street (physical cash x3-x10, untraced).

import { RuleError, message } from './messages.js';

export const CATALOGS = { weapon: 'weapons', armor: 'armor', item: 'items', deck: 'decks', deckMod: 'deckMods', optic: 'optics', lifestyle: 'lifestyle' };

/** Spare magazines (decision 55): one entry per gun with a magazine, priced from the gun. id 'mag.<weapon id>'. */
const magCache = new WeakMap();
export const magazineId = (weaponId) => `mag.${weaponId}`;
export function magazines(data) {
  if (!magCache.has(data.weapons)) {
    const m = data.economy.magazine;
    magCache.set(data.weapons, data.weapons.filter((w) => w.magSize).map((w) => ({
      id: magazineId(w.id), weaponId: w.id, name: `${w.name} magazine`, ammo: w.ammo, magSize: w.magSize, rarity: w.rarity,
      cost: { cr: Math.max(m.min, Math.round(w.cost.cr * m.pricePct)) },
    })));
  }
  return magCache.get(data.weapons);
}

/** What selling one gives back: half the list price (custom items have none: the player types it). */
export const sellPrice = (entry, economy) => (entry?.cost ? Math.floor(entry.cost.cr * economy.sell.fraction) : 0);

export function findGear(kind, id, data) {
  if (kind === 'ammo') return magazines(data).find((x) => x.id === id) ?? null;
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
    addItem(c, kind, id);
    if (kind === 'weapon' && entry.magSize) { // every gun comes with spare magazines
      addItem(c, 'ammo', magazineId(id), data.economy.magazine.startSpares);
      log += ` + ${data.economy.magazine.startSpares} spare magazines`;
      notice = message(`${notice.code}Spares`, { ...notice.vars, spares: data.economy.magazine.startSpares }, log);
    }
  }
  return { character: c, log, notice };
}

/** Puts n of an item in the inventory (stacks with the same kind + id). */
export function addItem(c, kind, id, n = 1) {
  const owned = c.play.inventory.find((x) => x.kind === kind && x.id === id);
  if (owned) owned.qty += n; else c.play.inventory.push({ kind, id, qty: n });
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
