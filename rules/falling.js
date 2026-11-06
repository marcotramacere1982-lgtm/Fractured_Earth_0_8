// Falling (decision 272). Up to `free` metres a fall costs nothing but a landing roll; beyond that, a die per full
// `per` metres (3 m: a floor), at most `max` dice. The landing roll (Agility & Athletics) halves the damage, rounded
// down; a failure leaves you Prone; a natural 20 also cripples a leg. Armor then applies like on any hit (cover never).
// Numbers in data.body.falling. Pure.

/** The dice for a fall of `metres`: '' for a short drop, else 'Nd6'. */
export function fallDice(metres, d) {
  const m = Math.max(0, Number(metres) || 0);
  if (m <= d.free) return '';
  return `${Math.min(d.max, Math.floor(m / d.per))}d${d.die}`;
}

/**
 * What the landing does. result: the landing roll (resolveCheck's) or null (they just take it).
 * @returns { damage (before armor), halved, prone, crippled }
 */
export function landing(result, damage, d) {
  const dmg = Math.max(0, Math.round(Number(damage) || 0));
  const landed = Boolean(result?.success);
  return {
    damage: landed ? Math.floor(dmg / 2) : dmg,
    halved: landed,
    prone: !landed,
    crippled: result?.natural === 'crit-failure',
  };
}
