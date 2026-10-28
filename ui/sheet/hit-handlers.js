// Hits from the GM (decision 154): the sheet's clicks — Apply takes the hit (Take a hit's own maths), Dodge rolls
// Avoid first (next round's action) and, if it works, the hit is avoided. Either way the GM is told.
// Kept apart from the card (hits.js): the Play tab is imported by modules that must not pull in the dialogs.

import { deriveSheet } from '../../state/character.js';
import { openCheck } from './dialogs.js';
import { hitEffect } from './hits.js';
import { t } from '../../i18n/index.js';

/** ctx: { character(), data, run, table, toast, rollText(r), tier() } → click handlers. */
export function hitHandlers({ character, data, run, table, toast, rollText, tier }) {
  const find = (id) => (character().play.hits ?? []).find((h) => h.id === id);
  return {
    hitApply: ({ id }) => {
      const h = find(id);
      if (!h) return;
      const effect = hitEffect(deriveSheet(character(), data), data, h);
      run('applyHit', { id });
      table?.hitResult(id, 'applied', effect);
    },
    hitDodge: ({ id }) => {
      const h = find(id);
      if (!h) return;
      const avoid = deriveSheet(character(), data).skills.find((k) => k.id === 'avoid_reflexes');
      openCheck({ name: t('dodge.title'), tn: avoid.value, sub: `${avoid.name} · ${t('dodge.sub')}` }, data, (r) => {
        if (!run('dodge', { success: r.success, rollText: rollText(r) })) return; // no action left to borrow: the sheet said why
        if (r.success) { run('dodgedHit', { id }); table?.hitResult(id, 'dodged', rollText(r)); toast(t('hit.dodged'), 'success'); }
        else { table?.hitResult(id, 'dodge failed', rollText(r)); toast(t('hit.dodgeFailed'), 'danger'); }
      }, { tier: tier(), once: true });
    },
  };
}
