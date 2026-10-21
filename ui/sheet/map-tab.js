// Sheet: the Map tab (decision 64, steps 2–3). Shown only while the GM has a map on the table; the markers come
// from the public view (hidden hostiles never reach the sheet). Look around (pan, zoom) and, when the GM allows
// it, drag your own marker: in combat on your turn (one Move action, up to your move, round walls), otherwise
// freely. The GM console checks the move again before it applies it.

import { html } from '../dom.js';
import { t } from '../../i18n/index.js';
import { toast } from '../shell.js';
import { tourDone } from '../tour.js';
import { info as ruleInfo } from '../ref.js';
import { createMapViewer } from '../map/viewer.js';
import { marksButton, marksPanel, markHooks, marking } from './map-marks.js';
import { reachable, checkMove, routeTo, lineOfSight, rangeCheck, nextToDoor } from '../../rules/map.js';

let viewer = null; // one per page: it keeps its zoom across the sheet's re-renders
let pending = null; // { base: the map message it was sent from, to } — shown until the next map message
let target = null; // the marker tapped to check line of sight and range (step 4)
let info = null; // { kind: 'prop' | 'laser', id } — a piece tapped to see what it is (decision 70)

/** What a tapped piece is: its name, its group and what it does physically — never its state (on, open, flags). */
function infoPanel(map, data, id, doorUse) {
  if (info?.kind === 'door') {
    const w = map.walls.find((x) => x.id === info.id && x.kind === 'door');
    if (!w) return null;
    const me = map.tokens.find((tk) => tk.key === id);
    const close = me && nextToDoor(me, w);
    const reason = !close ? t('map.door.far') : doorUse === 'gm' ? t('map.door.gm') : doorUse === 'wait' ? t('map.door.wait') : doorUse === 'noActions' ? t('map.door.noActions') : null;
    return html`<section data-tour="map-target" class="map-target map-info"><div class="map-target__head"><strong>${t('map.door.title')}</strong>
        <span class="pill">${t(w.open ? 'map.door.isOpen' : 'map.door.isClosed')}</span>
        <button class="btn btn--sm btn--ghost" data-action="mapInfoClose" aria-label="${t('map.info.close')}">✕</button></div>
      ${reason ? html`<p class="muted map-target__why">${reason}</p>`
        : html`<div class="cluster"><button class="btn btn--sm btn--primary" data-action="mapDoor" data-door="${w.id}" data-open="${w.open ? '0' : '1'}">${t(w.open ? 'map.door.doClose' : 'map.door.doOpen')}</button>
          ${doorUse === 'ok' && mapCombat ? html`<span class="muted st-small">${t('map.door.cost')}</span>` : ''}</div>`}
    </section>`;
  }
  if (info?.kind === 'laser') {
    if (!map.walls.some((w) => w.id === info.id)) return null;
    return html`<section data-tour="map-target" class="map-target map-info"><div class="map-target__head"><strong>${t('map.info.laser')}</strong>
      <button class="btn btn--sm btn--ghost" data-action="mapInfoClose" aria-label="${t('map.info.close')}">✕</button></div>
      <p class="muted map-target__why">${t('map.info.laserText')}</p></section>`;
  }
  const p = info?.kind === 'prop' ? (map.props ?? []).find((x) => x.id === info.id) : null;
  const d = p && data.props.props.find((x) => x.id === p.prop);
  if (!d) return null;
  const traits = [d.blocksMove ? t('map.info.blocksMove') : d.difficult ? t('map.info.difficult') : null, d.blocksSight ? t('map.info.blocksSight') : null,
    d.cover !== 'none' ? t(`map.cover.${d.cover}`) : null].filter(Boolean);
  return html`<section data-tour="map-target" class="map-target map-info"><div class="map-target__head"><strong>${d.name}</strong>
      <span class="pill">${t(`map.group.${d.category}`)}</span>
      <button class="btn btn--sm btn--ghost" data-action="mapInfoClose" aria-label="${t('map.info.close')}">✕</button></div>
    <p class="muted map-target__why">${traits.length ? traits.join(' · ') : t('map.info.nothing')}</p></section>`;
}

/** Line of sight and distance from your marker to the tapped one, or null. tokens: as shown (pending move applied). */
function sightTo(map, data, id, tokens) {
  const me = tokens.find((tk) => tk.key === id);
  const tgt = tokens.find((tk) => tk.key === target);
  if (!me || !tgt) return null;
  return { me, tgt, los: lineOfSight(map, data, me, tgt, tokens.filter((tk) => tk.key !== id && tk.key !== target)) };
}
const shown = (map, id) => map.tokens.map((tk) => (pending && pending.base === map && tk.key === id ? { ...tk, ...pending.to } : tk));

/** Under the map: the tapped marker — distance, line of sight, and which of your weapons reach it (info only). */
function targetPanel(map, data, s, id) {
  const tokens = shown(map, id);
  const sight = sightTo(map, data, id, tokens);
  if (!sight) return html`<p data-tour="map-target" class="map-target map-target--empty muted">${t('map.target.hint')}</p>`;
  const { tgt, los } = sight;
  const nameOf = (key) => { const tk = tokens.find((x) => x.key === key); return !tk ? '?' : tk.kind === 'enemy' ? `${tk.label} (${tk.name})` : tk.name; };
  const propName = (id) => data.props.props.find((d) => d.id === id)?.name ?? '?';
  const why = los.result === 'blocked' ? t(`map.los.by.${los.by}`, { name: los.prop ? propName(los.prop) : '' })
    : los.reasons.map((r) => (r.code === 'character' ? t('map.los.why.character', { name: nameOf(r.key) })
      : r.code === 'prop' ? t('map.los.why.prop', { name: propName(r.prop), cover: t(`map.cover.${r.cover}`) }) : t('map.los.why.edge'))).join(' · ');
  const weapons = s.weapons.filter((w) => !w.empty);
  return html`<section data-tour="map-target" class="map-target map-target--${los.result}">
    <div class="map-target__head">
      <span class="map-legend__dot map-legend__dot--${tgt.kind}">${tgt.label}</span><strong>${tgt.name}</strong>
      <span class="mono">${t('map.distance', { n: los.squares, m: los.squares * data.map.square.metres })}</span>
      <span class="pill map-los-pill map-los-pill--${los.result}">${t(`map.los.${los.result}`)}</span>
      <button class="btn btn--sm btn--ghost" data-action="mapTarget" aria-label="${t('map.target.clear')}">✕</button>
    </div>
    ${why ? html`<p class="muted map-target__why">${why}${los.result === 'cover' ? ` — ${t('map.los.coverHint')}` : ''}</p>` : ''}
    ${weapons.length ? html`<ul class="map-target__weapons">${weapons.map((w) => {
      const r = rangeCheck(w.range, los.squares, data);
      return html`<li><span>${w.name}${w.inHand ? html` <span class="muted">· ${t('map.target.inHand')}</span>` : ''}</span>
        <span class="mono muted">${w.range.min}–${w.range.max} m</span><span class="pill map-range map-range--${r.status}">${t(`map.range.${r.status}`)}</span></li>`;
    })}</ul>` : html`<p class="muted">${t('map.range.none')}</p>`}
  </section>`;
}

/** The hint under the map: what this player can do right now. move: from moveState() */
function hint(map, move) {
  if (!map.canMove) return t('map.hint.gm');
  if (!move) return t('map.notPlaced');
  if (move.why === 'notTurn') return t('map.hint.wait');
  if (move.why === 'noActions') return t('map.hint.noActions');
  if (move.combat && move.left) return t('map.hint.budget', { left: move.left, n: move.max });
  return move.combat ? t('map.hint.turn', { n: move.max }) : t('map.hint.free');
}

let mapCombat = false; // in a fight: opening a door costs an action (shown on its button)

export function mapTab(_c, s, data, { map, id, combat, mapMove, doorUse, torch = null, marks = null, myColor = null }) {
  mapCombat = Boolean(combat?.active);
  if (!map) return html`<div class="card"><div class="empty"><div class="empty__title">${t('map.none')}</div></div></div>`;
  const mine = map.tokens.find((x) => x.key === id);
  const band = (tk) => combat?.hostiles?.find((h) => h.key === tk.key)?.band;
  const canGo = mapMove && !mapMove.why;
  return html`<section class="card map-card ${marking() ? 'is-marking' : ''}">
    <header class="card__head"><h2 class="card__title">${map.name}${ruleInfo('map', t('sheet.tab.map'))}<small>${mine ? t('map.youAt', { col: mine.x + 1, row: mine.y + 1 }) : t('map.notPlaced')}</small></h2>
      <div class="cluster">
        ${marksButton()}
        <button class="btn btn--sm btn--ghost" data-action="tour" data-id="map" title="${t('map.tourHint')}" aria-label="${t('map.tourHint')}">?</button>
        <button class="btn btn--sm" data-action="mapZoom" data-dir="out" aria-label="${t('map.zoomOut')}">−</button>
        <button class="btn btn--sm" data-action="mapFit">${t('map.fit')}</button>
        <button class="btn btn--sm" data-action="mapZoom" data-dir="in" aria-label="${t('map.zoomIn')}">+</button>
      </div></header>
    ${tourDone('map') ? '' : html`<p class="notice tour-offer map-card__offer"><span>${t('map.tourOffer')}</span>
      <button class="btn btn--sm btn--primary" data-action="tour" data-id="map">${t('tour.offerStart')}</button>
      <button class="btn btn--sm btn--ghost" data-action="tourSkip" data-id="map">${t('tour.offerNo')}</button></p>`}
    <div class="map-card__body">
    <div class="map-card__stage" data-map-slot data-tour="map-stage"></div>
    <aside class="map-card__side">
    ${marksPanel(map, data, id, marks, myColor)}
    <p class="map-card__move ${canGo ? 'is-go' : ''}" data-tour="map-move">${hint(map, mapMove)}</p>
    ${torch == null ? '' : html`<div class="map-card__gear" data-tour="map-gear"><button class="btn btn--sm ${torch ? 'btn--primary' : ''}" data-action="mapTorch" data-on="${torch ? '0' : '1'}" aria-pressed="${torch}">🔦 ${t(torch ? 'map.torch.on' : 'map.torch.off')}</button>
      <span class="muted st-small">${t('map.torch.hint')}</span></div>`}
    ${infoPanel(map, data, id, doorUse) ?? targetPanel(map, data, s, id)}
    <ul class="map-legend" data-tour="map-legend">${map.tokens.map((tk) => html`<li class="map-legend__item ${tk.key === id ? 'is-you' : ''} ${tk.down ? 'is-down' : ''}">
      <span class="map-legend__dot map-legend__dot--${tk.kind} ${tk.color ? `map-legend__dot--c-${tk.color}` : ''}">${tk.label}</span>
      <span>${tk.key === id ? t('map.you') : tk.name}${band(tk) ? html` <span class="muted">· ${t(`turn.band.${band(tk)}`)}</span>` : ''}${tk.current ? html` <span class="pill pill--accent">${t('map.acting')}</span>` : ''}</span></li>`)}</ul>
    <p class="hint">${t('map.hint.look')}</p>
    </aside>
    </div>
  </section>`;
}

/**
 * After the sheet renders: put the persistent map in its slot and show the current view.
 * opts: { onIdle(), move(): { max, combat } | { why } | null, onMove(to, steps, combat) → bool,
 *         marks, myColor, onMark(body) → Promise<bool> (decision 82) }
 */
export function attachMap(main, data, map, id, { onIdle, move, onMove, marks = null, myColor = null, onMark = async () => false }) {
  if (!map || !main.querySelector('[data-map-slot]')) return;
  viewer ??= createMapViewer({ data, prefix: 'sheet', interactive: true });
  if (pending && pending.base !== map) pending = null; // the GM answered (accepted or put it back)
  const tokens = shown(map, id);
  if (target && !tokens.some((tk) => tk.key === target)) target = null; // gone from the map (or hidden again)
  const me = () => tokens.find((tk) => tk.key === id);
  const others = () => tokens.filter((tk) => tk.key !== id);
  Object.assign(viewer.on, {
    idle: onIdle,
    canDrag: (key) => key === id && map.canMove && Boolean(move()?.max),
    tapToken(key) { info = null; target = key === id || key === target ? null : key; onIdle(); },
    tapProp(pid) { info = info?.id === pid ? null : { kind: 'prop', id: pid }; onIdle(); },
    tapDoor(wid) { info = info?.id === wid ? null : { kind: 'door', id: wid }; onIdle(); },
    tapLaser(wid) { info = info?.id === wid ? null : { kind: 'laser', id: wid }; onIdle(); },
    tapSquare() { if (target || info) { target = null; info = null; onIdle(); } },
    reach: () => reachable(map, data, me(), move().max),
    route: (_key, to) => (others().some((o) => o.x === to.x && o.y === to.y) ? null : routeTo(map, data, me(), to, move().max)),
    readout: (n) => (n == null ? t('map.cantReach') : t('map.distance', { n, m: n * data.map.square.metres })),
    moveToken(_key, to) {
      const m = move();
      const check = m?.max ? checkMove(map, data, me(), to, m.max, others()) : { ok: false, code: 'blocked', max: 0 };
      if (!check.ok) { toast(t(`map.err.${check.code}`, { max: check.max }), 'danger'); return; }
      if (onMove(to, check.steps, m.combat)) { pending = { base: map, to }; onIdle(); }
    },
  });
  const hooks = markHooks({ map, data, id, marks, myColor, onIdle, send: onMark });
  Object.assign(viewer.on, hooks.on);
  const sight = sightTo(map, data, id, tokens);
  viewer.update({ key: map.id, map, tokens, you: id, fog: map.fog ? { mode: 'player', ...map.fog } : null, sight: sight && { from: sight.me, to: sight.tgt, result: sight.los.result }, marks: hooks.view });
  viewer.attach(main);
}

export const mapBusy = () => Boolean(viewer?.isBusy());
export const clearTarget = () => { target = null; info = null; };
/** Decision 76: what the map shows of the marker you tapped — 'thermal' (a heat signature only), 'seen', or null. */
export const targetSeen = (map, id) => {
  const tk = target && target !== id ? map?.tokens.find((x) => x.key === target) : null;
  return tk ? (tk.thermal ? 'thermal' : 'seen') : null;
};
export const mapFit = () => viewer?.fit();
export const mapZoom = (dir) => viewer?.zoom(dir);
