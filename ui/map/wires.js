// Power wires on the GM's screens (decision 127): a line from piece to piece (an electric door: its middle),
// coloured by the source that feeds it, dashed red where cut; tags (S1, F1, SW1, D1) beside feeders and doors,
// and a "!" on anything powered that no wire reaches. Never drawn for players.

import { raw, escape } from '../dom.js';
import { powerState, circuitTags, unwired } from '../../rules/power.js';

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
  if (!map.wires?.length && !armed) return raw('');
  const { via } = powerState(map, data);
  const sources = [...new Set([...via.values()])];
  const tags = circuitTags(map, data);
  const lines = (map.wires ?? []).map((w) => {
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
