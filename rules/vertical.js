// Seeing, shooting and dropping between floors (decision 287). A building's floors are frames side by side (decision
// 184): the same spot in each frame lines up, `level` says which is above which (decision 286). Pieces marked `open`
// in props.json (holes, an atrium, open air over a street) are squares with no slab: through them
//   · sight crosses floors — someone standing next to the opening (within 1 square: leaning over the rail) sees
//     down along the line through it, and is seen from below; walls on each floor still stop the line;
//   · a shot from above moves the target's cover one step down (full → half → none);
//   · stepping into an opening without a railing (no blocksMove) drops you to the same spot one floor down — a
//     deliberate drop, not a fall (the GM's ⚡ Harm → Fall is for being pushed, or more than one floor).
// Range between floors counts each level as FLOOR_HEIGHT squares (3 m). Pure.

import { activeProps, propDef, squaresUnder } from './props.js';
import { floorOf } from './floors.js';

/** Squares of height between two levels, for range (decision 287: 3 m a floor). */
export const FLOOR_HEIGHT = 2;
const EDGE_REACH = 1; // how near the opening you stand to look over it, or to be seen from below

const key = (x, y) => `${x},${y}`;

/** Global squares with no slab: Map "x,y" → { railed } (railed: an atrium void you can't step into). */
export function openSquares(map, data) {
  const out = new Map();
  if (!(map.floors ?? []).length) return out;
  for (const p of activeProps(map)) {
    const def = propDef(data, p.prop);
    if (!def?.open) continue;
    for (const s of squaresUnder(p, data)) out.set(key(s.x, s.y), { railed: Boolean(def.blocksMove) || Boolean(out.get(key(s.x, s.y))?.railed) });
  }
  return out;
}

const levelOf = (f) => f?.level ?? 0;
/** The floor at a level, or null. */
const floorAt = (map, level) => (map.floors ?? []).find((f) => levelOf(f) === level) ?? null;
/** A floor's square at local (lx, ly), or null when it's outside that floor. */
const onFloor = (f, lx, ly) => (f && lx >= 0 && ly >= 0 && lx < f.w && ly < f.h ? { x: f.x + lx, y: f.y + ly } : null);

/**
 * Is the column at local (lx, ly) open from level `lo` up to level `hi`? Every existing floor with lo < level ≤ hi
 * must have no slab there (a level with no floor drawn doesn't stop it).
 */
export function columnOpen(map, open, lo, hi, lx, ly) {
  for (const f of map.floors ?? []) {
    const l = levelOf(f);
    if (l <= lo || l > hi) continue;
    const s = onFloor(f, lx, ly);
    if (!s || !open.has(key(s.x, s.y))) return false;
  }
  return true;
}

/** Does the segment A-B pass through the square s (Liang–Barsky)? Points in squares. */
function through(A, B, s) {
  let t0 = 0;
  let t1 = 1;
  const dx = B.x - A.x;
  const dy = B.y - A.y;
  for (const [p, q] of [[-dx, A.x - s.x], [dx, s.x + 1 - A.x], [-dy, A.y - s.y], [dy, s.y + 1 - A.y]]) {
    if (Math.abs(p) < 1e-12) { if (q < 0) return null; continue; }
    const r = q / p;
    if (p < 0) t0 = Math.max(t0, r); else t1 = Math.min(t1, r);
    if (t0 > t1) return null;
  }
  return { t0, t1 };
}

/**
 * Sight between squares on two different floors (centres), or null when they're on the same floor / not on floors.
 * blocked(segA, segB) → true when walls stop a line between two global points (rules/map.js → sightHits on both sides).
 * @returns { ok, above: 'from' | 'to', portal: { x, y } (global square of the opening on the upper floor), height }
 */
export function crossSight(map, open, from, to, blocked) {
  const ff = floorOf(map, from);
  const ft = floorOf(map, to);
  if (!ff || !ft || ff === ft || levelOf(ff) === levelOf(ft)) return null;
  const upIsFrom = levelOf(ff) > levelOf(ft);
  const [U, fu, D, fd] = upIsFrom ? [from, ff, to, ft] : [to, ft, from, ff];
  const lo = levelOf(fd);
  const hi = levelOf(fu);
  const uL = { x: U.x + 0.5 - fu.x, y: U.y + 0.5 - fu.y }; // local, centres
  const dL = { x: D.x + 0.5 - fd.x, y: D.y + 0.5 - fd.y };
  const ux = U.x - fu.x;
  const uy = U.y - fu.y;
  const height = (hi - lo) * FLOOR_HEIGHT;
  for (let lx = ux - EDGE_REACH; lx <= ux + EDGE_REACH; lx++) {
    for (let ly = uy - EDGE_REACH; ly <= uy + EDGE_REACH; ly++) {
      if ((lx === ux && ly === uy) || !columnOpen(map, open, lo, hi, lx, ly)) continue;
      const hit = through(uL, dL, { x: lx, y: ly });
      if (!hit) continue; // the line doesn't go over this opening
      const enter = { x: uL.x + (dL.x - uL.x) * hit.t0, y: uL.y + (dL.y - uL.y) * hit.t0 };
      // the upper part: from the one standing above to the edge of the opening, on their floor
      if (blocked({ x: uL.x + fu.x, y: uL.y + fu.y }, { x: enter.x + fu.x, y: enter.y + fu.y })) continue;
      // the lower part: from under the opening to the one below, on their floor
      if (blocked({ x: enter.x + fd.x, y: enter.y + fd.y }, { x: dL.x + fd.x, y: dL.y + fd.y })) continue;
      return { ok: true, above: upIsFrom ? 'from' : 'to', portal: { x: fu.x + lx, y: fu.y + ly }, height };
    }
  }
  return { ok: false, above: upIsFrom ? 'from' : 'to', height };
}

/** Range between two squares on any floors, in squares: flat distance on the floor plan plus the height (3 m a level). */
export function squaresAcross(map, from, to) {
  const ff = floorOf(map, from);
  const ft = floorOf(map, to);
  const flat = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  if (!ff || !ft || ff === ft) return flat(from, to);
  const dh = Math.abs(levelOf(ff) - levelOf(ft)) * FLOOR_HEIGHT;
  const dx = Math.abs((from.x - ff.x) - (to.x - ft.x));
  const dy = Math.abs((from.y - ff.y) - (to.y - ft.y));
  return Math.round(Math.hypot(Math.max(dx, dy), dh));
}

/** Cover one step down for a shot from above (decision 287): full → half → none. */
export const coverFromAbove = (level) => (level === 'full' ? 'half' : 'none');

/**
 * Stepping into an opening without a railing: where you land — the same spot on the floor one level down, if that
 * square is on the floor and has a slab. null: no drop here (not open, railed, nothing below, or open below too).
 */
export function dropLanding(map, open, sq) {
  const o = open.get(key(sq.x, sq.y));
  if (!o || o.railed) return null;
  const f = floorOf(map, sq);
  if (!f) return null;
  const below = floorAt(map, levelOf(f) - 1);
  const s = onFloor(below, sq.x - f.x, sq.y - f.y);
  if (!s || open.has(key(s.x, s.y))) return null;
  return s;
}

/** The floor a square is on and the floor a level above / below it, for views and tools. */
export const floorAbove = (map, f) => floorAt(map, levelOf(f) + 1);
export const floorBelow = (map, f) => floorAt(map, levelOf(f) - 1);
