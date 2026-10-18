// Classes, subclasses, class TN, ability availability.

export function findSubclass(classesData, subclassId) {
  for (const cls of classesData.classes) {
    const sub = cls.subclasses.find((s) => s.id === subclassId);
    if (sub) return { cls, sub };
  }
  return null;
}

/** Class TN = round((stat 1 + stat 2) / 2) of the subclass main stats. */
export function classTN(attributes, subclass) {
  const [a, b] = subclass.stats;
  return Math.round((attributes[a] + attributes[b]) / 2);
}

/** Abilities usable by a subclass (abilities with no subclass list are shown but flagged). */
export function abilitiesFor(abilitiesData, classId, subclassId) {
  return (abilitiesData[classId] ?? []).map((a) => ({ ...a, available: a.subclasses.includes(subclassId) }));
}

/**
 * Deck capacity after hardware mods. Each mod takes one of the deck's mod slots;
 * mods beyond the slot count are ignored and reported.
 */
export function deckCapacity(deck, modIds, modsData, extraRam = 0) {
  const mods = modIds.map((id) => modsData.mods.find((m) => m.id === id)).filter(Boolean);
  const installed = mods.slice(0, deck.modSlots);
  const add = (type) => installed.filter((m) => m.type === type).reduce((s, m) => s + m.amount, 0);
  return {
    ram: deck.ram + add('ram') + extraRam, // extraRam: Overclocker
    heatCap: deck.heatCap + add('cooling'),
    slots: { used: installed.length, max: deck.modSlots },
    installed: installed.map((m) => m.id),
    overflow: mods.slice(deck.modSlots).map((m) => m.id),
  };
}

/**
 * Hacker deck status from its (modded) capacity.
 * Full RAM blocks new payloads until one is released; heat at the cap = Blue Screen (round end: engines.roundEnd).
 */
export function deckStatus(capacity, { ram = 0, heat = 0, bluescreen = false } = {}) {
  if (!capacity) return null;
  return {
    ram: { used: ram, max: capacity.ram, free: Math.max(0, capacity.ram - ram), full: ram >= capacity.ram },
    heat: { value: heat, max: capacity.heatCap, bluescreen: bluescreen || heat >= capacity.heatCap },
  };
}

/** Whether a hacker ability can run right now on this deck. */
export function canRunHack(ability, status) {
  if (!status) return { ok: false, code: 'noDeck', reason: 'No deck equipped' };
  if (status.heat.bluescreen) return { ok: false, code: 'bluescreen', reason: 'Deck in Blue Screen' };
  if (ability.ram > status.ram.free) return { ok: false, code: 'noRam', reason: 'Not enough free RAM' };
  return { ok: true, reason: null };
}

export function zoneFor(value, zones) {
  return zones.find((z) => value >= z.min && value <= z.max) ?? null;
}
