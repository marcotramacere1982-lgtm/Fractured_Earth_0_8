// How long a condition lasts (decision 236). Every condition has a default (data: conditions[].lasts); an ability may
// set its own (play …lasts: { blinded: 'nextRound' }). The bearer keeps a stamp per condition — times[id] =
// { lasts, round, fresh } — and these functions say what wears off at a turn end, a round end, a hit, a fight end.
// A condition put on some other way (by hand, a sheet's own action) is stamped the first time a turn or round boundary
// sees it; the GM can always take one off early, or put it back on to keep it longer.
//   turn      — ends at the end of the bearer's next turn (fresh: put on during its own turn, so not this one)
//   round     — ends at the end of this round
//   nextRound — ends at the end of the next round (put on in round R: gone when round R + 1 ends)
//   used      — ends when the next hit lands (Exposed)
//   roundsN   — N rounds, counting the one it was put on in (rounds3: put on in round 1, gone at the end of round 3)
//   fight     — ends with the fight
//   scene / treated — never by itself (the GM, a treatment, a new scene)

export const LASTS = ['turn', 'round', 'nextRound', 'used', 'fight', 'scene', 'treated'];
export const isLasts = (v) => LASTS.includes(v) || /^rounds[1-9]$/.test(v ?? '');
const roundsOf = (lasts) => Number(/^rounds([1-9])$/.exec(lasts ?? '')?.[1] ?? 0);

/** The length for a condition: the ability's, else the condition's, else "treated" (never by itself). */
export const lastsOf = (id, data, override = null) => (isLasts(override) ? override : data.conditions.find((c) => c.id === id)?.lasts ?? 'treated');

/** Stamps conditions just put on. ids: the new ones; round: the fight's round (0 out of a fight); own: during the bearer's own turn. */
export function stamp(times, ids, { round = 0, own = false, lasts = {} } = {}, data) {
  const next = { ...(times ?? {}) };
  for (const id of ids) next[id] = { lasts: lastsOf(id, data, lasts?.[id]), round, fresh: Boolean(own) };
  return next;
}

/** Conditions without a stamp yet get one now (seen for the first time at this moment) — the sheet's many ways in. */
export function stampNew(conditions, times, { round = 0, own = false } = {}, data) {
  const fresh = (conditions ?? []).filter((id) => !times?.[id]);
  return fresh.length ? stamp(times, fresh, { round, own }, data) : (times ?? {});
}

function drop(conditions, times, gone) {
  if (!gone.length) return { conditions, times: times ?? {}, gone };
  const next = { ...(times ?? {}) };
  for (const id of gone) delete next[id];
  return { conditions: conditions.filter((id) => !gone.includes(id)), times: next, gone };
}

/** The end of the bearer's turn: "turn" conditions go — unless put on during this very turn (they wait for the next). */
export function atTurnEnd(conditions, times) {
  const gone = conditions.filter((id) => times?.[id]?.lasts === 'turn' && !times[id].fresh);
  const out = drop(conditions, times, gone);
  for (const id of out.conditions) if (out.times[id]?.lasts === 'turn' && out.times[id].fresh) out.times[id] = { ...out.times[id], fresh: false };
  return out;
}

/** The end of round `round`: "round" conditions go, and "nextRound" ones put on before this round. */
export function atRoundEnd(conditions, times, round) {
  return drop(conditions, times, conditions.filter((id) => {
    const t = times?.[id];
    return t && (t.lasts === 'round' || (t.lasts === 'nextRound' && round > t.round) || (roundsOf(t.lasts) && round - t.round + 1 >= roundsOf(t.lasts)));
  }));
}

/** A hit landed: "used" conditions go (Exposed: the next hit ignores 2 armor). */
export const atHit = (conditions, times) => drop(conditions, times, conditions.filter((id) => times?.[id]?.lasts === 'used'));

/** The fight is over: everything that lasts a turn, a round or the fight goes. */
export const atFightEnd = (conditions, times) => drop(conditions, times, conditions.filter((id) => ['turn', 'round', 'nextRound', 'used', 'fight'].includes(times?.[id]?.lasts) || roundsOf(times?.[id]?.lasts)));

/** Out of the stamps, what's left of the timers (for removed conditions). */
export const prune = (conditions, times) => Object.fromEntries(Object.entries(times ?? {}).filter(([id]) => conditions.includes(id)));
