// Dice expressions like "2d20", "1d6+3", "d4-1". Every roll returns its breakdown.

/** Deterministic RNG (mulberry32) for tests and replays. Returns floats in [0, 1). */
export function createRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function parseDice(expr) {
  const m = String(expr).replace(/\s+/g, '').match(/^(\d*)d(\d+)([+-]\d+)?$/i);
  if (!m) throw new Error(`Invalid dice expression: ${expr}`);
  return { count: Number(m[1] || 1), sides: Number(m[2]), mod: Number(m[3] || 0) };
}

export function rollDie(sides, rng = Math.random) {
  return Math.floor(rng() * sides) + 1;
}

/** @returns {{expr: string, rolls: number[], mod: number, total: number}} */
export function roll(expr, rng = Math.random) {
  const { count, sides, mod } = parseDice(expr);
  const rolls = Array.from({ length: count }, () => rollDie(sides, rng));
  return { expr, rolls, mod, total: rolls.reduce((s, r) => s + r, 0) + mod };
}

/** Lowest and highest total of an expression ("2d4+1" → 3–9). */
export function diceRange(expr) {
  const { count, sides, mod } = parseDice(expr);
  return { min: count + mod, max: count * sides + mod };
}

/**
 * A roll made with physical dice: the player types the total. Throws RangeError when it can't be rolled
 * with these dice. Shown as "1d6: 4 (typed)".
 */
export function typedRoll(expr, total) {
  const n = Number(total);
  const { min, max } = diceRange(expr);
  if (!Number.isInteger(n) || n < min || n > max) throw new RangeError(`${expr}: ${min}–${max}`);
  return { expr, rolls: [], mod: 0, total: n, typed: true };
}

export function formatRoll({ expr, rolls, mod, total, typed = false }) {
  if (typed) return `${expr}: ${total} (typed)`;
  const modText = mod ? ` ${mod > 0 ? '+' : '−'} ${Math.abs(mod)}` : '';
  return `${expr}: [${rolls.join(', ')}]${modText} = ${total}`;
}
