// Decision 366: enemies' eyes, ears and link — what an awake enemy notices during exploration rounds. Sight is the
// enemy's own: inside its cone (around the way it faces — an enemy never turned looks all round), within its range,
// a clear line, and light permitting (night vision sees unlit squares up to `dark`; thermal sees bodies up to
// `thermal` in the dark). Ears, motion and the link's alert are used by later steps. Pure.

import { sightSegments, sightHits } from './map.js';
import { lightTest, darkSquares, litSquares, torchesOf } from './light.js';

const NUM = ['cone', 'range', 'ears', 'dark', 'thermal', 'motion'];

/** An entry's awareness: its own values over the defaults, clamped; link one of the listed ids. */
export function awarenessOf(entry, data) {
  const a = data.awareness;
  const own = entry?.awareness ?? {};
  const out = {};
  for (const k of NUM) {
    const v = Number(own[k] ?? a.defaults[k]);
    const [lo, hi] = a.limits[k];
    out[k] = Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : a.defaults[k];
  }
  out.link = a.links.some((l) => l.id === own.link) ? own.link : a.defaults.link;
  return out;
}

/** Only the values that differ from the defaults (what an entry keeps), or null when it is all defaults. */
export function awarenessDiff(aw, data) {
  const d = data.awareness.defaults;
  const out = Object.fromEntries(Object.entries(aw ?? {}).filter(([k, v]) => k in d && v !== d[k]));
  return Object.keys(out).length ? out : null;
}

/** Is the square's centre inside the cone around `facing` (degrees, 0 = east, 90 = south)? No facing: all round. */
export function inCone(from, facing, cone, to) {
  if (facing == null || cone >= 360) return true;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (!dx && !dy) return true;
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const diff = Math.abs((((angle - facing) % 360) + 540) % 360 - 180);
  return diff <= cone / 2 + 1e-6;
}

/**
 * What enemies see on this map now. torchEyes: the players' eyes (a lit torch lights them up for everyone).
 * @returns { sees(enemy, square) → bool, view(enemy) → [squares], bright(square) → lit or not dark } — enemy: { x, y, facing?, aw }
 */
export function watchers(map, data, torchEyes = []) {
  const segs = sightSegments(map, data);
  const light = lightTest(map, data, segs, torchEyes);
  const dark = darkSquares(map, data);
  const lit = dark === 'all' || dark.size ? litSquares(map, data, segs, torchesOf(torchEyes)) : null;
  /** Decision 367: is there light on this square (not dark, or a light reaches it)? */
  // decision 371: torch beams and flares only — a night-vision enemy standing in them is dazzled
  const flares = new Set(data.awareness.goggles?.glare?.props ?? []);
  const glare = litSquares({ ...map, props: (map.props ?? []).filter((p) => flares.has(p.prop)) }, data, segs, torchesOf(torchEyes));
  const bright = (sq) => { const k = `${sq.x},${sq.y}`; return (dark !== 'all' && !dark.has(k)) || Boolean(lit?.has(k)); };
  function sees(en, sq) {
    const d = Math.max(Math.abs(sq.x - en.x), Math.abs(sq.y - en.y));
    if (d === 0) return true;
    const warm = en.aw.thermal > 0 && d <= en.aw.thermal;
    if (d > Math.max(en.aw.range, warm ? en.aw.thermal : 0)) return false;
    if (en.aw.dark > 0 && glare.has(`${en.x},${en.y}`) && !warm) return false; // dazzled: only thermal still works
    if (!inCone(en, en.facing, en.aw.cone, sq)) return false;
    if (!warm && !light({ x: en.x, y: en.y, dark: en.aw.dark }, sq.x, sq.y)) return false;
    const [l, r] = sightHits({ x: en.x + 0.5, y: en.y + 0.5 }, { x: sq.x + 0.5, y: sq.y + 0.5 }, segs);
    return !(l && r);
  }
  function view(en) {
    const reach = Math.max(en.aw.range, en.aw.thermal);
    const out = [];
    for (let x = Math.max(0, en.x - reach); x <= Math.min(map.cols - 1, en.x + reach); x++) {
      for (let y = Math.max(0, en.y - reach); y <= Math.min(map.rows - 1, en.y + reach); y++) if (sees(en, { x, y })) out.push({ x, y });
    }
    return out;
  }
  return { sees, view, bright };
}
