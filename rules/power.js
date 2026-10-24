// Power wiring (decision 127). GM-only wires join pieces (and electric doors) by id: a source feeds breakers,
// switches and sockets, they feed the loads (lights, sensors, keypads, screens, doors). A breaker with nothing
// wired into it stands for the building's mains: a point of origin. A piece is fed when any wire into it, not
// cut, comes from something fed — so a backup generator on the same fusebox keeps it live until both are cut.
// Breakers and switches pass power only while on; a wired load runs while fed, or on its battery; a wired electric
// door without power locks (fail-secure) or unlocks (fail-safe). Unwired pieces stay manual, as before.
// Players never see wires: only what happens (a light goes out, a door won't open). Pure.

import { propDef, activeProps, sensesOf } from './props.js';

export const FEEDERS = ['source', 'breaker', 'switch', 'outlet']; // outlet: a wall socket, passes power on
export const FAIL_MODES = ['secure', 'safe']; // secure: locks without power (a vault) · safe: unlocks (a fire exit)

/** What a library piece does in a circuit: 'source' | 'breaker' | 'switch' | 'outlet' (from the data), 'load' (anything powered), or null. */
export function circuitRole(def) {
  if (!def) return null;
  if (FEEDERS.includes(def.circuit)) return def.circuit;
  return def.power || def.light || sensesOf(def).length ? 'load' : null;
}

const powerWires = (list) => (list ?? []).filter((w) => w.net !== 'data'); // data links (decision 129) share map.wires

/** Keeps a power wire only between two things that can carry power, from a feeder; drops repeats (data links are left out). */
export function normalizeWires(raw, map, data) {
  const ends = endsOf(map, data);
  const seen = new Set();
  const out = [];
  for (const w of powerWires(Array.isArray(raw) ? raw : []).slice(0, 3000)) {
    const from = ends.get(w?.from);
    const to = ends.get(w?.to);
    if (!from || !to || w.from === w.to || !FEEDERS.includes(from) || seen.has(`${w.from}>${w.to}`)) continue;
    seen.add(`${w.from}>${w.to}`);
    out.push({ id: /^x\d{1,6}$/.test(w.id ?? '') ? w.id : null, from: w.from, to: w.to, ...(w.cut === true ? { cut: true } : {}) });
  }
  const used = new Set();
  let n = 0;
  for (const w of out) { // ids kept like walls'; missing or repeated ones get a fresh one
    if (!w.id || used.has(w.id)) do w.id = `x${++n}`; while (out.some((x) => x !== w && x.id === w.id) || used.has(w.id));
    used.add(w.id);
  }
  return out;
}

/** Every piece or door a wire may end on, with its role ('door' for an electric door). */
function endsOf(map, data) {
  const ends = new Map();
  for (const p of map.props ?? []) { const r = circuitRole(propDef(data, p.prop)); if (r) ends.set(p.id, r); }
  for (const w of map.walls ?? []) if (w.kind === 'door' && w.powered) ends.set(w.id, 'door');
  return ends;
}

const nextWireId = (map) => {
  const used = new Set((map.wires ?? []).map((w) => w.id));
  for (let n = (map.wires ?? []).length + 1; ; n++) if (!used.has(`x${n}`)) return `x${n}`;
};

/** A new wire from a feeder to anything that carries power; the same map when it can't be (or already is). */
export function addWire(map, data, from, to) {
  const ends = endsOf(map, data);
  if (from === to || !FEEDERS.includes(ends.get(from)) || !ends.get(to)) return map;
  if (powerWires(map.wires).some((w) => w.from === from && w.to === to)) return map;
  return { ...map, wires: [...(map.wires ?? []), { id: nextWireId(map), from, to }] };
}
export const removeWire = (map, id) => ({ ...map, wires: (map.wires ?? []).filter((w) => w.id !== id) });
export const setWireCut = (map, id, cut) => ({ ...map, wires: (map.wires ?? []).map((w) => (w.id !== id ? w : cut ? { ...w, cut: true } : (({ cut: _, ...rest }) => rest)(w))) });

/**
 * Who has power now. @returns { fed: Set of ids reached from a live source, wired: Set of ids with a wire in,
 * via: Map id → the source id that feeds it (the first found) }
 */
export function powerState(map, data) {
  const props = new Map(activeProps(map).map((p) => [p.id, p]));
  const role = (id) => (props.has(id) ? circuitRole(propDef(data, props.get(id).prop)) : map.walls.some((w) => w.id === id && w.kind === 'door' && w.powered) ? 'door' : null);
  const on = (id) => { const p = props.get(id); return p ? p.on !== false && !p.wrecked : true; };
  const wires = powerWires(map.wires).filter((w) => !w.cut);
  const wired = new Set(powerWires(map.wires).map((w) => w.to));
  const fed = new Set();
  const via = new Map();
  const queue = [];
  // points of origin: sources, and breakers nothing is wired into (the mains, off the map) — never a power box (decision 140)
  const sub = (id) => Boolean(propDef(data, props.get(id)?.prop)?.subboard);
  const origin = (id) => role(id) === 'source' || (role(id) === 'breaker' && !wired.has(id) && !sub(id));
  for (const [id] of props) if (origin(id) && on(id)) { fed.add(id); via.set(id, id); queue.push(id); }
  while (queue.length) {
    const id = queue.shift();
    for (const w of wires) {
      if (w.from !== id || fed.has(w.to)) continue;
      const r = role(w.to);
      if (!r) continue;
      fed.add(w.to);
      via.set(w.to, via.get(id));
      if (FEEDERS.includes(r) && on(w.to)) queue.push(w.to); // a tripped breaker is fed but passes nothing on
    }
  }
  return { fed, wired, via };
}

const battery = (p, def) => Boolean(p.battery ?? def?.battery);

/**
 * The map as it works right now: wired loads without power (and no battery) are off, wired electric doors
 * without power lock or unlock by their fail mode. The GM's own switches stay as they are underneath.
 */
export function applyPower(map, data) {
  if (!powerWires(map.wires).length) return map;
  const { fed, wired } = powerState(map, data);
  const props = map.props.map((p) => {
    const def = propDef(data, p.prop);
    if (circuitRole(def) !== 'load' || !wired.has(p.id) || fed.has(p.id) || battery(p, def)) return p;
    return { ...p, on: false, unpowered: true };
  });
  const walls = map.walls.map((w) => {
    if (w.kind !== 'door' || !w.powered || !wired.has(w.id) || fed.has(w.id)) return w;
    return { ...w, locked: (w.fail ?? 'secure') === 'secure', unpowered: true };
  });
  return { ...map, props, walls };
}

/** What a change would do: the loads and doors whose working state differs between two maps, by id. */
export function powerChanges(before, after, data) {
  const a = applyPower(before, data);
  const b = applyPower(after, data);
  const out = [];
  for (const p of b.props) {
    const q = a.props.find((x) => x.id === p.id);
    if (q && circuitRole(propDef(data, p.prop)) === 'load' && (q.on !== false) !== (p.on !== false)) out.push({ id: p.id, kind: 'prop', on: p.on !== false });
  }
  for (const w of b.walls) {
    const q = a.walls.find((x) => x.id === w.id);
    if (q && w.kind === 'door' && w.powered && Boolean(q.locked) !== Boolean(w.locked)) out.push({ id: w.id, kind: 'door', locked: Boolean(w.locked) });
  }
  return out;
}

/** Short tags for the builder and Deploy: S1… sources, F1… breakers, PB1… power boxes, SW1… switches, O1… sockets, D1… electric doors. */
export function circuitTags(map, data) {
  const n = { source: 0, breaker: 0, sub: 0, switch: 0, outlet: 0, door: 0 };
  const pre = { source: 'S', breaker: 'F', sub: 'PB', switch: 'SW', outlet: 'O', door: 'D' };
  const tags = new Map();
  for (const p of map.props ?? []) {
    const def = propDef(data, p.prop);
    const r = circuitRole(def) === 'breaker' && def.subboard ? 'sub' : circuitRole(def);
    if (FEEDERS.includes(r) || r === 'sub') tags.set(p.id, `${pre[r]}${++n[r]}`);
  }
  for (const w of map.walls ?? []) if (w.kind === 'door' && w.powered) tags.set(w.id, `D${++n.door}`);
  return tags;
}

/** What the builder's "!" check flags once the map has any wiring: lights, security devices, power boxes, switches, sockets and electric
 *  doors with no wire in (decision 137: powered desks and machines stay quietly manual). Sources and breakers start a circuit. */
export function unwired(map, data) {
  if (!powerWires(map.wires).length) return [];
  const into = new Set(powerWires(map.wires).map((w) => w.to));
  const out = [];
  for (const p of map.props ?? []) {
    const def = propDef(data, p.prop);
    const r = circuitRole(def);
    const matters = r === 'switch' || r === 'outlet' || (r === 'breaker' && def.subboard) || (r === 'load' && (def.light || def.category === 'light' || def.battery || sensesOf(def).length || def.category === 'sensor' || def.category === 'security'));
    if (matters && !into.has(p.id)) out.push(p.id);
  }
  for (const w of map.walls ?? []) if (w.kind === 'door' && w.powered && !into.has(w.id)) out.push(w.id);
  return out;
}
