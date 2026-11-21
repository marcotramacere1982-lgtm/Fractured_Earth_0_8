// SVG drawing of a tactical map (decision 64), shared by the GM builder and the sheet's map view.
// Map coordinates are squares; the SVG works in data.map.square.units per square (100), the same scale as
// the prop library. Colours come from CSS classes (styles/map.css), so dark and light themes both work.

import { html, raw, escape } from '../dom.js';
import { propMarkup } from './props.js';
import { sensesOf, reachOf, GROUND, propDef, normRot } from '../../rules/props.js';
import { materialOf } from '../../rules/lighting.js'; // decision 358

const ORDER = { wall: 0, window: 1, door: 2, laser: 3 }; // doors and windows sit on top of the walls they cut; lasers over all

/** Grid patterns + the board (cols × rows squares). `prefix` keeps pattern ids unique per page. */
export function boardSvg(map, data, prefix = 'map') {
  const U = data.map.square.units;
  return html`<defs>
      <pattern id="${prefix}-sq" width="${U}" height="${U}" patternUnits="userSpaceOnUse"><path class="map-grid" d="M${U} 0H0V${U}"/></pattern>
      <pattern id="${prefix}-five" width="${U * 5}" height="${U * 5}" patternUnits="userSpaceOnUse"><path class="map-grid map-grid--major" d="M${U * 5} 0H0V${U * 5}"/></pattern>
    </defs>
    <rect class="map-board" width="${map.cols * U}" height="${map.rows * U}"/>
    <rect fill="url(#${prefix}-sq)" width="${map.cols * U}" height="${map.rows * U}"/>
    <rect fill="url(#${prefix}-five)" width="${map.cols * U}" height="${map.rows * U}"/>
    <rect class="map-edge" width="${map.cols * U}" height="${map.rows * U}"/>
    ${(map.floors ?? []).map((f) => html`<rect class="map-floor" x="${f.x * U}" y="${f.y * U}" width="${f.w * U}" height="${f.h * U}"/>
      <text class="map-floor__name" x="${f.x * U + U * 0.2}" y="${f.y * U + U * 0.45}">${f.name}</text>`)}`; // decision 184
}

/** One wall, door or window: built from numbers and fixed class names only, so safe as raw markup. */
function segment(w, data) {
  const U = data.map.square.units;
  const W = data.map.widths.find((x) => x.id === w.width)?.units ?? data.map.widths[1].units;
  const at = `x1="${w.a.x * U}" y1="${w.a.y * U}" x2="${w.b.x * U}" y2="${w.b.y * U}"`;
  const line = (cls, width, cap = 'butt', extra = '') => `<line class="${cls}" ${at} stroke-width="${width}" stroke-linecap="${cap}" ${extra}/>`;
  if (w.kind === 'laser') { // a dotted beam between two small emitters (decision 69); off and hidden only reach GM screens
    const state = `${w.on === false ? ' map-laser--off' : ''}${w.hidden ? ' map-laser--hidden' : ''}`;
    return line(`map-laser${state}`, U * 0.07, 'round', `stroke-dasharray="0.1 ${U * 0.16}"`)
      + [w.a, w.b].map((q) => `<circle class="map-laser__end${state}" cx="${q.x * U}" cy="${q.y * U}" r="${U * 0.07}"/>`).join('');
  }
  if (w.kind.startsWith('link_')) { // decision 119: kind = colour + dash; a fixed sideways offset per kind keeps parallel links apart
    const kind = w.kind.slice(5);
    const off = { people: 0, goods: 1, power: -1, data: 2, water: -2 }[kind] ?? 0;
    const len = Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y) || 1;
    const nx = (-(w.b.y - w.a.y) / len) * off * U * 0.09; const ny = ((w.b.x - w.a.x) / len) * off * U * 0.09;
    const ends = `x1="${w.a.x * U + nx}" y1="${w.a.y * U + ny}" x2="${w.b.x * U + nx}" y2="${w.b.y * U + ny}"`;
    const dash = { people: '', goods: `stroke-dasharray="${U * 0.22} ${U * 0.12}"`, power: `stroke-dasharray="${U * 0.03} ${U * 0.1}"`, data: `stroke-dasharray="${U * 0.22} ${U * 0.08} ${U * 0.04} ${U * 0.08}"`, water: '' }[kind] ?? '';
    const cls = `map-link map-link--${kind}${w.hidden ? ' map-link--hidden' : ''}`;
    return (kind === 'water' ? `<line class="${cls}" ${ends} stroke-width="${U * 0.13}" stroke-linecap="round"/><line class="map-link-core" ${ends} stroke-width="${U * 0.05}" stroke-linecap="round"/>`
      : `<line class="${cls}" ${ends} stroke-width="${U * 0.07}" stroke-linecap="round" ${dash}/>`)
      + (w.cut ? `<line class="map-link-cut" ${ends} stroke-width="${U * 0.12}" stroke-dasharray="${U * 0.1} ${U * 0.14}"/>` : '');
  }
  // doors and windows cut the wall they are drawn over: a gap as wide as the thickest wall goes under them
  const gap = line('map-gap', Math.max(...data.map.widths.map((x) => x.units)) + 2);
  if (w.kind === 'window') return gap + line('map-wall', W) + line('map-window', W * 0.45);
  if (w.kind === 'glass') { // a glass partition (decision 103): two pale lines; a breach like any weak wall
    if (w.broken) return line('map-glass map-glass--broken', W * 0.6, 'butt', `stroke-dasharray="${U * 0.12} ${U * 0.1}"`);
    return gap + line('map-glass', W) + line('map-glass-core', W * 0.35)
      + (w.cracks ? line('map-wall-crack', W * 0.45, 'butt', `stroke-dasharray="${U * 0.05} ${U * 0.13}"`) : '')
      + (w.breakable ? line('map-wall-weak', W * 0.3, 'butt', `stroke-dasharray="${U * 0.2} ${U * 0.1}"`) : '');
  }
  if (w.kind === 'door') return gap + (w.open
    ? line('map-door map-door--open', W * 0.6, 'butt', `stroke-dasharray="${U * 0.15} ${U * 0.1}"`)
    : line(`map-door${w.locked ? ' map-door--locked' : ''}`, W * 0.8)) // locked: only on GM screens (players never get it)
    + (w.powered ? line('map-door-slot', W * (w.open ? 0.2 : 0.26), 'butt', `stroke-dasharray="${U * 0.1} ${U * 0.06}"`) : ''); // decision 256: electric — sliding, no handle
  if (w.broken) return line('map-wall map-wall--broken', W * 0.6, 'butt', `stroke-dasharray="${U * 0.12} ${U * 0.1}"`); // a breach (decision 83)
  return line('map-wall', W, 'square')
    + (w.cracks ? line('map-wall-crack', W * 0.45, 'butt', `stroke-dasharray="${U * 0.05} ${U * 0.13}"`) : '') // the GM showed players it's weak
    + (w.breakable ? line('map-wall-weak', W * 0.3, 'butt', `stroke-dasharray="${U * 0.2} ${U * 0.1}"`) : ''); // GM screens only
}


/** Every segment, walls first; the selected one gets a highlight and its two end handles. */
export function wallsSvg(map, data, { selected = null } = {}) {
  const U = data.map.square.units;
  const sorted = map.walls.filter((w) => !w.kind.startsWith('link_')).sort((a, b) => ORDER[a.kind] - ORDER[b.kind]); // links: drawn by propsSvg, on the ground
  const sel = map.walls.find((w) => w.id === selected);
  const W = sel ? (data.map.widths.find((x) => x.id === sel.width)?.units ?? 0) : 0;
  return html`${raw(sorted.map((w) => segment(w, data)).join(''))}
    ${sel ? html`<line class="map-sel" x1="${sel.a.x * U}" y1="${sel.a.y * U}" x2="${sel.b.x * U}" y2="${sel.b.y * U}" stroke-width="${W + U * 0.16}" stroke-linecap="round"/>
      <circle class="map-handle" cx="${sel.a.x * U}" cy="${sel.a.y * U}" r="${U * 0.14}"/>
      <circle class="map-handle" cx="${sel.b.x * U}" cy="${sel.b.y * U}" r="${U * 0.14}"/>` : ''}`;
}

/**
 * Markers: a circle per character on its square with initials (players) or a letter (hostiles).
 * opts: you (this sheet's key), selected (GM), armed (GM, waiting to be placed — not drawn).
 * tk.color: a player's chosen colour (decision 82), the same as their marks.
 */
/**
 * Decision 294: floor areas — each texture (and turn) a pattern of its library drawing, each area one rectangle filled
 * with it. prefix: keeps the pattern ids apart when several maps share a page. selected: an area id (builder).
 */
export function areasSvg(areas, data, prefix = 'map', { selected = null, paint = false } = {}) {
  if (!areas?.length) return raw('');
  const U = data.map.square.units;
  const pid = (a) => `${prefix}-area-${a.tex}-${a.rot ?? 0}${paint && a.mat ? `-${a.mat}` : ''}`;
  const pats = new Map();
  for (const a of areas) {
    if (pats.has(pid(a))) continue;
    const m = propMarkup(a.tex);
    const def = propDef(data, a.tex);
    const body = m ? `<svg x="0" y="0" width="${U}" height="${U}" viewBox="${m.viewBox}" overflow="visible">${m.inner}</svg>` : `<rect class="map-prop__outline" width="${U}" height="${U}"/>`;
    const mat = paint ? materialOf(a, def, data) : null; // decision 358: the area's own, else the texture's
    pats.set(pid(a), `<pattern id="${pid(a)}" patternUnits="userSpaceOnUse" width="${U}" height="${U}"><g class="map-prop map-prop--${def?.category ?? 'floor'}${mat ? ` map-mat map-mat--${mat}` : ''}" transform="rotate(${a.rot ?? 0} ${U / 2} ${U / 2})">${body}</g></pattern>`);
  }
  const rects = areas.map((a) => `<rect class="map-area${a.id === selected ? ' is-selected' : ''}" x="${a.x * U}" y="${a.y * U}" width="${a.w * U}" height="${a.h * U}" fill="url(#${pid(a)})"/>`).join('');
  return raw(`<defs>${[...pats.values()].join('')}</defs><g class="map-areas">${rects}</g>`);
}

export function tokensSvg(tokens, data, { you = null, selected = null } = {}) {
  const U = data.map.square.units;
  return raw(tokens.map((tk) => {
    const cx = (tk.x + 0.5) * U;
    const cy = (tk.y + 0.5) * U;
    const cls = ['map-token', `map-token--${tk.kind}`, /^[a-z]+$/.test(tk.color ?? '') && `map-token--c-${tk.color}`, tk.key === you && 'map-token--you', tk.current && 'map-token--current', tk.thermal && 'map-token--thermal', tk.lit && 'map-token--lit',
      tk.down && 'map-token--down', tk.unaware && 'map-token--unaware', tk.hidden && 'map-token--hidden', tk.key === selected && 'map-token--selected'].filter(Boolean).join(' ');
    return `<g class="${cls}">${tk.current || tk.key === selected ? `<circle class="map-token__ring" cx="${cx}" cy="${cy}" r="${U * 0.42}"/>` : ''}`
      + `<circle class="map-token__disc" cx="${cx}" cy="${cy}" r="${U * 0.32}"/>`
      + `<text class="map-token__label" x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central" font-size="${U * (tk.label.length > 2 ? 0.22 : 0.28)}">${escape(tk.label)}</text>`
      + (tk.unaware ? `<text class="map-token__zzz" x="${cx + U * 0.3}" y="${cy - U * 0.3}" text-anchor="middle" dominant-baseline="central" font-size="${U * 0.3}">💤</text>` : '') + '</g>'; // decision 354
  }).join(''));
}

/**
 * Props (decision 68): each drawing inlined at its centre and rotation. Hidden ones are drawn faded (only the GM
 * screens get them); the selected one gets a dashed frame. An outline stands in until the drawing has loaded.
 */
const SENSE_TINT = { motion: 'red', audio: 'blue', touch: 'purple', video: 'cyan' };
/** A piece's colour: its own `tint`, else its sense (one sense) or cyan (video / several); null: the category's. */
export const tintOf = (def) => def.tint ?? (!sensesOf(def).length ? null : sensesOf(def).length === 1 ? SENSE_TINT[sensesOf(def)[0]] : 'cyan');

/** `links`: the map's walls; its links (decision 119) are drawn on the ground pieces and under the rest, so they run
 *  over terrain and city tiles and into a node instead of over it. */
export function propsSvg(props, data, { selected = null, links = null, paint = false } = {}) { // paint: decision 358 — pieces in their materials
  const U = data.map.square.units;
  // floor textures, city tiles (decision 121), decals on them (drains, stains, highways), links, darkness zones, terrain
  // and outlines, pieces that tuck under furniture (chairs), then the rest — each layer keeps the placing order (decision 102)
  const layerOf = (d) => { const cat = d?.category; return cat === 'floor' ? (d.decal ? 0.5 : 0) : cat === 'city' ? (d.decal ? 0.5 : 0.25) : cat === 'zone' ? 1 : GROUND.has(cat) ? 2 : d?.under ? 2.5 : 3; };
  const lv = new Map((props ?? []).map((p) => [p, layerOf(propDef(data, p.prop))])); // decision 292: once per piece, not per comparison
  const layer = (p) => lv.get(p);
  const ordered = [...(props ?? [])].sort((a, b) => layer(a) - layer(b));
  const linkMarkup = (links ?? []).filter((w) => w.kind.startsWith('link_')).map((w) => segment(w, data)).join('');
  const at = ordered.findIndex((p) => layer(p) >= 1);
  const parts = ordered.map((p) => {
    const def = propDef(data, p.prop);
    if (!def) return '';
    const w = def.size.w * U;
    const h = def.size.h * U;
    const m = propMarkup(p.prop);
    const body = m ? `<svg x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" viewBox="${m.viewBox}" overflow="visible">${m.inner}</svg>`
      : `<rect class="map-prop__outline" x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}"/>`;
    // sensors (decision 69): motion = a dotted line straight ahead (the front), audio = a dotted circle; both turn with the piece
    const senses = sensesOf(def);
    const tint = tintOf(def) ? ` map-prop--tint-${tintOf(def)}` : '';
    const mat = paint ? materialOf(p, def, data) : null;
    const look = mat ? ` map-mat map-mat--${mat}` : '';
    const dots = (gap) => `stroke-linecap="round" stroke-dasharray="0.1 ${U * gap}"`;
    const motion = senses.includes('motion') ? `<line class="map-sense map-sense--motion" x1="0" y1="${h / 2}" x2="0" y2="${h / 2 + reachOf(p, def, 'motion') * U}" stroke-width="${U * 0.05}" ${dots(0.14)}/>` : '';
    const audio = senses.includes('audio') ? `<circle class="map-sense map-sense--audio" r="${reachOf(p, def, 'audio') * U}" stroke-width="${U * 0.04}" ${dots(0.12)}/>` : '';
    // a selected light shows how far it reaches (decision 74)
    const reachRing = p.id === selected && def.light?.radius ? `<circle class="map-light-reach" r="${(def.light.radius + 0.5) * U}" stroke-width="${U * 0.04}" stroke-dasharray="${U * 0.12} ${U * 0.1}"/>` : '';
    // decision 361: a shop sign shows its caption, written along the sign (it turns with it)
    const upside = normRot(p.rot) > 90 && normRot(p.rot) <= 270; // the words always read the right way up
    const sign = def.sign && p.caption ? `<text class="map-sign"${upside ? ' transform="rotate(180)"' : ''} x="0" y="${(upside ? -1 : 1) * h * 0.08}" text-anchor="middle" dominant-baseline="central" font-size="${Math.min(h * 0.62, (w * 0.9) / Math.max(3, String(p.caption).length * 0.62))}">${escape(String(p.caption).toUpperCase())}</text>` : '';
    const frame = p.id === selected ? `<rect class="map-prop__sel" x="${-w / 2 - 8}" y="${-h / 2 - 8}" width="${w + 16}" height="${h + 16}"/>` : '';
    return `<g data-prop="${String(p.prop).replace(/[^\w-]/g, '')}" class="map-prop map-prop--${def.category}${tint}${look}${p.hidden ? ' map-prop--hidden' : ''}${p.on === false ? ' map-prop--off' : ''}${p.open ? ' map-prop--open' : ''}${p.wrecked ? ' map-prop--wrecked' : ''}" transform="translate(${p.x * U} ${p.y * U}) rotate(${p.rot ?? 0})">${audio}${motion}${reachRing}${body}${sign}${frame}</g>`;
  });
  parts.splice(at < 0 ? parts.length : at, 0, linkMarkup);
  return raw(parts.join(''));
}
