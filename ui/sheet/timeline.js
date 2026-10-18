// Downtime on the sheet (decision 46): the report card shown when the GM's downtime arrives, the debt
// pressure track with its instalment, and the "Story so far" timeline on the Dossier.

import { html, raw } from '../dom.js';
import { card } from './parts.js';
import { t } from '../../i18n/index.js';
import { inline } from '../manual/markdown.js';
import { stageOf } from '../../rules/downtime.js';

const md = (s) => raw(inline(s ?? ''));
const date = (ms) => new Date(ms).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });

/** One event: title, text, the options as suggestions (nothing is applied). */
export function eventBlock(e, { open = true } = {}) {
  if (!e) return '';
  return html`<div class="dt-event">
    <div class="dt-event__title">${e.title}</div>
    <p class="dt-event__text">${md(e.text)}</p>
    ${e.options?.length ? html`<details class="details" ${open ? raw('open') : ''}><summary>${t('downtime.options')}</summary>
      <ul class="dt-event__options">${e.options.map((o) => html`<li>${md(o)}</li>`)}</ul></details>` : ''}
  </div>`;
}

/** The body of the downtime report in the message area. */
export function downtimeReport(m) {
  const d = m.downtime;
  return html`
    ${eventBlock(d.event)}
    ${d.crew ? html`<span class="label">${t('downtime.crew')}</span>${eventBlock(d.crew)}` : ''}
    <ul class="dt-report">
      <li>${t('downtime.healed')}${d.treated ? ` ${t('downtime.treated', { n: d.treated })}` : ''}</li>
      ${d.upkeep ? html`<li>${t('downtime.upkeep', { cr: d.upkeep.cr, crs: d.upkeep.crs })}</li>` : ''}
      ${d.stage ? html`<li>${t('downtime.pressure', { n: d.pressure, stage: d.stage, cr: d.instalment })}</li>` : ''}
    </ul>
    <p class="transmission__hint">${t('downtime.choiceHint')}</p>`;
}

/** Dossier: the debt's pressure track and the optional instalment. */
export function debtPressure(c, data) {
  if (!c.debtId) return '';
  const p = c.downtime?.pressure ?? 0;
  const stage = stageOf(p, data);
  return html`<div class="dt-pressure">
    <span class="label">${t('downtime.pressureLabel')}</span>
    <span class="dt-pressure__track" role="img" aria-label="${t('downtime.pressureAria', { n: p, max: data.downtime.debt.max })}">
      ${data.downtime.debt.stages.map((s) => html`<span class="dt-pressure__step ${s.id <= p ? 'is-on' : ''}" title="${s.name}">${s.name}</span>`)}</span>
    ${stage ? html`<button class="btn btn--sm" data-action="payInstalment" title="${t('downtime.payHint')}">${t('downtime.pay', { cr: stage.instalment })}</button>` : html`<span class="muted">${t('downtime.calm')}</span>`}
  </div>`;
}

/** Dossier: every downtime event this character lived through, newest first. */
export function timelineCard(c) {
  const list = [...(c.downtime?.timeline ?? [])].reverse();
  if (!list.length) return '';
  return card(t('downtime.timeline'), html`<ol class="dt-timeline">${list.map((e) => html`<li class="dt-timeline__item">
    <span class="mono muted">${date(e.t)}${e.kind === 'crew' ? ` · ${t('downtime.crew')}` : ''}</span>
    ${eventBlock(e, { open: false })}</li>`)}</ol>`, { sub: t('downtime.timelineSub'), ref: 'downtime' });
}
