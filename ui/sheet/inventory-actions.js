// Inventory actions (decision 55): custom items, trash, sell, gifts between players. Logs stay English and
// explain every change to the GM's audit ("Dropped …", "Sold …", "Gave …", "Received …", "Added …").

import { findGear, sellPrice, addItem } from '../../rules/economy.js';
import { RuleError } from '../../rules/messages.js';
import { uid } from '../../state/id.js';
import { log, spend, actions } from './actions.js';

const rowOf = (c, kind, id) => c.play.inventory.find((x) => x.kind === kind && x.id === id);

/** The name a row shows: custom items carry their own; the rest come from the catalogs. */
export const itemName = (row, data) => (row.kind === 'custom' ? row.name : findGear(row.kind, row.id, data)?.name ?? row.id);

/** One fewer of a row (weapons leave their slot, armor comes off, the active deck/optic is cleared). */
function takeOne(c, data, kind, id) {
  const row = rowOf(c, kind, id);
  if (!row) throw new RuleError('noItem', {}, 'Not in your inventory any more.');
  actions.qty(c, data, { kind, id, delta: -1 });
  return row;
}

export const inventoryActions = {
  /** A misc item with no price and no rules: mission items, trinkets, anything to keep track of. */
  addCustom(c, _d, { name, note = '', qty = 1 }) {
    const label = String(name ?? '').trim().slice(0, 60);
    if (!label) throw new RuleError('needName', {}, 'Give the item a name.');
    const n = Math.max(1, Math.min(99, Math.round(Number(qty) || 1)));
    c.play.inventory.push({ kind: 'custom', id: uid(), name: label, note: String(note ?? '').trim().slice(0, 200), qty: n });
    log(c, `Added ${label}${n > 1 ? ` ×${n}` : ''} (custom item)`);
  },
  trash(c, data, { kind, id }) {
    const row = takeOne(c, data, kind, id);
    log(c, `Dropped ${itemName(row, data)}`);
  },
  /** Half the list price in cash; custom items: the amount the player typed. */
  sell(c, data, { kind, id, price = null }) {
    const row = rowOf(c, kind, id);
    if (!row) throw new RuleError('noItem', {}, 'Not in your inventory any more.');
    const cash = kind === 'custom' ? Math.max(0, Math.round(Number(price) || 0)) : sellPrice(findGear(kind, id, data), data.economy);
    takeOne(c, data, kind, id);
    c.play.cash += cash;
    log(c, `Sold ${itemName(row, data)} for $${cash}`);
    return cash;
  },
  /** Hands one to another player at the table (an Interact action in combat). @returns the item to send. */
  giveItem(c, data, { kind, id, toName }) {
    const row = rowOf(c, kind, id);
    if (!row) throw new RuleError('noItem', {}, 'Not in your inventory any more.');
    const prefix = spend(c, data, { kind: 'interact', name: `give ${itemName(row, data)}` });
    takeOne(c, data, kind, id);
    log(c, `Gave ${itemName(row, data)} to ${toName}${prefix ? ` (${prefix.replace(/ · $/, '')})` : ''}`);
    return kind === 'custom' ? { kind, id: uid(), name: row.name, note: row.note ?? '' } : { kind, id };
  },
  /** A gift from another sheet (durable `gift` message). Returns the item's name, or null if it isn't valid. */
  receiveItem(c, data, { msg }) {
    const it = msg.item ?? {};
    if (it.kind === 'custom') {
      if (!String(it.name ?? '').trim()) return null;
      c.play.inventory.push({ kind: 'custom', id: uid(), name: String(it.name).slice(0, 60), note: String(it.note ?? '').slice(0, 200), qty: 1 });
    } else {
      if (!findGear(it.kind, it.id, data)) return null;
      addItem(c, it.kind, it.id);
    }
    const name = itemName(it, data);
    log(c, `Received ${name} from ${String(msg.fromName ?? 'another player').slice(0, 40)}`);
    return name;
  },
};
