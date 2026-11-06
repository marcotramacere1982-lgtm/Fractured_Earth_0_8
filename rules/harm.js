// Harm (decision 274): out-of-the-ordinary damage the GM sends — glass, a jolt, burning, debris. One shape for all of
// it, the player's roll travels with it: none, avoid (a success: nothing) or halve (a success: half, rounded down).
// A failure (or no roll) takes it all and the condition, if there is one. Armor counts or doesn't. Pure.

export const SAVES = ['none', 'avoid', 'halve'];

/**
 * What a harm does to one character. harm: { save, armor, condition }; result: the save roll (resolveCheck's) or null.
 * @returns { damage (before armor), condition (id or ''), saved ('avoided' | 'halved' | '') }
 */
export function harmOutcome(harm, damage, result) {
  const dmg = Math.max(0, Math.round(Number(damage) || 0));
  const ok = Boolean(result?.success) && harm.save !== 'none';
  if (ok && harm.save === 'avoid') return { damage: 0, condition: '', saved: 'avoided' };
  if (ok && harm.save === 'halve') return { damage: Math.floor(dmg / 2), condition: '', saved: 'halved' };
  return { damage: dmg, condition: harm.condition || '', saved: '' };
}

/** A check like 'skill:agility_athletics' / 'attr:CON' → { kind, id } (null when none). */
export function parseCheck(check) {
  const m = /^(skill|attr):([A-Za-z_]{1,40})$/.exec(String(check ?? ''));
  return m ? { kind: m[1], id: m[2] } : null;
}
