// Light and dark on the table map (decision 74). A map's environment is *bright* (lights don't matter) or
// *dark*; Darkness zone tiles make their squares dark even in a bright one. In the dark a marker sees a square
// only when an on light covers it (within the light's radius, with a clear line from the light) or when it
// lies within the marker's dark sight (data.map.light.darkSight, 1 square). Walls still stop sight first:
// light never shows what's behind a closed door. Visual only for now: no rules effect (shooting into the dark,
// stealth) yet. Pure.

import { activeProps, propDef, insideProp } from './props.js';
import { sightHits } from './map.js';

/** Squares that are dark: every square in a dark environment, else those under a Darkness zone. Set of "x,y" or 'all'. */
export function darkSquares(map, data) {
  if (map.ambient === 'dark') return 'all';
  const out = new Set();
  for (const p of activeProps(map)) {
    if (propDef(data, p.prop)?.zone !== 'dark') continue;
    for (let x = Math.floor(p.x - 1); x <= Math.ceil(p.x + 1); x++) {
      for (let y = Math.floor(p.y - 1); y <= Math.ceil(p.y + 1); y++) {
        if (insideProp({ x: x + 0.5, y: y + 0.5 }, p, data)) out.add(`${x},${y}`);
      }
    }
  }
  return out;
}

/**
 * What a character sees with (decision 75), from what they carry: night vision (`vision.dark`: unlit squares up
 * to N), thermal (`vision.thermal`: people in the dark up to N — the Clip-On Thermal Lens, or a Scavenger's
 * optic in Thermal mode at its range), and a torch switched on (`play.torch` + an item with `light.carried`).
 * Items read like catalog entries, so a Forge unique with a `vision` or `light` field works too.
 */
export function visionOf(c, data) {
  const carried = (c.play?.inventory ?? []).filter((r) => r.kind === 'item' && r.qty > 0)
    .map((r) => r.unique ?? data.items.find((i) => i.id === r.id)).filter(Boolean);
  const best = (pick) => Math.max(0, ...carried.map(pick));
  let thermal = best((i) => i.vision?.thermal ?? 0);
  if (c.classId === 'scavenger') {
    const optic = data.optics.find((o) => o.id === c.play?.optic);
    if (optic?.mode === 'thermal') thermal = Math.max(thermal, optic.range);
  }
  return { dark: best((i) => i.vision?.dark ?? 0), thermal, torch: c.play?.torch ? best((i) => (i.light?.carried ? i.light.radius : 0)) : 0 };
}

/** Does this character carry something that lights up (a torch)? */
export const carriesTorch = (c, data) => (c.play?.inventory ?? []).some((r) => r.kind === 'item' && r.qty > 0 && (r.unique ?? data.items.find((i) => i.id === r.id))?.light?.carried);

/**
 * Squares an on light reaches: within its radius (centre to centre) and in its line of sight. Set of "x,y".
 * extra: carried lights, [{ x, y, radius }] centred on a square (a torch moves with its marker).
 */
export function litSquares(map, data, segs, extra = []) {
  const out = new Set();
  const sources = [
    ...activeProps(map).map((p) => ({ x: p.x, y: p.y, r: p.on === false ? 0 : propDef(data, p.prop)?.light?.radius ?? 0 })),
    ...extra.map((l) => ({ x: l.x + 0.5, y: l.y + 0.5, r: l.radius })),
  ];
  for (const p of sources) {
    const r = p.r;
    if (!r) continue;
    const A = { x: p.x, y: p.y };
    for (let x = Math.floor(p.x - r); x <= Math.ceil(p.x + r); x++) {
      for (let y = Math.floor(p.y - r); y <= Math.ceil(p.y + r); y++) {
        if (x < 0 || y < 0 || x >= map.cols || y >= map.rows) continue;
        const B = { x: x + 0.5, y: y + 0.5 };
        if (Math.hypot(B.x - A.x, B.y - A.y) > r + 0.5) continue;
        const [left, right] = sightHits(A, B, segs);
        if (!(left && right)) out.add(`${x},${y}`);
      }
    }
  }
  return out;
}

/**
 * Which squares are dark and which of them a light reaches (fixed lights, flares, torches): for the sheet's
 * darkness suggestions (decision 76). null when nothing is dark.
 */
export function lightState(map, data, segs, eyes = []) {
  const dark = darkSquares(map, data);
  if (dark !== 'all' && !dark.size) return null;
  const lit = litSquares(map, data, segs, eyes.filter((e) => e.torch).map((e) => ({ x: e.x, y: e.y, radius: e.torch })));
  return { allDark: dark === 'all', dark: dark === 'all' ? [] : [...dark], lit: [...lit] };
}

/**
 * A test for one eye: can it make this square out, light-wise? (sight through walls is checked elsewhere)
 * eyes: [{ x, y, dark?, torch? }] — every torch lights the squares round its marker for the whole crew;
 * an eye sees unlit squares within its dark sight (1, or its night vision).
 */
export function lightTest(map, data, segs, eyes = []) {
  const dark = darkSquares(map, data);
  if (dark !== 'all' && !dark.size) return () => true; // bright, no dark zones: lights don't matter
  const lit = litSquares(map, data, segs, eyes.filter((e) => e.torch).map((e) => ({ x: e.x, y: e.y, radius: e.torch })));
  const base = data.map.light.darkSight;
  return (eye, x, y) => {
    const k = `${x},${y}`;
    if (dark !== 'all' && !dark.has(k)) return true;
    return lit.has(k) || Math.max(Math.abs(eye.x - x), Math.abs(eye.y - y)) <= Math.max(base, eye.dark ?? 0);
  };
}
