// Tactical maps (decision 64): a grid of squares (1 square = 1.5 m; data.map.square) with walls, doors and
// windows as straight segments in square coordinates ({ x, y } = corners, 0,0 top-left). Pure: shared by the
// GM map builder and, later, the sheet's map view. Every change returns a new map.

import { activeProps, propDef, propEdges, insideProp, difficultSquares, normRot, sensorState, propState, publicState, blockedEdges } from './props.js';

export const MAP_SCHEMA = 1;
const FREE_STEP = 0.05; // snap off: positions still round to 1/20 of a square
const clone = (x) => structuredClone(x);
const round = (n, step) => Number((Math.round(n / step) * step).toFixed(2));
const clampInt = (n, min, max) => Math.max(min, Math.min(max, Math.round(Number(n) || 0)));

/** Snap on: the nearest square corner. Off: free, to 1/20 of a square. */
export const snapPoint = ({ x, y }, snap) => ({ x: round(x, snap ? 1 : FREE_STEP), y: round(y, snap ? 1 : FREE_STEP) });

export const samePoint = (a, b) => Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6;

export function newMap(data, { id, name = 'Untitled map', cols, rows, t = Date.now() } = {}) {
  const s = data.map.size;
  return {
    schemaVersion: MAP_SCHEMA, id, name,
    cols: clampInt(cols ?? s.default.cols, s.min, s.max), rows: clampInt(rows ?? s.default.rows, s.min, s.max),
    walls: [], props: [], ambient: 'bright', createdAt: t, updatedAt: t, // ambient: bright | dark (decision 74)
  };
}

const nextWallId = (map) => {
  const used = new Set(map.walls.map((w) => w.id));
  for (let n = map.walls.length + 1; ; n++) if (!used.has(`w${n}`)) return `w${n}`;
};

/** Length in squares (straight line; walls can run at any angle). */
export const wallLength = (w) => Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y);

/** A laser line (decision 69): a sensor drawn like a wall — hidden at first, on, and its beam flags for later rules. */
const laserState = (hidden = true) => ({ hidden, ...sensorState(['beam']) });

/** Adds a wall, door, window or laser line from a to b. A zero-length segment is ignored (returns the same map). */
export function addWall(map, { a, b, kind = 'wall', width = 'standard', open = false }) {
  if (samePoint(a, b)) return map;
  const next = clone(map);
  next.walls.push({ id: nextWallId(map), a: { ...a }, b: { ...b }, kind, width, ...(kind === 'door' ? { open: !!open, locked: false } : {}), ...(kind === 'laser' ? laserState() : {}) });
  return next;
}
const LASER_KEYS = Object.keys(laserState());

export const removeWall = (map, id) => ({ ...clone(map), walls: map.walls.filter((w) => w.id !== id) });

/** Kind, width or door state. Turning a door into something else drops its open flag. */
export function setWall(map, id, fields) {
  const next = clone(map);
  const w = next.walls.find((x) => x.id === id);
  if (!w) return map;
  const wasLaser = w.kind === 'laser';
  Object.assign(w, fields);
  if (w.kind === 'door') { w.open = !!w.open; w.locked = !!w.locked; } else { delete w.open; delete w.locked; } // locked: GM-only (decision 73)
  if (w.kind === 'laser' && !wasLaser) Object.assign(w, laserState(), fields.hidden != null ? { hidden: fields.hidden } : {});
  if (w.kind !== 'laser') for (const k of LASER_KEYS) delete w[k];
  return next;
}

/** Moves one end ('a' or 'b') of a segment; refuses to collapse it to a point. */
export function moveEnd(map, id, end, p) {
  const w = map.walls.find((x) => x.id === id);
  if (!w || samePoint(p, end === 'a' ? w.b : w.a)) return map;
  const next = clone(map);
  next.walls.find((x) => x.id === id)[end] = { ...p };
  return next;
}

/** Shortest distance from a point to a segment, in squares. */
export function distanceToWall(p, w) {
  const dx = w.b.x - w.a.x;
  const dy = w.b.y - w.a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((p.x - w.a.x) * dx + (p.y - w.a.y) * dy) / len2)) : 0;
  return Math.hypot(p.x - (w.a.x + t * dx), p.y - (w.a.y + t * dy));
}

/** The segment nearest to p within `tolerance` squares (doors and windows win ties over the wall they sit on). */
export function hitWall(map, p, tolerance) {
  const rank = { laser: 0, door: 0, window: 1, wall: 2 };
  let best = null;
  for (const w of map.walls) {
    const d = distanceToWall(p, w);
    if (d > tolerance) continue;
    if (!best || d < best.d - 1e-6 || (Math.abs(d - best.d) <= 1e-6 && rank[w.kind] < rank[best.w.kind])) best = { w, d };
  }
  return best?.w.id ?? null;
}

/** New size; walls outside it stay (they show past the edge, nothing is lost). */
export function resizeMap(map, { cols, rows }, data) {
  const s = data.map.size;
  return { ...clone(map), cols: clampInt(cols ?? map.cols, s.min, s.max), rows: clampInt(rows ?? map.rows, s.min, s.max) };
}

/**
 * Checks a map read from a file or sent to the server: known kinds and widths, finite coordinates inside a
 * generous frame, no zero-length segments. Unknown fields are dropped. Throws on a file that isn't a map.
 */
export function normalizeMap(raw, data) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.walls)) throw new Error('Not a map file.');
  const kinds = new Set(data.map.kinds.map((k) => k.id));
  const widths = new Set(data.map.widths.map((w) => w.id));
  const base = newMap(data, { id: String(raw.id ?? ''), name: String(raw.name ?? 'Untitled map').slice(0, 80), cols: raw.cols, rows: raw.rows, t: Number(raw.createdAt) || Date.now() });
  const limit = data.map.size.max * 2;
  const pt = (q) => (q && Number.isFinite(q.x) && Number.isFinite(q.y) && Math.abs(q.x) <= limit && Math.abs(q.y) <= limit ? { x: round(q.x, 0.01), y: round(q.y, 0.01) } : null);
  const walls = [];
  // keep each wall's id (the builder's selection and undo rely on it); missing or repeated ones get a fresh one
  const taken = new Set(raw.walls.map((w) => w?.id).filter((id) => /^w\d{1,6}$/.test(id ?? '')));
  const used = new Set();
  let n = 0;
  const idFor = (id) => {
    let next = id;
    if (!taken.has(id) || used.has(id)) do next = `w${++n}`; while (taken.has(next) || used.has(next));
    used.add(next);
    return next;
  };
  for (const w of raw.walls.slice(0, 5000)) {
    const a = pt(w?.a);
    const b = pt(w?.b);
    if (!a || !b || samePoint(a, b) || !kinds.has(w.kind) || !widths.has(w.width)) continue;
    const laser = w.kind === 'laser' ? Object.fromEntries(Object.entries(laserState()).map(([k, v]) => [k, typeof w[k] === 'boolean' ? w[k] : v])) : {};
    walls.push({ id: idFor(w.id), a, b, kind: w.kind, width: w.width, ...(w.kind === 'door' ? { open: w.open === true, locked: w.locked === true } : {}), ...laser });
  }
  // props (decision 68): known library pieces only, ids kept like walls
  const props = [];
  const pUsed = new Set();
  let pn = 0;
  for (const q of (Array.isArray(raw.props) ? raw.props : []).slice(0, 2000)) {
    if (!propDef(data, q?.prop) || !Number.isFinite(q.x) || !Number.isFinite(q.y) || Math.abs(q.x) > limit || Math.abs(q.y) > limit) continue;
    let id = /^p\d{1,6}$/.test(q.id ?? '') && !pUsed.has(q.id) ? q.id : null;
    while (!id || pUsed.has(id)) id = `p${++pn}`;
    pUsed.add(id);
    const def = propDef(data, q.prop);
    const state = Object.fromEntries(Object.entries(propState(def)).map(([k, v]) => [k, typeof q[k] === 'boolean' ? q[k] : v]));
    const { min, max } = data.map.sensor.reach;
    const reach = Object.fromEntries(Object.entries(q.reach ?? {}).filter(([k, n]) => def.sensor?.reach?.[k] != null && Number.isFinite(n)).map(([k, n]) => [k, Math.max(min, Math.min(max, Math.round(n)))]));
    props.push({ id, prop: q.prop, x: round(q.x, 0.01), y: round(q.y, 0.01), rot: normRot(q.rot), hidden: q.hidden === true, ...state, ...(Object.keys(reach).length ? { reach } : {}) });
  }
  return { ...base, walls, props, ambient: raw.ambient === 'dark' ? 'dark' : 'bright', updatedAt: Number(raw.updatedAt) || base.updatedAt };
}

/** Counts by kind, for the builder's summary. */
export const wallCounts = (map) => map.walls.reduce((n, w) => ({ ...n, [w.kind]: (n[w.kind] ?? 0) + 1 }), {});

// ------------------------------------------------------------------ the map on the table (step 2)

/** The square a map point falls in. Markers stand on squares: { x, y } = column, row. */
export const squareAt = (p) => ({ x: Math.floor(p.x), y: Math.floor(p.y) });
export const onBoard = (map, s) => s.x >= 0 && s.y >= 0 && s.x < map.cols && s.y < map.rows;

/** Squares from one square to another: diagonals count 1 (manual ch. 5), so it is the larger of the two steps. */
export const squaresBetween = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

/** The door nearest to p within `tolerance` squares, or null. */
export const doorAt = (map, p, tolerance) => hitWall({ ...map, walls: map.walls.filter((w) => w.kind === 'door') }, p, tolerance);

/** Is a marker on this square next to the door (sideways or diagonally)? Players open doors they stand by. */
export const nextToDoor = (square, w) => distanceToWall({ x: square.x + 0.5, y: square.y + 0.5 }, w) <= 0.75;

export function toggleDoor(map, id) {
  const w = map.walls.find((x) => x.id === id);
  return w?.kind === 'door' ? setWall(map, id, { open: !w.open }) : map;
}

/** Two letters from a name, for a player's marker ("Kira Vance" → "KV"). */
export const tokenLabel = (name) => String(name ?? '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';

/**
 * What every sheet gets (sticky `map` message; data: for which pieces show their state). live: { id, map, tokens: { key: { x, y } }, playersMove };
 * people: [{ key, kind: 'player'|'enemy', label, name (public), hidden, down, current }].
 * Hidden hostiles and hidden props never leave the GM's screen; markers not placed yet aren't sent.
 */
export function publicMap(live, people, data) {
  const m = live.map;
  return {
    type: 'map', id: live.id, name: m.name, cols: m.cols, rows: m.rows, canMove: live.playersMove !== false,
    // hidden lasers and props stay with the GM; so do on / off and the sensor flags (players never know if a sensor is live)
    walls: m.walls.filter((w) => !w.hidden).map((w) => ({ id: w.id, a: w.a, b: w.b, kind: w.kind, width: w.width, ...(w.kind === 'door' ? { open: w.open } : {}) })),
    props: activeProps(m).filter((p) => !propDef(data, p.prop)?.gmOnly).map((p) => ({ id: p.id, prop: p.prop, x: p.x, y: p.y, rot: p.rot, ...(p.reach ? { reach: p.reach } : {}), ...publicState(p, propDef(data, p.prop)) })),
    tokens: people.filter((p) => !p.hidden && live.tokens[p.key]).map((p) => ({
      key: p.key, kind: p.kind, label: p.label, name: p.name, x: live.tokens[p.key].x, y: live.tokens[p.key].y, down: Boolean(p.down), current: Boolean(p.current),
      ...(p.kind === 'player' && p.color ? { color: p.color } : {}), // the player's chosen colour, also their marks' (decision 82)
    })),
  };
}

// ------------------------------------------------------------------ moving markers (step 3)

/** Does this wall, door or window stop movement right now? (data.map.kinds: always / closed / never) */
export function blocksMove(w, data) {
  const rule = data.map.kinds.find((k) => k.id === w.kind)?.blocksMove ?? 'always';
  return rule === 'always' || (rule === 'closed' && !w.open);
}

/** Do segments p1-p2 and q1-q2 meet (touching counts)? */
function meet(p1, p2, q1, q2) {
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const on = (o, a, b) => Math.min(o.x, a.x) - 1e-9 <= b.x && b.x <= Math.max(o.x, a.x) + 1e-9 && Math.min(o.y, a.y) - 1e-9 <= b.y && b.y <= Math.max(o.y, a.y) + 1e-9;
  const d1 = cross(q1, q2, p1);
  const d2 = cross(q1, q2, p2);
  const d3 = cross(p1, p2, q1);
  const d4 = cross(p1, p2, q2);
  if (((d1 > 1e-9 && d2 < -1e-9) || (d1 < -1e-9 && d2 > 1e-9)) && ((d3 > 1e-9 && d4 < -1e-9) || (d3 < -1e-9 && d4 > 1e-9))) return true;
  return (Math.abs(d1) <= 1e-9 && on(q1, q2, p1)) || (Math.abs(d2) <= 1e-9 && on(q1, q2, p2))
    || (Math.abs(d3) <= 1e-9 && on(p1, p2, q1)) || (Math.abs(d4) <= 1e-9 && on(p1, p2, q2));
}

const centre = (s) => ({ x: s.x + 0.5, y: s.y + 0.5 });

/**
 * Doors and windows drawn over a wall cut it (as the drawing shows): every wall minus the stretches covered by
 * a door or window lying along it. Returns segments { a, b, kind, open? } — openings included as they are.
 */
export function solidSegments(map) {
  const openings = map.walls.filter((w) => w.kind !== 'wall');
  const out = [...openings];
  for (const w of map.walls.filter((x) => x.kind === 'wall')) {
    const dx = w.b.x - w.a.x;
    const dy = w.b.y - w.a.y;
    const len2 = dx * dx + dy * dy;
    const along = (p) => ((p.x - w.a.x) * dx + (p.y - w.a.y) * dy) / len2;
    const onLine = (p) => Math.abs((p.x - w.a.x) * dy - (p.y - w.a.y) * dx) / Math.sqrt(len2) < 0.02;
    const cuts = openings.filter((o) => onLine(o.a) && onLine(o.b))
      .map((o) => [Math.max(0, Math.min(along(o.a), along(o.b))), Math.min(1, Math.max(along(o.a), along(o.b)))])
      .filter(([t0, t1]) => t1 > t0).sort((p, q) => p[0] - q[0]);
    let t = 0;
    const at = (u) => ({ x: w.a.x + dx * u, y: w.a.y + dy * u });
    for (const [t0, t1] of cuts) {
      if (t0 > t) out.push({ a: at(t), b: at(t0), kind: 'wall' });
      t = Math.max(t, t1);
    }
    if (t < 1) out.push({ a: at(t), b: w.b, kind: 'wall' });
  }
  return out;
}

/**
 * One step to a neighbouring square. Straight steps: nothing in the way between the two centres.
 * Diagonal steps (they cost 1, manual ch. 5): one of the two L-shaped routes is clear, so a marker can slip
 * round the end of a wall but never through a room's corner.
 */
function stepClear(a, b, blockers) {
  const straight = (p, q) => !blockers.some((w) => meet(centre(p), centre(q), w.a, w.b));
  if (a.x === b.x || a.y === b.y) return straight(a, b);
  const c1 = { x: b.x, y: a.y };
  const c2 = { x: a.x, y: b.y };
  return (straight(a, c1) && straight(c1, b)) || (straight(a, c2) && straight(c2, b));
}

/** Everything that stops a step: walls, windows, closed doors, and props that block movement (decision 68). */
const moveBlockers = (map, data) => [
  ...solidSegments(map).filter((w) => blocksMove(w, data)),
  ...activeProps(map).filter((p) => propDef(data, p.prop)?.blocksMove).flatMap((p) => propEdges(p, data)),
  ...activeProps(map).flatMap((p) => blockedEdges(p, data)), // stairs and elevators: invisible side walls (decision 72)
];

/**
 * Walk round walls up to `max` squares of movement: steps (cost) to each square and where it came from.
 * Entering difficult ground costs 2 (manual 7-2), so this is a shortest-path search by cost buckets.
 */
function walk(map, data, from, max) {
  const blockers = moveBlockers(map, data);
  const rough = difficultSquares(map, data);
  const steps = new Map([[`${from.x},${from.y}`, 0]]);
  const prev = new Map();
  const buckets = [[from]];
  for (let cost = 0; cost <= max; cost++) {
    for (const s of buckets[cost] ?? []) {
      if (steps.get(`${s.x},${s.y}`) !== cost) continue; // reached cheaper since
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const t = { x: s.x + dx, y: s.y + dy };
          const k = `${t.x},${t.y}`;
          const c = cost + (rough.has(k) ? 2 : 1);
          if ((!dx && !dy) || c > max || (steps.has(k) && steps.get(k) <= c) || !onBoard(map, t) || !stepClear(s, t, blockers)) continue;
          steps.set(k, c);
          prev.set(k, s);
          (buckets[c] ??= []).push(t);
        }
      }
    }
  }
  return { steps, prev };
}

/** Squares reachable from `from` in at most `max` steps, walking round walls: Map "x,y" → steps. */
export const reachable = (map, data, from, max) => walk(map, data, from, max).steps;

/** The squares a marker walks through from → to (both included), round walls; null if not within `max`. */
export function routeTo(map, data, from, to, max) {
  const { steps, prev } = walk(map, data, from, max);
  return steps.has(`${to.x},${to.y}`) ? pathFrom(prev, to) : null;
}
function pathFrom(prev, to) {
  const path = [to];
  for (let s = to; prev.has(`${s.x},${s.y}`);) { s = prev.get(`${s.x},${s.y}`); path.unshift(s); }
  return path;
}
/** Movement cost of a route (difficult ground counts 2). */
export function routeCost(map, data, path) {
  const rough = difficultSquares(map, data);
  return path.slice(1).reduce((n, s) => n + (rough.has(`${s.x},${s.y}`) ? 2 : 1), 0);
}

/**
 * Can a marker go from → to in at most `max` squares? occupied: squares with another marker.
 * @returns { ok, steps, path } or { ok: false, code: 'offBoard' | 'occupied' | 'tooFar' | 'blocked', max }
 */
export function checkMove(map, data, from, to, max, occupied = []) {
  if (!onBoard(map, to)) return { ok: false, code: 'offBoard', max };
  if (occupied.some((s) => s.x === to.x && s.y === to.y)) return { ok: false, code: 'occupied', max };
  const { steps, prev } = walk(map, data, from, max);
  const cost = steps.get(`${to.x},${to.y}`);
  if (cost != null) return { ok: true, steps: cost, path: pathFrom(prev, to) };
  return { ok: false, code: squaresBetween(from, to) > max ? 'tooFar' : 'blocked', max };
}

// ------------------------------------------------------------------ line of sight and range (step 4)

/** Does this wall, door or window block sight right now? (data.map.kinds: always / closed / never) */
export function blocksSight(w, data) {
  const rule = data.map.kinds.find((k) => k.id === w.kind)?.blocksSight ?? 'always';
  return rule === 'always' || (rule === 'closed' && !w.open);
}

/** Do p1-p2 and q1-q2 cross properly (each passes strictly through the other)? */
function crosses(p1, p2, q1, q2) {
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const d1 = cross(q1, q2, p1);
  const d2 = cross(q1, q2, p2);
  const d3 = cross(p1, p2, q1);
  const d4 = cross(p1, p2, q2);
  return d1 * d2 < -1e-12 && d3 * d4 < -1e-12;
}

/** Does the segment A-B pass through the square, shrunk by `inset` on each side (Liang–Barsky clip)? */
function throughSquare(A, B, s, inset) {
  let t0 = 0;
  let t1 = 1;
  const dx = B.x - A.x;
  const dy = B.y - A.y;
  for (const [p, q] of [[-dx, A.x - (s.x + inset)], [dx, s.x + 1 - inset - A.x], [-dy, A.y - (s.y + inset)], [dy, s.y + 1 - inset - A.y]]) {
    if (Math.abs(p) < 1e-12) { if (q < 0) return false; continue; }
    const r = q / p;
    if (p < 0) t0 = Math.max(t0, r); else t1 = Math.min(t1, r);
    if (t0 > t1) return false;
  }
  return true;
}

const EDGE = 0.2; // a trace this close to a wall's end "grazes a structural edge" (squares)
const SHIFT = 0.01; // the trace is tested a hair to each side, so a room's corner blocks but a wall's tip doesn't

/** Everything sight stops at: walls, closed doors, and pieces that block sight (hidden pieces don't count). */
export const sightSegments = (map, data) => [...solidSegments(map).filter((w) => blocksSight(w, data)),
  ...activeProps(map).filter((p) => propDef(data, p.prop)?.blocksSight).flatMap((p) => propEdges(p, data))];

/** The blockers a line A→B meets, tested a hair to each side: [left, right]; both set = blocked (a corner counts). */
export function sightHits(A, B, segs) {
  const len = Math.hypot(B.x - A.x, B.y - A.y) || 1;
  const nx = (-(B.y - A.y) / len) * SHIFT;
  const ny = ((B.x - A.x) / len) * SHIFT;
  const hit = (sign) => segs.find((w) => crosses({ x: A.x + nx * sign, y: A.y + ny * sign }, { x: B.x + nx * sign, y: B.y + ny * sign }, w.a, w.b));
  return [hit(1), hit(-1)];
}

/**
 * Manual 7-2: a straight line from the centre of one square to the centre of the other.
 * Blocked: it goes through a wall or a closed door (both hair-shifted traces cross one — a corner counts).
 * Cover likely: it grazes a wall's edge, passes through another character's square, or crosses a prop that gives
 * cover (a table). Props that block sight (a cupboard) block it like walls; hidden props don't count.
 * others: [{ key, x, y }] the other markers. @returns { result: 'clear'|'cover'|'blocked', by?, reasons: [{ code, key? }], squares }
 */
export function lineOfSight(map, data, from, to, others = []) {
  const A = centre(from);
  const B = centre(to);
  const squares = squaresBetween(from, to);
  const props = activeProps(map);
  const segs = sightSegments(map, data);
  const [left, right] = sightHits(A, B, segs);
  if (left && right) {
    const by = [left, right].find((w) => w.kind === 'prop') ?? [left, right].find((w) => w.kind === 'door') ?? left;
    return { result: 'blocked', by: by.kind === 'prop' ? 'prop' : by.kind === 'door' ? 'door' : 'wall', ...(by.kind === 'prop' ? { prop: by.prop } : {}), reasons: [], squares };
  }
  const reasons = [];
  const nearEnd = (w) => [w.a, w.b].some((p) => distanceToWall(p, { a: A, b: B }) < EDGE);
  if (left || right || segs.some(nearEnd)) reasons.push({ code: 'edge' });
  for (const o of others) {
    if ((o.x === from.x && o.y === from.y) || (o.x === to.x && o.y === to.y)) continue;
    if (throughSquare(A, B, o, 0.15)) reasons.push({ code: 'character', key: o.key });
  }
  // props that give cover (a table): the line passes through them after leaving the shooter's own square
  const exit = 0.5 / Math.max(Math.abs(B.x - A.x), Math.abs(B.y - A.y), 1e-9);
  const A2 = { x: A.x + (B.x - A.x) * Math.min(1, exit), y: A.y + (B.y - A.y) * Math.min(1, exit) };
  for (const p of props) {
    const def = propDef(data, p.prop);
    if (!def || def.blocksSight || def.cover === 'none') continue;
    if (insideProp(B, p, data) || insideProp(A2, p, data) || propEdges(p, data).some((e) => meet(A2, B, e.a, e.b))) reasons.push({ code: 'prop', prop: p.prop, cover: def.cover });
  }
  return { result: reasons.length ? 'cover' : 'clear', reasons, squares };
}

/**
 * A weapon's range (metres in the data) against a distance in squares (1 square = data.map.square.metres).
 * At least 1 square: a knife reaches the next square. Information only (owner, decision 67): the GM rules.
 * @returns { status: 'in' | 'far' | 'close', min, max } in squares
 */
export function rangeCheck(range, squares, data) {
  const m = data.map.square.metres;
  const max = Math.max(1, Math.floor((range?.max ?? 1) / m));
  const min = Math.min(max, Math.ceil((range?.min ?? 0) / m));
  return { status: squares > max ? 'far' : squares < min ? 'close' : 'in', min, max };
}
