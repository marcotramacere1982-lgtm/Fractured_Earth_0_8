// Characters page: list, open, import (v1 or legacy v0.8), export, delete.

import { html, render, delegate, raw, cleanup } from './dom.js';
import { href, go } from './router.js';
import { toast } from './shell.js';
import { exportCharacter } from '../state/store.js';
import { createCharacter, deriveSheet } from '../state/character.js';
import { findSubclass } from '../rules/classes.js';
import { t } from '../i18n/index.js';
import { portraitImg } from './portrait.js';

export function homeView({ data, store, main, table, library }) {
  const playing = () => Boolean(library?.available() && library.state.player);
  let showAll = false; // playing as someone: the other players' characters on this device stay folded away
  /** The table's owner decides; for characters the table doesn't know yet: my name on the sheet, or nobody's (decision 87). */
  const isMine = (c) => {
    const me = library.state.player.name.trim().toLowerCase();
    const owner = library.ownerOf(c.id);
    if (owner) return owner.trim().toLowerCase() === me;
    return !c.player?.trim() || c.player.trim().toLowerCase() === me;
  };
  const draw = () => {
    const all = store.list();
    const list = playing() && !showAll ? all.filter(isMine) : all;
    const others = all.length - list.length;
    const here = new Set(all.map((c) => c.id));
    const away = playing() ? library.state.remote.filter((r) => !here.has(r.id)) : []; // mine at the table, not on this device
    render(main, html`
      <div class="stack">
        ${library?.available() ? tableCard(library, away, data) : ''}
        <div class="spread spread--wrap">
          <div>
            <h1 class="page-title">${t('home.title')}</h1>
            <p class="page-lede">${t('home.lede')}</p>
          </div>
          <div class="cluster">
            <a class="btn btn--primary" href="#/builder">${t('home.new')}</a>
            <label class="btn">${t('home.import')}<input type="file" accept=".json,.JSON" class="visually-hidden" data-action="import"></label>
            <button class="btn" data-action="blank">${t('home.blank')}</button>
          </div>
        </div>
        ${playing() && (others || showAll) ? html`<p class="cluster"><button class="btn btn--sm btn--ghost" data-action="toggleOthers">${showAll ? t('home.table.onlyMine', { name: library.state.player.name }) : t('home.table.showOthers', { n: others })}</button></p>` : ''}
        ${list.length ? html`
          <div class="grid-auto grid-auto--wide">
            ${list.map((c) => characterCard(c, data, playing() ? library : null))}
          </div>` : html`
          <div class="card"><div class="empty">
            <div class="empty__title">${t('home.empty.title')}</div>
            <p>${t('home.empty.text')} <span class="mono">char_init_*.json</span> / <span class="mono">Save_*.JSON</span></p>
          </div></div>`}
        ${!store.saveOk ? html`<p class="text-danger">${t('home.storageBlocked')}</p>` : ''}
      </div>`);
  };

  /** Opening at the table (decision 87): the newest copy, saved under your name, and joined. */
  async function openAtTable(id) {
    const out = await library.open(id, { confirmOther: (name) => confirm(t('home.table.otherDevice', { name })) });
    if (out.result === 'failed') { toast(t('home.table.failed'), 'danger'); return; }
    if (out.result !== 'opened') return;
    if (out.updated) toast(t('home.table.newer'), 'success');
    go('sheet', id);
  }

  const offClick = delegate(main, 'click', {
    open({ id }) { openAtTable(id); },
    tableNotMe() { library.choose({}); },
    toggleOthers() { showAll = !showAll; draw(); },
    tableRefresh() { library.refresh(); },
    blank() {
      const c = createCharacter(data, { name: t('home.defaultName') });
      store.add(c);
      if (playing()) { openAtTable(c.id); return; }
      go('sheet', c.id);
    },
    export({ id }) { exportCharacter(store.get(id)); },
    remove({ id }) {
      const c = store.get(id);
      if (confirm(t('home.confirmDelete', { name: c.name }))) { store.remove(id); draw(); }
    },
  });
  const offChange = delegate(main, 'change', {
    tablePlayer(_, event) {
      const v = event.target.value;
      if (v === '__new') { const name = prompt(t('home.table.newPrompt')); if (name?.trim()) library.choose({ name: name.trim() }); else draw(); return; }
      library.choose({ id: v || null });
    },
    async import(_, event) {
      const file = event.target.files[0];
      if (!file) return;
      try {
        const { id, warnings } = await store.importFile(file, data);
        toast(t('home.imported', { name: store.get(id).name }), 'success');
        warnings.forEach((w) => toast(w));
        if (playing()) { openAtTable(id); return; } // imported at a table: saved under your name
        go('sheet', id);
      } catch (err) {
        toast(t('home.importFailed', { error: err.message }), 'danger');
      }
    },
  });

  draw();
  const offLib = library?.subscribe(draw) ?? (() => {});
  const offTable = table?.subscribe?.(() => { if (library?.available() && !library.state.loaded) library.refresh(); else draw(); }) ?? (() => {});
  if (library?.available()) library.refresh();
  return cleanup(offClick, offChange, offLib, offTable);
}

/** At a table (decision 87): who plays on this device, and their characters the table holds but this device doesn't. */
function tableCard(library, away, data) {
  const { player, players } = library.state;
  return html`<section class="card table-card">
    <div class="card__body stack-tight">
      <div class="cluster cluster--gap">
        <strong class="card__title">${t('home.table.title')}</strong>
        <label class="cluster"><span class="label">${t('home.table.playAs')}</span>
          <select class="input" data-action="tablePlayer" aria-label="${t('home.table.playAs')}">
            <option value="" ${player ? '' : 'selected'}>${t('home.table.choose')}</option>
            ${players.map((p) => html`<option value="${p.id}" ${player?.id === p.id ? 'selected' : ''}>${p.name}</option>`)}
            <option value="__new">${t('home.table.newPlayer')}</option></select></label>
        ${player ? html`<button class="btn btn--sm btn--ghost" data-action="tableRefresh">↻</button>` : ''}
      </div>
      <p class="hint">${player ? t('home.table.hintPlaying', { name: player.name }) : t('home.table.hint')}</p>
      ${away.length ? html`<div class="rows">${away.map((r) => html`<div class="row"><div class="row__main">
          <div class="row__title">${r.name} <span class="pill">${t('home.table.onlyThere')}</span>${r.online ? html` <span class="pill pill--accent">${t('home.table.online')}</span>` : ''}</div>
          <div class="row__meta">${className(r, data)}</div></div>
        <button class="btn btn--sm btn--primary" data-action="open" data-id="${r.id}">${t('home.table.copy')}</button></div>`)}</div>` : ''}
    </div></section>`;
}
const className = (r, data) => { const sub = r.subclassId ? findSubclass(data.classes, r.subclassId) : null; return sub ? `${sub.cls.name} · ${sub.sub.name}` : t('common.noClass'); };

function characterCard(c, data, library = null) {
  const s = deriveSheet(c, data);
  const sub = c.subclassId ? findSubclass(data.classes, c.subclassId) : null;
  const classIcon = sub ? data.icons[sub.cls.id] : '';
  return html`
    <article class="card">
      <a class="card__body op-card__link" href="${href('sheet', c.id)}">
        ${c.portrait.dataUrl
          ? portraitImg(c.portrait, 'avatar')
          : html`<span class="avatar avatar--icon">${raw(classIcon)}</span>`}
        <div class="stack stack--tight">
          <strong class="card__title">${c.name || t('common.unnamed')}</strong>
          <span class="muted">${sub ? `${sub.cls.name} · ${sub.sub.name}` : t('common.noClass')} ${c.player ? `· ${c.player}` : ''}</span>
          <span class="mono muted">HP ${s.hp.current}/${s.hp.max} · CRS ${c.attributes.CRS} · ${t('common.age')} ${c.age}</span>
        </div>
      </a>
      <div class="card__foot">
        ${library ? html`<span class="cluster"><button class="btn btn--sm btn--primary" data-action="open" data-id="${c.id}">${t('common.open')}</button>${library.remoteOf(c.id) ? html`<span class="pill pill--success">${t('home.table.here')}</span>` : html`<span class="pill">${t('home.table.notYet')}</span>`}</span>`
          : html`<a class="btn btn--sm btn--primary" href="${href('sheet', c.id)}">${t('common.open')}</a>`}
        <div class="cluster">
          <button class="btn btn--sm" data-action="export" data-id="${c.id}">${t('common.export')}</button>
          <button class="btn btn--sm btn--danger" data-action="remove" data-id="${c.id}">${t('common.delete')}</button>
        </div>
      </div>
    </article>`;
}
