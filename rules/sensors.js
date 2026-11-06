// Sensors that notice (decision 269). Until now sensors were drawn only (decision 69); this says which squares a
// sensor covers and whether it reports, so the GM's console can give a line when a player's marker comes into its
// coverage — never a consequence: the GM decides what it costs (Trace, a Stealth roll, nothing).
// Cameras (sense video) watch an arc (data: sensor.view, 90° directional, 360° all round) in front of them — the
// front is the drawing's bottom edge, turned with the piece — out to their range (sensor.reach.video, set per piece),
// only squares in sight (walls, closed doors) and not dark (unless the camera sees in the dark: sensor.night).
// Motion sensors watch a line straight ahead (their reach); audio a circle (its radius). Touch sensors stay narrative.
// A sensor that is off, wrecked, or on a network that is cut, fooled (looped) or without power reports nothing.
// Laser lines that are on trip when a move crosses them, hidden or not. Pure.

import { propDef, sensesOf, reachOf } from './props.js';
import { lineOfSight } from './map.js';
import { networkState, uplinkOf } from './network.js';

const key = (s) => `${s.x},${s.y}`;
const rad = (deg) => (deg * Math.PI) / 180;
/** The way a piece faces: its drawing's bottom edge, turned by rot (SVG rotate, clockwise). */
export const facing = (rot = 0) => ({ x: -Math.sin(rad(rot)), y: Math.cos(rad(rot)) });
const squareOf = (p) => ({ x: Math.floor(p.x), y: Math.floor(p.y) });

/**
 * Light for the cameras: (square) → true when it is dark there and no light reaches it. light: rules/light.js →
 * lightState's result (null: nothing is dark).
 */
export function darkTest(light) {
  if (!light) return () => false;
  const dark = new Set(light.dark);
  const lit = new Set(light.lit);
  return (sq) => (light.allDark || dark.has(key(sq))) && !lit.has(key(sq));
}

/** Does this sensor report right now? 'ok' | 'local' (works, on no network) | null (off, wrecked, cut, looped, no power). */
export function reporting(p, state) {
  if (p.on === false || p.wrecked) return null;
  const s = state.get(p.id);
  if (!s || s.status === 'alone') return 'local';
  return s.status === 'ok' ? 'ok' : null;
}

/** Which of its senses cover square sq (a sensor piece p). isDark: darkTest's. @returns ['video' | 'motion' | 'audio'] */
export function coversSquare(map, data, p, sq, isDark = () => false) {
  const def = propDef(data, p.prop);
  const out = [];
  const c = { x: sq.x + 0.5, y: sq.y + 0.5 };
  const v = { x: c.x - p.x, y: c.y - p.y };
  const dist = Math.hypot(v.x, v.y);
  const f = facing(p.rot);
  for (const sense of sensesOf(def)) {
    const reach = reachOf(p, def, sense);
    if (sense === 'video' && reach) {
      if (dist > reach + 0.5) continue;
      const arc = def.sensor.view ?? 360;
      if (arc < 360 && dist > 0.5 && (v.x * f.x + v.y * f.y) / dist < Math.cos(rad(arc / 2)) - 1e-9) continue;
      if (isDark(sq) && !def.sensor.night) continue;
      const from = squareOf(p);
      if ((from.x !== sq.x || from.y !== sq.y) && lineOfSight(map, data, from, sq).result === 'blocked') continue;
      out.push('video');
    } else if (sense === 'motion' && reach) {
      // the beam: from the piece's front edge straight ahead; a square counts when the beam passes within half a square of its centre
      const along = v.x * f.x + v.y * f.y;
      const across = Math.abs(v.x * f.y - v.y * f.x);
      if (along >= 0 && along <= reach + (def.size?.h ?? 0) / 2 + 0.5 && across <= 0.5) out.push('motion');
    } else if (sense === 'audio' && reach) {
      if (dist <= reach + 0.5) out.push('audio');
    }
  }
  return out;
}

/**
 * Every reporting sensor that covers any of these squares: [{ id, senses, net }] — net: the uplink id it reports to
 * (null: a local sensor). map: as it works now (power applied).
 */
export function sensorsCovering(map, data, squares, { light = null } = {}) {
  const isDark = darkTest(light);
  const state = networkState(map, data);
  const out = [];
  for (const p of map.props ?? []) {
    const def = propDef(data, p.prop);
    if (!sensesOf(def).length) continue;
    const r = reporting(p, state);
    if (!r) continue;
    const senses = new Set();
    for (const sq of squares) for (const s of coversSquare(map, data, p, sq, isDark)) senses.add(s);
    if (senses.size) out.push({ id: p.id, senses: [...senses], net: r === 'ok' ? uplinkOf(map, data, p.id, state) : null });
  }
  return out;
}

/** The squares one sensor covers now (for the GM's map). */
export function coverageOf(map, data, p, { light = null } = {}) {
  const isDark = darkTest(light);
  const def = propDef(data, p.prop);
  const reach = Math.max(0, ...sensesOf(def).map((s) => reachOf(p, def, s) ?? 0)) + Math.ceil((def.size?.h ?? 0) / 2) + 1;
  const out = [];
  for (let y = Math.max(0, Math.floor(p.y - reach)); y <= Math.min(map.rows - 1, Math.floor(p.y + reach)); y++) {
    for (let x = Math.max(0, Math.floor(p.x - reach)); x <= Math.min(map.cols - 1, Math.floor(p.x + reach)); x++) {
      if (coversSquare(map, data, p, { x, y }, isDark).length) out.push({ x, y });
    }
  }
  return out;
}
/** Every reporting sensor's covered squares (deduplicated), for the GM's overlay. */
export function allCoverage(map, data, { light = null } = {}) {
  const state = networkState(map, data);
  const seen = new Map();
  for (const p of map.props ?? []) {
    if (!sensesOf(propDef(data, p.prop)).length || !reporting(p, state)) continue;
    for (const sq of coverageOf(map, data, p, { light })) seen.set(key(sq), sq);
  }
  return [...seen.values()];
}

const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
/** Do segments p1-p2 and q1-q2 cross (touching counts)? */
function meet(p1, p2, q1, q2) {
  const d1 = cross(q1, q2, p1); const d2 = cross(q1, q2, p2);
  const d3 = cross(p1, p2, q1); const d4 = cross(p1, p2, q2);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0) || d1 === 0 || d2 === 0)
    && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0) || d3 === 0 || d4 === 0)
    && Math.min(p1.x, p2.x) <= Math.max(q1.x, q2.x) + 1e-9 && Math.min(q1.x, q2.x) <= Math.max(p1.x, p2.x) + 1e-9
    && Math.min(p1.y, p2.y) <= Math.max(q1.y, q2.y) + 1e-9 && Math.min(q1.y, q2.y) <= Math.max(p1.y, p2.y) + 1e-9;
}
/**
 * The laser lines that are on and that a move crosses: centre to centre through every square of the path
 * (path: the squares after `from`, the last one where they land). Hidden lasers count (the GM sees them).
 * @returns [laser wall ids]
 */
export function lasersCrossed(map, from, path) {
  const pts = [from, ...path].map((s) => ({ x: s.x + 0.5, y: s.y + 0.5 }));
  return (map.walls ?? []).filter((w) => w.kind === 'laser' && w.on !== false && !w.cut)
    .filter((w) => pts.slice(1).some((b, i) => meet(pts[i], b, w.a, w.b))).map((w) => w.id);
}
