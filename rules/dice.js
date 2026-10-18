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

export function formatRoll({ expr, rolls, mod, total }) {
  const modText = mod ? ` ${mod > 0 ? '+' : '−'} ${Math.abs(mod)}` : '';
  return `${expr}: [${rolls.join(', ')}]${modText} = ${total}`;
}
