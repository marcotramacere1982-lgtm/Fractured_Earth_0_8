// Characters page: list, open, import (v1 or legacy v0.8), export, delete.

import { html, render, delegate, raw, cleanup } from './dom.js';
import { href, go } from './router.js';
import { toast } from './shell.js';
import { exportCharacter } from '../state/store.js';
import { createCharacter, deriveSheet } from '../state/character.js';
import { findSubclass } from '../rules/classes.js';
import { t } from '../i18n/index.js';

export function homeView({ data, store, main }) {
  const draw = () => {
    const list = store.list();
    render(main, html`
      <div class="stack">
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
        ${list.length ? html`
          <div class="grid-auto grid-auto--wide">
            ${list.map((c) => characterCard(c, data))}
          </div>` : html`
          <div class="card"><div class="empty">
            <div class="empty__title">${t('home.empty.title')}</div>
            <p>${t('home.empty.text')} <span class="mono">char_init_*.json</span> / <span class="mono">Save_*.JSON</span></p>
          </div></div>`}
        ${!store.saveOk ? html`<p class="text-danger">${t('home.storageBlocked')}</p>` : ''}
      </div>`);
  };

  const offClick = delegate(main, 'click', {
    blank() {
      const c = createCharacter(data, { name: t('home.defaultName') });
      store.add(c);
      go('sheet', c.id);
    },
    export({ id }) { exportCharacter(store.get(id)); },
    remove({ id }) {
      const c = store.get(id);
      if (confirm(t('home.confirmDelete', { name: c.name }))) { store.remove(id); draw(); }
    },
  });
  const offChange = delegate(main, 'change', {
    async import(_, event) {
      const file = event.target.files[0];
      if (!file) return;
      try {
        const { id, warnings } = await store.importFile(file, data);
        toast(t('home.imported', { name: store.get(id).name }), 'success');
        warnings.forEach((w) => toast(w));
        go('sheet', id);
      } catch (err) {
        toast(t('home.importFailed', { error: err.message }), 'danger');
      }
    },
  });

  draw();
  return cleanup(offClick, offChange);
}

function characterCard(c, data) {
  const s = deriveSheet(c, data);
  const sub = c.subclassId ? findSubclass(data.classes, c.subclassId) : null;
  const classIcon = sub ? data.icons[sub.cls.id] : '';
  return html`
    <article class="card">
      <a class="card__body op-card__link" href="${href('sheet', c.id)}">
        ${c.portrait.dataUrl
          ? html`<img class="avatar" src="${c.portrait.dataUrl}" alt="">`
          : html`<span class="avatar avatar--icon">${raw(classIcon)}</span>`}
        <div class="stack stack--tight">
          <strong class="card__title">${c.name || t('common.unnamed')}</strong>
          <span class="muted">${sub ? `${sub.cls.name} · ${sub.sub.name}` : t('common.noClass')} ${c.player ? `· ${c.player}` : ''}</span>
          <span class="mono muted">HP ${s.hp.current}/${s.hp.max} · CRS ${c.attributes.CRS} · ${t('common.age')} ${c.age}</span>
        </div>
      </a>
      <div class="card__foot">
        <a class="btn btn--sm btn--primary" href="${href('sheet', c.id)}">${t('common.open')}</a>
        <div class="cluster">
          <button class="btn btn--sm" data-action="export" data-id="${c.id}">${t('common.export')}</button>
          <button class="btn btn--sm btn--danger" data-action="remove" data-id="${c.id}">${t('common.delete')}</button>
        </div>
      </div>
    </article>`;
}
