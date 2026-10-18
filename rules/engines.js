// Class engines: can an ability be used now, what using it does, and round/combat transitions.
// All functions take and return plain `resources` objects (no mutation).

import { canRunHack, deckStatus, zoneFor } from './classes.js';
import { tunedAbility } from './progress.js';

export function defaultResources(classId) {
  switch (classId) {
    case 'soldier': return { tp: 0, stance: 'attack' };
    case 'hacker': return { ram: 0, heat: 0, bluescreen: false, stunned: false, sustained: [] };
    case 'techwiz': return { sync: 0, mode: 'mend', offline: 0, switched: false };
    case 'smuggler': return { pendulum: 0, used: [] }; // used: once-per-combat abilities spent
    default: return {};
  }
}

const applyDelta = (value, change, min, max) => {
  const next = 'set' in change ? change.set : value + change.delta;
  return Math.max(min, Math.min(max, next));
};

// ------------------------------------------------------------------ weapon abilities

/** Guns, not melee: anything that reaches past an adjacent square. */
export const isRanged = (w) => (w?.range?.max ?? 0) > 1;

/** The readied weapon an ability fires: the first that qualifies (a gun if `ranged`; enough rounds, or melee). */
export function abilityWeapon(a, weapons = []) {
  if (!a.weapon) return null;
  return weapons.find((w) => !w.empty && w.usable !== false && (!a.weapon.ranged || isRanged(w)) && (!a.weapon.minAmmo || !w.magSize || w.rounds >= a.weapon.minAmmo)) ?? null;
}

function weaponCheck(a, ctx) {
  if (!a.weapon || !ctx.weapons || abilityWeapon(a, ctx.weapons)) return null;
  return a.weapon.minAmmo
    ? { ok: false, code: 'needAmmo', vars: { n: a.weapon.minAmmo }, reason: `Needs a weapon with ${a.weapon.minAmmo}+ rounds` }
    : { ok: false, code: 'needWeapon', reason: 'Needs a readied weapon' };
}

// ------------------------------------------------------------------ soldier

function soldierCheck(a, r, ctx = {}) {
  const noWeapon = weaponCheck(a, ctx);
  if (noWeapon) return noWeapon;
  if (r.tp < a.cost) return { ok: false, code: 'needTp', vars: { n: a.cost }, reason: `Needs ${a.cost} TP` };
  if (!['any', 'current'].includes(a.stanceFrom) && a.stanceFrom !== r.stance) {
    const stance = a.stanceFrom[0].toUpperCase() + a.stanceFrom.slice(1); // stance names are game terms: Defensive, Attack, Onslaught
    return { ok: false, code: 'needStance', vars: { stance }, reason: `Needs ${stance} stance` };
  }
  return { ok: true, reason: null };
}
function soldierUse(a, r) {
  return { ...r, tp: r.tp - a.cost + a.gain, stance: a.stanceTo === 'current' ? r.stance : a.stanceTo };
}

// ------------------------------------------------------------------ hacker

// Hard reboot: stunned = round ends left with the deck offline (this round and the next).
const REBOOT_ROUNDS = 2;

function hackerUse(a, r, capacity) {
  if (a.clearsRam === 'all') return { ...r, ram: 0, sustained: [], heat: a.heatVent === 'all' ? 0 : r.heat, stunned: REBOOT_ROUNDS };
  if (a.clearsRam === 'sustained') return { ...r, ram: 0, sustained: [] }; // Release Payload: every sustained hack at once
  let next = { ...r, heat: r.heat + a.heat };
  if (a.heatVent && a.heatVent !== 'all') next.heat = Math.max(0, r.heat - a.heatVent);
  if (a.sustained) next = { ...next, ram: next.ram + a.ram, sustained: [...r.sustained, a.id] };
  if (capacity && next.heat >= capacity.heatCap) next = { ...next, heat: capacity.heatCap };
  return next;
}

/** Ends one sustained payload and frees its RAM. */
export function releasePayload(r, abilityId, abilities) {
  const idx = r.sustained.indexOf(abilityId);
  if (idx === -1) return r;
  const a = abilities.hacker.find((x) => x.id === abilityId);
  const sustained = r.sustained.filter((_, i) => i !== idx);
  return { ...r, sustained, ram: Math.max(0, r.ram - (a?.ram ?? 0)) };
}

// ------------------------------------------------------------------ tech wizard (Field Sync)
// Sync 0–3 (Cold, Warm, Tuned, Resonant) builds while the rig holds one mode (Mend / Surge).

export const SYNC_MAX = 3;
const SYNC_LEVELS = ['Cold', 'Warm', 'Tuned', 'Resonant'];

/** Saves from before Field Sync stored { resonance, phase }. */
export function upgradeTechResources(r) {
  if (r && 'sync' in r) return r;
  return { sync: Math.min(SYNC_MAX, r?.resonance ?? 0), mode: r?.phase === 1 ? 'surge' : 'mend', offline: r?.phase === -1 ? 1 : 0, switched: false };
}

function techCheck(a, r) {
  if (r.offline > 0) return { ok: false, code: 'brownout', reason: 'Brownout: rig offline' };
  if (r.sync < a.minSync) return { ok: false, code: 'needSync', vars: { level: SYNC_LEVELS[a.minSync] }, reason: `Needs Sync ${SYNC_LEVELS[a.minSync]}` };
  return { ok: true, reason: null };
}
/** ctx.resonant: a Resonant cast (both faces) — only at Sync 3, and it spends it all. */
function techUse(a, r, ctx) {
  if (a.brownout) return { ...r, sync: 0, offline: 2 }; // offline this round and the next
  if (ctx.resonant) {
    if (r.sync < SYNC_MAX) throw new Error('A Resonant cast needs Sync 3.');
    return { ...r, sync: ctx.talents?.resonantFloor ?? 0 }; // Overload: never below Warm
  }
  return { ...r, sync: Math.min(SYNC_MAX, r.sync + 1) };
}

/** Switching mode is free but re-tunes the rig: Sync back to 0 (Steady Rig: keep up to `keep`). */
export function switchMode(r, mode, keep = 0) {
  return mode === r.mode ? r : { ...r, mode, sync: Math.min(r.sync, keep), switched: true };
}

/** Disruption: damage to a body location costs 1 Sync. */
export const disruptSync = (r) => ({ ...r, sync: Math.max(0, r.sync - 1) });

// ------------------------------------------------------------------ smuggler

/** requires > 0: pendulum must be at least that hot; requires < 0: at least that cold. */
function smugglerCheck(a, r, ctx = {}) {
  const noWeapon = weaponCheck(a, ctx);
  if (noWeapon) return noWeapon;
  if (a.oncePerCombat && (r.used ?? []).filter((x) => x === a.id).length >= (a.uses ?? 1)) return { ok: false, code: 'oncePerCombat', reason: 'Once per combat: already used' };
  if (a.requires == null) return { ok: true, reason: null };
  const ok = a.requires > 0 ? r.pendulum >= a.requires : r.pendulum <= a.requires;
  const need = `${a.requires > 0 ? '≥ +' : '≤ '}${a.requires}`;
  return ok ? { ok, reason: null } : { ok, code: 'needPendulum', vars: { need }, reason: `Needs pendulum ${need}` };
}
function smugglerUse(a, r) {
  const used = a.oncePerCombat ? [...(r.used ?? []), a.id] : r.used;
  return { ...r, pendulum: applyDelta(r.pendulum, a.shift, -4, 4), used };
}

/** Smuggler zone bonuses (decision 38): Cold +2 TN on gun attacks; Hot +1 damage and +1 square. Zero for other classes. */
export function zoneBonus(classId, r, classesData, talents = {}) {
  const none = { zone: null, name: null, rangedTn: 0, damage: 0, squares: 0 };
  if (classId !== 'smuggler') return none;
  const z = zoneFor(r?.pendulum ?? 0, classesData.classes.find((c) => c.id === 'smuggler').resources.zones);
  const damage = z?.bonus?.damage ? z.bonus.damage + (talents.hotDamage ?? 0) : 0; // Hair Trigger: Hot hits harder
  return z ? { zone: z.id, name: z.name, rangedTn: z.bonus?.rangedTn ?? 0, damage, squares: z.bonus?.squares ?? 0 } : none;
}

// ------------------------------------------------------------------ public API

/** @returns {{ok: boolean, reason: string|null}} ctx.arms: broken arms (both → no hands abilities); ctx.talents: talent effects. */
export function canUse(classId, base, resources, ctx = {}) {
  const ability = tunedAbility(base, ctx.talents);
  if (ability.hands && ctx.arms >= 2) return { ok: false, code: 'needHands', reason: 'Needs at least one working arm' };
  switch (classId) {
    case 'soldier': return soldierCheck(ability, resources, ctx);
    case 'hacker': {
      if (resources.stunned) return { ok: false, code: 'rebooting', reason: 'Deck rebooting' };
      return canRunHack(ability, ctx.capacity ? deckStatus(ctx.capacity, resources) : null);
    }
    case 'techwiz': return techCheck(ability, resources);
    case 'smuggler': return smugglerCheck(ability, resources, ctx);
    default: return { ok: false, code: 'noClass', reason: 'No class' };
  }
}

export function useAbility(classId, base, resources, ctx = {}) {
  const ability = tunedAbility(base, ctx.talents);
  switch (classId) {
    case 'soldier': return soldierUse(ability, resources);
    case 'hacker': return hackerUse(ability, resources, ctx.capacity);
    case 'techwiz': return techUse(ability, resources, ctx);
    case 'smuggler': return smugglerUse(ability, resources);
    default: return resources;
  }
}

/**
 * End-of-round processing for the class engine (manual 7-8).
 * ctx: { capacity (hacker deck), wounded (smuggler took damage), classesData }
 */
export function roundEnd(classId, r, ctx = {}) {
  switch (classId) {
    case 'hacker': {
      if (r.stunned) return { ...r, stunned: r.stunned === true ? 0 : r.stunned - 1 }; // `true`: saves from before the 2-round reboot
      const rules = ctx.classesData.classes.find((c) => c.id === 'hacker').resources.roundEnd;
      if (!ctx.capacity) return r;
      const t = ctx.talents ?? {};
      if (r.bluescreen) return { ...r, bluescreen: false, heat: Math.max(0, ctx.capacity.heatCap - rules.rebootHeatBelowCap - (t.rebootBelowCap ?? 0)) };
      if (r.heat >= ctx.capacity.heatCap) { // Blue Screen: locked next round; sustained hacks crash with it (Ghost keeps them)
        return t.keepSustainedOnBluescreen ? { ...r, bluescreen: true } : { ...r, bluescreen: true, sustained: [], ram: 0 };
      }
      return { ...r, heat: Math.max(0, r.heat - rules.heatVent - (t.heatVent ?? 0)) };
    }
    case 'techwiz': {
      if (r.offline > 0) return { ...r, offline: r.offline - 1, switched: false };
      return { ...r, sync: r.switched ? r.sync : Math.min(SYNC_MAX, r.sync + 1), switched: false }; // held the mode: +1
    }
    case 'smuggler': return ctx.wounded ? { ...r, pendulum: Math.min(4, r.pendulum + 1) } : r;
    default: return r;
  }
}

/** A normal attack that hits builds momentum: Soldier +1 TP. */
export function weaponHit(classId, r) {
  return classId === 'soldier' ? { ...r, tp: (r.tp ?? 0) + 1 } : r;
}

/** Damage multiplier of the current Soldier stance (1 for every other class). */
export function stanceMultiplier(classId, r, classesData) {
  if (classId !== 'soldier') return 1;
  return classesData.classes.find((c) => c.id === 'soldier').resources.stances.find((s) => s.id === r?.stance)?.dealt ?? 1;
}

/**
 * Start of a new combat: Soldier TP back to 0, Tech Wizard Sync back to Cold, Smuggler once-per-combat abilities ready.
 * talents: Drilled starts with TP, Quick Tune starts Warm.
 */
export function combatStart(classId, r, talents = {}) {
  if (classId === 'soldier') return { ...r, tp: talents.startTp ?? 0, stance: 'attack' };
  if (classId === 'techwiz') return { ...r, sync: Math.min(SYNC_MAX, talents.startSync ?? 0), offline: 0, switched: false };
  if (classId === 'smuggler') return { ...r, used: [] };
  return r;
}
