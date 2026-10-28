// The personal stash (decision 144): gear and cash left somewhere safe, out of reach until you go back for it.
// Every move is logged "Stash: …", which explains the inventory, cash and stash changes to the GM's audit.
// Crew stashes (decision 145) live on the table server: the crew* actions run once it has said yes, logged "Crew stash <name>: …".

import { emptyStash, unitOf, putUnit, takeUnit, cashToMove } from '../../rules/stash.js';
import { RuleError } from '../../rules/messages.js';
import { actions, log } from './actions.js';
import { itemName } from './inventory-actions.js';

const stashOf = (c) => (c.play.stash ??= emptyStash());

function notInCombat(c) {
  if (c.play.turn?.inCombat) throw new RuleError('stashCombat', {}, 'Your stash is out of reach during a fight.');
}

export const stashActions = {
  stashName(c, _d, { value }) {
    stashOf(c).name = String(value ?? '').trim().slice(0, 40);
  },
  /** One of an inventory row into the stash (a weapon leaves its slot, armor comes off). */
  stashPut(c, data, { kind, id }) {
    notInCombat(c);
    const row = c.play.inventory.find((x) => x.kind === kind && x.id === id);
    if (!row) throw new RuleError('noItem', {}, 'Not in your inventory any more.');
    const unit = unitOf(row);
    actions.qty(c, data, { kind, id, delta: -1 });
    putUnit(stashOf(c).items, unit);
    log(c, `Stash: put away ${itemName(row, data)}`);
  },
  stashTake(c, data, { kind, id }) {
    notInCombat(c);
    const unit = takeUnit(stashOf(c).items, kind, id);
    if (!unit) throw new RuleError('stashNoItem', {}, 'It is not in the stash any more.');
    putUnit(c.play.inventory, unit);
    log(c, `Stash: took ${itemName(unit, data)}`);
  },
  /** dir 'put': carried cash into the stash · 'take': stashed cash back into your pocket. @returns the amount moved. */
  stashCash(c, _d, { amount, dir }) {
    notInCombat(c);
    const s = stashOf(c);
    const n = cashToMove(amount, dir === 'take' ? s.cash : c.play.cash);
    if (!n) return 0;
    if (dir === 'take') { s.cash -= n; c.play.cash += n; log(c, `Stash: took $${n}`); }
    else { c.play.cash -= n; s.cash += n; log(c, `Stash: put away $${n}`); }
    return n;
  },
  crewPut(c, data, { kind, id, stash }) {
    const row = c.play.inventory.find((x) => x.kind === kind && x.id === id);
    if (!row) return;
    actions.qty(c, data, { kind, id, delta: -1 });
    log(c, `Crew stash ${stash}: put away ${itemName(row, data)}`);
  },
  crewTake(c, data, { unit, stash }) {
    if (!unit?.kind) return;
    putUnit(c.play.inventory, unit);
    log(c, `Crew stash ${stash}: took ${itemName(unit, data)}`);
  },
  crewCash(c, _d, { amount, dir, stash }) {
    const n = Math.max(0, Math.floor(Number(amount) || 0));
    c.play.cash = Math.max(0, c.play.cash + (dir === 'take' ? n : -n));
    log(c, `Crew stash ${stash}: ${dir === 'take' ? 'took' : 'put away'} $${n}`);
  },
};
