// Change audit between two snapshots of the same character (used by the GM app).
// Normal play (HP, ammo, class resources, notes…) is never flagged. Changes to the character's
// foundations are flagged unless a matching action appears in the sheet's log since the last snapshot.

/** Fields grouped by how they may legitimately change. */
const WATCHED = [
  { path: 'attributes', label: 'Attribute', explain: [/^Level-up: [A-Z]+ \+1/, /Clean Slate/, /^Washer: /] }, // the washer moves CRS (decision 143) // GM rulings, aging, level-up raises
  { path: 'rowOffsets', label: 'Combat row', explain: [] },
  { path: 'mods', label: 'Body modifier', explain: [] },
  { path: 'age', label: 'Age', explain: [] },
  { path: 'criminalRecord', label: 'Criminal record', explain: [/Clean Slate/] },
  { path: 'credentials', label: 'Credentials', explain: [] },
  { path: 'tags', label: 'Notable', explain: [] },
  { path: 'subclassId', label: 'Subclass', explain: [] },
  { path: 'play.maxAbilities', label: 'Brain fog limit', explain: [] },
  { path: 'play.cash', label: 'Cash', explain: [/^Bought .* on the street/, /^Debt instalment paid/, /^Sold /, /^Washer: /, /^Stash: /, /^Crew stash /] },
  { path: 'play.inventory', label: 'Inventory', explain: [/^Bought /, /^Dropped /, /^Sold /, /^Gave /, /^Received /, /^Added /, /(^|· )Reload /, /(^|· )Used /, /^Stash: /, /^Crew stash /, /^Fists: /, /^Drone: /, /^Mod: /, /^Starter kit: /] }, // a toy drone shot down (decision 171)
  { path: 'play.stash.cash', label: 'Stash cash', explain: [/^Stash: /] }, // decision 144
  { path: 'play.stash.items', label: 'Stash', explain: [/^Stash: /] },
  { path: 'play.lifestyle', label: 'Lifestyle', explain: [/^Bought /, /^Lifestyle: /] },
  // advancement (decision 44): XP and gifts come from the GM; talents and raises only while level-up is open
  { path: 'progress.xp', label: 'XP', explain: [/^XP [+−-]/] },
  { path: 'progress.talents', label: 'Talents', explain: [/^Talent: /] },
  { path: 'progress.gifts', label: 'Talent gifts', explain: [/^Talent gift from the GM/] },
  { path: 'progress.raises', label: 'Attribute raises', explain: [/^Level-up: /] },
  { path: 'progress.open', label: 'Level-up open', explain: [/^The GM (opened|closed) level-up/] },
  // downtime (decision 46): pressure moves with the GM's downtime, an instalment, or the GM
  { path: 'downtime.pressure', label: 'Debt pressure', explain: [/^Downtime \(/, /^Debt instalment paid/, /^Debt pressure set by the GM/] },
];

const get = (obj, path) => path.split('.').reduce((o, k) => o?.[k], obj);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** Flattens an object one level (attributes.STR, …) so each change is reported separately. */
function leaves(path, value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return Object.entries(value).map(([k, v]) => [`${path}.${k}`, v]);
  }
  return [[path, value]];
}

/** Log entries written after the previous snapshot (logs are newest-first). */
export function newLogEntries(prev, next) {
  const before = new Set((prev?.play?.log ?? []).map((l) => `${l.t}|${l.text}`));
  return (next?.play?.log ?? []).filter((l) => !before.has(`${l.t}|${l.text}`));
}

/**
 * @returns {{ path, label, from, to, explained: boolean, reason: string|null }[]}
 * Special rule: CRS going *down* with an official purchase logged is explained.
 */
export function auditChanges(prev, next) {
  if (!prev) return [];
  const fresh = newLogEntries(prev, next).map((l) => l.text);
  const changes = [];
  for (const w of WATCHED) {
    const a = get(prev, w.path);
    const b = get(next, w.path);
    if (same(a, b)) continue;
    const pairs = Array.isArray(b) || Array.isArray(a) || typeof b !== 'object' || b === null
      ? [[w.path, a, b]]
      : leaves(w.path, b).map(([p, v]) => [p, get(prev, p), v]).filter(([, x, y]) => !same(x, y));
    for (const [path, from, to] of pairs) {
      // a field the accepted baseline never had: an app update added it, not the player — adopt it quietly
      if (from === undefined) continue;
      let reason = fresh.find((t) => w.explain.some((re) => re.test(t))) ?? null;
      if (path === 'attributes.CRS' && to < from) reason = fresh.find((t) => /^Bought .* officially/.test(t) || /^Washer: cashed out/.test(t)) ?? null;
      changes.push({ path, label: w.label + (path.includes('.') && w.path !== path ? ` ${path.split('.').pop()}` : ''), from, to, explained: Boolean(reason), reason });
    }
  }
  return changes;
}

/** Copies the given paths from `source` into a clone of `target` (used to revert flagged changes). */
export function restorePaths(target, source, paths) {
  const out = structuredClone(target);
  for (const path of paths) {
    const keys = path.split('.');
    let o = out;
    for (const k of keys.slice(0, -1)) o = o[k] ??= {};
    o[keys.at(-1)] = structuredClone(get(source, path));
  }
  return out;
}
