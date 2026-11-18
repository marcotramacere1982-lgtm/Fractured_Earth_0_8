// The TV screen (decision 132): cast this tab to the TV. The table map full screen, as the crew sees it together —
// every player's marker, what any of them sees (fog), bright or dark, the GM's and players' marks. Passive: it
// listens to the table (/api/table/screen) and sends nothing back.
// Owner 2026-11-16 (decision 336): also the scene picture the GM sends to *everyone* (never one sent to some
// players), with a Map ⇄ Picture switch; zoom / pan / fit on both; a brightness slider for this TV; the bar floats
// over the picture and fades when nobody touches it. No sound. Decision 338: the players' pins on that picture.
// Decision 339: a split party — the GM puts up to four groups' pictures side by side, each with who's there.
// Decision 340: a map piece's card (what players read when they tap it), big over the map, when the GM sends it.

import { loadI18n, t } from './i18n/index.js';
import { loadData } from './data/index.js';
import { html, render } from './ui/dom.js';
import { createMapViewer, focusBox } from './ui/map/viewer.js';
import { loadProps } from './ui/map/props.js';
import { createPictureViewer } from './ui/screen/picture.js';
import { pieceCard } from './ui/map/piece-card.js'; // decision 340

const THEME = 'fe.screen.theme';
const BRIGHT = 'fe.screen.brightness';
const QUIET_MS = 4000;
const bar = document.getElementById('tv-bar');
const mapSlot = document.getElementById('tv-map');
const picHost = document.getElementById('tv-pic');
const tilesHost = document.getElementById('tv-tiles');
const infoHost = document.getElementById('tv-info');

let map = null; // the public map message, already cut by the crew's fog
let marks = null; // { map, list, skew }
let view = null; // the scene picture sent to everyone ({ id, image, caption }) or null
let mode = 'map'; // what fills the screen: 'map' | 'picture' | 'tiles'
let tiles = []; // decision 339: the split party — [{ image, caption, who }]
let infoProp = null; // decision 340: the piece whose card the GM put on the TV
let DATA = null;
let link = 'connecting'; // connecting | live | lost | static
let floorPin = null; // decision 337: the floor the GM picked (null: follow the crew)

const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};
function setTheme(next) { document.documentElement.dataset.theme = next; store.set(THEME, next); }
const theme = () => document.documentElement.dataset.theme ?? 'dark';
/** This TV's brightness, 50–150 %. */
const brightness = () => Math.min(150, Math.max(50, Number(store.get(BRIGHT)) || 100));
const applyBrightness = (v) => document.documentElement.style.setProperty('--tv-brightness', String(v / 100));

/** What fills the screen now: the mode, if it has something to show. */
const showingNow = () => (mode === 'picture' && view ? 'picture' : mode === 'tiles' && tiles.length ? 'tiles' : 'map');

function drawBar() {
  const showing = showingNow();
  const canZoom = showing === 'picture' ? Boolean(view) : showing === 'map' && Boolean(map);
  render(bar, html`
    <div class="tv-bar__id"><span class="tv-bar__brand">// Fractured Earth</span>
      <span class="tv-bar__map">${showing === 'picture' ? view.caption || t('screen.picture') : showing === 'tiles' ? t('screen.split') : map?.name ?? ''}</span>
      <span class="tv-bar__link tv-bar__link--${link}">${t(`screen.link.${link}`)}</span></div>
    <div class="tv-bar__tools">
      <div class="segmented" role="group" aria-label="${t('screen.show')}">
        <button class="segmented__opt" data-tv="mode" data-mode="map" aria-pressed="${showing === 'map'}">🗺 ${t('screen.map')}</button>
        <button class="segmented__opt" data-tv="mode" data-mode="picture" aria-pressed="${showing === 'picture'}" ${view ? '' : 'disabled'} title="${view ? '' : t('screen.noPicture')}">🖼 ${t('screen.picture')}</button>
        ${tiles.length ? html`<button class="segmented__opt" data-tv="mode" data-mode="tiles" aria-pressed="${showing === 'tiles'}">▦ ${t('screen.split')}</button>` : ''}
      </div>
      <span class="tv-bar__sep" aria-hidden="true"></span>
      <button class="btn btn--sm" data-tv="zoom" data-dir="out" aria-label="${t('map.zoomOut')}" ${canZoom ? '' : 'disabled'}>−</button>
      <button class="btn btn--sm" data-tv="fit" ${canZoom ? '' : 'disabled'}>${t('map.fit')}</button>
      <button class="btn btn--sm" data-tv="zoom" data-dir="in" aria-label="${t('map.zoomIn')}" ${canZoom ? '' : 'disabled'}>+</button>
      <span class="tv-bar__sep" aria-hidden="true"></span>
      <label class="tv-bar__bright"><span>☀</span><input type="range" min="50" max="150" step="5" value="${brightness()}" data-tv="bright" aria-label="${t('screen.brightness')}"><span class="mono">${brightness()}%</span></label>
      <button class="btn btn--sm" data-tv="theme" aria-pressed="${theme() === 'light'}">${t(theme() === 'light' ? 'screen.night' : 'screen.day')}</button>
      <button class="btn btn--sm btn--primary" data-tv="full" title="${t('screen.fullHint')}">${t(document.fullscreenElement ? 'screen.fullExit' : 'screen.full')}</button>
    </div>`);
}

function drawStage(viewer, pics) {
  const showing = showingNow();
  mapSlot.hidden = showing !== 'map';
  picHost.hidden = showing !== 'picture';
  tilesHost.hidden = showing !== 'tiles';
  if (showing === 'tiles') render(tilesHost, html`${tiles.map((x) => html`<figure class="tv-tile"><img src="${x.image}" alt="${x.caption}">
    <figcaption class="tv-tile__label"><strong>${x.who}</strong>${x.caption ? html` · ${x.caption}` : ''}</figcaption></figure>`)}`);
  tilesHost.dataset.n = String(tiles.length);
  const card = showing === 'map' && infoProp ? pieceCard(map, DATA, infoProp) : null; // decision 340: over the map only
  infoHost.hidden = !card;
  if (card) render(infoHost, html`<header class="card__head"><h2 class="card__title">${card.title}</h2></header><div class="card__body tv-info__body">${card.body}</div>`);
  if (view) pics.show(view); else pics.clear();
  if (showing !== 'map' || viewer.isBusy()) return; // a finger or the mouse is on the map: it catches up when let go
  if (!map) {
    render(mapSlot, html`<div class="tv-empty"><div class="empty__title">${t(link === 'static' ? 'screen.static' : 'screen.waiting')}</div></div>`);
    return;
  }
  viewer.update({
    key: map.id, map, tokens: map.tokens ?? [], crowd: !floorPin, // decision 287: the floor most of the crew is on — unless the GM picked one (337)
    fog: map.fog ? { mode: 'player', ...map.fog, light: map.light ?? null } : null,
    focus: focusBox(map, map.fog?.seen, map.tokens ?? []), // decision 133: frame what the crew has seen
    marks: { list: marks?.map === map.id ? marks.list : [], skew: marks?.skew ?? 0 },
  });
  viewer.attach(document.body);
  if (floorPin && viewer.floor()?.id !== floorPin && viewer.floors().some((f) => f.id === floorPin)) viewer.showFloor(floorPin);
}

/** Decision 337: tell the table what this TV shows, for the GM's 📺 window (a moment after it changes). */
let reportTimer = null;
function report(viewer) {
  if (link === 'static') return;
  clearTimeout(reportTimer);
  reportTimer = setTimeout(() => {
    const showing = showingNow();
    fetch('/api/table/screen-state', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      mode: showing, picture: view ? view.caption || view.image : null, map: map?.name ?? null, tiles: tiles.length,
      floor: viewer.floor()?.id ?? null, floors: map ? viewer.floors() : [], follow: !floorPin, info: infoProp && map ? pieceCard(map, DATA, infoProp)?.title ?? null : null }) }).catch(() => {});
  }, 300);
}

/** The bar fades after a few quiet seconds; any move, tap or key brings it back. */
function quietBar() {
  let timer = null;
  const wake = () => {
    document.body.classList.remove('tv--quiet');
    clearTimeout(timer);
    timer = setTimeout(() => { if (!bar.matches(':hover, :focus-within')) document.body.classList.add('tv--quiet'); else wake(); }, QUIET_MS);
  };
  for (const ev of ['pointermove', 'pointerdown', 'keydown']) document.addEventListener(ev, wake, { passive: true });
  wake();
}

async function boot() {
  await loadI18n();
  const data = await loadData();
  DATA = data;
  applyBrightness(brightness());
  const viewer = createMapViewer({ data, prefix: 'tv' }); // not interactive: pan and zoom only
  const pics = createPictureViewer(picHost);
  const redraw = () => { drawBar(); drawStage(viewer, pics); report(viewer); };
  viewer.on.idle = () => drawStage(viewer, pics);
  bar.addEventListener('click', (e) => {
    const b = e.target.closest('[data-tv]');
    if (!b) return;
    const onPicture = mode === 'picture' && view;
    if (b.dataset.tv === 'mode') { mode = b.dataset.mode; redraw(); }
    report(viewer);
    if (b.dataset.tv === 'zoom') { if (onPicture) pics.zoom(b.dataset.dir); else viewer.zoom(b.dataset.dir); }
    if (b.dataset.tv === 'fit') { if (onPicture) pics.fit(); else viewer.fit(); }
    if (b.dataset.tv === 'theme') { setTheme(theme() === 'light' ? 'dark' : 'light'); drawBar(); }
    if (b.dataset.tv === 'full') { if (document.fullscreenElement) document.exitFullscreen?.(); else document.documentElement.requestFullscreen?.().catch(() => {}); }
  });
  bar.addEventListener('input', (e) => {
    if (e.target.dataset.tv !== 'bright') return;
    const v = Number(e.target.value);
    store.set(BRIGHT, String(v));
    applyBrightness(v);
    e.target.nextElementSibling.textContent = `${v}%`;
  });
  document.addEventListener('fullscreenchange', drawBar);
  quietBar();
  redraw();
  loadProps(data).then(() => drawStage(viewer, pics));
  if (!document.querySelector('meta[name="fe-table"]')) { link = 'static'; redraw(); return; } // opened without the table server
  const events = new EventSource('/api/table/screen');
  events.onopen = () => { link = 'live'; drawBar(); };
  events.onerror = () => { link = 'lost'; drawBar(); }; // EventSource reconnects by itself
  events.onmessage = (e) => {
    let msg;
    try { msg = JSON.parse(e.data); } catch { return; }
    if (msg.type === 'tv') { // decision 337: the GM steers this TV from the console
      const onPicture = mode === 'picture' && view;
      if (msg.op === 'mode') { mode = msg.mode; redraw(); return; }
      if (msg.op === 'info') { infoProp = msg.prop; redraw(); return; } // decision 340
      if (msg.op === 'tiles') { tiles = Array.isArray(msg.tiles) ? msg.tiles : []; if (!tiles.length && mode === 'tiles') mode = 'map'; redraw(); return; } // decision 339
      if (msg.op === 'zoom') { if (onPicture) pics.zoom(msg.dir); else viewer.zoom(msg.dir); }
      if (msg.op === 'fit') { if (onPicture) pics.fit(); else viewer.fit(); }
      if (msg.op === 'pan') { if (onPicture) pics.pan(msg.dx, msg.dy); else viewer.pan(msg.dx, msg.dy); }
      if (msg.op === 'floor') { floorPin = msg.floor; drawStage(viewer, pics); if (floorPin) viewer.showFloor(floorPin); report(viewer); }
      return;
    }
    if (msg.type === 'viewPins') { if (msg.view === view?.id) pics.setPins(msg.list); return; } // decision 338: who points where
    if (msg.type === 'map') map = msg.closed ? null : msg;
    else if (msg.type === 'marks') marks = { map: msg.map, list: msg.list ?? [], skew: Date.now() - (msg.now ?? Date.now()) };
    else if (msg.type === 'view') { // a picture for everyone: the TV switches to it; 'off' = back to the map
      if (msg.state === 'off' || !msg.image) { view = null; mode = 'map'; } else { const fresh = view?.id !== msg.id; view = msg; if (fresh) mode = 'picture'; }
    } else return;
    redraw();
  };
}

boot();
