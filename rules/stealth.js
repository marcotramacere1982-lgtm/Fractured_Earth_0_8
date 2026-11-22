// Decision 367: stealth in exploration rounds (step 2 of the stealth plan). Each awake enemy, each step: is the mover
// unseen, exposed or caught? Exposed costs Shadow (the margin of a good Stealth roll, kept); with too little Shadow
// the player rolls Stealth (their own dice, a difficulty from the exposure). Pure.

export const PACES = ['sneak', 'move'];

/** How far this pace goes: a sneak is half the Move (at least 1). */
export const paceMax = (move, pace) => (pace === 'move' ? move : Math.max(1, Math.floor(move / 2)));

/**
 * One enemy against one square. x: { d (squares), seen (its eyes reach the square), heard (within its ears),
 * motion (within its tracker), cover: 'none' | 'half' | 'full', above (it looks down), lit (light on the square),
 * torch (the mover's torch is on), pace: 'sneak' | 'move' | 'still' }. cfg: data.awareness.stealth.
 * @returns { level: 'unseen' | 'exposed' | 'caught', cost, mod, how: 'seen' | 'heard' | 'motion' | null }
 */
export function exposure(x, cfg) {
  const upright = x.pace === 'move';
  const point = x.d <= cfg.caughtWithin;
  const close = x.d <= cfg.closeWithin;
  let seen = x.seen && x.cover !== 'full';
  const halfCover = seen && x.cover === 'half';
  // crouched behind half cover you are hidden — unless they are right on you, look down on you, or your torch is on
  if (halfCover && !upright && !point && !x.above && !x.torch) seen = false;
  const heard = upright && x.heard;
  const motion = upright && x.motion;
  if (!seen && !heard && !motion) return { level: 'unseen', cost: 0, mod: 0, how: null };
  if (seen && (x.lit || x.torch) && point && !halfCover) return { level: 'caught', cost: 0, mod: 0, how: 'seen' };
  const heavy = close || x.lit || x.torch || upright;
  const cost = seen && halfCover ? cfg.shadow.light : heavy ? cfg.shadow.heavy : cfg.shadow.light;
  const mod = !seen ? cfg.mods.onlyHeard : (x.d >= cfg.farFrom ? cfg.mods.far : close ? cfg.mods.close : 0) + (halfCover ? cfg.mods.halfCover : 0);
  return { level: 'exposed', cost, mod, how: seen ? 'seen' : heard ? 'heard' : 'motion' };
}

/** Shadow after a successful Stealth roll: base + half the margin, at most max; a natural 1 fills it. */
export function shadowFrom(result, cfg) {
  if (result.roll === 1) return cfg.shadow.max;
  return Math.min(cfg.shadow.max, cfg.shadow.base + Math.floor(Math.max(0, result.margin ?? 0) * cfg.shadow.perMargin));
}

/** A roll's difficulty tier: the table's, moved by the exposure's modifier (+2 = one tier easier), within the tiers. */
export function stealthTier(tableTier, mod, tiers) {
  const ids = tiers.map((t) => t.id);
  const want = (tableTier ?? 0) - Math.round(mod / 2);
  return Math.min(Math.max(...ids), Math.max(Math.min(...ids), want));
}
