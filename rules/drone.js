// Toy drones (decision 171): a palm-sized camera that flies for a few minutes. Out of a fight only; one flight, then
// the battery is flat until the player recharges it (between scenes). A flight is one Drones / Remote Craft roll:
// success — there and back; failure — noticed, or saw little, but it comes back; failure by enough — shot down, gone.
// What it sees is the GM's to tell. Pure.

import { RuleError } from './messages.js';

/** spec: the item's `drone` block (data/items.json). r: the roll { success, margin }. */
export function flightOutcome(r, spec) {
  if (r.success) return 'ok';
  return r.margin <= (spec?.lostMargin ?? -5) ? 'lost' : 'noticed';
}

/** May this character fly now? Throws a RuleError with the reason. */
export function checkFlight(c) {
  if (c.play.turn?.inCombat) throw new RuleError('droneCombat', {}, 'Not in a fight: you either act or fly the drone.');
  if (c.play.droneFlat) throw new RuleError('droneFlat', {}, 'The battery is flat: recharge it when the scene changes.');
}
