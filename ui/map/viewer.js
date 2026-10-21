// The map on the table (decision 64, step 2): one persistent element showing a map and its markers, used by
// the GM console (interactive: drag markers, tap squares and doors) and by the sheet (look around).
// Screens re-render with innerHTML, so the host slots `node` back in after each render (attach) and holds its
// redraws while a finger is down (isBusy); `on.idle` tells it when to catch up.

import { render } from '../dom.js';
import { boardSvg, wallsSvg, tokensSvg, propsSvg } from './render.js';
import { loadProps } from './props.js';
import { hitProp } from '../../rules/props.js';
import { createCamera } from './camera.js';
import { marksSvg, nextFade, markAt } from './marks.js';
import { zonesSvg } from './zones.js';
import { zoneAt } from '../../rules/zones.js';
import { squareAt, onBoard, squaresBetween, doorAt, hitWall } from '../../rules/map.js';

const DRAG_PX = 6;
const DOOR_PX = 16;

/**
 * on: { moveToken(key, square), tapToken(key), tapProp(id), tapSquare(square), tapDoor(id), tapLaser(id), idle(), wantsSquare() → taps go to squares, readout(squares | null) → text,
 *       tapWall(id) (GM: a breakable or broken wall), tapZone(id) (GM: an event zone),
 *       canDrag(key) → may this marker be dragged (default: all), reach(key) → Map "x,y" → steps to shade (optional),
 *       route(key, to) → the squares walked from its square to `to`, or null when it can't get there (optional),
 *       marks (decision 82): markTool() → the tool being drawn with, or null (not marking); markColor() → the colour
 *       of the preview; drawMark({ tool, points }); mayTouch(mark) → can this screen pin / remove it; tapMark(id) }
 * interactive: markers can be dragged (GM, or a player's own marker); otherwise only pan and zoom.
 */
export function createMapViewer({ data, prefix, interactive = false, on = {} }) {
  const U = data.map.square.units;
  const node = document.createElement('div');
  node.className = 'map-view';
  node.innerHTML = `<svg class="map-view__svg" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" role="img"><g data-board></g><g data-props></g><g data-walls></g><g data-zones></g><g data-fog></g><g data-los></g><g data-tokens></g><g data-marks></g><g data-ghost></g></svg>
    <p class="map-view__readout mono" hidden></p>`;
  const svg = node.querySelector('svg');
  const board = node.querySelector('[data-board]');
  const propsLayer = node.querySelector('[data-props]');
  const wallsLayer = node.querySelector('[data-walls]');
  const tokensLayer = node.querySelector('[data-tokens]');
  const losLayer = node.querySelector('[data-los]');
  const fogLayer = node.querySelector('[data-fog]');
  const ghost = node.querySelector('[data-ghost]');
  const marksLayer = node.querySelector('[data-marks]');
  const zonesLayer = node.querySelector('[data-zones]');
  let fadeTimer = null;
  const readout = node.querySelector('.map-view__readout');
  let state = null; // { key, map: { cols, rows, walls, props }, tokens, you, selected, selectedProp, sight: { from, to, result } | null }
  let boardKey = '';
  let propsKey = '';
  let fitted = false;
  let gesture = null;
  const pointers = new Map();
  const cam = createCamera(svg, { units: U, size: () => state?.map ?? { cols: 10, rows: 10 } });

  function update(next) {
    if (next.key !== state?.key) fitted = false;
    state = next;
    const key = JSON.stringify([next.map.cols, next.map.rows, next.map.walls]);
    if (key !== boardKey) {
      boardKey = key;
      render(board, boardSvg(next.map, data, prefix));
      render(wallsLayer, wallsSvg(next.map, data));
    }
    const pk = JSON.stringify([next.map.props ?? [], next.selectedProp ?? null]);
    if (pk !== propsKey) {
      propsKey = pk;
      render(propsLayer, propsSvg(next.map.props, data, { selected: next.selectedProp }));
    }
    zonesLayer.innerHTML = next.map.zones?.length ? zonesSvg(next.map.zones, data, { selected: next.selectedZone }) : ''; // GM only: players' maps carry no zones
    render(tokensLayer, tokensSvg(next.tokens, data, next));
    losLayer.innerHTML = next.sight ? sightSvg(next.sight) : '';
    fogLayer.innerHTML = next.fog ? fogSvg(next.map, next.fog) : '';
    drawMarks();
    settle();
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
  /** Fits the first time the element has a size (it may be updated before it is on screen). */
  function settle() {
    if (!state || !cam.rect().width) return;
    if (!fitted) { cam.fit(); fitted = true; } else cam.keepAspect();
  }
  new ResizeObserver(settle).observe(svg);
  // the prop drawings arrive once; until then props show as outlines
  loadProps(data).then(() => { propsKey = ''; if (state) update(state); });

  /**
   * Fog of war (decision 71): squares never seen are covered (opaque for players, shaded for the GM), squares
   * remembered but not seen now are dimmed. fog: { mode: 'gm' | 'player', seen, visible } (lists or sets of "x,y").
   */
  function fogSvg(map, fog) {
    const seen = new Set(fog.seen);
    const now = new Set(fog.visible);
    let dark = '';
    let dim = '';
    for (let x = 0; x < map.cols; x++) {
      for (let y = 0; y < map.rows; y++) {
        const k = `${x},${y}`;
        const r = `M${x * U} ${y * U}h${U}v${U}h${-U}z`;
        if (!seen.has(k)) dark += r;
        else if (!now.has(k)) dim += r;
      }
    }
    return `<path class="map-fog map-fog--${fog.mode}" d="${dark}"/><path class="map-fog-dim map-fog-dim--${fog.mode}" d="${dim}"/>`;
  }

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
    const shade = reach ? [...reach.keys()].map((k) => { const [x, y] = k.split(',').map(Number); return `<rect class="map-reach" x="${x * U}" y="${y * U}" width="${U}" height="${U}"/>`; }).join('') : '';
    const route = on.route ? on.route(g.key, to) : [from, to];
    const out = Boolean(on.route) && !route;
    const path = route ?? [from, to];
    ghost.innerHTML = `${shade}<polyline class="map-ghost__path ${out ? 'map-ghost__path--out' : ''}" points="${path.map(c).join(' ')}" stroke-width="${U * 0.08}" fill="none"/>`
      + `<circle class="map-ghost ${out ? 'map-ghost--out' : ''}" cx="${(to.x + 0.5) * U}" cy="${(to.y + 0.5) * U}" r="${U * 0.42}"/>`;
    const n = route ? route.length - 1 : squaresBetween(from, to);
    showReadout(out ? (on.readout?.(null) ?? '—') : (on.readout?.(n) ?? `${n} sq · ${n * data.map.square.metres} m`));
  }
  function clearGhost() { ghost.innerHTML = ''; showReadout(null); }

  function onDown(e) {
    if (!state) return;
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
      if (onBoard(state.map, s)) g.to = s;
      if (g.moved) drawGhost(g);
    }
  }
  function onUp(e) {
    pointers.delete(e.pointerId);
    const g = gesture;
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
        const p = cam.toMap(e);
        const tk = on.tapToken ? tokenAt(p) : null;
        // markers, then furniture, then doors and lasers, then the floor under it all
        const prop = !tk && on.tapProp ? hitProp(state.map, data, p, { ground: false }) : null;
        const door = on.tapDoor ? doorAt(state.map, p, cam.pxToSq(DOOR_PX)) : null;
        const laser = !tk && !prop && !door && on.tapLaser ? hitWall({ ...state.map, walls: state.map.walls.filter((w) => w.kind === 'laser') }, p, cam.pxToSq(DOOR_PX)) : null;
        const weak = !tk && !prop && !door && !laser && on.tapWall ? hitWall({ ...state.map, walls: state.map.walls.filter((w) => w.breakable || w.broken) }, p, cam.pxToSq(DOOR_PX)) : null; // GM: breakable walls (decision 83)
        // terrain and outlines last; floor textures never (on the table they are only looks)
        const ground = !tk && !prop && !door && !laser && on.tapProp ? hitProp(state.map, data, p, { ground: 'only', floors: false }) : null;
        if (tk) on.tapToken(tk.key);
        else if (prop) on.tapProp(prop);
        else if (door) on.tapDoor(door);
        else if (laser) on.tapLaser(laser);
        else if (weak) on.tapWall(weak);
        else if (ground) on.tapProp(ground);
        else if (on.tapZone && zoneAt(state.map, p)) on.tapZone(zoneAt(state.map, p)); // GM event zones (decision 83)
        else if (onBoard(state.map, squareAt(p))) on.tapSquare?.(squareAt(p));
      }
    }
    if (!pointers.size) on.idle?.();
  }

  svg.addEventListener('pointerdown', onDown);
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

  return { node, update, attach, on, isBusy: () => pointers.size > 0, fit: () => cam.fit(), zoom: (dir) => cam.zoomStep(dir) };
}
