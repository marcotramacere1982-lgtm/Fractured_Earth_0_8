// Status bar + Play tab (health, body, weapons, conditions, combat values, class engine).

import { html, raw, signed } from '../dom.js';
import { counter, meter, card, segmented, nameOf } from './parts.js';
import { engineCard } from './engine.js';
import { talentsCard } from './progress.js';
import { turnCard } from './turn.js';
import { info } from '../ref.js';
import { explain, hint } from '../explain.js';
import { t } from '../../i18n/index.js';

export function statusBar(c, s, data) {
  const hpKind = s.hp.current <= 0 ? 'danger' : s.hp.current <= s.hp.max / 3 ? 'danger' : 'success';
  return html`
    <div class="sheet-status">
      <div class="sheet-status__id">
        ${c.portrait.dataUrl ? html`<img class="avatar avatar--sm" src="${c.portrait.dataUrl}" alt="">` : ''}
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
        <div class="stat"><span class="label">${t('stat.armor')}${info('armor', t('stat.armor'))}</span><span class="stat__value stat__value--info">${s.armor.general}</span></div>
        <div class="stat"><span class="label">${t('stat.init')}${explain('initiative', '', t('explain.feeds.initiative'))}</span><span class="stat__value">${signed(s.initiative)}</span></div>
        <div class="stat"><span class="label">${t('stat.actions')}${explain('combat', 'act', t('stat.actions'))}</span><span class="stat__value">${s.combat.act.value}</span></div>
        ${s.class ? html`<div class="stat"><span class="label">Class TN${explain('class-tn', '', 'Class TN')}</span><span class="stat__value stat__value--accent">${s.class.tn}</span></div>` : ''}
        <div class="stat"><span class="label">CRS${info('credit-score', 'Credit Score')}</span><span class="stat__value">${c.attributes.CRS}</span></div>
        <div class="stat"><span class="label">${t('stat.cash')}</span><span class="stat__value stat__value--success">$${c.play.cash}</span></div>
      </div>
      ${c.play.conditions.length || s.injured.locations.length ? html`<div class="cluster">${c.play.conditions.map((id) => html`<span class="pill pill--danger">${nameOf(data.conditions, id)}</span>`)}${s.injured.locations.map((id) => {
        const loc = data.body.locations.find((l) => l.id === id);
        return html`<span class="pill pill--danger">${data.conditions.find((k) => k.limb === loc?.bp)?.name} · ${loc?.name}</span>`;
      })}</div>` : ''}
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

function healthCard(c, s, data) {
  const conds = data.conditions.filter((k) => !k.enemyOnly);
  const sides = (bp) => data.body.locations.filter((l) => l.bp === bp);
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
    <div class="cond-grid">
      ${conds.map((k) => {
        if (k.limb) {
          const hurt = sides(k.limb).filter((l) => s.injured.locations.includes(l.id));
          return html`<div class="cond ${hurt.length ? 'cond--on' : ''}">
            <span class="cond__name">${k.name}${hurt.length === 2 ? ' ×2' : ''}</span>
            <span class="cond__fx">${hurt.length === 2 ? k.effects[1] : k.effects[0]}</span>
            <span class="cluster">${sides(k.limb).map((l) => html`<button class="btn btn--sm ${s.injured.locations.includes(l.id) ? 'btn--danger' : ''}" data-action="injury" data-loc="${l.id}" aria-pressed="${s.injured.locations.includes(l.id)}" title="${k.clear}">${l.name}</button>`)}</span>
          </div>`;
        }
        const on = c.play.conditions.includes(k.id);
        return html`<button class="cond ${on ? 'cond--on' : ''}" data-action="condition" data-id="${k.id}" aria-pressed="${on}" title="${k.clear ?? ''}">
          <span class="cond__name">${k.name}</span>
          <span class="cond__fx">${k.effects[0]}</span>
        </button>`;
      })}
    </div>
    <p class="hint">${t('body.locationRule', { n: data.body.locationAttack.tnPenalty })} ${rule.rows.join(' · ')}. ${t('body.crackRule')}</p>
    <p class="hint">${t('body.wearing')}: ${c.play.worn.length ? c.play.worn.map((id) => nameOf(data.armor, id)).join(', ') : t('body.nothing')} — ${t('body.wearingNote')}</p>`;
  return card(t('body.title'), body, { sub: t('body.sub'), ref: 'conditions' });
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
        <div class="weapon">
          <div class="spread"><span class="label">${t('weapons.slot')} ${w.slot}</span>${options(w.slot)}</div>
          ${w.empty ? html`<p class="muted">${owned.length ? t('weapons.pick') : t('weapons.none')}</p>` : html`
            <div class="weapon__name">${w.name}</div>
            <div class="weapon__stats">
              <button class="stat stat--button" data-action="check" data-kind="skill" data-id="${w.skill}" title="${t('weapons.rollAttack')}">
                <span class="label">${t('weapons.attackTn')}</span><span class="stat__value stat__value--accent">${w.tn}</span><span class="stat__sub">${w.zoneTn ? html`<span class="text-info">+${w.zoneTn} Cold</span> · ` : ''}${nameOf(data.skills.skills, w.skill)}</span>
              </button>
              <div class="stat"><span class="label">${t('attack.damage')}</span><span class="stat__value">${w.damage}</span><span class="stat__sub">+ OFF ${signed(s.combat.off.value)}</span></div>
              <div class="stat"><span class="label">${t('weapons.range')}</span><span class="stat__value">${w.range.max}m</span><span class="stat__sub">min ${w.range.min}m</span></div>
            </div>
            ${w.magSize ? html`<div class="spread">
              <div class="cluster"><span class="label">${t('weapons.ammo')}</span>${counter({ action: 'ammo', value: w.rounds, min: 0, max: w.magSize, args: { slot: w.slot }, label: t('weapons.ammo') })}<span class="mono muted">/${w.magSize} · ${w.ammo ?? ''}</span></div>
              <button class="btn btn--sm" data-action="reload" data-slot="${w.slot}">${t('weapons.reload')}</button>
            </div>${meter(w.rounds, w.magSize, 'info')}` : ''}
            ${w.usable === false ? html`<p class="notice notice--warn">${t(`weapons.unusable.${w.why}`)}</p>` : ''}
            <div class="cluster"><span class="pill">${w.type}</span>${w.hands === 2 ? html`<span class="pill">${t('weapons.twoHanded')}</span>` : ''}<span class="pill">${t('weapons.reliability')} ${w.reliability}/10</span><span class="pill">${w.rarity}</span></div>`}
        </div>`)}
    </div>`;
  return card(t('weapons.title'), body, { ref: 'weapon-tn' });
}

function combatCard(s, data) {
  const body = html`
    <div class="derived-grid">
      ${data.combat.derived.map((d) => html`
        <div class="stat" ${hint('combat', d.id)}>
          <span class="label">${d.name}${explain('combat', d.id, d.name)}</span>
          <span class="stat__value">${d.id === 'off' ? signed(s.combat[d.id].value) : s.combat[d.id].value}</span>
          <span class="stat__sub">${d.stats.join('+')} ${s.combat[d.id].sum}</span>
        </div>`)}
      <div class="stat" ${hint('initiative')}><span class="label">${t('explain.feeds.initiative')}${explain('initiative', '', t('explain.feeds.initiative'))}</span><span class="stat__value">${signed(s.initiative)}</span><span class="stat__sub">${t('combat.initRoll')}</span></div>
    </div>
    <p class="hint">${t('combat.footer', { off: signed(s.combat.off.value) })}</p>`;
  return card(t('combat.title'), body, { ref: 'combat-values' });
}

export function playTab(c, s, data, ctx = {}) {
  return html`
    ${turnCard(c, s, data, ctx.combat)}
    <div class="sheet-grid sheet-grid--play">
      <div class="stack">${weaponsCard(c, s, data)}${engineCard(c, s, data)}${talentsCard(c, s, data)}</div>
      <div class="stack">${healthCard(c, s, data)}${combatCard(s, data)}</div>
    </div>`;
}
