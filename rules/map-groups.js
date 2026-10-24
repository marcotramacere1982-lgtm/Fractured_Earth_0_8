// Groups and blocks on a tactical map (decision 83). A group is several things selected at once — walls (doors,
// windows, lasers), props and zones — to move, turn, copy or delete together. A block is a group saved by name
// (a motel room, a cubicle row) and dropped again as many times as needed: once dropped, every piece is
// independent. Blocks are anchored on whole squares, so walls stay on grid lines. Pure: every change returns a new map.
// Decision 141: a block keeps the power wires and data links between its own pieces (ends by position in the block).

import { addWall, setWall } from './map.js';
import { addProp, setProp, normRot } from './props.js';
import { addZone, setZone } from './zones.js';

export const emptyGroup = () => ({ walls: [], props: [], zones: [] });
export const groupSize = (g) => (g ? g.walls.length + g.props.length + g.zones.length : 0);

const mid = (w) => ({ x: (w.a.x + w.b.x) / 2, y: (w.a.y + w.b.y) / 2 });
const zoneMid = (z) => ({ x: z.x + z.w / 2, y: z.y + z.h / 2 });
const inside = (p, r) => p.x >= r.x0 && p.x <= r.x1 && p.y >= r.y0 && p.y <= r.y1;

/** Everything whose middle lies inside the box (two corners in squares, any order). skipProp(p): leave that piece out (floor lock). */
export function pickGroup(map, a, b, { skipProp = null } = {}) {
  const r = { x0: Math.min(a.x, b.x), y0: Math.min(a.y, b.y), x1: Math.max(a.x, b.x), y1: Math.max(a.y, b.y) };
  return {
    walls: map.walls.filter((w) => inside(mid(w), r)).map((w) => w.id),
    props: (map.props ?? []).filter((p) => inside(p, r) && !skipProp?.(p)).map((p) => p.id),
    zones: (map.zones ?? []).filter((z) => inside(zoneMid(z), r)).map((z) => z.id),
  };
}

/** The group's members as they are now (ids that no longer exist drop out). */
function members(map, g) {
  return {
    walls: map.walls.filter((w) => g.walls.includes(w.id)),
    props: (map.props ?? []).filter((p) => g.props.includes(p.id)),
    zones: (map.zones ?? []).filter((z) => g.zones.includes(z.id)),
  };
}

/** The group's outline on whole squares: { x, y, w, h } (x, y = top-left corner). */
export function groupBox(map, g) {
  const m = members(map, g);
  const pts = [...m.walls.flatMap((w) => [w.a, w.b]), ...m.props.map((p) => ({ x: p.x, y: p.y })), ...m.zones.flatMap((z) => [{ x: z.x, y: z.y }, { x: z.x + z.w, y: z.y + z.h }])];
  if (!pts.length) return null;
  const x = Math.floor(Math.min(...pts.map((p) => p.x)));
  const y = Math.floor(Math.min(...pts.map((p) => p.y)));
  return { x, y, w: Math.max(1, Math.ceil(Math.max(...pts.map((p) => p.x))) - x), h: Math.max(1, Math.ceil(Math.max(...pts.map((p) => p.y))) - y) };
}

const strip = (o, drop) => Object.fromEntries(Object.entries(o).filter(([k]) => !drop.includes(k)));
const rel = (p, box) => ({ x: Number((p.x - box.x).toFixed(2)), y: Number((p.y - box.y).toFixed(2)) });

/** A block from a group: everything relative to its top-left square, ids dropped. null for an empty group. */
export function makeBlock(map, g, name = 'Block') {
  const box = groupBox(map, g);
  if (!box) return null;
  const m = members(map, g);
  // wires whose two ends are both in the group, their ends written as { k: 'p' | 'w', i: position in the block }
  const end = (id) => { const i = m.props.findIndex((p) => p.id === id); if (i >= 0) return { k: 'p', i }; const j = m.walls.findIndex((w) => w.id === id); return j >= 0 ? { k: 'w', i: j } : null; };
  const wires = (map.wires ?? []).map((w) => ({ w, from: end(w.from), to: end(w.to) })).filter((x) => x.from && x.to)
    .map(({ w, from, to }) => ({ from, to, ...(w.net ? { net: w.net } : {}), ...(w.wifi ? { wifi: true } : {}), ...(w.cut ? { cut: true } : {}) }));
  return {
    name: String(name).trim().slice(0, 60) || 'Block', w: box.w, h: box.h,
    walls: m.walls.map((w) => ({ ...strip(w, ['id', 'a', 'b']), a: rel(w.a, box), b: rel(w.b, box) })),
    props: m.props.map((p) => ({ ...strip(p, ['id', 'x', 'y']), ...rel(p, box) })),
    zones: m.zones.map((z) => ({ ...strip(z, ['id', 'n', 'x', 'y']), ...rel(z, box) })),
    ...(wires.length ? { wires } : {}),
  };
}

/** Fresh wire ids for a map: x1, x2… not used yet. */
function wireIds(map) {
  const used = new Set((map.wires ?? []).map((w) => w.id));
  let n = 0;
  return () => { do n++; while (used.has(`x${n}`)); used.add(`x${n}`); return `x${n}`; };
}

/** Turns a point of a w × h block a quarter clockwise `q` times, keeping it inside the turned block. */
function turn(p, w, h, q) {
  let { x, y } = p;
  let W = w;
  let H = h;
  for (let i = 0; i < q; i++) { [x, y] = [H - y, x]; [W, H] = [H, W]; }
  return { x: Number(x.toFixed(2)), y: Number(y.toFixed(2)) };
}
/** The block's size once turned `rot` degrees (90 / 270 swap width and height). */
export const turnedSize = (block, rot) => (normRot(rot) % 180 === 90 ? { w: block.h, h: block.w } : { w: block.w, h: block.h });

/**
 * Drops a copy of a block with its top-left at square `at`, turned `rot` (0 / 90 / 180 / 270, clockwise).
 * Every piece gets a new id. @returns { map, group } — the group selects what was just dropped.
 */
export function placeBlock(map, block, data, at, rot = 0) {
  const q = Math.round(normRot(rot) / 90) % 4;
  const put = (p) => { const t = turn(p, block.w, block.h, q); return { x: t.x + at.x, y: t.y + at.y }; };
  let next = { ...map, zones: map.zones ?? [] };
  const group = emptyGroup();
  const ids = { w: [], p: [] }; // the new id of each block wall / piece, by its position in the block (null: not placed)
  for (const w of block.walls ?? []) {
    const added = addWall(next, { a: put(w.a), b: put(w.b), kind: w.kind, width: w.width, open: w.open });
    if (added === next) { ids.w.push(null); continue; }
    const id = added.walls.at(-1).id;
    next = setWall(added, id, strip(w, ['a', 'b', 'kind', 'width']));
    group.walls.push(id);
    ids.w.push(id);
  }
  for (const p of block.props ?? []) {
    const added = addProp(next, data, { prop: p.prop, ...put(p), rot: normRot((p.rot ?? 0) + q * 90), hidden: p.hidden });
    if (added === next) { ids.p.push(null); continue; }
    const id = added.props.at(-1).id;
    next = setProp(added, id, strip(p, ['prop', 'x', 'y', 'rot', 'hidden']));
    group.props.push(id);
    ids.p.push(id);
  }
  // the block's own wires and links, between the new pieces (decision 141)
  const fresh = wireIds(next);
  const placed = (block.wires ?? []).map((w) => ({ from: ids[w.from?.k]?.[w.from?.i], to: ids[w.to?.k]?.[w.to?.i], w })).filter((x) => x.from && x.to)
    .map(({ from, to, w }) => ({ id: fresh(), from, to, ...(w.net ? { net: w.net } : {}), ...(w.wifi ? { wifi: true } : {}), ...(w.cut ? { cut: true } : {}) }));
  if (placed.length) next = { ...next, wires: [...(next.wires ?? []), ...placed] };
  for (const z of block.zones ?? []) {
    const c1 = put({ x: z.x, y: z.y });
    const c2 = put({ x: z.x + z.w, y: z.y + z.h });
    const added = addZone(next, data, { type: z.type, x: Math.min(c1.x, c2.x), y: Math.min(c1.y, c2.y), w: Math.abs(c2.x - c1.x), h: Math.abs(c2.y - c1.y) });
    const id = added.zones.at(-1).id;
    next = setZone(added, data, id, { label: z.label ?? '', note: z.note ?? '' });
    group.zones.push(id);
  }
  return { map: next, group, ids };
}

/** Removes everything in the group, and the wires that ran to it. */
export const deleteGroup = (map, g) => ({
  ...map,
  walls: map.walls.filter((w) => !g.walls.includes(w.id)),
  props: (map.props ?? []).filter((p) => !g.props.includes(p.id)),
  zones: (map.zones ?? []).filter((z) => !g.zones.includes(z.id)),
  ...(map.wires ? { wires: map.wires.filter((w) => ![w.from, w.to].some((id) => g.props.includes(id) || g.walls.includes(id))) } : {}),
});

/** Moves the group by whole squares (ids kept). */
export function moveGroup(map, g, dx, dy) {
  const sh = (p) => ({ x: Number((p.x + dx).toFixed(2)), y: Number((p.y + dy).toFixed(2)) });
  return {
    ...map,
    walls: map.walls.map((w) => (g.walls.includes(w.id) ? { ...w, a: sh(w.a), b: sh(w.b) } : w)),
    props: (map.props ?? []).map((p) => (g.props.includes(p.id) ? { ...p, ...sh(p) } : p)),
    zones: (map.zones ?? []).map((z) => (g.zones.includes(z.id) ? { ...z, x: z.x + dx, y: z.y + dy } : z)),
  };
}

/** Turns the group a quarter clockwise in place (same top-left square). @returns { map, group } (new ids). */
export function rotateGroup(map, g, data) {
  const box = groupBox(map, g);
  const block = makeBlock(map, g);
  if (!box || !block) return { map, group: g };
  // wires to things outside the group follow the turned pieces to their new ids (decision 141)
  const m = members(map, g);
  const out = (map.wires ?? []).filter((w) => [w.from, w.to].some((id) => g.props.includes(id) || g.walls.includes(id)) && ![w.from, w.to].every((id) => g.props.includes(id) || g.walls.includes(id)));
  const turned = placeBlock(deleteGroup(map, g), block, data, { x: box.x, y: box.y }, 90);
  const renamed = (id) => { const i = m.props.findIndex((p) => p.id === id); if (i >= 0) return turned.ids.p[i] ?? null; const j = m.walls.findIndex((w) => w.id === id); return j >= 0 ? turned.ids.w[j] ?? null : id; };
  const kept = out.map((w) => ({ ...w, from: renamed(w.from), to: renamed(w.to) })).filter((w) => w.from && w.to);
  return kept.length ? { ...turned, map: { ...turned.map, wires: [...(turned.map.wires ?? []), ...kept] } } : turned;
}

/** Copies the group one square right and down. @returns { map, group } (the copy). */
export function duplicateGroup(map, g, data) {
  const box = groupBox(map, g);
  const block = makeBlock(map, g);
  return box && block ? placeBlock(map, block, data, { x: box.x + 1, y: box.y + 1 }) : { map, group: g };
}

/** A block read from the GM's file: known kinds, pieces and zone types only (the rest is dropped). */
export function normalizeBlock(raw, data) {
  if (!raw || typeof raw !== 'object') return null;
  const finite = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const kinds = new Set(data.map.kinds.map((k) => k.id));
  const block = {
    id: String(raw.id ?? '').slice(0, 40), name: String(raw.name ?? 'Block').slice(0, 60) || 'Block',
    w: Math.max(1, Math.min(100, Math.round(Number(raw.w) || 1))), h: Math.max(1, Math.min(100, Math.round(Number(raw.h) || 1))),
    walls: (Array.isArray(raw.walls) ? raw.walls : []).filter((w) => kinds.has(w?.kind) && finite(w.a) && finite(w.b)).slice(0, 500),
    props: (Array.isArray(raw.props) ? raw.props : []).filter((p) => data.props.props.some((d) => d.id === p?.prop) && finite(p)).slice(0, 500),
    zones: (Array.isArray(raw.zones) ? raw.zones : []).filter((z) => data.map.zones.types.some((t) => t.id === z?.type) && [z.x, z.y, z.w, z.h].every(Number.isFinite)).slice(0, 50),
    updatedAt: Number(raw.updatedAt) || Date.now(),
  };
  // wires keep their ends by position: renumber them past anything dropped above (decision 141)
  const at = (list, kept) => { const map = new Map(); let n = 0; (Array.isArray(list) ? list : []).forEach((x, i) => { if (kept.includes(x)) map.set(i, n++); }); return map; };
  const idx = { w: at(raw.walls, block.walls), p: at(raw.props, block.props) };
  const end = (e) => (e && (e.k === 'w' || e.k === 'p') && Number.isInteger(e.i) && idx[e.k].has(e.i) ? { k: e.k, i: idx[e.k].get(e.i) } : null);
  const wires = (Array.isArray(raw.wires) ? raw.wires : []).slice(0, 1000).map((w) => ({ w, from: end(w?.from), to: end(w?.to) })).filter((x) => x.from && x.to)
    .map(({ w, from, to }) => ({ from, to, ...(w.net === 'data' ? { net: 'data' } : {}), ...(w.wifi === true ? { wifi: true } : {}), ...(w.cut === true ? { cut: true } : {}) }));
  if (wires.length) block.wires = wires;
  return block.walls.length + block.props.length + block.zones.length ? block : null;
}
