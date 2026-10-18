// Health, body locations, armor.

/** Max HP = 2 x CON + MST, plus flat modifiers from events. */
export function maxHp(attributes, bodyData, hpMod = 0) {
  const { con, mst } = bodyData.maxHp;
  return Math.max(1, attributes.CON * con + attributes.MST * mst + hpMod);
}

/** Max HP per location, from the CON + MST bracket plus a per-location modifier. */
export function locationMaxHp(attributes, bodyData, perLocationMod = 0) {
  const sum = attributes.CON + attributes.MST;
  const { table } = bodyData.bodyPoints;
  const bracket = table.find((r) => sum >= r.min && sum <= r.max) ?? (sum < table[0].min ? table[0] : table.at(-1));
  return Object.fromEntries(bodyData.locations.map((loc) => [loc.id, bracket[loc.bp] + perLocationMod]));
}

/**
 * Armor from owned/worn pieces. General armor = sum of Max Hits; location armor = sum of per-location AV.
 * Cover adds flat armor to general and every location.
 */
export function armorTotals(armorIds, armorData, bodyData, cover = 0) {
  const pieces = armorIds.map((id) => armorData.find((a) => a.id === id)).filter(Boolean);
  const general = pieces.reduce((s, a) => s + a.maxHits, 0) + cover;
  const locations = Object.fromEntries(
    bodyData.locations.map((loc) => [loc.id, pieces.reduce((s, a) => s + (a.av[loc.id] ?? 0), 0) + cover]),
  );
  return { general, locations };
}

/** Body locations a d20 hit-location roll can land on (the player/GM picks a side). */
export function hitLocations(roll, bodyData) {
  const row = bodyData.hitLocation.table.find((r) => roll >= r.min && roll <= r.max);
  return row ? row.locations : [];
}
