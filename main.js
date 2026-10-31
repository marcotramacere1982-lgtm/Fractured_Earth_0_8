// Entry point: load data, create the store, start the router.

import { cue } from './ui/sound.js';
import { loadData } from './data/index.js';
import { loadI18n, t, getLang } from './i18n/index.js';
import { createStore } from './state/store.js';
import { renderHeader, setToastTimeout } from './ui/shell.js';
import { startRouter } from './ui/router.js';
import { render, html } from './ui/dom.js';
import { homeView } from './ui/home.js';
import { sheetView } from './ui/sheet/index.js';
import { manualView } from './ui/manual/index.js';
import { installRefs } from './ui/ref.js';
import { installExplain } from './ui/explain.js';
import { builderView, resetBuilderDraft } from './ui/builder/index.js';
import { createTableLink } from './net/table.js';
import { createLibrary } from './net/library.js';
import { installTransmissions } from './ui/transmissions.js';
import { toast } from './ui/shell.js';
import { log, actions } from './ui/sheet/actions.js';
import { rememberMap } from './rules/map-memory.js';

const header = document.getElementById('app-header');
const main = document.getElementById('app-main');
setToastTimeout(2000); // decision 192: pop-ups fade after 2 s, no ✕ (they used to stay and block the corner)

async function boot() {
  let data;
  try {
    await loadI18n();
    data = await loadData({ lang: getLang() });
  } catch (err) {
    render(main, html`<div class="empty"><div class="empty__title">${t('boot.failed')}</div>
      <p>${err.message}</p><p class="muted">${t('boot.http')}</p></div>`);
    return;
  }
  installRefs(data.refs, { manual: { href: '#/manual/', newTab: true } }); // decision 160: tap only; Learn more opens the manual beside the sheet
  installExplain(data);
  const store = createStore({ data });
  const table = createTableLink(store, {
    toast,
    log,
    // decision 160: one character per player at the table
    oneAtATime: ({ player, here, there }) => window.confirm(t('table.oneAtATime', { player: player || t('table.thisPlayer'), here, there: there.join(', ') })),
    combat: (id, msg) => store.update(id, (c) => actions.tableCombat(c, data, { msg })),
    progress: (id, msg) => { let out = null; store.update(id, (c) => { out = actions.applyProgress(c, data, { msg }); }); return out; },
    downtime: (id, msg) => { let out = null; store.update(id, (c) => { out = actions.applyDowntime(c, data, { msg }); }); return out; },
    notify: cue,
    map: (id, msg) => { // decision 122: map memories; quiet, the table's own redraw shows them
      const c = store.get(id);
      const next = c && rememberMap(c.play.mapMemories, msg, Date.now());
      if (next && next.length && next !== c.play.mapMemories) store.update(id, (d) => { d.play.mapMemories = next; }, { silent: true });
    },
    gift: (id, msg) => { let out = null; store.update(id, (c) => { out = actions.receiveItem(c, data, { msg }); }); return out; },
    boon: (id, msg) => { let out = false; store.update(id, (c) => { out = actions.receiveBoon(c, data, { msg }); }); return out; }, // decision 155
    hit: (id, msg) => { let out = false; store.update(id, (c) => { out = actions.receiveHit(c, data, { msg }); }); return out; }, // decision 154
    initiative: (id, msg) => { let out = false; store.update(id, (c) => { out = actions.askInitiative(c, data, { msg }); }); return out; }, // decision 148
    scene: (id, msg) => { let out = false; store.update(id, (c) => { out = actions.newScene(c, data, { msg }); }); return out; }, // decision 180
    ping: (id, msg) => { let out = false; store.update(id, (c) => { out = actions.receivePing(c, data, { msg }); }); return out; }, // decision 170
    ask: (id, msg) => { let out = false; store.update(id, (c) => { out = actions.askRoll(c, data, { msg }); }); return out; }, // decision 165
    deal: (id, msg) => { let out = false; store.update(id, (c) => { out = actions.receiveDeal(c, data, { msg }); }); return out; }, // decision 143
    intel: (id, msg) => { let out = 0; store.update(id, (c) => { out = actions.receiveIntel(c, data, { msg }); }); return out; }, // decision 197
    backstory: (id, msg) => { let out = false; store.update(id, (c) => { out = actions.applyBackstory(c, data, { msg }); }); return out; },
  });
  const library = createLibrary(table, store); // decision 87: who plays here, and their characters at the table
  const app = { data, store, main, table, library };
  installTransmissions(store, table);
  table.detect().then((found) => { if (found) library.refresh(); });

  const routes = {
    '': homeView,
    sheet: sheetView,
    builder: builderView,
    manual: manualView,
  };

  startRouter((route) => {
    renderHeader(header, route);
    const view = routes[route.name] ?? routes[''];
    try {
      return view(app, route);
    } catch (err) {
      // never leave the previous page on screen: say what broke and offer a way out
      render(main, html`<div class="card"><div class="empty">
        <div class="empty__title">${t('boot.pageFailed')}</div>
        <p class="mono">${err.message}</p>
        ${route.name === 'builder' ? html`<p>${t('boot.staleDraft')}</p>
          <button class="btn btn--primary" data-reset-draft>${t('boot.discardDraft')}</button>` : ''}
        <a class="btn" href="#/">${t('common.backToCharacters')}</a></div></div>`);
      main.querySelector('[data-reset-draft]')?.addEventListener('click', () => { resetBuilderDraft(); location.reload(); });
      return null;
    }
  });
}

boot();
