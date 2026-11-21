// The map on the table (decision 64, step 2): one persistent element showing a map and its markers, used by
// the GM console (interactive: drag markers, tap squares and doors) and by the sheet (look around).
// Screens re-render with innerHTML, so the host slots `node` back in after each render (attach) and holds its
// redraws while a finger is down (isBusy); `on.idle` tells it when to catch up.

import { render, html } from '../dom.js';
import { boardSvg, wallsSvg, tokensSvg, propsSvg, areasSvg } from './render.js';
import { loadProps } from './props.js';
import { hitProp, smallPropNear, propsUnder, propDef } from '../../rules/props.js';
import { isDistrict } from '../../rules/districts.js';
import { createTapCycle } from './tap-cycle.js'; // decision 301
import { createCamera } from './camera.js';
import { marksSvg, nextFade, markAt } from './marks.js';
import { zonesSvg, hazardsSvg } from './zones.js';
import { createLightLayer, drawsShapes } from './light-layer.js'; // decision 357
import { lightingOf } from '../../rules/lighting.js'; // decision 358
import { zoneAt } from '../../rules/zones.js';
import { squareAt, onBoard, squaresBetween, doorAt, hitWall } from '../../rules/map.js';
import { floorOf } from '../../rules/floors.js';
import { openSquares, floorBelow } from '../../rules/vertical.js';
import { t } from '../../i18n/index.js';

const DRAG_PX = 6;
const escapeHtml = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const DOOR_PX = 22;
const SMALL_PX = 14; // decision 135: how near a tap must be to a small piece (a switch, a socket) to take it // decision 124: was 16 — doors, lasers and links are thin

/**
 * on: { moveToken(key, square), tapToken(key), tapProp(id), tapSquare(square), tapDoor(id), tapLaser(id), idle(), wantsSquare() → taps go to squares, readout(squares | null) → text,
 *       tapWall(id) (GM: a breakable or broken wall), tapZone(id) (GM: an event zone),
 *       canDrag(key) → may this marker be dragged (default: all), reach(key) → Map "x,y" → steps to shade (optional),
 *       route(key, to) → the squares walked from its square to `to`, or null when it can't get there (optional),
 *       marks (decision 82): markTool() → the tool being drawn with, or null (not marking); markColor() → the colour
 *       of the preview; drawMark({ tool, points }); mayTouch(mark) → can this screen pin / remove it; tapMark(id);
 *       markIdleTap() → true: a mark you may touch is tapped even when not marking (decision 168) }
 * interactive: markers can be dragged (GM, or a player's own marker); otherwise only pan and zoom.
 */
export function createMapViewer({ data, prefix, interactive = false, on = {} }) {
  const U = data.map.square.units;
  const node = document.createElement('div');
  node.className = 'map-view';
  // decision 287: a building's floors stacked — the world is drawn once (data-world), shown through the current
  // floor's frame (data-stack, clipped), and again through that floor's openings, shifted up from the floor below
  node.innerHTML = `<svg class="map-view__svg" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" role="img"><defs data-defs></defs><g data-stack><g data-world id="${prefix}-world"><g data-board></g><g data-props></g><g data-walls></g><g data-zones></g><g data-fog></g><g data-los></g><g data-tokens></g><g data-marks></g></g></g><g data-under></g><g data-ghost></g></svg>
    <p class="map-view__readout mono" hidden></p><div class="map-floors" data-floors hidden></div>`;
  const svg = node.querySelector('svg');
  const board = node.querySelector('[data-board]');
  const propsLayer = node.querySelector('[data-props]');
  const cycle = createTapCycle(); // decision 301: tap again for what lies underneath
  let lastProp = null;
  const wallsLayer = node.querySelector('[data-walls]');
  const tokensLayer = node.querySelector('[data-tokens]');
  const losLayer = node.querySelector('[data-los]');
  const fogLayer = node.querySelector('[data-fog]');
  const ghost = node.querySelector('[data-ghost]');
  const marksLayer = node.querySelector('[data-marks]');
  const zonesLayer = node.querySelector('[data-zones]');
  const defs = node.querySelector('[data-defs]');
  const stack = node.querySelector('[data-stack]');
  const under = node.querySelector('[data-under]');
  const floorsBar = node.querySelector('[data-floors]');
  const MODE = `fe.map.floors.${prefix}`; // decision 287: stacked (one floor) or side by side, per device and view
  let stacked = (() => { try { return localStorage.getItem(MODE) !== 'side'; } catch { return true; } })();
  let floorId = null; // the floor shown when stacked
  let followed = null; // the floor of the marker the view follows, last time
  let floorKey = '';
  let fadeTimer = null;
  const readout = node.querySelector('.map-view__readout');
  let state = null; // { key, map: { cols, rows, walls, props }, tokens, you, selected, selectedProp, sight: { from, to, result } | null }
  let boardKey = '';
  let propsKey = '';
  let fitted = false;
  let framed = 'all'; // decision 133: Fit frames the focus (what was explored), again the whole map, and back
  let gesture = null;
  const pointers = new Map();
  const lightLayer = createLightLayer(data); // decision 357
  /** The map palette's fog colour, as the CSS has it here (the map keeps its own palette, whatever the theme). */
  const paletteColors = () => { const unseen = getComputedStyle(svg).getPropertyValue('--color-map-unseen').trim() || '#050608'; return { unseen, shade: unseen }; };
  const cam = createCamera(svg, { units: U, size: () => state?.map ?? { cols: 10, rows: 10 } });

  function update(next) {
    if (next.key !== state?.key) fitted = false;
    state = next;
    const paint = Boolean(lightingOf(next.map, data).paint); // decision 358: pieces in their materials' colours
    const key = JSON.stringify([next.map.cols, next.map.rows, next.map.walls, next.map.areas ?? null, paint]);
    if (key !== boardKey) {
      boardKey = key;
      render(board, html`${boardSvg(next.map, data, prefix)}${areasSvg(next.map.areas, data, prefix, { paint })}`); // decision 294: floor areas on the board
      render(wallsLayer, wallsSvg(next.map, data));
    }
    const links = (next.map.walls ?? []).filter((w) => w.kind.startsWith('link_')); // drawn with the pieces (decision 119)
    const pk = JSON.stringify([next.map.props ?? [], next.selectedProp ?? null, links, paint]);
    if (pk !== propsKey) {
      propsKey = pk;
      render(propsLayer, propsSvg(next.map.props, data, { selected: next.selectedProp, links, paint }));
    }
    zonesLayer.innerHTML = next.map.zones?.length ? zonesSvg(next.map.zones, data, { selected: next.selectedZone }) // GM only: players' maps carry no zones —
      : next.map.hazards?.length ? hazardsSvg(next.map.hazards, data) : ''; // decision 258: but the hazards on and shown
    render(tokensLayer, tokensSvg(next.tokens, data, next));
    losLayer.innerHTML = (next.coverage?.length ? next.coverage.map((s) => `<rect class="map-sensed" x="${s.x * U}" y="${s.y * U}" width="${U}" height="${U}"/>`).join('') : '') // decision 269: the sensors' coverage (GM)
      + (next.watch?.length ? watchSvg(next.watch, next.watchOwn) : '') + (next.sight ? sightSvg(next.sight) : ''); // decision 250: overwatch areas (GM); 251: your own, red
    // decision 357: the light layer (sight shapes, soft coloured light) unless the map keeps the classic look;
    // shown with fog (sheets, TV, the table's map) or when asked (the builder's light preview)
    const shapes = drawsShapes(next.map, data) && Boolean(next.fog || next.lighting);
    const lit = shapes ? lightLayer.draw(next.map, { fog: next.fog, tokens: next.tokens ?? [], colors: paletteColors() }) : null;
    fogLayer.innerHTML = (lit?.under ?? '') + (next.fog ? fogSvg(next.map, next.fog, shapes) : '') + (lit?.over ?? '');
    drawMarks();
    drawFloors();
    settle();
  }

  // ------------------------------------------------------------------ floors (decision 287)

  const floorsOf = () => [...(state?.map.floors ?? [])].sort((a, b) => (b.level ?? 0) - (a.level ?? 0));
  const current = () => (stacked ? floorsOf().find((f) => f.id === floorId) ?? null : null);
  /** Which floor to show: the followed marker's when it changes floor, else the one picked, else where most markers are. */
  function pickFloor() {
    const floors = floorsOf();
    if (!floors.length) { floorId = null; return; }
    const mine = state.follow ? state.tokens?.find((tk) => tk.key === state.follow) : null;
    const mf = mine ? floorOf(state.map, mine) : null;
    if (mf && mf.id !== followed) { followed = mf.id; floorId = mf.id; return; }
    const count = (f) => (state.tokens ?? []).filter((tk) => floorOf(state.map, tk) === f && tk.kind === 'player').length;
    if (state.crowd) { const top = [...floors].sort((a, b) => count(b) - count(a))[0]; if (count(top) > 0 || !floors.some((f) => f.id === floorId)) floorId = top.id; return; } // the TV: where most of the crew is
    if (floors.some((f) => f.id === floorId)) return;
    floorId = [...floors].sort((a, b) => count(b) - count(a))[0].id;
  }
  function clearFloors() { stack.removeAttribute('clip-path'); under.innerHTML = ''; defs.innerHTML = ''; }
  function drawFloors() {
    const floors = floorsOf();
    if (!floors.length) { floorsBar.hidden = true; clearFloors(); return; }
    pickFloor();
    const f = current();
    const shownFloor = f ?? floorsOf().find((fl) => fl.id === floorId);
    const tokensOn = (fl) => (state.tokens ?? []).filter((tk) => floorOf(state.map, tk) === fl);
    const you = state.you ? state.tokens?.find((tk) => tk.key === state.you) : null;
    floorsBar.hidden = Boolean(state.crowd); // the TV follows the crew by itself
    floorsBar.innerHTML = `${floors.map((fl) => {
      const n = tokensOn(fl).length;
      const here = you && floorOf(state.map, you) === fl;
      return `<button class="map-floors__btn${stacked && fl.id === shownFloor?.id ? ' is-on' : ''}" data-floor="${fl.id}" title="${escapeHtml(fl.name)}${here ? ` · ${escapeHtml(t('map.floorYou'))}` : ''}"><span class="mono">${fl.level ?? 0}</span>${here ? '<span class="map-floors__you">●</span>' : n ? `<span class="map-floors__n">${n}</span>` : ''}</button>`;
    }).join('')}<button class="map-floors__btn map-floors__mode" data-floor-mode title="${escapeHtml(t(stacked ? 'map.floorsAll' : 'map.floorsOne'))}">${stacked ? '◫' : '▤'}</button>`;
    if (!f) { clearFloors(); return; }
    const open = openSquares(state.map, data);
    const holes = [...open.keys()].map((k) => k.split(',').map(Number)).filter(([x, y]) => x >= f.x && y >= f.y && x < f.x + f.w && y < f.y + f.h);
    const below = floorBelow(state.map, f);
    const holePath = holes.map(([x, y]) => `M${x * U} ${y * U}h${U}v${U}h${-U}z`).join('');
    defs.innerHTML = `<clipPath id="${prefix}-floor-clip"><rect x="${f.x * U}" y="${f.y * U}" width="${f.w * U}" height="${f.h * U}"/></clipPath>`
      + (holes.length && below ? `<clipPath id="${prefix}-open-clip"><path d="${holePath}"/></clipPath>` : '');
    stack.setAttribute('clip-path', `url(#${prefix}-floor-clip)`);
    under.innerHTML = holes.length && below
      ? `<g clip-path="url(#${prefix}-open-clip)"><g transform="translate(${(f.x - below.x) * U} ${(f.y - below.y) * U})"><use href="#${prefix}-world"/></g><path class="map-open-depth" d="${holePath}"/></g>`
      : '';
    const k = `${f.id}|${state.key}`;
    if (k !== floorKey && cam.rect().width) { floorKey = k; cam.fit({ x: f.x, y: f.y, w: f.w, h: f.h }); fitted = true; }
  }
  floorsBar.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || !state) return;
    if (b.hasAttribute('data-floor-mode')) {
      stacked = !stacked;
      try { localStorage.setItem(MODE, stacked ? 'stack' : 'side'); } catch { /* private mode */ }
      floorKey = '';
      drawFloors();
      if (!stacked) cam.fit();
      return;
    }
    floorId = b.dataset.floor;
    if (!stacked) { stacked = true; try { localStorage.setItem(MODE, 'stack'); } catch { /* private mode */ } }
    floorKey = '';
    drawFloors();
  });
  /** Decision 287: a point the view shows — on the current floor, or seen through one of its openings (then the floor below). */
  function shownAt(p) {
    const f = current();
    if (!f) return p;
    if (p.x < f.x || p.y < f.y || p.x >= f.x + f.w || p.y >= f.y + f.h) return null;
    const s = squareAt(p);
    const below = floorBelow(state.map, f);
    if (below && openSquares(state.map, data).has(`${s.x},${s.y}`)) return { x: p.x - f.x + below.x, y: p.y - f.y + below.y, through: true };
    return p;
  }
  /** Marks (decision 82): state.marks = { list, skew, selected }; redrawn by itself when one starts to fade or goes. */
  function drawMarks() {
    clearTimeout(fadeTimer);
    const m = state?.marks;
    const colors = Object.fromEntries((state.tokens ?? []).filter((tk) => tk.color).map((tk) => [tk.key, tk.color]));
    marksLayer.innerHTML = m ? marksSvg(m.list, data, { skew: m.skew, selected: m.selected, colors }) : '';
    const wait = m ? nextFade(m.list, data.map.marks, Date.now(), m.skew) : null;
    if (wait != null) fadeTimer = setTimeout(drawMarks, wait);
  }
  /** Fits the first time the element has a size (it may be updated before it is on screen): to the focus when there is one. */
  function settle() {
    if (!state || !cam.rect().width) return;
    const f = current();
    const due = f && floorKey !== `${f.id}|${state.key}`; // decision 293: a floor change that came while the map was off screen (the sheet redrawing round it)
    if (!fitted || due) { cam.fit(f ? { x: f.x, y: f.y, w: f.w, h: f.h } : state.focus ?? null); fitted = true; framed = state.focus ? 'focus' : 'all'; if (f) floorKey = `${f.id}|${state.key}`; } else cam.keepAspect();
  }
  new ResizeObserver(settle).observe(svg);
  // the prop drawings arrive once; until then props show as outlines
  loadProps(data).then(() => { propsKey = ''; boardKey = ''; if (state) update(state); }); // areas fill with the drawings too

  /**
   * Fog of war (decision 71) and light (decision 191), four levels kept apart at a glance: never seen (covered —
   * opaque for players, shaded for the GM), remembered (washed out and hatched: a memory, not the dark), seen now
   * but in shadow (a night tint), seen now and lit by a light in the dark (a faint warm pool). fog: { mode: 'gm' |
   * 'player', seen, visible, light? } — light: { allDark, dark, lit } from rules/light.js → lightState.
   * Shadow shows where someone looks now; the GM also sees every light's pool, seen or not.
   */
  function fogSvg(map, fog, shapes = false) {
    if (shapes && fog.mode === 'player') return ''; // decision 357: the light layer draws the players' fog
    const seen = new Set(fog.seen);
    const now = new Set(fog.visible);
    const all = Boolean(fog.all); // fog off (GM): only the light is drawn
    const light = fog.light ?? null;
    const darkSet = new Set(light?.dark ?? []);
    const litSet = new Set(light?.lit ?? []);
    const isDark = (k) => Boolean(light) && (light.allDark || darkSet.has(k));
    const gm = fog.mode === 'gm';
    let cover = '';
    let memory = '';
    let shadow = '';
    let pool = '';
    for (let x = 0; x < map.cols; x++) {
      for (let y = 0; y < map.rows; y++) {
        const k = `${x},${y}`;
        const r = `M${x * U} ${y * U}h${U}v${U}h${-U}z`;
        const looking = all || now.has(k);
        if (!all && !seen.has(k)) cover += r;
        else if (!looking) memory += r;
        if (shapes) continue; // decision 357: light and darkness come from the light layer
        if (isDark(k) && litSet.has(k) && (looking || gm)) pool += r; // the GM sees every light's pool
        else if (isDark(k) && looking) shadow += r; // shadow only where someone looks: a dark map stays readable
      }
    }
    const hatch = `${prefix}-fog-hatch`;
    return `<defs><pattern id="${hatch}" patternUnits="userSpaceOnUse" width="${U / 3}" height="${U / 3}" patternTransform="rotate(45)"><line class="map-fog-hatch" x1="0" y1="0" x2="0" y2="${U / 3}" stroke-width="${U * 0.03}"/></pattern></defs>`
      + `<path class="map-shadow map-shadow--${fog.mode}" d="${shadow}"/><path class="map-pool" d="${pool}"/>`
      + `<path class="map-fog-dim map-fog-dim--${fog.mode}" d="${memory}"/><path class="map-fog-dim-hatch" fill="url(#${hatch})" d="${memory}"/>`
      + `<path class="map-fog map-fog--${fog.mode}" d="${cover}"/>`;
  }

  /** Decision 250: the squares someone on overwatch watches (the GM's map). */
  const watchSvg = (squares, own = false) => squares.map((s) => `<rect class="map-watch${own ? ' map-watch--own' : ''}" x="${s.x * U}" y="${s.y * U}" width="${U}" height="${U}"/>`).join('');
  /** The line of sight being checked: centre to centre, coloured clear / cover / blocked, a ring on the target. */
  function sightSvg({ from, to, result }) {
    const c = (sq) => [(sq.x + 0.5) * U, (sq.y + 0.5) * U];
    const [x1, y1] = c(from);
    const [x2, y2] = c(to);
    return `<line class="map-los map-los--${result}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke-width="${U * 0.07}"/>`
      + `<circle class="map-los__target map-los--${result}" cx="${x2}" cy="${y2}" r="${U * 0.5}" stroke-width="${U * 0.06}"/>`;
  }

  const tokenAt = (p) => { const s = squareAt(p); return state?.tokens.find((t) => t.x === s.x && t.y === s.y) ?? null; };
  function showReadout(text) { readout.hidden = !text; readout.textContent = text ?? ''; }
  /**
   * While a marker is dragged: where it would land, and how it gets there. With on.route (a player's own
   * marker) the line follows the real route round walls and the distance counts along it; a square it can't
   * reach shows red. Without it (the GM) it is a straight line: the GM puts markers anywhere.
   */
  function drawGhost(g) {
    const { from, to, reach } = g;
    const c = (s) => `${(s.x + 0.5) * U},${(s.y + 0.5) * U}`;
    // decision 293: the reachable squares are drawn once per drag; only the route and the ring follow the finger
    if (!g.shade) g.shade = reach ? [...reach.keys()].map((k) => { const [x, y] = k.split(',').map(Number); return `<rect class="map-reach" x="${x * U}" y="${y * U}" width="${U}" height="${U}"/>`; }).join('') : '';
    if (!ghost.querySelector(':scope > [data-shade]')) ghost.innerHTML = `<g data-shade>${g.shade}</g><g data-route></g>`;
    const route = on.route ? on.route(g.key, to) : [from, to];
    const out = Boolean(on.route) && !route;
    const path = route ?? [from, to];
    ghost.querySelector(':scope > [data-route]').innerHTML = `<polyline class="map-ghost__path ${out ? 'map-ghost__path--out' : ''}" points="${path.map(c).join(' ')}" stroke-width="${U * 0.08}" fill="none"/>`
      + `<circle class="map-ghost ${out ? 'map-ghost--out' : ''}" cx="${(to.x + 0.5) * U}" cy="${(to.y + 0.5) * U}" r="${U * 0.42}"/>`;
    const n = route ? route.length - 1 : squaresBetween(from, to);
    showReadout(out ? (on.readout?.(null) ?? '—') : (on.readout?.(n) ?? `${n} sq · ${n * data.map.square.metres} m`));
  }
  function clearGhost() { ghost.innerHTML = ''; showReadout(null); }

  function onDown(e) {
    if (!state) return;
    if (e.button === 1) { e.preventDefault(); svg.setPointerCapture(e.pointerId); gesture = { kind: 'pan', ...cam.panStart(e), middle: true }; svg.classList.add('is-grabbing'); return; } // hold the wheel to pan (decision 116)
    svg.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) { gesture = { kind: 'pinch', ...cam.pinchStart(pointers) }; clearGhost(); return; }
    if (pointers.size > 2) return;
    const tool = on.markTool?.();
    if (tool) { // marking (decision 82): a tap on a mark you may touch selects it; anything else draws
      const p = cam.toMap(e);
      const hit = state.marks ? markAt(state.marks.list, p, (m) => on.mayTouch?.(m)) : null;
      gesture = hit ? { kind: 'markTap', id: hit.id } : { kind: 'mark', tool, points: [p] };
      return;
    }
    const hit = interactive && on.moveToken ? tokenAt(cam.toMap(e)) : null;
    if (!hit && on.markIdleTap?.() && state.marks) { // decision 168: your own mark, tapped outside marking — select it
      const m = markAt(state.marks.list, cam.toMap(e), (x) => on.mayTouch?.(x));
      if (m) { gesture = { kind: 'markTap', id: m.id }; return; }
    }
    const tk = hit && (!on.canDrag || on.canDrag(hit.key)) ? hit : null;
    gesture = tk
      ? { kind: 'token', key: tk.key, from: { x: tk.x, y: tk.y }, to: { x: tk.x, y: tk.y }, sx: e.clientX, sy: e.clientY, reach: on.reach?.(tk.key) ?? null }
      : { kind: 'pan', ...cam.panStart(e) };
  }
  function onMove(e) {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture;
    if (!g) return;
    if (g.kind === 'pinch') cam.pinchMove(g, pointers);
    else if (g.kind === 'pan') { if (cam.panMove(g, e) > DRAG_PX) g.moved = true; }
    else if (g.kind === 'mark') {
      const p = cam.toMap(e);
      if (g.tool === 'line') g.points.push(p); else g.points = [g.points[0], p];
      const color = on.markColor?.();
      const preview = { id: '', by: color === 'gm' ? 'gm' : 'preview', color, tool: g.tool, points: g.tool === 'line' || g.tool === 'arrow' ? g.points : [p], t: Date.now(), pinned: true };
      ghost.innerHTML = marksSvg([preview], data);
    }
    else if (g.kind === 'token') {
      if (Math.hypot(e.clientX - g.sx, e.clientY - g.sy) > DRAG_PX) g.moved = true;
      const s = squareAt(cam.toMap(e));
      if (onBoard(state.map, s) && shownAt(cam.toMap(e))) g.to = s; // stacked: only squares of the floor shown (an opening: the drop)
      if (g.moved) drawGhost(g);
    }
  }
  function onUp(e) {
    pointers.delete(e.pointerId);
    const g = gesture;
    svg.classList.remove('is-grabbing');
    if (g?.middle) { gesture = null; on.idle?.(); return; } // a wheel-press pan never counts as a tap
    if (g?.kind === 'pinch') { if (!pointers.size) { gesture = null; on.idle?.(); } return; }
    gesture = null;
    clearGhost();
    if (g?.kind === 'mark' && e.type !== 'pointercancel') {
      const end = cam.toMap(e);
      on.drawMark?.({ tool: g.tool, points: g.tool === 'line' ? [...g.points, end] : g.tool === 'arrow' ? [g.points[0], end] : [end] });
    } else if (g?.kind === 'markTap' && e.type !== 'pointercancel') on.tapMark?.(g.id);
    if (g && e.type !== 'pointercancel' && g.kind !== 'mark' && g.kind !== 'markTap') {
      if (g.kind === 'token') {
        if (g.moved && (g.to.x !== g.from.x || g.to.y !== g.from.y)) on.moveToken?.(g.key, g.to);
        else if (!g.moved) on.tapToken?.(g.key);
      } else if (g.kind === 'pan' && !g.moved && interactive && on.wantsSquare?.() && onBoard(state.map, squareAt(cam.toMap(e)))) {
        on.tapSquare?.(squareAt(cam.toMap(e))); // placing a marker (or editing fog): the square, whatever lies on it
      } else if (g.kind === 'pan' && !g.moved && interactive) {
        const seen = shownAt(cam.toMap(e)); // decision 287: off the shown floor, nothing; through an opening, the floor below
        if (!seen) { if (!pointers.size) on.idle?.(); return; }
        const p = seen.through ? seen : cam.toMap(e);
        const tk = on.tapToken ? tokenAt(p) : null;
        const again = !tk && on.tapProp ? cycle.next(p, propsUnder(state.map, data, p, { tolerance: cam.pxToSq(SMALL_PX), floors: false }), lastProp) : null; // decision 301
        if (again) { lastProp = again; on.tapProp(again); if (!pointers.size) on.idle?.(); return; }
        // decision 135: small pieces first when the tap is on one, and within reach when nothing else is hit
        const small = !tk && on.tapProp ? smallPropNear(state.map, data, p, cam.pxToSq(SMALL_PX)) : null;
        // markers, then furniture, then doors and lasers, then the floor under it all
        const prop = !tk && on.tapProp ? hitProp(state.map, data, p, { ground: false }) : null;
        const door = on.tapDoor ? doorAt(state.map, p, cam.pxToSq(DOOR_PX)) : null;
        const doorOnLine = !tk && on.tapDoor ? doorAt(state.map, p, cam.pxToSq(8)) : null; // right on a door: the door, even under a sign or a desk
        const laser = !tk && !prop && !door && on.tapLaser ? hitWall({ ...state.map, walls: state.map.walls.filter((w) => w.kind === 'laser' || w.kind.startsWith('link_')) }, p, cam.pxToSq(DOOR_PX)) : null;
        const weak = !tk && !prop && !door && !laser && on.tapWall ? hitWall({ ...state.map, walls: state.map.walls.filter((w) => w.breakable || w.broken) }, p, cam.pxToSq(DOOR_PX)) : null; // GM: breakable walls (decision 83)
        // terrain and outlines last; floor textures never (on the table they are only looks)
        const ground = !tk && !prop && !door && !laser && on.tapProp ? hitProp(state.map, data, p, { ground: 'only', floors: false }) : null;
        // decision 301: on a city map a road, rail or river drawn over a district never hides it — the district first (tap again: the road)
        const overDistrict = (id) => { const d = id && propDefOf(id); return d?.category === 'city' && d.decal ? propsUnder(state.map, data, p, { floors: false }).find((x) => isDistrict(propDefOf(x))) ?? id : id; };
        const propDefOf = (id) => propDef(data, state.map.props.find((x) => x.id === id)?.prop);
        const groundPick = overDistrict(ground);
        lastProp = tk ? null : small?.on ? small.id : doorOnLine ? null : small ? small.id : overDistrict(prop) ?? (door || laser || weak ? null : groundPick);
        if (tk) on.tapToken(tk.key);
        else if (small?.on) on.tapProp(small.id);
        else if (doorOnLine) on.tapDoor(doorOnLine);
        else if (small) on.tapProp(small.id);
        else if (prop) on.tapProp(overDistrict(prop));
        else if (door) on.tapDoor(door);
        else if (laser) on.tapLaser(laser);
        else if (weak) on.tapWall(weak);
        else if (ground) on.tapProp(groundPick);
        else if (on.tapZone && zoneAt(state.map, p)) on.tapZone(zoneAt(state.map, p)); // GM event zones (decision 83)
        else if (onBoard(state.map, squareAt(p))) on.tapSquare?.(squareAt(p));
      }
    }
    if (!pointers.size) on.idle?.();
  }

  svg.addEventListener('pointerdown', onDown);
  const noAutoscroll = (e) => { if (e.button === 1) e.preventDefault(); }; // keep the browser's middle-click autoscroll off the map
  svg.addEventListener('mousedown', noAutoscroll);
  svg.addEventListener('auxclick', noAutoscroll);
  svg.addEventListener('pointermove', onMove);
  svg.addEventListener('pointerup', onUp);
  svg.addEventListener('pointercancel', onUp);
  svg.addEventListener('wheel', cam.wheel, { passive: false });
  svg.addEventListener('contextmenu', (e) => e.preventDefault());

  /** Puts the element inside the host's `[data-map-slot]` (the slot keeps its size and styling). */
  function attach(root) {
    const slot = root.querySelector('[data-map-slot]');
    if (slot) slot.replaceChildren(node);
    settle();
  }

  return { node, update, attach, on, isBusy: () => pointers.size > 0,
    fit: () => { const cf = current(); if (cf) { cam.fit({ x: cf.x, y: cf.y, w: cf.w, h: cf.h }); return; } const f = state?.focus; if (f && framed !== 'focus') { cam.fit(f); framed = 'focus'; } else { cam.fit(); framed = 'all'; } },
    zoom: (dir) => cam.zoomStep(dir),
    pan: (fx, fy) => cam.nudge(fx, fy), // decision 337: the GM's arrows for the TV
    floors: () => floorsOf().map((f) => ({ id: f.id, name: f.name ?? '' })),
    /** Decision 287: the floor shown (null: side by side or no floors), and show one. */
    floor: () => current(), showFloor: (id) => { floorId = id; floorKey = ''; drawFloors(); } };
}

/**
 * Decision 133: the part of a map worth framing — every square seen and every marker, a square of margin, at least
 * 8 × 6 squares, inside the map. null when there's nothing to frame (no fog: the whole map is known).
 */
export function focusBox(map, seen, tokens = []) {
  const pts = [...(seen ?? []).map((k) => k.split(',').map(Number)), ...tokens.map((tk) => [tk.x, tk.y])];
  if (!seen || !pts.length) return null;
  let x0 = Math.min(...pts.map((p) => p[0])) - 1;
  let y0 = Math.min(...pts.map((p) => p[1])) - 1;
  let x1 = Math.max(...pts.map((p) => p[0])) + 2;
  let y1 = Math.max(...pts.map((p) => p[1])) + 2;
  const grow = (a, b, min, max) => { const need = min - (b - a); return need > 0 ? [a - need / 2, b + need / 2] : [a, b]; };
  [x0, x1] = grow(x0, x1, 8);
  [y0, y1] = grow(y0, y1, 6);
  const slide = (a, b, max) => (a < 0 ? [0, Math.min(max, b - a)] : b > max ? [Math.max(0, a - (b - max)), max] : [a, b]); // near an edge: slide inside, keep the size
  [x0, x1] = slide(x0, x1, map.cols);
  [y0, y1] = slide(y0, y1, map.rows);
  return x1 - x0 >= map.cols - 1 && y1 - y0 >= map.rows - 1 ? null : { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
