// Sheet actions: each takes the draft character (+ data, args) and mutates it.
// Game logic lives in rules/; this file only wires player intent to rules and state.

import { canUse, useAbility, roundEnd, combatStart, releasePayload, defaultResources, switchMode, disruptSync, upgradeTechResources, weaponHit, abilityWeapon } from '../../rules/engines.js';
import { deckCapacity } from '../../rules/classes.js';
import { buy } from '../../rules/economy.js';
import { deriveSheet } from '../../state/character.js';
import { newTurn, startCombat, endCombat, endRound, spendAction, borrowAction, allowance } from '../../rules/turn.js';
import { RuleError } from '../../rules/messages.js';

/** In combat, spends one action and returns the log prefix "R2 · 1/4 · "; outside combat returns ''. what: { kind, name? }. */
function spend(c, data, what) {
  const turn = c.play.turn ?? newTurn();
  if (!turn.inCombat) return '';
  const max = allowance(deriveSheet(c, data).combat.act.value, c.play.conditions, data.actions);
  c.play.turn = spendAction(turn, max, what);
  return `R${turn.round} · ${c.play.turn.used}/${max} · `;
}

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const owned = (c, kind) => c.play.inventory.filter((x) => x.kind === kind);

export function ensureResources(c) {
  if (c.classId && (!c.play.resources || Object.keys(c.play.resources).length === 0)) c.play.resources = defaultResources(c.classId);
  if (c.classId === 'hacker') c.play.resources.sustained ??= [];
  if (c.classId === 'techwiz') c.play.resources = upgradeTechResources(c.play.resources);
  if (c.classId === 'smuggler') c.play.resources.used ??= [];
}

function capacityOf(c, data) {
  const deck = data.decks.find((d) => d.id === c.play.deck);
  return deck ? deckCapacity(deck, c.play.deckMods ?? [], data.deckMods) : null;
}

/** New or removed armor recalculates every location's marks from scratch. */
function resetArmorMarks(c) {
  for (const st of Object.values(c.play.locations)) st.armorDamage = 0;
}

/** Armor you acquire is put on straight away (take it off in Gear if you only carry it). */
function autoWear(c, id) {
  if (!c.play.worn.includes(id)) c.play.worn.push(id);
  resetArmorMarks(c);
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
    if (Number(delta) < 0 && !c.play.conditions.includes('wounded')) c.play.conditions.push('wounded');
  },
  heal(c) {
    c.play.hp = null;
    c.play.conditions = c.play.conditions.filter((x) => x !== 'wounded');
    for (const st of Object.values(c.play.locations)) st.damage = 0; // armor marks stay lost until re-worn
  },
  /** Restores every destroyed armor mark (downtime repair, or a Tech Wizard's Field Maintenance). */
  repairArmor(c) {
    const lost = Object.values(c.play.locations).reduce((n, st) => n + (st.armorDamage ?? 0), 0);
    if (!lost) throw new RuleError('nothingToRepair', {}, 'No armor marks to repair.');
    resetArmorMarks(c);
    log(c, `Armor repaired: ${lost} mark${lost > 1 ? 's' : ''} restored`);
  },
  /**
   * Sets a body location's HP or armor marks to `value` (tapping a pip).
   * HP moves both ways, capped by the body table; armor can only be knocked down —
   * it is restored when the worn armor changes.
   */
  locSet(c, data, { loc, field, value }) {
    const l = deriveSheet(c, data).locations.find((x) => x.id === loc);
    const st = (c.play.locations[loc] ??= { damage: 0, armorDamage: 0 });
    const v = Number(value);
    if (field === 'hp') {
      const before = st.damage;
      st.damage = clamp(l.max - v, 0, l.max);
      // Field Sync disruption: a hit to a body location shakes the Tech Wizard's focus
      if (c.classId === 'techwiz' && st.damage > before) {
        ensureResources(c);
        const was = c.play.resources.sync;
        c.play.resources = disruptSync(c.play.resources);
        if (c.play.resources.sync < was) log(c, `Hit to ${l.name}: Sync −1`, 'bad');
      }
    }
    else if (v < l.armor) st.armorDamage = clamp(l.armorMax - v, 0, l.armorMax);
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
  },
  ammo(c, data, { slot, delta }) {
    const w = data.weapons.find((x) => x.id === c.play.slots[slot]);
    c.play.ammo[slot] = clamp((c.play.ammo[slot] ?? 0) + Number(delta), 0, w?.magSize ?? 0);
  },
  reload(c, data, { slot }) {
    const w = data.weapons.find((x) => x.id === c.play.slots[slot]);
    const prefix = spend(c, data, { kind: 'reload', name: w?.name });
    c.play.ammo[slot] = w?.magSize ?? 0;
    log(c, `${prefix}Reload ${w?.name ?? 'weapon'}`);
  },

  // ---------------- inventory
  wear(c, _d, { id }) {
    c.play.worn = c.play.worn.includes(id) ? c.play.worn.filter((x) => x !== id) : [...c.play.worn, id];
    resetArmorMarks(c);
  },
  qty(c, _d, { kind, id, delta }) {
    const row = c.play.inventory.find((x) => x.kind === kind && x.id === id);
    if (!row) return;
    row.qty += Number(delta);
    if (row.qty <= 0) {
      c.play.inventory = c.play.inventory.filter((x) => x !== row);
      if (kind === 'armor') { c.play.worn = c.play.worn.filter((x) => x !== id); resetArmorMarks(c); }
      if (kind === 'weapon') for (const s of [1, 2]) if (c.play.slots[s] === id) c.play.slots[s] = null;
      if (kind === 'deck' && c.play.deck === id) c.play.deck = null;
      if (kind === 'deckMod') c.play.deckMods = c.play.deckMods.filter((x) => x !== id);
    }
  },
  add(c, _d, { kind, id }) {
    const row = c.play.inventory.find((x) => x.kind === kind && x.id === id);
    if (row) row.qty += 1; else c.play.inventory.push({ kind, id, qty: 1 });
    if (kind === 'armor') autoWear(c, id);
  },
  buy(c, data, { kind, id, method, multiplier }) {
    const res = buy(c, { kind, id }, method, data, { multiplier: Number(multiplier) });
    Object.assign(c, res.character);
    if (kind === 'armor') autoWear(c, id);
    log(c, res.log, method === 'official' ? 'warn' : 'info');
    return res.notice;
  },
  dropLifestyle(c, _d, { id }) { c.play.lifestyle = c.play.lifestyle.filter((x) => x !== id); },

  // ---------------- class engine
  maxAbilities(c, _d, { delta }) { c.play.maxAbilities = clamp(c.play.maxAbilities + Number(delta), 1, 12); },
  equip(c, _d, { id }) {
    if (c.play.abilities.includes(id)) c.play.abilities = c.play.abilities.filter((x) => x !== id);
    else if (c.play.abilities.length < c.play.maxAbilities) c.play.abilities.push(id);
    else throw new RuleError('brainFog', { n: c.play.maxAbilities }, `Brain fog: only ${c.play.maxAbilities} abilities can be equipped. Unequip one first.`);
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
  /** Tech Wizard: Mend / Surge. Free, but Sync drops to 0. */
  techMode(c, _d, { value }) {
    ensureResources(c);
    const was = c.play.resources;
    c.play.resources = switchMode(was, value);
    if (was.mode !== value) log(c, `Mode → ${value === 'surge' ? 'Surge' : 'Mend'} (Sync reset)`);
  },
  setRes(c, _d, { key, value }) {
    ensureResources(c);
    c.play.resources[key] = /^-?\d+$/.test(value) ? Number(value) : value;
  },
  deck(c, _d, { value }) { c.play.deck = value || null; },
  deckMod(c, _d, { id }) {
    c.play.deckMods = c.play.deckMods.includes(id) ? c.play.deckMods.filter((x) => x !== id) : [...c.play.deckMods, id];
  },
  roundEnd(c, data) {
    ensureResources(c);
    const turn = c.play.turn ?? newTurn();
    c.play.resources = roundEnd(c.classId, c.play.resources, {
      capacity: capacityOf(c, data),
      wounded: c.play.conditions.includes('wounded'),
      classesData: data.classes,
    });
    c.play.conditions = c.play.conditions.filter((x) => x !== 'stunned');
    c.play.turn = endRound(turn);
    log(c, `— End of round ${turn.round} —`);
  },
  combatStart(c) {
    ensureResources(c);
    c.play.resources = combatStart(c.classId, c.play.resources);
    c.play.turn = startCombat();
    log(c, '=== Combat started — round 1 ===');
  },
  combatEnd(c) {
    c.play.turn = endCombat(c.play.turn ?? newTurn());
    log(c, '=== Combat over ===');
  },
  /**
   * The GM's combat tracker drives the sheet: start, every round end (class engines tick), end.
   * Idempotent — the same state can arrive again on reconnect.
   */
  tableCombat(c, data, { msg }) {
    const turn = c.play.turn ?? newTurn();
    const mine = turn.inCombat && turn.tableCombat === msg.id;
    if (!msg.active) {
      if (mine) actions.combatEnd(c);
      return;
    }
    if (!mine) {
      actions.combatStart(c);
      c.play.turn = { ...c.play.turn, tableCombat: msg.id, round: msg.round };
      if (msg.round > 1) log(c, `Joined the GM's combat at round ${msg.round}`);
      return;
    }
    // catch up one round end per missed round (capped: a long disconnect must not drain the engine)
    for (let i = 0; i < 3 && c.play.turn.round < msg.round; i++) actions.roundEnd(c, data);
    if (c.play.turn.round < msg.round) c.play.turn = { ...c.play.turn, round: msg.round };
  },

  /** Takes a plain action (move, interact, …). In combat it spends one action; outside it just logs. */
  act(c, data, { kind, detail = '' }) {
    const a = data.actions.actions.find((x) => x.id === kind);
    log(c, `${spend(c, data, { kind })}${a?.name ?? kind}${detail ? ` — ${detail}` : ''}`);
  },
  /** Ability roll resolved in the dialog. `success` from the Class TN roll. */
  useRolled(c, data, { id, success, rollText, resonant = false }) {
    ensureResources(c);
    const ability = data.abilities[c.classId].find((a) => a.id === id);
    const ctx = { capacity: capacityOf(c, data), resonant: Boolean(resonant), weapons: deriveSheet(c, data).weapons };
    const check = canUse(c.classId, ability, c.play.resources, ctx);
    if (!check.ok) throw new RuleError(check.code, check.vars, `${ability.name}: ${check.reason}`);
    const prefix = spend(c, data, { kind: 'ability', name: ability.name });
    if (success || data.classes.abilityRoll.onFailure === 'spend') c.play.resources = useAbility(c.classId, ability, c.play.resources, ctx);
    // abilities that fire a weapon use its ammunition, hit or miss
    const w = abilityWeapon(ability, ctx.weapons);
    if (w?.magSize && ability.weapon.ammo) c.play.ammo[w.slot] = ability.weapon.ammo === 'all' ? 0 : Math.max(0, (c.play.ammo[w.slot] ?? 0) - ability.weapon.ammo);
    log(c, `${prefix}${ability.name}${ctx.resonant ? ' (Resonant cast)' : ''}: ${rollText} → ${success ? 'success' : 'failed'}`, success ? 'ok' : 'bad');
  },
  /** Weapon attack resolved in the dialog: spends the action and one round of ammo. */
  attack(c, data, { slot, hit, rollText, damageText }) {
    const w = data.weapons.find((x) => x.id === c.play.slots[slot]);
    if (!w) throw new RuleError('noWeapon', {}, 'No weapon in that slot.');
    if (w.magSize && (c.play.ammo[slot] ?? 0) <= 0) throw new RuleError('weaponEmpty', { weapon: w.name }, `${w.name} is empty — reload first.`);
    const prefix = spend(c, data, { kind: 'attack', name: w.name });
    if (w.magSize) c.play.ammo[slot] -= 1;
    let momentum = '';
    if (hit && c.classId === 'soldier') {
      ensureResources(c);
      c.play.resources = weaponHit(c.classId, c.play.resources);
      momentum = ' · +1 TP';
    }
    log(c, `${prefix}Attack with ${w.name}: ${rollText} → ${hit ? `hit${damageText ? `, ${damageText}` : ''}${momentum}` : 'miss'}`, hit ? 'ok' : 'bad');
  },
  /** Proactive defense: borrows an action from next round and records the Avoid roll. */
  dodge(c, data, { rollText, success }) {
    const s = deriveSheet(c, data);
    const turn = c.play.turn ?? newTurn();
    c.play.turn = borrowAction(turn, allowance(s.combat.act.value, c.play.conditions, data.actions));
    log(c, `R${turn.round} · Dodge (next round's action): ${rollText} → ${success ? 'avoided' : 'failed'}`, success ? 'ok' : 'bad');
  },

  // ---------------- dossier
  field(c, _d, { path, value }) {
    const keys = path.split('.');
    let o = c;
    while (keys.length > 1) o = o[keys.shift()];
    o[keys[0]] = value;
  },
  subclass(c, data, { value }) {
    const cls = data.classes.classes.find((k) => k.subclasses.some((s) => s.id === value));
    const changedClass = cls?.id !== c.classId;
    c.classId = cls?.id ?? null;
    c.subclassId = value || null;
    if (changedClass) { c.play.resources = defaultResources(c.classId); c.play.abilities = []; }
  },
};

export const ownedOf = owned;
