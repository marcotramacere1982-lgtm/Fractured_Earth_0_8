// Notes & maps tab: Maps we've seen (decision 122). Each map this character saw on the table, as they last saw it:
// open one to look around (pan, zoom, tap a piece for its name and caption, tap an NPC for theirs), add a line of
// your own, or forget it. Read-only: no moving, no sight lines, no marks.

import { html } from '../dom.js';
import { t } from '../../i18n/index.js';
import { card } from './parts.js';
import { createMapViewer } from '../map/viewer.js';
import { createSkylineViewer, tileAt } from '../map/skyline.js';
import { skyButton } from './map-tab.js';
import { memoryView, MEMORY_NOTE_MAX } from '../../rules/map-memory.js';

let viewer = null;
let skyView = null; // decision 123
let sky = false;
let openKey = null;
let picked = null; // { kind: 'prop' | 'npc', id }

const when = (ms) => new Date(ms).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function pickedPanel(m, data) {
  if (picked?.kind === 'npc') {
    const n = m.npcs.find((x) => x.key === picked.id);
    return n && html`<p class="map-info"><strong>${n.name}</strong> <span class="muted st-small">· ${t('memory.npcLast')}</span></p>`;
  }
  const p = picked?.kind === 'prop' ? m.props.find((x) => x.id === picked.id) : null;
  const d = p && data.props.props.find((x) => x.id === p.prop);
  return d && html`<p class="map-info"><strong>${p.caption || d.name}</strong> <span class="pill">${t(`map.group.${d.category}`)}</span>${p.caption ? html` <span class="muted st-small">${d.name}</span>` : ''}</p>`;
}

/** The card: the list, and the open memory under it. */
export function memoriesCard(c, data) {
  const list = c.play.mapMemories ?? [];
  const m = list.find((x) => x.key === openKey);
  if (!m) openKey = null;
  return card(t('memory.title'), html`
    ${list.length ? html`<ul class="memory-list">${list.map((x) => html`<li class="memory-list__item ${x.key === openKey ? 'is-open' : ''}">
        <button class="btn btn--sm ${x.key === openKey ? 'btn--primary' : ''}" data-action="memOpen" data-key="${x.key}" aria-pressed="${x.key === openKey}">${x.name}</button>
        <span class="muted st-small">${t('memory.last', { when: when(x.last) })}</span>
        ${x.note ? html`<span class="st-small memory-list__note">${x.note}</span>` : ''}</li>`)}</ul>`
      : html`<p class="muted">${t('memory.empty')}</p>`}
    ${m ? html`<div class="memory-open">
        <div class="cluster">
          <button class="btn btn--sm" data-action="memZoom" data-dir="out" aria-label="${t('map.zoomOut')}">−</button>
          <button class="btn btn--sm" data-action="memFit">${t('map.fit')}</button>
          <button class="btn btn--sm" data-action="memZoom" data-dir="in" aria-label="${t('map.zoomIn')}">+</button>
          ${skyButton(memoryView(m).map, data, 'memSkyline', sky)}
          <button class="btn btn--sm btn--ghost" data-action="memOpen" data-key="${m.key}">${t('memory.close')}</button>
          <button class="btn btn--sm btn--ghost text-danger" data-action="memForget" data-key="${m.key}">${t('memory.forget')}</button>
        </div>
        <div class="memory-open__stage" data-map-slot></div>
        ${pickedPanel(m, data) || html`<p class="hint">${t('memory.hint')}</p>`}
        <label class="field"><span class="label">${t('memory.note')}</span>
          <input class="input" maxlength="${MEMORY_NOTE_MAX}" value="${m.note ?? ''}" data-action="memNote" data-key="${m.key}" placeholder="${t('memory.notePlaceholder')}"></label>
      </div>` : ''}
    <p class="hint">${t('memory.about')}</p>`, { ref: 'mapMemory' });
}

/** After the tab renders: put the viewer in its slot with the open memory. */
export function attachMemory(main, data, c, onIdle) {
  const m = (c.play.mapMemories ?? []).find((x) => x.key === openKey);
  if (!m || !main.querySelector('[data-map-slot]')) return;
  if (sky && m.props.some((p) => data.props.props.find((d) => d.id === p.prop)?.skyline)) {
    skyView ??= createSkylineViewer({ data, prefix: 'memsky' });
    skyView.on.idle = onIdle;
    skyView.on.tapSquare = (sq) => { const pid = tileAt(m, data, sq); picked = pid && picked?.id !== pid ? { kind: 'prop', id: pid } : null; onIdle(); };
    skyView.update({ ...memoryView(m), key: `memory:${m.key}` });
    skyView.attach(main);
    return;
  }
  viewer ??= createMapViewer({ data, prefix: 'memory', interactive: true });
  Object.assign(viewer.on, {
    idle: onIdle,
    canDrag: () => false,
    tapToken(key) { picked = picked?.id === key ? null : { kind: 'npc', id: key }; onIdle(); },
    tapProp(id) { picked = picked?.id === id ? null : { kind: 'prop', id }; onIdle(); },
    tapSquare() { if (picked) { picked = null; onIdle(); } },
  });
  viewer.update({ ...memoryView(m), key: `memory:${m.key}` });
  viewer.attach(main);
}

export const memoryBusy = () => Boolean(viewer?.isBusy() || skyView?.isBusy());
export const toggleMemorySky = () => { sky = !sky; picked = null; };
export function toggleMemory(key) { openKey = openKey === key ? null : key; picked = null; }
export const memoryFit = () => (sky && skyView ? skyView : viewer)?.fit();
export const memoryZoom = (dir) => (sky && skyView ? skyView : viewer)?.zoom(dir);
