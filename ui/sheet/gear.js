// Gear tab: cash, inventory (qty, wear armor), lifestyle; the shop is a dialog (see dialogs.js).

import { html, raw } from '../dom.js';
import { card, counter, nameOf } from './parts.js';
import { CATALOGS, findGear } from '../../rules/economy.js';
import { t } from '../../i18n/index.js';

/** Translated name of a gear category. */
export const kindLabel = (kind) => t(`gear.kind.${kind}`);

function describe(kind, e, data) {
  switch (kind) {
    case 'weapon': return `${e.type} · ${e.damage} · ${e.range.min}–${e.range.max}m${e.magSize ? ` · ${t('gear.mag')} ${e.magSize}` : ''}`;
    case 'armor': return `${e.type} · ${t('stat.armor')} +${e.maxHits} · ${t('gear.visibility')} ${e.visibility}/5`;
    case 'item': return `${e.effectType} · ${e.effect}`;
    case 'deck': return `RAM ${e.ram} · heat cap ${e.heatCap} · ${e.modSlots} mod slot · ${t('gear.battery')} ${e.battery.idle} idle / ${e.battery.usage} use`;
    case 'deckMod': return `+${e.amount} ${e.type === 'ram' ? 'RAM' : 'heat cap'}`;
    case 'optic': return `${t('gear.opticStats', { range: e.range, track: e.track })}${e.mode ? ` · ${nameOf(data.classes.classes.find((k) => k.id === 'scavenger').resources.modes, e.mode)}` : ''} · ${t('gear.visibility')} ${e.visibility}/5 · Scavenger`;
    default: return e.desc ?? '';
  }
}

export function gearTab(c, s, data) {
  const kinds = ['weapon', 'armor', 'item', 'deck', 'deckMod', 'optic'];
  const money = card(t('gear.money'), html`
    <div class="cluster cluster--gap">
      <label class="field"><span class="label">${t('gear.cash')}</span>
        <input class="input input--num" type="number" min="0" step="1" value="${c.play.cash}" data-action="cash" inputmode="numeric"></label>
      <div class="stat"><span class="label">Credit Score</span><span class="stat__value">${c.attributes.CRS}</span><span class="stat__sub">${t('gear.crsSub')}</span></div>
      <button class="btn btn--primary" data-action="shop" data-kind="weapon">${t('gear.openMarket')}</button>
    </div>
    <p class="hint">${t('gear.marketHint')}</p>`, { ref: 'market' });

  const inventory = kinds.map((kind) => {
    const rows = c.play.inventory.filter((x) => x.kind === kind);
    if (!rows.length) return '';
    return html`
      <div class="inv-group">
        <h3 class="label">${kindLabel(kind)}</h3>
        <div class="rows">
          ${rows.map((r) => {
            const e = findGear(kind, r.id, data);
            if (!e) return html`<div class="row"><span class="row__main muted">${t('gear.unknown')}: ${r.id}</span></div>`;
            const worn = kind === 'armor' && c.play.worn.includes(r.id);
            return html`<div class="row">
              <div class="row__main"><div class="row__title">${e.name} <span class="pill">${e.rarity ?? ''}</span></div><div class="row__meta">${describe(kind, e, data)}</div></div>
              ${kind === 'armor' ? html`<button class="btn btn--sm" data-action="wear" data-id="${r.id}" aria-pressed="${worn}">${worn ? `✓ ${t('gear.worn')}` : t('gear.wear')}</button>` : ''}
              ${counter({ action: 'qty', value: r.qty, min: 0, args: { kind, id: r.id }, size: 'sm', label: `${e.name} · ${t('gear.qty')}` })}
            </div>`;
          })}
        </div>
      </div>`;
  });
  const anyGear = c.play.inventory.length > 0;
  const gear = card(t('gear.inventory'), anyGear ? html`<div class="stack">${inventory}</div>` : html`<p class="muted">${t('gear.nothing')}</p>`, {
    actions: html`<button class="btn btn--sm" data-action="shop" data-kind="item" data-free="1">${t('gear.addFree')}</button>`,
  });

  const lifestyle = card(t('gear.kind.lifestyle'), html`
    ${s.lifestyle.entries.length ? html`<div class="rows">${s.lifestyle.entries.map((e) => html`
      <div class="row"><div class="row__main"><div class="row__title">${e.name}${e.tier ? html` <span class="pill">${t('gear.tier')} ${e.tier}</span>` : ''}</div><div class="row__meta">${nameOf(data.lifestyle.categories, e.category)} · ${e.cost.cr} Cr/${t('gear.month')}</div></div>
      <button class="btn btn--sm btn--ghost" data-action="dropLifestyle" data-id="${e.id}" aria-label="${t('common.remove')}: ${e.name}">✕</button></div>`)}</div>
      <p class="mono">${t('gear.upkeep', { cr: s.lifestyle.cr, crs: s.lifestyle.crs })}</p>`
    : html`<p class="muted">${t('gear.noLifestyle')}</p>`}`, {
    actions: html`<button class="btn btn--sm" data-action="shop" data-kind="lifestyle">${t('common.add')}</button>`,
    sub: t('gear.lifestyleSub'),
    ref: 'lifestyle',
  });

  return html`<div class="stack">${money}<div class="sheet-grid">${gear}${lifestyle}</div></div>`;
}

export const catalog = (kind, data) => {
  const tbl = data[CATALOGS[kind]];
  return Array.isArray(tbl) ? tbl : tbl.mods ?? tbl.entries;
};
export { describe };
