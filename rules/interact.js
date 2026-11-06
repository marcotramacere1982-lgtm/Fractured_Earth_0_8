// Decision 241: Interact with the things next to you on the table map. In a fight, on your turn, one Interact
// action works a door, flips a wall switch or switches a device on / off (a lamp, a screen, a machine) — whatever
// is within reach of your square. Ceiling lights, fires, street lamps and lifts aren't worked by hand (`interact:
// false` in props.json): a light points to its switch. Breakers and power sources are asked of the GM. GM-only,
// hidden and private pieces (keypads, sensors) never show. Out of a fight the GM switches things (doors as before).

import { propDef, powerOf, normRot } from './props.js';
import { circuitRole } from './power.js';
import { nextToDoor } from './map.js';

export const REACH = 1.3; // squares from the centre of your square to the piece's footprint: the eight squares around you (a small switch in a diagonal one too), never two away

/**
 * What a player can do with a piece by hand: 'open' (a gate, a hatch, a container: open / close it like a door —
 * decision 248; the GM may have locked it), 'switch' (a wall switch: flip it — players never see its state),
 * 'toggle' (on / off, the state players see), 'ask' (a breaker or a power source: the GM decides),
 * 'light' (a light not worked by hand: use its switch), or null (nothing to work).
 */
export function interactKind(def, p = null) {
  if (!def || def.gmOnly) return null;
  if (def.openable && def.interact !== false) return 'open';
  if (p?.search) return 'search'; // decision 277: the GM marked it searchable (what's in it stays the GM's)
  if (def.control) return 'ask'; // decision 258: a valve or shut-off — the GM decides (it may control a hazard)
  const role = circuitRole(def);
  if (role === 'switch') return 'switch';
  if (role === 'breaker' || role === 'source') return 'ask';
  if (powerOf(def) === 'public') return def.interact === false ? (def.category === 'light' ? 'light' : null) : 'toggle';
  return null;
}

/**
 * Decision 255: the locks a character found by trying them (a door or a piece, by map) — there the sheet offers
 * "Locked — try to open it", which asks the GM (no action) instead of spending one on the handle again.
 */
export const lockKey = (mapId, id) => `${mapId}:${id}`;
export const knowsLocked = (c, mapId, id) => (c?.play?.locks ?? []).includes(lockKey(mapId, id));
/** The character's known locks after the GM's answer: { locked } adds one, { unlocked } takes it off (kept to the last 40). */
export function noteLock(locks, { locked = null, unlocked = null } = {}) {
  const ok = (x) => x && typeof x.map === 'string' && typeof x.id === 'string';
  let out = [...(locks ?? [])];
  if (ok(unlocked)) out = out.filter((k) => k !== lockKey(unlocked.map, unlocked.id));
  if (ok(locked) && !out.includes(lockKey(locked.map, locked.id))) out = [...out, lockKey(locked.map, locked.id)].slice(-40);
  return out;
}

/** Is a placed piece within reach of someone standing on `square` ({ x, y } of the square's corner)? */
export function nextToProp(square, p, data) {
  const def = propDef(data, p.prop);
  if (!def) return false;
  const a = (-normRot(p.rot) * Math.PI) / 180;
  const dx = square.x + 0.5 - p.x;
  const dy = square.y + 0.5 - p.y;
  const lx = Math.abs(dx * Math.cos(a) - dy * Math.sin(a)) - def.size.w / 2;
  const ly = Math.abs(dx * Math.sin(a) + dy * Math.cos(a)) - def.size.h / 2;
  return Math.hypot(Math.max(lx, 0), Math.max(ly, 0)) <= REACH;
}

/** Which side of you a point is: 'n' 'ne' 'e' 'se' 's' 'sw' 'w' 'nw', or 'here' (on your square). North is up. */
export function sideOf(square, pt) {
  const dx = pt.x - (square.x + 0.5);
  const dy = pt.y - (square.y + 0.5);
  if (Math.abs(dx) < 0.35 && Math.abs(dy) < 0.35) return 'here';
  const i = Math.round(((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360 / 45) % 8;
  return ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'][i];
}

/**
 * Everything within reach on a public map (what the sheet sees), for the Interact picker:
 * [{ kind: 'door', id, open, side } | { kind: 'switch' | 'toggle' | 'ask', id, prop, name, on?, side }], doors first (side: sideOf).
 */
export function withinReach(map, data, square) {
  if (!map || !square) return [];
  const doors = (map.walls ?? []).filter((w) => w.kind === 'door' && nextToDoor(square, w)).map((w) => ({ kind: 'door', id: w.id, open: Boolean(w.open), ...(w.powered ? { powered: true } : {}), side: sideOf(square, { x: (w.a.x + w.b.x) / 2, y: (w.a.y + w.b.y) / 2 }) }));
  const pieces = (map.props ?? []).flatMap((p) => {
    const def = propDef(data, p.prop);
    const kind = interactKind(def, p);
    if (!kind || kind === 'light' || !nextToProp(square, p, data)) return [];
    return [{ kind, id: p.id, prop: p.prop, name: p.caption || def.name, side: sideOf(square, p), ...(kind === 'toggle' ? { on: p.on !== false } : {}), ...(kind === 'open' ? { open: Boolean(p.open) } : {}) }];
  });
  return [...doors, ...pieces];
}
