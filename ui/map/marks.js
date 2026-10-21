// Drawing of the marks on the table map (decision 82): crosshair, arrow, question mark, freehand line. Each is
// drawn twice — a dark halo, then the ink in the author's colour (CSS classes map-mark--c-<colour>) — so it reads
// on any floor. Built from numbers and fixed class names only, so the markup is safe as raw SVG.

import { markColor, secondsLeft } from '../../rules/marks.js';

const FADING = 20; // seconds: the last stretch before a mark fades shows it paler

function shape(m, U) {
  const P = m.points.map((p) => ({ x: p.x * U, y: p.y * U }));
  const [a] = P;
  if (m.tool === 'crosshair') {
    const r = U * 0.32;
    const tick = (dx, dy) => `M${a.x + dx * U * 0.14} ${a.y + dy * U * 0.14}L${a.x + dx * U * 0.5} ${a.y + dy * U * 0.5}`;
    return `<circle cx="${a.x}" cy="${a.y}" r="${r}"/><path d="${tick(1, 0)}${tick(-1, 0)}${tick(0, 1)}${tick(0, -1)}"/>`;
  }
  if (m.tool === 'question') {
    return `<circle cx="${a.x}" cy="${a.y}" r="${U * 0.34}"/><text class="map-mark__glyph" x="${a.x}" y="${a.y}" text-anchor="middle" dominant-baseline="central" font-size="${U * 0.46}">?</text>`;
  }
  if (m.tool === 'arrow') {
    const b = P[1] ?? a;
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    const head = (d) => `L${b.x - Math.cos(ang + d) * U * 0.35} ${b.y - Math.sin(ang + d) * U * 0.35}`;
    return `<path d="M${a.x} ${a.y}L${b.x} ${b.y}M${b.x} ${b.y}${head(0.5)}M${b.x} ${b.y}${head(-0.5)}"/>`;
  }
  return `<polyline points="${P.map((p) => `${p.x},${p.y}`).join(' ')}"/>`;
}

/**
 * marks: [{ id, by, color, tool, points, t, pinned }]; opts: { now, skew, selected, colors } — fading is measured on
 * the server's clock (skew = this screen's clock minus the server's); colors: { by: colour } from the markers on
 * the map, so a mark wears its author's marker colour.
 */
export function marksSvg(marks, data, { now = Date.now(), skew = 0, selected = null, colors = {} } = {}) {
  const U = data.map.square.units;
  const cfg = data.map.marks;
  return marks.map((m) => {
    const left = secondsLeft(m, cfg, now, skew);
    if (left === 0) return '';
    const cls = ['map-mark', `map-mark--c-${markColor(m.by, colors[m.by] ?? m.color, cfg)}`, left != null && left < FADING && 'map-mark--fading', m.id === selected && 'map-mark--selected'].filter(Boolean).join(' ');
    const body = shape(m, U);
    const pin = m.pinned ? `<circle class="map-mark__pin" cx="${(m.points[0].x + 0.32) * U}" cy="${(m.points[0].y - 0.32) * U}" r="${U * 0.09}"/>` : '';
    return `<g class="${cls}" stroke-width="${U * 0.07}"><g class="map-mark__halo" stroke-width="${U * 0.15}">${body}</g><g class="map-mark__ink">${body}</g>${pin}</g>`;
  }).join('');
}

/** The next moment a mark changes look (starts fading or disappears), in ms from now; null when none will. */
export function nextFade(marks, cfg, now = Date.now(), skew = 0) {
  const times = marks.map((m) => secondsLeft(m, cfg, now, skew)).filter((s) => s != null && s > 0)
    .flatMap((s) => [s - FADING, s].filter((x) => x > 0));
  return times.length ? Math.ceil(Math.min(...times) * 1000) + 50 : null;
}

/** The mark under a point (squares), among those `may(m)` allows: near a stamp's centre or along a line / arrow. */
export function markAt(marks, p, may = () => true) {
  const near = (q, r) => Math.hypot(q.x - p.x, q.y - p.y) <= r;
  const toSeg = (a, b) => {
    const dx = b.x - a.x; const dy = b.y - a.y;
    const k = dx || dy ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy))) : 0;
    return Math.hypot(p.x - (a.x + k * dx), p.y - (a.y + k * dy));
  };
  return [...marks].reverse().find((m) => may(m) && (m.points.length === 1
    ? near(m.points[0], 0.5)
    : m.points.some((q, i) => i > 0 && toSeg(m.points[i - 1], q) <= 0.3))) ?? null;
}
