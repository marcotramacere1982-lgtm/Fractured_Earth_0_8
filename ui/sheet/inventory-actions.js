// Inventory actions (decision 55): custom items, trash, sell, gifts between players. Logs stay English and
// explain every change to the GM's audit ("Dropped …", "Sold …", "Gave …", "Received …", "Added …").

import { findGear, sellPrice, addItem, nextIsOfficial, magazineId, lifestyleSlot } from '../../rules/economy.js';
import { RuleError } from '../../rules/messages.js';
import { flightOutcome, checkFlight } from '../../rules/drone.js';
import { checkInstall, moddedWeapon, INSTALLERS } from '../../rules/weapon-mods.js';
import { uid } from '../../state/id.js';
import { log, spend, actions } from './actions.js';

const rowOf = (c, kind, id) => c.play.inventory.find((x) => x.kind === kind && x.id === id);

/** The name a row shows: custom items carry their own; the rest come from the catalogs. */
export const itemName = (row, data) => (row.kind === 'custom' ? row.name : row.unique?.name ?? findGear(row.kind, row.id, data)?.name ?? row.id);

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
  /** Story items (decision 60): using one only writes a line in the log — no action, nothing used up. */
  storyUse(c, data, { id }) {
    const row = rowOf(c, 'item', id);
    if (!row) throw new RuleError('noItem', {}, 'Not in your inventory any more.');
    log(c, `Used ${itemName(row, data)} (story: the GM rules on it)`);
  },
  /** Lifestyle (decisions 62, 86): picking one charges nothing; it replaces what shares its slot (housing: the old home; bills add up). */
  chooseLifestyle(c, data, { id }) {
    const e = data.lifestyle.entries.find((x) => x.id === id);
    if (!e) return;
    const old = (c.play.lifestyle ?? []).map((x) => data.lifestyle.entries.find((y) => y.id === x)).filter((x) => x && x.id !== id && lifestyleSlot(x, data) === lifestyleSlot(e, data));
    c.play.lifestyle = [...(c.play.lifestyle ?? []).filter((x) => !old.some((o) => o.id === x)), ...((c.play.lifestyle ?? []).includes(id) ? [] : [id])];
    log(c, `Lifestyle: ${e.name}${old.length ? ` (instead of ${old.map((o) => o.name).join(', ')})` : ''}`);
  },
  /**
   * Decision 173: a mod onto a weapon. A stock weapon gives up one copy to a modded record of its own (new id; the slot
   * that held it follows); a modded or Forge weapon changes in place. @returns the weapon's id after.
   */
  installMod(c, data, { weaponId, modId }) {
    const row = rowOf(c, 'weapon', weaponId);
    const mod = findGear('weaponMod', modId, data);
    if (!row || !mod || !rowOf(c, 'weaponMod', modId)) throw new RuleError('noItem', {}, 'Not in your inventory any more.');
    const stock = row.unique ? row.unique.stock ?? row.unique : findGear('weapon', weaponId, data);
    const installed = row.unique?.mods ?? [];
    checkInstall(c, stock, installed, mod, data.weaponMods);
    takeOne(c, data, 'weaponMod', modId);
    const next = [...installed, modId];
    log(c, `Mod: ${mod.name} on ${stock.name}`);
    if (row.unique) { row.unique = { ...moddedWeapon(stock, next, data.weaponMods), stock, ...(row.unique.moddedFrom ? { moddedFrom: row.unique.moddedFrom } : {}) }; return weaponId; }
    const held = [1, 2].find((s) => c.play.slots[s] === weaponId);
    const loaded = held ? c.play.ammo[held] : 0;
    const id = `u.m-${uid()}`;
    actions.qty(c, data, { kind: 'weapon', id: weaponId, delta: -1 });
    c.play.inventory.push({ kind: 'weapon', id, qty: 1, unique: { ...moddedWeapon(stock, next, data.weaponMods), stock, moddedFrom: weaponId } });
    if (held) { c.play.slots[held] = id; c.play.ammo[held] = loaded; }
    return id;
  },
  /** Decision 173: a mod off, back to the inventory; the last one off turns a modded copy back into a stock weapon. @returns the weapon's id after. */
  removeMod(c, data, { weaponId, modId }) {
    const row = rowOf(c, 'weapon', weaponId);
    const mod = findGear('weaponMod', modId, data);
    if (!row?.unique?.mods?.includes(modId)) throw new RuleError('noItem', {}, 'Not in your inventory any more.');
    if (!INSTALLERS.includes(c.classId)) throw new RuleError('modWho', {}, 'Only a Soldier or a Tech Wizard installs weapon mods.');
    if (c.play.turn?.inCombat) throw new RuleError('modCombat', {}, 'Not in a fight: mods go on between scenes.');
    const { stock, moddedFrom } = row.unique;
    const next = row.unique.mods.filter((x) => x !== modId);
    addItem(c, 'weaponMod', modId, 1);
    log(c, `Mod: ${mod?.name ?? modId} off ${stock.name}`);
    if (next.length) { row.unique = { ...moddedWeapon(stock, next, data.weaponMods), stock, ...(moddedFrom ? { moddedFrom } : {}) }; return weaponId; }
    if (!moddedFrom) { row.unique = stock; return weaponId; } // a Forge weapon, as it was
    c.play.inventory = c.play.inventory.filter((x) => x !== row);
    addItem(c, 'weapon', moddedFrom, 1);
    for (const s of [1, 2]) if (c.play.slots[s] === weaponId) c.play.slots[s] = moddedFrom;
    return moddedFrom;
  },
  /** Decision 171: one flight of a toy drone — logged; a loss takes it from the inventory. @returns the outcome. */
  droneFlight(c, data, { id, purpose, success, margin, rollText }) {
    const e = findGear('item', id, data);
    if (!e?.drone || !rowOf(c, 'item', id)) throw new RuleError('noItem', {}, 'Not in your inventory any more.');
    checkFlight(c);
    const outcome = flightOutcome({ success, margin }, e.drone);
    c.play.droneFlat = true;
    log(c, `Drone (${purpose}): ${rollText} → ${{ ok: 'there and back', noticed: 'noticed, came back', lost: 'shot down' }[outcome]}`, outcome === 'ok' ? 'ok' : 'bad');
    if (outcome === 'lost') { takeOne(c, data, 'item', id); log(c, `Drone: ${e.name} lost`, 'bad'); }
    return outcome;
  },
  droneCharge(c) { c.play.droneFlat = false; log(c, 'Drone: recharged'); },
  trash(c, data, { kind, id }) {
    const row = takeOne(c, data, kind, id);
    log(c, `Dropped ${itemName(row, data)}`);
  },
  /** Half the list price in cash; custom items: the amount the player typed. */
  sell(c, data, { kind, id, price = null }) {
    const row = rowOf(c, kind, id);
    if (!row) throw new RuleError('noItem', {}, 'Not in your inventory any more.');
    const official = nextIsOfficial(row);
    const cash = kind === 'custom' ? Math.max(0, Math.round(Number(price) || 0)) : sellPrice(findGear(kind, id, data), data.economy, { official });
    takeOne(c, data, kind, id);
    c.play.cash += cash;
    log(c, `Sold ${itemName(row, data)} for $${cash}${official ? ' (registered: a quarter of list)' : ''}`);
    return cash;
  },
  /** Hands one to another player at the table (an Interact action in combat). @returns the item to send. */
  giveItem(c, data, { kind, id, toName }) {
    const row = rowOf(c, kind, id);
    if (!row) throw new RuleError('noItem', {}, 'Not in your inventory any more.');
    const prefix = spend(c, data, { kind: 'interact', name: `give ${itemName(row, data)}` });
    const official = nextIsOfficial(row); // a registered item stays registered
    takeOne(c, data, kind, id);
    log(c, `Gave ${itemName(row, data)} to ${toName}${prefix ? ` (${prefix.replace(/ · $/, '')})` : ''}`);
    if (row.unique) return { kind, id, unique: row.unique }; // a unique keeps every stat (decision 61)
    return kind === 'custom' ? { kind, id: uid(), name: row.name, note: row.note ?? '' } : { kind, id, official };
  },
  /** A gift from another sheet (durable `gift` message). Returns the item's name, or null if it isn't valid. */
  receiveItem(c, data, { msg }) {
    const it = msg.item ?? {};
    if (it.unique && ['weapon', 'armor', 'item', 'deck', 'optic'].includes(it.kind) && /^u\.[\w-]{1,64}$/.test(it.id ?? '')) {
      if (!c.play.inventory.some((x) => x.id === it.id)) c.play.inventory.push({ kind: it.kind, id: it.id, qty: 1, unique: { ...it.unique, unique: true } });
      // a gun forged by the GM comes with its spare magazines, like any gun; a hand-me-down doesn't make new ones
      if (msg.from === 'gm' && it.kind === 'weapon' && it.unique.magSize) addItem(c, 'ammo', magazineId(it.id), data.economy.magazine.startSpares);
    } else if (it.kind === 'custom') {
      if (!String(it.name ?? '').trim()) return null;
      c.play.inventory.push({ kind: 'custom', id: uid(), name: String(it.name).slice(0, 60), note: String(it.note ?? '').slice(0, 200), qty: 1 });
    } else {
      if (!findGear(it.kind, it.id, data)) return null;
      addItem(c, it.kind, it.id, 1, { official: it.official === true });
    }
    const name = itemName(it, data);
    log(c, `Received ${name} from ${String(msg.fromName ?? 'another player').slice(0, 40)}`);
    return name;
  },
};
