// Combat encounter for the GM console: initiative order, turns, rounds, enemy instances.
// Pure functions over a plain object; every function returns a new encounter (no mutation).

import { roll } from './dice.js';
import { hitLocations } from './body.js';
import { damageDice } from './turn.js';

/**
 * entry = { key, kind: 'player'|'enemy', name, init, roll, reinforcement, enemy? }
 *   player entries: key = character id
 *   enemy entries:  key = 'e1', 'e2'…; enemy = live instance (see spawn)
 */
export const newEncounter = () => ({
  id: null, active: false, round: 1, order: [], acted: [], entries: [], seq: 0,
});

/** Encounters saved before "acted" existed used a turn index; set-ups saved unsorted get sorted. */
export function upgradeEncounter(enc) {
  const { turn = 0, ...rest } = enc;
  const acted = Array.isArray(enc.acted) ? enc.acted : enc.active ? enc.order.slice(0, turn) : [];
  return { ...rest, acted, order: enc.active ? enc.order : sortKeys(enc.entries) };
}

const clone = (enc) => structuredClone(enc);
export const totalOf = (e) => (e.roll == null ? null : e.roll + e.init);
export const entryOf = (enc, key) => enc.entries.find((e) => e.key === key);
/** Now acting: the first one in order who hasn't acted this round (people may act out of order). */
export const currentKey = (enc) => (enc.active ? enc.order.find((k) => !enc.acted.includes(k)) ?? null : null);
export const roundOver = (enc) => enc.active && enc.order.length > 0 && enc.order.every((k) => enc.acted.includes(k));

/** A live enemy from a bestiary template. */
export function spawn(template, label) {
  return {
    templateId: template.id,
    kind: template.kind,
    tag: template.tag ?? 'organic', // what hacks can touch: organic / cybernetic / synthetic
    label,
    desc: template.desc,
    behaviour: template.behaviour,
    hp: template.hp,
    maxHp: template.hp,
    armor: template.armor,
    actions: template.actions,
    used: 0,
    sqr: template.sqr,
    attacks: structuredClone(template.attacks ?? []),
    talents: structuredClone(template.talents ?? []),
    locations: template.locations
      ? Object.fromEntries(Object.entries(template.locations).map(([k, v]) => [k, { hp: v.hp, maxHp: v.hp, armor: v.armor, maxArmor: v.armor }]))
      : null,
    conditions: [],
    notes: '',
  };
}

/** Sort: highest total first; ties → higher bonus, then players before enemies. Reinforcements go last. */
function sortKeys(entries) {
  const rank = (e) => [e.reinforcement ? 1 : 0, -(totalOf(e) ?? -99), -e.init, e.kind === 'player' ? 0 : 1];
  return [...entries]
    .sort((a, b) => {
      const ra = rank(a), rb = rank(b);
      for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return ra[i] - rb[i];
      return 0;
    })
    .map((e) => e.key);
}

/** Adds `count` copies of a template. Mid-fight they are reinforcements: they act last this round. */
export function addEnemies(enc, template, count = 1) {
  const next = clone(enc);
  const same = next.entries.filter((e) => e.enemy?.templateId === template.id).length;
  for (let i = 0; i < count; i++) {
    next.seq += 1;
    const n = same + i + 1;
    const label = count + same > 1 ? `${template.name} #${n}` : template.name;
    next.entries.push({ key: `e${next.seq}`, kind: 'enemy', name: label, init: template.init ?? 0, roll: null, reinforcement: next.active, enemy: spawn(template, label) });
    if (next.active) next.order.push(`e${next.seq}`);
  }
  if (!next.active) next.order = sortKeys(next.entries);
  return next;
}

/** Keeps player entries in step with the table: adds new players, refreshes names and INIT bonus. */
export function syncPlayers(enc, players) {
  const next = clone(enc);
  for (const p of players) {
    const e = entryOf(next, p.id);
    if (e) { e.name = p.name; e.init = p.init; continue; }
    next.entries.push({ key: p.id, kind: 'player', name: p.name, init: p.init, roll: null, reinforcement: next.active });
    if (next.active) next.order.push(p.id);
  }
  if (!next.active) next.order = sortKeys(next.entries);
  return next;
}

export function removeEntry(enc, key) {
  const next = clone(enc);
  next.entries = next.entries.filter((e) => e.key !== key);
  next.order = next.order.filter((k) => k !== key);
  next.acted = next.acted.filter((k) => k !== key);
  return next;
}

/** Rolls initiative for every entry without a roll (or all, with { all: true }). */
export function rollInitiative(enc, data, rng = Math.random, { all = false } = {}) {
  const next = clone(enc);
  for (const e of next.entries) if (all || e.roll == null) e.roll = roll(data.encounter.initiativeDie, rng).total;
  if (!next.active) next.order = sortKeys(next.entries);
  return next;
}

/** A player rolled at the table: the GM types the die result. */
export function setRoll(enc, key, value) {
  const next = clone(enc);
  const e = entryOf(next, key);
  if (e) e.roll = value === '' || value == null ? null : Number(value);
  if (!next.active) next.order = sortKeys(next.entries);
  return next;
}

export function startCombat(enc, data, rng = Math.random) {
  const next = rollInitiative(enc, data, rng);
  next.id = `c${Date.now().toString(36)}`;
  next.active = true;
  next.round = 1;
  next.acted = [];
  next.entries.forEach((e) => { e.reinforcement = false; if (e.enemy) e.enemy.used = 0; });
  next.order = sortKeys(next.entries);
  return next;
}

/** Next turn: whoever is acting now is done. When everyone is done the round waits for endRound. */
export function nextTurn(enc) {
  const key = currentKey(enc);
  return key ? markActed(enc, key, true) : clone(enc);
}

/** Marks a combatant as done (or not) this round — any order, so the table can act out of sequence. */
export function markActed(enc, key, done = true) {
  const next = clone(enc);
  next.acted = done ? [...new Set([...next.acted, key])] : next.acted.filter((k) => k !== key);
  return next;
}

/** Delay: the combatant moves to the end of this round's order. */
export function delay(enc, key) {
  const next = clone(enc);
  if (next.acted.includes(key)) throw new Error('Already acted this round.');
  next.order = [...next.order.filter((k) => k !== key), key];
  return next;
}

/** Round end: reinforcements roll in, order resets from initiative, enemy actions refill, short conditions clear. */
export function endRound(enc, data, rng = Math.random) {
  const next = clone(enc);
  for (const e of next.entries) {
    if (e.reinforcement && e.roll == null) e.roll = roll(data.encounter.initiativeDie, rng).total;
    e.reinforcement = false;
    if (e.enemy) {
      e.enemy.used = 0;
      e.enemy.conditions = e.enemy.conditions.filter((c) => !data.encounter.roundEndClears.includes(c));
    }
  }
  next.round += 1;
  next.acted = [];
  next.order = sortKeys(next.entries);
  return next;
}

export function endCombat(enc) {
  const next = clone(enc);
  next.active = false;
  next.acted = [];
  return next;
}

/** Applies a change to one enemy instance. */
export function updateEnemy(enc, key, fn) {
  const next = clone(enc);
  const e = entryOf(next, key);
  if (!e?.enemy) throw new Error('No such enemy.');
  fn(e.enemy, e);
  return next;
}

/** Damage to an enemy: armor absorbs first unless it is ignored. Returns { enc, absorbed, taken }. */
export function damageEnemy(enc, key, amount, { ignoreArmor = false } = {}) {
  let absorbed = 0, taken = 0;
  const next = updateEnemy(enc, key, (en) => {
    absorbed = ignoreArmor ? 0 : Math.min(en.armor, amount);
    taken = Math.max(0, amount - absorbed);
    en.hp = Math.max(0, en.hp - taken);
  });
  return { enc: next, absorbed, taken };
}

/** Enemy attack: d20 roll-under the attack TN; on a hit, damage and a hit location for the target. */
export function enemyAttack(attack, data, rng = Math.random) {
  const r = roll(data.encounter.attackDie, rng);
  const hit = r.total <= attack.tn;
  const expr = damageDice(attack.damage);
  const damage = hit && expr ? roll(expr, rng) : null;
  const locRoll = hit ? roll(data.body.hitLocation.die, rng).total : null;
  const locations = hit ? hitLocations(locRoll, data.body).map((id) => data.body.locations.find((l) => l.id === id)) : [];
  return { attack: attack.name, tn: attack.tn, roll: r.total, hit, damage, extra: attack.damage.replace(expr ?? '', '').trim(), locRoll, locations };
}

/** Which elite zone a player-style hit location lands on (chest/abdomen → torso…). */
export function eliteZone(locationId, data) {
  const bp = data.body.locations.find((l) => l.id === locationId)?.bp;
  return data.encounter.eliteLocations[bp] ?? null;
}

/** What players' sheets see: order and whose turn — enemies stay anonymous. */
export function publicView(enc, data) {
  return {
    type: 'combat',
    id: enc.id,
    active: enc.active,
    round: enc.round,
    current: currentKey(enc),
    order: enc.order.map((k) => entryOf(enc, k)).filter(Boolean)
      .map((e) => ({
        key: e.kind === 'player' ? e.key : 'hostile',
        name: e.kind === 'player' ? e.name : data.encounter.hostileLabel,
        current: e.key === currentKey(enc),
        done: enc.active && enc.acted.includes(e.key),
        down: Boolean(e.enemy && e.enemy.hp <= 0),
      })),
  };
}
