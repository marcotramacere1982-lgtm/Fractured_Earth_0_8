// Character model (schema v1) and full sheet derivation.

import { computeSkills, computeCombat, initiative, weaponTN } from '../rules/stats.js';
import { maxHp, locationMaxHp, armorTotals } from '../rules/body.js';
import { findSubclass, classTN, deckCapacity, deckStatus } from '../rules/classes.js';
import { zoneBonus, isRanged } from '../rules/engines.js';
import { lifestyleUpkeep } from '../rules/economy.js';
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
    mods: { maxHp: 0, locationHp: 0 },
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
      lifestyle: [], // lifestyle entry ids (rent tier, plans, bills)
      worn: [], // armor ids currently worn
      slots: { 1: null, 2: null }, // weapon ids
      ammo: { 1: 0, 2: 0 },
      locations: {}, // { [locationId]: { damage, armorDamage } }
      cover: 0,
      abilities: [], // equipped ability ids
      maxAbilities: 3,
      resources: {}, // class counters: tp, stance, ram, heat, resonance, phase, pendulum
      conditions: [],
      turn: { inCombat: false, round: 1, used: 0, reserved: 0 },
      inbox: [], // unread GM transmissions { id, t, text, private }
    },
  };
}

/** Every number the sheet shows, computed from the character + data. */
export function deriveSheet(character, data) {
  const a = character.attributes;
  const combat = computeCombat(a, character.rowOffsets, data.combat);
  const hpMax = maxHp(a, data.body, character.mods.maxHp);
  const locationsMax = locationMaxHp(a, data.body, character.mods.locationHp);
  const armor = armorTotals(character.play.worn, data.armor, data.body, character.play.cover);
  const sub = character.subclassId ? findSubclass(data.classes, character.subclassId) : null;
  const skills = computeSkills(a, data.skills);
  const weapon = (id) => data.weapons.find((w) => w.id === id);
  const deck = data.decks.find((d) => d.id === character.play.deck) ?? null;
  const zone = zoneBonus(character.classId, character.play.resources, data.classes);
  return {
    attributes: a,
    skills,
    weapons: [1, 2].map((slot) => {
      const w = weapon(character.play.slots[slot]);
      if (!w) return { slot, empty: true };
      const zoneTn = isRanged(w) ? zone.rangedTn : 0; // Smuggler Cold: steadier aim
      return { slot, ...w, tn: weaponTN(w, skills) + zoneTn, zoneTn, rounds: character.play.ammo[slot] ?? 0 };
    }),
    deck: deck ? (() => {
      const capacity = deckCapacity(deck, character.play.deckMods ?? [], data.deckMods);
      return { ...deck, capacity, status: deckStatus(capacity, character.play.resources) };
    })() : null,
    lifestyle: (() => {
      const upkeep = lifestyleUpkeep(character.play.lifestyle ?? [], data);
      const tierOf = (cat) => upkeep.entries.find((x) => x.category === cat)?.tier ?? null;
      return { ...upkeep, tiers: Object.fromEntries(data.lifestyle.categories.map((k) => [k.id, tierOf(k.id)])) };
    })(),
    combat,
    zone,
    move: combat.sqr.value + zone.squares, // squares per Move action
    initiative: initiative(a, data.combat),
    hp: { max: hpMax, current: character.play.hp ?? hpMax },
    locations: data.body.locations.map((loc) => {
      const state = character.play.locations[loc.id] ?? { damage: 0, armorDamage: 0 };
      const worn = armor.locations[loc.id] - character.play.cover; // armor marks from worn pieces only
      return {
        ...loc,
        max: locationsMax[loc.id],
        current: locationsMax[loc.id] - state.damage,
        armorMax: worn,
        armor: Math.max(0, worn - state.armorDamage), // marks left on the worn pieces
        cover: character.play.cover, // terrain bonus, never destroyed
      };
    }),
    armor,
    class: sub ? { id: sub.cls.id, name: sub.cls.name, subclass: sub.sub, tn: classTN(a, sub.sub) } : null,
  };
}
