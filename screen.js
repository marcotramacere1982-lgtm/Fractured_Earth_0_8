// The TV screen (decision 132): cast this tab to the TV. A bar on top and the table map full screen, as the crew
// sees it together — every player's marker, what any of them sees (fog), bright or dark, the GM's and players'
// marks. Passive: it listens to the table (/api/table/screen) and sends nothing back; pan and zoom only.

import { loadI18n, t } from './i18n/index.js';
import { loadData } from './data/index.js';
import { html, render } from './ui/dom.js';
import { createMapViewer, focusBox } from './ui/map/viewer.js';
import { loadProps } from './ui/map/props.js';

const THEME = 'fe.screen.theme';
const bar = document.getElementById('tv-bar');
const stage = document.getElementById('tv-stage');

let map = null; // the public map message, already cut by the crew's fog
let marks = null; // { map, list, skew }
let link = 'connecting'; // connecting | live | lost | static

function setTheme(next) {
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem(THEME, next); } catch { /* private mode */ }
}
const theme = () => document.documentElement.dataset.theme ?? 'dark';

function drawBar(viewer) {
  const soon = (label) => html`<button class="btn btn--sm btn--ghost" disabled title="${t('screen.soon')}">${label}</button>`;
  render(bar, html`
    <div class="tv-bar__id"><span class="tv-bar__brand">// Fractured Earth</span>
      <span class="tv-bar__map">${map?.name ?? ''}</span>
      <span class="tv-bar__link tv-bar__link--${link}">${t(`screen.link.${link}`)}</span></div>
    <div class="tv-bar__tools">
      ${soon(t('screen.initiative'))}${soon(t('screen.handouts'))}${soon(t('screen.sound'))}
      <span class="tv-bar__sep" aria-hidden="true"></span>
      <button class="btn btn--sm" data-tv="zoom" data-dir="out" aria-label="${t('map.zoomOut')}" ${map ? '' : 'disabled'}>−</button>
      <button class="btn btn--sm" data-tv="fit" ${map ? '' : 'disabled'}>${t('map.fit')}</button>
      <button class="btn btn--sm" data-tv="zoom" data-dir="in" aria-label="${t('map.zoomIn')}" ${map ? '' : 'disabled'}>+</button>
      <button class="btn btn--sm" data-tv="full" title="${t('screen.fullHint')}">${t('screen.full')}</button>
      <button class="btn btn--sm" data-tv="theme" aria-pressed="${theme() === 'light'}">${t(theme() === 'light' ? 'screen.night' : 'screen.day')}</button>
    </div>`);
  bar.onclick = (e) => {
    const b = e.target.closest('[data-tv]');
    if (!b) return;
    if (b.dataset.tv === 'zoom') viewer.zoom(b.dataset.dir);
    if (b.dataset.tv === 'fit') viewer.fit();
    if (b.dataset.tv === 'theme') { setTheme(theme() === 'light' ? 'dark' : 'light'); drawBar(viewer); }
    if (b.dataset.tv === 'full') { if (document.fullscreenElement) document.exitFullscreen?.(); else document.documentElement.requestFullscreen?.().catch(() => {}); }
  };
}

function drawMap(viewer) {
  if (viewer.isBusy()) return; // a finger or the mouse is on the map: it catches up when let go
  if (!map) {
    render(stage, html`<div class="tv-empty"><div class="empty__title">${t(link === 'static' ? 'screen.static' : 'screen.waiting')}</div></div>`);
    return;
  }
  viewer.update({
    key: map.id, map, tokens: map.tokens ?? [],
    fog: map.fog ? { mode: 'player', ...map.fog } : null,
    focus: focusBox(map, map.fog?.seen, map.tokens ?? []), // decision 133: frame what the crew has seen
    marks: { list: marks?.map === map.id ? marks.list : [], skew: marks?.skew ?? 0 },
  });
  viewer.attach(document.body);
}

async function boot() {
  await loadI18n();
  const data = await loadData();
  const viewer = createMapViewer({ data, prefix: 'tv' }); // not interactive: pan and zoom only
  viewer.on.idle = () => drawMap(viewer);
  const redraw = () => { drawBar(viewer); drawMap(viewer); };
  redraw();
  loadProps(data).then(() => drawMap(viewer));
  if (!document.querySelector('meta[name="fe-table"]')) { link = 'static'; redraw(); return; } // opened without the table server
  const events = new EventSource('/api/table/screen');
  events.onopen = () => { link = 'live'; drawBar(viewer); };
  events.onerror = () => { link = 'lost'; drawBar(viewer); }; // EventSource reconnects by itself
  events.onmessage = (e) => {
    let msg;
    try { msg = JSON.parse(e.data); } catch { return; }
    if (msg.type === 'map') map = msg.closed ? null : msg;
    else if (msg.type === 'marks') marks = { map: msg.map, list: msg.list ?? [], skew: Date.now() - (msg.now ?? Date.now()) };
    else return;
    redraw();
  };
}

boot();
