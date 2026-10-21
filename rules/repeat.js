// Repeat placement in the map builder (decision 83): drag a line or an area and the picked piece is copied at
// its own size from the first spot — copies butt against each other, whatever the snap — or every `spacing`
// squares (ceiling lights every 3). A spot that already holds the same piece is skipped, so painting over an
// area twice never stacks; a floor texture may replace the floor tile already there.

import { propDef, snapProp, addProp, normRot } from './props.js';

export const REPEAT_MAX = 400;
const near = (a, b) => Math.abs(a - b) < 0.01;
const turned = (def, rot) => (normRot(rot) % 180 === 90 ? { w: def.size.h, h: def.size.w } : { w: def.size.w, h: def.size.h });

/**
 * Centres for copies of `prop` from point `from` to point `to`. mode: 'line' (along the longer direction of the
 * drag) or 'area' (the rectangle); spacing: 0 = touching, n = every n squares (never closer than the piece).
 * @returns [{ x, y }] — at most REPEAT_MAX
 */
export function repeatSpots(data, prop, rot, from, to, { mode = 'area', spacing = 0, snap = true } = {}) {
  const def = propDef(data, prop);
  if (!def) return [];
  const size = turned(def, rot);
  const first = snapProp(from, def, rot, snap);
  const step = { x: spacing ? Math.max(spacing, size.w) : size.w, y: spacing ? Math.max(spacing, size.h) : size.h };
  const dx = to.x - first.x;
  const dy = to.y - first.y;
  const count = (d, s) => Math.floor((Math.abs(d) + s / 2) / s) + 1; // a copy counts once the drag passes half of it
  let nx = count(dx, step.x);
  let ny = count(dy, step.y);
  if (mode === 'line') { if (Math.abs(dx) >= Math.abs(dy)) ny = 1; else nx = 1; }
  const out = [];
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      if (out.length >= REPEAT_MAX) return out;
      out.push({ x: Number((first.x + Math.sign(dx || 1) * i * step.x).toFixed(2)), y: Number((first.y + Math.sign(dy || 1) * j * step.y).toFixed(2)) });
    }
  }
  return out;
}

/**
 * Places `prop` at every spot, skipping spots that already hold the same piece. replaceFloor: a floor texture
 * first removes the other floor textures whose centre lies under it. @returns { map, added }
 */
export function placeMany(map, data, prop, rot, spots, { replaceFloor = false } = {}) {
  const def = propDef(data, prop);
  if (!def) return { map, added: 0 };
  const size = turned(def, rot);
  let next = map;
  let added = 0;
  for (const s of spots) {
    if ((next.props ?? []).some((p) => p.prop === prop && near(p.x, s.x) && near(p.y, s.y))) continue;
    if (replaceFloor && def.category === 'floor') {
      const under = (p) => propDef(data, p.prop)?.category === 'floor' && Math.abs(p.x - s.x) < size.w / 2 && Math.abs(p.y - s.y) < size.h / 2;
      next = { ...next, props: next.props.filter((p) => !under(p)) };
    }
    next = addProp(next, data, { prop, x: s.x, y: s.y, rot });
    added++;
  }
  return { map: next, added };
}
