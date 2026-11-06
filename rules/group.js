// Group checks (decision 271). When the whole crew does the same thing — sneaking through a lobby, climbing a fence,
// keeping a cover story straight — everyone rolls, and the group succeeds when at least half of them succeed
// (data.difficulty.group.need). Strong members carry weak ones, but not forever. Pure.

/**
 * results: { [characterId]: { success } } — the answers so far; total: how many were asked.
 * @returns { done (everyone answered), successes, total, need, ok (enough successes, or already certain) , lost (can't make it any more) }
 */
export function groupOutcome(results, total, d) {
  const list = Object.values(results ?? {});
  const successes = list.filter((r) => r?.success).length;
  const need = Math.ceil(total * (d?.need ?? 0.5));
  return { done: list.length >= total, successes, total, need, ok: successes >= need, lost: successes + (total - list.length) < need };
}
