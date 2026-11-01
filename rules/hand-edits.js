// Hand edits (decision 208): play-state changes a player makes by hand on the sheet — HP with − / +, a condition or a
// boost toggled, a broken arm or crippled leg marked or treated. The sheet writes one log line for each, carrying
// `hand` (what changed), so the GM sees it in the table feed and confirms it: Accept, or Revert just that change
// (the fight's real damage since then stays). Pure: codes and values, no wording.

/** The key the GM console remembers a confirmed line by (log lines have no id). */
export const handKey = (line) => `${line.t}|${line.text}`;

/** The hand edits in a sheet's log (newest first) that the GM hasn't confirmed. resolved: Set of handKey. */
export const pendingHandEdits = (log = [], resolved = new Set()) => log.filter((l) => l.hand && !resolved.has(handKey(l)));

/**
 * Consecutive − / + taps make one line: while the newest line is a hand HP change less than `windowMs` old, it
 * grows (30 → 31 → 33 stays "30 → 33"); taps that cancel out remove it. Returns the new log.
 */
export function logHandHp(log, { from, to, now = Date.now(), windowMs = 60000 }) {
  const last = log[0];
  const merge = last?.hand?.kind === 'hp' && now - last.t < windowMs;
  const start = merge ? last.hand.from : from;
  const rest = merge ? log.slice(1) : log;
  if (start === to) return rest;
  return [{ t: merge ? last.t : now, text: `By hand: HP ${start} → ${to}`, kind: to > start ? 'ok' : 'bad', hand: { kind: 'hp', from: start, to } }, ...rest];
}

/**
 * What reverting one hand edit puts back, as `restore` values (paths → values), from the sheet as it is now:
 * HP moves back by the change (never above max: full HP is stored as null); a condition or an injury goes back
 * to how it was. maxHp: the character's maximum HP now.
 */
export function revertHandEdit(c, hand, maxHp) {
  if (hand.kind === 'hp') {
    const now = c.play.hp ?? maxHp;
    const back = Math.min(maxHp, now - (hand.to - hand.from));
    return { 'play.hp': back >= maxHp ? null : back };
  }
  if (hand.kind === 'condition') {
    const list = (c.play.conditions ?? []).filter((x) => x !== hand.id);
    return { 'play.conditions': hand.on ? list : [...list, hand.id] };
  }
  if (hand.kind === 'injury') {
    const list = (c.play.injuries ?? []).filter((x) => x !== hand.loc);
    return { 'play.injuries': hand.on ? list : [...list, hand.loc] };
  }
  return {};
}
