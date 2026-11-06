// Air (decision 273). Holding your breath — under water, in smoke, in gas: you last CON rounds (half, rounded down,
// when it caught you by surprise; at least 1). Then a CON roll each round, −1 more every round; a failure and you're
// out (Incapacitated). Out with no air: 1d6 a round, armor never helps. Air back: you come round. A round passes at the
// start of each of your turns in a fight, or when the table says so out of one. Numbers in data.body.breath. Pure.

/** How many rounds you can hold it. */
export const breathMax = (con, surprised, d) => Math.max(1, surprised ? Math.floor((con ?? 0) / 2) : (con ?? 0));

/** A fresh hold. */
export const startBreath = (con, surprised, d) => {
  const max = breathMax(con, surprised, d);
  return { left: max, max, over: 0, out: false, ask: null, surprised: Boolean(surprised) };
};

/**
 * A round passes. @returns { b (the new state), event: 'count' (one fewer left) | 'check' (a CON roll at `penalty`) | 'drown' (the drowning dice) }
 * A pending roll that wasn't answered stays: the round doesn't stack a second one.
 */
export function tickBreath(b, d) {
  if (!b) return { b, event: null };
  if (b.ask) return { b, event: b.ask.kind };
  if (b.out) return { b: { ...b, ask: { kind: 'drown', dice: d.drown } }, event: 'drown' };
  if (b.left > 0) return { b: { ...b, left: b.left - 1 }, event: 'count' };
  const over = b.over + 1;
  return { b: { ...b, over, ask: { kind: 'check', penalty: -over * d.step } }, event: 'check' };
}

/** The CON roll's answer: held on, or out (Incapacitated). */
export const answerCheck = (b, success) => ({ ...b, ask: null, out: !success });
/** The drowning dice were taken. */
export const answerDrown = (b) => ({ ...b, ask: null });
