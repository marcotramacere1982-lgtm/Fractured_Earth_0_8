// What conditions do to the numbers on the sheet (decision 54). Each condition may carry `mods` in data:
//   act (actions per round), attackTn (weapon attacks), skillTn (skill checks), off, def, armor,
//   meleeDamage (added to melee hits), moveHalf (squares per move halved, minimum 1).
// Stunned and Slowed work per round through rules/turn.js → allowance. Everything else stays table text.

const NUMERIC = ['act', 'attackTn', 'skillTn', 'off', 'def', 'armor', 'meleeDamage'];

/** The summed effect of the active conditions. Unknown ids are ignored. */
export function conditionMods(ids, conditionsData, extra = {}) {
  const out = Object.fromEntries(NUMERIC.map((k) => [k, extra[k] ?? 0])); // extra: item effects' mods (decision 58)
  out.moveHalf = false;
  for (const id of ids ?? []) {
    const m = conditionsData.find((c) => c.id === id)?.mods;
    if (!m) continue;
    for (const k of NUMERIC) out[k] += m[k] ?? 0;
    if (m.moveHalf) out.moveHalf = true;
  }
  return out;
}

/** Squares per move after Prone (halved, rounded down, minimum 1). */
export const halvedMove = (squares, half) => (half ? Math.max(1, Math.floor(squares / 2)) : squares);

/**
 * Decision 158: what the target's conditions give whoever attacks it (data: `against: { melee, ranged }`) —
 * melee at someone Prone +4, ranged at someone Blinded +4, anything at a Marked enemy +2.
 * @returns { tn, parts: [{ id, name, tn }] }
 */
export function againstMods(targetConditions, conditionsData, { melee = false } = {}) {
  const parts = (targetConditions ?? []).map((id) => {
    const c = conditionsData.find((x) => x.id === id);
    const n = c?.against?.[melee ? 'melee' : 'ranged'] ?? 0;
    return n ? { id, name: c.name, tn: n } : null;
  }).filter(Boolean);
  return { tn: parts.reduce((a, b) => a + b.tn, 0), parts };
}
