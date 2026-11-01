// The Sheet tab (decision 215): the old Setup and Gear tabs in one column of folding sections — the character
// between fights (the Tactical view plays at the table). Every section starts folded and shows a one-line summary,
// so a closed page still reads like a sheet; an index on the left (a row on top when narrow, decision 216) opens and
// closes them. What is open is remembered per
// device (any opening counts: a tap, a chip, a guided tour).

import { html } from '../dom.js';
import { t } from '../../i18n/index.js';
import { info } from '../ref.js';
import { boonsCard } from './hits.js';
import { healthCard, weaponsCard } from './play.js';
import { turnCard } from './turn.js';
import { engineCard } from './engine.js';
import { talentsCard } from './progress.js';
import { skillsTab } from './skills.js';
import { gearCards } from './gear.js';
import { iconFor } from '../gear-icon.js';
import { findGear } from '../../rules/economy.js';

const KEY = 'fe.sheet.open';
const read = () => { try { return new Set(JSON.parse(localStorage.getItem(KEY)) ?? []); } catch { return new Set(); } };
const write = (set) => { try { localStorage.setItem(KEY, JSON.stringify([...set])); } catch { /* private mode: this visit only */ } };

export const SECTIONS = ['health', 'weapons', 'class', 'actions', 'skills', 'inventory', 'money'];
const SINGLE = ['health', 'weapons', 'actions']; // one card inside: its own title would repeat the section's
/** Opens or closes sections (a chip, Open all, a link to the old Gear tab). */
export function setOpen(ids, on = true) {
  const open = read();
  for (const id of ids) if (on) open.add(id); else open.delete(id);
  write(open);
}
export const isOpen = (id) => read().has(id);
/** A <details class="sheet-sec"> was opened or closed (by the player or a tour): remember it. */
export function onSectionToggle(el) {
  if (el?.dataset?.sec) setOpen([el.dataset.sec], el.open);
}

/** The summary lines: what a folded section still tells you. */
function summaries(c, s, data) {
  const condName = (id) => data.conditions.find((k) => k.id === id)?.name ?? id;
  const weapons = s.weapons.filter((w) => !w.empty);
  const best = [...s.skills].sort((a, b) => b.value - a.value).slice(0, 3);
  const items = c.play.inventory.reduce((n, r) => n + (r.qty ?? 1), 0);
  return {
    health: [`HP ${s.hp.current}/${s.hp.max}`, ...(c.play.conditions ?? []).map(condName), s.injured.locations.length ? t('sheet.sum.injuries', { n: s.injured.locations.length }) : '', t('sheet.sum.armor', { n: s.armor.general })],
    weapons: weapons.length ? weapons.map((w) => `${w.name}${w.inHand ? ` (${t('weapons.inHand')})` : ''}${w.magSize ? ` ${w.rounds}/${w.magSize}` : ''}`) : [t('weapons.none')],
    class: s.class ? [`${s.class.name} · ${s.class.subclass.name}`, t('sheet.sum.abilities', { n: c.play.abilities.length, max: s.abilityLimit })] : [t('sheet.sum.noClass')],
    actions: [t('sheet.sum.actions', { n: s.combat.act.value, move: s.move })],
    skills: best.map((k) => `${k.name} ${k.value}`),
    inventory: [t('sheet.sum.items', { n: items })],
    money: [`$${c.play.cash}`, `CRS ${c.attributes.CRS}`, ...s.lifestyle.entries.map((e) => e.name)],
  };
}

export function sheetTab(c, s, data, ctx = {}) {
  const open = read();
  const sum = summaries(c, s, data);
  const gear = gearCards(c, s, data, ctx);
  const bodies = {
    health: healthCard(c, s, data, { tips: ctx.actionTips }),
    weapons: weaponsCard(c, s, data),
    class: html`${engineCard(c, s, data, ctx.combat, { mapDark: ctx.mapDark ?? null })}${talentsCard(c, s, data)}`,
    actions: turnCard(c, s, data, ctx.combat, { tips: ctx.actionTips, atTable: ctx.atTable }),
    skills: skillsTab(c, s, data),
    inventory: html`${gear.inventory}${gear.stash}`,
    money: html`${gear.offers}${gear.money}${gear.lifestyle}`,
  };
  const refs = { health: 'conditions', weapons: 'weapon-tn', class: 'class-tn', money: 'market' };
  // decision 222: weapons and the inventory summarised as silhouettes (the name in each one's tooltip)
  const carried = c.play.inventory.map((r) => ({ r, e: r.kind === 'custom' ? r : findGear(r.kind, r.id, data) })).filter((x) => x.e);
  const pictures = {
    weapons: s.weapons.some((w) => !w.empty) ? html`${s.weapons.filter((w) => !w.empty).map((w) => html`<span class="gi-chip ${w.inHand ? 'is-hand' : ''}">${iconFor('weapon', w, data, '', w.name)}${w.name}${w.magSize ? html` <span class="mono">${w.rounds}/${w.magSize}</span>` : ''}</span>`)}` : '',
    // decision 224: money in strong figures, the lifestyle as icons (names in tooltips)
    money: html`<span class="gi-row"><span class="sum-value"><span class="label">${t('stat.cash')}</span> <strong class="mono">$${c.play.cash}</strong></span>
      <span class="sum-value"><span class="label">CRS</span> <strong class="mono">${c.attributes.CRS}</strong></span>
      ${s.lifestyle.entries.map((e) => html`<span class="gi-chip gi-chip--bare">${iconFor('lifestyle', e, data, '', e.name)}</span>`)}</span>`,
    inventory: carried.length ? html`<span class="gi-row">${carried.map(({ r, e }) => html`<span class="gi-chip gi-chip--bare">${iconFor(r.kind, e, data, '', `${e.name}${r.qty > 1 ? ` ×${r.qty}` : ''}`)}${r.qty > 1 ? html`<span class="gi-qty mono">${r.qty}</span>` : ''}</span>`)}</span>` : '',
  };
  return html`
    ${boonsCard(c, data)}
    <div class="sheet-layout">
    <nav class="sheet-index" aria-label="${t('sheet.sections')}">
      ${SECTIONS.map((id) => html`<button class="sheet-index__item ${open.has(id) ? 'is-open' : ''}" data-action="secJump" data-id="${id}" aria-pressed="${open.has(id)}" title="${t(open.has(id) ? 'sheet.closeIt' : 'sheet.openIt')}">${t(`sheet.sec.${id}`)}</button>`)}
      <span class="sheet-index__all"><button class="btn btn--sm btn--ghost" data-action="secAll" data-on="1">${t('sheet.openAll')}</button><button class="btn btn--sm btn--ghost" data-action="secAll" data-on="0">${t('sheet.closeAll')}</button></span>
    </nav>
    <div class="sheet-secs">${SECTIONS.map((id) => html`<details class="sheet-sec ${SINGLE.includes(id) ? 'sheet-sec--single' : ''}" id="sec-${id}" data-sec="${id}" ${open.has(id) ? 'open' : ''}>
      <summary class="sheet-sec__head"><span class="sheet-sec__title">${t(`sheet.sec.${id}`)}</span>${refs[id] ? info(refs[id], t(`sheet.sec.${id}`)) : ''}
        <span class="sheet-sec__sum">${pictures[id] || sum[id].filter(Boolean).join(' · ')}</span></summary>
      <div class="sheet-sec__body">${bodies[id]}</div>
    </details>`)}</div>
    </div>`;
}
