// Haggling (decision 346): one roll to move a price — a washer's offer, or the street for one trip (until the next
// scene). The player picks how hard to push (economy.haggle.steps: a % and a difficulty step) and how (an honest
// haggle, working the street, or a swindle: double the %, but a failure burns the deal). The other side's mood
// (easy / normal / tough, the GM's) moves the step by one. A failure changes nothing; a natural 20 makes the price
// worse by fumblePct (a swindle that fails burns the deal instead). Pure: returns numbers and codes.

const clampTier = (n, data) => {
  const ids = data.difficulty.tiers.map((t) => t.id);
  return Math.max(Math.min(...ids), Math.min(Math.max(...ids), n));
};

export const haggleSteps = (data) => data.economy.haggle.steps;
export const haggleApproaches = (data) => data.economy.haggle.approaches;
export const MOODS = ['easy', 'normal', 'tough'];

/** The difficulty step of a haggle: the step's own, moved by the other side's mood. */
export function haggleTier(stepId, mood, data) {
  const step = haggleSteps(data).find((s) => s.id === stepId) ?? haggleSteps(data)[0];
  return clampTier(step.tier + (data.economy.haggle.moods[mood] ?? 0), data);
}

/**
 * What the roll did. @returns { pct, burned, code } — pct: in the player's favour (+15 = 15% better, −10 = 10% worse);
 * code: 'won' | 'nothing' | 'fumble' | 'burned'.
 */
export function haggleOutcome({ step, approach, success, natural }, data) {
  const h = data.economy.haggle;
  const s = h.steps.find((x) => x.id === step) ?? h.steps[0];
  const a = h.approaches.find((x) => x.id === approach) ?? h.approaches[0];
  if (success) return { pct: s.pct * (a.double ? 2 : 1), burned: false, code: 'won' };
  if (a.burns) return { pct: 0, burned: true, code: 'burned' };
  if (natural === 'crit-failure') return { pct: -h.fumblePct, burned: false, code: 'fumble' };
  return { pct: 0, burned: false, code: 'nothing' };
}

/** A price you pay, after a haggle (rounded in the seller's favour). */
export const paying = (amount, pct = 0) => Math.ceil(amount * (1 - pct / 100));
/** A price you are paid, after a haggle (rounded in the buyer's favour). */
export const paid = (amount, pct = 0) => Math.floor(amount * (1 + pct / 100));

/** A haggle in a few characters: "10% better", "5% worse", "no change" — numbers only, the screen adds the words. */
export const haggleLabel = (pct) => (pct > 0 ? `−${pct}%` : pct < 0 ? `+${-pct}%` : '±0%');

/** The street's change for this trip as a discount fraction (with the Fixer's Number talent): 0.05 = 5% off. */
export const streetDiscount = (c, talentDiscount = 0) => talentDiscount + (c.play.haggle?.pct ?? 0) / 100;
