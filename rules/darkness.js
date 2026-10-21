// Darkness rules (decision 76). Darkness never makes anyone harder to hit (cover is armor, not defence): it
// changes how well you aim, sneak and look. The sheet *suggests* the right option from the situation and the
// player confirms it, like cover. Numbers in data.map.darkness. Pure.
//
// The situation (ctx): { dark: is your square dark (map), or is the table dark (GM switch), lit: are you lit
// (a light reaches your square, or your torch is on), vision: { dark, thermal } (rules/light.js → visionOf),
// target: 'seen' | 'thermal' | null (what the map shows of the target you picked) }.

const opt = (id, tn) => ({ id, tn });

/**
 * The Light row of a check: the options and the one suggested, or null when light doesn't matter.
 * kind: 'attack' | 'stealth' | 'perception'.
 */
export function lightOptions(kind, ctx, data) {
  const d = data.map.darkness;
  const dark = Boolean(ctx.dark);
  if (kind === 'stealth') {
    if (!dark && !ctx.lit) return null;
    return { options: [opt('none', 0), opt('unlit', d.stealth.unlit), opt('lit', d.stealth.lit)], pick: ctx.lit ? 'lit' : 'unlit' };
  }
  if (kind === 'perception') {
    if (!dark) return null;
    const gear = (ctx.vision?.dark ?? 0) > 0 || (ctx.vision?.thermal ?? 0) > 0;
    return { options: [opt('none', 0), opt('dark', d.perception.dark)], pick: gear || ctx.lit ? 'none' : 'dark' };
  }
  if (kind === 'attack') {
    if (!dark && ctx.target !== 'thermal') return null;
    const pick = ctx.target === 'thermal' ? 'thermal' : ctx.target === 'seen' ? 'seen' : 'seen';
    return { options: [opt('seen', 0), opt('thermal', d.attack.thermal), opt('unseen', d.attack.unseen)], pick };
  }
  return null;
}

/** The skill a check rolls → which darkness rule applies to it (null: none). */
export const lightKind = (skillId) => (skillId === 'stealth' ? 'stealth' : skillId === 'perception_awareness' ? 'perception' : null);

/**
 * Where a marker stands, light-wise, from the map message (rules/fog.js → applyFog adds `light`).
 * @returns { dark, lit } — dark: the square is in a dark area; lit: a light reaches it
 */
export function squareLight(map, square) {
  const l = map?.light;
  if (!l || !square) return { dark: false, lit: false };
  const k = `${square.x},${square.y}`;
  const dark = l.allDark || (l.dark ?? []).includes(k);
  return { dark, lit: dark && (l.lit ?? []).includes(k) };
}
