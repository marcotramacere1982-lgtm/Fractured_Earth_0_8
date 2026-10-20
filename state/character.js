// Character model (schema v1) and full sheet derivation.

import { computeSkills, computeCombat, initiative, weaponTN } from '../rules/stats.js';
import { maxHp, armorTotals } from '../rules/body.js';
import { limbs, movement, usableWeapons } from '../rules/injuries.js';
import { emptyProgress, progressStatus, talentEffects } from '../rules/progress.js';
import { emptyDowntime } from '../rules/downtime.js';
import { findSubclass, classTN, deckCapacity, deckStatus } from '../rules/classes.js';
import { zoneBonus, isRanged, opticStats } from '../rules/engines.js';
import { lifestyleUpkeep, magazineId, addItem } from '../rules/economy.js';
import { conditionMods, halvedMove } from '../rules/conditions.js';
import { allowance } from '../rules/turn.js';
import { effectTotals } from '../rules/items.js';
import { withUniques, uniqueBonuses } from '../rules/uniques.js';
import { uid } from './id.js';

export const SCHEMA_VERSION = 1;

export function createCharacter(data, { player = '', name = '' } = {}) {
  const { creation } = data.attributes;
  const attributes = Object.fromEntries(data.attributes.attributes.map((a) => [a.id, a.id === 'CRS' ? creation.crs.start : creation.start]));
  return {
    schemaVersion: SCHEMA_VERSION,
    id: uid(),
    player,
    name,
    attributes,
    rowOffsets: Object.fromEntries(data.combat.derived.map((d) => [d.id, 0])),
    mods: { maxHp: 0 },
    age: data.adolescence.startAge,
    criminalRecord: false,
    credentials: [],
    tags: [],
    waivers: [],
    history: { adolescence: [], careers: [] },
    classId: null,
    subclassId: null,
    debtId: null,
    narrative: { backstoryHtml: '', backstoryPrompt: '', portraitPrompt: '' },
    portrait: { dataUrl: '', framing: { zoom: 100, panX: 50, panY: 50 } },
    play: {
      hp: null, // null = full
      cash: 0,
      notes: '',
      inventory: [], // { kind: 'weapon'|'armor'|'item'|'deck', id, qty }
      deck: null, // active hacker deck id
      deckMods: [], // installed deck mod ids
      optic: null, // active Scavenger optic id
      sparesGranted: true, // decision 55: guns bought from now on come with spare magazines
      lifestyle: [], // lifestyle entry ids (rent tier, plans, bills)
      worn: [], // armor ids currently worn
      slots: { 1: null, 2: null }, // weapon ids
      hand: 1, // the slot in hand (decision 56): in combat only it can attack; swapping costs an action
      effects: [], // timed effects of items used (decision 58): stims, painkillers…
      ammo: { 1: 0, 2: 0 },
      armorDamage: 0, // cracks in the worn armor, until repaired
      injuries: [], // location ids with a broken arm / crippled leg, until treated
      cover: 0,
      abilities: [], // equipped ability ids
      maxAbilities: 3,
      resources: {}, // class counters: tp, stance, ram, heat, resonance, phase, pendulum
      conditions: [],
      turn: { inCombat: false, round: 1, used: 0, reserved: 0, spent: [] },
      inbox: [], // unread GM transmissions { id, t, text, private }
      talentUses: {}, // talent id -> uses this round / combat / mission
    },
    progress: emptyProgress(), // XP, bought talents, GM gifts, attribute raises, level-up open (decision 44)
    downtime: emptyDowntime(), // debt pressure 0–3 and the story timeline of downtime events (decision 46)
    drive: { type: null, line: '' }, // Justice or Ambition + a personal line: a story compass, never a score (decision 47)
  };
}

/**
 * Saves from before decision 42 had per-location HP and armor marks: drop them, start with intact armor,
 * and turn "Resistant to pain" (+1 HP per location) into +3 max HP per point. Safe to run on any save.
 */
export function upgradeSave(c, data = null) {
  if (!c?.play) return c;
  if (data && c.play.sparesGranted !== true) { // decision 55: 2 spare magazines per gun already owned, once
    for (const row of c.play.inventory.filter((x) => x.kind === 'weapon')) {
      if (data.weapons.find((w) => w.id === row.id)?.magSize) addItem(c, 'ammo', magazineId(row.id), data.economy.magazine.startSpares * row.qty);
    }
    c.play.sparesGranted = true;
  }
  if ('locations' in c.play) delete c.play.locations;
  c.play.armorDamage ??= 0;
  c.play.injuries ??= [];
  c.play.talentUses ??= {};
  c.play.optic ??= null;
  c.play.hand ??= 1;
  c.play.effects ??= [];
  c.progress ??= emptyProgress();
  c.downtime ??= emptyDowntime();
  c.drive ??= { type: null, line: '' };
  if (c.mods && 'locationHp' in c.mods) {
    c.mods.maxHp = (c.mods.maxHp ?? 0) + 3 * (c.mods.locationHp || 0);
    delete c.mods.locationHp;
  }
  return c;
}

/** Every number the sheet shows, computed from the character + data. */
export function deriveSheet(character, data) {
  data = withUniques(data, character); // the GM's unique items read like catalog entries (decision 61)
  // items' timed effects (decision 58) and the bonuses of uniques in use: attribute boosts flow through everything
  const items = effectTotals(character.play.effects);
  const uniq = uniqueBonuses(character);
  const boost = (k) => (items.attrs[k] ?? 0) + (uniq.attrs[k] ?? 0);
  const a = Object.keys(items.attrs).length || Object.keys(uniq.attrs).length
    ? Object.fromEntries(Object.entries(character.attributes).map(([k, v]) => [k, v + boost(k)]))
    : character.attributes;
  for (const [k, v] of Object.entries(uniq.mods)) items.mods[k] = (items.mods[k] ?? 0) + v;
  const fx = data.talents ? talentEffects(character, data) : {};
  // conditions that change numbers (decision 54): the sheet shows the changed value next to the normal one (`base`)
  const cm = conditionMods(character.play.conditions, data.conditions, items.mods);
  const combatBase = computeCombat(a, character.rowOffsets, data.combat);
  const combat = Object.fromEntries(Object.entries(combatBase).map(([k, v]) => (cm[k] ? [k, { ...v, value: v.value + cm[k], base: v.value }] : [k, v])));
  const hpMax = maxHp(a, data.body, character.mods.maxHp) + (fx.maxHp ?? 0);
  const partial = Math.min(...data.difficulty.cover.map((x) => x.armor).filter((n) => n > 0));
  const stance = character.classId === 'soldier' ? character.play.resources?.stance : null;
  const armor = armorTotals(character.play.worn, data.armor, {
    cover: character.play.cover + (character.play.cover === partial ? fx.partialCover ?? 0 : 0), // Cover Habit
    cracked: character.play.armorDamage ?? 0,
    bonus: (stance ? fx.armorInStance?.[stance] ?? 0 : 0) + cm.armor, // Hardened / Thick Plates; Bolstered
  });
  armor.condition = cm.armor;
  const injured = limbs(character.play.injuries ?? [], data.body);
  const sub = character.subclassId ? findSubclass(data.classes, character.subclassId) : null;
  const skillsBase = computeSkills(a, data.skills).map((k) => (fx.skills?.[k.id] ? { ...k, value: k.value + fx.skills[k.id], talent: fx.skills[k.id] } : k))
    .map((k) => (uniq.skills[k.id] ? { ...k, value: k.value + uniq.skills[k.id], unique: uniq.skills[k.id] } : k));
  const skills = cm.skillTn ? skillsBase.map((k) => ({ ...k, value: k.value + cm.skillTn, base: k.value })) : skillsBase; // Sharp: skill checks, not attacks
  const weapon = (id) => data.weapons.find((w) => w.id === id);
  const deck = data.decks.find((d) => d.id === character.play.deck) ?? null;
  const optic = character.classId === 'scavenger' ? data.optics.find((o) => o.id === character.play.optic) ?? null : null;
  const zone = zoneBonus(character.classId, character.play.resources, data.classes, fx);
  // the weapon in hand: the chosen slot, or the other one when that slot is empty
  const handSlot = character.play.slots[character.play.hand ?? 1] ? (character.play.hand ?? 1) : character.play.slots[1] ? 1 : character.play.slots[2] ? 2 : null;
  const weapons = usableWeapons([1, 2].map((slot) => {
      const w = weapon(character.play.slots[slot]);
      if (!w) return { slot, empty: true };
      const zoneTn = isRanged(w) ? zone.rangedTn : 0; // Smuggler Cold: steadier aim
      const tn = weaponTN(w, skillsBase) + zoneTn + (w.tnBonus ?? 0); // a unique's own TN bonus
      const rounds = character.play.ammo[slot] ?? 0;
      const spares = w.magSize ? character.play.inventory.find((x) => x.kind === 'ammo' && x.id === magazineId(w.id))?.qty ?? 0 : 0;
      return { slot, ...w, tn: tn + cm.attackTn, base: cm.attackTn ? tn : undefined, zoneTn, rounds, spares, // Focused / Blinded; only a condition sets `base`, never a record field
        burst: w.burst ?? 1, attacksLeft: w.magSize ? Math.ceil(rounds / (w.burst ?? 1)) : null, // automatic weapons fire 3-round bursts
        inHand: slot === handSlot };
    }), injured.arms);
  const inCombat = Boolean(character.play.turn?.inCombat);
  return {
    attributes: a,
    attributesBase: character.attributes, // before item boosts (shown beside the boosted value)
    effects: character.play.effects ?? [],
    skills,
    weapons,
    handSlot,
    armed: weapons.filter((w) => !w.empty && (!inCombat || w.inHand)), // what attacks and weapon abilities may use now
    deck: deck ? (() => {
      const capacity = deckCapacity(deck, character.play.deckMods ?? [], data.deckMods, fx.ram ?? 0);
      return { ...deck, capacity, status: deckStatus(capacity, character.play.resources) };
    })() : null,
    optic: character.classId === 'scavenger' ? { item: optic, ...opticStats(optic, data.classes) } : null, // Scavenger: range, track, mode
    lifestyle: (() => {
      const upkeep = lifestyleUpkeep(character.play.lifestyle ?? [], data);
      const tierOf = (cat) => upkeep.entries.find((x) => x.category === cat)?.tier ?? null;
      return { ...upkeep, tiers: Object.fromEntries(data.lifestyle.categories.map((k) => [k.id, tierOf(k.id)])) };
    })(),
    combat,
    zone,
    move: halvedMove(movement(combat.sqr.value + zone.squares, injured.legs), cm.moveHalf), // squares per Move action (Prone: halved)
    moveBase: movement(combat.sqr.value + zone.squares, injured.legs),
    actionsNow: allowance(combat.act.value, character.play.conditions, data.actions), // this round: Stunned 1, Slowed −1
    conditionMods: cm,
    injured: { ...injured, locations: character.play.injuries ?? [] },
    initiative: initiative(a, data.combat) + (fx.initiative ?? 0) + uniq.init,
    talents: fx, // merged automatic talent effects
    progress: data.progress ? progressStatus(character, data) : null,
    locationPenalty: Math.max(0, data.body.locationAttack.tnPenalty + (fx.locationPenalty ?? 0)), // Marksman
    abilityLimit: (character.play.maxAbilities ?? 3) + (data.progress ? progressStatus(character, data).abilitySlots : 0),
    immune: [...(stance ? fx.immuneInStance?.[stance] ?? [] : []), ...items.immune], // Unstoppable; antitoxin
    hp: { max: hpMax, current: character.play.hp ?? hpMax },
    armor,
    class: sub ? { id: sub.cls.id, name: sub.cls.name, subclass: sub.sub, tn: classTN(a, sub.sub) } : null,
  };
}
