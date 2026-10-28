// Class engines: can an ability be used now, what using it does, and round/combat transitions.
// All functions take and return plain `resources` objects (no mutation).

import { canRunHack, deckStatus, zoneFor } from './classes.js';
import { tunedAbility } from './progress.js';
import { RuleError } from './messages.js';

export function defaultResources(classId) {
  switch (classId) {
    case 'soldier': return { tp: 0, stance: 'ready' }; // decision 88: every fight starts Ready
    case 'hacker': return { ram: 0, heat: 0, bluescreen: false, stunned: false, sustained: [] };
    case 'techwiz': return { sync: 0, mode: 'mend', offline: 0, switched: false };
    case 'smuggler': return { pendulum: 0, used: [] }; // used: once-per-combat abilities spent
    case 'scavenger': return newTells();
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
/** ctx.resonant: a Resonant burst (both faces) — only at Sync 3, and it spends it all. */
function techUse(a, r, ctx) {
  if (a.brownout) return { ...r, sync: 0, offline: 2 }; // offline this round and the next
  if (ctx.resonant) {
    if (r.sync < SYNC_MAX) throw new Error('A Resonant burst needs Sync 3.');
    return { ...r, sync: ctx.talents?.resonantFloor ?? 0 }; // Overload: never below Warm
  }
  return { ...r, sync: Math.min(SYNC_MAX, r.sync + 1) };
}

/**
 * Switching mode is free but re-tunes the rig: Sync back to 0 (Steady Rig: keep up to `keep`).
 * opening (decision 146): the fight's opening choice — before your first action, picking a mode is setting up,
 * not a switch: Sync kept (Quick Tune's Warm too), the round-end +1 still comes.
 */
export function switchMode(r, mode, keep = 0, { opening = false } = {}) {
  if (mode === r.mode) return r;
  return opening ? { ...r, mode } : { ...r, mode, sync: Math.min(r.sync, keep), switched: true };
}

/** Decision 146: in a fight, round 1, nothing done yet (no action spent or borrowed) — the mode is still an opening choice. */
export const openingChoice = (turn) => Boolean(turn?.inCombat) && (turn.round ?? 1) === 1 && !turn.used && !turn.reserved && !(turn.spent ?? []).length;

/** Decision 174: what the generic ability limits need — in a fight, first action, uses this mission. c: the character. */
export const abilityContext = (c) => ({ inCombat: Boolean(c.play.turn?.inCombat), opening: openingChoice(c.play.turn), missionUses: c.play.abilityUses ?? {}, sceneUses: c.play.sceneUses ?? {} });

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

// ------------------------------------------------------------------ scavenger (Tells)
// Tells live on enemies: tells = { [enemy key]: 0–3 }. target = the enemy abilities spend from (Exploit is picked in the attack window).
// toPlace = Tells still to place this turn (a reminder); attacked = attacked this round (no Unseen next round).
// marks = enemies the player named by hand when no GM runs the fight ([{ key, name }]).

export const newTells = () => ({ tells: {}, target: null, toPlace: 0, attacked: false, used: [], marks: [] });

const tellRules = (classesData) => classesData.classes.find((c) => c.id === 'scavenger').resources.tells;

/** Optic numbers in play: the equipped optic, or bare AR lenses. */
export function opticStats(optic, classesData) {
  const base = tellRules(classesData).noOptic;
  return optic ? { range: optic.range, track: optic.track, mode: optic.mode ?? null } : { range: base.range, track: base.track, mode: null };
}

/**
 * Tells gained at the start of a turn: 1, or 2 when Unseen — full cover, or in the dark (unlit, and the GM
 * agrees the target can't see you: decision 76) — and no attack last round.
 */
export function tellGain(r, cover, classesData, inDark = false) {
  const rules = tellRules(classesData);
  return (cover >= rules.unseenCover || inDark) && !r.attacked ? rules.gainUnseen : rules.gain;
}

/** Puts Tells on (delta > 0) or takes them off an enemy. Max 3 each; only `track` enemies may hold Tells. */
export function placeTells(r, key, delta, { track, classesData }) {
  const per = tellRules(classesData).perEnemy;
  const have = r.tells[key] ?? 0;
  const next = Math.max(0, Math.min(per, have + delta));
  if (delta > 0 && have >= per) throw new RuleError('tellsFull', { n: per }, `At most ${per} Tells on one enemy.`);
  const holding = Object.entries(r.tells).filter(([k, n]) => n > 0 && k !== key).length;
  if (delta > 0 && have === 0 && holding >= track) throw new RuleError('trackFull', { n: track }, `Your optic tracks ${track} enemies at a time: drop the Tells on one first.`);
  const tells = { ...r.tells, [key]: next };
  if (!next) delete tells[key];
  const placed = Math.max(0, next - have);
  return { ...r, tells, toPlace: Math.max(0, (r.toPlace ?? 0) - placed) };
}

/** Enemies that went down or left the fight take their Tells with them. alive: keys still standing. */
export function pruneTells(r, alive) {
  const tells = Object.fromEntries(Object.entries(r.tells ?? {}).filter(([k]) => alive.includes(k)));
  const target = alive.includes(r.target) ? r.target : null;
  return { ...r, tells, target };
}

/** Exploit dice for n Tells spent on a hit: n × 1d4 (Dirty Fighting: d6 in melee). */
export function exploitDice(n, classesData, { melee = false, talents = {} } = {}) {
  const die = (melee && talents.exploitMeleeDie) || tellRules(classesData).exploitDie;
  return `${n}${die.slice(die.indexOf('d'))}`;
}

/** Exploit: a hit spends n of that enemy's Tells (never more than it has). */
export function spendTells(r, key, n) {
  const left = Math.max(0, (r.tells?.[key] ?? 0) - n);
  const tells = { ...r.tells, [key]: left };
  if (!left) delete tells[key];
  return { ...r, tells };
}

function scavengerCheck(a, r, ctx = {}) {
  const noWeapon = weaponCheck(a, ctx);
  if (noWeapon) return noWeapon;
  if (a.oncePerCombat && (r.used ?? []).filter((x) => x === a.id).length >= (a.uses ?? 1)) return { ok: false, code: 'oncePerCombat', reason: 'Once per combat: already used' };
  if ((a.tells || a.gain?.target) && !r.target) return { ok: false, code: 'needTarget', reason: 'Pick a target first' };
  if (a.tells && (r.tells?.[r.target] ?? 0) < a.tells) return { ok: false, code: 'needTells', vars: { n: a.tells }, reason: `Needs ${a.tells} Tells on the target` };
  return { ok: true, reason: null };
}
function scavengerUse(a, r, ctx = {}) {
  let next = { ...r, used: a.oncePerCombat ? [...(r.used ?? []), a.id] : r.used };
  if (a.tells) {
    const left = (r.tells[r.target] ?? 0) - a.tells;
    next.tells = { ...r.tells, [r.target]: left };
    if (!left) delete next.tells[r.target];
  }
  if (a.gain?.target && !ctx.failed) next = placeTells({ ...next, toPlace: next.toPlace + a.gain.target }, r.target, a.gain.target, { track: ctx.track ?? 1, classesData: ctx.classesData });
  if (a.gain?.spread && !ctx.failed) next.toPlace = (next.toPlace ?? 0) + a.gain.spread; // one on each of up to n enemies: placed by hand
  if (a.weapon || a.revealsYou) next.attacked = true; // decision 178: Scan shows you — no Unseen next round
  if (a.id === 'vanish') next.attacked = false;
  return next;
}

// ------------------------------------------------------------------ public API

/** @returns {{ok: boolean, reason: string|null}} ctx.arms: broken arms (both → no hands abilities); ctx.talents: talent effects. */
export function canUse(classId, base, resources, ctx = {}) {
  const ability = tunedAbility(base, ctx.talents);
  if (ability.hands && ctx.arms >= 2) return { ok: false, code: 'needHands', reason: 'Needs at least one working arm' };
  // decision 174: limits any ability may carry — out of a fight only, first action only, once per mission
  if (ability.outOfCombat && ctx.inCombat) return { ok: false, code: 'outOfCombat', reason: 'Out of a fight only' };
  if (ability.opening && 'opening' in ctx && !ctx.opening) return { ok: false, code: 'opening', reason: 'Only as your first action in a fight' };
  if (ability.perMission && (ctx.missionUses?.[ability.id] ?? 0) >= ability.perMission) return { ok: false, code: 'perMission', reason: 'Once per mission: already used' };
  if (ability.perScene && (ctx.sceneUses?.[ability.id] ?? 0) >= ability.perScene) return { ok: false, code: 'perScene', reason: 'Once per scene: already used' }; // decision 180
  switch (classId) {
    case 'soldier': return soldierCheck(ability, resources, ctx);
    case 'hacker': {
      if (resources.stunned) return { ok: false, code: 'rebooting', reason: 'Deck rebooting' };
      return canRunHack(ability, ctx.capacity ? deckStatus(ctx.capacity, resources) : null);
    }
    case 'techwiz':
      if (ability.drone && 'drone' in ctx && !ctx.drone) return { ok: false, code: 'needDrone', reason: 'Needs your drone' }; // decision 172
      return techCheck(ability, resources);
    case 'smuggler': return smugglerCheck(ability, resources, ctx);
    case 'scavenger': return scavengerCheck(ability, resources, ctx);
    default: return { ok: false, code: 'noClass', reason: 'No class' };
  }
}

/**
 * Decision 179: what a failed ability costs (abilityRoll.onFailure 'step'). Never the full price — one step:
 * Soldier 1 TP (if it costs any) · Hacker 1 heat (if it makes any; no RAM locked) · Scavenger 1 Tell off the target
 * (if it spends any) · Tech Wizard Sync −1 · Smuggler the pendulum one step toward 0. A builder that fails builds nothing.
 */
export function failAbility(classId, base, r, ctx = {}) {
  const a = tunedAbility(base, ctx.talents);
  switch (classId) {
    case 'soldier': return { ...r, tp: Math.max(0, (r.tp ?? 0) - Math.min(1, a.cost ?? 0)) };
    case 'hacker': return { ...r, heat: (r.heat ?? 0) + (a.heat > 0 ? 1 : 0) };
    case 'techwiz': return { ...r, sync: Math.max(0, (r.sync ?? 0) - 1) };
    case 'smuggler': { const p = r.pendulum ?? 0; return { ...r, pendulum: p - Math.sign(p) }; }
    case 'scavenger': {
      const next = { ...r, ...(a.weapon ? { attacked: true } : {}) };
      if (!a.tells || !r.target || !r.tells?.[r.target]) return next;
      const left = r.tells[r.target] - 1;
      next.tells = { ...r.tells, [r.target]: left };
      if (!left) delete next.tells[r.target];
      return next;
    }
    default: return r;
  }
}

export function useAbility(classId, base, resources, ctx = {}) {
  const ability = tunedAbility(base, ctx.talents);
  switch (classId) {
    case 'soldier': return soldierUse(ability, resources);
    case 'hacker': return hackerUse(ability, resources, ctx.capacity);
    case 'techwiz': return techUse(ability, resources, ctx);
    case 'smuggler': return smugglerUse(ability, resources);
    case 'scavenger': return scavengerUse(ability, resources, ctx);
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
      if (r.offline > 0) return { ...r, offline: r.offline - 1, switched: false, held: false };
      return { ...r, sync: r.switched ? r.sync : Math.min(SYNC_MAX, r.sync + 1), switched: false, held: false }; // held the mode: +1 · Recalibrate's lock ends (decision 177)
    }
    case 'smuggler': return ctx.wounded ? { ...r, pendulum: Math.min(4, r.pendulum + 1) } : r;
    case 'scavenger': return { ...r, toPlace: tellGain(r, ctx.cover ?? 0, ctx.classesData, ctx.inDark), attacked: false }; // next turn's Tells (a readied Exploit stays)
    default: return r;
  }
}

/** A normal attack that hits builds momentum: Soldier +1 TP. */
export function weaponHit(classId, r) {
  return classId === 'soldier' ? { ...r, tp: (r.tp ?? 0) + 1 } : r;
}

/** The Soldier's stance record (decision 88), or null for other classes; unknown stances read as Ready. */
export function stanceOf(classId, r, classesData) {
  if (classId !== 'soldier') return null;
  const all = classesData.classes.find((c) => c.id === 'soldier').resources.stances;
  return all.find((s) => s.id === r?.stance) ?? all.find((s) => s.default) ?? all[0];
}

/**
 * After an action (decision 88): a normal attack, Aim or an ability keeps the stance (abilities set their own);
 * anything else drops a Soldier back to Ready. Tactical Points stay. Returns the same object when nothing changes.
 */
export function stanceAfterAction(classId, r, kind, classesData) {
  if (classId !== 'soldier') return r;
  const res = classesData.classes.find((c) => c.id === 'soldier').resources;
  const ready = res.stances.find((s) => s.default)?.id ?? 'ready';
  return res.keepStance.includes(kind) || r.stance === ready ? r : { ...r, stance: ready };
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
export function combatStart(classId, r, talents = {}, { cover = 0, classesData = null } = {}) {
  if (classId === 'scavenger') {
    const fresh = { ...newTells(), marks: r.marks ?? [] };
    return { ...fresh, toPlace: (classesData ? tellGain(fresh, cover, classesData) : 1) + (talents.startTells ?? 0) };
  }
  if (classId === 'soldier') return { ...r, tp: talents.startTp ?? 0, stance: 'ready' };
  if (classId === 'techwiz') return { ...r, sync: Math.min(SYNC_MAX, talents.startSync ?? 0), offline: 0, switched: false };
  if (classId === 'smuggler') return { ...r, used: [] };
  return r;
}
