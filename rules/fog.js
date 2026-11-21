// Fog of war (decision 71). Players see what their markers can see — the same centre-to-centre sight test as
// the line-of-sight check, so open doors and windows let sight through and closed doors stop it — and remember
// it: a square once seen stays on their map (dimmed when nobody sees it now). Walls and pieces show only
// where seen; enemies and NPCs only while someone sees them now. The GM's console works it out and sends
// players only the seen part. Pure.

import { sightSegments, sightHits, onBoard, squareAt } from './map.js';
import { lightTest, lightState } from './light.js';
import { activeProps, propDef, propBlocksSight, propCorners, insideProp, propEdges, shellEdges, squaresUnder } from './props.js';
import { openSquares, crossSight } from './vertical.js';
import { floorOf } from './floors.js';

const key = (s) => `${s.x},${s.y}`;
const GROUND_TILES = new Set(['floor', 'city', 'terrain', 'zone', 'scene']); // decision 293
let memo = { key: '', value: null };
let pieceMemo = { key: '', value: null };

/** Squares any of the eyes can see now (each eye sees its own square), light permitting (decision 74). Set of "x,y". */
export function visibleSquares(map, data, eyes) {
  const k = JSON.stringify([map.cols, map.rows, map.ambient ?? 'bright', map.walls, map.props ?? [], map.floors ?? [], eyes]); // floors stop sight too (decision 184)
  if (memo.key === k) return memo.value;
  const segs = sightSegments(map, data);
  const light = lightTest(map, data, segs, eyes);
  const out = new Set();
  for (const e of eyes) {
    if (!onBoard(map, e)) continue;
    out.add(key(e));
    const A = { x: e.x + 0.5, y: e.y + 0.5 };
    const f = (map.floors ?? []).length ? floorOf(map, e) : null; // decision 293: its own floor only — frame edges stop sight anyway
    const [x0, x1, y0, y1] = f ? [f.x, f.x + f.w, f.y, f.y + f.h] : [0, map.cols, 0, map.rows];
    for (let x = x0; x < x1; x++) {
      for (let y = y0; y < y1; y++) {
        const k2 = `${x},${y}`;
        if (out.has(k2)) continue;
        if (!light(e, x, y)) continue;
        const [left, right] = sightHits(A, { x: x + 0.5, y: y + 0.5 }, segs);
        if (!(left && right)) out.add(k2);
      }
    }
  }
  if ((map.floors ?? []).length) seeAcross(map, data, segs, light, eyes, out);
  memo = { key: k, value: out };
  return out;
}

/**
 * Decision 287: what eyes see on other floors, through openings (rules/vertical.js). Looking down, the eye must stand
 * at an opening's edge; looking up, only someone at an opening's edge is in view. Adds to `out`.
 */
function seeAcross(map, data, segs, light, eyes, out) {
  const open = openSquares(map, data);
  if (!open.size) return;
  const blocked = (a, b) => { const [l, r] = sightHits(a, b, segs); return Boolean(l && r); };
  const atEdge = (s) => { for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if ((dx || dy) && open.has(`${s.x + dx},${s.y + dy}`)) return true; return false; };
  for (const e of eyes) {
    const fe = floorOf(map, e);
    if (!fe) continue;
    const lookDown = atEdge(e);
    for (const f of map.floors) {
      const below = (f.level ?? 0) < (fe.level ?? 0);
      if (f === fe || (f.level ?? 0) === (fe.level ?? 0) || (below && !lookDown)) continue;
      for (let x = f.x; x < f.x + f.w; x++) {
        for (let y = f.y; y < f.y + f.h; y++) {
          const k = `${x},${y}`;
          if (out.has(k) || open.has(k) || (!below && !atEdge({ x, y })) || !light(e, x, y)) continue;
          if (crossSight(map, open, e, { x, y }, blocked)?.ok) out.add(k);
        }
      }
    }
  }
}

/**
 * Pieces seen by their faces. A square counts as seen when a line reaches its centre, but a piece that blocks
 * sight (a container stack, a loaded carrier), a piece you can hide in (a reefer) or a thin wall on a square's edge
 * stands in the way of every line to the squares under it — so it never showed. A piece is seen when an eye can
 * see any part of it (its middle, the middles of its sides, its corners), tested without its own edges.
 * Returns { see, remember }: squares under solid blockers (nobody can stand there: seen now), and squares to
 * remember only — under a piece you can hide in (who is inside stays hidden) and the square of a seen piece.
 */
export function piecesSeen(map, data, eyes, visible) {
  const k = JSON.stringify([map.cols, map.rows, map.ambient ?? 'bright', map.walls, map.props ?? [], map.floors ?? [], eyes]); // floors stop sight too (decision 184)
  if (pieceMemo.key === k) return pieceMemo.value;
  const segs = sightSegments(map, data);
  const light = lightTest(map, data, segs, eyes);
  const see = new Set();
  const remember = new Set();
  const on = eyes.filter((e) => onBoard(map, e));
  // the same blockers as sightSegments, each tagged with the piece it belongs to, so one piece can be left out
  const walls = sightSegments({ ...map, props: [] }, data);
  const owned = activeProps(map).flatMap((p) => [...(propBlocksSight(propDef(data, p.prop), p) ? propEdges(p, data) : []), ...shellEdges(p, data)].map((w) => ({ ...w, owner: p.id })));
  const eyeFloors = new Set(on.map((e) => floorOf(map, e)));
  for (const p of activeProps(map)) {
    const def = propDef(data, p.prop);
    if (!def || visible.has(key(squareAt(p)))) continue;
    // decision 293: floor tiles and the like show by their square (propSeen); only pieces that stand in the way are traced
    if (GROUND_TILES.has(def.category) && !propBlocksSight(def, p) && !def.shell) continue;
    if ((map.floors ?? []).length && !eyeFloors.has(floorOf(map, p))) continue; // another floor: through an opening, by its square
    const own = propBlocksSight(def, p) || def.shell; // its own edges are among the blockers
    const others = own ? [...walls, ...owned.filter((w) => w.owner !== p.id)] : segs;
    const c = propCorners(p, data);
    const mid = { x: c.reduce((n, q) => n + q.x, 0) / c.length, y: c.reduce((n, q) => n + q.y, 0) / c.length };
    const inward = (q) => ({ x: q.x + (mid.x - q.x) * 0.1, y: q.y + (mid.y - q.y) * 0.1 });
    // decision 295: only the parts of the piece inside its own squares — a switch or a box hung on a wall pokes a sliver
    // through it, and that sliver must not make a room's square seen from the corridor
    const mine = new Set(squaresUnder(p, data).map(key));
    if (!mine.size) mine.add(key(squareAt(p)));
    const points = [mid, ...c.map(inward), ...c.map((q, i) => inward({ x: (q.x + c[(i + 1) % c.length].x) / 2, y: (q.y + c[(i + 1) % c.length].y) / 2 }))]
      .filter((pt) => mine.has(key(squareAt(pt))));
    const sees = (e, pt) => onBoard(map, { x: Math.floor(pt.x), y: Math.floor(pt.y) }) && light(e, Math.floor(pt.x), Math.floor(pt.y))
      && !sightHits({ x: e.x + 0.5, y: e.y + 0.5 }, pt, others).some(Boolean); // decision 295: a clean line — a point a hair from a wall must not slip past it
    if (!on.some((e) => points.some((pt) => sees(e, pt)))) continue;
    const under = squaresUnder(p, data).filter((s) => onBoard(map, s));
    if (propBlocksSight(def, p) && !def.shell) under.forEach((s) => see.add(key(s)));
    else under.forEach((s) => remember.add(key(s)));
    if (onBoard(map, squareAt(p))) remember.add(key(squareAt(p)));
  }
  pieceMemo = { key: k, value: { see, remember } };
  return pieceMemo.value;
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
  .map((p) => ({ ...live.tokens[p.key], dark: p.vision?.dark ?? 0, thermal: p.vision?.thermal ?? 0, torch: p.vision?.torch ?? 0, ...(p.vision?.beam ? { beam: p.vision.beam } : {}) })); // facing comes with the token (decision 360)

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
  const eyes = eyesOf(live, people);
  const squares = visibleSquares(live.map, data, eyes);
  const pieces = piecesSeen(live.map, data, eyes, squares);
  const visible = new Set([...squares, ...pieces.see]);
  return { visible, seen: new Set([...(live.fog?.seen ?? []), ...visible, ...pieces.remember]) };
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
  const linked = new Set((msg.floorLinks ?? []).flatMap((l) => [l.a, l.b]));
  const at = (t) => `${t.x},${t.y}`;
  return {
    ...msg,
    walls: clipWalls(msg.walls, seen),
    props: msg.props.filter((p) => propSeen(p, seen) || linked.has(p.id)), // decision 293: both ends of a floor link (the building's layout is public, decision 184)
    // people: seen, or picked up by thermal in the dark (shown as a heat signature)
    tokens: msg.tokens.filter((t) => t.kind === 'player' || visible.has(at(t)) || hot.has(at(t)))
      .map((t) => (t.kind !== 'player' && !visible.has(at(t)) ? { ...t, thermal: true } : t)),
    fog: { seen: [...seen], visible: [...visible] },
    light: lightState(live.map, data, sightSegments(live.map, data), eyesOf(live, people)), // decision 76: dark / lit squares
  };
}
