// The class bar (decision 198): one row under the Tactical map — the class meter at a glance, a tile per equipped
// ability (what it costs and needs, Use or why not) and the housekeeping chips. A tap on a tile's name opens the
// whole card in a window. Folded, it's one line: the meter and "2/3 ready". The Class bookmark stays the reference
// (the full engine, corrections, the rules).

import { html, raw } from '../dom.js';
import { t } from '../../i18n/index.js';
import { icon } from './parts.js';
import { ruleText } from '../rule-text.js';
import { engineSnapshot, abilityChips, abilityLine } from './engine.js';
import { abilityEffects } from '../../rules/ability-play.js';
import { zoneBonus, SYNC_MAX } from '../../rules/engines.js';

const KEY = 'fe.classBar.folded';
let folded = (() => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } })();
export function toggleClassBar() { folded = !folded; try { localStorage.setItem(KEY, folded ? '1' : '0'); } catch { /* private mode */ } }

const signed = (n) => (n > 0 ? `+${n}` : String(n));
const glyph = (data, id) => html`<span class="cbar__glyph">${raw(data.icons[id] ?? '')}</span>`;

/** Little cells: n lit of max, in a tone (a glance at RAM, heat, TP…). */
const cells = (n, max, tone, title) => html`<span class="cbar__cells cbar__cells--${tone}" title="${title}" aria-label="${title}">${Array.from({ length: max }, (_, k) => html`<span class="cbar__cell ${k < n ? 'is-on' : ''}"></span>`)}</span>`;

/** Each class's state at a glance (decision 201): icons, numbers and small bars — the words are in the tooltips. */
function meter(c, s, data, r) {
  const res = data.classes.classes.find((k) => k.id === c.classId).resources;
  switch (c.classId) {
    case 'soldier': {
      const st = res.stances.find((x) => x.id === r.stance) ?? res.stances.find((x) => x.default);
      const tp = r.tp ?? 0;
      return html`<span class="cbar__meter-item cbar__stance cbar__stance--${st.id}" title="${st.name}">${glyph(data, `stance_${st.id}`)}</span>
        <span class="cbar__meter-item" title="Tactical Points">${glyph(data, 'tp')}<span class="cbar__big mono">${tp}</span>${cells(Math.min(tp, 6), 6, 'accent', `TP ${tp}`)}</span>
        <span class="cbar__meter-item mono st-small" title="${t('engine.stanceNow', { dealt: st.dealt, taken: st.taken })}">${glyph(data, 'fx_attack')}×${st.dealt} ${glyph(data, 'armor')}×${st.taken}</span>`;
    }
    case 'smuggler': {
      const p = r.pendulum ?? 0;
      const z = zoneBonus('smuggler', r, data.classes, {}, c.subclassId);
      const zone = z.zone ?? 'composure';
      return html`<span class="cbar__meter-item cbar__zone cbar__zone--${zone}" title="${z.name ?? ''}">${glyph(data, `zone_${zone}`)}<span class="cbar__big mono">${signed(p)}</span></span>
        <span class="cbar__pend" title="${z.name ?? ''}" aria-hidden="true">${[-4, -3, -2, -1, 0, 1, 2, 3, 4].map((v) => html`<span class="cbar__pend-cell cbar__pend-cell--${v < 0 ? 'cold' : v > 0 ? 'hot' : 'mid'} ${v === p ? 'is-now' : ''}"></span>`)}</span>`;
    }
    case 'hacker': {
      const cap = s.deck?.capacity ?? null;
      if (!cap) return html`<span class="cbar__meter-item muted" title="${t('engine.selectDeck')}">${glyph(data, 'ram')}—</span>`;
      const free = Math.max(0, cap.ram - (r.ram ?? 0));
      const heat = r.heat ?? 0;
      return html`<span class="cbar__meter-item" title="RAM ${free} / ${cap.ram}">${glyph(data, 'ram')}<span class="cbar__big mono">${free}</span><span class="mono muted">/${cap.ram}</span>${cells(free, cap.ram, 'info', `RAM ${free} / ${cap.ram}`)}</span>
        <span class="cbar__meter-item ${heat >= cap.heatCap - 2 ? 'text-danger' : ''}" title="Heat ${heat} / ${cap.heatCap}">${glyph(data, 'heat')}<span class="cbar__big mono">${heat}</span><span class="mono muted">/${cap.heatCap}</span>${cells(heat, cap.heatCap, 'heat', `Heat ${heat} / ${cap.heatCap}`)}</span>
        ${r.bluescreen ? html`<span class="pill pill--danger" title="BLUE SCREEN">${glyph(data, 'heat')}!</span>` : ''}`;
    }
    case 'techwiz': {
      const sync = r.sync ?? 0;
      const level = res.levels[sync];
      const resonant = sync >= SYNC_MAX && !r.offline;
      const mode = res.modes.find((m) => m.id === r.mode)?.name ?? r.mode;
      return html`<span class="cbar__meter-item cbar__mode cbar__mode--${r.offline ? 'brownout' : r.mode}" title="${r.offline ? 'Brownout' : resonant ? 'Resonant' : mode}">${r.offline ? glyph(data, 'brownout') : resonant ? html`<span class="cbar__mode--mend">${glyph(data, 'mend')}</span><span class="cbar__mode--surge">${glyph(data, 'surge')}</span>` : glyph(data, r.mode)}</span>
        <span class="cbar__meter-item" title="Sync ${level}">${glyph(data, 'sync')}<span class="cbar__sync">${[0, 1, 2, 3].map((k) => html`<span class="cbar__sync-dot ${k <= sync ? 'is-on' : ''}"></span>`)}</span></span>`;
    }
    case 'scavenger': {
      const tells = Object.values(r.tells ?? {}).reduce((n, x) => n + x, 0);
      return html`<span class="cbar__meter-item ${c.play.inDark ? 'cbar__dark' : ''}" title="${t(c.play.inDark ? 'engine.inTheDark' : 'engine.lit')}">${glyph(data, c.play.inDark ? 'moon' : 'sun')}</span>
        <span class="cbar__meter-item" title="${t('engine.tellsTitle')}">${glyph(data, 'tell')}<span class="cbar__big mono">${tells}</span></span>
        ${r.toPlace > 0 ? html`<span class="cbar__meter-item text-success" title="${t('engine.toPlaceShort')}">+${r.toPlace}${glyph(data, 'tell')}</span>` : ''}`;
    }
    default: return '';
  }
}

/** One equipped ability: icons, name (tap: the whole card), its chips, Use or why not. */
function tile(c, s, data, a, r) {
  return html`<div class="cbar__tile ${a.check.ok ? 'is-ready' : ''}">
    <button type="button" class="cbar__name" data-action="abilityInfo" data-id="${a.id}" title="${t('cbar.more')}">${abilityEffects(a).map((id) => icon(data, id, 'ico--fx'))}${a.name}</button>
    <div class="cluster cbar__chips">${abilityChips(c, s, data, a)}</div>
    ${a.check.ok ? html`<span class="cluster cbar__go"><button class="btn btn--sm btn--primary" data-action="abilityRoll" data-id="${a.id}">${t('engine.use', { tn: s.class.tn })}</button>
      ${c.classId === 'techwiz' && (r.sync ?? 0) >= SYNC_MAX && !r.offline ? html`<button class="btn btn--sm btn--resonant" data-action="abilityRoll" data-id="${a.id}" data-resonant="1" title="${t('engine.resonantHint')}">✦</button>` : ''}</span>`
      : html`<span class="muted st-small cbar__why">${ruleText(a.check)}</span>`}
  </div>`;
}

/** The bar, or '' for a character with no class. */
export function classBar(c, s, data) {
  if (!c.classId || !s.class) return '';
  const { r, equipped, chores } = engineSnapshot(c, s, data);
  const ready = equipped.filter((a) => a.check.ok).length;
  return html`<section class="cbar ${folded ? 'is-folded' : ''}" aria-label="${t('cbar.title')}" data-tour="engine-resource">
    <div class="cbar__meter">${meter(c, s, data, r)}</div>
    ${folded ? html`<span class="cbar__count muted st-small">${t('cbar.ready', { n: ready, of: equipped.length })}</span>` : html`
      <div class="cbar__tiles">${equipped.length ? equipped.map((a) => tile(c, s, data, a, r)) : html`<p class="muted st-small">${t('engine.nothingEquipped', { n: s.abilityLimit, resource: '' })}</p>`}</div>
      ${chores.length ? html`<div class="cbar__chores">${chores.map((a) => html`<button class="btn btn--sm" data-action="abilityRoll" data-id="${a.id}" ${a.check.ok ? '' : raw('disabled')} title="${a.check.ok ? a.desc : ruleText(a.check)}">${a.name}</button>`)}</div>` : ''}`}
    <button type="button" class="btn btn--sm btn--ghost cbar__fold" data-action="classBarFold" aria-expanded="${!folded}" title="${t(folded ? 'cbar.open' : 'cbar.fold')}" aria-label="${t(folded ? 'cbar.open' : 'cbar.fold')}">${folded ? '▴' : '▾'}</button>
  </section>`;
}

/** The whole card of one ability, for the window a tile's name opens. */
export function abilityWindow(c, s, data, id) {
  const { r, equipped, chores } = engineSnapshot(c, s, data);
  const a = [...equipped, ...chores].find((x) => x.id === id);
  if (!a) return null;
  return html`<header class="card__head"><h2 class="card__title">${abilityEffects(a).map((x) => icon(data, x, 'ico--fx'))}${a.name}</h2><button class="btn btn--ghost btn--icon" data-action="close" aria-label="${t('common.close')}">✕</button></header>
    <div class="dialog__body stack">
      <div class="cluster">${abilityChips(c, s, data, a)}</div>
      <div class="cbar__text">${abilityLine(c, s, a)}</div>
      ${a.check.ok ? html`<div class="cluster"><button class="btn btn--primary" data-action="use" data-id="${a.id}">${t('engine.use', { tn: s.class.tn })}</button>
        ${c.classId === 'techwiz' && (r.sync ?? 0) >= SYNC_MAX && !r.offline ? html`<button class="btn btn--resonant" data-action="use" data-id="${a.id}" data-resonant="1">${t('engine.resonantCast')}</button>` : ''}</div>`
        : html`<p class="hint">${ruleText(a.check)}</p>`}
    </div>`;
}
