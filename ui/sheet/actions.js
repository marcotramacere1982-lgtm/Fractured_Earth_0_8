// Sheet actions: each takes the draft character (+ data, args) and mutates it.
// Game logic lives in rules/; this file only wires player intent to rules and state.

import { abilityContext, failAbility, canUse, useAbility, roundEnd, combatStart, releasePayload, defaultResources, switchMode, openingChoice, disruptSync, upgradeTechResources, weaponHit, abilityWeapon, newTells, placeTells, pruneTells, spendTells, stanceAfterAction, stanceOf } from '../../rules/engines.js';
import { buy, magazineId, addItem } from '../../rules/economy.js';
import { deriveSheet } from '../../state/character.js';
import { newTurn, startCombat, endCombat, endRound, spendAction, borrowAction, allowance } from '../../rules/turn.js';
import { checkDroneMod } from '../../rules/field-drone.js';
import { RuleError } from '../../rules/messages.js';
import { abilityFaces } from '../../rules/ability-play.js';
import { kitAbilities } from '../../rules/kits.js';
import { hitOutcome } from '../../rules/injuries.js';
import { progressActions, resetUses } from './progress-actions.js';
import { downtimeActions } from './downtime-actions.js';
import { storyActions } from './story-actions.js';
import { inventoryActions } from './inventory-actions.js';
import { washerActions } from './washer-actions.js';
import { stashActions } from './stash-actions.js';
import { abilityActions } from './ability-actions.js';
import { itemActions, tickItemEffects, endItemEffects } from './item-actions.js';
import { wornGrants } from '../../rules/body.js';

/** In combat, spends one action and returns the log prefix "R2 · 1/4 · "; outside combat returns ''. what: { kind, name? }. */
export function spend(c, data, what) {
  const turn = c.play.turn ?? newTurn();
  if (!turn.inCombat) return '';
  const max = allowance(deriveSheet(c, data).combat.act.value, c.play.conditions, data.actions);
  c.play.turn = spendAction(turn, max, what);
  const before = c.play.resources?.stance;
  if (c.classId === 'soldier' && c.play.resources) c.play.resources = stanceAfterAction(c.classId, c.play.resources, what.kind, data.classes); // decision 88
  const dropped = before && c.play.resources?.stance !== before ? 'Stance → Ready · ' : '';
  return `R${turn.round} · ${c.play.turn.used}/${max} · ${dropped}`;
}

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const owned = (c, kind) => c.play.inventory.filter((x) => x.kind === kind);

/** Decision 175: Field Strip — clear Jammed, top up every slotted gun from its spare magazines. */
function fieldStrip(c, data) {
  c.play.conditions = c.play.conditions.filter((x) => x !== 'jammed');
  const done = [];
  for (const w of deriveSheet(c, data).weapons.filter((x) => !x.empty && x.magSize)) {
    if ((c.play.ammo[w.slot] ?? 0) >= w.magSize) continue;
    const mags = c.play.inventory.find((x) => x.kind === 'ammo' && x.id === magazineId(w.moddedFrom ?? w.id));
    if (!mags?.qty) continue;
    actions.qty(c, data, { kind: 'ammo', id: mags.id, delta: -1 });
    c.play.ammo[w.slot] = w.magSize;
    done.push(w.name);
  }
  if (done.length) log(c, `Reload ${done.join(', ')} (Field Strip)`);
}

/** Decision 174: a reaction ability pays like Dodge — this round's action, or next round's once they're gone. */
function reactionSpend(c, data) {
  const turn = c.play.turn ?? newTurn();
  if (!turn.inCombat) return '';
  const max = allowance(deriveSheet(c, data).combat.act.value, c.play.conditions, data.actions);
  const now = turn.used < max;
  c.play.turn = now ? spendAction(turn, max, { kind: 'reaction' }) : borrowAction(turn, max);
  return `R${turn.round} · reaction (${now ? "this round's action" : "next round's action"}) · `;
}

export function ensureResources(c) {
  if (c.classId && (!c.play.resources || Object.keys(c.play.resources).length === 0)) c.play.resources = defaultResources(c.classId);
  if (c.classId === 'hacker') c.play.resources.sustained ??= [];
  if (c.classId === 'techwiz') c.play.resources = upgradeTechResources(c.play.resources);
  if (c.classId === 'smuggler') c.play.resources.used ??= [];
  if (c.classId === 'scavenger') c.play.resources = { ...newTells(), ...c.play.resources };
}

/** Scavenger: the optic's track limit and the class data, for placing Tells. */
const tellCtx = (c, data) => ({ track: deriveSheet(c, data).optic?.track ?? 1, classesData: data.classes });
const tellName = (c, key, combat) => combat?.hostiles?.find((h) => h.key === key)?.letter ?? c.play.resources.marks?.find((m) => m.key === key)?.name ?? key;

function capacityOf(c, data) {
  return deriveSheet(c, data).deck?.capacity ?? null; // includes talents (Overclocker)
}

/** New or removed armor starts intact. */
function resetArmorMarks(c) {
  c.play.armorDamage = 0;
}

/** HP actually lost: marks Wounded, and Field Sync disruption shakes a Tech Wizard (−1 Sync; Grounded: only big hits). */
function hurt(c, data, taken) {
  if (taken <= 0) return '';
  if (!c.play.conditions.includes('wounded')) c.play.conditions.push('wounded');
  if (c.classId !== 'techwiz') return '';
  if (taken < (deriveSheet(c, data).talents.disruptionMin ?? 0)) return '';
  ensureResources(c);
  const was = c.play.resources.sync;
  c.play.resources = disruptSync(c.play.resources);
  return c.play.resources.sync < was ? ' · Sync −1' : '';
}

const injuryName = (data, locId) => {
  const loc = data.body.locations.find((l) => l.id === locId);
  return `${data.conditions.find((k) => k.limb === loc?.bp)?.name ?? 'Injury'} (${loc?.name ?? locId})`;
};

/**
 * Decision 142: armor that brings a condition (an ID Scramble Kit: Masked) adds it when put on and takes it away when
 * taken off — unless something else still worn brings it too. Flavour the GM sees on the player's card.
 */
function syncWornConditions(c, data, before) {
  const was = wornGrants(before, data.armor);
  const now = wornGrants(c.play.worn, data.armor);
  for (const id of now) if (!was.includes(id) && !c.play.conditions.includes(id)) { c.play.conditions.push(id); log(c, `${data.conditions.find((k) => k.id === id)?.name ?? id} (kit on)`); }
  for (const id of was) if (!now.includes(id) && c.play.conditions.includes(id)) { c.play.conditions = c.play.conditions.filter((x) => x !== id); log(c, `${data.conditions.find((k) => k.id === id)?.name ?? id} ended (kit off)`); }
}

/** Armor you acquire is put on straight away (take it off in Gear if you only carry it). */
function autoWear(c, id, data) {
  const before = [...c.play.worn];
  if (!c.play.worn.includes(id)) c.play.worn.push(id);
  resetArmorMarks(c);
  if (data) syncWornConditions(c, data, before);
}

export function log(c, text, kind = 'info') {
  c.play.log = [{ t: Date.now(), text, kind }, ...(c.play.log ?? [])].slice(0, 40);
}

export const actions = {
  // ---------------- health & body
  hp(c, data, { delta }) {
    const s = deriveSheet(c, data);
    const next = Math.min(s.hp.max, s.hp.current + Number(delta));
    c.play.hp = next >= s.hp.max ? null : next; // allow negatives (overkill tracking)
    const sync = hurt(c, data, -Number(delta));
    if (sync) log(c, `Took damage${sync}`, 'bad');
  },
  /** Full HP. Broken arms and crippled legs stay until treated. */
  heal(c) {
    c.play.hp = null;
    c.play.conditions = c.play.conditions.filter((x) => x !== 'wounded');
  },
  /**
   * A hit taken: damage minus armor comes off HP. With a location (declared location attack), damage
   * that gets through adds the location's condition; armor that stops it all cracks by 1.
   * @returns the outcome, for the screen to describe
   */
  takeHit(c, data, { damage, loc = '' }) {
    c.play.injuries ??= [];
    const s = deriveSheet(c, data);
    const dmg = Math.max(0, Number(damage) || 0);
    const outcome = hitOutcome(s, { damage: dmg, loc }, data.body);
    const hpNow = s.hp.current - outcome.taken;
    c.play.hp = hpNow >= s.hp.max ? null : hpNow;
    const sync = hurt(c, data, outcome.taken);
    let effect = '';
    if (outcome.condition) {
      const limb = data.conditions.find((k) => k.id === outcome.condition)?.limb;
      if (limb) { if (!c.play.injuries.includes(loc)) c.play.injuries.push(loc); effect = ` · ${injuryName(data, loc)}`; }
      else { if (!c.play.conditions.includes(outcome.condition)) c.play.conditions.push(outcome.condition); effect = ` · ${data.conditions.find((k) => k.id === outcome.condition)?.name}`; }
    }
    if (outcome.crack) { c.play.armorDamage = (c.play.armorDamage ?? 0) + outcome.crack; effect = ` · armor cracked −${outcome.crack}`; }
    const where = loc ? ` to the ${data.body.locations.find((l) => l.id === loc)?.name ?? loc}` : '';
    log(c, `Hit${where}: ${dmg} damage − ${s.armor.general} armor → ${outcome.taken} HP${effect}${sync}`, 'bad');
    return outcome;
  },
  /** Armor cracked by an effect (or fixed by hand): 0 … worn. */
  armorCrack(c, data, { delta }) {
    const s = deriveSheet(c, data);
    c.play.armorDamage = clamp((c.play.armorDamage ?? 0) + Number(delta), 0, s.armor.worn);
  },
  /** Mends every crack (downtime repair, or a Tech Wizard's Field Maintenance). */
  repairArmor(c) {
    const lost = c.play.armorDamage ?? 0;
    if (!lost) throw new RuleError('nothingToRepair', {}, 'No armor damage to repair.');
    resetArmorMarks(c);
    log(c, `Armor repaired: ${lost} point${lost > 1 ? 's' : ''} restored`);
  },
  /** Broken arm / crippled leg on one side: on or off (tapping it on the sheet, or treated). */
  injury(c, data, { loc }) {
    c.play.injuries ??= [];
    const had = c.play.injuries.includes(loc);
    c.play.injuries = had ? c.play.injuries.filter((x) => x !== loc) : [...c.play.injuries, loc];
    log(c, had ? `Treated: ${injuryName(data, loc)}` : `Injured: ${injuryName(data, loc)}`, had ? 'ok' : 'bad');
  },
  cover(c, _d, { value }) { c.play.cover = Number(value); },
  condition(c, _d, { id }) {
    const has = c.play.conditions.includes(id);
    c.play.conditions = has ? c.play.conditions.filter((x) => x !== id) : [...c.play.conditions, id];
  },

  // ---------------- attributes & money
  attr(c, _d, { key, delta }) {
    const v = c.attributes[key] + Number(delta);
    c.attributes[key] = key === 'CRS' ? clamp(v, 0, 100) : Math.max(0, v);
  },
  cash(c, _d, { value }) { c.play.cash = Math.max(0, Math.round(Number(value) || 0)); },

  // ---------------- weapons
  slot(c, data, { slot, value }) {
    c.play.slots[slot] = value || null;
    const w = data.weapons.find((x) => x.id === value);
    c.play.ammo[slot] = w?.magSize ?? 0;
    if (!c.play.turn?.inCombat) { // out of a fight you hold what you just readied, not your fists (decision 147)
      const hand = c.play.hand ?? 1;
      const other = Number(slot) === 1 ? 2 : 1;
      if (value && !c.play.slots[hand]) c.play.hand = Number(slot);
      else if (!value && hand === Number(slot) && c.play.slots[other]) c.play.hand = other;
    }
  },
  ammo(c, data, { slot, delta }) {
    const w = data.weapons.find((x) => x.id === c.play.slots[slot]);
    c.play.ammo[slot] = clamp((c.play.ammo[slot] ?? 0) + Number(delta), 0, w?.magSize ?? 0);
  },
  /** Takes a weapon in hand (decision 56): free out of combat, 1 action in combat. */
  hand(c, data, { slot }) {
    const w = data.weapons.find((x) => x.id === c.play.slots[slot]) ?? data.weapons.find((x) => x.natural); // an empty slot: fists (decision 147)
    if (!w || String(deriveSheet(c, data).handSlot) === String(slot)) return;
    const prefix = spend(c, data, { kind: 'swap', name: w.name });
    c.play.hand = Number(slot);
    if (prefix) log(c, `${prefix}Swap to ${w.name}`);
  },
  /** Uses one spare magazine (decision 55); the partly used one is discarded. No spares: blocked. In combat: the weapon in hand. */
  reload(c, data, { slot }) {
    const w = data.weapons.find((x) => x.id === c.play.slots[slot]);
    if (!w?.magSize) return;
    if (c.play.turn?.inCombat && String(deriveSheet(c, data).handSlot) !== String(slot)) throw new RuleError('notInHand', { weapon: w.name }, `The ${w.name} isn't in your hand: swap to it first.`);
    const mags = c.play.inventory.find((x) => x.kind === 'ammo' && x.id === magazineId(w.moddedFrom ?? w.id)); // decision 173
    if (!mags?.qty) throw new RuleError('noMagazine', { weapon: w.name }, `No spare magazines for the ${w.name}: buy some, or ask the GM.`);
    const prefix = spend(c, data, { kind: 'reload', name: w.name });
    actions.qty(c, data, { kind: 'ammo', id: mags.id, delta: -1 });
    c.play.ammo[slot] = w.magSize;
    if (String(c.play.specialAmmo?.slot) === String(slot)) c.play.specialAmmo = null; // decision 155: Black-Market Ammo lasts until the next reload
    log(c, `${prefix}Reload ${w.name} (${mags.qty} spare magazine${mags.qty === 1 ? '' : 's'} left)`);
  },

  // ---------------- inventory
  wear(c, data, { id }) {
    const before = [...c.play.worn];
    c.play.worn = c.play.worn.includes(id) ? c.play.worn.filter((x) => x !== id) : [...c.play.worn, id];
    resetArmorMarks(c);
    syncWornConditions(c, data, before);
  },
  qty(c, _d, { kind, id, delta }) {
    const row = c.play.inventory.find((x) => x.kind === kind && x.id === id);
    if (!row) return;
    row.qty += Number(delta);
    if ((row.official ?? 0) > Math.max(0, row.qty)) row.official = Math.max(0, row.qty); // street units leave first
    if (row.qty <= 0) {
      c.play.inventory = c.play.inventory.filter((x) => x !== row);
      if (kind === 'armor') { const before = [...c.play.worn]; c.play.worn = c.play.worn.filter((x) => x !== id); resetArmorMarks(c); syncWornConditions(c, _d, before); }
      if (kind === 'weapon') for (const s of [1, 2]) if (c.play.slots[s] === id) c.play.slots[s] = null;
      if (kind === 'deck' && c.play.deck === id) c.play.deck = null;
      if (kind === 'deckMod') c.play.deckMods = c.play.deckMods.filter((x) => x !== id);
      if (kind === 'drone' && c.play.drone === id) c.play.drone = null;
      if (kind === 'droneMod') c.play.droneMods = (c.play.droneMods ?? []).filter((x) => x !== id);
      if (kind === 'optic' && c.play.optic === id) c.play.optic = null;
    }
  },
  add(c, data, { kind, id }) {
    addItem(c, kind, id, kind === 'item' ? data.items.find((i) => i.id === id)?.pack ?? 1 : 1); // packs: ×5 gives 5
    if (kind === 'armor') autoWear(c, id, data);
    if (kind === 'weapon' && data.weapons.find((w) => w.id === id)?.magSize) addItem(c, 'ammo', magazineId(id), data.economy.magazine.startSpares); // guns come with spares
  },
  buy(c, data, { kind, id, method, multiplier }) {
    const res = buy(c, { kind, id }, method, data, { multiplier: Number(multiplier), discount: deriveSheet(c, data).talents.cashDiscount ?? 0 });
    Object.assign(c, res.character);
    if (kind === 'armor') autoWear(c, id, data);
    log(c, res.log, method === 'official' ? 'warn' : 'info');
    return res.notice;
  },
  dropLifestyle(c, _d, { id }) { c.play.lifestyle = c.play.lifestyle.filter((x) => x !== id); },

  // ---------------- class engine
  maxAbilities(c, _d, { delta }) { c.play.maxAbilities = clamp(c.play.maxAbilities + Number(delta), 1, 12); },
  /** Decision 183: a suggested loadout — its abilities replace the equipped ones (within the brain fog limit). */
  equipKit(c, data, { id }) {
    const kit = (data.kits?.kits ?? []).find((k) => k.id === id && k.subclass === c.subclassId);
    if (!kit) return;
    c.play.abilities = kitAbilities(kit, c, data, deriveSheet(c, data).abilityLimit);
    log(c, `Loadout: ${kit.name}`);
  },
  equip(c, data, { id }) {
    if (data.abilities[c.classId]?.find((a) => a.id === id)?.housekeeping) return; // decision 174: always at hand, never in a slot
    const limit = deriveSheet(c, data).abilityLimit; // brain fog limit + slots from levels 3 / 6 / 9
    if (c.play.abilities.includes(id)) c.play.abilities = c.play.abilities.filter((x) => x !== id);
    else if (c.play.abilities.length < limit) c.play.abilities.push(id);
    else throw new RuleError('brainFog', { n: limit }, `Brain fog: only ${limit} abilities can be equipped. Unequip one first.`);
  },
  /** Decision 176: every sustained hack ends at once (it was the Release Payload ability). @returns the ids released. */
  releaseAll(c, data) {
    ensureResources(c);
    const ids = [...(c.play.resources.sustained ?? [])];
    for (const id of ids) c.play.resources = releasePayload(c.play.resources, id, data.abilities);
    if (ids.length) log(c, `Released ${ids.map((id) => data.abilities.hacker.find((a) => a.id === id)?.name ?? id).join(', ')}`);
    return ids;
  },
  release(c, data, { id }) {
    c.play.resources = releasePayload(c.play.resources, id, data.abilities);
    log(c, `Released ${data.abilities.hacker.find((a) => a.id === id)?.name}`);
  },
  res(c, _d, { key, delta, min, max }) {
    ensureResources(c);
    const lo = min === '' || min == null ? -Infinity : Number(min);
    const hi = max === '' || max == null ? Infinity : Number(max);
    c.play.resources[key] = clamp((c.play.resources[key] ?? 0) + Number(delta), lo, hi);
  },
  /** Tech Wizard: Mend / Surge. Free, but Sync drops to 0 — except the fight's opening choice (decision 146). */
  techMode(c, data, { value }) {
    ensureResources(c);
    const was = c.play.resources;
    const opening = openingChoice(c.play.turn);
    if (was.held && !opening && was.mode !== value) throw new RuleError('recalibrated', {}, 'You recalibrated this round: no mode switch until it ends.'); // decision 177
    c.play.resources = switchMode(was, value, deriveSheet(c, data).talents.keepSyncOnSwitch ?? 0, { opening });
    if (was.mode !== value) log(c, opening ? `Opening mode: ${value === 'surge' ? 'Surge' : 'Mend'}` : `Mode → ${value === 'surge' ? 'Surge' : 'Mend'} (Sync reset)`);
  },
  setRes(c, _d, { key, value }) {
    ensureResources(c);
    c.play.resources[key] = /^-?\d+$/.test(value) ? Number(value) : value;
  },
  /** A Soldier's stance set by hand (decision 88): a correction, so it goes in the log for the GM. */
  fixStance(c, data, { value }) {
    ensureResources(c);
    const name = stanceOf('soldier', { stance: value }, data.classes)?.name ?? value;
    c.play.resources.stance = value;
    log(c, `Stance corrected by hand → ${name}`, 'warn');
  },
  deck(c, _d, { value }) { c.play.deck = value || null; },
  optic(c, _d, { value }) { c.play.optic = value || null; },

  // ---------------- scavenger: Tells live on enemies (GM's hostiles by key, or enemies named by hand)
  /** Places (delta +1) or removes (−1) a Tell on an enemy. */
  tell(c, data, { key, delta, combat = null }) {
    ensureResources(c);
    const was = c.play.resources.tells[key] ?? 0;
    c.play.resources = placeTells(c.play.resources, key, Number(delta), tellCtx(c, data));
    if (!c.play.resources.target && Number(delta) > 0) c.play.resources.target = key;
    const now = c.play.resources.tells[key] ?? 0;
    if (now !== was) log(c, `${now > was ? 'Tell on' : 'Tell off'} ${tellName(c, key, combat)} (${now}/3)`);
  },
  /** The enemy abilities spend Tells from. */
  tellTarget(c, _d, { key }) {
    ensureResources(c);
    c.play.resources = { ...c.play.resources, target: key || null };
  },
  /** Without a GM-run fight: name enemies by hand ("Heavy", "Drone 2"). */
  markAdd(c, _d, { name }) {
    ensureResources(c);
    const label = String(name ?? '').trim().slice(0, 24);
    if (!label) return;
    const n = (c.play.resources.marks ?? []).reduce((m, x) => Math.max(m, Number(x.key.slice(1)) || 0), 0) + 1;
    c.play.resources.marks = [...(c.play.resources.marks ?? []), { key: `m${n}`, name: label }];
  },
  markRemove(c, _d, { key }) {
    ensureResources(c);
    const r = c.play.resources;
    r.marks = (r.marks ?? []).filter((m) => m.key !== key);
    c.play.resources = pruneTells(r, [...r.marks.map((m) => m.key), ...Object.keys(r.tells).filter((k) => !k.startsWith('m'))]);
  },
  droneSel(c, _d, { value }) { c.play.drone = value || null; }, // decision 172
  droneMod(c, data, { id }) {
    const installed = c.play.droneMods ?? [];
    checkDroneMod(data.drones.find((d) => d.id === c.play.drone), installed, id);
    c.play.droneMods = installed.includes(id) ? installed.filter((x) => x !== id) : [...installed, id];
  },
  droneWreck(c) {
    c.play.droneWrecked = !c.play.droneWrecked;
    log(c, c.play.droneWrecked ? 'Drone: wrecked — half reach, half damage until repaired' : 'Drone: repaired', c.play.droneWrecked ? 'bad' : 'ok');
  },
  deckMod(c, _d, { id }) {
    c.play.deckMods = c.play.deckMods.includes(id) ? c.play.deckMods.filter((x) => x !== id) : [...c.play.deckMods, id];
  },
  roundEnd(c, data) {
    ensureResources(c);
    const turn = c.play.turn ?? newTurn();
    c.play.resources = roundEnd(c.classId, c.play.resources, {
      capacity: capacityOf(c, data),
      wounded: c.play.conditions.includes('wounded'),
      cover: c.play.cover ?? 0, // Scavenger: full cover and no attack → Unseen
      inDark: Boolean(c.play.inDark), // …or in the dark (decision 76)
      classesData: data.classes,
      talents: deriveSheet(c, data).talents,
    });
    const transient = new Set(data.conditions.filter((k) => k.transient).map((k) => k.id)); // decision 182: Evasive, Covered, Unsteady… — this round only
    c.play.conditions = c.play.conditions.filter((x) => !data.encounter.roundEndClears.includes(x) && !(c.play.roundConditions ?? []).includes(x) && !transient.has(x));
    c.play.roundConditions = []; // decision 155: Steady Aim's Focused, Brace & Dig In's Braced — this round only
    tickItemEffects(c, data); // after the clear: a stim crash Slows next round
    resetUses(c, data, 'round');
    c.play.turn = endRound(turn);
    log(c, `— End of round ${turn.round} —`);
  },
  combatStart(c, data) {
    ensureResources(c);
    c.play.resources = combatStart(c.classId, c.play.resources, data ? deriveSheet(c, data).talents : {}, { cover: c.play.cover ?? 0, classesData: data?.classes });
    if (data) { resetUses(c, data, 'combat'); resetUses(c, data, 'round'); }
    c.play.turn = startCombat();
    log(c, '=== Combat started — round 1 ===');
  },
  combatEnd(c, data) {
    if (data) endItemEffects(c, data);
    c.play.turn = endCombat(c.play.turn ?? newTurn());
    c.play.aimed = false;
    c.play.conditions = c.play.conditions.filter((x) => !(c.play.roundConditions ?? []).includes(x));
    c.play.roundConditions = [];
    log(c, '=== Combat over ===');
  },
  /**
   * The GM's combat tracker drives the sheet: start, every round end (class engines tick), end.
   * Idempotent — the same state can arrive again on reconnect.
   */
  /** Decision 148: the GM asks for initiative (durable `initiative`). Ignored mid-fight. @returns true when it's new. */
  askInitiative(c, _d, { msg }) {
    if (c.play.turn?.inCombat || c.play.initAsk?.id === msg.id) return false;
    c.play.initAsk = { id: String(msg.id ?? '').slice(0, 40) };
    return true;
  },
  /** Decision 170: what a ping found (or `wipe`: a network re-keyed, its line goes). Kept until the next ping. */
  receivePing(c, _d, { msg }) {
    const clean = (n) => ({ key: String(n.key ?? '?').slice(0, 2), name: n.name ? String(n.name).slice(0, 30) : null, mood: n.mood ?? null,
      nodes: (n.nodes ?? []).slice(0, 8).map((x) => ({ name: String(x.name), n: Number(x.n) || 0 })), named: (n.named ?? []).slice(0, 12).map(String),
      devices: (n.devices ?? []).slice(0, 40).map((x) => ({ name: String(x.name).slice(0, 40), n: Number(x.n) || 0 })) });
    if (msg.wipe) {
      if (!c.play.netScan) return false;
      c.play.netScan = { ...c.play.netScan, networks: c.play.netScan.networks.filter((n) => n.key !== msg.wipe) };
      log(c, `Network ${msg.wipe} re-keyed: its scan is gone`, 'bad');
      return true;
    }
    c.play.netScan = { at: Date.now(), ok: Boolean(msg.ok), networks: msg.ok ? (msg.networks ?? []).slice(0, 8).map(clean) : [] };
    log(c, msg.ok ? `Ping: ${c.play.netScan.networks.map((n) => `${n.key} (${n.devices.reduce((k, d) => k + d.n, 0)} devices)`).join(', ') || 'no networks in range'}` : 'Ping: no answer', msg.ok ? 'ok' : 'bad');
    return true;
  },
  clearScan(c) { c.play.netScan = null; },
  /** Decision 165: the GM asks for a skill or attribute roll (durable `ask`); a card waits on Setup / Tactical. */
  askRoll(c, data, { msg }) {
    const kind = msg.kind === 'attr' ? 'attr' : 'skill';
    const known = kind === 'attr' ? data.attributes.attributes.some((a) => a.id === msg.target) : data.skills.skills.some((k) => k.id === msg.target);
    const asks = c.play.rollAsks ?? [];
    if (!known || asks.some((a) => a.id === msg.id)) return false;
    c.play.rollAsks = [...asks, { id: String(msg.id ?? '').slice(0, 40), kind, target: msg.target, note: String(msg.note ?? '').slice(0, 120) }].slice(-5);
    return true;
  },
  /** Put aside without rolling: the card goes (rolling clears it in the check handler). */
  rollAsked(c, _d, { id, name = '' }) {
    c.play.rollAsks = (c.play.rollAsks ?? []).filter((a) => a.id !== id);
    log(c, `Put aside the GM's ${name} roll`);
  },
  initiativeRolled(c, _d, { text }) {
    c.play.initAsk = null;
    log(c, `Initiative: ${text}`);
  },
  tableCombat(c, data, { msg }) {
    const turn = c.play.turn ?? newTurn();
    const mine = turn.inCombat && turn.tableCombat === msg.id;
    if (!msg.active) {
      if (mine) actions.combatEnd(c, data);
      return;
    }
    if (!mine) {
      c.play.initAsk = null; // the fight started: the GM has the order (decision 148)
      actions.combatStart(c, data);
      c.play.turn = { ...c.play.turn, tableCombat: msg.id, round: msg.round };
      if (msg.round > 1) log(c, `Joined the GM's combat at round ${msg.round}`);
      return;
    }
    // Scavenger: enemies that went down or left take their Tells with them
    if (c.classId === 'scavenger' && msg.hostiles) {
      ensureResources(c);
      c.play.resources = pruneTells(c.play.resources, [...msg.hostiles.filter((h) => h.band !== 'down').map((h) => h.key), ...(c.play.resources.marks ?? []).map((m) => m.key)]);
    }
    // catch up one round end per missed round (capped: a long disconnect must not drain the engine)
    for (let i = 0; i < 3 && c.play.turn.round < msg.round; i++) actions.roundEnd(c, data);
    if (c.play.turn.round < msg.round) c.play.turn = { ...c.play.turn, round: msg.round };
  },

  /** Takes a plain action (move, interact, …). In combat it spends one action; outside it just logs. */
  act(c, data, { kind, detail = '' }) {
    const a = data.actions.actions.find((x) => x.id === kind);
    log(c, `${spend(c, data, { kind })}${a?.name ?? kind}${detail ? ` — ${detail}` : ''}`);
    if (kind === 'aim') c.play.aimed = true; // decision 150: held until the next attack (or the fight ends)
    if (kind === 'move' && c.play.turn?.inCombat) c.play.turn = { ...c.play.turn, moveLeft: (c.play.turn.moveLeft ?? 0) + deriveSheet(c, data).move }; // the squares of this Move, on top of any left (decision 161)
  },
  /** Scavenger (decision 76): "in the dark" — unlit and unseen by the target — counts as Unseen for Tells. */
  inDark(c, _data, { on }) {
    c.play.inDark = Boolean(on);
    log(c, on ? 'In the dark (Unseen for Tells)' : 'Out of the dark');
  },
  /** Your colour on the table map, for your marker and your marks (decision 82): purely visual, not logged. */
  /** Decision 160: your letters on the map (2–3, letters and digits); empty → the initials of your name. Visual, not logged. */
  mapTag(c, _d, { value }) {
    const tag = String(value ?? '').replace(/[^\p{L}\p{N}]/gu, '').slice(0, 3).toUpperCase();
    c.play.mapTag = tag || null;
  },
  mapColor(c, data, { color }) {
    if (data.map.marks.colors.includes(color)) c.play.mapColor = color;
  },
  /** The torch (decision 75): switched on, it lights the squares round your marker on the table map. */
  torch(c, _data, { on }) {
    c.play.torch = Boolean(on);
    log(c, on ? 'Torch on' : 'Torch off');
  },
  /**
   * A drag on the table map in combat (decision 73): it spends the squares left from this round's Move first,
   * and takes a new Move action only when they run out — three one-square steps are one action.
   */
  mapMove(c, data, { steps }) {
    const turn = c.play.turn ?? newTurn();
    if (!turn.inCombat) return;
    // decision 161 (owner): in a fight dragging never spends — tap Move first (1 action), then walk the squares it gives
    let left = turn.moveLeft ?? 0;
    if (steps > left) throw new RuleError('pressMove', { n: left }, left ? `Only ${left} squares left: tap Move for more.` : 'Tap Move first (1 action), then drag your marker.');
    left = Math.max(0, left - steps);
    c.play.turn = { ...c.play.turn, moveLeft: left };
    log(c, `Move on the map — ${steps} square${steps === 1 ? '' : 's'}${left ? ` (${left} left)` : ''}`);
  },
  /** Ability roll resolved in the dialog. `success` from the Class TN roll. */
  useRolled(c, data, { id, success, rollText, resonant = false, steer = 0, stance = null }) {
    ensureResources(c);
    const ability = data.abilities[c.classId].find((a) => a.id === id);
    const sh = deriveSheet(c, data);
    const ctx = { ...abilityContext(c), capacity: capacityOf(c, data), resonant: Boolean(resonant), weapons: sh.armed, arms: sh.injured.arms, talents: sh.talents, track: sh.optic?.track ?? 1, classesData: data.classes, failed: !success };
    const check = canUse(c.classId, ability, c.play.resources, ctx);
    if (!check.ok) throw new RuleError(check.code, check.vars, `${ability.name}: ${check.reason}`);
    const free = ability.steer && sh.talents.freeSteer && !(c.play.talentUses?.[sh.talents.freeSteer]); // decision 186: Poker Face — one free Breathe a combat
    if (free) c.play.talentUses = { ...(c.play.talentUses ?? {}), [sh.talents.freeSteer]: 1 };
    const prefix = free ? 'Poker Face (free) · ' : ability.reaction ? reactionSpend(c, data) : spend(c, data, { kind: 'ability', name: ability.name }); // decision 174: a reaction pays like Dodge
    if (ability.lockMode) c.play.resources = { ...c.play.resources, held: true }; // decision 177: Recalibrate — no mode switch this round
    if (ability.perScene) c.play.sceneUses = { ...(c.play.sceneUses ?? {}), [id]: (c.play.sceneUses?.[id] ?? 0) + 1 }; // decision 180
    if (ability.perMission) c.play.abilityUses = { ...(c.play.abilityUses ?? {}), [id]: (c.play.abilityUses?.[id] ?? 0) + 1 };
    if (ability.stanceShift && ['defensive', 'attack'].includes(stance)) { // decision 175: Shift Stance — one step, Unsteady till the round ends
      c.play.resources = { ...c.play.resources, stance };
      if (!c.play.conditions.includes('unsteady')) c.play.conditions.push('unsteady');
      c.play.roundConditions = [...new Set([...(c.play.roundConditions ?? []), 'unsteady'])];
    } else if (ability.refill) fieldStrip(c, data); // decision 175
    else if (ability.repairDrone) { c.play.droneWrecked = false; log(c, 'Drone: repaired (Patch the Drone)', 'ok'); } // decision 177
    else if (ability.steer) c.play.resources = { ...c.play.resources, pendulum: clamp((c.play.resources.pendulum ?? 0) + Math.sign(steer), -4, 4) }; // Breathe: one step, your choice
    else if (success || data.classes.abilityRoll.onFailure === 'spend') c.play.resources = useAbility(c.classId, ability, c.play.resources, ctx);
    else if (data.classes.abilityRoll.onFailure === 'step') c.play.resources = failAbility(c.classId, ability, c.play.resources, ctx); // decision 179: one step, never the full price
    if (success && abilityFaces(ability, c.play.resources, { resonant }).some((f) => f.spec.wrecksDrone) && !c.play.droneWrecked) { // decision 177: Remote Pilot's dive
      c.play.droneWrecked = true;
      log(c, 'Drone: wrecked — dived into the enemy (half reach, half damage until repaired)', 'bad');
    }
    // abilities that fire a weapon use its ammunition, hit or miss
    const w = abilityWeapon(ability, ctx.weapons);
    if (w?.magSize && ability.weapon.ammo) c.play.ammo[w.slot] = ability.weapon.ammo === 'all' ? 0 : Math.max(0, (c.play.ammo[w.slot] ?? 0) - ability.weapon.ammo);
    log(c, `${prefix}${ability.name}${ctx.resonant ? ' (Resonant burst)' : ''}: ${rollText} → ${success ? 'success' : 'failed'}`, success ? 'ok' : 'bad');
  },
  /** Weapon attack resolved in the dialog: spends the action and one round of ammo. */
  attack(c, data, { slot, hit, rollText, damageText, located = false }) {
    const w = data.weapons.find((x) => x.id === c.play.slots[slot]) ?? data.weapons.find((x) => x.natural); // an empty slot: fists (decision 147)
    if (!w) throw new RuleError('noWeapon', {}, 'No weapon in that slot.');
    const ws = deriveSheet(c, data).weapons.find((x) => String(x.slot) === String(slot));
    if (ws?.usable === false) throw new RuleError(ws.why === 'noArms' ? 'noArms' : 'oneArm', { weapon: w.name }, ws.why === 'noArms' ? 'Both arms are broken: no weapons.' : `${w.name}: with a broken arm you can use only one one-handed weapon.`);
    if (w.magSize && (c.play.ammo[slot] ?? 0) <= 0) throw new RuleError('weaponEmpty', { weapon: w.name }, `${w.name} is empty — reload first.`);
    if (c.play.turn?.inCombat && ws && !ws.inHand) throw new RuleError('notInHand', { weapon: w.name }, `The ${w.name} isn't in your hand: swap to it first.`);
    const prefix = spend(c, data, { kind: located ? 'located' : 'attack', name: w.name });
    if (w.magSize) c.play.ammo[slot] = Math.max(0, c.play.ammo[slot] - (w.burst ?? 1)); // automatic weapons: a 3-round burst
    let momentum = '';
    if (hit && c.classId === 'soldier') {
      ensureResources(c);
      c.play.resources = weaponHit(c.classId, c.play.resources);
      momentum = ' · +1 TP';
    }
    if (c.classId === 'scavenger') { // attacking breaks Unseen (Exploit is spent in the damage step)
      ensureResources(c);
      c.play.resources = { ...c.play.resources, attacked: true };
    }
    const aimed = located && c.play.aimed ? ' (aimed: location ±5)' : '';
    c.play.aimed = false; // decision 150: the attack uses up the aim
    log(c, `${prefix}${located ? 'Location attack' : 'Attack'}${aimed} with ${w.name}: ${rollText} → ${hit ? `hit${damageText ? `, ${damageText}` : ''}${momentum}` : 'miss'}`, hit ? 'ok' : 'bad');
  },
  /**
   * The damage step of an attack or ability, once every die is in (app-rolled or typed): logs it, and for
   * the Scavenger spends the Tells used for Exploit on that enemy.
   */
  attackDamage(c, data, { text, exploit = null }) {
    if (exploit?.n) {
      ensureResources(c);
      c.play.resources = spendTells(c.play.resources, exploit.key, Number(exploit.n));
    }
    log(c, `  → ${text}${exploit?.n ? ` · Exploit ${exploit.n} Tell${exploit.n > 1 ? 's' : ''} on ${exploit.name ?? exploit.key}` : ''}`, 'ok');
  },
  /** Proactive defense: borrows an action from next round and records the Avoid roll. */
  dodge(c, data, { rollText, success }) {
    const s = deriveSheet(c, data);
    const turn = c.play.turn ?? newTurn();
    const max = allowance(s.combat.act.value, c.play.conditions, data.actions);
    // decision 161 (owner): an action left this round pays for the Dodge; only when they're gone does it borrow from next round
    const now = turn.used < max;
    c.play.turn = now ? spendAction(turn, max, { kind: 'dodge' }) : borrowAction(turn, max);
    log(c, `R${turn.round} · Dodge (${now ? "this round's action" : "next round's action"}): ${rollText} → ${success ? 'avoided' : 'failed'}`, success ? 'ok' : 'bad');
    return true;
  },
  /** Decision 154: a hit the GM sent (durable `hit`) waits on the Play tab until it's applied or dodged. @returns true when new. */
  receiveHit(c, _d, { msg }) {
    c.play.hits ??= [];
    if (!msg?.id || c.play.hits.some((h) => h.id === msg.id)) return false;
    const text = (v, n) => String(v ?? '').slice(0, n);
    c.play.hits.push({ id: text(msg.id, 40), from: text(msg.from, 40), attack: text(msg.attack, 60), damage: Math.max(0, Math.round(Number(msg.damage) || 0)),
      dmgText: text(msg.dmgText, 80), loc: text(msg.loc, 12), where: text(msg.where, 40), roll: text(msg.roll, 40) });
    return true;
  },
  applyHit(c, data, { id }) {
    const h = (c.play.hits ?? []).find((x) => x.id === id);
    if (!h) return null;
    c.play.hits = c.play.hits.filter((x) => x !== h);
    log(c, `${h.from} hit you with ${h.attack}`, 'bad');
    return actions.takeHit(c, data, { damage: h.damage, loc: h.loc });
  },
  dodgedHit(c, _d, { id }) {
    const h = (c.play.hits ?? []).find((x) => x.id === id);
    if (!h) return;
    c.play.hits = c.play.hits.filter((x) => x !== h);
    log(c, `Dodged ${h.from}'s ${h.attack}`, 'ok');
  },

  // ---------------- dossier
  field(c, _d, { path, value }) {
    const keys = path.split('.');
    let o = c;
    while (keys.length > 1) o = o[keys.shift()] ??= {}; // narrative.look on an older save
    o[keys[0]] = value;
  },
  subclass(c, data, { value }) {
    const cls = data.classes.classes.find((k) => k.subclasses.some((s) => s.id === value));
    const changedClass = cls?.id !== c.classId;
    c.classId = cls?.id ?? null;
    c.subclassId = value || null;
    if (changedClass) { c.play.resources = defaultResources(c.classId); c.play.abilities = []; }
  },
  ...progressActions,
  ...downtimeActions,
  ...storyActions,
  ...inventoryActions,
  ...washerActions, // decision 143
  ...stashActions, // decision 144
  ...abilityActions, // decision 155
  ...itemActions,
};

export const ownedOf = owned;
