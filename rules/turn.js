// Combat turn bookkeeping: rounds, action allowance, actions borrowed for proactive defense.
// turn = { inCombat, round, used, reserved }   (reserved = actions already spent from NEXT round)

import { RuleError } from './messages.js';
import { roll } from './dice.js';

// spent: what this round's actions were ({ kind, name? }), so the sheet can remind the player.
export const newTurn = () => ({ inCombat: false, round: 1, used: 0, reserved: 0, spent: [] });

/** Actions available this round: ACT, or 1 while Stunned (manual 7-6). */
export function allowance(act, conditions, actionsData) {
  if (conditions.includes('stunned')) return actionsData.stunnedActions;
  if (conditions.includes('slowed')) return Math.max(1, act - 1); // chest hit: the shock costs an action
  return act;
}

export function turnStatus(turn, act, conditions, actionsData) {
  const max = allowance(act, conditions, actionsData);
  return { ...turn, max, left: Math.max(0, max - turn.used) };
}

/** Spends one action this round. Throws when none are left. what: { kind, name? } — shown back to the player. */
export function spendAction(turn, max, what = { kind: 'other' }) {
  if (turn.used >= max) throw new RuleError('noActions', {}, 'No actions left this round.');
  return { ...turn, used: turn.used + 1, spent: [...(turn.spent ?? []), what] };
}

/** Proactive defense: borrow an action from next round. Max one round's worth can be borrowed. */
export function borrowAction(turn, max) {
  if (turn.reserved >= max) throw new RuleError('nextRoundFull', {}, 'Next round is already fully committed.');
  return { ...turn, reserved: turn.reserved + 1 };
}

export const startCombat = () => ({ inCombat: true, round: 1, used: 0, reserved: 0, spent: [] });
export const endCombat = (turn) => ({ ...turn, inCombat: false, used: 0, reserved: 0, spent: [] });

/** Round end: unspent actions are lost; borrowed actions are already spent next round. */
export function endRound(turn) {
  const borrowed = Array.from({ length: turn.reserved }, () => ({ kind: 'dodge', borrowed: true }));
  return { ...turn, round: turn.round + 1, used: turn.reserved, reserved: 0, spent: borrowed };
}

/** Pulls the dice expression out of a weapon damage string ("1d6 (Non-Lethal)" → "1d6"). */
export function damageDice(damage) {
  const m = String(damage).match(/(\d*d\d+(?:\s*[+-]\s*\d+)?)/i);
  return m ? m[1].replace(/\s+/g, '') : null;
}

/**
 * Damage roll for a hit: weapon dice + Offensive Bonus (minimum 0).
 * opts (abilities, stances): bonus = extra dice ("1d6"), twice = weapon dice rolled twice,
 * multiplier = Soldier stance (×0.5 / ×1 / ×1.5, rounded down, applied last); exploit = Scavenger Exploit dice ("2d4").
 */
export function rollDamage(weapon, off, rng = Math.random, { bonus = null, twice = false, multiplier = 1, flat = 0, exploit = null } = {}) {
  const expr = damageDice(weapon.damage);
  if (!expr) return null;
  const base = roll(expr, rng);
  return damageFrom({ base, second: twice ? roll(expr, rng) : null, extra: bonus ? roll(bonus, rng) : null, exploit: exploit ? roll(exploit, rng) : null }, off, { multiplier, flat });
}

/**
 * Damage from dice already rolled (by the app or typed from physical dice): base weapon dice, second roll,
 * bonus dice, Exploit dice (Scavenger, 1d4 per Tell), + OFF + flat (Hot) + named extras ({ n, label }: Enraged…),
 * × multiplier (rounded down, last).
 */
export function damageFrom({ base, second = null, extra = null, exploit = null }, off, { multiplier = 1, flat = 0, extras = [] } = {}) {
  const raw = base.total + (second?.total ?? 0) + (extra?.total ?? 0) + (exploit?.total ?? 0) + off + flat + extras.reduce((s, x) => s + x.n, 0);
  return { ...base, base, off, second, extra, exploit, flat, extras, multiplier, total: Math.max(0, Math.floor(raw * multiplier)) };
}
