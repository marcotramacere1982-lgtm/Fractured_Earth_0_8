// Attributes, skills, derived combat values, initiative.

export const BASE_ATTRIBUTES = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA', 'MST'];
export const ATTRIBUTES = [...BASE_ATTRIBUTES, 'CRS'];

export const bonus = (value) => Math.floor(value / 2);

/** Skill target number: bonus(A) + bonus(B). Roll d20 <= TN to succeed. */
export function skillValue(skill, attributes) {
  const [a, b] = skill.stats;
  return bonus(attributes[a]) + bonus(attributes[b]);
}

export function computeSkills(attributes, skillsData) {
  return skillsData.skills.map((skill) => ({
    id: skill.id,
    name: skill.name,
    category: skill.category,
    stats: skill.stats,
    value: skillValue(skill, attributes),
  }));
}

/** Index of the combat-table row containing `sum` (clamped to the table ends). */
export function tableRowIndex(sum, table) {
  const idx = table.findIndex((r) => sum >= r.min && sum <= r.max);
  if (idx !== -1) return idx;
  return sum < table[0].min ? 0 : table.length - 1;
}

/**
 * Derived combat values. Row = RAW SUM of the two attributes, shifted by row offsets.
 * @returns {Record<string, {value: number, sum: number, row: number, offset: number}>}
 */
export function computeCombat(attributes, rowOffsets, combatData) {
  const { table, derived } = combatData;
  const out = {};
  for (const d of derived) {
    const sum = attributes[d.stats[0]] + attributes[d.stats[1]];
    const offset = rowOffsets?.[d.id] ?? 0;
    const row = Math.max(0, Math.min(table.length - 1, tableRowIndex(sum, table) + offset));
    out[d.id] = { value: table[row][d.id], sum, row, offset };
  }
  return out;
}

export function initiative(attributes, combatData) {
  const { stats, offset } = combatData.initiative;
  return stats.reduce((s, k) => s + bonus(attributes[k]), 0) + offset;
}

/** Weapon attack TN = the value of the skill matching the weapon (e.g. pistols use Handguns). */
export function weaponTN(weapon, skills) {
  return skills.find((s) => s.id === weapon.skill)?.value ?? null;
}

export const formatSigned = (n) => (n >= 0 ? `+${n}` : `−${Math.abs(n)}`);
