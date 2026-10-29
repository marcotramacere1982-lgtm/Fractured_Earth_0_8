// Progress tab: level and XP, what level-up gives right now, and the talent trees (decision 44).
// Also the Talents card on the Play tab (what you have, with Use buttons for once-per talents).

import { html, raw } from '../dom.js';
import { card, meter } from './parts.js';

import { t } from '../../i18n/index.js';
import { talentStatus, treesFor } from '../../rules/progress.js';

const subName = (data, id) => data.classes.classes.flatMap((c) => c.subclasses).find((s) => s.id === id)?.name ?? id;

function why(st, data) {
  const v = { ...st.vars };
  if (st.code === 'wrongBranch') v.branch = subName(data, v.branch);
  return t(`progress.why.${st.code}`, v);
}

function talentTile(c, talent, data) {
  const st = talentStatus(c, talent, data);
  const needs = Object.entries(talent.needs ?? {}).map(([k, n]) => `${k} ${n}`);
  return html`<div class="talent ${st.owned ? 'talent--owned' : st.ok ? 'talent--ready' : 'talent--locked'}">
    <div class="spread">
      <span class="talent__name">${st.owned ? '✓ ' : ''}${talent.name}</span>
      <span class="cluster">
        ${talent.branch ? html`<span class="pill">${subName(data, talent.branch)}</span>` : ''}
        ${needs.length ? html`<span class="pill">${needs.join(' · ')}</span>` : ''}
        <span class="pill ${talent.kind === 'auto' ? 'pill--info' : ''}" title="${t(`progress.kind.${talent.kind}Hint`)}">${t(`progress.kind.${talent.kind}`)}</span>
      </span>
    </div>
    <p class="talent__desc">${talent.desc}</p>
    ${st.owned ? html`<p class="hint">${st.gift ? t('progress.gifted') : t('progress.owned')}</p>`
      : st.ok ? html`<button class="btn btn--sm btn--primary" data-action="buyTalent" data-id="${talent.id}">${t('progress.take')}</button>`
      : html`<p class="hint">🔒 ${why(st, data)}</p>`}
  </div>`;
}

function levelCard(c, s, data) {
  const p = s.progress;
  const pending = p.talentPoints.left || p.attributePoints.left;
  const attrs = data.attributes.attributes.filter((a) => a.id !== 'CRS');
  const body = html`
    <div class="spread spread--wrap">
      <div class="level-badge"><span class="label">${t('progress.level')}</span><span class="level-badge__n">${p.level}</span></div>
      <div class="stack stack--tight level-xp">
        <span class="label">XP ${p.xp}${p.maxed ? '' : html` · ${t('progress.next', { n: p.nextAt })}`}</span>
        ${p.maxed ? html`<span class="muted">${t('progress.maxed')}</span>` : meter(p.into, p.per, 'info')}
      </div>
      <div class="cluster">
        <span class="pill">${t('progress.talentPoints', { n: p.talentPoints.left })}</span>
        <span class="pill">${t('progress.attributePoints', { n: p.attributePoints.left })}</span>
        ${p.abilitySlots ? html`<span class="pill pill--info">${t('progress.slots', { n: p.abilitySlots })}</span>` : ''}
      </div>
    </div>
    ${p.open ? html`<p class="notice notice--ok">${t('progress.openNotice')}</p>`
      : pending ? html`<p class="notice">${t('progress.readyNotice')}</p>` : ''}
    ${p.open && p.attributePoints.left ? html`<div class="stack stack--tight">
      <span class="label">${t('progress.raise')}</span>
      <div class="cluster">${attrs.map((a) => html`<button class="btn btn--sm" data-action="raiseAttribute" data-key="${a.id}" title="${a.name}">${a.id} ${c.attributes[a.id]} → ${c.attributes[a.id] + 1}</button>`)}</div>
    </div>` : ''}
    <p class="hint">${t('progress.rules')}</p>`;
  return card(t('progress.title'), body, { ref: 'progress' });
}

/** The Progress tab. */
export function progressTab(c, s, data) {
  const trees = treesFor(c, data).map((tree) => {
    const list = data.talents.filter((x) => x.tree === tree.id);
    const tiers = [1, 2, 3].map((tier) => ({ tier, list: list.filter((x) => x.tier === tier) })).filter((x) => x.list.length);
    return card(tree.name, html`${tiers.map(({ tier, list: ts }) => html`
      <div class="talent-tier"><span class="label">${t('progress.tier', { n: tier })}${data.progress.tiers[String(tier)] ? ` · ${t('progress.tierGate', { n: data.progress.tiers[String(tier)].level })}` : ''}</span>
        <div class="talent-grid">${ts.map((x) => talentTile(c, x, data))}</div></div>`)}`,
      { sub: tree.kind === 'class' ? t('progress.classTree') : t('progress.generalTree') });
  });
  return html`<div class="stack">${levelCard(c, s, data)}<div class="sheet-grid">${trees}</div></div>`;
}

/** Play tab: the talents you have; once-per ones get a Use button (reset each round / combat / mission). */
export function talentsCard(c, s, data) {
  const owned = s.progress?.owned.map((id) => data.talents.find((x) => x.id === id)).filter(Boolean) ?? [];
  if (!owned.length) return '';
  const used = c.play.talentUses ?? {};
  const body = html`<ul class="talent-list">${owned.map((x) => html`<li class="talent-list__item">
    <div><strong>${x.name}</strong> <span class="muted">${x.desc}</span></div>
    ${x.use && !x.passive ? html`<button class="btn btn--sm" data-action="useTalent" data-id="${x.id}" ${used[x.id] ? raw('disabled') : ''} title="${t(`progress.use.${x.use}`)}">${used[x.id] ? t('progress.used') : t('progress.useBtn')}</button>` : ''}
  </li>`)}</ul>`;
  return card(t('progress.talentsCard'), body, { sub: t('progress.talentsSub'), ref: 'talents' });
}

