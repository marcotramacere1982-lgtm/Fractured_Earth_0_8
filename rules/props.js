// Map props (decision 68): furniture and markers from the SVG library (app/props/, described in data.props),
// placed on a map by their centre { x, y } in squares with a rotation in degrees. Pure: shared by the GM
// builder, the Deploy tab and the sheet. Hidden props (loot, traps, secrets) are the GM's until revealed and
// have no effect on movement or sight while hidden.

const clone = (x) => structuredClone(x);
const round = (n, step) => Number((Math.round(n / step) * step).toFixed(2));
const FREE_STEP = 0.05;

export const propDef = (data, id) => data.props.props.find((p) => p.id === id) ?? null;
/** Ground pieces (floor textures, terrain, chalk outlines): drawn under everything, picked last by a tap. */
export const GROUND = new Set(['floor', 'zone', 'terrain', 'scene']);
export const isGround = (data, p) => GROUND.has(propDef(data, p.prop)?.category);

// ------------------------------------------------------------------ sensors (decision 69: drawn only, no rules yet)

/** What a piece senses: [] for furniture; video / motion / audio / touch for sensors. */
export const sensesOf = (def) => def?.sensor?.senses ?? [];
/** A sensor's starting state: on, and per sense tripped_<sense> / disconnected_<sense> (kept for later rules). */
export const sensorState = (senses) => Object.fromEntries([['on', true], ...senses.flatMap((s) => [[`tripped_${s}`, false], [`disconnected_${s}`, false]])]);

/** Who sees a piece's on / off: lights are 'public', sensors and the keypad 'private' (GM-only); null: no power. */
export const powerOf = (def) => def?.power ?? (sensesOf(def).length ? 'private' : null);

/**
 * Everything a placed piece can switch (decision 70): on / off (sensors, lights, keypad), the sensor flags,
 * extra flags (keypad: tampered, disarmed), open / closed (a wall safe). Furniture: {}.
 */
export function propState(def) {
  return {
    ...(sensesOf(def).length ? sensorState(sensesOf(def)) : powerOf(def) ? { on: true } : {}),
    ...Object.fromEntries((def?.flags ?? []).map((f) => [f, false])),
    ...(def?.openable ? { open: false } : {}),
    ...(def?.wreckable ? { wrecked: false } : {}),
  };
}

/** The state players may see: lights' on / off and open / closed. Sensors' and the keypad's state stay with the GM. */
export function publicState(p, def) {
  return { ...(powerOf(def) === 'public' ? { on: p.on !== false } : {}), ...(def?.openable ? { open: Boolean(p.open) } : {}), ...(def?.wreckable ? { wrecked: Boolean(p.wrecked) } : {}) };
}

/** Decision 99: an open gate (openPasses) lets people — and sight — through; everything else as its record says. */
export const propBlocksMove = (def, p) => Boolean(def?.blocksMove && !(def.openPasses && p.open));
export const propBlocksSight = (def, p) => Boolean(def?.blocksSight && !(def.openPasses && p.open));

/** A GM label and note on any placed piece (decision 99): never sent to players. */
export const NOTE_MAX = { label: 40, note: 300 };
/** Reach in squares of a placed sensor for a sense (motion: a line ahead, audio: a radius); null when it has none. */
export const reachOf = (p, def, sense) => p.reach?.[sense] ?? def?.sensor?.reach?.[sense] ?? null;

export function setReach(map, data, id, sense, n) {
  const { min, max } = data.map.sensor.reach;
  const p = (map.props ?? []).find((x) => x.id === id);
  if (!p) return map;
  return setProp(map, id, { reach: { ...(p.reach ?? {}), [sense]: Math.max(min, Math.min(max, Math.round(Number(n) || 0))) } });
}
export const normRot = (deg) => ((Math.round(Number(deg) || 0) % 360) + 360) % 360;
/** Props that count on the map right now: everything not hidden. */
export const activeProps = (map) => (map.props ?? []).filter((p) => !p.hidden);

const nextPropId = (map) => {
  const used = new Set((map.props ?? []).map((p) => p.id));
  for (let n = (map.props ?? []).length + 1; ; n++) if (!used.has(`p${n}`)) return `p${n}`;
};

/** Width and depth as they lie on the map (a quarter turn swaps them). */
function extent(def, rot) {
  const quarter = normRot(rot) % 180 === 90;
  return quarter ? { w: def.size.h, h: def.size.w } : { w: def.size.w, h: def.size.h };
}

/**
 * Where a prop's centre goes for a pointer at `pt`. Snap on: its edges land on half-square lines, so a ½-deep
 * cupboard sits flush against a wall on a grid line. Snap off: free, to 1/20 of a square.
 */
export function snapProp(pt, def, rot, snap) {
  if (!snap) return { x: round(pt.x, FREE_STEP), y: round(pt.y, FREE_STEP) };
  const { w, h } = extent(def, rot);
  return { x: round(round(pt.x - w / 2, 0.5) + w / 2, 0.01), y: round(round(pt.y - h / 2, 0.5) + h / 2, 0.01) };
}

export function addProp(map, data, { prop, x, y, rot = 0, hidden }) {
  const def = propDef(data, prop);
  if (!def) return map;
  return { ...clone(map), props: [...(map.props ?? []), { id: nextPropId(map), prop, x, y, rot: normRot(rot), hidden: hidden ?? Boolean(def.hiddenByDefault), ...propState(def) }] };
}

export function setProp(map, id, fields) {
  const next = clone(map);
  const p = (next.props ?? []).find((x) => x.id === id);
  if (!p) return map;
  Object.assign(p, fields);
  p.rot = normRot(p.rot);
  p.hidden = Boolean(p.hidden);
  return next;
}

export const removeProp = (map, id) => ({ ...clone(map), props: (map.props ?? []).filter((p) => p.id !== id) });
export const rotateProp = (map, id, delta = 90) => setProp(map, id, { rot: ((map.props ?? []).find((p) => p.id === id)?.rot ?? 0) + delta });

/** The four corners of a placed prop, in squares (back-left, back-right, front-right, front-left as drawn). */
export function propCorners(p, data) {
  const def = propDef(data, p.prop);
  if (!def) return [];
  const a = (normRot(p.rot) * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const { w, h } = def.size;
  return [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]]
    .map(([dx, dy]) => ({ x: p.x + dx * cos - dy * sin, y: p.y + dx * sin + dy * cos }));
}

/** A prop's outline as four segments (they block sight / movement like walls when the prop does). */
export function propEdges(p, data) {
  const c = propCorners(p, data);
  return c.map((a, i) => ({ a, b: c[(i + 1) % c.length], kind: 'prop', prop: p.prop }));
}

/** Is the point inside the prop's footprint? (edges count) */
export function insideProp(pt, p, data) {
  const def = propDef(data, p.prop);
  if (!def) return false;
  const a = (-normRot(p.rot) * Math.PI) / 180;
  const dx = pt.x - p.x;
  const dy = pt.y - p.y;
  const lx = dx * Math.cos(a) - dy * Math.sin(a);
  const ly = dx * Math.sin(a) + dy * Math.cos(a);
  return Math.abs(lx) <= def.size.w / 2 + 1e-9 && Math.abs(ly) <= def.size.h / 2 + 1e-9;
}

/**
 * The topmost prop under a point — furniture before the floor under it (hidden ones too when `withHidden`: GM
 * screens). ground: true = any piece, false = never a ground piece (floors, terrain, outlines: a tap tries
 * doors and walls before them), 'only' = ground pieces only. floors: false skips floor textures altogether.
 */
export function hitProp(map, data, pt, { withHidden = true, ground = true, floors = true } = {}) {
  const under = [...(withHidden ? map.props ?? [] : activeProps(map))].reverse()
    .filter((p) => insideProp(pt, p, data) && (floors || propDef(data, p.prop)?.category !== 'floor'));
  const top = under.filter((p) => !isGround(data, p));
  const low = under.filter((p) => isGround(data, p));
  const pick = ground === 'only' ? low[0] : ground ? top[0] ?? low[0] : top[0];
  return pick?.id ?? null;
}

const EDGE_INDEX = { back: 0, right: 1, front: 2, left: 3 };
/** The sides of a piece nobody crosses (stairs: the long sides; elevators: all but the doors), as segments. */
export function blockedEdges(p, data) {
  const sides = propDef(data, p.prop)?.blockEdges ?? [];
  const edges = propEdges(p, data);
  return sides.map((s) => edges[EDGE_INDEX[s]]).filter(Boolean);
}

/**
 * A walk-in piece's walls (decision 85: freight containers): `shell: { door: 'front' }` — every side blocks
 * movement and sight like a wall, the door side only while the piece is closed. The inside is open floor.
 */
export function shellEdges(p, data) {
  const shell = propDef(data, p.prop)?.shell;
  if (!shell) return [];
  const edges = propEdges(p, data);
  return Object.entries(EDGE_INDEX).filter(([side]) => side !== shell.door || !p.open).map(([, i]) => edges[i]).filter(Boolean);
}

/**
 * Squares that are difficult ground (they cost 2 to enter, manual 7-2): a difficult prop covers at least a
 * third of the square (sampled on a 3 × 3 grid). Set of "x,y".
 */
export function difficultSquares(map, data) {
  const out = new Set();
  for (const p of activeProps(map)) {
    if (!propDef(data, p.prop)?.difficult) continue;
    const c = propCorners(p, data);
    const [x0, x1] = [Math.floor(Math.min(...c.map((q) => q.x))), Math.ceil(Math.max(...c.map((q) => q.x)))];
    const [y0, y1] = [Math.floor(Math.min(...c.map((q) => q.y))), Math.ceil(Math.max(...c.map((q) => q.y)))];
    for (let x = x0; x < x1; x++) {
      for (let y = y0; y < y1; y++) {
        let n = 0;
        for (const fx of [0.25, 0.5, 0.75]) for (const fy of [0.25, 0.5, 0.75]) if (insideProp({ x: x + fx, y: y + fy }, p, data)) n++;
        if (n >= 3) out.add(`${x},${y}`);
      }
    }
  }
  return out;
}
