// Floors (decision 184): a building's floors drawn side by side on one map. Each floor is a rectangle of squares;
// its outline stops sight and movement (so the line-of-sight, fog and route rules keep floors apart with no other
// change), and stairs / lifts linked in pairs are the only way across: stepping onto one, you come out on its
// partner for a few squares of movement. Floors and links are public (players see the building's layout). Pure.

import { activeProps, propDef, squaresUnder } from './props.js';

const MAX_FLOORS = 8;
const int = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(v) || 0)));

/** Pieces that can carry a floor link: stairs, ramps, ladders, lifts. */
export const isStairs = (def) => Boolean(def) && (def.category === 'level' || /stair|elevator|lift|ladder/i.test(def.id));

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
    return { id: `f${i + 1}`, name: String(f?.name ?? '').trim().slice(0, 30) || `Floor ${i + 1}`, x, y, w: int(f?.w, 2, map.cols - x), h: int(f?.h, 2, map.rows - y) };
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
