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
    fallLand: ({ id }) => { // decision 272: the landing roll — halves the damage; a failure: Prone; a natural 20: a crippled leg
      const h = find(id);
      if (!h) return;
      const k = deriveSheet(character(), data).skills.find((x) => x.id === data.body.falling.skill);
      openCheck({ name: t('fall.landTitle'), tn: k.value, sub: k.name }, data, (r) => {
        const out = run('applyFall', { id, result: r });
        if (out) table?.hitResult(id, 'applied', `fell ${h.fall} m — landing ${r.success ? 'held: half damage' : 'failed: Prone'}${out.crippled ? ', a crippled leg' : ''} (${rollText(r)}) → −${out.taken} HP`);
      }, { tier: tier(), once: true });
    },
    harmRoll: ({ id }) => { // decision 274: the roll that travels with the harm — no action, the table's difficulty
      const h = find(id);
      if (!h?.harm) return;
      const [kind, cid] = (h.harm.check || ':').split(':');
      const s = deriveSheet(character(), data);
      const target = kind === 'attr' ? { name: cid, tn: s.attributes[cid], sub: cid } : (() => { const k = s.skills.find((x) => x.id === cid); return k ? { name: k.name, tn: k.value, sub: k.name } : null; })();
      if (!target) return;
      openCheck({ ...target, name: `${h.from} · ${t(h.harm.save === 'avoid' ? 'harm.avoid' : 'harm.halve')}` }, data, (r) => {
        const out = run('applyHarm', { id, result: r });
        if (out) table?.hitResult(id, 'applied', `${h.from}: ${out.saved || 'roll failed'} (${rollText(r)}) → −${out.taken} HP${out.condition ? `, ${out.condition}` : ''}`);
      }, { tier: tier(), once: true });
    },
    harmTake: ({ id }) => {
      const h = find(id);
      if (!h?.harm) return;
      const out = run('applyHarm', { id, result: null });
      if (out) table?.hitResult(id, 'applied', `${h.from}: took it → −${out.taken} HP${out.condition ? `, ${out.condition}` : ''}`);
    },
    fallTake: ({ id }) => {
      const h = find(id);
      if (!h) return;
      const out = run('applyFall', { id, result: null });
      if (out) table?.hitResult(id, 'applied', `fell ${h.fall} m — took it: Prone → −${out.taken} HP`);
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
