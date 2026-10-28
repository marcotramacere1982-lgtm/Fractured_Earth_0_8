// Gear tab: cash, inventory (qty, wear armor), lifestyle; the shop is a dialog (see dialogs.js).

import { html, raw } from '../dom.js';
import { card, counter, nameOf } from './parts.js';
import { CATALOGS, findGear, magazines } from '../../rules/economy.js';
import { weaponSlots } from '../../rules/weapon-mods.js';
import { bonusText } from '../../rules/uniques.js';
import { t } from '../../i18n/index.js';
import { dealQuote } from '../../rules/washer.js';
import { stashesCard } from './stashes-card.js';

/** Translated name of a gear category. */
export const kindLabel = (kind) => t(`gear.kind.${kind}`);

function describe(kind, e, data) {
  const mods = e.mods?.length ? `🔧 ${e.mods.map((id) => findGear('weaponMod', id, data)?.name ?? id).join(', ')}` : ''; // decision 173
  if (e.unique) return [baseDescribe(kind, e, data), bonusText(e, data), e.note ? `◆ ${e.note}` : '', mods].filter(Boolean).join(' · ');
  return [baseDescribe(kind, e, data), mods].filter(Boolean).join(' · ');
}

function baseDescribe(kind, e, data) {
  switch (kind) {
    case 'weapon': return `${e.type} · ${e.damage} · ${e.range.min}–${e.range.max}m${e.magSize ? ` · ${t('gear.mag')} ${e.magSize}` : ''}`;
    case 'armor': return `${e.type} · ${t('stat.armor')} +${e.maxHits} · ${t('gear.visibility')} ${e.visibility}/5`;
    case 'item': return e.story ? `${t('gear.storyOnly')} · ${e.effect}` : e.effect; // story items: no dice effect, the GM rules on them (decision 77)
    case 'deck': return `RAM ${e.ram} · heat cap ${e.heatCap} · ${e.modSlots} mod slot · ${t('gear.battery')} ${e.battery.idle} idle / ${e.battery.usage} use`;
    case 'deckMod': return `+${e.amount} ${e.type === 'ram' ? 'RAM' : 'heat cap'}`;
    case 'drone': return `${t('twd.stat.reach')} ${e.reach} · HP ${e.hp} · ${t('twd.stat.armor')} ${e.armor} · ${t('twd.stat.damage')} ${e.damage} · ${e.modSlots} mod slot`; // decision 172
    case 'weaponMod': { const ty = data.weaponMods.types.find((x) => x.id === e.type); return `${t(`wmod.for.${ty?.for}`)} · ${t(`wmod.adds.${ty?.adds}`, { n: e.amount })}`; } // decision 173
    case 'droneMod': return `+${e.amount} ${t(`twd.stat.${{ reach: 'reach', frame: 'hp', plating: 'armor', payload: 'damage', shield: 'shield' }[e.type]}`)}`;
    case 'ammo': return `${e.ammo} · ${t('gear.rounds', { n: e.magSize })}`;
    case 'custom': return e.note || t('gear.customNote');
    case 'optic': return `${t('gear.opticStats', { range: e.range, track: e.track })}${e.mode ? ` · ${nameOf(data.classes.classes.find((k) => k.id === 'scavenger').resources.modes, e.mode)}` : ''} · ${t('gear.visibility')} ${e.visibility}/5 · Scavenger`;
    default: return e.desc ?? '';
  }
}

/** Decision 143: a fixer's offers — pick how many points, see the sum, take it or walk away. */
function offersCard(c, data) {
  const offers = c.play.offers ?? [];
  if (!offers.length) return '';
  const cap = data.attributes.creation.crs.max;
  return card(t('washer.title'), html`<div class="stack">${offers.map((o) => {
    const q = dealQuote(o, o.points ?? 1, { cash: c.play.cash, crs: c.attributes.CRS }, cap);
    return html`<div class="washer">
      <p><strong>${t(o.direction === 'wash' ? 'washer.wash' : 'washer.cashout')}</strong> · ${t('washer.terms', { rate: o.rate, commission: o.commission, max: o.max })}</p>
      ${o.note ? html`<p class="muted st-small">“${o.note}”</p>` : ''}
      <div class="cluster">
        <label class="field field--inline"><span class="label">${t('washer.points')}</span>
          <input class="input input--num" type="number" min="1" max="${o.max}" step="1" value="${o.points ?? 1}" data-action="dealPoints" data-id="${o.id}" inputmode="numeric"></label>
        <span class="mono">${t(o.direction === 'wash' ? 'washer.sumWash' : 'washer.sumCashout', { n: q.points, base: q.base, fee: q.fee, total: Math.abs(q.cash) })}</span>
      </div>
      ${q.ok ? '' : html`<p class="st-small text-danger">${t(`washer.why.${q.why}`, { cap })}</p>`}
      <div class="cluster"><button class="btn btn--sm btn--primary" data-action="acceptDeal" data-id="${o.id}" ${q.ok ? '' : 'disabled'}>${t('washer.accept')}</button>
        <button class="btn btn--sm btn--ghost" data-action="declineDeal" data-id="${o.id}">${t('washer.decline')}</button></div>
    </div>`;
  })}</div>`, { ref: 'washer' });
}

export function gearTab(c, s, data, ctx = {}) {
  const kinds = ['weapon', 'weaponMod', 'ammo', 'armor', 'item', 'deck', 'deckMod', 'drone', 'droneMod', 'optic', 'custom'];
  const money = card(t('gear.money'), html`
    <div class="cluster cluster--gap">
      <label class="field"><span class="label">${t('gear.cash')}</span>
        <input class="input input--num" type="number" min="0" step="1" value="${c.play.cash}" data-action="cash" inputmode="numeric"></label>
      <div class="stat"><span class="label">Credit Score</span><span class="stat__value">${c.attributes.CRS}</span><span class="stat__sub">${t('gear.crsSub')}</span></div>
      <button class="btn btn--primary" data-action="shop" data-kind="weapon">${t('gear.openMarket')}</button>
    </div>
    <p class="hint">${t('gear.marketHint')}</p>`, { ref: 'market', tour: 'market' });

  const inventory = kinds.map((kind) => {
    const rows = c.play.inventory.filter((x) => x.kind === kind);
    if (!rows.length) return '';
    return html`
      <div class="inv-group">
        <h3 class="label">${kindLabel(kind)}</h3>
        <div class="rows">
          ${rows.map((r) => {
            const e = kind === 'custom' ? r : findGear(kind, r.id, data);
            if (!e) return html`<div class="row"><span class="row__main muted">${t('gear.unknown')}: ${r.id}</span></div>`;
            const worn = kind === 'armor' && c.play.worn.includes(r.id);
            return html`<div class="row row--wrap ${r.unique ? 'row--unique' : ''}">
              <div class="row__main"><div class="row__title">${e.name}${r.unique?.moddedFrom ? html` <span class="pill pill--info">${t('wmod.modded')}</span>` : r.unique ? html` <span class="pill pill--unique">${t('gear.unique')}</span>` : e.rarity ? html` <span class="pill">${e.rarity}</span>` : ''}${r.official ? html` <span class="pill pill--info" title="${t('gear.registeredHint')}">${t('gear.registered', { n: r.official })}</span>` : ''}</div><div class="row__meta">${describe(kind, e, data)}</div></div>
              ${kind === 'item' && e.story ? html`<button class="btn btn--sm" data-action="storyUse" data-id="${r.id}" title="${t('use.storyHint')}">${t('use.use')}</button>` : ''}
              ${kind === 'item' && e.drone ? (c.play.droneFlat
                ? html`<button class="btn btn--sm" data-action="droneCharge" title="${t('drone.rechargeHint')}">🔋 ${t('drone.recharge')}</button>`
                : html`<button class="btn btn--sm btn--primary" data-action="droneFly" data-id="${r.id}" ${c.play.turn?.inCombat ? 'disabled' : ''} title="${t(c.play.turn?.inCombat ? 'rule.droneCombat' : 'drone.flyHint')}">🛩 ${t('drone.fly')}</button>`) : ''}
              ${kind === 'item' && e.use ? html`<button class="btn btn--sm" data-action="useItem" data-id="${r.id}" title="${e.use.options.map((o) => o.text).join(' · ')}">${t('use.use')}</button>` : ''}
              ${kind === 'weapon' && weaponSlots(e, data.weaponMods) ? html`<button class="btn btn--sm" data-action="weaponMods" data-id="${r.id}" title="${t('wmod.title')}">🔧 ${(e.mods ?? []).length}/${weaponSlots(e, data.weaponMods)}</button>` : ''}
              ${kind === 'armor' ? html`<button class="btn btn--sm" data-action="wear" data-id="${r.id}" aria-pressed="${worn}">${worn ? `✓ ${t('gear.worn')}` : t('gear.wear')}</button>` : ''}
              ${counter({ action: 'qty', value: r.qty, min: 0, args: { kind, id: r.id }, size: 'sm', label: `${e.name} · ${t('gear.qty')}` })}
              <span class="cluster inv-acts">
                <button class="btn btn--sm btn--ghost btn--icon" data-action="stashPut" data-kind="${kind}" data-id="${r.id}" title="${t('stash.put')}" aria-label="${t('stash.put')}: ${e.name}">📦</button>
                <button class="btn btn--sm btn--ghost btn--icon" data-action="trade" data-kind="${kind}" data-id="${r.id}" title="${t('trade.title')}" aria-label="${t('trade.title')}: ${e.name}">⇄</button>
                <button class="btn btn--sm btn--ghost btn--icon text-danger" data-action="trash" data-kind="${kind}" data-id="${r.id}" title="${t('trade.trash')}" aria-label="${t('trade.trash')}: ${e.name}">🗑</button>
              </span>
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
      <div class="row"><div class="row__main"><div class="row__title">${e.name}${e.tier ? html` <span class="pill">${t('gear.tier')} ${e.tier}</span>` : ''}</div><div class="row__meta">${nameOf(data.lifestyle.categories, e.category)} · $${e.cost.cr}/${t('gear.month')}</div></div>
      <button class="btn btn--sm btn--ghost" data-action="dropLifestyle" data-id="${e.id}" aria-label="${t('common.remove')}: ${e.name}">✕</button></div>`)}</div>
      <p class="mono">${t('gear.upkeep', { cr: s.lifestyle.cr, crs: s.lifestyle.crs })}</p>`
    : html`<p class="muted">${t('gear.noLifestyle')}</p>`}`, {
    actions: html`<button class="btn btn--sm" data-action="shop" data-kind="lifestyle">${t('common.add')}</button>`,
    sub: t('gear.lifestyleSub'),
    ref: 'lifestyle',
  });

  return html`<div class="stack">${offersCard(c, data)}${money}<div class="gear-cols"><div class="stack">${gear}</div><div class="stack">${stashesCard(c, data, ctx.stashes)}${lifestyle}</div></div></div>`;
}

export const catalog = (kind, data) => {
  if (kind === 'ammo') return magazines(data);
  const tbl = data[CATALOGS[kind]];
  return (Array.isArray(tbl) ? tbl : tbl.mods ?? tbl.entries).filter((e) => !e.unique && !e.modded && !e.natural); // uniques are never for sale; fists aren't an item (decision 147)
};
export { describe };
