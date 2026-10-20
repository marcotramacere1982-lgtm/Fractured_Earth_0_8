// Unique items from the GM's Forge (decision 61). A unique lives in the inventory row that holds it:
//   { kind, id: 'u.<…>', qty: 1, unique: { …a full record of that kind…, unique: true, note, bonuses: [{ target, n }] } }
// (the record says where it came from in `forgedFrom` — never `base`, which the sheet uses for "the normal value")
// so it keeps its stats when handed to another player, never shows in the market, and survives export.
// The sheet sees it as if it were in the catalogs (withUniques), plus its bonuses while it is in use:
// a weapon in a slot, worn armor, the active deck / optic, an item carried.

const LISTS = { weapon: 'weapons', armor: 'armor', item: 'items', deck: 'decks', optic: 'optics' };

/** Bonus targets the Forge offers: attributes, skills, and a few combat values. */
export function bonusTargets(data) {
  return [
    ...data.attributes.attributes.filter((a) => a.id !== 'CRS').map((a) => ({ id: `attr:${a.id}`, group: 'attribute', label: a.id })),
    ...data.skills.skills.map((k) => ({ id: `skill:${k.id}`, group: 'skill', label: k.name })),
    { id: 'armor', group: 'combat', label: 'Armor' }, { id: 'act', group: 'combat', label: 'Actions per round' },
    { id: 'off', group: 'combat', label: 'OFF (damage bonus)' }, { id: 'def', group: 'combat', label: 'DEF' }, { id: 'init', group: 'combat', label: 'Initiative' },
  ];
}

/** The data with this character's unique items added to their lists (unchanged when there are none). */
export function withUniques(data, character) {
  const rows = (character?.play?.inventory ?? []).filter((r) => r.unique && LISTS[r.kind]);
  if (!rows.length) return data;
  const out = { ...data };
  for (const r of rows) {
    const key = LISTS[r.kind];
    const list = out[key] === data[key] ? [...data[key]] : out[key];
    if (!list.some((x) => x.id === r.id)) list.push({ ...r.unique, id: r.id });
    out[key] = list;
  }
  return out;
}

/** Uniques in use right now: a weapon in a slot, worn armor, the active deck / optic, any item carried. */
export function activeUniques(character) {
  const p = character.play;
  return (p.inventory ?? []).filter((r) => r.unique && r.qty > 0 && (
    (r.kind === 'weapon' && Object.values(p.slots ?? {}).includes(r.id))
    || (r.kind === 'armor' && (p.worn ?? []).includes(r.id))
    || (r.kind === 'deck' && p.deck === r.id)
    || (r.kind === 'optic' && p.optic === r.id)
    || r.kind === 'item'));
}

/** Summed bonuses of the uniques in use: { attrs, skills, mods (armor, act, off, def), init }. */
export function uniqueBonuses(character) {
  const out = { attrs: {}, skills: {}, mods: {}, init: 0 };
  for (const r of activeUniques(character)) {
    for (const b of r.unique.bonuses ?? []) {
      const n = Number(b.n) || 0;
      if (b.target.startsWith('attr:')) out.attrs[b.target.slice(5)] = (out.attrs[b.target.slice(5)] ?? 0) + n;
      else if (b.target.startsWith('skill:')) out.skills[b.target.slice(6)] = (out.skills[b.target.slice(6)] ?? 0) + n;
      else if (b.target === 'init') out.init += n;
      else out.mods[b.target] = (out.mods[b.target] ?? 0) + n;
    }
  }
  return out;
}

/** "+3 TN · +1 DEX · Stealth +2": a unique's bonuses in one line (English: GM console and logs). */
export function bonusText(record, data) {
  const targets = bonusTargets(data);
  return [
    record.tnBonus ? `+${record.tnBonus} TN` : '',
    ...(record.bonuses ?? []).map((b) => `${targets.find((x) => x.id === b.target)?.label ?? b.target} ${Number(b.n) >= 0 ? '+' : ''}${b.n}`),
  ].filter(Boolean).join(' · ');
}
