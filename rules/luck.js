// The streak-breaker (decision 363). A run of bad luck is broken in the open, by the rules: after `streak` failures in
// a row, the next roll has Edge — two d20, keep the better (roll-under: the lower). The GM's Fortune gives Edge too.
// Tense rolls neither use Edge nor count. The tally is per mission. Pure: numbers from data.luck.

export const freshLuck = (mission = null) => ({ fails: 0, edge: null, s: 0, f: 0, mission });

/** Edge on a roll: two values, the better (lower) kept. */
export const edgePick = (a, b) => Math.min(a, b);

/**
 * After a roll. result: { success, tense, edgeUsed }. @returns the new luck — `edge` is null, 'streak' or 'fortune';
 * `turned`: true when this roll just earned Edge.
 */
export function afterRoll(luck, { success, tense = false, edgeUsed = false }, d) {
  const l = { ...freshLuck(), ...(luck ?? {}) };
  if (tense) return { ...l, turned: false };
  const next = { ...l, edge: edgeUsed ? null : l.edge, s: l.s + (success ? 1 : 0), f: l.f + (success ? 0 : 1), fails: success || edgeUsed ? 0 : l.fails + 1 };
  const turned = !next.edge && next.fails >= d.streak;
  if (turned) { next.edge = 'streak'; next.fails = 0; }
  return { ...next, turned };
}

/** A new mission (the GM's New scene carries it): the tally starts again; Edge already earned stays. */
export const missionLuck = (luck, mission) => (luck?.mission === mission ? luck : { ...freshLuck(mission), edge: luck?.edge ?? null });
