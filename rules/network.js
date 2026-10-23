// Data network (decision 129). The GM's picture of what security sees. Uplinks (fibre, the core cabinet) start a
// network — there may be more than one; routers pass it along cables; Wi-Fi access points and repeaters pass it
// over the air. Devices are Wi-Fi only (cheap sensors, old cameras) or cable-or-Wi-Fi (ring cameras, keypads,
// panels). Links are wires with `net: 'data'` (`wifi: true` for a wireless one); a Wi-Fi device with no link joins
// the nearest access point or repeater in range by itself, so one network needs no tapping.
// Two things travel downstream: connection (a node taken offline, or without power, cuts everything behind it)
// and truth (a tampered node makes everything behind it report false data). Per device: reporting, offline,
// fooled, no power, or not networked. Players never see any of it. Pure.

import { propDef, activeProps } from './props.js';
import { applyPower, normalizeWires } from './power.js';

export const NET_NODES = ['uplink', 'router', 'ap', 'repeater'];
const WIRELESS = ['ap', 'repeater'];

/** A library piece's place on the network: a node role, 'wifi' / 'both' for a device, or null. */
export const netRole = (def) => def?.net ?? null;
const isDevice = (r) => r === 'wifi' || r === 'both';

/** Can this link exist? from: a node; a cable reaches routers, access points, repeaters and cable devices;
 *  Wi-Fi goes from an access point or repeater to a repeater or any device. */
export function linkAllowed(fromRole, toRole, wifi) {
  if (!NET_NODES.includes(fromRole) || !toRole || toRole === 'uplink') return false;
  if (wifi) return WIRELESS.includes(fromRole) && (toRole === 'repeater' || isDevice(toRole));
  return toRole === 'router' || toRole === 'ap' || toRole === 'repeater' || toRole === 'both';
}

const nextId = (map) => {
  const used = new Set((map.wires ?? []).map((w) => w.id));
  for (let n = (map.wires ?? []).length + 1; ; n++) if (!used.has(`x${n}`)) return `x${n}`;
};
/** A new data link; the same map when it isn't allowed or already there. */
export function addDataLink(map, data, from, to, wifi = false) {
  const role = (id) => netRole(propDef(data, (map.props ?? []).find((p) => p.id === id)?.prop));
  if (from === to || !linkAllowed(role(from), role(to), wifi)) return map;
  if ((map.wires ?? []).some((w) => w.net === 'data' && w.from === from && w.to === to)) return map;
  return { ...map, wires: [...(map.wires ?? []), { id: nextId(map), from, to, net: 'data', ...(wifi ? { wifi: true } : {}) }] };
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const rangeOf = (def) => def?.wifi?.radius ?? 0;

/** The automatic Wi-Fi joins: [{ from, to }] for Wi-Fi-capable pieces with no data link in, to the nearest access
 *  point or repeater in range (repeaters join access points the same way). */
export function autoJoins(map, data) {
  const props = activeProps(map);
  const linked = new Set((map.wires ?? []).filter((w) => w.net === 'data').map((w) => w.to));
  const role = (p) => netRole(propDef(data, p.prop));
  const out = [];
  for (const p of props) {
    const r = role(p);
    if (linked.has(p.id) || !(r === 'wifi' || r === 'both' || r === 'repeater')) continue;
    let best = null;
    for (const q of props) {
      const rq = role(q);
      if (q.id === p.id || !(rq === 'ap' || (rq === 'repeater' && r !== 'repeater'))) continue;
      const d = dist(p, q);
      if (d <= rangeOf(propDef(data, q.prop)) + 0.5 && (!best || d < best.d)) best = { q, d };
    }
    if (best) out.push({ from: best.q.id, to: p.id, auto: true });
  }
  return out;
}

/**
 * Every network node and device, as things stand: { id → { status, at?, since? } }.
 * status: 'ok' (reporting true data) · 'fooled' (reporting, but tampered at `at`) · 'offline' (cut at `at`) ·
 * 'nopower' · 'alone' (not on any network). `at`: the id of the node that cut or fooled it; `parent`: the node it hangs from.
 */
export function networkState(map, data) {
  const m = applyPower(map, data); // no power, no network (batteries excepted)
  const props = new Map(activeProps(m).map((p) => [p.id, p]));
  const role = (id) => netRole(propDef(data, props.get(id)?.prop));
  const up = (id) => { const p = props.get(id); return p && p.on !== false && !p.wrecked && !p.netOff; };
  const links = [...(m.wires ?? []).filter((w) => w.net === 'data' && !w.cut), ...autoJoins(m, data)];
  // a path from an uplink to everything, ignoring what is down, remembering the parent: to say where a cut is
  const parent = new Map();
  const queue = [...props.keys()].filter((id) => role(id) === 'uplink');
  for (const id of queue) parent.set(id, null);
  while (queue.length) {
    const id = queue.shift();
    for (const w of links) if (w.from === id && props.has(w.to) && !parent.has(w.to)) { parent.set(w.to, id); if (NET_NODES.includes(role(w.to))) queue.push(w.to); }
  }
  const out = new Map();
  for (const [id, p] of props) {
    const r = role(id);
    if (!r) continue;
    if (p.on === false || p.wrecked) { out.set(id, { status: 'nopower' }); continue; }
    if (!parent.has(id)) { out.set(id, { status: r === 'uplink' ? 'ok' : 'alone' }); continue; }
    let cut = null;
    let fooled = null;
    for (let x = id; x != null; x = parent.get(x)) { // from the device back to its uplink
      if (!up(x) && !cut) cut = x;
      if (props.get(x)?.tampered && !fooled) fooled = x;
    }
    const since = (x) => { const q = props.get(x); return q ? { t: q[cut === x ? 'netOffAt' : 'tamperedAt'] ?? null, round: q[cut === x ? 'netOffRound' : 'tamperedRound'] ?? null } : null; };
    const up1 = parent.get(id) ?? null; // the node it hangs from (decision 138: the board groups by it)
    if (cut) out.set(id, { status: 'offline', at: cut, since: since(cut), parent: up1 });
    else if (fooled) out.set(id, { status: 'fooled', at: fooled, since: since(fooled), parent: up1 });
    else out.set(id, { status: 'ok', parent: up1 });
  }
  return out;
}

/** What taking a node offline / tampering would change: [{ id, from, to }] statuses that differ. */
export function networkChanges(before, after, data) {
  const a = networkState(before, data);
  const b = networkState(after, data);
  return [...b].filter(([id, s]) => a.get(id)?.status !== s.status).map(([id, s]) => ({ id, from: a.get(id)?.status, to: s.status }));
}

/** Tags: N1 uplinks, R1 routers, W1 access points, RP1 repeaters. */
export function networkTags(map, data) {
  const pre = { uplink: 'N', router: 'R', ap: 'W', repeater: 'RP' };
  const n = { uplink: 0, router: 0, ap: 0, repeater: 0 };
  const tags = new Map();
  for (const p of map.props ?? []) { const r = netRole(propDef(data, p.prop)); if (NET_NODES.includes(r)) tags.set(p.id, `${pre[r]}${++n[r]}`); }
  return tags;
}

/** Sets a node or device offline / online or tampered / clean, with when it happened (time and combat round). */
export function setNet(map, id, { offline, tampered }, now, round = null) {
  return {
    ...map,
    props: map.props.map((p) => {
      if (p.id !== id) return p;
      const q = { ...p };
      if (offline != null) { if (offline) Object.assign(q, { netOff: true, netOffAt: now, ...(round != null ? { netOffRound: round } : {}) }); else { delete q.netOff; delete q.netOffAt; delete q.netOffRound; } }
      if (tampered != null) { if (tampered) Object.assign(q, { tampered: true, tamperedAt: now, ...(round != null ? { tamperedRound: round } : {}) }); else { delete q.tampered; delete q.tamperedAt; delete q.tamperedRound; } }
      return q;
    }),
  };
}

/** Keeps a data link only where linkAllowed says it can be; drops repeats. */
export function normalizeDataLinks(raw, map, data) {
  const role = (id) => netRole(propDef(data, (map.props ?? []).find((p) => p.id === id)?.prop));
  const seen = new Set();
  return (Array.isArray(raw) ? raw : []).filter((w) => w?.net === 'data').slice(0, 3000).filter((w) => {
    const k = `${w.from}>${w.to}`;
    if (w.from === w.to || seen.has(k) || !linkAllowed(role(w.from), role(w.to), w.wifi === true)) return false;
    seen.add(k);
    return true;
  }).map((w) => ({ id: w.id, from: w.from, to: w.to, net: 'data', ...(w.wifi === true ? { wifi: true } : {}), ...(w.cut === true ? { cut: true } : {}) }));
}

/** Power wires and data links together, each kept only while both ends are there; every id once. */
export function normalizeAllWires(raw, map, data) {
  const all = [...normalizeWires(raw, map, data), ...normalizeDataLinks(raw, map, data)];
  const used = new Set();
  let n = 0;
  for (const w of all) {
    if (!/^x\d{1,6}$/.test(w.id ?? '') || used.has(w.id)) do w.id = `x${++n}`; while (all.some((x) => x !== w && x.id === w.id) || used.has(w.id));
    used.add(w.id);
  }
  return all;
}
/** Wires and links that lost an end (a piece removed, a door no longer electric) go too. */
export const pruneWires = (map, data) => ({ ...map, wires: normalizeAllWires(map.wires, map, data) });
