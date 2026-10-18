// Encounter challenge estimate for the GM (decision 43). Expected damage per round on both sides:
//   actions × chance to hit (TN ÷ 20) × (average damage − the target's armor), best attack each.
// roundsToWin  = Σ enemy HP ÷ the party's damage per round against that enemy's armor
// roundsToLose = Σ player HP ÷ the enemies' damage per round against that player's armor
// ratio = roundsToLose ÷ roundsToWin → a colour band (data: encounter.challenge.bands).
// An estimate: abilities, cover, conditions and tactics are not counted. Returns codes; the screen words them.

import { damageDice } from './turn.js';
import { parseDice } from './dice.js';
import { stanceMultiplier } from './engines.js';

export const hitChance = (tn) => Math.min(0.95, Math.max(0.05, tn / 20));

/** Average and maximum of a damage text ("1d8+3 (Stun)"); null when it has no dice. */
export function damageStats(text) {
  const expr = damageDice(text ?? '');
  if (!expr) return null;
  const { count, sides, mod } = parseDice(expr);
  return { avg: count * (sides + 1) / 2 + mod, max: count * sides + mod };
}

/** A player as the estimate sees them: readied, usable weapons (or fists), damage with OFF / zone / stance. */
export function playerProfile(character, sheet, data) {
  const bonus = sheet.combat.off.value + (sheet.zone?.damage ?? 0);
  const mult = stanceMultiplier(character.classId, character.play.resources, data.classes);
  const weapons = sheet.weapons.filter((w) => !w.empty && w.usable !== false);
  const fists = data.weapons.find((w) => w.id === 'unarmed_fists');
  const list = weapons.length ? weapons : fists && sheet.injured.arms < 2 ? [{ ...fists, tn: sheet.skills.find((k) => k.id === fists.skill)?.value ?? 0 }] : [];
  const attacks = list.map((w) => {
    const d = damageStats(w.damage);
    return d ? { name: w.name, tn: w.tn, avg: Math.max(0, (d.avg + bonus) * mult), max: Math.max(0, (d.max + bonus) * mult) } : null;
  }).filter(Boolean);
  return {
    key: character.id, name: character.name || 'Unnamed', classId: character.classId,
    hp: sheet.hp.current, maxHp: sheet.hp.max, armor: sheet.armor.general, actions: sheet.combat.act.value, attacks,
  };
}

/** An enemy instance from the encounter. */
export function enemyProfile(name, en) {
  return {
    key: name, name, tag: en.tag ?? 'organic', hp: en.hp, maxHp: en.maxHp, armor: en.armor, actions: en.actions,
    attacks: (en.conditions?.includes('jammed') ? [] : en.attacks).map((a) => ({ name: a.name, tn: a.tn, ...(damageStats(a.damage) ?? { avg: 0, max: 0 }) })),
  };
}

/** Expected damage per round of one attacker against armor A (best attack; armor subtracts per hit). */
export function damagePerRound(attacker, armor, tnPenalty = 0) {
  const best = Math.max(0, ...attacker.attacks.map((a) => hitChance(a.tn - tnPenalty) * Math.max(0, a.avg - armor)));
  return attacker.actions * best;
}

const canHurt = (attacker, armor) => attacker.attacks.some((a) => a.avg > armor);
/** Copies share a note: "TRF Operator #2" → "TRF Operator". */
const kind = (name) => name.replace(/ #\d+$/, '');

/**
 * @param players  playerProfile[] (standing ones)   @param enemies enemyProfile[] (standing ones)
 * @param opts { tnPenalty: table difficulty on players' rolls, bands: [{ id, min }] highest first }
 */
export function assessChallenge(players, enemies, { tnPenalty = 0, bands } = {}) {
  if (!players.length || !enemies.length) return { band: null, reasons: [] };
  const partyVs = (armor) => players.reduce((s, p) => s + damagePerRound(p, armor, tnPenalty), 0);
  const enemiesVs = (armor) => enemies.reduce((s, e) => s + damagePerRound(e, armor), 0);
  const roundsToWin = enemies.reduce((s, e) => s + (partyVs(e.armor) > 0 ? e.hp / partyVs(e.armor) : Infinity), 0);
  const roundsToLose = players.reduce((s, p) => s + (enemiesVs(p.armor) > 0 ? p.hp / enemiesVs(p.armor) : Infinity), 0);
  const ratio = roundsToWin === Infinity ? 0 : roundsToLose === Infinity ? Infinity : roundsToLose / roundsToWin;
  const band = bands.find((b) => ratio >= b.min)?.id ?? bands.at(-1).id;

  const reasons = [];
  const partyActions = players.reduce((s, p) => s + p.actions, 0);
  const enemyActions = enemies.reduce((s, e) => s + e.actions, 0);
  if (enemyActions > partyActions) reasons.push({ code: 'actions', level: 'warn', vars: { enemy: enemyActions, party: partyActions } });

  const seen = new Set();
  for (const e of enemies) {
    const name = kind(e.name);
    if (seen.has(name)) continue; // one note per enemy type, not per copy
    seen.add(name);
    const able = players.filter((p) => canHurt(p, e.armor)).map((p) => p.name);
    if (!able.length) reasons.push({ code: 'armorWall', level: 'danger', vars: { enemy: name, armor: e.armor } });
    else if (able.length < players.length) reasons.push({ code: 'armorFew', level: 'warn', vars: { enemy: name, armor: e.armor, who: able } });
    const top = Math.max(0, ...e.attacks.map((a) => a.max));
    const dmg = (p) => e.actions * Math.max(0, top - p.armor);
    const atRisk = players.filter((p) => p.hp > 0 && dmg(p) >= p.hp);
    if (atRisk.length) reasons.push({ code: 'spike', level: 'danger', vars: { enemy: name, who: atRisk.map((p) => p.name), dmg: Math.max(...atRisk.map(dmg)) } });
  }
  if (players.some((p) => p.classId === 'hacker')) {
    const targets = enemies.filter((e) => e.tag !== 'organic').length;
    reasons.push({ code: targets ? 'hackTargets' : 'hackNone', level: targets ? 'info' : 'warn', vars: { n: targets, of: enemies.length } });
  }
  if (tnPenalty) reasons.push({ code: 'difficulty', level: 'info', vars: { n: tnPenalty } });
  return { band, ratio, roundsToWin, roundsToLose, partyActions, enemyActions, reasons };
}
