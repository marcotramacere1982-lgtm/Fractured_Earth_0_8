// Sheet actions for the streak-breaker (decision 363). Merged into `actions` (./actions.js); same signature.
// Every check and attack is recorded (rules/luck.js → afterRoll): three failures in a row turn the luck — Edge on the
// next roll, told to the player in the open; the GM's Fortune (a durable `fortune` card) gives Edge too. Logged in English.

import { afterRoll, freshLuck, missionLuck } from '../../rules/luck.js';
import { log } from './actions.js';

export const luckActions = {
  /** A roll was made. result: { success, tense, edgeUsed }. */
  luckRoll(c, data, { success, tense = false, edgeUsed = false }) {
    if (!data.luck) return null;
    const l = afterRoll(c.play.luck ?? freshLuck(), { success: Boolean(success), tense, edgeUsed }, data.luck);
    const { turned, ...keep } = l;
    c.play.luck = keep;
    if (turned) log(c, `Your luck turns — Edge on your next roll (${data.luck.streak} misses in a row)`, 'ok');
    return l;
  },
  /** The GM's Fortune: Edge on the next roll. @returns true when new. */
  receiveFortune(c, data, { msg }) {
    if (!data.luck || !msg?.id) return false;
    c.play.fortuneSeen ??= [];
    if (c.play.fortuneSeen.includes(msg.id)) return false;
    c.play.fortuneSeen = [...c.play.fortuneSeen, msg.id].slice(-20);
    c.play.luck = { ...freshLuck(), ...(c.play.luck ?? {}), edge: 'fortune' };
    log(c, 'Fortune smiles — Edge on your next roll', 'ok');
    return true;
  },
  /** A new mission (the GM's New scene carries it): the tally starts again. */
  luckMission(c, data, { mission }) {
    if (!data.luck || !mission) return;
    c.play.luck = missionLuck(c.play.luck, String(mission).slice(0, 40));
  },
};
