// Character model (schema v1) and full sheet derivation.

import { computeSkills, computeCombat, initiative, weaponTN } from '../rules/stats.js';
import { maxHp, armorTotals } from '../rules/body.js';
import { limbs, movement, usableWeapons } from '../rules/injuries.js';
import { emptyProgress, progressStatus, talentEffects } from '../rules/progress.js';
import { emptyDowntime } from '../rules/downtime.js';
import { findSubclass, classTN, deckCapacity, deckStatus } from '../rules/classes.js';
import { zoneBonus, isRanged, opticStats } from '../rules/engines.js';
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
      lifestyle: [], // lifestyle entry ids (rent tier, plans, bills)
      worn: [], // armor ids currently worn
      slots: { 1: null, 2: null }, // weapon ids
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
export function upgradeSave(c) {
  if (!c?.play) return c;
  if ('locations' in c.play) delete c.play.locations;
  c.play.armorDamage ??= 0;
  c.play.injuries ??= [];
  c.play.talentUses ??= {};
  c.play.optic ??= null;
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
  const a = character.attributes;
  const fx = data.talents ? talentEffects(character, data) : {};
  const combat = computeCombat(a, character.rowOffsets, data.combat);
  const hpMax = maxHp(a, data.body, character.mods.maxHp) + (fx.maxHp ?? 0);
  const partial = Math.min(...data.difficulty.cover.map((x) => x.armor).filter((n) => n > 0));
  const stance = character.classId === 'soldier' ? character.play.resources?.stance : null;
  const armor = armorTotals(character.play.worn, data.armor, {
    cover: character.play.cover + (character.play.cover === partial ? fx.partialCover ?? 0 : 0), // Cover Habit
    cracked: character.play.armorDamage ?? 0,
    bonus: stance ? fx.armorInStance?.[stance] ?? 0 : 0, // Hardened / Thick Plates
  });
  const injured = limbs(character.play.injuries ?? [], data.body);
  const sub = character.subclassId ? findSubclass(data.classes, character.subclassId) : null;
  const skills = computeSkills(a, data.skills).map((k) => (fx.skills?.[k.id] ? { ...k, value: k.value + fx.skills[k.id], talent: fx.skills[k.id] } : k));
  const weapon = (id) => data.weapons.find((w) => w.id === id);
  const deck = data.decks.find((d) => d.id === character.play.deck) ?? null;
  const optic = character.classId === 'scavenger' ? data.optics.find((o) => o.id === character.play.optic) ?? null : null;
  const zone = zoneBonus(character.classId, character.play.resources, data.classes, fx);
  return {
    attributes: a,
    skills,
    weapons: usableWeapons([1, 2].map((slot) => {
      const w = weapon(character.play.slots[slot]);
      if (!w) return { slot, empty: true };
      const zoneTn = isRanged(w) ? zone.rangedTn : 0; // Smuggler Cold: steadier aim
      return { slot, ...w, tn: weaponTN(w, skills) + zoneTn, zoneTn, rounds: character.play.ammo[slot] ?? 0 };
    }), injured.arms),
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
    move: movement(combat.sqr.value + zone.squares, injured.legs), // squares per Move action
    injured: { ...injured, locations: character.play.injuries ?? [] },
    initiative: initiative(a, data.combat) + (fx.initiative ?? 0),
    talents: fx, // merged automatic talent effects
    progress: data.progress ? progressStatus(character, data) : null,
    locationPenalty: Math.max(0, data.body.locationAttack.tnPenalty + (fx.locationPenalty ?? 0)), // Marksman
    abilityLimit: (character.play.maxAbilities ?? 3) + (data.progress ? progressStatus(character, data).abilitySlots : 0),
    immune: stance ? fx.immuneInStance?.[stance] ?? [] : [], // Unstoppable
    hp: { max: hpMax, current: character.play.hp ?? hpMax },
    armor,
    class: sub ? { id: sub.cls.id, name: sub.cls.name, subclass: sub.sub, tn: classTN(a, sub.sub) } : null,
  };
}
