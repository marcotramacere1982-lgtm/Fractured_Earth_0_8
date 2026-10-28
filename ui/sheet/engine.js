// Class engine card: resources + equipped abilities ("brain fog" limit); "ready" is computed live from the class state.

import { html, raw } from '../dom.js';
import { counter, card, segmented, nameOf, icon } from './parts.js';
import { abilityEffects } from '../../rules/ability-play.js';
import { canUse, defaultResources, upgradeTechResources, SYNC_MAX, newTells, tellGain, openingChoice, abilityContext } from '../../rules/engines.js';
import { info } from '../ref.js';
import { t, tn } from '../../i18n/index.js';
import { tourDone } from '../tour.js';
import { ruleText } from '../rule-text.js';
import { smugglerPanel, smugglerMeta } from './engine-smuggler.js';
import { hackerPanel, hackerMeta } from './engine-hacker.js';
import { dronePanel } from './engine-drone.js';
import { droneAbility } from '../../rules/field-drone.js';
import { kitsFor } from '../../rules/kits.js';


/** A stance with its icon (decision 88): names stay, the picture makes the flow readable at a glance. */
const stanceChip = (icons, stances, id, current) => {
  if (id === 'any') return html`<span class="stance-chip">${t('engine.anyStance')}</span>`;
  if (id === 'current') return html`<span class="stance-chip">${t('engine.sameStance')}</span>`;
  const s = stances.find((x) => x.id === id);
  return html`<span class="stance-chip stance-chip--${id} ${id === current ? 'is-now' : ''}"><span class="stance-icon">${raw(icons[`stance_${id}`] ?? '')}</span>${s?.name ?? id}</span>`;
};

function abilityMeta(cls, a, r = {}, data = null, ctx = {}) {
  switch (cls) {
    case 'soldier': {
      const stances = data.classes.classes.find((k) => k.id === 'soldier').resources.stances;
      return html`<span class="pill">${a.cost} TP</span>${a.gain ? html`<span class="pill pill--success">+${a.gain} TP</span>` : ''}<span class="stance-flow">${stanceChip(data.icons, stances, a.stanceFrom, r.stance)}<span class="stance-flow__arrow">→</span>${stanceChip(data.icons, stances, a.stanceTo, null)}</span>`;
    }
    case 'hacker': return hackerMeta(a, r, data, ctx);
    case 'techwiz': return html`${syncNeed(a.minSync, r, data)}${a.brownout ? html`<span class="pill pill--danger sync-chip"><span class="sync-glyph">${raw(data.icons.brownout)}</span>Brownout</span>` : ''}`;
    case 'scavenger': return html`${a.tells ? html`<span class="pill pill--danger tell-chip" title="${t('engine.tellsCost', { n: a.tells })}">−${diamonds(data, a.tells, 'cost')}</span>` : ''}${a.gain?.target ? html`<span class="pill pill--success tell-chip" title="${t('engine.gainTarget', { n: a.gain.target })}">+${diamonds(data, a.gain.target, 'gain')}</span>` : ''}${a.gain?.spread ? html`<span class="pill pill--success tell-chip">${t('engine.gainSpread', { n: a.gain.spread })}</span>` : ''}${a.adjacent ? html`<span class="pill tell-chip">${ico(data, 'adjacent')}${t('engine.adjacent')}</span>` : ''}${a.oncePerCombat ? html`<span class="pill pill--accent">${t('engine.oncePerCombat')}</span>` : ''}${!a.tells && !a.gain && !a.oncePerCombat ? html`<span class="pill">${t('engine.any')}</span>` : ''}`;
    case 'smuggler': return smugglerMeta(a, r, data, ctx);
    default: return '';
  }
}

function abilityText(cls, a, r, icons = null, { usableNow = false } = {}) {
  if (cls === 'techwiz' && a.mend) { // decision 177: Steady Hands / Calibrate have no faces — plain text below
    const both = r.sync >= SYNC_MAX && !r.offline;
    const glyph = (id) => html`<span class="sync-glyph sync-glyph--${id}">${raw(icons?.[id] ?? '')}</span>`;
    return html`<p class="ability__text ability__face ${r.mode === 'mend' || both ? 'is-active' : ''}">${glyph('mend')}<strong class="text-success">Mend</strong> ${a.mend}</p>
      <p class="ability__text ability__face ${r.mode === 'surge' || both ? 'is-active' : ''}">${glyph('surge')}<strong class="text-danger">Surge</strong> ${a.surge}</p>${both && usableNow ? html`<p class="ability__both"><span class="pill pill--accent">${t('engine.bothFaces')}</span></p>` : ''}`;
  }
  return html`<p class="ability__text">${a.desc}</p>${a.prereq ? html`<p class="hint">${t('engine.prereq')}: ${a.prereq}</p>` : ''}`;
}

/** Scavenger: the enemies that can hold Tells — the GM's hostiles at the table, or enemies named by hand. */
export function tellTargets(r, combat) {
  if (combat?.hostiles?.length) return combat.hostiles.filter((h) => h.band !== 'down').map((h) => ({ key: h.key, letter: h.letter, name: h.name }));
  return (r.marks ?? []).map((m) => ({ key: m.key, letter: '', name: m.name, mark: true }));
}

/** A row of Tell diamonds (decision 90): filled ◆, empty ◇; `kind`: tell (gold) / cost (red) / gain (green). */
const diamonds = (data, n, kind = 'tell') => html`<span class="tell-diamonds tell-diamonds--${kind}">${Array.from({ length: n }, () => html`<span class="tell-ico">${raw(data.icons.tell)}</span>`)}</span>`;
const ico = (data, id, cls = '') => html`<span class="scav-ico ${cls}">${raw(data.icons[id] ?? '')}</span>`;

/**
 * Scavenger engine (decision 90): the optic as a lens card, the light switch with the Unseen checklist (the map can
 * suggest "in the dark"), Tells as tappable diamonds per enemy with a ⌖ target button, and the rules as a short list.
 * opts.mapDark: true when the table map says your square is dark (only a suggestion: the player confirms).
 */
function scavengerPanel(c, s, data, r, combat, { mapDark = null } = {}) {
  const rules = data.classes.classes.find((k) => k.id === 'scavenger').resources;
  const per = rules.tells.perEnemy;
  const owned = c.play.inventory.filter((x) => x.kind === 'optic');
  const o = s.optic;
  const mode = o.mode ? rules.modes.find((m) => m.id === o.mode) : null;
  const targets = tellTargets(r, combat);
  const downHolding = (combat?.hostiles ?? []).filter((h) => h.band === 'down' && (r.tells[h.key] ?? 0) > 0);
  const holding = Object.values(r.tells).filter((n) => n > 0).length;
  const inCombat = Boolean(c.play.turn?.inCombat);
  const dark = Boolean(c.play.inDark);
  const cover = (c.play.cover ?? 0) >= rules.tells.unseenCover;
  const hidden = cover || dark;
  const unseen = tellGain(r, c.play.cover ?? 0, data.classes, dark) > rules.tells.gain;
  const tick = (ok, text) => html`<li class="${ok ? 'is-ok' : 'is-no'}"><span class="tick">${ok ? '✓' : '✗'}</span>${text}</li>`;

  const pipButtons = (x, n) => html`<span class="tell-pick" role="group" aria-label="${t('engine.tellsOf', { n, max: per })}">${Array.from({ length: per }, (_, i) => html`
    <button class="tell-pip-btn ${i < n ? 'is-on' : ''}" data-action="tellSet" data-key="${x.key}" data-n="${i + 1}" aria-label="${t('engine.tellSetTo', { n: i + 1 })}">${raw(data.icons.tell)}</button>`)}</span>`;
  const row = (x, gone = false) => {
    const n = r.tells[x.key] ?? 0;
    const on = r.target === x.key;
    return html`<li class="tell-row ${on ? 'is-target' : ''} ${gone ? 'is-gone' : ''}">
      <span class="tell-row__who">${x.letter ? html`<span class="letter-badge">${x.letter}</span>` : ''}<span class="tell-row__name">${x.name}</span>
        ${x.band ? html`<span class="muted st-small">${t(`turn.band.${x.band}`)}</span>` : ''}</span>
      ${gone ? html`<span class="st-small muted">${diamonds(data, n)} ${t('engine.tellsLost')}</span>` : html`
      ${pipButtons(x, n)}
      <button class="tell-target-btn ${on ? 'is-on' : ''}" data-action="tellTarget" data-key="${x.key}" aria-pressed="${on}" title="${t('engine.setTarget')}" aria-label="${t('engine.setTarget')}">${raw(data.icons.reticle)}</button>
      ${x.mark ? html`<button class="btn btn--sm btn--ghost" data-action="markRemove" data-key="${x.key}" aria-label="${t('common.remove')}">✕</button>` : ''}
      ${n ? html`<span class="tell-row__worth">${ico(data, 'exploit')}${t('engine.exploitWorth', { n })}</span>` : ''}`}
    </li>`;
  };
  const slots = Array.from({ length: o.track }, (_, i) => html`<span class="scav-ico ${i < holding ? 'is-on' : ''}">${raw(data.icons.reticle)}</span>`);

  return html`
    <div class="engine-row" data-tour="engine-item"><span class="label">${t('engine.optic')}${info('optic', t('engine.optic'))}</span>
      <select class="select" data-action="optic">
        <option value="">— ${t('engine.noOptic')} —</option>
        ${owned.map((x) => html`<option value="${x.id}" ${c.play.optic === x.id ? raw('selected') : ''}>${nameOf(data.optics, x.id)}</option>`)}
      </select></div>
    <div class="lens-card">
      <span class="lens-stat">${ico(data, 'scope')}<span><strong>${o.range}</strong> ${t('engine.lensRange')}</span></span>
      <span class="lens-stat"><span class="lens-slots">${slots}</span><span><strong>${holding}/${o.track}</strong> ${t('engine.lensTrack')}</span></span>
      ${mode ? html`<span class="lens-stat lens-stat--mode">${ico(data, `optic_${mode.id}`)}<span><strong>${mode.name}</strong> ${mode.desc}</span></span>` : ''}
    </div>
    ${!o.item ? html`<p class="hint">${t(owned.length ? 'engine.selectOptic' : 'engine.buyOptic')}</p>` : ''}

    <div class="light-switch" role="group" aria-label="${t('engine.lightTitle')}">
      <button class="light-switch__opt ${dark ? '' : 'is-on'}" data-action="inDark" data-on="0" aria-pressed="${!dark}">${ico(data, 'sun')}${t('engine.lit')}</button>
      <button class="light-switch__opt light-switch__opt--dark ${dark ? 'is-on' : ''}" data-action="inDark" data-on="1" aria-pressed="${dark}">${ico(data, 'moon')}${t('engine.inTheDark')}</button>
    </div>
    ${mapDark && !dark ? html`<p class="notice notice--warn map-suggest">${ico(data, 'moon')}${t('engine.mapSaysDark')}
      <button class="btn btn--sm btn--primary" data-action="inDark" data-on="1">${t('engine.countDark')}</button></p>` : ''}
    <div class="unseen ${unseen ? 'is-unseen' : ''}">
      <ul class="unseen__checks">${tick(hidden, dark ? t('engine.checkDark') : t('engine.checkCover'))}${tick(!r.attacked, t('engine.checkNoAttack'))}</ul>
      <p class="unseen__result">${unseen ? html`<strong>${t('engine.unseenYes')}</strong> ${diamonds(data, rules.tells.gainUnseen)}` : html`${t(!hidden ? 'engine.unseenNoCover' : 'engine.unseenAttacked')} ${diamonds(data, rules.tells.gain)}`}</p>
    </div>
    ${inCombat && r.toPlace > 0 ? html`<p class="notice notice--ok to-place" role="status">${t('engine.toPlaceShort')} ${diamonds(data, r.toPlace)}</p>` : ''}

    <div class="spread"><span class="label">${t('engine.tellsTitle')}</span></div>
    <div data-tour="tells">${targets.length || downHolding.length ? html`<ul class="tell-list">${targets.map((x) => row(x))}${downHolding.map((h) => row({ key: h.key, letter: h.letter, name: h.name, band: 'down' }, true))}</ul>`
      : html`<p class="muted">${t(combat ? 'engine.noHostiles' : 'engine.noMarks')}</p>`}</div>
    ${combat?.hostiles?.length ? '' : html`<input class="input" data-action="markAdd" placeholder="${t('engine.addMark')}" maxlength="24" aria-label="${t('engine.addMark')}">`}
    <ul class="scav-rules">
      <li>${diamonds(data, 1)}<span>${t('engine.ruleTurn')}</span></li>
      <li>${diamonds(data, 2)}<span>${t('engine.ruleUnseen')}</span></li>
      <li>${diamonds(data, 3)}<span>${t('engine.ruleMax', { n: per })}</span></li>
      <li>${ico(data, 'exploit')}<span>${t('engine.ruleExploit')}</span></li>
      <li>${ico(data, 'reticle')}<span>${t('engine.ruleTarget')}</span></li>
      <li><span class="tick">✕</span><span>${t('engine.ruleLost')}</span></li>
    </ul>`;
}

// ------------------------------------------------------------------ Tech Wizard: Field Sync (decision 89)

const glyph = (data, id) => html`<span class="sync-glyph sync-glyph--${id}">${raw(data.icons[id] ?? '')}</span>`;
/** The four Sync rings (Cold → Resonant), filled outward; the mode's glyph in the middle (both at Resonant). */
function syncDial(r, data) {
  const radii = [17, 24, 31, 38];
  const rings = radii.map((rad, i) => `<circle class="sync-ring ${i <= r.sync ? 'is-on' : ''}" cx="40" cy="40" r="${rad}" stroke-width="${i <= r.sync ? 4 : 2}"${r.offline ? ' stroke-dasharray="5 5"' : ''}/>`).join('');
  const both = r.sync >= SYNC_MAX && !r.offline;
  return html`<div class="sync-ring-dial sync-ring-dial--${r.offline ? 'brownout' : r.mode} ${both ? 'is-resonant' : ''}" aria-hidden="true">
    <svg viewBox="0 0 80 80" class="sync-ring-dial__svg">${raw(rings)}</svg>
    <span class="sync-ring-dial__core">${r.offline ? glyph(data, 'brownout') : both ? html`${glyph(data, 'mend')}${glyph(data, 'surge')}` : glyph(data, r.mode)}</span></div>`;
}
/** A card's Sync need as rings (◉◉○○ = Warm or better), or "any Sync". */
function syncNeed(min, r, data) {
  const levels = data.classes.classes.find((k) => k.id === 'techwiz').resources.levels;
  if (!min) return html`<span class="pill">${t('engine.anySync')}</span>`;
  return html`<span class="pill sync-need ${r.sync >= min ? 'is-met' : ''}" title="${t('engine.needSync', { level: levels[min] })}">${[0, 1, 2, 3].map((i) => html`<span class="sync-need__dot ${i <= min ? 'is-on' : ''}"></span>`)}${levels[min]}+</span>`;
}
/** What happens to Sync at the end of this round. */
function roundEndNote(r, data) {
  const mode = data.classes.classes.find((k) => k.id === 'techwiz').resources.modes.find((m) => m.id === r.mode)?.name ?? r.mode;
  if (r.offline) return t(r.offline > 1 ? 'engine.syncEndBrownoutNext' : 'engine.syncEndBrownout');
  if (r.switched) return t('engine.syncEndSwitched');
  if (r.sync >= SYNC_MAX) return t('engine.syncEndHold');
  return t('engine.syncEndGain', { mode });
}
function techPanel(c, s, data, r, cls) {
  const levels = cls.resources.levels;
  const keep = s.talents?.keepSyncOnSwitch ?? 0;
  const opening = openingChoice(c.play.turn); // decision 146: before the first action, picking a mode isn't a switch
  const modeBtn = (m) => {
    const on = r.mode === m.id;
    return html`<button class="mode-switch__opt mode-switch__opt--${m.id} ${on ? 'is-on' : ''}" data-action="techMode" data-value="${m.id}" aria-pressed="${on}">
      ${glyph(data, m.id)}<span>${on ? m.name : t('engine.switchTo', { mode: m.name })}${on ? '' : html`<small>${opening ? t('engine.switchOpening') : keep ? t('engine.switchKeep', { n: Math.min(r.sync, keep) }) : t('engine.switchReset')}</small>`}</span></button>`;
  };
  const rule = (text) => html`<li>${glyph(data, 'sync')}<span>${text}</span></li>`;
  return html`
    <div class="mode-switch" role="group" aria-label="Mode">${cls.resources.modes.map(modeBtn)}</div>
    <div class="sync-block">
      ${syncDial(r, data)}
      <div class="stack-tight sync-block__side">
        <div class="sync-steps">${levels.map((l, i) => html`<span class="sync-step ${i === r.sync ? 'is-now' : ''} ${i < r.sync ? 'is-past' : ''}">${l}</span>`)}</div>
        <p class="sync-next">${roundEndNote(r, data)}</p>
        ${r.offline > 0 ? html`<p class="notice notice--danger">Brownout — ${r.offline > 1 ? t('engine.brownoutNext') : t('engine.brownoutNow')}</p>` : ''}
        ${r.sync >= SYNC_MAX && !r.offline ? html`<p class="notice notice--ok">Resonant — ${t('engine.resonantReady')}</p>` : ''}
      </div>
    </div>
    <ul class="sync-rules">${rule(t('engine.syncRuleAbility'))}${rule(t('engine.syncRuleHold'))}${rule(t('engine.syncRuleSwitch'))}${rule(t('engine.syncRuleHit'))}</ul>
    <details class="stance-fix"><summary class="muted st-small">${t('engine.fixSync')}</summary>
      ${counter({ action: 'res', value: r.sync, min: 0, max: SYNC_MAX, args: { key: 'sync', min: 0, max: SYNC_MAX }, label: 'Sync' })}</details>`;
}

function resourcePanel(c, s, data, r, combat, opts = {}) {
  const cls = data.classes.classes.find((k) => k.id === c.classId);
  switch (c.classId) {
    case 'soldier': {
      const stance = cls.resources.stances.find((x) => x.id === r.stance) ?? cls.resources.stances.find((x) => x.default);
      const BADGES = 6;
      return html`
        <div class="engine-row"><span class="label">Tactical Points</span>${counter({ action: 'res', value: r.tp, min: 0, args: { key: 'tp', min: 0 }, label: 'TP' })}
          <span class="tp-badges" aria-hidden="true">${Array.from({ length: Math.min(r.tp, BADGES) }, () => html`<span class="tp-badge">${raw(data.icons.tp)}</span>`)}${r.tp > BADGES ? html`<span class="tp-more">+${r.tp - BADGES}</span>` : ''}</span></div>
        <div class="engine-row"><span class="label">Stance</span>
          <div class="stances" role="list">${cls.resources.stances.map((x) => html`<span role="listitem" class="stance stance--${x.id} ${x.id === stance.id ? 'is-now' : ''}" aria-current="${x.id === stance.id}">
            <span class="stance-icon">${raw(data.icons[`stance_${x.id}`] ?? '')}</span><span class="stance__name">${x.name}</span></span>`)}</div></div>
        <p class="hint">${t('engine.soldierHint', { dealt: stance.dealt, taken: stance.taken })}${stance.attackTn ? ` ${t('engine.stanceTn', { n: stance.attackTn })}` : ''} ${t('engine.stanceFlow')}</p>
        <details class="stance-fix"><summary class="muted st-small">${t('engine.fixStance')}</summary>
          ${segmented('fixStance', cls.resources.stances.map((x) => ({ value: x.id, label: x.name })), stance.id)}
          <p class="hint">${t('engine.fixStanceHint')}</p></details>`;
    }
    case 'hacker': return hackerPanel(c, s, data, r, cls);
    case 'techwiz': {
      return html`${dronePanel(c, s, data)}${techPanel(c, s, data, r, cls)}`; // decision 172
    }
    case 'smuggler': return smugglerPanel(c, s, data, r, cls);
    case 'scavenger': return scavengerPanel(c, s, data, r, combat, opts);
    default: return '';
  }
}

/** Decision 183: suggested loadouts — one tap swaps the equipped abilities (gear stays as it is). */
const kitButtons = (c, data) => {
  const kits = kitsFor(c.subclassId, data);
  return kits.length ? html`<div class="cluster"><span class="label">${t('engine.kits')}</span>${kits.map((k) => html`<button class="btn btn--sm btn--ghost" data-action="useKit" data-id="${k.id}" title="${t('engine.kitHint')}">${k.name}</button>`)}</div>` : '';
};

/** Decision 174: the generic limits an ability carries, as small chips. */
const flagChips = (a) => html`${a.outOfCombat ? html`<span class="pill">${t('engine.flag.outOfCombat')}</span>` : ''}${a.opening ? html`<span class="pill">${t('engine.flag.opening')}</span>` : ''}${a.reaction ? html`<span class="pill pill--info">${t('engine.flag.reaction')}</span>` : ''}${a.perMission ? html`<span class="pill pill--accent">${t('engine.flag.perMission')}</span>` : ''}${a.perScene ? html`<span class="pill">${t('engine.flag.perScene')}</span>` : ''}`;

/** combat: the GM's combat state at the table (the Scavenger's Tells sit on its hostiles). */
export function engineCard(c, s, data, combat = null, opts = {}) {
  if (!c.classId) return card(t('engine.class'), html`<p class="muted">${t('engine.noClass')}</p>`);
  const saved = c.play.resources && Object.keys(c.play.resources).length ? c.play.resources : null;
  const r = c.classId === 'techwiz' ? upgradeTechResources(saved ?? defaultResources('techwiz'))
    : c.classId === 'scavenger' ? { ...newTells(), ...saved } : { ...defaultResources(c.classId), ...saved };
  const ctx = { ...abilityContext(c), capacity: s.deck?.capacity ?? null, weapons: s.armed, arms: s.injured.arms, talents: s.talents, ...(c.classId === 'techwiz' ? { drone: s.drone } : {}) };
  const all = data.abilities[c.classId].filter((a) => !a.housekeeping).map((a) => ({ ...droneAbility(a, s.drone), available: a.subclasses.includes(c.subclassId) })); // decision 172: the drone's numbers in
  // decision 174: housekeeping — always at hand, outside the slots; in a fight each costs an action
  const chores = data.abilities[c.classId].filter((a) => a.housekeeping && a.subclasses.includes(c.subclassId)).map((a) => ({ ...a, check: canUse(c.classId, a, r, ctx) }));
  const choreButton = (a) => html`<button class="btn btn--sm" data-action="abilityRoll" data-id="${a.id}" ${a.check.ok ? '' : 'disabled'} title="${a.check.ok ? a.desc : ruleText(a.check)}">${a.name}</button>`;
  const choresStrip = chores.length ? html`<div class="chores"><span class="label">${t('engine.housekeeping')}${info('housekeeping', t('engine.housekeeping'))}</span><span class="cluster">${chores.map(choreButton)}</span></div>` : '';
  // Equipped = the loadout the player chose (swap between combats, capped by brain fog).
  // Ready = equipped AND the class criteria are met right now (computed live, never stored).
  const equipped = c.play.abilities.map((id) => all.find((a) => a.id === id)).filter(Boolean)
    .map((a) => ({ ...a, check: canUse(c.classId, a, r, ctx) }));
  const readyCount = equipped.filter((a) => a.check.ok).length;
  const rest = all.filter((a) => !c.play.abilities.includes(a.id));

  const abilityRow = (a, isEquipped) => {
    const check = a.check ?? canUse(c.classId, a, r, ctx);
    const state = !isEquipped ? '' : check.ok ? 'ability--ready' : 'ability--waiting';
    return html`
      <div class="ability ${isEquipped ? 'ability--equipped' : ''} ${state} ${!a.available ? 'ability--locked' : ''}">
        <div class="spread spread--top">
          <div class="ability__head">
            <span class="ability__name">${abilityEffects(a).map((id) => icon(data, id, 'ico--fx'))}${a.name}
              ${isEquipped ? (check.ok ? html`<span class="pill pill--success">${t('engine.ready')}</span>` : html`<span class="pill">${t('engine.notReady')}</span>`) : ''}</span>
            <span class="cluster">${abilityMeta(c.classId, a, r, data, ctx)}${flagChips(a)}</span>
          </div>
          <div class="cluster">
            ${isEquipped && check.ok ? html`<button class="btn btn--sm btn--primary" data-action="abilityRoll" data-id="${a.id}" title="${t('engine.useHint', { tn: s.class.tn })}">${t('engine.use', { tn: s.class.tn })}</button>` : ''}
            ${isEquipped && check.ok && c.classId === 'techwiz' && r.sync >= SYNC_MAX ? html`<button class="btn btn--sm btn--resonant" data-action="abilityRoll" data-id="${a.id}" data-resonant="1" title="${t('engine.resonantHint')}">${t('engine.resonantCast')}</button>` : ''}
            <button class="btn btn--sm btn--ghost" data-action="equip" data-id="${a.id}" ${!a.available && !isEquipped ? raw('disabled') : ''}>${isEquipped ? t('engine.unequip') : t('engine.equip')}</button>
          </div>
        </div>
        ${abilityText(c.classId, a, r, data.icons, { usableNow: isEquipped && check.ok })}
        ${a.droneReach && s.drone ? html`<p class="hint">${tn('twd.reachNote', s.drone.reach)}</p>` : ''}
        ${isEquipped && !check.ok ? html`<p class="hint ability__why">${ruleText(check)}</p>` : ''}
        ${!a.available ? html`<p class="hint">${t('engine.notAvailable', { subclass: s.class?.subclass.name ?? c.subclassId })}</p>` : ''}
      </div>`;
  };

  const cls = data.classes.classes.find((k) => k.id === c.classId);
  // decision 163: the Tactical View's compact engine — one line per equipped ability, then the resource panel
  if (opts.compact) {
    const line = (a) => html`<div class="ability-line ${a.check.ok ? 'is-ready' : ''}" title="${a.desc ?? [a.play?.mend && a.mend, a.play?.surge && a.surge].filter(Boolean).join(' / ') ?? ''}">
      <span class="ability-line__name">${abilityEffects(a).map((id) => icon(data, id, 'ico--fx'))}${a.name}</span>
      ${a.check.ok ? html`<button class="btn btn--sm btn--primary" data-action="abilityRoll" data-id="${a.id}" title="${t('engine.useHint', { tn: s.class.tn })}">${t('engine.useShort')}</button>
        ${c.classId === 'techwiz' && r.sync >= SYNC_MAX ? html`<button class="btn btn--sm btn--resonant" data-action="abilityRoll" data-id="${a.id}" data-resonant="1" title="${t('engine.resonantHint')}">✦</button>` : ''}`
        : html`<span class="muted st-small ability-line__why">${ruleText(a.check)}</span>`}
    </div>`;
    return html`<div class="engine-compact">
      <div class="spread"><span class="label">${icon(data, data.icons[c.classId] ? c.classId : 'class_tn')}${s.class.name} · ${cls.resources.engine}</span>
        <button class="btn btn--sm btn--ghost" data-action="tacEngine" title="${t('tac.engineFull')}" aria-label="${t('tac.engineFull')}">⤢</button></div>
      <span class="label">${t('engine.equipped')} · <span class="text-success">${t('engine.readyCount', { n: readyCount })}</span></span>
      <div class="ability-lines">${equipped.length ? equipped.map(line) : html`<p class="muted st-small">${t('engine.nothingEquippedShort')}</p>`}</div>
      ${choresStrip}
      <div class="stack" data-tour="engine-resource">${resourcePanel(c, s, data, r, combat, opts)}</div>
    </div>`;
  }
  const body = html`
    <div class="stack">
      ${tourDone(`class.${c.classId}`) ? '' : html`<p class="notice tour-offer"><span>${t('tour.classOffer', { cls: cls.name })}</span>
        <button class="btn btn--sm btn--primary" data-action="tour" data-id="class.${c.classId}">${t('tour.classTour')}</button></p>`}
      <div class="stack" data-tour="engine-resource">${resourcePanel(c, s, data, r, combat, opts)}</div>
      <div class="stack" data-tour="engine-abilities">
      ${choresStrip}
      <div class="spread spread--wrap">
        <span class="label">${t('engine.equipped')} ${equipped.length}/${s.abilityLimit} · <span class="text-success">${t('engine.readyCount', { n: readyCount })}</span></span>
        <span class="cluster"><span class="label">${t('engine.brainFog')}${info('brain-fog', t('engine.brainFog'))}</span>${counter({ action: 'maxAbilities', value: c.play.maxAbilities, min: 1, size: 'sm', label: t('engine.brainFog') })}</span></div>
      ${kitButtons(c, data)}
      ${equipped.length ? equipped.map((a) => abilityRow(a, true)) : html`<p class="muted">${t('engine.nothingEquipped', { n: s.abilityLimit, resource: data.classes.classes.find((k) => k.id === c.classId).resources.counters[0].name })}</p>`}
      <details class="details" data-keep="abilities"><summary>${t('engine.allAbilities', { cls: data.classes.classes.find((k) => k.id === c.classId).name, n: rest.length })}</summary>
        <div class="stack">${rest.map((a) => abilityRow(a, false))}</div>
      </details>
      </div>
    </div>`;
  return card(`${s.class.name} · ${t('engine.title')}`, body, { sub: cls.resources.engine, ref: c.classId, tour: 'engine',
    actions: html`<span class="cluster">${opts.expandable ? html`<button class="btn btn--sm btn--ghost" data-action="tacEngine" title="${t('tac.engineCompact')}" aria-label="${t('tac.engineCompact')}">⤡</button>` : ''}<button class="btn btn--sm btn--ghost" data-action="tour" data-id="class.${c.classId}">${t('tour.classTour')}</button></span>` });
}
