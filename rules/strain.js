// Strain (decision 266): the stress track beside HP. 0 … max; bands (Calm, Shaken, Fraying, Breaking) give a TN
// penalty on skill checks. A gain can be steadied with a Mental Strength roll (halved, rounded down); reaching the
// maximum is a breaking point — a d6 on the table (a Scar rolls a second d6) — after which Strain drops to afterBreak.
// Relief: a safe new scene, a crewmate's Steady, downtime. Pure: numbers and records from data.strain.

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

/** The band a Strain value sits in. */
export const bandOf = (value, d) => [...d.bands].reverse().find((b) => (value ?? 0) >= b.from) ?? d.bands[0];
/** The TN change on skill checks at this Strain (0, −1, −2). */
export const strainTn = (value, d) => bandOf(value, d).tn;

/** What a gain of n does. @returns { value, from, to (bands), worse (a band up), broke (reached the maximum now) } */
export function addStrain(value, n, d) {
  const before = value ?? 0;
  const next = clamp(before + n, 0, d.max);
  const from = bandOf(before, d);
  const to = bandOf(next, d);
  return { value: next, from, to, worse: d.bands.indexOf(to) > d.bands.indexOf(from), broke: next >= d.max && before < d.max };
}
/** A gain after a successful Mental Strength roll. */
export const steadied = (n) => Math.floor(n / 2);

/** The breaking point's result for a die, and a Scar for another. */
export const breakingResult = (roll, d) => d.breaking.results.find((r) => r.roll === roll) ?? d.breaking.results[0];
export const scarFor = (roll, d) => d.scars.list.find((r) => r.roll === roll) ?? d.scars.list[0];

/** What downtime clears: by its length, plus a better home (housing tier from `homeFrom` up, +1 each). */
export const downtimeRelief = (durationId, housingTier, d) => (d.downtime[durationId] ?? 0) + Math.max(0, (housingTier ?? 0) - d.downtime.homeFrom + 1);

/** A crewmate's Steady: how much, and whether the crew's state allows it now. */
export function steadyAmount(crewBand, inFight, d) {
  if (inFight && d.steady.noFightIn.includes(crewBand)) return 0;
  return crewBand === 'tight' ? d.steady.tight : d.steady.base;
}
