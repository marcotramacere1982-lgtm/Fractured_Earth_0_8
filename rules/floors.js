// Floors (decision 184): a building's floors drawn side by side on one map. Each floor is a rectangle of squares;
// its outline stops sight and movement (so the line-of-sight, fog and route rules keep floors apart with no other
// change), and stairs / lifts linked in pairs are the only way across: stepping onto one, you come out on its
// partner for a few squares of movement. Floors and links are public (players see the building's layout). Pure.

import { activeProps, propDef, squaresUnder } from './props.js';

const MAX_FLOORS = 8;
const int = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(v) || 0)));

/** Pieces that can carry a floor link: stairs, ramps, ladders — and any piece marked `floorLink` in props.json
 * (decision 285: manholes, hatches, floor vents and holes, skylights, a rooftop hut, scaffolding — the ways in that
 * aren't stairs). Decision 289: lifts don't — a lift serves many floors, can be stopped, called, held; until it is a
 * device of its own, the GM moves whoever rides it. */
export const isLift = (def) => /elevator|lift/i.test(def?.id ?? '');
export const isStairs = (def) => Boolean(def) && !isLift(def) && (def.floorLink === true || def.category === 'level' || /stair|ladder/i.test(def.id));

/** Decision 286: what one floor of height costs a signal crossing it, in squares (3 m and a concrete slab). */
export const FLOOR_SQUARES = 4;

/**
 * Decision 286: the distance a signal travels between two points (squares, piece centres) — ping, wireless links,
 * audio sensors. On a map with floors, both are placed on their own floor: the same spot on each floor lines up (floors
 * are drawn in frames side by side), and each floor of difference adds FLOOR_SQUARES. A point outside every floor never
 * reaches one inside (the gap between frames isn't a place). Without floors: the plain distance.
 */
export function spaceDistance(map, a, b) {
  if (!(map.floors ?? []).length) return Math.hypot(a.x - b.x, a.y - b.y);
  const fa = floorOf(map, a);
  const fb = floorOf(map, b);
  if (!fa || !fb) return fa || fb ? Infinity : Math.hypot(a.x - b.x, a.y - b.y);
  const dz = Math.abs((fa.level ?? 0) - (fb.level ?? 0)) * FLOOR_SQUARES;
  return Math.hypot((a.x - fa.x) - (b.x - fb.x), (a.y - fa.y) - (b.y - fb.y), dz);
}

/** The floor a square lies on, or null (outside every floor). */
export const floorOf = (map, s) => (map.floors ?? []).find((f) => s.x >= f.x && s.y >= f.y && s.x < f.x + f.w && s.y < f.y + f.h) ?? null;

/** The outline of every floor, as wall-like segments: sight and movement never cross one. */
export const floorEdges = (map) => (map.floors ?? []).flatMap((f) => {
  const [a, b, c, d] = [{ x: f.x, y: f.y }, { x: f.x + f.w, y: f.y }, { x: f.x + f.w, y: f.y + f.h }, { x: f.x, y: f.y + f.h }];
  return [{ a, b, kind: 'floor' }, { a: b, b: c, kind: 'floor' }, { a: c, b: d, kind: 'floor' }, { a: d, b: a, kind: 'floor' }];
});

/** Where a linked staircase leads: "x,y" of a square on one piece → the squares of its partner. */
export function linkJumps(map, data) {
  const props = new Map(activeProps(map).map((p) => [p.id, p]));
  const out = new Map();
  for (const l of map.floorLinks ?? []) {
    const a = props.get(l.a);
    const b = props.get(l.b);
    if (!a || !b) continue;
    const sa = squaresUnder(a, data);
    const sb = squaresUnder(b, data);
    for (const [from, to] of [[sa, sb], [sb, sa]]) for (const s of from) out.set(`${s.x},${s.y}`, [...(out.get(`${s.x},${s.y}`) ?? []), ...to]);
  }
  return out;
}

/**
 * Ending a move on a linked staircase takes you across: the square of its partner in the same place on the piece
 * (the next free one if someone stands there), or null when `sq` isn't on a linked piece or the partner is full.
 */
export function stairLanding(map, data, sq, occupied = []) {
  const props = new Map(activeProps(map).map((p) => [p.id, p]));
  for (const l of map.floorLinks ?? []) {
    for (const [here, there] of [[props.get(l.a), props.get(l.b)], [props.get(l.b), props.get(l.a)]]) {
      if (!here || !there) continue;
      const i = squaresUnder(here, data).findIndex((s) => s.x === sq.x && s.y === sq.y);
      if (i < 0) continue;
      const to = squaresUnder(there, data);
      const free = (s) => !occupied.some((o) => o.x === s.x && o.y === s.y);
      return [to[i], ...to].find((s) => s && free(s)) ?? null;
    }
  }
  return null;
}

/**
 * Owner hotfix 2026-11-14: standing on a linked staircase — where it leads, to ask the player (Go up / down, or stay):
 * { land, from, to, dir: 'up' | 'down' | 'across' } (from / to: the floors), or null (not on one, or its partner is full).
 */
export function stairsAt(map, data, sq, occupied = []) {
  if (!sq) return null;
  const land = stairLanding(map, data, sq, occupied);
  if (!land) return null;
  const from = floorOf(map, sq);
  const to = floorOf(map, land);
  const lv = (f) => f?.level ?? (map.floors ?? []).indexOf(f); // a floor with no level: its place in the list
  const d = lv(to) - lv(from);
  return { land, from, to, dir: d > 0 ? 'up' : d < 0 ? 'down' : 'across' };
}

/** The piece a linked piece leads to, or null. */
export const partnerOf = (map, propId) => {
  const l = (map.floorLinks ?? []).find((x) => x.a === propId || x.b === propId);
  return l ? (l.a === propId ? l.b : l.a) : null;
};

/** n floors side by side across the map's width, one empty column between them, the full height each. */
export function splitFloors(map, n) {
  const count = int(n, 1, MAX_FLOORS);
  if (count < 2) return { ...map, floors: [], floorLinks: [] };
  const w = Math.floor((map.cols - (count - 1)) / count);
  if (w < 2) return map;
  return { ...map, floors: Array.from({ length: count }, (_, i) => ({ id: `f${i + 1}`, name: i === 0 ? 'Ground floor' : `Floor ${i}`, x: i * (w + 1), y: 0, w, h: map.rows })) };
}

/** A floor's default name from its level. */
export const levelName = (level) => (level < -1 ? `Basement ${-level}` : level === -1 ? 'Basement' : level === 0 ? 'Ground floor' : `Floor ${level}`);

/**
 * Decision 288: one more floor, the same size as the first, framed to the right of the others (the map grows to fit;
 * the first time, the whole map becomes the ground floor). `below`: one level under the lowest, else over the highest.
 * Returns the map, or null when there's no room (maxCols) or already MAX_FLOORS.
 */
export function addFloor(map, { below = false, maxCols = 200 } = {}) {
  const now = map.floors?.length ? map.floors : [{ id: 'f1', name: levelName(0), x: 0, y: 0, w: map.cols, h: map.rows, level: 0 }];
  if (now.length >= MAX_FLOORS) return null;
  const base = now[0];
  const x = Math.max(...now.map((f) => f.x + f.w)) + 1;
  if (x + base.w > maxCols) return null;
  const levels = now.map((f) => f.level ?? 0);
  const level = below ? Math.min(...levels) - 1 : Math.max(...levels) + 1;
  const used = new Set(now.map((f) => f.id));
  let n = now.length + 1;
  while (used.has(`f${n}`)) n++;
  return { ...map, cols: Math.max(map.cols, x + base.w), floors: [...now, { id: `f${n}`, name: levelName(level), x, y: base.y, w: base.w, h: base.h, level }] };
}

/** Decision 288: takes a floor's frame away (what is drawn there stays); the last one left goes too. Links on it go. */
export function removeFloor(map, id, data) {
  const gone = (map.floors ?? []).find((f) => f.id === id);
  if (!gone) return map;
  const rest = map.floors.filter((f) => f.id !== id);
  if (rest.length < 2) return { ...map, floors: [], floorLinks: [] };
  const props = new Map((map.props ?? []).map((p) => [p.id, p]));
  const onGone = (pid) => { const p = props.get(pid); return p && floorOf({ floors: [gone] }, squaresUnder(p, data)[0] ?? { x: -1, y: -1 }); };
  return { ...map, floors: rest, floorLinks: (map.floorLinks ?? []).filter((l) => !onGone(l.a) && !onGone(l.b)) };
}

/** Links one stair piece to another (each piece has at most one partner); `to` null unlinks. */
export function linkStairs(map, propId, to) {
  const keep = (map.floorLinks ?? []).filter((l) => l.a !== propId && l.b !== propId && (!to || (l.a !== to && l.b !== to)));
  return { ...map, floorLinks: to && to !== propId ? [...keep, { a: propId, b: to }] : keep };
}

/** Floors and links read from a file: inside the map, sensible sizes, links between existing stair pieces only. */
export function normalizeFloors(raw, map, data) {
  const floors = (Array.isArray(raw?.floors) ? raw.floors : []).slice(0, MAX_FLOORS).map((f, i) => {
    const x = int(f?.x, 0, map.cols - 2);
    const y = int(f?.y, 0, map.rows - 2);
    return { id: `f${i + 1}`, name: String(f?.name ?? '').trim().slice(0, 30) || `Floor ${i + 1}`, x, y, w: int(f?.w, 2, map.cols - x), h: int(f?.h, 2, map.rows - y), level: int(f?.level ?? i, -9, 9) }; // decision 286: its level (−1 the basement, 0 the ground…)
  });
  const ids = new Set((map.props ?? []).filter((p) => isStairs(propDef(data, p.prop))).map((p) => p.id));
  const used = new Set();
  const floorLinks = [];
  for (const l of Array.isArray(raw?.floorLinks) ? raw.floorLinks : []) {
    if (!ids.has(l?.a) || !ids.has(l?.b) || l.a === l.b || used.has(l.a) || used.has(l.b)) continue;
    used.add(l.a); used.add(l.b);
    floorLinks.push({ a: l.a, b: l.b });
  }
  return { floors, floorLinks };
}
