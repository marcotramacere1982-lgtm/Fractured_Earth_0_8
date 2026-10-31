// Dossier tab (identity, class, background, debt, portrait) and Notes & maps tab (notes, maps we've seen, action log).

import { intelCard } from './intel.js';
import { html, raw } from '../dom.js';
import { card, nameOf } from './parts.js';
import { sanitizeHtml } from '../sanitize.js';
import { debtPressure, timelineCard } from './timeline.js';
import { driveEditor } from './drive.js';
import { t } from '../../i18n/index.js';
import { storyPrompt, portraitPrompt } from '../builder/prompts.js';
import { lookFields } from '../look.js';
import { portraitImg, frameOf, isFramed, FRAME } from '../portrait.js';
import { explain } from '../explain.js';
import { memoriesCard } from './map-memories.js';

/** ctx.atTable: served by the GM's table server, so the backstory can be asked from the GM (decision 50). */
/** Decision 96: zoom, position and brightness; drag the photo to move it. */
function frameControls(portrait) {
  const f = frameOf(portrait);
  const range = (k, step, label) => html`<label class="frame-ctl"><span class="label">${label}</span>
    <input type="range" min="${FRAME[k][0]}" max="${FRAME[k][1]}" step="${step}" value="${f[k]}" data-action="portraitFrame" data-key="${k}"></label>`;
  return html`<details class="details" data-keep="portrait-frame"><summary>${t('dossier.frame')}</summary>
    <div class="frame-ctls">
      ${range('zoom', 0.05, t('dossier.frameZoom'))}
      ${range('x', 1, t('dossier.frameX'))}
      ${range('y', 1, t('dossier.frameY'))}
      ${range('light', 0.05, t('dossier.frameLight'))}
    </div>
    <div class="spread"><span class="hint">${t('dossier.frameHint')}</span>${isFramed(portrait) ? html`<button class="btn btn--sm btn--ghost" data-action="portraitReset">${t('dossier.frameReset')}</button>` : ''}</div>
  </details>`;
}

export function dossierTab(c, s, data, ctx = {}) {
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
    <p class="muted"><span class="label">${t('stat.travel')}${explain('combat', 'met', t('stat.travel'))}</span> ${t('stat.travelValue', { n: s.combat.met.value })}</p>
    ${sub ? html`<p class="hint">${sub.desc}</p>` : ''}
    ${driveEditor(c, data, 'sheet')}`);

  const portrait = card(t('dossier.visual'), html`
    <div class="portrait">
      ${c.portrait.dataUrl ? portraitImg(c.portrait, 'portrait__img', c.name, 'data-frame-drag="1"') : html`<div class="portrait__empty">${t('dossier.noFeed')}</div>`}
      <div class="cluster">
        <label class="btn btn--sm">${t('dossier.upload')}<input type="file" accept="image/*" class="visually-hidden" data-action="portrait"></label>
        ${c.portrait.dataUrl ? html`<button class="btn btn--sm btn--ghost" data-action="portraitClear">${t('common.remove')}</button>` : ''}
      </div>
      ${c.portrait.dataUrl ? frameControls(c.portrait) : ''}
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
    ${debt ? html`<p>${debt.debt}</p><p class="hint"><strong>${t('dossier.threat')}:</strong> ${debt.threat}</p>` : ''}
    ${debtPressure(c, data)}`);

  const has = Boolean(c.narrative.backstoryHtml?.trim());
  const asked = c.narrative.backstoryRequest;
  const story = card(t('dossier.backstory'), html`
    ${asked ? html`<p class="notice" role="status">${t('dossier.waiting', { date: new Date(asked.at).toLocaleDateString() })}</p>` : ''}
    ${has ? html`<div class="prose">${raw(sanitizeHtml(c.narrative.backstoryHtml))}</div>` : html`<p class="muted">${t('dossier.noBackstory')}</p>`}
    <div class="cluster">
      ${ctx.atTable ? html`<button class="btn btn--sm ${has ? '' : 'btn--primary'}" data-action="askBackstory" title="${t('dossier.askHint')}">${t(has ? 'dossier.askGmRevise' : 'dossier.askGm')}</button>` : ''}
      ${c.narrative.backstoryPrevious ? html`<button class="btn btn--sm btn--ghost" data-action="backstoryUndo">${t('dossier.undoBackstory')}</button>` : ''}
    </div>
    <details class="details" data-keep="own-ai"><summary>${t('dossier.ownAi')}</summary>
      <div class="spread"><span class="hint">${t('dossier.ownAiHint')}</span><button class="btn btn--sm" data-action="copyPrompt" data-target="dossier-prompt">${t('common.copy')}</button></div>
      <textarea class="textarea mono b-prompt" id="dossier-prompt" readonly>${storyPrompt(c, data)}</textarea>
      <div class="spread"><span class="label">${t('builder.portraitPrompt')}</span><button class="btn btn--sm" data-action="copyPrompt" data-target="dossier-portrait">${t('common.copy')}</button></div>
      <textarea class="textarea mono b-prompt b-prompt--short" id="dossier-portrait" readonly>${portraitPrompt(c, data)}</textarea>
    </details>
    <details class="details" data-keep="backstory"><summary>${t('dossier.editBackstory')}</summary>
      <textarea class="textarea" data-action="field" data-path="narrative.backstoryHtml" placeholder="${t('dossier.backstoryPlaceholder')}">${c.narrative.backstoryHtml}</textarea>
    </details>`, { tour: 'story' });

  return html`
    <div class="sheet-grid sheet-grid--dossier">
      <div class="stack dossier__info">${identity}${background}${motivator}${intelCard(c, s, data, ctx)}</div>
      <div class="stack dossier__story">${story}${timelineCard(c)}</div>
      <div class="stack dossier__photo">${portrait}${card(t('look.title'), lookFields(c.narrative.look ?? {}), { tour: 'look' })}</div>
    </div>`;
}

export function notesTab(c, _s, data) {
  const logRows = (c.play.log ?? []).map((l) => html`<div class="log__row log__row--${l.kind}"><span class="mono muted">${new Date(l.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span><span>${l.text}</span></div>`);
  return html`
    <div class="sheet-grid">
      ${card(t('notes.title'), html`<textarea class="textarea textarea--tall" data-action="notes" placeholder="${t('notes.placeholder')}">${c.play.notes}</textarea>
        <p class="hint">${t('notes.saved')}</p>`)}
      ${memoriesCard(c, data)}
      ${card(t('notes.log'), logRows.length ? html`<div class="log">${logRows}</div>` : html`<p class="muted">${t('notes.logEmpty')}</p>`)}
    </div>`;
}
