// Status bar + Play tab (health, body, weapons, conditions, combat values, class engine).

import { html, raw, signed } from '../dom.js';
import { skillsTab } from './skills.js';
import { counter, meter, card, segmented, nameOf, temp, icon } from './parts.js';
import { engineCard } from './engine.js';
import { talentsCard } from './progress.js';
import { turnCard } from './turn.js';
import { carriedProtections } from '../../rules/tools.js';
import { info } from '../ref.js';
import { explain, hint } from '../explain.js';
import { t, tn } from '../../i18n/index.js';
import { portraitImg } from '../portrait.js';
import { initiativeCard } from './initiative.js';
import { rollAskCard } from './roll-ask.js';
import { hitsCard, boonsCard } from './hits.js';

export function statusBar(c, s, data, { compact = false, all = false } = {}) {
  const hpKind = s.hp.current <= 0 ? 'danger' : s.hp.current <= s.hp.max / 3 ? 'danger' : 'success';
  if (compact) return compactStatus(c, s, data, hpKind, { all });
  return html`
    <div class="sheet-status" data-tour="status">
      <div class="sheet-status__id">
        ${portraitImg(c.portrait, 'avatar avatar--sm')}
        <div>
          <div class="sheet-status__name">${c.name || t('common.unnamed')}</div>
          <div class="sheet-status__class">${s.class ? `${s.class.name} · ${s.class.subclass.name}` : t('sheet.noClass')}</div>
        </div>
      </div>
      <div class="sheet-status__stats">
        <div class="stat stat--hp">
          <span class="label">HP${explain('hp', '', 'HP')}</span>
          <div class="cluster">${counter({ action: 'hp', value: s.hp.current, max: s.hp.max, label: 'HP' })}<span class="mono muted">/ ${s.hp.max}</span></div>
          ${meter(s.hp.current, s.hp.max, hpKind)}
        </div>
        <div class="stat"><span class="label">${t('stat.armor')}${info('armor', t('stat.armor'))}</span><span class="stat__value stat__value--info">${temp(s.armor.general - s.armor.condition, s.armor.general)}</span></div>
        <div class="stat"><span class="label">${t('stat.init')}${explain('initiative', '', t('explain.feeds.initiative'))}</span><span class="stat__value">${signed(s.initiative)}</span></div>
        <div class="stat"><span class="label">${t('stat.actions')}${explain('combat', 'act', t('stat.actions'))}</span><span class="stat__value">${temp(s.combat.act.base ?? s.combat.act.value, s.actionsNow)}</span></div>
        ${s.class ? html`<div class="stat"><span class="label">Class TN${explain('class-tn', '', 'Class TN')}</span><span class="stat__value stat__value--accent">${s.class.tn}</span></div>` : ''}
      </div>
      <div class="sheet-status__combat" data-tour="combat-line">
        <span class="chip-stat" ${hint('combat', 'sqr')}><span class="label">${t('stat.move')}${explain('combat', 'sqr', t('stat.move'))}</span><span class="chip-stat__v">${temp(s.moveBase, s.move)}</span><span class="chip-stat__u">${t('stat.squares')}</span></span>
        ${['off', 'def', 'per'].map((id) => html`<span class="chip-stat" ${hint('combat', id)}><span class="label">${id.toUpperCase()}${explain('combat', id, data.combat.derived.find((d) => d.id === id)?.name ?? id)}</span><span class="chip-stat__v">${temp(s.combat[id].base, s.combat[id].value, id === 'off' ? signed : (x) => x)}</span></span>`)}
      </div>
      ${s.effects.length ? html`<div class="cluster">${s.effects.map((e) => html`<span class="pill pill--success effect-pill">${e.name} · ${e.roundsLeft == null ? t('use.scene') : tn('use.rounds', e.roundsLeft)}
        <button class="effect-pill__end" data-action="endEffect" data-id="${e.id}" aria-label="${t('use.end', { name: e.name })}" title="${t('use.end', { name: e.name })}">✕</button></span>`)}</div>` : ''}
      ${c.play.conditions.length || s.injured.locations.length ? html`<div class="cluster">${c.play.conditions.map((id) => html`<span class="pill ${data.conditions.find((k) => k.id === id)?.positive ? 'pill--success' : data.conditions.find((k) => k.id === id)?.mixed ? 'pill--warning' : 'pill--danger'}">${nameOf(data.conditions, id)}</span>`)}${s.injured.locations.map((id) => {
        const loc = data.body.locations.find((l) => l.id === id);
        return html`<span class="pill pill--danger">${data.conditions.find((k) => k.limb === loc?.bp)?.name} · ${loc?.name}</span>`;
      })}</div>` : ''}
    </div>`;
}

/**
 * Decision 134: the status bar as one slim row, on the Active map tab — what a fight needs at a glance (HP with − / +,
 * armor, initiative, actions, move, conditions); ▾ opens the full bar (remembered on the device).
 */
function compactStatus(c, s, data, hpKind, { all = false } = {}) {
  const conds = [...c.play.conditions.map((id) => nameOf(data.conditions, id)), ...s.injured.locations.map((id) => data.body.locations.find((l) => l.id === id)?.name)].filter(Boolean);
  return html`<div class="sheet-status sheet-status--compact" data-tour="status">
    ${portraitImg(c.portrait, 'avatar avatar--xs')}<strong class="sheet-status__name sheet-status__name--sm">${c.name || t('common.unnamed')}</strong>
    <div class="sheet-status__hp">${icon(data, 'hp', 'ico--hp')}${counter({ action: 'hp', value: s.hp.current, max: s.hp.max, label: 'HP' })}<span class="mono muted">/ ${s.hp.max}</span>${meter(s.hp.current, s.hp.max, hpKind)}</div>
    <span class="chip-stat"><span class="label">${icon(data, 'armor')}${t('stat.armor')}</span><span class="chip-stat__v stat__value--info">${temp(s.armor.general - s.armor.condition, s.armor.general)}</span></span>
    <span class="chip-stat"><span class="label">${icon(data, 'ini')}${t('stat.init')}</span><span class="chip-stat__v">${signed(s.initiative)}</span></span>
    <span class="chip-stat"><span class="label">${icon(data, 'act')}${t('stat.actions')}</span><span class="chip-stat__v">${temp(s.combat.act.base ?? s.combat.act.value, s.actionsNow)}</span></span>
    <span class="chip-stat"><span class="label">${icon(data, 'sqr')}${t('stat.move')}</span><span class="chip-stat__v">${temp(s.moveBase, s.move)}</span><span class="chip-stat__u">${t('stat.squares')}</span></span>
    ${all ? html`${['off', 'def', 'per'].map((id) => html`<span class="chip-stat"><span class="label">${icon(data, id)}${id.toUpperCase()}${explain('combat', id, data.combat.derived.find((d) => d.id === id)?.name ?? id)}</span><span class="chip-stat__v">${temp(s.combat[id].base, s.combat[id].value, id === 'off' ? signed : (x) => x)}</span></span>`)}
      ${s.class ? html`<span class="chip-stat"><span class="label">${icon(data, data.icons[c.classId] ? c.classId : 'class_tn')}Class TN</span><span class="chip-stat__v stat__value--accent">${s.class.tn}</span></span>` : ''}` : ''}
    ${conds.length ? html`<span class="pill pill--danger" title="${conds.join(' · ')}">${conds.length === 1 ? conds[0] : tn('status.conditions', conds.length)}</span>` : ''}
    ${all ? '' : html`<button class="btn btn--sm btn--ghost sheet-status__more" data-action="statusOpen" title="${t('status.expand')}" aria-label="${t('status.expand')}">▾</button>`}
  </div>`;
}

function deathNotice(c, s) {
  if (s.hp.current > 0) return '';
  const dead = s.hp.current <= -c.attributes.CON;
  return html`<p class="notice ${dead ? 'notice--danger' : 'notice--warn'}">
    ${dead
      ? t('body.dead', { hp: s.hp.current, con: c.attributes.CON })
      : t('body.incapacitated')}
  </p>`;
}

/** "d20 1–4 Leg → Crippled leg · …": what a location attack does, from the data. */
export function locationRule(data) {
  const cond = (id) => data.conditions.find((k) => k.id === id)?.name ?? id;
  const inj = data.body.injuries;
  const rows = data.body.hitLocation.table.map((r) => {
    const bp = data.body.locations.find((l) => l.id === r.locations[0])?.bp;
    const what = bp === 'head' ? t('body.headRow', { stunned: cond(inj.head.condition), severe: cond(inj.head.severe) }) : cond(inj[bp].condition);
    return `${r.min}–${r.max} ${t(`body.part.${bp}`)} → ${what}`;
  });
  return { rows, head: t('body.headSevere', { stunned: cond(inj.head.condition), severe: cond(inj.head.severe) }) };
}

/** Decision 162: conditions and boosts (names only unless on, or with the tips switch) — the Health card and the Tactical View. */
/** bare (decision 163, the Tactical View): icons only while the tips are off — name and effect in each tile's tooltip. */
export function conditionsGrid(c, s, data, { tips = false, bare = false } = {}) {
  const conds = data.conditions.filter((k) => !k.enemyOnly && !k.positive && !k.transient); // transient: set by the sheet (Unsteady), shown only while on you
  const boosts = data.conditions.filter((k) => k.positive);
  const sides = (bp) => data.body.locations.filter((l) => l.bp === bp);
  const icons = bare && !tips;
  const grid = `cond-grid ${tips ? '' : 'cond-grid--compact'} ${icons ? 'cond-grid--bare' : ''}`;
  const name = (text) => html`<span class="cond__label">${text}</span>`;
  const side = (l) => (icons ? t(l.id.startsWith('r') ? 'body.sideR' : 'body.sideL') : l.name);
  return html`
    <div class="spread"><h3 class="label cond-group">${t('body.conditions')}</h3>
      <button class="btn btn--sm btn--ghost" data-action="actionTips" aria-pressed="${tips}" title="${t('turn.tipsHint')}">? ${t(tips ? 'turn.tipsHide' : 'turn.tipsShow')}</button></div>
    <div class="${grid}">
      ${conds.map((k) => {
        if (k.limb) {
          const hurt = sides(k.limb).filter((l) => s.injured.locations.includes(l.id));
          return html`<div class="cond cond--limb ${hurt.length ? 'cond--on' : ''}" title="${k.name} — ${k.effects.join(' ')} ${k.clear ?? ''}">
            <span class="cond__name">${icon(data, k.icon)}${name(k.name)}${hurt.length === 2 ? ' ×2' : ''}</span>
            ${(hurt.length && !icons) || tips ? html`<span class="cond__fx">${hurt.length === 2 ? k.effects[1] : k.effects[0]}</span>` : ''}
            <span class="cluster">${sides(k.limb).map((l) => html`<button class="btn btn--sm ${s.injured.locations.includes(l.id) ? 'btn--danger' : ''}" data-action="injury" data-loc="${l.id}" aria-pressed="${s.injured.locations.includes(l.id)}" title="${l.name} — ${k.clear}" aria-label="${l.name}">${side(l)}</button>`)}</span>
          </div>`;
        }
        const on = c.play.conditions.includes(k.id);
        return html`<button class="cond ${on ? 'cond--on' : ''}" data-action="condition" data-id="${k.id}" aria-pressed="${on}" title="${k.name} — ${k.effects.join(' ')} ${k.clear ?? ''}">
          <span class="cond__name">${icon(data, k.icon)}${name(k.name)}</span>
          ${(on && !icons) || tips ? html`<span class="cond__fx">${k.effects[0]}</span>` : ''}
        </button>`;
      })}
    </div>
    ${carriedProtections(c.play.inventory, data.items).map((pr) => html`<p class="notice notice--ok"><strong>${pr.name}:</strong> ${pr.text}</p>`)}
    <h3 class="label cond-group">${t('body.boosts')}</h3>
    <div class="${grid}">${boosts.map((k) => {
      const on = c.play.conditions.includes(k.id);
      return html`<button class="cond cond--boost ${on ? 'cond--on' : ''}" data-action="condition" data-id="${k.id}" aria-pressed="${on}" title="${k.name} — ${k.effects.join(' ')} ${k.clear ?? ''}">
        <span class="cond__name">${icon(data, k.icon)}${name(k.name)}</span>${(on && !icons) || tips ? html`<span class="cond__fx">${k.effects[0]}</span>` : ''}</button>`;
    })}</div>
`;
}

/** tips (decision 156): the same switch as the Turn card — off, a condition shows its name only (its effect when it's on you). */
function healthCard(c, s, data, { tips = false } = {}) {
  const rule = locationRule(data);
  const body = html`
    ${deathNotice(c, s)}
    <div class="spread spread--wrap">
      <div class="cluster">
        <span class="label">${t('body.cover')}${info('cover', t('body.cover'))}</span>
        ${segmented('cover', data.difficulty.cover.map((x) => ({ value: x.armor, label: x.armor ? `${x.name.split(' ')[0]} +${x.armor}` : t('body.coverNone') })), c.play.cover)}
      </div>
      <button class="btn btn--sm" data-action="heal">${t('body.heal')}</button>
    </div>
    <div class="spread spread--wrap armor-row">
      <div class="cluster">
        <span class="label">${t('stat.armor')}${info('armor', t('stat.armor'))}</span>
        <span class="stat__value stat__value--info">${s.armor.general}</span>
        <span class="mono muted">${t('body.armorParts', { worn: s.armor.worn, cracked: s.armor.cracked, cover: s.armor.cover })}</span>
      </div>
      <div class="cluster">
        <button class="btn btn--sm" data-action="armorCrack" data-delta="1" ${s.armor.current > 0 ? '' : raw('disabled')} title="${t('body.crackHint')}">${t('body.crack')}</button>
        ${s.armor.cracked ? html`<button class="btn btn--sm" data-action="repairArmor" title="${t('body.repairHint')}">${t('body.repair')}</button>` : ''}
      </div>
    </div>
    <form class="hit-form" data-hit-form>
      <span class="label">${t('hit.title')}${info('location-attack', t('hit.title'))}</span>
      <input class="input input--num" type="number" min="0" inputmode="numeric" name="damage" placeholder="${t('hit.damage')}" aria-label="${t('hit.damage')}">
      <select class="select" name="loc" aria-label="${t('hit.where')}">
        <option value="">${t('hit.none')}</option>
        ${data.body.locations.map((l) => html`<option value="${l.id}">${t('hit.at', { where: l.name })}</option>`)}
      </select>
      <button class="btn btn--sm btn--danger" data-action="takeHit">${t('hit.apply')}</button>
    </form>
    ${conditionsGrid(c, s, data, { tips })}
    ${tips ? html`<p class="hint">${t('body.boostsHint')}</p>
    <p class="hint">${t('body.locationRule', { n: data.body.locationAttack.tnPenalty })} ${rule.rows.join(' · ')}. ${t('body.crackRule')}</p>` : ''}
    <p class="hint">${t('body.wearing')}: ${c.play.worn.length ? c.play.worn.map((id) => nameOf(data.armor, id)).join(', ') : t('body.nothing')} — ${t('body.wearingNote')}</p>`;
  return card(t('body.title'), body, { sub: t('body.sub'), ref: 'conditions', tour: 'health' });
}

function weaponsCard(c, s, data) {
  const owned = c.play.inventory.filter((x) => x.kind === 'weapon');
  const options = (slot) => html`
    <select class="select" data-action="slot" data-slot="${slot}" aria-label="${t('weapons.slot')} ${slot}">
      <option value="">— ${t('weapons.empty')} —</option>
      ${owned.map((o) => html`<option value="${o.id}" ${c.play.slots[slot] === o.id ? raw('selected') : ''}>${nameOf(data.weapons, o.id)}</option>`)}
    </select>`;
  const body = html`
    <div class="weapon-grid">
      ${s.weapons.map((w) => html`
        <div class="weapon ${w.inHand ? 'weapon--in-hand' : ''}">
          <div class="spread"><span class="label">${t('weapons.slot')} ${w.slot}</span>${options(w.slot)}</div>
          ${w.empty ? html`<p class="muted">${owned.length ? t('weapons.pick') : t('weapons.none')}</p>` : html`
            <div class="spread"><div class="weapon__name">${w.name}</div>
              ${w.inHand ? html`<span class="pill pill--accent">${t('weapons.inHand')}</span>` : html`<button class="btn btn--sm" data-action="hand" data-slot="${w.slot}" title="${t('weapons.takeHint')}">${t('weapons.take')}</button>`}</div>
            ${w.note ? html`<p class="weapon__note">◆ ${w.note}</p>` : ''}
            <div class="weapon__stats">
              <button class="stat stat--button" data-action="check" data-kind="skill" data-id="${w.skill}" title="${t('weapons.rollAttack')}">
                <span class="label">${t('weapons.attackTn')}</span><span class="stat__value stat__value--accent">${temp(w.base, w.tn)}</span><span class="stat__sub">${w.zoneTn ? html`<span class="text-info">+${w.zoneTn} Cold</span> · ` : ''}${w.stanceTn ? html`<span class="text-danger">+${w.stanceTn} Attack</span> · ` : ''}${nameOf(data.skills.skills, w.skill)}</span>
              </button>
              <div class="stat"><span class="label">${t('attack.damage')}</span><span class="stat__value">${w.damage}</span><span class="stat__sub">+ OFF ${temp(s.combat.off.base, s.combat.off.value, signed)}${s.conditionMods.meleeDamage && !(w.range?.max > 1) ? ` +${s.conditionMods.meleeDamage}` : ''}</span></div>
              <div class="stat"><span class="label">${t('weapons.range')}</span><span class="stat__value">${w.range.max}m</span><span class="stat__sub">min ${w.range.min}m</span></div>
            </div>
            ${w.magSize ? html`<div class="ammo">
              <div class="ammo__row"><span class="label">${t('weapons.ammo')}</span>
                ${counter({ action: 'ammo', value: w.rounds, min: 0, max: w.magSize, args: { slot: w.slot }, label: t('weapons.ammo') })}
                <span class="mono muted">/ ${w.magSize}</span>
                <button class="btn btn--sm ammo__reload" data-action="reload" data-slot="${w.slot}" ${w.spares ? '' : raw('disabled')} title="${w.spares ? '' : t('weapons.noSpares')}">${t('weapons.reload')}</button></div>
              ${meter(w.rounds, w.magSize, 'info')}
              <div class="ammo__facts">${w.ammo ? html`<span class="pill">${w.ammo}</span>` : ''}
                <span class="pill ${w.spares ? '' : 'pill--danger'}">${t('weapons.spares', { n: w.spares })}</span>
                ${w.burst > 1 ? html`<span class="pill">${t('weapons.burst', { n: w.burst, left: w.attacksLeft })}</span>` : ''}</div>
            </div>` : ''}
            ${w.usable === false ? html`<p class="notice notice--warn">${t(`weapons.unusable.${w.why}`)}</p>` : ''}
            ${w.unarmed ? html`<p class="hint">${owned.length ? t('weapons.fistsHint') : t('weapons.none')}</p>` : html`<div class="cluster"><span class="pill">${w.type}</span>${w.hands === 2 ? html`<span class="pill">${t('weapons.twoHanded')}</span>` : ''}<span class="pill">${t('weapons.reliability')} ${w.reliability}/10</span><span class="pill">${w.rarity}</span></div>`}`}
        </div>`)}
    </div>`;
  return card(t('weapons.title'), body, { ref: 'weapon-tn', tour: 'weapons' });
}

/**
 * Decision 97: two rows — what can I do (Turn | class engine + talents, used every turn), then with what / my state
 * (Weapons, for equipping and reloading | health & conditions; decision 157 swapped engine and weapons). Phones stack them.
 */
export function playTab(c, s, data, ctx = {}) {
  return html`
    ${initiativeCard(c, s, data)}${rollAskCard(c, s, data)}${hitsCard(c, s, data)}${boonsCard(c, data)}
    <div class="sheet-grid sheet-grid--play">
      <div class="stack">${turnCard(c, s, data, ctx.combat, { tips: ctx.actionTips })}</div>
      <div class="stack">${engineCard(c, s, data, ctx.combat, { mapDark: ctx.mapDark ?? null })}${talentsCard(c, s, data)}</div>
    </div>
    <div class="sheet-grid sheet-grid--play">
      <div class="stack">${weaponsCard(c, s, data)}</div>
      <div class="stack">${healthCard(c, s, data, { tips: ctx.actionTips })}</div>
    </div>
    ${skillsTab(c, s, data)}`; // decision 164: Play and Skills are one Setup tab — scroll down for skills and attributes
}
