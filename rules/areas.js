// Floor areas (decision 294): a rectangle of whole squares filled with a floor texture from the library, repeated
// like a hatch — one object instead of a tile per square. A floor of 200 tiles becomes one area. They are floors:
// never in the way of sight or movement; an area of a difficult texture (rubble, water) is difficult ground.
// `rot` turns the texture inside each square (a curb or an edge piece keeps its direction). Pure.

import { propDef } from './props.js';

const MAX_AREAS = 1500;
const int = (v) => Math.round(Number(v) || 0);
const ROTS = [0, 90, 180, 270];

/** Pieces whose drawing can fill an area: the library's 1 × 1 floor textures. */
export const isAreaTexture = (def) => Boolean(def) && def.category === 'floor' && def.size?.w === 1 && def.size?.h === 1 && !def.open && !def.floorLink && !def.decal; // decals stay pieces: they lie on top

/** Areas read from a file: known textures, whole squares inside the map, ids kept or made. */
export function normalizeAreas(raw, map, data) {
  const out = [];
  const used = new Set();
  for (const a of Array.isArray(raw) ? raw.slice(0, MAX_AREAS) : []) {
    if (!isAreaTexture(propDef(data, a?.tex))) continue;
    const x = Math.max(0, int(a.x));
    const y = Math.max(0, int(a.y));
    const w = Math.min(int(a.w), map.cols - x);
    const h = Math.min(int(a.h), map.rows - y);
    if (w < 1 || h < 1) continue;
    let id = typeof a.id === 'string' && /^a\d+$/.test(a.id) && !used.has(a.id) ? a.id : null;
    for (let n = out.length + 1; !id; n++) if (!used.has(`a${n}`)) id = `a${n}`;
    used.add(id);
    out.push({ id, tex: a.tex, x, y, w, h, rot: ROTS.includes(int(a.rot)) ? int(a.rot) : 0 });
  }
  return out;
}

const nextId = (map) => { const used = new Set((map.areas ?? []).map((a) => a.id)); for (let n = (map.areas ?? []).length + 1; ; n++) if (!used.has(`a${n}`)) return `a${n}`; };

/** A rectangle between two squares (any corners, both included). */
export const areaRect = (p, q) => ({ x: Math.min(Math.floor(p.x), Math.floor(q.x)), y: Math.min(Math.floor(p.y), Math.floor(q.y)), w: Math.abs(Math.floor(p.x) - Math.floor(q.x)) + 1, h: Math.abs(Math.floor(p.y) - Math.floor(q.y)) + 1 });

export function addArea(map, data, { tex, x, y, w, h, rot = 0 }) {
  const [a] = normalizeAreas([{ tex, x, y, w, h, rot }], map, data);
  return a ? { ...map, areas: [...(map.areas ?? []), { ...a, id: nextId(map) }] } : map;
}
export const removeArea = (map, id) => ({ ...map, areas: (map.areas ?? []).filter((a) => a.id !== id) });

/** The topmost area covering a point (the last drawn), or null. */
export function areaAt(map, p) {
  const list = map.areas ?? [];
  for (let i = list.length - 1; i >= 0; i--) {
    const a = list[i];
    if (p.x >= a.x && p.y >= a.y && p.x < a.x + a.w && p.y < a.y + a.h) return a.id;
  }
  return null;
}

/** Squares of difficult ground the areas make ("x,y"). */
export function areaDifficult(map, data) {
  const out = new Set();
  for (const a of map.areas ?? []) {
    if (!propDef(data, a.tex)?.difficult) continue;
    for (let x = a.x; x < a.x + a.w; x++) for (let y = a.y; y < a.y + a.h; y++) out.add(`${x},${y}`);
  }
  return out;
}

/**
 * Turns 1 × 1 floor tiles into areas: tiles of the same texture and turn, side by side, become the fewest rectangles
 * (row runs, stacked when they line up). Hidden tiles, tiles with a label, note, caption or loot, and tiles off the
 * square grid stay as they are. @returns { map, tiles: how many tiles went, areas: how many areas came }
 */
export function mergeTiles(map, data) {
  const keep = [];
  const groups = new Map(); // "tex|rot" → Set of "x,y"
  for (const p of map.props ?? []) {
    const def = propDef(data, p.prop);
    const cx = p.x - 0.5;
    const cy = p.y - 0.5;
    const onGrid = Math.abs(cx - Math.round(cx)) < 0.01 && Math.abs(cy - Math.round(cy)) < 0.01;
    const plain = !p.hidden && !p.label && !p.note && !p.caption && !p.loot && !p.search;
    if (!isAreaTexture(def) || !onGrid || !plain) { keep.push(p); continue; }
    const k = `${p.prop}|${ROTS.includes(int(p.rot)) ? int(p.rot) : 0}`;
    if (!groups.has(k)) groups.set(k, new Set());
    groups.get(k).add(`${Math.round(cx)},${Math.round(cy)}`);
  }
  let areas = [...(map.areas ?? [])];
  let made = 0;
  let tiles = 0;
  for (const [k, cells] of groups) {
    const [tex, rot] = k.split('|');
    tiles += cells.size;
    const has = (x, y) => cells.has(`${x},${y}`);
    // row runs, then runs with the same span on the next rows join them (a rectangle grows downward)
    const pts = [...cells].map((c) => c.split(',').map(Number)).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
    const taken = new Set();
    for (const [x0, y0] of pts) {
      if (taken.has(`${x0},${y0}`)) continue;
      let w = 0;
      while (has(x0 + w, y0) && !taken.has(`${x0 + w},${y0}`)) w++;
      let h = 1;
      for (;;) {
        let row = true;
        for (let i = 0; i < w; i++) if (!has(x0 + i, y0 + h) || taken.has(`${x0 + i},${y0 + h}`)) { row = false; break; }
        if (!row) break;
        h++;
      }
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) taken.add(`${x0 + i},${y0 + j}`);
      areas.push({ tex, x: x0, y: y0, w, h, rot: Number(rot) });
      made++;
    }
  }
  if (!tiles) return { map, tiles: 0, areas: 0 };
  areas = normalizeAreas(areas, map, data);
  return { map: { ...map, props: keep, areas }, tiles, areas: made };
}

/**
 * Decision 294: how heavy a map is, against a budget that keeps a table of tablets smooth — pieces (floor tiles apart),
 * the biggest floor frame in squares, the number of floors. Each with a level: 'ok' | 'heavy' | 'too' (green, amber, red).
 */
export const MAP_BUDGET = { pieces: [1000, 1500], squares: [1200, 2000], floors: [4, 6] };
export function mapWeight(map, data) {
  const props = map.props ?? [];
  const tiles = props.filter((p) => isAreaTexture(propDef(data, p.prop))).length;
  const floors = map.floors ?? [];
  const squares = floors.length ? Math.max(...floors.map((f) => f.w * f.h)) : map.cols * map.rows;
  const level = (n, [ok, heavy]) => (n <= ok ? 'ok' : n <= heavy ? 'heavy' : 'too');
  return {
    pieces: props.length, tiles, areas: (map.areas ?? []).length, squares, floors: floors.length,
    level: { pieces: level(props.length, MAP_BUDGET.pieces), squares: level(squares, MAP_BUDGET.squares), floors: level(floors.length, MAP_BUDGET.floors) },
  };
}
