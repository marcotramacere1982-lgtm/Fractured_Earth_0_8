// Critical hits and fumbles on attacks (decision 265). Skill checks keep their narrative natural 1 / 20 (checks.js).
// A player's attack (d20 roll-under) is critical on a natural 1, or when it succeeds by the weapon's crit margin
// (data.encounter.crits.margin, a keen weapon's own `critMargin`, lowered by crit mods — never below minMargin): it
// ignores armor and cover (a location attack: that part's armor). A miss is a fumble on a natural 20 or a miss by
// fumbleMargin: a firearm rolls jamDie and jams over its reliability; melee and unarmed leave you Exposed; a thrown
// weapon is lost. Enemies crit and fumble on the natural roll only. Pure: data in, codes out.

import { isRanged } from './engines.js';

/** The margin a hit needs to be critical with this weapon. */
export const critMargin = (w, crits) => Math.max(crits.minMargin, (w?.critMargin ?? crits.margin) - (w?.critBonus ?? 0));

/** A player's attack: 'crit' | 'fumble' | null. r: a resolved check ({ success, roll, margin }). */
export function attackCrit(r, w, crits) {
  if (r.success) return r.roll === 1 || r.margin >= critMargin(w, crits) ? 'crit' : null;
  return r.roll === 20 || -r.margin >= crits.fumbleMargin ? 'fumble' : null;
}

/** An enemy's attack: natural rolls only. */
export const enemyCrit = (d20, hit) => (hit && d20 === 1 ? 'crit' : !hit && d20 === 20 ? 'fumble' : null);

/** The highest d20 that crits at this effective TN (at least 1: a natural 1 always does, when it hits). */
export const critUpTo = (effective, w, crits) => Math.max(1, Math.min(effective, effective - critMargin(w, crits)));
/** The lowest d20 that fumbles at this effective TN (20 at most: a natural 20 always does). */
export const fumbleFrom = (effective, crits) => Math.max(effective + 1, Math.min(20, effective + crits.fumbleMargin));

/** What a fumble does with this weapon: 'jam' (a firearm: jam check) · 'lost' (thrown) · 'exposed' (melee, unarmed, stun gun). */
export function fumbleKind(w) {
  if (w?.skill === 'thrown_objects') return 'lost';
  return isRanged(w) && w?.magSize ? 'jam' : 'exposed';
}
/** The jam check: over the weapon's reliability, it jams. */
export const jams = (w, roll) => roll > (w?.reliability ?? 10);
