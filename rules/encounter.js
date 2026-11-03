// Combat encounter for the GM console: initiative order, turns, rounds, enemy instances.
// Pure functions over a plain object; every function returns a new encounter (no mutation).

import { intelRef } from './intel.js';
import { roll } from './dice.js';
import { hitLocations } from './body.js';
import { locationOutcome } from './injuries.js';
import { damageDice, allowance } from './turn.js';
import { conditionMods, againstMods } from './conditions.js';
import { stamp, stampNew, atTurnEnd, atRoundEnd, atHit, atFightEnd, prune } from './condition-time.js';

/**
 * entry = { key, kind: 'player'|'enemy', name, init, roll, reinforcement, enemy? }
 *   player entries: key = character id
 *   enemy entries:  key = 'e1', 'e2'…; enemy = live instance (see spawn)
 */
export const newEncounter = () => ({
  id: null, active: false, round: 1, order: [], acted: [], entries: [], seq: 0, letters: 0,
});

/** Enemy letters for the table: A…Z, then A2…Z2. Never reused within an encounter. */
export const letterOf = (i) => `${String.fromCharCode(65 + (i % 26))}${i >= 26 ? Math.floor(i / 26) + 1 : ''}`;
/** Back from a letter to its place (A → 0, B2 → 27). */
export const letterIndex = (l) => (l.charCodeAt(0) - 65) + 26 * ((Number(l.slice(1)) || 1) - 1);

/** Encounters saved before "acted" existed used a turn index; set-ups saved unsorted get sorted. */
export function upgradeEncounter(enc) {
  const { turn = 0, ...rest } = enc;
  const acted = Array.isArray(enc.acted) ? enc.acted : enc.active ? enc.order.slice(0, turn) : [];
  const next = { ...rest, acted, order: enc.active ? enc.order : sortKeys(enc.entries), letters: enc.letters ?? 0 };
  next.entries = enc.entries.map((e) => (e.kind !== 'enemy' || e.letter ? e : { ...e, letter: letterOf(next.letters++), publicName: '', hidden: false }));
  return next;
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
    maxArmor: template.armor, // armor cracks from location attacks it stopped; the GM can repair it
    actions: template.actions,
    used: 0,
    sqr: template.sqr,
    attacks: structuredClone(template.attacks ?? []),
    talents: structuredClone(template.talents ?? []),
    immune: [...(template.immune ?? [])], // conditions this enemy shrugs off (elites: "can't be knocked down"…)
    vision: template.vision ?? 'none', // decision 76: none / night / thermal — darkness doesn't hide anyone from night vision or thermal
    injuries: { arm: 0, leg: 0 }, // broken arms / crippled legs (synthetic: jammed mounts are a condition)
    conditions: [],
    notes: '',
  };
}

/** Sort: highest total first; ties → higher bonus, then players before enemies. Reinforcements go last. */
function sortKeys(entries) {
  entries = entries.filter((e) => !e.waiting); // decision 211: waiting enemies aren't in the order until they join
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
/**
 * opts.waiting (decision 211): placed for later — hidden, out of the order, the challenge and the players' list
 * until the GM has them join (startCombat's `join`, or joinFight during a fight).
 */
/** group: { id, name } — decision 232: the group these copies belong to (spotting one preselects the others). */
export function addEnemies(enc, template, count = 1, { waiting = false, group = null } = {}) {
  const next = clone(enc);
  const kin = next.entries.filter((e) => e.enemy?.templateId === template.id);
  const same = kin.length;
  const top = Math.max(same, ...kin.map((e) => Number(/#(\d+)$/.exec(e.name)?.[1] ?? 1))); // numbers go on from the highest (removals, enemies back from a map)
  for (let i = 0; i < count; i++) {
    next.seq += 1;
    const n = top + i + 1;
    const label = count + same > 1 ? `${template.name} #${n}` : template.name;
    const letter = letterOf(next.letters ?? 0);
    next.letters = (next.letters ?? 0) + 1;
    next.entries.push({
      key: `e${next.seq}`, kind: 'enemy', name: label, init: template.init ?? 0, roll: null, reinforcement: next.active, enemy: spawn(template, label),
      letter, publicName: template.publicName ?? '', hidden: waiting, // what the players' sheets see (publicView)
      look: n, // decision 152: which picture this copy wears (looks cycle through what exists)
      ...(waiting ? { waiting: true } : {}),
      ...(group ? { group: { id: String(group.id), name: String(group.name ?? '').slice(0, 40) } } : {}),
    });
    if (next.active && !waiting) next.order.push(`e${next.seq}`);
  }
  if (!next.active) next.order = sortKeys(next.entries);
  return next;
}

/**
 * Decision 158: an enemy's attack as its conditions make it — its own (Blinded −10, Suppressed −4, Focused +2 TN;
 * Enraged +2 melee damage) and the target's (melee at someone Prone +4, ranged at someone Blinded +4).
 * @returns { tn, base, parts: [{ name, tn }], damageBonus, melee }
 */
export function enemyAttackTn(attack, enemy, data, { located = false, targetConditions = [] } = {}) {
  const melee = attack.type === 'melee';
  const own = conditionMods(enemy.conditions, data.conditions);
  const mine = enemy.conditions.map((id) => data.conditions.find((c) => c.id === id)).filter((c) => c?.mods?.attackTn).map((c) => ({ name: c.name, tn: c.mods.attackTn }));
  const vs = againstMods(targetConditions, data.conditions, { melee });
  const base = attack.tn - (located ? data.body.locationAttack.tnPenalty : 0);
  return { tn: base + own.attackTn + vs.tn, base, parts: [...mine, ...vs.parts.map((p) => ({ name: `${p.name} target`, tn: p.tn }))], damageBonus: melee ? own.meleeDamage : 0, melee };
}

/** Decision 158: an enemy's actions this round — Overdrive +1, Slowed −1, Stunned 1 (the players' rule). */
export const enemyActions = (enemy, data) => allowance(enemy.actions + conditionMods(enemy.conditions, data.conditions).act, enemy.conditions, data.actions);

/** Decision 152: which picture an enemy wears (1, 2, 3… — cycles through what exists). */
export function setLook(enc, key, look) {
  const next = clone(enc);
  const e = entryOf(next, key);
  if (e?.enemy) e.look = Math.max(1, Math.round(Number(look) || 1));
  return next;
}

/** Decision 152: an entry fights on the crew's side — the sheets show it named, in green, under Allies. */
export function setAlly(enc, key, on) {
  const next = clone(enc);
  const e = entryOf(next, key);
  if (e?.enemy) e.ally = Boolean(on);
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
/** keys: only these (decision 232: Prepare rolls for the enemies and the players the GM took over, never for a player still rolling). */
export function rollInitiative(enc, data, rng = Math.random, { all = false, keys = null } = {}) {
  const next = clone(enc);
  for (const e of next.entries) if (!e.waiting && (!keys || keys.includes(e.key)) && (all || e.roll == null)) e.roll = roll(data.encounter.initiativeDie, rng).total; // decision 212: waiting enemies roll when they join
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

/**
 * Decision 218: an enemy flees — out of the fight and back to waiting (hidden, out of the order, no roll), its HP,
 * armor and conditions kept, so a later fight can bring it back as it left. New encounter keeps it.
 */
export function fleeEnemy(enc, key) {
  const next = clone(enc);
  const e = entryOf(next, key);
  if (!e?.enemy) return next;
  Object.assign(e, { waiting: true, hidden: true, reinforcement: false, roll: null });
  next.order = next.order.filter((k) => k !== key);
  next.acted = next.acted.filter((k) => k !== key);
  return next;
}

/**
 * Decision 232: End fight with a map on the table — the enemies (and allies) still standing wait again where they are
 * (seen stays seen: no new contact), the fallen leave the tracker (the map turns them into bodies). Initiative clears.
 * @returns { enc, fallen: [{ key, name, notes }], standing: [keys] }
 */
export function endFight(enc, data = null) {
  let next = endCombat(enc, data);
  const fighters = next.entries.filter((e) => e.enemy && !e.waiting);
  const fallen = fighters.filter((e) => e.enemy.hp <= 0).map((e) => ({ key: e.key, name: e.name, notes: e.enemy.notes ?? '' }));
  for (const f of fallen) next = removeEntry(next, f.key);
  const standing = fighters.filter((e) => e.enemy.hp > 0).map((e) => e.key);
  for (const e of next.entries) if (standing.includes(e.key)) Object.assign(e, { waiting: true, reinforcement: false, roll: null });
  next.order = sortKeys(next.entries);
  return { enc: next, fallen, standing };
}

/** Decision 232: put enemies in a group ({ id, name }), or take them out of theirs (null). */
export function setGroup(enc, keys, group) {
  const next = clone(enc);
  for (const e of next.entries) {
    if (!e.enemy || !keys.includes(e.key)) continue;
    if (group) e.group = { id: String(group.id), name: String(group.name ?? '').slice(0, 40) };
    else delete e.group;
  }
  return next;
}
/** Decision 232: the enemies in the same group as any of these keys (the keys themselves not included). */
export function groupMates(enc, keys) {
  const ids = new Set(enc.entries.filter((e) => keys.includes(e.key) && e.group).map((e) => e.group.id));
  return enc.entries.filter((e) => e.group && ids.has(e.group.id) && !keys.includes(e.key)).map((e) => e.key);
}

/** Decision 211: the waiting enemies' keys. */
export const waitingKeys = (enc) => enc.entries.filter((e) => e.waiting).map((e) => e.key);

/**
 * Decision 211: waiting enemies join the fight — `reveal`ed ones show to the players, the rest stay hidden (an
 * ambusher). During a fight they come in as reinforcements (they act last this round).
 */
export function joinFight(enc, keys, { reveal = [] } = {}) {
  const next = clone(enc);
  for (const e of next.entries) {
    if (!e.waiting || !keys.includes(e.key)) continue;
    delete e.waiting;
    e.hidden = !reveal.includes(e.key);
    if (next.active) { e.reinforcement = true; next.order.push(e.key); }
  }
  if (!next.active) next.order = sortKeys(next.entries);
  return next;
}

/**
 * Decision 211: waiting enemies saved with a map's table state come back into the encounter, with fresh keys and
 * letters where theirs are taken. Returns { enc, keys: { old: new } } (the map's markers follow the new keys).
 */
export function addWaiting(enc, entries = []) {
  const next = clone(enc);
  const keys = {};
  const letters = new Set(next.entries.map((e) => e.letter).filter(Boolean));
  for (const saved of entries) {
    if (!saved?.enemy) continue;
    next.seq += 1;
    const key = `e${next.seq}`;
    let letter = saved.letter;
    if (!letter || letters.has(letter)) { letter = letterOf(next.letters ?? 0); next.letters = (next.letters ?? 0) + 1; }
    next.letters = Math.max(next.letters ?? 0, letterIndex(letter) + 1); // later enemies never get the same letter
    letters.add(letter);
    keys[saved.key] = key;
    next.entries.push({ ...structuredClone(saved), key, letter, waiting: true, hidden: true, reinforcement: false });
  }
  return { enc: next, keys };
}

/** opts.join (decision 211; the console now joins them in the setup first, decision 212): waiting enemies that join (revealed: opts.reveal). */
export function startCombat(enc, data, rng = Math.random, { join = [], reveal = [] } = {}) {
  const next = rollInitiative(joinFight(enc, join, { reveal }), data, rng);
  next.id = `c${Date.now().toString(36)}`;
  next.active = true;
  next.round = 1;
  next.acted = [];
  next.entries.forEach((e) => { e.reinforcement = false; if (e.enemy) e.enemy.used = 0; });
  next.order = sortKeys(next.entries);
  return next;
}

/**
 * Decision 233: the head start (manual 6-4, the Prep Phase "zero-round"). The fight opens at round 0: the crew acts with
 * n prep actions each, all at once (no order, no current), the enemies don't act; initiative comes after.
 * surprise: complete surprise — round 1 is a Surprise Round (targets can't take reactions; a reminder, manual 6-4).
 */
export function startHeadStart(enc, { n = 1, surprise = false } = {}) {
  const next = clone(enc);
  next.id = `c${Date.now().toString(36)}`;
  next.active = true;
  next.round = 0;
  next.acted = [];
  next.order = []; // nobody's turn: everyone acts at once
  next.head = { n: Math.min(3, Math.max(1, Math.round(Number(n) || 1))), surprise: Boolean(surprise) };
  next.entries.forEach((e) => { e.reinforcement = false; if (e.enemy) e.enemy.used = 0; });
  return next;
}

/**
 * Decision 233: the head start is over — round 1 in initiative order. Enemies without a die get one now (players
 * rolled on their sheets, or the GM typed / rolled theirs), as a normal Start fight does.
 */
export function beginAfterHeadStart(enc, data, rng = Math.random) {
  const next = rollInitiative(enc, data, rng, { keys: enc.entries.filter((e) => e.kind !== 'player').map((e) => e.key) });
  next.round = 1;
  next.acted = [];
  next.order = sortKeys(next.entries);
  return next;
}

/**
 * Decision 237: round countdowns — "3 rounds: reinforcements arrive". Each End round ticks them down; at 0 they fire
 * (next.fired, for the GM's log) and go. show: the players see it ("⏰ 2 rounds — The bomb"). Narrative only.
 */
export function addCountdown(enc, { label, rounds, show = false }) {
  const next = clone(enc);
  const n = Math.max(1, Math.min(20, Math.round(Number(rounds) || 1)));
  next.cdSeq = (next.cdSeq ?? 0) + 1;
  next.countdowns = [...(next.countdowns ?? []), { id: `cd${next.cdSeq}`, label: String(label ?? '').trim().slice(0, 60) || 'Countdown', left: n, show: Boolean(show) }];
  return next;
}
export function removeCountdown(enc, id) {
  const next = clone(enc);
  next.countdowns = (next.countdowns ?? []).filter((c) => c.id !== id);
  return next;
}

/** Next turn: whoever is acting now is done. When everyone is done the round waits for endRound. */
export function nextTurn(enc, data = null) {
  const key = currentKey(enc);
  return key ? markActed(enc, key, true, data) : clone(enc);
}

/** Marks a combatant as done (or not) this round — any order, so the table can act out of sequence. */
export function markActed(enc, key, done = true, data = null) {
  const next = clone(enc);
  next.acted = done ? [...new Set([...next.acted, key])] : next.acted.filter((k) => k !== key);
  const e = entryOf(next, key);
  if (done && data && e?.enemy) wearOff(e, (c, t) => atTurnEnd(c, t), next, data); // decision 236: its turn is over
  return next;
}

/** Decision 236: conditions put on an enemy — stamped with how long they last (ability lengths in `lasts`). */
export function putConditions(enc, key, ids, data, { lasts = {} } = {}) {
  const next = clone(enc);
  const e = entryOf(next, key);
  if (!e?.enemy) return next;
  const add = ids.filter((c) => !(e.enemy.immune ?? []).includes(c));
  e.enemy.conditions = [...new Set([...e.enemy.conditions, ...add])];
  e.enemy.condTimes = stamp(e.enemy.condTimes, add, { round: next.active ? next.round : 0, own: next.active && currentKey(next) === key, lasts }, data);
  return next;
}
/** Decision 236: a condition taken off (or toggled) by hand on an enemy — its stamp follows. */
export function toggleCondition(enc, key, id, data) {
  const e = entryOf(enc, key);
  if (!e?.enemy) return clone(enc);
  if (!e.enemy.conditions.includes(id)) return putConditions(enc, key, [id], data);
  const next = clone(enc);
  const en = entryOf(next, key).enemy;
  en.conditions = en.conditions.filter((c) => c !== id);
  en.condTimes = prune(en.conditions, en.condTimes);
  return next;
}
/** Applies one of the condition-time steps to an enemy; what wore off goes into next.woreOff (for the GM's log). */
function wearOff(entry, step, next, data) {
  const en = entry.enemy;
  en.condTimes = stampNew(en.conditions, en.condTimes, { round: next.active ? next.round : 0 }, data); // any put on another way: from now
  const r = step(en.conditions, en.condTimes);
  en.conditions = r.conditions;
  en.condTimes = r.times;
  if (r.gone.length) next.woreOff = [...(next.woreOff ?? []), { name: entry.name, ids: r.gone }];
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
      wearOff(e, (c, t) => atRoundEnd(c, t, next.round), next, data); // decision 236: what lasts the round, or until the next one
    }
  }
  next.round += 1;
  next.acted = [];
  next.order = sortKeys(next.entries);
  // decision 237: the round countdowns tick; the ones at 0 fire
  const ticked = (next.countdowns ?? []).map((c) => ({ ...c, left: c.left - 1 }));
  const fired = ticked.filter((c) => c.left <= 0);
  next.countdowns = ticked.filter((c) => c.left > 0);
  if (fired.length) next.fired = fired.map((c) => c.label);
  return next;
}

export function endCombat(enc, data = null) {
  const next = clone(enc);
  next.active = false;
  next.acted = [];
  for (const e of next.entries) { e.roll = null; e.reinforcement = false; } // decision 212: the next fight rolls fresh initiative
  if (data) for (const e of next.entries) if (e.enemy && !e.waiting) wearOff(e, atFightEnd, next, data); // decision 236
  next.countdowns = []; // decision 237: they belong to the fight
  next.order = sortKeys(next.entries);
  return next;
}

/** What the players see of an enemy: the name the GM gives it at the table, and whether it is revealed. */
/** Decision 160: a renamed enemy's tag — the initials of two words ("Guard Captain" → GC) or the first two letters ("Sniper" → SN). */
export function initialsOf(name) {
  const words = String(name ?? '').replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? '').slice(0, 2)).toUpperCase();
}

export function setPublic(enc, key, { publicName, hidden } = {}) {
  const next = clone(enc);
  const e = entryOf(next, key);
  if (!e?.enemy) throw new Error('No such enemy.');
  if (publicName !== undefined) {
    e.publicName = String(publicName).trim().slice(0, 40);
    // decision 160: the tag follows the name the players see (the map marker, the tracker, the cards); a clash gets a number
    e.baseLetter ??= e.letter;
    const tag = initialsOf(e.publicName);
    if (tag) {
      const taken = new Set(next.entries.filter((x) => x !== e && x.letter).map((x) => x.letter));
      let n = 1;
      while (taken.has(n === 1 ? tag : `${tag}${n}`)) n += 1;
      e.letter = n === 1 ? tag : `${tag}${n}`;
    } else e.letter = e.baseLetter;
  }
  if (hidden !== undefined) e.hidden = Boolean(hidden);
  return next;
}

/** "B · Guard": how the table calls an enemy (the GM's public name, or the generic label). */
export const tableName = (e, data) => `${e.letter} · ${e.publicName || data.encounter.hostileLabel}`;

/** A rough wound band anyone at the table could see: unhurt, hurt, bloodied (≤ half), down. */
export function woundBand(hp, maxHp, data) {
  if (hp <= 0) return 'down';
  if (hp >= maxHp) return 'unhurt';
  return hp / maxHp <= data.encounter.bloodiedAt ? 'bloodied' : 'hurt';
}

/** Applies a change to one enemy instance. */
export function updateEnemy(enc, key, fn) {
  const next = clone(enc);
  const e = entryOf(next, key);
  if (!e?.enemy) throw new Error('No such enemy.');
  fn(e.enemy, e);
  return next;
}

/**
 * Damage to an enemy: armor absorbs first unless it is ignored. part (a location attack: 'head', 'arm'…):
 * damage that gets through adds the location's condition; armor that stops it all cracks by 1. cover (decision 204):
 * armor from where it stands, on top of what it wears — never halved or ignored, never cracks.
 * Returns { enc, absorbed, taken, condition, immune, crack }.
 */
export function damageEnemy(enc, key, amount, { ignoreArmor = false, armorHalf = false, part = null, cover = 0 } = {}, data = null) {
  let out = { absorbed: 0, taken: 0, condition: null, immune: false, crack: 0 };
  const next = updateEnemy(enc, key, (en) => {
    const worn = ignoreArmor ? 0 : armorHalf ? Math.floor(en.armor / 2) : en.armor; // decision 155: Bunker Buster, Kill Shot, special rounds
    const armor = worn + Math.max(0, Number(cover) || 0);
    if (part) {
      const o = locationOutcome({ part, damage: amount, armor, wornArmor: worn, hp: en.hp, maxHp: en.maxHp, tag: en.tag, immune: en.immune ?? [] }, data.body);
      out = { absorbed: amount - o.taken, taken: o.taken, condition: o.condition, immune: o.immune, crack: o.crack };
      const limb = o.condition && data.conditions.find((c) => c.id === o.condition)?.limb;
      en.injuries ??= { arm: 0, leg: 0 };
      if (limb) en.injuries[limb] = Math.min(2, en.injuries[limb] + 1);
      else if (o.condition && !en.conditions.includes(o.condition)) { en.conditions.push(o.condition); en.condTimes = stamp(en.condTimes, [o.condition], { round: enc.active ? enc.round : 0, own: enc.active && currentKey(enc) === key }, data); }
      en.armor = Math.max(0, en.armor - o.crack);
    } else {
      out.absorbed = Math.min(armor, amount);
      out.taken = Math.max(0, amount - out.absorbed);
    }
    en.hp = Math.max(0, en.hp - out.taken);
    if (data) { const h = atHit(en.conditions, en.condTimes); en.conditions = h.conditions; en.condTimes = h.times; } // decision 236: Exposed is used up
  });
  return { enc: next, ...out };
}

/**
 * Enemy attack: d20 roll-under the attack TN. located: a declared location attack (−4 TN) that also rolls
 * where it lands. On a hit: damage, and for a location attack the possible locations (the GM picks a side).
 */
export function enemyAttack(attack, data, rng = Math.random, { located = false } = {}) {
  const tn = attack.tn - (located ? data.body.locationAttack.tnPenalty : 0);
  const r = roll(data.encounter.attackDie, rng);
  const hit = r.total <= tn;
  const expr = damageDice(attack.damage);
  const damage = hit && expr ? roll(expr, rng) : null;
  const locRoll = hit && located ? roll(data.body.hitLocation.die, rng).total : null;
  const locations = locRoll ? hitLocations(locRoll, data.body).map((id) => data.body.locations.find((l) => l.id === id)) : [];
  return { attack: attack.name, tn, located, roll: r.total, hit, damage, extra: attack.damage.replace(expr ?? '', '').trim(), locRoll, locations };
}

/**
 * What players' sheets see. The order shows whose turn it is, with enemies anonymous ("Hostile"), so it never
 * tells which enemy acts when. Hostiles: the revealed enemies by letter, with what anyone could see — the
 * public name, organic/synthetic, a wound band and visible conditions. Never HP, armor, stats or initiative.
 */
export function publicView(enc, data, { art = null, faces = null } = {}) {
  const visible = (e) => e && !e.waiting && !(e.kind === 'enemy' && e.hidden);
  const limbs = data.conditions.filter((c) => c.limb);
  const shownName = (e) => e.publicName || (e.ally ? e.name : data.encounter.hostileLabel); // allies are known by name
  return {
    type: 'combat',
    id: enc.id,
    active: enc.active,
    round: enc.round,
    current: enc.round === 0 ? null : currentKey(enc),
    ...(enc.active && enc.head && enc.round === 0 ? { head: { n: enc.head.n } } : {}), // decision 233: the head start
    ...(enc.active && enc.head?.surprise && enc.round === 1 ? { surprise: true } : {}),
    ...(enc.active && (enc.countdowns ?? []).some((c) => c.show) ? { countdowns: enc.countdowns.filter((c) => c.show).map((c) => ({ label: c.label, left: c.left })) } : {}), // decision 237
    hostiles: enc.entries.filter((e) => e.enemy && visible(e)).map((e) => ({
      key: e.key,
      letter: e.letter,
      name: shownName(e),
      tag: e.enemy.tag ?? 'organic',
      elite: e.enemy.kind === 'elite',
      ally: Boolean(e.ally),
      art: art?.[e.enemy.templateId]?.key ?? null, // decision 152: an opaque key, never the bestiary id
      ref: e.enemy.templateId ? intelRef(e.enemy.templateId) : null, // decision 197: matched against a sheet's Intel (the same opaque key)
      look: e.look ?? 1,
      band: woundBand(e.enemy.hp, e.enemy.maxHp, data),
      conditions: [...e.enemy.conditions, ...limbs.filter((c) => e.enemy.injuries?.[c.limb] > 0).map((c) => c.id)],
    })),
    order: enc.order.map((k) => entryOf(enc, k)).filter(visible)
      .map((e) => ({
        key: e.kind === 'player' ? e.key : e.ally ? 'ally' : 'hostile',
        name: e.kind === 'player' ? e.name : e.ally ? shownName(e) : data.encounter.hostileLabel,
        ...(e.kind === 'player' && faces?.[e.key] ? { face: faces[e.key] } : {}), // decision 159: the player's portrait frame (the picture comes from the table)
        current: e.key === currentKey(enc),
        done: enc.active && enc.acted.includes(e.key),
        down: Boolean(e.enemy && e.enemy.hp <= 0),
      })),
  };
}
