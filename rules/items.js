// Consumables (decision 58): what using one does, and the timed effects they leave on a character.
// An item's `use` (data/items.json): options to pick from, each with
//   heal (dice) · treatLimb (1 | 'all') · clears [condition ids] · revive · immune [ids, for the scene]
//   boost { attrs, mods, rounds (null = the scene), crash } · endStims · table (an effect the GM applies)
// Effects on the sheet: play.effects = [{ id, itemId, name, attrs, mods, immune, roundsLeft, crash }].

/** Items in the inventory that can be used now, with their options. */
export function usableItems(inventory, itemsData) {
  return (inventory ?? []).filter((r) => r.kind === 'item' && r.qty > 0)
    .map((r) => ({ row: r, item: itemsData.find((i) => i.id === r.id) }))
    .filter((x) => x.item?.use?.options?.length);
}

/** A timed effect from a boost option. */
export function effectFrom(item, option, id) {
  const b = option.boost ?? {};
  return { id, itemId: item.id, name: item.name, attrs: { ...(b.attrs ?? {}) }, mods: { ...(b.mods ?? {}) }, immune: [...(option.immune ?? [])],
    roundsLeft: b.rounds ?? null, crash: Boolean(b.crash) };
}

/** Summed attribute changes, condition-style mods and immunities of the active effects. */
export function effectTotals(effects) {
  const attrs = {}; const mods = {}; const immune = new Set();
  for (const e of effects ?? []) {
    for (const [k, v] of Object.entries(e.attrs ?? {})) attrs[k] = (attrs[k] ?? 0) + v;
    for (const [k, v] of Object.entries(e.mods ?? {})) mods[k] = (mods[k] ?? 0) + v;
    (e.immune ?? []).forEach((x) => immune.add(x));
  }
  return { attrs, mods, immune: [...immune] };
}

/**
 * Round end: timed effects count down; those that run out end, and a stim crash leaves you Slowed.
 * Effects for the scene (roundsLeft null) wait for the GM or the end of combat.
 * @returns {{ effects, ended: [effect], crash: boolean }}
 */
export function tickEffects(effects) {
  const ended = [];
  const left = [];
  for (const e of effects ?? []) {
    if (e.roundsLeft == null) { left.push(e); continue; }
    const n = e.roundsLeft - 1;
    if (n <= 0) ended.push(e); else left.push({ ...e, roundsLeft: n });
  }
  return { effects: left, ended, crash: ended.some((e) => e.crash) };
}

/** Combat over: effects counted in rounds end (no crash); scene effects stay until the GM ends them. */
export const endCombatEffects = (effects) => (effects ?? []).filter((e) => e.roundsLeft == null);
