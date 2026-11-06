// Site alert (decision 268): one meter per live map — how much the site's security (its networks, its AI, the people
// reading the streams) is paying attention. It is the old per-network Trace merged into one number: hackers' pings
// and drones still add to it by themselves, the GM moves it however the story says, it never drops by itself.
// Levels Calm · Twitchy · Alert · Lockdown (rules/ping.js → TRACE_LEVELS). On Alert and Lockdown the quiet,
// technical work gets harder on that map: a TN change (data.map.site) on the listed skills and classes' Class TN.
// Pure.

import { TRACE_LEVELS, traceLevel } from './ping.js';
import { propDef } from './props.js';
import { uplinkOf, networkState } from './network.js';

/** The site's Trace on a live map. Old saves kept one per network ({ [uplink]: n }): the highest becomes the site's. */
export function siteTrace(live) {
  if (typeof live?.siteTrace === 'number') return Math.max(0, live.siteTrace);
  const old = Object.values(live?.trace ?? {}).map(Number).filter(Number.isFinite);
  return old.length ? Math.max(0, ...old) : 0;
}
/** The level for a Trace value: 'calm' | 'twitchy' | 'alert' | 'lockdown'. */
export const siteLevel = (n) => traceLevel(n);
/** The lowest Trace of a level (tapping a level sets the meter there). */
export const levelFloor = (id) => TRACE_LEVELS.find((l) => l.id === id)?.from ?? 0;

/** What players learn: only a level that changes their rolls ('alert' / 'lockdown'), else null. d: data.map.site */
export const sitePublic = (level, d) => (d?.tn?.[level] ? level : null);

/**
 * The TN change the site's level puts on one roll. check: { kind: 'skill', id } or { kind: 'class', id: classId }.
 * 0 when the level is calm / twitchy, or the roll isn't one the site cares about.
 */
export function siteTn(level, check, d) {
  const tn = d?.tn?.[level] ?? 0;
  if (!tn || !check) return 0;
  if (check.kind === 'skill') return d.skills.includes(check.id) ? tn : 0;
  if (check.kind === 'class') return d.classes.includes(check.id) ? tn : 0;
  return 0;
}

/** Lock-down: the electric doors on a network that are not locked yet (ids). */
export function doorsToLock(map, data) {
  const state = networkState(map, data);
  return (map.walls ?? []).filter((w) => w.kind === 'door' && w.powered && !w.locked && uplinkOf(map, data, w.id, state)).map((w) => w.id);
}
/** Arm the site: sensors and laser lines that are switched off (ids). */
export function sensorsToArm(map, data) {
  return {
    props: (map.props ?? []).filter((p) => propDef(data, p.prop)?.sensor && p.on === false).map((p) => p.id),
    lasers: (map.walls ?? []).filter((w) => w.kind === 'laser' && w.on === false).map((w) => w.id),
  };
}
