// Crew stashes (decision 145): the sheet's clicks. The table server keeps the stashes; the sheet asks it first and
// only changes the character when the server said yes (two players can't take the same last thing).
// Kept apart from the card (stashes-card.js): the Gear tab is imported by dialogs, which must not pull in the actions.

import { unitOf, cashToMove } from '../../rules/stash.js';
import { withUniques } from '../../rules/uniques.js';
import { itemName } from './inventory-actions.js';
import { openChoice } from './dialogs.js';
import { t } from '../../i18n/index.js';

/** ctx: { character(), data, run, table, toast } → click handlers for the sheet. */
export function crewStashHandlers({ character, data, run, table, toast }) {
  const list = () => (table?.state.joinedId === character()?.id ? table.state.stashes ?? [] : []);
  const blocked = () => {
    if (!character().play.turn?.inCombat) return false;
    toast(t('rule.stashCombat'), 'danger');
    return true;
  };
  const ask = async (op) => {
    const res = await table.stash(op);
    if (!res.ok) toast(t(`crewStash.why.${res.why}`), 'danger');
    return res.ok ? res : null;
  };
  async function crewPut(stash, kind, id) {
    const c = character();
    const row = c.play.inventory.find((x) => x.kind === kind && x.id === id);
    if (!row || blocked()) return;
    const res = await ask({ op: 'put', stash, unit: unitOf(row), label: itemName(row, withUniques(data, c)) });
    if (res) run('crewPut', { kind, id, stash: res.stash });
  }
  return {
    /** 📦 on an inventory row: straight into your own stash, or pick one when the crew has stashes. */
    stashPut: ({ kind, id }) => {
      const crew = list();
      if (!crew.length) { run('stashPut', { kind, id }); return; }
      const mine = character().play.stash?.name || t('stash.title');
      openChoice(t('stash.put'), [
        { value: '', label: `📦 ${mine}`, sub: t('stash.sub') },
        ...crew.map((s) => ({ value: s.id, label: `👥 ${s.name}`, sub: t('crewStash.sub'), why: s.locked ? t('crewStash.why.locked') : '' })),
      ], (v) => (v ? crewPut(v, kind, id) : run('stashPut', { kind, id })));
    },
    crewTake: async ({ stash, kind, id }) => {
      if (blocked()) return;
      const row = list().find((s) => s.id === stash)?.items.find((r) => r.kind === kind && r.id === id);
      const res = await ask({ op: 'take', stash, kind, id, label: row ? itemName(row, withUniques(data, character())) : '' });
      if (res) run('crewTake', { unit: res.unit, stash: res.stash });
    },
    crewCash: async ({ stash, dir }, e) => {
      if (blocked()) return;
      const typed = e.target.closest('.stash-cash')?.querySelector('input')?.value;
      const s = list().find((x) => x.id === stash);
      const n = cashToMove(typed, dir === 'take' ? s?.cash ?? 0 : character().play.cash);
      if (!n) return;
      const res = await ask({ op: dir === 'take' ? 'takeCash' : 'putCash', stash, amount: n });
      if (res) run('crewCash', { amount: n, dir, stash: res.stash });
    },
  };
}
