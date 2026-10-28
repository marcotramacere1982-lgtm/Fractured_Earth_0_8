// The Tech Wizard's drone (decision 172): an item, bought and modded like a hacker's deck. It never takes a turn —
// the Tech Wizard spends actions on abilities that use it. Its profile feeds those abilities' numbers (the Engineer's
// barrier and sentry turret) and gives reach to the adjacent-only ones (a Mechanic heals or mends through it).
// Wrecked, it never shuts down: half reach, half damage, until repaired. Every Tech Wizard starts with a free Scrap
// Drone, their personal project. Numbers are provisional (owner to tune). Pure.

import { RuleError } from './messages.js';
import { addFlat } from './dice.js';

export const STARTER_DRONE = 'scrap_drone';

/**
 * What the drone gives right now. drone: a drones.json entry; installed: mod ids (only the first modSlots count).
 * @returns { id, name, slots, used, reach, hp, armor, damage, shield, wrecked } | null
 */
export function droneProfile(drone, installed, modsData, { wrecked = false } = {}) {
  if (!drone) return null;
  const mods = (installed ?? []).map((id) => modsData.mods.find((m) => m.id === id)).filter(Boolean).slice(0, drone.modSlots);
  const add = (type) => mods.filter((m) => m.type === type).reduce((n, m) => n + m.amount, 0);
  const reach = drone.reach + add('reach');
  const shield = add('shield');
  return {
    id: drone.id, name: drone.name, slots: drone.modSlots, used: mods.length,
    reach: wrecked ? Math.max(1, Math.floor(reach / 2)) : reach,
    hp: drone.hp + add('frame'),
    armor: drone.armor + add('plating'),
    damage: addFlat(drone.damage, add('payload')),
    shield: wrecked ? Math.floor(shield / 2) : shield,
    wrecked: Boolean(wrecked),
  };
}

/** An ability's text with the drone's numbers in: {hp} {armor} {damage} {reach}. Wrecked: damage halved. */
export function droneText(text, profile) {
  if (typeof text !== 'string' || !profile) return text;
  return text.replace(/\{(hp|armor|damage|reach)\}/g, (_, k) => (k === 'damage' && profile.wrecked ? `${profile.damage} ÷ 2` : String(profile[k])));
}

/** The ability as this drone makes it: placeholders filled in its texts and in its play notes for the GM. */
export function droneAbility(ability, profile) {
  if (!profile || !ability?.drone) return ability;
  const fill = (s) => droneText(s, profile);
  const play = ability.play && Object.fromEntries(Object.entries(ability.play).map(([k, v]) => [k, v && typeof v === 'object' && !Array.isArray(v) ? { ...v, gm: fill(v.gm) } : v]));
  return { ...ability, desc: fill(ability.desc), mend: fill(ability.mend), surge: fill(ability.surge), ...(play ? { play } : {}) };
}

/** May this mod go in now? Throws a RuleError when the drone's slots are full. */
export function checkDroneMod(drone, installed, id) {
  if (!drone) throw new RuleError('droneNone', {}, 'Pick your drone first.');
  if (!installed.includes(id) && installed.length >= drone.modSlots) throw new RuleError('droneSlots', { n: drone.modSlots }, `No free mod slot (${drone.modSlots}).`);
}
