// Class engine card: resources + equipped abilities ("brain fog" limit); "ready" is computed live from the class state.

import { html, raw, signed } from '../dom.js';
import { counter, meter, card, segmented, nameOf } from './parts.js';
import { canUse, defaultResources, upgradeTechResources, SYNC_MAX, newTells, tellGain } from '../../rules/engines.js';
import { zoneFor } from '../../rules/classes.js';
import { info } from '../ref.js';
import { t, tn } from '../../i18n/index.js';
import { tourDone } from '../tour.js';
import { ruleText } from '../rule-text.js';

const deltaText = (d) => ('set' in d ? `= ${signed(d.set)}` : signed(d.delta));

function abilityMeta(cls, a) {
  switch (cls) {
    case 'soldier': return html`<span class="pill">${a.cost} TP</span>${a.gain ? html`<span class="pill pill--success">+${a.gain} TP</span>` : ''}<span class="pill">${a.stanceFrom} → ${a.stanceTo}</span>`;
    case 'hacker': return html`<span class="pill pill--info">${a.ram} RAM</span><span class="pill pill--danger">${a.heat} heat</span>${a.sustained ? html`<span class="pill pill--accent">sustained</span>` : ''}${a.heatVent ? html`<span class="pill pill--success">vent ${a.heatVent === 'all' ? t('engine.all') : `−${a.heatVent}`}</span>` : ''}`;
    case 'techwiz': return html`<span class="pill">${a.minSync ? `Sync ≥ ${['Cold', 'Warm', 'Tuned', 'Resonant'][a.minSync]}` : t('engine.anySync')}</span>${a.brownout ? html`<span class="pill pill--danger">Brownout</span>` : ''}`;
    case 'scavenger': return html`${a.tells ? html`<span class="pill pill--danger">${t('engine.tellsCost', { n: a.tells })}</span>` : ''}${a.gain?.target ? html`<span class="pill pill--success">${t('engine.gainTarget', { n: a.gain.target })}</span>` : ''}${a.gain?.spread ? html`<span class="pill pill--success">${t('engine.gainSpread', { n: a.gain.spread })}</span>` : ''}${a.adjacent ? html`<span class="pill">${t('engine.adjacent')}</span>` : ''}${a.oncePerCombat ? html`<span class="pill pill--accent">${t('engine.oncePerCombat')}</span>` : ''}${!a.tells && !a.gain && !a.oncePerCombat ? html`<span class="pill">${t('engine.any')}</span>` : ''}`;
    case 'smuggler': return html`${a.requires != null ? html`<span class="pill">${t('engine.needs')} ${a.requires > 0 ? '≥ ' : '≤ '}${signed(a.requires)}</span>` : html`<span class="pill">${t('engine.any')}</span>`}<span class="pill pill--accent">shift ${deltaText(a.shift)}</span>`;
    default: return '';
  }
}

function abilityText(cls, a, r) {
  if (cls === 'techwiz') {
    const both = r.sync >= SYNC_MAX;
    return html`<p class="ability__text ${r.mode === 'mend' || both ? 'is-active' : ''}"><strong class="text-info">Mend</strong> ${a.mend}</p>
      <p class="ability__text ${r.mode === 'surge' || both ? 'is-active' : ''}"><strong class="text-danger">Surge</strong> ${a.surge}</p>`;
  }
  return html`<p class="ability__text">${a.desc}</p>${a.prereq ? html`<p class="hint">${t('engine.prereq')}: ${a.prereq}</p>` : ''}`;
}

/** Scavenger: the enemies that can hold Tells — the GM's hostiles at the table, or enemies named by hand. */
export function tellTargets(r, combat) {
  if (combat?.hostiles?.length) return combat.hostiles.filter((h) => h.band !== 'down').map((h) => ({ key: h.key, letter: h.letter, name: h.name }));
  return (r.marks ?? []).map((m) => ({ key: m.key, letter: '', name: m.name, mark: true }));
}

function scavengerPanel(c, s, data, r, combat) {
  const rules = data.classes.classes.find((k) => k.id === 'scavenger').resources;
  const per = rules.tells.perEnemy;
  const owned = c.play.inventory.filter((x) => x.kind === 'optic');
  const o = s.optic;
  const mode = o.mode ? rules.modes.find((m) => m.id === o.mode) : null;
  const targets = tellTargets(r, combat);
  const holding = Object.values(r.tells).filter((n) => n > 0).length;
  const inCombat = Boolean(c.play.turn?.inCombat);
  const unseen = tellGain(r, c.play.cover ?? 0, data.classes) > rules.tells.gain;
  const pips = (n) => html`<span class="tell-pips" role="img" aria-label="${t('engine.tellsOf', { n, max: per })}">${Array.from({ length: per }, (_, i) => html`<span class="tell-pip ${i < n ? 'is-on' : ''}"></span>`)}</span>`;
  const row = (x) => {
    const n = r.tells[x.key] ?? 0;
    const on = r.target === x.key;
    return html`<li class="tell-row ${on ? 'is-target' : ''}">
      <button class="tell-row__pick" data-action="tellTarget" data-key="${x.key}" aria-pressed="${on}" title="${t('engine.setTarget')}">
        ${x.letter ? html`<span class="letter-badge">${x.letter}</span>` : ''}<span class="tell-row__name">${x.name}</span>${on ? html`<span class="pill pill--accent">${t('engine.target')}</span>` : ''}</button>
      <span class="counter">
        <button class="counter__btn" data-action="tell" data-key="${x.key}" data-delta="-1" ${n ? '' : raw('disabled')} aria-label="${t('engine.tellOff')}">−</button>
        ${pips(n)}
        <button class="counter__btn" data-action="tell" data-key="${x.key}" data-delta="1" ${n < per ? '' : raw('disabled')} aria-label="${t('engine.tellOn')}">+</button></span>
      ${x.mark ? html`<button class="btn btn--sm btn--ghost" data-action="markRemove" data-key="${x.key}" aria-label="${t('common.remove')}">✕</button>` : ''}
    </li>`;
  };
  return html`
    <div class="engine-row" data-tour="engine-item"><span class="label">${t('engine.optic')}${info('optic', t('engine.optic'))}</span>
      <select class="select" data-action="optic">
        <option value="">— ${t('engine.noOptic')} —</option>
        ${owned.map((x) => html`<option value="${x.id}" ${c.play.optic === x.id ? raw('selected') : ''}>${nameOf(data.optics, x.id)}</option>`)}
      </select></div>
    <p class="mono muted">${t('engine.opticStats', { range: o.range, track: o.track })}${mode ? html` · <strong>${mode.name}</strong> ${mode.desc}` : ''}</p>
    ${!o.item ? html`<p class="hint">${t(owned.length ? 'engine.selectOptic' : 'engine.buyOptic')}</p>` : ''}
    ${inCombat && r.toPlace > 0 ? html`<p class="notice notice--ok" role="status">${tn('engine.toPlace', r.toPlace)}${unseen ? html` <span class="pill pill--info">Unseen</span>` : ''}</p>` : ''}
    <div class="spread"><span class="label">${t('engine.tellsTitle')}</span><span class="mono muted">${t('engine.tracking', { n: holding, track: o.track })}</span></div>
    <div data-tour="tells">${targets.length ? html`<ul class="tell-list">${targets.map(row)}</ul>` : html`<p class="muted">${t(combat ? 'engine.noHostiles' : 'engine.noMarks')}</p>`}</div>
    ${combat?.hostiles?.length ? '' : html`<input class="input" data-action="markAdd" placeholder="${t('engine.addMark')}" maxlength="24" aria-label="${t('engine.addMark')}">`}
    <p class="hint">${t('engine.scavengerHint')}</p>`;
}

function resourcePanel(c, s, data, r, combat) {
  const cls = data.classes.classes.find((k) => k.id === c.classId);
  switch (c.classId) {
    case 'soldier': {
      const stance = cls.resources.stances.find((x) => x.id === r.stance);
      return html`
        <div class="engine-row"><span class="label">Tactical Points</span>${counter({ action: 'res', value: r.tp, min: 0, args: { key: 'tp', min: 0 }, label: 'TP' })}</div>
        <div class="engine-row"><span class="label">Stance</span>${segmented('setRes', cls.resources.stances.map((x) => ({ value: x.id, label: x.name })), r.stance, { key: 'stance' })}</div>
        <p class="hint">${t('engine.soldierHint', { dealt: stance.dealt, taken: stance.taken })}</p>`;
    }
    case 'hacker': {
      const owned = c.play.inventory.filter((x) => x.kind === 'deck');
      const ownedMods = c.play.inventory.filter((x) => x.kind === 'deckMod');
      const d = s.deck;
      return html`
        <div class="engine-row" data-tour="engine-item"><span class="label">Deck${info('deck', 'Deck')}</span>
          <select class="select" data-action="deck">
            <option value="">— ${t('engine.noDeck')} —</option>
            ${owned.map((o) => html`<option value="${o.id}" ${c.play.deck === o.id ? raw('selected') : ''}>${nameOf(data.decks, o.id)}</option>`)}
          </select></div>
        ${!d ? html`<p class="notice notice--warn">${owned.length ? t('engine.selectDeck') : t('engine.buyDeck')}</p>` : html`
          ${!r.bluescreen && d.status.heat.bluescreen ? html`<p class="notice notice--warn">${t(s.talents.keepSustainedOnBluescreen ? 'engine.overheatGhost' : 'engine.overheat')}</p>` : ''}
          ${r.bluescreen ? html`<p class="notice notice--danger">BLUE SCREEN — ${t(s.talents.keepSustainedOnBluescreen ? 'engine.bluescreenGhost' : 'engine.bluescreen', { heat: d.capacity.heatCap - cls.resources.roundEnd.rebootHeatBelowCap - (s.talents.rebootBelowCap ?? 0) })}</p>` : ''}
          ${r.stunned ? html`<p class="notice notice--warn">${t('engine.reboot')}</p>` : ''}
          <div class="engine-row"><span class="label">${t('engine.ramUsed')}</span>${counter({ action: 'res', value: r.ram, min: 0, max: d.capacity.ram, args: { key: 'ram', min: 0, max: d.capacity.ram }, label: 'RAM' })}<span class="mono muted">/ ${d.capacity.ram}</span></div>
          ${meter(r.ram, d.capacity.ram, 'info')}
          <div class="engine-row"><span class="label">Heat</span>${counter({ action: 'res', value: r.heat, min: 0, max: d.capacity.heatCap, args: { key: 'heat', min: 0, max: d.capacity.heatCap }, label: 'Heat' })}<span class="mono muted">/ ${d.capacity.heatCap}</span></div>
          ${meter(r.heat, d.capacity.heatCap, 'danger')}
          ${r.sustained.length ? html`<div class="stack stack--tight"><span class="label">${t('engine.sustained')}</span>
            <div class="cluster">${r.sustained.map((id) => html`<button class="btn btn--sm" data-action="release" data-id="${id}" title="${t('engine.release')}">${nameOf(data.abilities.hacker, id)} ✕</button>`)}</div></div>` : ''}
          <details class="details" data-keep="hardware"><summary>Hardware · ${d.capacity.slots.used}/${d.capacity.slots.max} mod slot · ${t('gear.battery')} ${d.battery.usage}</summary>
            ${ownedMods.length ? html`<div class="cluster">${ownedMods.map((m) => {
              const on = c.play.deckMods.includes(m.id);
              return html`<button class="btn btn--sm" data-action="deckMod" data-id="${m.id}" aria-pressed="${on}">${on ? '✓ ' : ''}${nameOf(data.deckMods.mods, m.id)}</button>`;
            })}</div>` : html`<p class="hint">${t('engine.noMods')}</p>`}
            ${d.capacity.overflow.length ? html`<p class="notice notice--warn">${t('engine.overflow', { mods: d.capacity.overflow.map((id) => nameOf(data.deckMods.mods, id)).join(', ') })}</p>` : ''}
          </details>`}
        <p class="hint">${t('engine.hackerHint')}</p>`;
    }
    case 'techwiz': {
      const levels = cls.resources.levels;
      return html`
        <div class="engine-row"><span class="label">Mode</span>${segmented('techMode', cls.resources.modes.map((m) => ({ value: m.id, label: m.name })), r.mode)}</div>
        <div class="engine-row"><span class="label">Sync</span>${counter({ action: 'res', value: r.sync, min: 0, max: SYNC_MAX, args: { key: 'sync', min: 0, max: SYNC_MAX }, label: 'Sync' })}
          <span class="pill ${r.sync >= SYNC_MAX ? 'pill--accent' : ''}">${levels[r.sync]}</span></div>
        <div class="sync-dial" aria-hidden="true">${levels.map((l, i) => html`<span class="sync-dial__step ${i <= r.sync ? 'is-on' : ''} sync-dial__step--${r.mode}">${l}</span>`)}</div>
        ${r.offline > 0 ? html`<p class="notice notice--danger">Brownout — ${r.offline > 1 ? t('engine.brownoutNext') : t('engine.brownoutNow')}</p>` : ''}
        ${r.sync >= SYNC_MAX && !r.offline ? html`<p class="notice notice--ok">Resonant — ${t('engine.resonantReady')}</p>` : ''}
        <p class="hint">${t('engine.techHint')}</p>`;
    }
    case 'smuggler': {
      const zone = zoneFor(r.pendulum, cls.resources.zones);
      return html`
        <div class="engine-row"><span class="label">Pendulum</span>${counter({ action: 'res', value: signed(r.pendulum), min: null, args: { key: 'pendulum', min: -4, max: 4 }, label: 'Pendulum' })}<span class="pill ${r.pendulum < 0 ? 'pill--info' : r.pendulum > 0 ? 'pill--danger' : ''}">${zone?.name}</span></div>
        <div class="pendulum" aria-hidden="true">${[-4, -3, -2, -1, 0, 1, 2, 3, 4].map((v) => html`<span class="pendulum__tick ${v === r.pendulum ? 'is-on' : ''} ${v < 0 ? 'is-cold' : v > 0 ? 'is-hot' : ''}">${signed(v)}</span>`)}</div>
        ${r.pendulum < 0 ? html`<p class="notice">${t('engine.zoneCold')}</p>` : r.pendulum > 0 ? html`<p class="notice notice--warn">${t('engine.zoneHot')}</p>` : ''}
        <p class="hint">${t('engine.smugglerHint')}</p>`;
    }
    case 'scavenger': return scavengerPanel(c, s, data, r, combat);
    default: return '';
  }
}

/** combat: the GM's combat state at the table (the Scavenger's Tells sit on its hostiles). */
export function engineCard(c, s, data, combat = null) {
  if (!c.classId) return card(t('engine.class'), html`<p class="muted">${t('engine.noClass')}</p>`);
  const saved = c.play.resources && Object.keys(c.play.resources).length ? c.play.resources : null;
  const r = c.classId === 'techwiz' ? upgradeTechResources(saved ?? defaultResources('techwiz'))
    : c.classId === 'scavenger' ? { ...newTells(), ...saved } : { ...defaultResources(c.classId), ...saved };
  const ctx = { capacity: s.deck?.capacity ?? null, weapons: s.armed, arms: s.injured.arms, talents: s.talents };
  const all = data.abilities[c.classId].map((a) => ({ ...a, available: a.subclasses.includes(c.subclassId) }));
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
            <span class="ability__name">${a.name}
              ${isEquipped ? (check.ok ? html`<span class="pill pill--success">${t('engine.ready')}</span>` : html`<span class="pill">${t('engine.notReady')}</span>`) : ''}</span>
            <span class="cluster">${abilityMeta(c.classId, a)}</span>
          </div>
          <div class="cluster">
            ${isEquipped && check.ok ? html`<button class="btn btn--sm btn--primary" data-action="abilityRoll" data-id="${a.id}" title="${t('engine.useHint', { tn: s.class.tn })}">${t('engine.use', { tn: s.class.tn })}</button>` : ''}
            ${isEquipped && check.ok && c.classId === 'techwiz' && r.sync >= SYNC_MAX ? html`<button class="btn btn--sm btn--resonant" data-action="abilityRoll" data-id="${a.id}" data-resonant="1" title="${t('engine.resonantHint')}">${t('engine.resonantCast')}</button>` : ''}
            <button class="btn btn--sm btn--ghost" data-action="equip" data-id="${a.id}" ${!a.available && !isEquipped ? raw('disabled') : ''}>${isEquipped ? t('engine.unequip') : t('engine.equip')}</button>
          </div>
        </div>
        ${abilityText(c.classId, a, r)}
        ${isEquipped && !check.ok ? html`<p class="hint ability__why">${ruleText(check)}</p>` : ''}
        ${!a.available ? html`<p class="hint">${t('engine.notAvailable', { subclass: s.class?.subclass.name ?? c.subclassId })}</p>` : ''}
      </div>`;
  };

  const cls = data.classes.classes.find((k) => k.id === c.classId);
  const body = html`
    <div class="stack">
      ${tourDone(`class.${c.classId}`) ? '' : html`<p class="notice tour-offer"><span>${t('tour.classOffer', { cls: cls.name })}</span>
        <button class="btn btn--sm btn--primary" data-action="tour" data-id="class.${c.classId}">${t('tour.classTour')}</button></p>`}
      <div class="stack" data-tour="engine-resource">${resourcePanel(c, s, data, r, combat)}</div>
      <div class="stack" data-tour="engine-abilities">
      <div class="spread spread--wrap">
        <span class="label">${t('engine.equipped')} ${equipped.length}/${s.abilityLimit} · <span class="text-success">${t('engine.readyCount', { n: readyCount })}</span></span>
        <span class="cluster"><span class="label">${t('engine.brainFog')}${info('brain-fog', t('engine.brainFog'))}</span>${counter({ action: 'maxAbilities', value: c.play.maxAbilities, min: 1, size: 'sm', label: t('engine.brainFog') })}</span></div>
      ${equipped.length ? equipped.map((a) => abilityRow(a, true)) : html`<p class="muted">${t('engine.nothingEquipped', { n: s.abilityLimit, resource: data.classes.classes.find((k) => k.id === c.classId).resources.counters[0].name })}</p>`}
      <details class="details" data-keep="abilities"><summary>${t('engine.allAbilities', { cls: data.classes.classes.find((k) => k.id === c.classId).name, n: rest.length })}</summary>
        <div class="stack">${rest.map((a) => abilityRow(a, false))}</div>
      </details>
      </div>
    </div>`;
  return card(`${s.class.name} · ${t('engine.title')}`, body, { sub: cls.resources.engine, ref: c.classId, tour: 'engine',
    actions: html`<button class="btn btn--sm btn--ghost" data-action="tour" data-id="class.${c.classId}">${t('tour.classTour')}</button>` });
}
