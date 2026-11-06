// Chases on foot (decision 275). An abstract track — the gap, 0 (caught) to max (lost them) — run in legs. Each leg
// every crew member makes one move (one roll: its own effect, and it counts towards keeping pace); the pursuers make
// one (the GM rolls once). The crew keeps pace as a group check (half must succeed). Numbers in data.chase. Pure.

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

/** The pursuers' chase TN this leg: their own, +fast, + this leg's modifier (a crew's Cover fire / Hack last leg). */
export const pursuerTn = (p, mod, d) => (Number(p?.tn) || 0) + (p?.fast ? d.fast : 0) + (mod ?? 0);

/**
 * One leg. crew: [{ id, move, success }] (only those still running); pursuers: { move: 'chase' | 'shoot', success, margin };
 * gap: before; drone: still overhead. @returns { successes, total, need, crewOk, allOk, delta, gap, bites (ids hit by the
 * complication), hidden, ending ('caught' | 'lost' | null), next: { crewBonus, pursuerMod, drone } }
 */
export function resolveLeg({ crew, pursuers, gap, drone }, d) {
  const total = crew.length;
  const successes = crew.filter((x) => x.success).length;
  const need = Math.ceil(total / 2);
  const crewOk = total > 0 && successes >= need;
  const allOk = total > 0 && successes === total;
  const running = pursuers.move !== 'shoot'; // pursuers who stop to fire don't close the gap
  const theyOk = running && Boolean(pursuers.success);
  let delta = 0;
  if (crewOk && !theyOk) delta = allOk ? 2 : 1;
  else if (!crewOk && theyOk) delta = (pursuers.margin ?? 0) >= d.bigMargin ? -2 : -1;
  const bites = !crewOk && !theyOk ? crew.filter((x) => !x.success).map((x) => x.id) : [];
  const hidden = total > 0 && crew.every((x) => x.move === 'hide') && crewOk && gap >= d.gap.hideFrom && !drone;
  const after = clamp(gap + delta, 0, d.gap.max);
  const ok = (m) => crew.some((x) => x.move === m && x.success);
  const next = {
    crewBonus: ok('lead') ? d.lead : 0,
    pursuerMod: ok('cover') || (ok('hack') && !drone) ? d.spoil : 0,
    drone: drone && !ok('hack'), // a successful Hack takes out the drone first
  };
  return { successes, total, need, crewOk, allOk, delta, gap: after, bites, hidden, ending: hidden || after >= d.gap.max ? 'lost' : after <= 0 ? 'caught' : null, next };
}

/** Fatigue: from this leg on, every failure costs Strain and a CON roll. */
export const tiring = (leg, d) => leg >= d.fatigue.fromLeg;

/** Consecutive failures per character after this leg. streak: { id: n }. */
export function streaks(streak, crew) {
  const out = { ...(streak ?? {}) };
  for (const x of crew) out[x.id] = x.success ? 0 : (out[x.id] ?? 0) + 1;
  return out;
}

/** The checks a move can use (data.chase.moves): 'skill:<id>' | 'attr:<id>' | 'weapon' | 'class:<classId>' | 'any'. */
export const moveChecks = (move, d) => d.moves.find((m) => m.id === move)?.checks ?? [];

const DICE = /^\d{1,2}d\d{1,3}([+-]\d{1,2})?$/;
/** A pursuer preset, cleaned (the console's window and the server's store). */
export const cleanPursuer = (p) => ({
  id: String(p?.id ?? ''),
  name: String(p?.name ?? '').trim().slice(0, 50) || 'Pursuers',
  count: Math.min(20, Math.max(1, Math.round(Number(p?.count) || 1))),
  tn: Math.min(20, Math.max(1, Math.round(Number(p?.tn) || 10))),
  fast: Boolean(p?.fast),
  drone: Boolean(p?.drone),
  shoot: p?.shoot && DICE.test(String(p.shoot.dice ?? '')) ? { tn: Math.min(20, Math.max(1, Math.round(Number(p.shoot.tn) || 10))), dice: String(p.shoot.dice) } : null,
  note: String(p?.note ?? '').slice(0, 200),
});
