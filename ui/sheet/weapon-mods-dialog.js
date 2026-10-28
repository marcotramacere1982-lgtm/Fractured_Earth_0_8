// Weapon mods window (decision 173): what's on this weapon (✕ takes a mod off, back to your inventory) and the mods
// you carry that fit it (Install, or why not). Out of a fight, Soldiers and Tech Wizards only; the rules say why.
import { html } from '../dom.js';
import { openDialog } from './dialogs.js';
import { findGear } from '../../rules/economy.js';
import { weaponSlots, checkInstall, modFits } from '../../rules/weapon-mods.js';
import { withUniques } from '../../rules/uniques.js';
import { ruleText } from '../rule-text.js';
import { t } from '../../i18n/index.js';

/** ctx: { character() → the current character, data, run(name, args) } */
export function openWeaponMods(weaponId, { character, data, run }) {
  const draw = () => {
    const c = character();
    const d = withUniques(data, c);
    const w = findGear('weapon', weaponId, d);
    if (!w) return html`<div class="dialog__body"><p class="muted">${t('gear.unknown')}</p></div>`;
    const installed = w.mods ?? [];
    const slots = weaponSlots(w, data.weaponMods);
    const owned = c.play.inventory.filter((x) => x.kind === 'weaponMod').map((x) => findGear('weaponMod', x.id, data)).filter((m) => m && modFits(w, m, data.weaponMods));
    const why = (m) => { try { checkInstall(c, w, installed, m, data.weaponMods); return ''; } catch (err) { return ruleText(err); } };
    return html`
      <header class="card__head"><h2 class="card__title">${w.name}<small>${t('wmod.slots', { used: installed.length, slots })}</small></h2>
        <button class="btn btn--ghost btn--icon" data-action="close" aria-label="${t('common.close')}">✕</button></header>
      <div class="dialog__body stack">
        <span class="label">${t('wmod.installed')}</span>
        ${installed.length ? html`<div class="rows">${installed.map((id) => { const m = findGear('weaponMod', id, data); return html`<div class="row"><div class="row__main"><div class="row__title">${m?.name ?? id}</div><div class="row__meta">${m ? t(`wmod.adds.${data.weaponMods.types.find((x) => x.id === m.type)?.adds}`, { n: m.amount }) : ''}</div></div>
          <button class="btn btn--sm btn--ghost" data-action="wmodOff" data-id="${id}">✕ ${t('wmod.remove')}</button></div>`; })}</div>` : html`<p class="muted">${t('wmod.none')}</p>`}
        <span class="label">${t('wmod.carried')}</span>
        ${owned.length ? html`<div class="rows">${owned.map((m) => { const no = why(m); return html`<div class="row row--wrap"><div class="row__main"><div class="row__title">${m.name}</div><div class="row__meta">${t(`wmod.adds.${data.weaponMods.types.find((x) => x.id === m.type)?.adds}`, { n: m.amount })}${no ? html` · <span class="text-danger">${no}</span>` : ''}</div></div>
          <button class="btn btn--sm btn--primary" data-action="wmodOn" data-id="${m.id}" ${no ? 'disabled' : ''}>${t('wmod.install')}</button></div>`; })}</div>` : html`<p class="muted">${t('wmod.noneCarried')}</p>`}
        <p class="hint">${t('wmod.hint')}</p>
      </div>`;
  };
  // installing a mod on a stock weapon makes a modded copy with a new id: follow it
  let id = weaponId;
  const follow = (fn) => { const out = fn(); if (typeof out === 'string') id = out; weaponId = id; d.redraw(); };
  const d = openDialog(draw, {
    click: {
      wmodOn: ({ id: modId }) => follow(() => run('installMod', { weaponId: id, modId })),
      wmodOff: ({ id: modId }) => follow(() => run('removeMod', { weaponId: id, modId })),
    },
  });
}
