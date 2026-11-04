// Decision 250: Overwatch. A character spends an action to watch a quarter circle — one of 8 directions, out to the
// weapon in hand's range, only the squares they can see. The first enemy that moves into or through it can be shot,
// once, with the GM's OK; the player may let a target pass and keep watching until the start of their next turn.
// Pure: the squares watched, and where a move crosses them. The GM moves enemies, so the console checks each move.

import { lineOfSight, rangeCheck, squaresBetween } from './map.js';

export const DIRS = { n: [0, -1], ne: [1, -1], e: [1, 0], se: [1, 1], s: [0, 1], sw: [-1, 1], w: [-1, 0], nw: [-1, -1] };
const COS45 = Math.cos(Math.PI / 4) - 1e-9;

/** How far a weapon reaches, in squares (its long range). */
export const reachOf = (weapon, data) => rangeCheck(weapon?.range ?? { max: 1 }, 1, data).max;

/** The squares watched from `from` toward `dir`: within 45° of it, within `reach`, in sight. */
export function watchedSquares(map, data, from, dir, reach) {
  const d = DIRS[dir];
  if (!d || !from) return [];
  const len = Math.hypot(d[0], d[1]);
  const out = [];
  for (let y = Math.max(0, from.y - reach); y <= Math.min(map.rows - 1, from.y + reach); y++) {
    for (let x = Math.max(0, from.x - reach); x <= Math.min(map.cols - 1, from.x + reach); x++) {
      const vx = x - from.x; const vy = y - from.y;
      if (!vx && !vy) continue;
      if ((vx * d[0] + vy * d[1]) / (Math.hypot(vx, vy) * len) < COS45) continue; // outside the quarter circle
      if (squaresBetween(from, { x, y }) > reach) continue;
      if (lineOfSight(map, data, from, { x, y }).result === 'blocked') continue;
      out.push({ x, y });
    }
  }
  return out;
}

/** The squares a straight move from `a` to `b` passes through (not `a`, `b` included). */
export function moveSquares(a, b) {
  const n = squaresBetween(a, b);
  const out = [];
  for (let i = 1; i <= n; i++) {
    const sq = { x: Math.round(a.x + ((b.x - a.x) * i) / n), y: Math.round(a.y + ((b.y - a.y) * i) / n) };
    if (!out.some((s) => s.x === sq.x && s.y === sq.y)) out.push(sq);
  }
  return out;
}

/** The first square of a move inside the watched area, or null. */
export function crossesWatch(watched, from, to) {
  const set = new Set(watched.map((s) => `${s.x},${s.y}`));
  return moveSquares(from, to).find((s) => set.has(`${s.x},${s.y}`)) ?? null;
}
