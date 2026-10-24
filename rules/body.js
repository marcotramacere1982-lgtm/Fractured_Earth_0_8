// Health and armor. Body locations have no HP or armor of their own (decision 42): see rules/injuries.js.

/** Decision 142: the conditions the worn armor brings with it (an ID Scramble Kit: Masked), in order, once each. */
export const wornGrants = (worn, armorData) => [...new Set((worn ?? []).flatMap((id) => armorData.find((a) => a.id === id)?.grants ?? []))];

/** Max HP = 2 x CON + MST, plus flat modifiers from events. */
export function maxHp(attributes, bodyData, hpMod = 0) {
  const { con, mst, base = 0 } = bodyData.maxHp;
  return Math.max(1, attributes.CON * con + attributes.MST * mst + base + hpMod);
}

/**
 * One armor value. worn = sum of the worn pieces' rating; cracks (from location attacks the armor stopped,
 * or effects that strip armor) lower it until repaired; cover adds on top and never cracks.
 * @returns {{ worn, cracked, current, cover, general }} general = what every hit subtracts
 */
export function armorTotals(armorIds, armorData, { cover = 0, cracked = 0, bonus = 0 } = {}) {
  const worn = armorIds.map((id) => armorData.find((a) => a.id === id)).filter(Boolean).reduce((s, a) => s + a.maxHits, 0);
  const lost = Math.max(0, Math.min(worn, cracked));
  return { worn, cracked: lost, current: worn - lost, cover, bonus, general: worn - lost + cover + bonus }; // bonus: talents, never cracks
}

/** Body locations a location attack's d20 can land on (the attacker picks a side). */
export function hitLocations(roll, bodyData) {
  const row = bodyData.hitLocation.table.find((r) => roll >= r.min && roll <= r.max);
  return row ? row.locations : [];
}
