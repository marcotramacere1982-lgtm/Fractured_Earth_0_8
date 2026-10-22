// Hacker engine (decision 92): RAM as white → blue cells with the sustained payloads greyed over them, Heat as
// green → red cells up to the Blue Screen cap, hand corrections folded away, and ability cards with icon costs.
import { html, raw } from '../dom.js';
import { counter, nameOf } from './parts.js';
import { useAbility } from '../../rules/engines.js';
import { info } from '../ref.js';
import { t } from '../../i18n/index.js';

const ico = (data, id) => html`<span class="hk-ico">${raw(data.icons[id] ?? '')}</span>`;

/** One cell per RAM slot: locked cells carry the payload holding them (or "by hand" for a manual correction). */
function ramBar(r, max, data) {
  const owners = r.sustained.flatMap((id) => Array(data.abilities.hacker.find((a) => a.id === id)?.ram ?? 0).fill(id));
  const cells = Array.from({ length: max }, (_, i) => {
    const locked = i < r.ram;
    const who = locked ? (owners[i] ? nameOf(data.abilities.hacker, owners[i]) : t('engine.hkByHand')) : t('engine.hkFree');
    return html`<span class="hk-cell ${locked ? 'is-locked' : ''} ${i === r.ram && r.ram > 0 ? 'is-edge' : ''}" title="${who}"></span>`;
  });
  return html`<div class="hk-bar hk-bar--ram" role="meter" aria-label="RAM" aria-valuenow="${r.ram}" aria-valuemin="0" aria-valuemax="${max}">${cells}</div>`;
}

function heatBar(heat, cap) {
  const cells = Array.from({ length: cap }, (_, i) => html`<span class="hk-cell ${i < heat ? 'is-hot' : ''}"></span>`);
  return html`<div class="hk-bar hk-bar--heat" role="meter" aria-label="Heat" aria-valuenow="${heat}" aria-valuemin="0" aria-valuemax="${cap}">${cells}</div>`;
}

export function hackerPanel(c, s, data, r, cls) {
  const owned = c.play.inventory.filter((x) => x.kind === 'deck');
  const ownedMods = c.play.inventory.filter((x) => x.kind === 'deckMod');
  const d = s.deck;
  const vent = cls.resources.roundEnd.heatVent + (s.talents.heatVent ?? 0);
  const deckRow = html`<div class="engine-row" data-tour="engine-item"><span class="label">Deck${info('deck', 'Deck')}</span>
      <select class="select" data-action="deck">
        <option value="">— ${t('engine.noDeck')} —</option>
        ${owned.map((o) => html`<option value="${o.id}" ${c.play.deck === o.id ? raw('selected') : ''}>${nameOf(data.decks, o.id)}</option>`)}
      </select></div>`;
  if (!d) return html`${deckRow}<p class="notice notice--warn">${owned.length ? t('engine.selectDeck') : t('engine.buyDeck')}</p>`;
  const { ram, heatCap } = d.capacity;
  const ghost = s.talents.keepSustainedOnBluescreen;
  return html`${deckRow}
    ${!r.bluescreen && d.status.heat.bluescreen ? html`<p class="notice notice--warn">${t(ghost ? 'engine.overheatGhost' : 'engine.overheat')}</p>` : ''}
    ${r.bluescreen ? html`<p class="notice notice--danger">BLUE SCREEN — ${t(ghost ? 'engine.bluescreenGhost' : 'engine.bluescreen', { heat: heatCap - cls.resources.roundEnd.rebootHeatBelowCap - (s.talents.rebootBelowCap ?? 0) })}</p>` : ''}
    ${r.stunned ? html`<p class="notice notice--warn">${t('engine.reboot')}</p>` : ''}

    <div class="hk-gauge">
      <div class="hk-gauge__head"><span class="label">${ico(data, 'ram')}RAM</span>
        <span class="mono"><strong>${Math.max(0, ram - r.ram)}</strong> ${t('engine.hkFreeOf', { max: ram })}${r.ram ? html` · <span class="muted">${t('engine.hkLocked', { n: r.ram })}</span>` : ''}</span></div>
      ${ramBar(r, ram, data)}
    </div>
    ${r.sustained.length ? html`<div class="cluster hk-payloads"><span class="label">${t('engine.sustained')}</span>${r.sustained.map((id) => html`
      <button class="btn btn--sm hk-payload" data-action="release" data-id="${id}" title="${t('engine.release')}">${ico(data, 'lock')}${nameOf(data.abilities.hacker, id)}
        <span class="mono muted">${data.abilities.hacker.find((a) => a.id === id)?.ram ?? 0}</span> ✕</button>`)}</div>` : ''}
    <div class="hk-gauge">
      <div class="hk-gauge__head"><span class="label">${ico(data, 'heat')}Heat</span>
        <span class="mono"><strong>${r.heat}</strong> / ${heatCap} <span class="muted">· ${t('engine.hkVent', { n: vent })}</span></span></div>
      ${heatBar(r.heat, heatCap)}
      <div class="hk-scale"><span>0</span><span class="text-danger">${t('engine.hkBlueScreenAt', { n: heatCap })}</span></div>
    </div>
    <details class="details" data-keep="hacker-adjust"><summary>${t('engine.hkAdjust')}</summary>
      <div class="hk-adjust">
        <span class="label">${t('engine.ramUsed')}</span>${counter({ action: 'res', value: r.ram, min: 0, max: ram, args: { key: 'ram', min: 0, max: ram }, label: 'RAM' })}
        <span class="label">Heat</span>${counter({ action: 'res', value: r.heat, min: 0, max: heatCap, args: { key: 'heat', min: 0, max: heatCap }, label: 'Heat' })}
      </div>
      <p class="hint">${t('engine.hkAdjustHint')}</p>
    </details>
    <details class="details" data-keep="hardware"><summary>Hardware · ${d.capacity.slots.used}/${d.capacity.slots.max} mod slot · ${t('gear.battery')} ${d.battery.usage}</summary>
      ${ownedMods.length ? html`<div class="cluster">${ownedMods.map((m) => {
        const on = c.play.deckMods.includes(m.id);
        return html`<button class="btn btn--sm" data-action="deckMod" data-id="${m.id}" aria-pressed="${on}">${on ? '✓ ' : ''}${nameOf(data.deckMods.mods, m.id)}</button>`;
      })}</div>` : html`<p class="hint">${t('engine.noMods')}</p>`}
      ${d.capacity.overflow.length ? html`<p class="notice notice--warn">${t('engine.overflow', { mods: d.capacity.overflow.map((id) => nameOf(data.deckMods.mods, id)).join(', ') })}</p>` : ''}
    </details>
    <ul class="hk-rules">
      <li>${ico(data, 'ram')}<span>${t('engine.hkRuleRam')}</span></li>
      <li>${ico(data, 'lock')}<span>${t('engine.hkRuleLock')}</span></li>
      <li>${ico(data, 'heat')}<span>${t('engine.hkRuleHeat', { n: vent })}</span></li>
      <li>${ico(data, 'target_types')}<span>${t('engine.hkRuleTargets')}</span></li>
    </ul>`;
}

/** Ability chips: RAM (needs free / locks it), heat added or vented, what it clears, and heat after use on this deck. */
export function hackerMeta(a, r, data, ctx = {}) {
  const chips = [];
  if (a.ram) chips.push(html`<span class="pill pill--info hk-chip" title="${t(a.sustained ? 'engine.hkLocksRam' : 'engine.hkNeedsRam', { n: a.ram })}">${ico(data, a.sustained ? 'lock' : 'ram')}${a.ram}${a.sustained ? html` <span class="hk-chip__note">${t('engine.hkHeld')}</span>` : ''}</span>`);
  if (a.heat) chips.push(html`<span class="pill pill--danger hk-chip" title="${t('engine.hkAddsHeat', { n: a.heat })}">${ico(data, 'heat')}+${a.heat}</span>`);
  if (a.heatVent) chips.push(html`<span class="pill pill--success hk-chip" title="${t('engine.hkVentsHeat')}">${ico(data, 'heat')}${a.heatVent === 'all' ? '→ 0' : `−${a.heatVent}`}</span>`);
  if (a.clearsRam) chips.push(html`<span class="pill pill--success hk-chip">${ico(data, 'ram')}${t(a.clearsRam === 'all' ? 'engine.hkClearsAll' : 'engine.hkClearsSustained')}</span>`);
  if (a.clearsRam === 'all') chips.push(html`<span class="pill pill--danger">${t('engine.hkOffline')}</span>`);
  if (a.auto) chips.push(html`<span class="pill">${t('engine.hkNoRoll')}</span>`);
  if (ctx.capacity && (a.heat || a.heatVent)) {
    let next = null;
    try { next = useAbility('hacker', a, r, ctx).heat; } catch { next = null; }
    const cap = ctx.capacity.heatCap;
    if (next != null) chips.push(html`<span class="pill hk-chip hk-after ${next >= cap ? 'is-crash' : ''}">${t(next >= cap ? 'engine.hkAfterCrash' : 'engine.hkAfter', { n: next, cap })}</span>`);
  }
  return chips;
}
