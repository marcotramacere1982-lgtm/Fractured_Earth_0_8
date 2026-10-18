// Dossier tab (identity, class, background, debt, portrait) and Notes tab (notes + action log).

import { html, raw } from '../dom.js';
import { card, nameOf } from './parts.js';
import { sanitizeHtml } from '../sanitize.js';
import { t } from '../../i18n/index.js';

export function dossierTab(c, s, data) {
  const subOptions = data.classes.classes.map((cls) => html`
    <optgroup label="${cls.name}">${cls.subclasses.map((sub) => html`
      <option value="${sub.id}" ${c.subclassId === sub.id ? raw('selected') : ''}>${sub.name} (${sub.stats.join('/')})</option>`)}</optgroup>`);
  const sub = s.class?.subclass;

  const identity = card(t('dossier.identity'), html`
    <div class="form-grid">
      <label class="field"><span class="label">${t('dossier.character')}</span><input class="input" value="${c.name}" data-action="field" data-path="name"></label>
      <label class="field"><span class="label">${t('dossier.player')}</span><input class="input" value="${c.player}" data-action="field" data-path="player"></label>
      <label class="field"><span class="label">${t('dossier.subclass')}</span>
        <select class="select" data-action="subclass"><option value="">— ${t('common.choose')} —</option>${subOptions}</select></label>
      <label class="field"><span class="label">${t('common.age')}</span><input class="input input--num" type="number" value="${c.age}" data-action="field" data-path="age" data-number="1"></label>
    </div>
    ${sub ? html`<p class="hint">${sub.desc}</p>` : ''}`);

  const portrait = card(t('dossier.visual'), html`
    <div class="portrait">
      ${c.portrait.dataUrl ? html`<img class="portrait__img" src="${c.portrait.dataUrl}" alt="${c.name}">` : html`<div class="portrait__empty">${t('dossier.noFeed')}</div>`}
      <div class="cluster">
        <label class="btn btn--sm">${t('dossier.upload')}<input type="file" accept="image/*" class="visually-hidden" data-action="portrait"></label>
        ${c.portrait.dataUrl ? html`<button class="btn btn--sm btn--ghost" data-action="portraitClear">${t('common.remove')}</button>` : ''}
      </div>
      <p class="hint">${t('dossier.imageHint')}</p>
    </div>`);

  const debt = data.debts.find((d) => d.id === c.debtId);
  const background = card(t('dossier.background'), html`
    <dl class="kv">
      <dt>${t('dossier.credentials')}</dt><dd>${c.credentials.length ? c.credentials.map((id) => nameOf(data.careers.credentials, id)).join(', ') : '—'}</dd>
      <dt>${t('dossier.record')}</dt><dd>${c.criminalRecord ? html`<span class="pill pill--danger">${t('dossier.criminal')}</span>` : t('dossier.clean')}</dd>
      <dt>${t('dossier.notable')}</dt><dd>${c.tags.length ? c.tags.join(' · ') : '—'}</dd>
      <dt>${t('dossier.adolescence')}</dt><dd>${c.history.adolescence.length ? c.history.adolescence.map((h) => {
        const e = data.adolescence.events.find((x) => x.id === h.eventId);
        return html`<details class="details details--inline"><summary>${e?.name ?? h.eventId}</summary><p>${e?.text}</p></details>`;
      }) : '—'}</dd>
      <dt>${t('dossier.career')}</dt><dd>${c.history.careers.length ? c.history.careers.map((h) => {
        const k = data.careers.careers.find((x) => x.id === h.careerId);
        return k ? `${k.category}${k.name !== 'Standard' ? ` — ${k.name}` : ''}` : h.careerId;
      }).join(' → ') : '—'}</dd>
    </dl>`);

  const motivator = card(t('dossier.debt'), html`
    <label class="field"><span class="label">${t('dossier.debtAnchor')}</span>
      <select class="select" data-action="field" data-path="debtId">
        <option value="">— ${t('common.none')} —</option>
        ${data.debts.map((d) => html`<option value="${d.id}" ${c.debtId === d.id ? raw('selected') : ''}>${d.name}</option>`)}
      </select></label>
    ${debt ? html`<p>${debt.debt}</p><p class="hint"><strong>${t('dossier.threat')}:</strong> ${debt.threat}</p>` : ''}`);

  const story = card(t('dossier.backstory'), html`
    ${c.narrative.backstoryHtml ? html`<div class="prose">${raw(sanitizeHtml(c.narrative.backstoryHtml))}</div>` : html`<p class="muted">${t('dossier.noBackstory')}</p>`}
    <details class="details" data-keep="backstory"><summary>${t('dossier.editBackstory')}</summary>
      <textarea class="textarea" data-action="field" data-path="narrative.backstoryHtml" placeholder="${t('dossier.backstoryPlaceholder')}">${c.narrative.backstoryHtml}</textarea>
    </details>`);

  return html`
    <div class="sheet-grid sheet-grid--dossier">
      <div class="stack dossier__info">${identity}${background}${motivator}</div>
      <div class="stack dossier__story">${story}</div>
      <div class="stack dossier__photo">${portrait}</div>
    </div>`;
}

export function notesTab(c) {
  const logRows = (c.play.log ?? []).map((l) => html`<div class="log__row log__row--${l.kind}"><span class="mono muted">${new Date(l.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span><span>${l.text}</span></div>`);
  return html`
    <div class="sheet-grid">
      ${card(t('notes.title'), html`<textarea class="textarea textarea--tall" data-action="notes" placeholder="${t('notes.placeholder')}">${c.play.notes}</textarea>
        <p class="hint">${t('notes.saved')}</p>`)}
      ${card(t('notes.log'), logRows.length ? html`<div class="log">${logRows}</div>` : html`<p class="muted">${t('notes.logEmpty')}</p>`)}
    </div>`;
}
