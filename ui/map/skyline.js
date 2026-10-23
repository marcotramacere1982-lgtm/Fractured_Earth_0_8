// Skyline view (decision 123): a city map seen from above at an angle. The ground is the top-down drawing tilted to
// 45° and squashed 2:1 (tiles, water, highways, links, fog); buildings rise from each city tile, made from its
// recipe and height (skyline-recipes.js), drawn back to front; markers stand as pins. Look only: pan, zoom and tap
// a square (on.tapSquare) — moving, sight lines and marks stay in the top-down view.

import { escape } from '../dom.js';
import { boardSvg, propsSvg, wallsSvg, tintOf } from './render.js';
import { tileBoxes } from './skyline-recipes.js';
import { createCamera } from './camera.js';

const TAP_PX = 6;

/** Does this map have anything that grows a skyline? (the switch shows only then) */
export const hasSkyline = (map, data) => (map?.props ?? []).some((p) => data.props.props.find((d) => d.id === p.prop)?.skyline);

/** The projection for a map: ground squares (x, y) and a height z → view units, and back. */
export function projection(map, data) {
  const U = data.map.square.units;
  const H = U * 0.7; // half a square's width on screen; the diamond is 2H wide, H tall
  const Z = H * 1.25; // one height unit
  const top = 2.2 * Z; // room above the back row for the tallest towers
  const ox = map.rows * H;
  return {
    U, H, Z,
    at: (x, y, z = 0) => [ox + (x - y) * H, top + ((x + y) * H) / 2 - z * Z],
    ground: (sx, sy) => { const a = (sx - ox) / H; const b = (sy - top) / (H / 2); return { x: (a + b) / 2, y: (b - a) / 2 }; },
    matrix: `matrix(${H / U} ${H / (2 * U)} ${-H / U} ${H / (2 * U)} ${ox} ${top})`,
    size: { cols: ((map.cols + map.rows) * H) / U, rows: (((map.cols + map.rows) * H) / 2 + top) / U },
  };
}

/** A recipe's boxes in the tile's own frame, turned with the piece (90° steps). */
function turn(boxes, rot, W0, H0) {
  const r = ((rot ?? 0) % 360 + 360) % 360;
  if (!r) return boxes;
  return boxes.map((b) => (r === 90 ? { ...b, x: H0 - b.y - b.h, y: b.x, w: b.h, h: b.w }
    : r === 180 ? { ...b, x: W0 - b.x - b.w, y: H0 - b.y - b.h }
      : { ...b, x: b.y, y: W0 - b.x - b.w, w: b.h, h: b.w }));
}

const pts = (list) => list.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

/** Fog over the ground, in map units (the ground group tilts it). */
function fogPath(map, fog, U) {
  const seen = new Set(fog.seen);
  const now = new Set(fog.visible);
  let dark = '';
  let dim = '';
  for (let x = 0; x < map.cols; x++) for (let y = 0; y < map.rows; y++) {
    const k = `${x},${y}`;
    const r = `M${x * U} ${y * U}h${U}v${U}h${-U}z`;
    if (!seen.has(k)) dark += r; else if (!now.has(k)) dim += r;
  }
  return `<path class="map-fog map-fog--${fog.mode}" d="${dark}"/><path class="map-fog-dim map-fog-dim--${fog.mode}" d="${dim}"/>`;
}

/**
 * The whole view as SVG markup. state: { map, tokens, fog, selectedProp }. Players' maps arrive already cut by fog;
 * for them a tile nobody has seen grows nothing.
 */
export function skylineSvg(state, data, prefix = 'sky') {
  const { map, tokens = [], fog = null, selectedProp = null } = state;
  const P = projection(map, data);
  const seen = fog ? new Set(fog.seen) : null;
  const strOf = (v) => (typeof v === 'string' ? v : v[Object.getOwnPropertySymbols(v)[0]]);
  const flat = `<g transform="${P.matrix}">${strOf(boardSvg(map, data, prefix))}${strOf(propsSvg(map.props, data, { selected: selectedProp, links: map.walls }))}${strOf(wallsSvg(map, data))}${fog ? fogPath(map, fog, P.U) : ''}</g>`;
  // every box of every tile, in ground squares, then back to front
  const boxes = [];
  for (const p of map.props ?? []) {
    const def = data.props.props.find((d) => d.id === p.prop);
    if (!def?.skyline) continue;
    const turned = (p.rot ?? 0) % 180 !== 0;
    const W = turned ? def.size.h : def.size.w;
    const H = turned ? def.size.w : def.size.h;
    const x0 = p.x - W / 2;
    const y0 = p.y - H / 2;
    if (seen && fog.mode === 'player') {
      let any = false;
      for (let i = 0; i < W && !any; i++) for (let j = 0; j < H && !any; j++) any = seen.has(`${Math.floor(x0 + i)},${Math.floor(y0 + j)}`);
      if (!any) continue;
    }
    const tint = tintOf(def);
    const cls = `sky-box${tint ? ` sky-box--${tint}` : ''}${p.hidden ? ' sky-box--hidden' : ''}`;
    for (const b of turn(tileBoxes({ ...p, rot: 0 }, def), p.rot, def.size.w, def.size.h)) boxes.push({ ...b, x: x0 + b.x, y: y0 + b.y, cls });
  }
  boxes.sort((a, b) => (a.x + a.w / 2 + a.y + a.h / 2) - (b.x + b.w / 2 + b.y + b.h / 2) || a.z0 - b.z0);
  const solids = boxes.map((b) => {
    const [x1, y1] = [b.x + b.w, b.y + b.h];
    const top = pts([P.at(b.x, b.y, b.z1), P.at(x1, b.y, b.z1), P.at(x1, y1, b.z1), P.at(b.x, y1, b.z1)]);
    const right = pts([P.at(x1, b.y, b.z0), P.at(x1, y1, b.z0), P.at(x1, y1, b.z1), P.at(x1, b.y, b.z1)]);
    const left = pts([P.at(b.x, y1, b.z0), P.at(x1, y1, b.z0), P.at(x1, y1, b.z1), P.at(b.x, y1, b.z1)]);
    const look = b.look ? ` sky-box--${b.look}` : '';
    return `<g class="${b.cls}${look}"><polygon class="sky-l" points="${left}"/><polygon class="sky-r" points="${right}"/><polygon class="sky-top" points="${top}"/></g>`;
  }).join('');
  // markers: a pin standing on its square
  const pins = tokens.map((tk) => {
    const [gx, gy] = P.at(tk.x + 0.5, tk.y + 0.5, 0);
    const [hx, hy] = P.at(tk.x + 0.5, tk.y + 0.5, 0.75);
    const cls = ['map-token', `map-token--${tk.kind}`, /^[a-z]+$/.test(tk.color ?? '') && `map-token--c-${tk.color}`, tk.down && 'map-token--down', tk.hidden && 'map-token--hidden'].filter(Boolean).join(' ');
    return `<g class="${cls}"><line class="sky-pin" x1="${gx}" y1="${gy}" x2="${hx}" y2="${hy}"/><ellipse class="sky-pin__foot" cx="${gx}" cy="${gy}" rx="${P.H * 0.18}" ry="${P.H * 0.09}"/>`
      + `<circle class="map-token__disc" cx="${hx}" cy="${hy}" r="${P.U * 0.26}"/>`
      + `<text class="map-token__label" x="${hx}" y="${hy}" text-anchor="middle" dominant-baseline="central" font-size="${P.U * (tk.label.length > 2 ? 0.18 : 0.23)}">${escape(tk.label)}</text></g>`;
  }).join('');
  return { markup: `${flat}<g class="sky">${solids}</g>${pins}`, projection: P };
}

/** The city tile under a ground square (for a tap), or null. */
export function tileAt(map, data, sq) {
  for (const p of [...(map.props ?? [])].reverse()) {
    const def = data.props.props.find((d) => d.id === p.prop);
    if (def?.category !== 'city' || def.decal) continue;
    const turned = (p.rot ?? 0) % 180 !== 0;
    const W = turned ? def.size.h : def.size.w;
    const H = turned ? def.size.w : def.size.h;
    if (sq.x >= p.x - W / 2 && sq.x < p.x + W / 2 && sq.y >= p.y - H / 2 && sq.y < p.y + H / 2) return p.id;
  }
  return null;
}

/**
 * A look-only viewer for the skyline, the same shape as createMapViewer: { node, update, attach, on, isBusy, fit, zoom }.
 * on: { idle(), tapSquare({ x, y }) }
 */
export function createSkylineViewer({ data, prefix = 'sky', on = {} }) {
  const node = document.createElement('div');
  node.className = 'map-view map-view--skyline';
  node.innerHTML = '<svg class="map-view__svg" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" role="img"><g data-sky></g></svg>';
  const svg = node.querySelector('svg');
  const layer = node.querySelector('[data-sky]');
  let state = null;
  let P = null;
  let lastKey = null;
  let fitted = false;
  const cam = createCamera(svg, { units: data.map.square.units, size: () => P?.size ?? { cols: 10, rows: 10 } });
  const pointers = new Map();
  let gesture = null;

  function update(next) {
    if (next.key !== state?.key) fitted = false;
    state = next;
    const key = JSON.stringify([next.map, next.tokens, next.fog, next.selectedProp]);
    if (key === lastKey) return;
    lastKey = key;
    const out = skylineSvg(next, data, prefix);
    P = out.projection;
    layer.innerHTML = out.markup;
  }
  function settle() {
    if (!fitted && cam.rect().width) { cam.fit(); fitted = true; } else cam.keepAspect();
  }
  function attach(root) {
    const slot = root.querySelector('[data-map-slot]');
    if (slot) slot.replaceChildren(node);
    settle();
  }

  svg.addEventListener('wheel', (e) => cam.wheel(e), { passive: false });
  svg.addEventListener('pointerdown', (e) => {
    if (e.button === 1) e.preventDefault();
    svg.setPointerCapture?.(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    gesture = pointers.size === 2 ? { kind: 'pinch', ...cam.pinchStart(pointers) } : pointers.size === 1 ? { kind: 'pan', ...cam.panStart(e) } : gesture;
  });
  svg.addEventListener('pointermove', (e) => {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (gesture?.kind === 'pinch') cam.pinchMove(gesture, pointers);
    else if (gesture?.kind === 'pan' && cam.panMove(gesture, e) > TAP_PX) gesture.moved = true;
  });
  const up = (e) => {
    pointers.delete(e.pointerId);
    const g = gesture;
    if (g?.kind === 'pinch') { if (!pointers.size) { gesture = null; on.idle?.(); } return; }
    gesture = null;
    if (g?.kind === 'pan' && !g.moved && e.type !== 'pointercancel' && P) {
      const m = cam.toMap(e); // view units ÷ U
      const sq = P.ground(m.x * P.U, m.y * P.U);
      const at = { x: Math.floor(sq.x), y: Math.floor(sq.y) };
      if (at.x >= 0 && at.y >= 0 && at.x < state.map.cols && at.y < state.map.rows) on.tapSquare?.(at);
    }
    if (!pointers.size) on.idle?.();
  };
  svg.addEventListener('pointerup', up);
  svg.addEventListener('pointercancel', up);
  svg.addEventListener('auxclick', (e) => e.preventDefault());

  return { node, update, attach, on, isBusy: () => pointers.size > 0, fit: () => cam.fit(), zoom: (dir) => cam.zoomStep(dir) };
}
