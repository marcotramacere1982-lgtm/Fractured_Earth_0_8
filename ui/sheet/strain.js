// Strain on the sheet (decision 266): the windows in the middle of the screen — a gain to answer (steady yourself with
// a Mental Strength roll, or take it), the breaking point (a d6, a Scar a second d6, rolled or typed) and what it did —
// and the Strain line beside HP. Numbers come from rules/strain.js.

import { html, raw } from '../dom.js';
import { t } from '../../i18n/index.js';
import { addStrain, steadied, bandOf } from '../../rules/strain.js';
import { info } from '../ref.js';
import { meter } from './parts.js';

const box = (title, body, foot) => html`<div class="loadout" role="dialog" aria-modal="true" aria-labelledby="strain-title">
  <div class="loadout__box loadout__box--fight hit-box strain-box">
    <header class="loadout__head"><h2 id="strain-title" class="loadout__title">${title}</h2></header>
    <div class="loadout__body hit-box__body">${body}</div>
    <footer class="loadout__foot hit-box__foot">${foot}</footer></div></div>`;

const dieRow = (action, die) => html`<div class="cluster strain-die">
  <button class="btn btn--primary" data-action="${action}" data-mode="roll">🎲 ${t('strain.roll', { die })}</button>
  <span class="muted">${t('init.or')}</span>
  <input class="input input--num" type="number" min="1" max="6" inputmode="numeric" aria-label="${t('strain.typed')}" placeholder="${die}" data-strain-typed>
  <button class="btn" data-action="${action}" data-mode="typed">${t('init.send')}</button></div>`;

/** The window that needs an answer now, or ''. */
export function strainOverlay(c, s, data) {
  const d = data.strain;
  if (!d) return '';
  const br = c.play.breaking;
  if (br?.step === 'roll') return box(`💥 ${t('strain.breaking')}`, html`<p class="loadout__lead">${t('strain.breakingLead')}</p>
    <ol class="strain-table">${d.breaking.results.map((r) => html`<li><span class="mono">${r.roll}</span> ${t(`strain.result.${r.id}`)}</li>`)}</ol>`, dieRow('breakRoll', d.breaking.die));
  if (br?.step === 'scar') return box(`💥 ${t('strain.scarTitle')}`, html`<p class="loadout__lead">${t('strain.scarLead')}</p>
    <ol class="strain-table">${d.scars.list.map((r) => html`<li><span class="mono">${r.roll}</span> ${t(`strain.scar.${r.id}`)}</li>`)}</ol>`, dieRow('scarRoll', d.scars.die));
  if (c.play.lastBreak) return box(`💥 ${t('strain.breaking')}`, html`<p class="hit-box__big is-hurt">${c.play.lastBreak.id === 'scar' ? t(`strain.scar.${(c.play.scars ?? []).at(-1)?.id}`) : t(`strain.result.${c.play.lastBreak.id}`)}</p>
    <p class="hint">${t('strain.after', { n: d.afterBreak })}</p>`, html`<button class="btn btn--primary hit-box__btn" data-action="breakSeen"><strong>${t('common.done')}</strong></button>`);
  const a = (c.play.strainAsks ?? [])[0];
  if (!a) return '';
  const full = addStrain(c.play.strain, a.n, d);
  const half = addStrain(c.play.strain, steadied(a.n), d);
  const asks = c.play.strainAsks.length;
  return box(html`🧠 ${t('strain.title', { n: a.n })}${asks > 1 ? html` <small class="hit-box__count">${t('hit.of', { n: 1, total: asks })}</small>` : ''}`,
    html`<p class="loadout__lead">${a.why}</p>
      <p class="hit-box__big ${full.worse ? 'is-hurt' : ''}">${t('strain.toBand', { value: full.value, max: d.max, band: t(`strain.band.${full.to.id}`) })}</p>
      ${full.broke ? html`<p class="notice notice--danger">${t('strain.wouldBreak')}</p>` : ''}
      <p class="hint">${t('strain.steadyHint', { n: steadied(a.n), band: t(`strain.band.${half.to.id}`) })}</p>`,
    html`<button class="btn hit-box__btn" data-action="strainSteady" data-id="${a.id}"><strong>🎲 ${t('strain.steady')}</strong><span class="st-small">${t('strain.steadySub', { n: steadied(a.n) })}</span></button>
      <button class="btn btn--danger hit-box__btn" data-action="strainTake" data-id="${a.id}"><strong>${t('strain.take')}</strong><span class="st-small">+${a.n}</span></button>`);
}

/** The Strain line in the status bar: n / max, the band, − / + to fix it, Steady a crewmate. */
export function strainStat(c, s, data, { atTable = false } = {}) {
  const d = data.strain;
  if (!d) return '';
  const v = s.strain.value;
  const band = s.strain.band ?? bandOf(v, d);
  const kind = band.id === 'steady' ? 'info' : band.id === 'shaken' ? 'warning' : 'danger';
  return html`<div class="stat stat--strain">
    <span class="label">${t('strain.label')}${info('strain', t('strain.label'))}</span>
    <div class="cluster"><button class="btn btn--sm btn--ghost" data-action="strainHand" data-delta="-1" aria-label="${t('strain.less')}" ${v ? '' : raw('disabled')}>−</button>
      <span class="stat__value mono">${v}</span><span class="mono muted">/ ${d.max}</span>
      <button class="btn btn--sm btn--ghost" data-action="strainHand" data-delta="1" aria-label="${t('strain.more')}">+</button></div>
    ${meter(v, d.max, kind)}
    <span class="cluster"><span class="pill ${band.id === 'steady' ? '' : kind === 'warning' ? 'pill--warning' : 'pill--danger'}">${t(`strain.band.${band.id}`)}${band.tn ? ` ${band.tn}` : ''}</span>
      ${atTable ? html`<button class="btn btn--sm btn--ghost" data-action="steadyCrew" title="${t('strain.steadyCrewHint')}">${t('strain.steadyCrew')}</button>
        <button class="btn btn--sm btn--ghost" data-action="helpCrew" title="${t('help.crewHint')}">🤝 ${t('help.crew')}</button>` : ''}</span>
    ${c.play.help ? html`<span class="pill ${c.play.help.tn > 0 ? 'pill--success' : 'pill--danger'}" title="${t('help.from', { from: c.play.help.from, skill: c.play.help.skill })}">🤝 ${t('help.chip', { n: `${c.play.help.tn > 0 ? '+' : ''}${c.play.help.tn}` })}</span>` : ''}
    ${(c.play.scars ?? []).length ? html`<details class="strain-scars"><summary class="muted st-small">${t('strain.scars', { n: c.play.scars.length })}</summary><ul>${c.play.scars.map((x) => html`<li>${t(`strain.scar.${x.id}`)}</li>`)}</ul></details>` : ''}
  </div>`;
}
