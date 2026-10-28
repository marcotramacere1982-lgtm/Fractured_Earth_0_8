// Smuggler engine (decision 91): the Adrenaline Pendulum as a cold → hot slider, zones with their bonuses as icons,
// the round-end drift, and ability cards that show where on the pendulum they work and where they swing it.
import { html, raw, signed } from '../dom.js';
import { useAbility, roundEnd } from '../../rules/engines.js';
import { zoneFor } from '../../rules/classes.js';
import { t } from '../../i18n/index.js';

const STOPS = [-4, -3, -2, -1, 0, 1, 2, 3, 4];
const side = (v) => (v < 0 ? 'cold' : v > 0 ? 'hot' : 'mid');
const ico = (data, id) => html`<span class="pend-ico">${raw(data.icons[id] ?? '')}</span>`;
/** Zone id → icon (data/icons.json). */
const ZONE_ICON = { cold: 'zone_cold', composure: 'zone_composure', hot: 'zone_hot' };

/** The zone's bonuses as icon chips; `zone` is the derived sheet's zoneBonus (talents already in). */
function zoneChips(data, z, zb) {
  if (z.id === 'cold') return html`<span class="pend-chip">${ico(data, 'reticle')}${t('engine.pendColdBonus', { n: signed(z.bonus.rangedTn) })}</span>`;
  if (z.id === 'hot') return html`<span class="pend-chip">${ico(data, 'exploit')}${t('engine.pendHotDamage', { n: signed(zb?.zone === 'hot' ? zb.damage : z.bonus.damage) })}</span>
    <span class="pend-chip">${ico(data, 'sqr')}${t('engine.pendHotMove', { n: signed(z.bonus.squares) })}</span>`;
  return html`<span class="pend-chip muted">${t('engine.pendNoBonus')}</span>`;
}

export function smugglerPanel(c, s, data, r, cls) {
  const zones = cls.resources.zones;
  const p = r.pendulum ?? 0;
  const zone = zoneFor(p, zones);
  const wounded = c.play.conditions.includes('wounded');
  const next = roundEnd('smuggler', r, { wounded }).pendulum;
  const stop = (v) => html`<button class="pend-stop pend-stop--${side(v)} ${v === p ? 'is-on' : ''}" data-action="setRes" data-key="pendulum" data-value="${v}"
    aria-pressed="${v === p}" aria-label="${t('engine.pendSet', { n: signed(v) })}"><span class="pend-stop__val">${signed(v)}</span></button>`;
  const legend = (z) => html`<div class="pend-zone pend-zone--${z.id} ${zone?.id === z.id ? 'is-on' : ''}">
      <span class="pend-zone__name">${ico(data, ZONE_ICON[z.id])}${z.name}</span>
      <span class="pend-zone__fx">${zoneChips(data, z, s.zone)}</span></div>`;
  return html`
    <div class="pendulum-slider" role="group" aria-label="${t('engine.pendTitle')}">
      <div class="pend-track">${STOPS.map(stop)}</div>
      <div class="pend-ends"><span>${t('engine.pendCold')}</span><span>${t('engine.pendHot')}</span></div>
      <div class="pend-zones">${zones.map(legend)}</div>
    </div>
    <p class="pend-drift ${next !== p ? 'is-moving' : ''}">${ico(data, 'zone_hot')}${wounded
      ? (next !== p ? t('engine.pendDrift', { from: signed(p), to: signed(next) }) : t('engine.pendDriftMax'))
      : t('engine.pendNoDrift')}</p>`;
}

/** The nine cells of the pendulum, lit where the ability can be used; the current position is marked. */
function needStrip(a, p) {
  const ok = (v) => a.requires == null || (a.requires > 0 ? v >= a.requires : v <= a.requires);
  return html`<span class="need-strip" aria-hidden="true">${STOPS.map((v) => html`<span class="need-strip__cell need-strip__cell--${side(v)} ${ok(v) ? 'is-ok' : ''} ${v === p ? 'is-now' : ''}"></span>`)}</span>`;
}

/** Ability chips: where it works (strip + "needs ≥ +2"), the swing (◀ toward Cold / ▶ toward Hot / ⇥ set) and where you'd land. */
export function smugglerMeta(a, r, data, ctx = {}) {
  const p = r.pendulum ?? 0;
  const need = a.requires == null ? t('engine.any') : `${a.requires > 0 ? '≥' : '≤'} ${signed(a.requires)}`;
  const shift = 'set' in a.shift ? a.shift.set - p : a.shift.delta;
  const dir = 'set' in a.shift ? 'set' : shift < 0 ? 'cold' : 'hot';
  const arrow = 'set' in a.shift ? `⇥ ${signed(a.shift.set)}` : `${shift < 0 ? '◀' : '▶'} ${signed(a.shift.delta)}`;
  const usable = a.requires == null || (a.requires > 0 ? p >= a.requires : p <= a.requires);
  let land = null; // where you'd land if you used it now; only shown when the pendulum allows it
  if (usable) try { land = useAbility('smuggler', a, r, ctx).pendulum; } catch { land = null; }
  const still = !('set' in a.shift) && !a.shift.delta; // decision 174: no swing (Fast Talk, Know a Guy…), no swing chips
  return html`<span class="pill pend-need" title="${t('engine.pendNeeds', { need })}">${needStrip(a, p)}${need}</span>
    ${still ? '' : html`<span class="pill pend-swing pend-swing--${dir}" title="${t(dir === 'set' ? 'engine.pendSwingSet' : 'engine.pendSwing', { n: signed(shift) })}">${arrow}</span>`}
    ${land != null && !still ? html`<span class="pill pend-land pend-land--${side(land)}">${t('engine.pendLand', { n: signed(land) })}</span>` : ''}
    ${a.oncePerCombat ? html`<span class="pill pill--accent">${t('engine.oncePerCombat')}</span>` : ''}`;
}
