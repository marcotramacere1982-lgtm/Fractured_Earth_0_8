// Skill / attribute checks: d20 roll-under against an effective TN.

import { roll } from './dice.js';

export function effectiveTN(tn, tier, difficultyData) {
  const penalty = difficultyData.tiers.find((t) => t.id === tier)?.penalty ?? 0;
  return tn - penalty;
}

/**
 * Resolves a check. A natural 1 / 20 never changes success by itself; it flags a narrative consequence.
 * @returns {{tn, effective, roll, success, margin, natural: 'crit-success'|'crit-failure'|null, nearMiss}}
 */
export function resolveCheck(tn, rollValue, tier, difficultyData) {
  const effective = effectiveTN(tn, tier, difficultyData);
  const success = rollValue <= effective;
  const margin = effective - rollValue;
  return {
    tn,
    effective,
    roll: rollValue,
    success,
    margin,
    natural: rollValue === 1 ? 'crit-success' : rollValue === 20 ? 'crit-failure' : null,
    nearMiss: !success && margin === -1, // "success with a cost"
    bigSuccess: success && margin >= 10,
  };
}

export function rollCheck(tn, tier, difficultyData, rng = Math.random) {
  const r = roll(difficultyData.die, rng);
  return { ...resolveCheck(tn, r.total, tier, difficultyData), dice: r };
}

export const passiveScore = (tn, difficultyData) => tn + difficultyData.passiveOffset;
