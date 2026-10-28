// Location attacks and their conditions (decision 42). Body locations say WHERE a declared location
// attack lands; they have no HP or armor of their own. One HP pool, one armor value:
//   damage − armor comes off HP as usual;
//   if damage gets through the armor, the location adds its condition (head: Incapacitated at ≤ half HP);
//   if the armor stops it completely, the armor cracks by 1 (repairable). Cover never cracks.
// Limb conditions (broken arm, crippled leg) are tracked per location id so left and right count separately.

/**
 * What a hit does to a character (decision 154: the one formula for Take a hit and the GM's hit card).
 * sheet: deriveSheet(); loc: a location id ('rarm'…) for a location attack, or '' for a normal hit.
 * @returns {{ taken, through, condition, immune, crack, armor }}
 */
export function hitOutcome(sheet, { damage, loc = '' }, body) {
  const dmg = Math.max(0, Number(damage) || 0);
  const armor = sheet.armor.general;
  const o = loc
    ? locationOutcome({ part: partOf(loc, body), damage: dmg, armor, wornArmor: sheet.armor.current, hp: sheet.hp.current, maxHp: sheet.hp.max, immune: sheet.immune, headNoIncap: Boolean(sheet.talents?.headNoIncap) }, body)
    : { taken: Math.max(0, dmg - armor), through: dmg > armor, condition: null, immune: false, crack: 0 };
  return { ...o, armor };
}

/** Body part ('arm', 'leg', 'head'…) of a location id ('rarm', 'lleg'…). */
export const partOf = (locationId, body) => body.locations.find((l) => l.id === locationId)?.bp ?? locationId;

/**
 * What a declared location attack does.
 * @param {object} hit { part: 'head'|'chest'|'abdomen'|'arm'|'leg', damage, armor (total incl. cover), wornArmor (crackable), hp, maxHp, tag, immune[] }
 * @returns {{ taken: number, through: boolean, condition: string|null, immune: boolean, crack: number }}
 */
export function locationOutcome({ part, damage, armor, wornArmor = armor, hp, maxHp, tag = 'organic', immune = [], headNoIncap = false }, body) {
  const taken = Math.max(0, damage - armor);
  const through = taken > 0;
  if (!through) return { taken: 0, through, condition: null, immune: false, crack: wornArmor > 0 ? body.locationAttack.armorCrack : 0 };
  const rule = body.injuries;
  let condition = tag === 'synthetic' ? rule.synthetic[part] : rule[part]?.condition;
  const stillUp = hp - taken > 0;
  if (part === 'head' && tag !== 'synthetic' && hp - taken <= maxHp * rule.head.severeAtHpFraction && !(headNoIncap && stillUp)) condition = rule.head.severe; // Iron Jaw
  const isImmune = Boolean(condition && immune.includes(condition));
  return { taken, through, condition: isImmune ? null : condition ?? null, immune: isImmune, crack: 0 };
}

/** How many arms / legs are injured, from a list of location ids. */
export function limbs(injuries = [], body) {
  const count = (bp) => injuries.filter((id) => partOf(id, body) === bp).length;
  return { arms: count('arm'), legs: count('leg') };
}

/** Squares per move with crippled legs: one leg halves (min 1), both legs leave 1. */
export function movement(squares, legs) {
  if (legs >= 2) return Math.min(squares, 1);
  if (legs === 1) return Math.max(1, Math.floor(squares / 2));
  return squares;
}

/**
 * Which readied weapons can be used with broken arms: one arm → only the first one-handed weapon; both → none.
 * @returns the same weapons with `usable` (and `why`: 'oneArm' | 'noArms') added.
 */
export function usableWeapons(weapons, arms) {
  let oneHandedLeft = 1;
  return weapons.map((w) => {
    if (w.empty) return w;
    if (arms >= 2) return { ...w, usable: false, why: 'noArms' };
    if (arms === 1) {
      const ok = (w.hands ?? 1) === 1 && oneHandedLeft-- > 0;
      return { ...w, usable: ok, why: ok ? null : 'oneArm' };
    }
    return { ...w, usable: true, why: null };
  });
}
