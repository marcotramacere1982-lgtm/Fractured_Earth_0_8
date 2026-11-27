// Decision 372: gunshots are loud. A shot is heard, by enemies not in the fight, up to a distance set by the kind of
// weapon (awareness.json → noise: straight distance in squares, through walls); a suppressed weapon is quiet, melee
// makes no noise. Who hears it passes it on by their link: a squad (or a network) tells its group at once, and a
// network enemy also raises the site's alert. Pure.

import { isMelee } from './weapon-mods.js';

const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

/** How far this weapon's shot is heard, in squares (0 = silent). w: the weapon record (modded or not). */
export function shotNoise(w, data) {
  const n = data.awareness.noise;
  if (!w || w.natural || isMelee(w)) return n.melee;
  if (w.quiet) return n.suppressed;
  return n.byType[w.type] ?? n.other;
}

/**
 * Who hears a shot fired at `from` that carries `radius` squares.
 * enemies: [{ key, x, y, aw: { link } }] — the enemies not in the fight, with their squares;
 * matesOf(keys): the keys of those keys' groups (not including them).
 * @returns { heard: [keys in earshot], told: [group mates told through a squad / network link], network: someone on the network heard }
 */
export function hearShot(from, radius, enemies, matesOf = () => []) {
  if (!from || !(radius > 0)) return { heard: [], told: [], network: false };
  const heard = enemies.filter((e) => cheb(from, e) <= radius);
  const linked = heard.filter((e) => e.aw?.link === 'squad' || e.aw?.link === 'network');
  const inHeard = new Set(heard.map((e) => e.key));
  const told = linked.length ? [...new Set(matesOf(linked.map((e) => e.key)))].filter((k) => !inHeard.has(k)) : [];
  return { heard: heard.map((e) => e.key), told, network: heard.some((e) => e.aw?.link === 'network') };
}
