// The Tech Wizard's drone on the engine card (decision 172): which drone, what it gives now, the mods in its slots,
// and Wrecked / Repaired. It never takes a turn: the abilities that use it are below, as usual.
import { html, raw } from '../dom.js';
import { nameOf } from './parts.js';
import { info } from '../ref.js';
import { t } from '../../i18n/index.js';

export function dronePanel(c, s, data) {
  const owned = c.play.inventory.filter((x) => x.kind === 'drone');
  const ownedMods = c.play.inventory.filter((x) => x.kind === 'droneMod');
  const p = s.drone;
  const pick = html`<div class="engine-row"><span class="label">${t('twd.title')}${info('drone', t('twd.title'))}</span>
    <select class="select" data-action="droneSel" aria-label="${t('twd.title')}">
      <option value="">— ${t('twd.none')} —</option>
      ${owned.map((o) => html`<option value="${o.id}" ${c.play.drone === o.id ? raw('selected') : ''}>${nameOf(data.drones, o.id)}</option>`)}
    </select></div>`;
  if (!p) return html`${pick}<p class="notice notice--warn">${t(owned.length ? 'twd.pick' : 'twd.buy')}</p>`;
  const stat = (k, v) => html`<span class="chip-stat"><span class="label">${t(`twd.stat.${k}`)}</span><span class="chip-stat__v">${v}</span></span>`;
  const installed = c.play.droneMods ?? [];
  return html`${pick}
    <div class="cluster twd-stats ${p.wrecked ? 'is-wrecked' : ''}">
      ${stat('reach', p.reach)}${stat('hp', p.hp)}${stat('armor', p.armor)}${stat('damage', p.wrecked ? `${p.damage} ÷ 2` : p.damage)}${p.shield ? stat('shield', `+${p.shield}`) : ''}
    </div>
    <div class="cluster"><span class="label">${t('twd.mods', { used: p.used, slots: p.slots })}</span>
      ${ownedMods.length ? ownedMods.map((m) => {
        const on = installed.includes(m.id);
        return html`<button class="btn btn--sm" data-action="droneMod" data-id="${m.id}" aria-pressed="${on}">${on ? '✓ ' : ''}${nameOf(data.droneMods.mods, m.id)}</button>`;
      }) : html`<span class="muted st-small">${t('twd.noMods')}</span>`}</div>
    <div class="cluster"><button class="btn btn--sm ${p.wrecked ? 'btn--primary' : 'btn--ghost'}" data-action="droneWreck" aria-pressed="${p.wrecked}" title="${t('twd.wreckHint')}">${p.wrecked ? `🔧 ${t('twd.repair')}` : `💥 ${t('twd.wreck')}`}</button>
      ${p.wrecked ? html`<span class="text-danger st-small">${t('twd.wreckedNote')}</span>` : ''}</div>`;
}
