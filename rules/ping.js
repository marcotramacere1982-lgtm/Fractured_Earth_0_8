// Ping (decision 170): a hacker asks the networks around them who's there. The answer is a list — networks and what
// hangs on them, by type — never where anything is: a node is a node, unless the GM gave it a name that says where.
// Every ping is heard: each network it touches gains Trace (more if it failed, more on a better-guarded network), and
// the network knows which node heard it. Trace and security are the GM's; players only ever get the list. Pure.

import { propDef } from './props.js';
import { netRole, networkState, networkTags, NET_NODES } from './network.js';
import { applyPower } from './power.js';

export const PING_RANGE = 10; // squares, through walls
export const SECURITY = { civil: 0, corp: 1, military: 2 }; // set on the uplink; Corporate when unset
export const TRACE_LEVELS = [{ id: 'calm', from: 0 }, { id: 'twitchy', from: 3 }, { id: 'alert', from: 5 }, { id: 'lockdown', from: 7 }];
const MOOD_MARGIN = 5; // a success by this much also tells the hacker how each network feels

export const securityOf = (uplink) => (uplink?.security in SECURITY ? uplink.security : 'corp');
export const traceLevel = (n) => [...TRACE_LEVELS].reverse().find((l) => (n ?? 0) >= l.from).id;
/** What one ping adds to the site's Trace (decision 268): 1 on a success, whatever the security; a failure 2 plus the
 *  network's security (Civil 0 · Corp 1 · Military 2) — a careful hacker can work a site, a sloppy one tips it. */
export const traceGain = (security, success) => (success ? 1 : 2 + (SECURITY[security] ?? SECURITY.corp));

/** The map's networks, one per uplink, lettered A, B… in map order: [{ id, letter, name, security }]. */
export function networksOf(map, data) {
  return (map.props ?? []).filter((p) => netRole(propDef(data, p.prop)) === 'uplink')
    .map((p, i) => ({ id: p.id, letter: String.fromCharCode(65 + (i % 26)), name: p.netName ?? null, security: securityOf(p) }));
}

const centre = (at) => ({ x: at.x + 0.5, y: at.y + 0.5 });
const near = (p, c, range) => Math.hypot(p.x - c.x, p.y - c.y) <= range;

/**
 * What answers a ping from square `at`: every node and device within range that is on a network and reporting
 * (offline, unpowered and lone pieces stay silent), grouped by network.
 * Decision 256: networked electric doors answer too — `doors: [{ id, name, locked }]` (name: the GM's, locked: closed and locked now).
 * @returns [{ id, letter, name, security, nodes: [{ id, role, name }], devices: [{ id, name }], doors }] — GM-side, with ids.
 */
export function pingScan(map, data, at, range = PING_RANGE) {
  const state = networkState(map, data);
  const props = new Map((map.props ?? []).map((p) => [p.id, p]));
  const rootOf = (id) => { let x = id; for (let n = 0; state.get(x)?.parent && n < 500; n += 1) x = state.get(x).parent; return x; };
  const nets = networksOf(map, data);
  const c = centre(at);
  const found = new Map();
  const walls = new Map((applyPower(map, data).walls ?? []).map((w) => [w.id, w])); // as powered now: a fail-secure door without power is locked
  for (const [id, s] of state) {
    if (s.status !== 'ok' && s.status !== 'fooled') continue;
    if (s.door) { // decision 256
      const w = walls.get(id);
      if (!w || !near({ x: (w.a.x + w.b.x) / 2, y: (w.a.y + w.b.y) / 2 }, c, range)) continue;
      const net = rootOf(id);
      if (!nets.some((n) => n.id === net)) continue;
      const bucket = found.get(net) ?? { nodes: [], devices: [] };
      bucket.doors = [...(bucket.doors ?? []), { id, name: w.netName ?? null, locked: Boolean(w.locked) && !w.open }];
      found.set(net, bucket);
      continue;
    }
    const p = props.get(id);
    if (!p || !near(p, c, range)) continue;
    const def = propDef(data, p.prop);
    const role = netRole(def);
    const net = role === 'uplink' ? id : rootOf(id);
    if (!nets.some((n) => n.id === net)) continue;
    const bucket = found.get(net) ?? { nodes: [], devices: [] };
    if (NET_NODES.includes(role)) bucket.nodes.push({ id, role, name: p.netName ?? null });
    else bucket.devices.push({ id, name: def.name });
    found.set(net, bucket);
  }
  return nets.filter((n) => found.has(n.id)).map((n) => ({ doors: [], ...n, ...found.get(n.id) }));
}

/** Which node heard the ping on each network: the nearest node of that network to the hacker (its name, else its tag). */
export function heardBy(map, data, at, scan) {
  const tags = networkTags(map, data);
  const props = new Map((map.props ?? []).map((p) => [p.id, p]));
  const c = centre(at);
  return Object.fromEntries(scan.map((n) => {
    const best = [...n.nodes].sort((a, b) => Math.hypot(props.get(a.id).x - c.x, props.get(a.id).y - c.y) - Math.hypot(props.get(b.id).x - c.x, props.get(b.id).y - c.y))[0];
    return [n.id, best ? best.name ?? tags.get(best.id) ?? best.role : null];
  }));
}

/** Decision 268: what a ping adds to the site's one Trace — nothing when no network heard it; else traceGain on the
 *  best-guarded network it touched (the site is one meter, a ping counts once). */
export const pingGain = (scan, success) => (scan.length ? Math.max(...scan.map((n) => traceGain(n.security, success))) : 0);

/**
 * What the hacker's sheet gets: on a success, each network by letter (and name), its nodes by role (named ones by
 * name) and its devices counted by type; nothing about positions, security or Trace. A success by MOOD_MARGIN or more
 * adds the site's mood (its Trace level after this ping, decision 268: one for the whole site). A failure gets nothing. Decision 256: doors counted, how
 * many locked, and the ones the GM named by name (never where).
 */
export function pingReport(scan, { success, margin = 0, trace = 0 }) {
  if (!success) return { ok: false, networks: [] };
  const count = (list) => Object.entries(list.reduce((m, x) => ({ ...m, [x]: (m[x] ?? 0) + 1 }), {})).map(([name, n]) => ({ name, n }));
  return {
    ok: true,
    networks: scan.map((n) => ({
      key: n.letter,
      name: n.name,
      nodes: count(n.nodes.map((x) => x.role)),
      named: n.nodes.filter((x) => x.name).map((x) => x.name),
      devices: count(n.devices.map((x) => x.name)),
      ...((n.doors ?? []).length ? { doors: { n: n.doors.length, locked: n.doors.filter((d) => d.locked).length, named: n.doors.filter((d) => d.name).map((d) => ({ name: d.name, locked: d.locked })) } } : {}),
      ...(margin >= MOOD_MARGIN ? { mood: traceLevel(trace) } : {}),
    })),
  };
}
