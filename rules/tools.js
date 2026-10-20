// Tools (decision 59): carried items that add to a roll when they fit the situation. One tool per roll — the
// player ticks it in the roll window, the GM can say "not here". Nothing is used up.
// An item's `tool` (data/items.json): [{ id, skill | attr | attack ('gun'), tn, when, always }].

/**
 * Tools the character carries for one roll, best first.
 * roll: { skill } (skill check) · { attr } (attribute check) · { skill, attack: 'gun' } (an attack with a gun).
 * @returns [{ id, name, tn, when, always }]
 */
export function toolsFor(inventory, itemsData, { skill = null, attr = null, attack = null } = {}) {
  const seen = new Set();
  return (inventory ?? []).filter((r) => r.kind === 'item' && r.qty > 0)
    .flatMap((r) => {
      const item = itemsData.find((i) => i.id === r.id);
      return (item?.tool ?? [])
        .filter((tl) => (skill && tl.skill === skill) || (attr && tl.attr === attr) || (attack && tl.attack === attack))
        .map((tl) => ({ id: item.id, name: item.name, tn: tl.tn, when: tl.when ?? '', always: Boolean(tl.always) }));
    })
    .filter((x) => (seen.has(x.id) ? false : seen.add(x.id)))
    .sort((a, b) => b.tn - a.tn);
}

/** Carried protections that are rules for the table (the gas mask): [{ id, name, text }]. */
export function carriedProtections(inventory, itemsData) {
  return (inventory ?? []).filter((r) => r.kind === 'item' && r.qty > 0)
    .map((r) => itemsData.find((i) => i.id === r.id)).filter((i) => i?.carry)
    .map((i) => ({ id: i.id, name: i.name, text: i.carry.text }));
}
