// The Case tab (decisions 278–279): per mission (and General) the dossier the GM feeds — objectives, what everyone was
// sent, people and places — and the crew's board: one editor at a time (they pass the pen), everyone else reads and
// suggests. Shown only at a table. The board is drawn by ui/case/board.js; the clicks live in case-handlers.js.

import { html } from '../dom.js';
import { card } from './parts.js';
import { info } from '../ref.js';
import { t } from '../../i18n/index.js';
import { boardSvg, ICON } from '../case/board.js';
import { board as boardOf, GENERAL } from '../../rules/case-board.js';

/** What this tab remembers on this device. */
export const caseUi = { board: null, view: 'dossier', selected: null, mode: null, zoom: 1 };
export const currentBoard = (cs) => (caseUi.board && (caseUi.board === GENERAL || cs?.missions.some((m) => m.id === caseUi.board)) ? caseUi.board : cs?.active ?? GENERAL);

const STATUS = { success: 'case.obj.done', fail: 'case.obj.failed', na: 'case.obj.na' };

export function caseTab(c, _s, data, ctx) {
  const cs = ctx.caseState;
  if (!cs) return card(t('case.title'), html`<p class="muted">${t('case.offline')}</p>`);
  const key = currentBoard(cs);
  const mission = cs.missions.find((m) => m.id === key);
  const picker = html`<div class="cluster case-head">${info('case', t('case.title'))}
    <select class="select" data-action="caseBoardPick" aria-label="${t('case.pick')}">
      ${cs.missions.map((m) => html`<option value="${m.id}" ${m.id === key ? 'selected' : ''}>${m.code ? `${m.code} · ` : ''}${m.title}${m.id === cs.active ? ` (${t('case.now')})` : ''}</option>`)}
      <option value="${GENERAL}" ${key === GENERAL ? 'selected' : ''}>${t('case.general')}</option></select>
    <div class="segmented" role="group">${['dossier', 'board'].map((v) => html`<button class="segmented__opt" data-action="caseView" data-v="${v}" aria-pressed="${caseUi.view === v}">${t(`case.view.${v}`)}</button>`)}</div></div>`;
  return html`${picker}${caseUi.view === 'board' ? boardView(c, cs, key, ctx) : dossierView(cs, key, mission)}`;
}

function dossierView(cs, key, mission) {
  const entries = cs.dossier[key]?.entries ?? [];
  const of = (k) => entries.filter((e) => e.kind === k);
  const people = [...of('person'), ...of('place')];
  const objectives = mission ? card(t('case.objectives'), html`<ul class="case-objectives">${mission.objectives.map((o) => html`<li class="case-obj case-obj--${o.status ?? 'open'}">
      <span class="label">${t(o.kind === 'main' ? 'case.obj.main' : 'case.obj.secondary')}</span> ${o.text}${o.status ? html` <span class="pill ${o.status === 'success' ? 'pill--success' : o.status === 'fail' ? 'pill--danger' : ''}">${t(STATUS[o.status])}</span>` : ''}</li>`)}</ul>`) : '';
  return html`<div class="stack">
    ${objectives}
    ${people.length ? card(t('case.people'), html`<div class="case-entries">${people.map((e) => entry(e))}</div>`) : ''}
    ${of('handout').length ? card(t('case.handouts'), html`<div class="case-entries case-entries--pics">${of('handout').map((e) => entry(e))}</div>`) : ''}
    ${of('puzzle').length || of('message').length ? card(t('case.messages'), html`<div class="case-entries">${[...of('puzzle'), ...of('message')].map((e) => entry(e))}</div>`) : ''}
    ${!mission && !entries.length ? html`<p class="muted">${t('case.empty')}</p>` : ''}
  </div>`;
}

const entry = (e) => html`<button class="case-entry" data-action="caseEntry" data-id="${e.id}">
  ${e.image ? html`<img src="${e.image}" alt="" loading="lazy">` : ''}<strong>${e.kind === 'person' ? '👤 ' : e.kind === 'place' ? '📍 ' : ''}${e.title}</strong>${e.text && !e.image ? html`<span class="muted st-small">${e.text.slice(0, 140)}</span>` : ''}</button>`;

function boardView(c, cs, key, ctx) {
  const b = boardOf(cs, key);
  const me = c.id;
  const mine = b.editor === me;
  const editorName = b.editor ? (ctx.names?.[b.editor] ?? t('case.someone')) : null;
  const sel = b.cards.find((x) => x.id === caseUi.selected);
  const linksOf = (id) => b.links.filter((l) => l.a === id || l.b === id);
  const named = (id) => b.cards.find((x) => x.id === id)?.title || '…';
  const tools = mine ? html`<div class="cluster">
      <button class="btn btn--sm btn--primary" data-action="caseAdd">+ ${t('case.card')}</button>
      ${sel ? html`<button class="btn btn--sm ${caseUi.mode === 'move' ? 'btn--primary' : ''}" data-action="caseMode" data-m="move">✥ ${t('case.move')}</button>
        <button class="btn btn--sm ${caseUi.mode === 'link' ? 'btn--primary' : ''}" data-action="caseMode" data-m="link">🔗 ${t('case.link')}</button>
        <button class="btn btn--sm" data-action="caseEdit">✎ ${t('case.edit')}</button>
        <button class="btn btn--sm btn--ghost" data-action="caseUnpin">${t('case.unpin')}</button>` : ''}
      ${b.drawer.length ? html`<button class="btn btn--sm btn--ghost" data-action="caseDrawer">🗂 ${t('case.drawer', { n: b.drawer.length })}</button>` : ''}
      <button class="btn btn--sm btn--ghost" data-action="casePass">🖊 ${t('case.pass')}</button></div>`
    : html`<div class="cluster"><button class="btn btn--sm" data-action="caseSuggest">✋ ${t('case.suggest')}</button>${b.editor ? '' : html`<button class="btn btn--sm btn--ghost" data-action="caseTakePen">🖊 ${t('case.takePen')}</button>`}</div>`;
  const hint = mine && caseUi.mode === 'move' ? t('case.hint.move') : mine && caseUi.mode === 'link' ? t('case.hint.link') : '';
  return html`<div class="stack case-boardwrap">
    <div class="spread"><span class="st-small">🖊 ${editorName ? t(mine ? 'case.editorYou' : 'case.editor', { name: editorName }) : t('case.noEditor')}</span>
      <span class="cluster"><button class="btn btn--sm btn--ghost" data-action="caseZoom" data-d="-1" aria-label="${t('case.zoomOut')}">−</button><button class="btn btn--sm btn--ghost" data-action="caseZoom" data-d="1" aria-label="${t('case.zoomIn')}">+</button></span></div>
    ${tools}${hint ? html`<p class="hint">${hint}</p>` : ''}
    <div class="case-scroll">${boardSvg(b, caseUi, { cells: mine && caseUi.mode === 'move', tipWord: t('case.tip') })}</div>
    <ul class="case-list">${b.cards.map((x) => html`<li><button class="btn btn--sm btn--ghost ${x.id === caseUi.selected ? 'is-on' : ''}" data-action="caseCard" data-id="${x.id}">${ICON[x.type]} ${x.title || x.text.slice(0, 30)}${x.tip ? ` · ${t('case.tip')}` : ''}</button>${linksOf(x.id).length ? html` <span class="muted st-small">↔ ${linksOf(x.id).map((l) => named(l.a === x.id ? l.b : l.a)).join(', ')}</span>` : ''}</li>`)}</ul>
    ${b.suggestions.length ? html`<details class="details"><summary>${t('case.suggestions', { n: b.suggestions.length })}</summary><ul>${b.suggestions.slice(0, 8).map((s) => html`<li><strong>${s.by}</strong>: ${s.text}</li>`)}</ul></details>` : ''}
  </div>`;
}
