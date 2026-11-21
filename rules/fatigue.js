// Fatigue (decision 362): what a long night does to your body, beside Strain (the mind). 0 … max; bands (Fresh,
// Tired, Spent) give a TN penalty on physical checks and attacks, and Spent costs a square of move. Only the worse of
// Fatigue and Strain counts on a check. Pure: numbers from data.fatigue.

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

/** The band a Fatigue value sits in. */
export const fatigueBand = (value, d) => [...d.bands].reverse().find((b) => (value ?? 0) >= b.from) ?? d.bands[0];

/** What a change of n does. @returns { value, from, to (bands), worse } */
export function addFatigue(value, n, d) {
  const before = value ?? 0;
  const next = clamp(before + n, 0, d.max);
  const from = fatigueBand(before, d);
  const to = fatigueBand(next, d);
  return { value: next, from, to, worse: d.bands.indexOf(to) > d.bands.indexOf(from) };
}

/** Is a skill physical (its first attribute is STR, DEX or CON)? Those feel Fatigue. */
export const isPhysical = (skill, d) => d.physical.includes(skill?.stats?.[0]);

/** Only the worse of two TN penalties counts (both ≤ 0). */
export const worseTn = (a, b) => Math.min(a ?? 0, b ?? 0);

/** A fight's end: +1, and +1 more if it ran long or you dropped below half HP in it. */
export const fightGain = ({ rounds = 0, bloodied = false } = {}, d) => d.gains.fight + (rounds >= d.gains.longRounds || bloodied ? d.gains.longFight : 0);

/**
 * A breather (once per scene): −breather, unless a stim already took this one. @returns { n (what comes off), stim (the
 * stim was the reason nothing came off) }.
 */
export const breatherRelief = (play, d) => (play?.stimmed ? { n: 0, stim: true } : { n: d.breather, stim: false });
