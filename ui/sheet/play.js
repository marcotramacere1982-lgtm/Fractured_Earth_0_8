// Status bar + Play tab (health, body, weapons, conditions, combat values, class engine).

import { html, raw, signed } from '../dom.js';
import { counter, meter, card, segmented, nameOf, pips } from './parts.js';
import { engineCard } from './engine.js';
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
      ${c.play.conditions.length ? html`<div class="cluster">${c.play.conditions.map((id) => html`<span class="pill pill--danger">${nameOf(data.conditions, id)}</span>`)}</div>` : ''}
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

function healthCard(c, s, data) {
  const body = html`
    ${deathNotice(c, s)}
    <div class="spread spread--wrap">
      <div class="cluster">
        <span class="label">${t('body.cover')}${info('cover', t('body.cover'))}</span>
        ${segmented('cover', data.difficulty.cover.map((x) => ({ value: x.armor, label: x.armor ? `${x.name.split(' ')[0]} +${x.armor}` : t('body.coverNone') })), c.play.cover)}
      </div>
      <div class="cluster">
        ${s.locations.some((l) => l.armor < l.armorMax) ? html`<button class="btn btn--sm" data-action="repairArmor" title="${t('body.repairHint')}">${t('body.repair')}</button>` : ''}
        <button class="btn btn--sm" data-action="heal">${t('body.heal')}</button>
      </div>
    </div>
    <div class="body-map">
      ${s.locations.map((l) => html`
        <div class="body-loc body-loc--${l.id} ${l.current <= 0 ? (l.vital ? 'body-loc--dead' : 'body-loc--lost') : ''}">
          <div class="body-loc__head">
            <span class="body-loc__name">${l.name}${l.vital ? html`<span class="body-loc__vital" title="${t('body.vital')}">●</span>` : ''}</span>
            <span class="mono body-loc__nums"><span class="text-danger">${l.current}/${l.max}</span>${l.armorMax ? html` · <span class="text-info">${l.armor}/${l.armorMax}</span>` : ''}${l.cover ? html` · <span class="muted">+${l.cover} ${t('body.coverShort')}</span>` : ''}</span>
          </div>
          ${pips({ kind: 'hp', value: l.current, max: l.max, args: { loc: l.id, field: 'hp' }, label: `${l.name} HP` })}
          ${pips({ kind: 'armor', value: l.armor, max: l.armorMax, args: { loc: l.id, field: 'armor' }, label: `${l.name} ${t('stat.armor')}` })}
        </div>`)}
    </div>
    <p class="hint body-legend"><span class="pip is-filled pip--legend-hp"></span> HP · <span class="pip is-filled pip--legend-armor"></span> ${t('body.legend')}
      ${c.play.cover ? t('body.coverAll', { n: c.play.cover }) : ''}
      ${t('body.wearing')}: ${c.play.worn.length ? c.play.worn.map((id) => nameOf(data.armor, id)).join(', ') : t('body.nothing')} — ${t('body.wearingNote')}</p>
    <p class="hint">${t('body.locationShots')}: d20 → ${data.body.hitLocation.table.map((r) => `${r.min}–${r.max} ${[...new Set(r.locations.map((id) => t(`body.part.${data.body.locations.find((l) => l.id === id)?.bp}`)))].join('/')}`).join(' · ')}. ${t('body.aim')}${info('hit-location', t('body.locationShots'))}</p>`;
  return card(t('body.title'), body, { sub: t('body.sub'), ref: 'body' });
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
            <div class="cluster"><span class="pill">${w.type}</span><span class="pill">${t('weapons.reliability')} ${w.reliability}/10</span><span class="pill">${w.rarity}</span></div>`}
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

function conditionsCard(c, data) {
  const body = html`<div class="cond-grid">
    ${data.conditions.map((k) => {
      const on = c.play.conditions.includes(k.id);
      return html`<button class="cond ${on ? 'cond--on' : ''}" data-action="condition" data-id="${k.id}" aria-pressed="${on}">
        <span class="cond__name">${k.name}</span>
        <span class="cond__fx">${k.effects[0]}</span>
      </button>`;
    })}
  </div>`;
  return card(t('conditions.title'), body, { ref: 'conditions' });
}

export function playTab(c, s, data, ctx = {}) {
  return html`
    ${turnCard(c, s, data, ctx.combat)}
    <div class="sheet-grid sheet-grid--play">
      <div class="stack">${weaponsCard(c, s, data)}${engineCard(c, s, data)}</div>
      <div class="stack">${healthCard(c, s, data)}${combatCard(s, data)}${conditionsCard(c, data)}</div>
    </div>`;
}
