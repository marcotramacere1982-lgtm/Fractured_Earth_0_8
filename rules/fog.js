// Fog of war (decision 71). Players see what their markers can see — the same centre-to-centre sight test as
// the line-of-sight check, so open doors and windows let sight through and closed doors stop it — and remember
// it: a square once seen stays on their map (dimmed when nobody sees it now). Walls and pieces show only
// where seen; enemies and NPCs only while someone sees them now. The GM's console works it out and sends
// players only the seen part. Pure.

import { sightSegments, sightHits, onBoard, squareAt } from './map.js';
import { lightTest, lightState } from './light.js';

const key = (s) => `${s.x},${s.y}`;
let memo = { key: '', value: null };

/** Squares any of the eyes can see now (each eye sees its own square), light permitting (decision 74). Set of "x,y". */
export function visibleSquares(map, data, eyes) {
  const k = JSON.stringify([map.cols, map.rows, map.ambient ?? 'bright', map.walls, map.props ?? [], eyes]);
  if (memo.key === k) return memo.value;
  const segs = sightSegments(map, data);
  const light = lightTest(map, data, segs, eyes);
  const out = new Set();
  for (const e of eyes) {
    if (!onBoard(map, e)) continue;
    out.add(key(e));
    const A = { x: e.x + 0.5, y: e.y + 0.5 };
    for (let x = 0; x < map.cols; x++) {
      for (let y = 0; y < map.rows; y++) {
        const k2 = `${x},${y}`;
        if (out.has(k2)) continue;
        if (!light(e, x, y)) continue;
        const [left, right] = sightHits(A, { x: x + 0.5, y: y + 0.5 }, segs);
        if (!(left && right)) out.add(k2);
      }
    }
  }
  memo = { key: k, value: out };
  return out;
}

/**
 * The stretches of each wall, door, window or laser that border a seen square (walls are cut in half-square
 * pieces, kept when either side is seen, then joined again), so a long wall doesn't give away the building.
 */
export function clipWalls(walls, seen) {
  const out = [];
  for (const w of walls) {
    const dx = w.b.x - w.a.x;
    const dy = w.b.y - w.a.y;
    const len = Math.hypot(dx, dy) || 1;
    const n = Math.max(1, Math.ceil(len / 0.5));
    const nx = (-dy / len) * 0.25;
    const ny = (dx / len) * 0.25;
    const at = (t) => ({ x: Number((w.a.x + dx * t).toFixed(3)), y: Number((w.a.y + dy * t).toFixed(3)) });
    let run = null;
    for (let i = 0; i <= n; i++) {
      const t0 = i / n;
      const t1 = (i + 1) / n;
      const m = at((t0 + t1) / 2);
      const keep = i < n && [{ x: m.x + nx, y: m.y + ny }, { x: m.x - nx, y: m.y - ny }].some((q) => seen.has(key(squareAt(q))));
      if (keep) run = run ? { ...run, t1 } : { t0, t1 };
      else if (run) { out.push({ ...w, a: at(run.t0), b: at(run.t1) }); run = null; }
    }
  }
  return out;
}

/** A piece shows once the square under its centre has been seen. */
export const propSeen = (p, seen) => seen.has(key(squareAt(p)));

/** Squares as a list, for the message ("x,y" strings). */
export const squareList = (set) => [...set];

/** The players' eyes: the squares of their placed markers, with what each sees with (rules/light.js → visionOf). */
export const eyesOf = (live, people) => people.filter((p) => p.kind === 'player' && live.tokens[p.key])
  .map((p) => ({ ...live.tokens[p.key], dark: p.vision?.dark ?? 0, thermal: p.vision?.thermal ?? 0, torch: p.vision?.torch ?? 0 }));

/**
 * Thermal (decision 75): squares where an eye with thermal picks up a warm body — within its thermal range and
 * its line of sight, whatever the light. Only people show there, never the room. Set of "x,y".
 */
export function thermalSquares(map, data, eyes) {
  const hot = eyes.filter((e) => e.thermal > 0);
  const out = new Set();
  if (!hot.length) return out;
  const segs = sightSegments(map, data);
  for (const e of hot) {
    const A = { x: e.x + 0.5, y: e.y + 0.5 };
    for (let x = Math.max(0, e.x - e.thermal); x <= Math.min(map.cols - 1, e.x + e.thermal); x++) {
      for (let y = Math.max(0, e.y - e.thermal); y <= Math.min(map.rows - 1, e.y + e.thermal); y++) {
        const k = `${x},${y}`;
        if (out.has(k)) continue;
        const [left, right] = sightHits(A, { x: x + 0.5, y: y + 0.5 }, segs);
        if (!(left && right)) out.add(k);
      }
    }
  }
  return out;
}

/** What has been seen so far: the remembered squares plus what the players see now. */
export function seenNow(live, people, data) {
  const visible = visibleSquares(live.map, data, eyesOf(live, people));
  return { visible, seen: new Set([...(live.fog?.seen ?? []), ...visible]) };
}

/**
 * Lays the fog over a public map message (rules/map.js → publicMap) when it is on for the map on the table:
 * walls clipped to what was seen, pieces where seen, other people only while seen now; the squares go along
 * so the sheet can darken the rest.
 */
export function applyFog(msg, live, people, data) {
  if (!live.fog?.on) return msg;
  const { visible, seen } = seenNow(live, people, data);
  const hot = thermalSquares(live.map, data, eyesOf(live, people));
  const at = (t) => `${t.x},${t.y}`;
  return {
    ...msg,
    walls: clipWalls(msg.walls, seen),
    props: msg.props.filter((p) => propSeen(p, seen)),
    // people: seen, or picked up by thermal in the dark (shown as a heat signature)
    tokens: msg.tokens.filter((t) => t.kind === 'player' || visible.has(at(t)) || hot.has(at(t)))
      .map((t) => (t.kind !== 'player' && !visible.has(at(t)) ? { ...t, thermal: true } : t)),
    fog: { seen: [...seen], visible: [...visible] },
    light: lightState(live.map, data, sightSegments(live.map, data), eyesOf(live, people)), // decision 76: dark / lit squares
  };
}
