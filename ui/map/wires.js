// Power wires on the GM's screens (decision 127): a line from piece to piece (an electric door: its middle),
// coloured by the source that feeds it, dashed red where cut; tags (S1, F1, SW1, D1) beside feeders and doors,
// and a "!" on anything powered that no wire reaches. Never drawn for players.

import { raw, escape } from '../dom.js';
import { powerState, circuitTags, unwired } from '../../rules/power.js';
import { autoJoins, networkState, networkTags, netRole, NET_NODES } from '../../rules/network.js';
import { propDef } from '../../rules/props.js';

/** Where a wire ends: a piece's centre, or a door's middle. null when the end is gone. */
export function wireEnd(map, id) {
  const p = (map.props ?? []).find((x) => x.id === id);
  if (p) return { x: p.x, y: p.y };
  const w = (map.walls ?? []).find((x) => x.id === id);
  return w ? { x: (w.a.x + w.b.x) / 2, y: (w.a.y + w.b.y) / 2 } : null;
}

/** The wire nearest to p within `tolerance` squares, or null. */
export function wireAt(map, p, tolerance) {
  let best = null;
  for (const w of map.wires ?? []) {
    const a = wireEnd(map, w.from);
    const b = wireEnd(map, w.to);
    if (!a || !b) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
    const d = Math.hypot(a.x + dx * t - p.x, a.y + dy * t - p.y);
    if (d <= tolerance && (!best || d < best.d)) best = { id: w.id, d };
  }
  return best?.id ?? null;
}

/** opts: armed (the feeder a run of wires starts from), selected (a wire id). */
export function wiresSvg(map, data, { armed = null } = {}) {
  const U = data.map.square.units;
  if (!(map.wires ?? []).some((w) => w.net !== 'data') && !armed) return raw('');
  const { via } = powerState(map, data);
  const sources = [...new Set([...via.values()])];
  const tags = circuitTags(map, data);
  const lines = (map.wires ?? []).filter((w) => w.net !== 'data').map((w) => { // data links: networkSvg
    const a = wireEnd(map, w.from);
    const b = wireEnd(map, w.to);
    if (!a || !b) return '';
    const c = via.has(w.from) ? sources.indexOf(via.get(w.from)) % 5 : 'none';
    return `<line class="map-wire map-wire--c${c}${w.cut ? ' map-wire--cut' : ''}" x1="${a.x * U}" y1="${a.y * U}" x2="${b.x * U}" y2="${b.y * U}" stroke-width="${U * 0.035}"/>`;
  }).join('');
  const label = (id, text, cls) => { const e = wireEnd(map, id); return e ? `<text class="map-wire__tag ${cls}" x="${e.x * U + U * 0.18}" y="${e.y * U - U * 0.14}" font-size="${U * 0.2}">${escape(text)}</text>` : ''; };
  const tagText = [...tags].map(([id, t]) => label(id, t, '')).join('');
  const missing = unwired(map, data).map((id) => label(id, '!', 'map-wire__tag--missing')).join('');
  const start = armed && wireEnd(map, armed);
  const ring = start ? `<circle class="map-wire__armed" cx="${start.x * U}" cy="${start.y * U}" r="${U * 0.32}" stroke-width="${U * 0.04}"/>` : '';
  return raw(`<g class="map-wires">${lines}${ring}${tagText}${missing}</g>`);
}

/**
 * The data network on the GM's screens (decision 129): cables solid, Wi-Fi links dashed, automatic Wi-Fi joins
 * dotted and faint, each access point's range as a faint ring; tags N1, R1, W1, RP1; a "?" on a networked device
 * that reaches no network. opts: armed (the node a run of links starts from).
 */
export function networkSvg(map, data, { armed = null } = {}) {
  const U = data.map.square.units;
  const nodes = (map.props ?? []).filter((p) => NET_NODES.includes(netRole(propDef(data, p.prop))));
  if (!nodes.length) return raw('');
  const line = (w, cls) => { const a = wireEnd(map, w.from); const b = wireEnd(map, w.to); return a && b ? `<line class="map-net ${cls}" x1="${a.x * U}" y1="${a.y * U}" x2="${b.x * U}" y2="${b.y * U}" stroke-width="${U * 0.03}"/>` : ''; };
  const links = (map.wires ?? []).filter((w) => w.net === 'data').map((w) => line(w, `${w.wifi ? 'map-net--wifi' : 'map-net--cable'}${w.cut ? ' map-net--cut' : ''}`)).join('');
  const joins = autoJoins(map, data).map((w) => line(w, 'map-net--auto')).join('');
  const rings = nodes.map((p) => { const r = propDef(data, p.prop)?.wifi?.radius; return r ? `<circle class="map-net__range" cx="${p.x * U}" cy="${p.y * U}" r="${(r + 0.5) * U}" stroke-width="${U * 0.02}"/>` : ''; }).join('');
  const tags = networkTags(map, data);
  const label = (id, text, cls) => { const e = wireEnd(map, id); const below = text === '?' && tags.has(id) ? U * 0.22 : 0; return e ? `<text class="map-wire__tag map-net__tag ${cls}" x="${e.x * U + U * 0.18}" y="${e.y * U + U * 0.3 + below}" font-size="${U * 0.2}">${escape(text)}</text>` : ''; };
  const state = networkState(map, data);
  const matters = (id) => { const d = propDef(data, (map.props ?? []).find((q) => q.id === id)?.prop); return NET_NODES.includes(netRole(d)) || d?.battery || d?.sensor || d?.category === 'sensor' || d?.category === 'security'; };
  const alone = [...state].filter(([id, s]) => s.status === 'alone' && matters(id)).map(([id]) => label(id, '?', 'map-wire__tag--missing map-net__missing')).join(''); // decision 137
  const start = armed && wireEnd(map, armed);
  const ring = start ? `<circle class="map-wire__armed" cx="${start.x * U}" cy="${start.y * U}" r="${U * 0.32}" stroke-width="${U * 0.04}"/>` : '';
  return raw(`<g class="map-network">${rings}${joins}${links}${ring}${[...tags].map(([id, t]) => label(id, t, '')).join('')}${alone}</g>`);
}
