// NPC generator (decision 343): a library entry made from an archetype in the GM's bestiary. The GM changes its
// numbers, arms it from the catalog (Forge uniques included), keeps or drops the archetype's own attacks (claws, a
// drone's built-in gun) and gives it a fixed loot list. The result is an ordinary bestiary entry — Markers, groups,
// Plan difficulty and districts use it like any other — that remembers where it came from (`variantOf`) and borrows
// the archetype's picture (`artOf`); its Intel stays its own (its id). Pure.

export const SIDES = ['hostile', 'ally', 'neutral'];
export const LOCKS = ['none', 'smart', 'biometric'];
export const LIMITS = { hp: [1, 999], armor: [0, 20], actions: [1, 4], sqr: [0, 20], init: [-5, 20], tn: [1, 20] };
const STATS = ['hp', 'armor', 'actions', 'sqr', 'init'];
const clamp = (key, v) => { const [lo, hi] = LIMITS[key]; const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo; };

/** Melee for close-combat weapons, ranged for the rest (the enemy attack types). */
export const attackType = (w) => (w?.class === 'cqc' ? 'melee' : 'ranged');

/** The TN an archetype fights with for a type of attack: its best of that type, else its best, else 10. */
export function baseTn(base, type) {
  const list = base?.attacks ?? [];
  const of = list.filter((a) => a.type === type);
  const pool = of.length ? of : list;
  return pool.length ? Math.max(...pool.map((a) => Number(a.tn) || 0)) : 10;
}

/** A readable id for a new entry: enemy.<slug> / elite.<slug>, -2, -3… when taken. Matches the art files' pattern. */
export function newId(name, kind, taken) {
  const slug = String(name ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40) || 'npc';
  const stem = `${kind === 'elite' ? 'elite' : 'enemy'}.${slug}`;
  if (!taken.has(stem)) return stem;
  let n = 2;
  while (taken.has(`${stem}_${n}`)) n += 1;
  return `${stem}_${n}`;
}

/** A fresh draft from an archetype: its numbers, all its attacks kept, no gear, no loot. */
export function draftFrom(base) {
  return {
    baseId: base.id, id: null, name: base.name, kind: base.kind === 'elite' ? 'elite' : 'regular',
    faction: base.faction ?? '', role: base.role ?? '', side: 'hostile', tag: base.tag ?? 'organic',
    desc: base.desc ?? '', behaviour: base.behaviour ?? '', mj: base.mj ?? '',
    ...Object.fromEntries(STATS.map((k) => [k, base[k] ?? (k === 'actions' ? 1 : 0)])),
    keep: (base.attacks ?? []).map((a) => ({ id: a.id, tn: a.tn })),
    weapons: [], // [{ id } | { unique }, with tn, lock]
    talents: structuredClone(base.talents ?? []), immune: [...(base.immune ?? [])],
    loot: null, public: false,
    awareness: structuredClone(base.awareness ?? {}), // decision 366: only what differs from the defaults
  };
}

/** A saved generated entry back into a draft, to change it. */
export function draftOf(entry, base) {
  const fromGear = new Set((entry.attacks ?? []).filter((a) => a.gear != null).map((a) => a.id));
  return {
    ...draftFrom(base ?? entry), baseId: entry.variantOf ?? entry.id, id: entry.id, name: entry.name, kind: entry.kind,
    faction: entry.faction ?? '', role: entry.role ?? '', side: entry.side ?? 'hostile', tag: entry.tag ?? 'organic',
    desc: entry.desc ?? '', behaviour: entry.behaviour ?? '', mj: entry.mj ?? '',
    ...Object.fromEntries(STATS.map((k) => [k, entry[k]])),
    keep: (entry.attacks ?? []).filter((a) => !fromGear.has(a.id)).map((a) => ({ id: a.id, tn: a.tn })),
    weapons: (entry.gear?.weapons ?? []).map((g, i) => ({ ...g, tn: entry.attacks.find((a) => a.gear === i)?.tn ?? 10 })),
    talents: structuredClone(entry.talents ?? []), immune: [...(entry.immune ?? [])],
    loot: entry.loot ?? null, public: Boolean(entry.public),
    awareness: structuredClone(entry.awareness ?? {}), // decision 366
  };
}

/** The catalog or forged record a gear line stands for (null if the catalog no longer has it). */
export const weaponOf = (g, weapons) => g.unique ?? weapons.find((w) => w.id === g.id) ?? null;

/**
 * The bestiary entry a draft makes. base: the archetype · weapons: the catalog · taken: ids in use (for a new id).
 * The archetype's kept attacks come first (with their TN as set), then one attack per carried weapon.
 */
export function buildEntry(draft, base, weapons, taken = new Set()) {
  const kept = (base?.attacks ?? []).flatMap((a) => {
    const k = draft.keep.find((x) => x.id === a.id);
    return k ? [{ ...a, tn: clamp('tn', k.tn) }] : [];
  });
  const gear = draft.weapons.map((g) => ({ ...(g.unique ? { unique: g.unique } : { id: g.id }), lock: LOCKS.includes(g.lock) ? g.lock : 'none' }));
  const ids = new Set(kept.map((a) => a.id));
  const armed = draft.weapons.flatMap((g, i) => {
    const w = weaponOf(g, weapons);
    if (!w) return [];
    let id = `w${i + 1}`;
    while (ids.has(id)) id = `${id}x`;
    ids.add(id);
    return [{ id, name: w.name, type: attackType(w), tn: clamp('tn', g.tn), damage: w.damage, ...(w.range?.max ? { range: w.range.max } : {}), gear: i }];
  });
  const entry = {
    id: draft.id ?? newId(draft.name, draft.kind, taken),
    kind: draft.kind === 'elite' ? 'elite' : 'regular',
    faction: draft.faction || undefined, role: draft.role || undefined,
    name: String(draft.name ?? '').trim().slice(0, 60) || base?.name || 'NPC',
    desc: String(draft.desc ?? '').trim().slice(0, 400),
    ...Object.fromEntries(STATS.map((k) => [k, clamp(k, draft[k])])),
    behaviour: String(draft.behaviour ?? '').trim().slice(0, 200),
    attacks: [...kept, ...armed],
    talents: (draft.talents ?? []).filter((t) => t?.name?.trim()).map((t) => ({ name: t.name.trim().slice(0, 60), desc: String(t.desc ?? '').trim().slice(0, 300), ...(t.secret ? { secret: true } : {}) })),
    tag: draft.tag || 'organic',
    immune: [...(draft.immune ?? [])],
    ...(base?.vision ? { vision: base.vision } : {}),
    mj: String(draft.mj ?? '').trim(),
    generated: true, variantOf: draft.baseId, artOf: base?.artOf ?? base?.id ?? draft.baseId,
    side: SIDES.includes(draft.side) ? draft.side : 'hostile',
    gear: { weapons: gear },
    ...(draft.loot ? { loot: draft.loot } : {}),
    ...(draft.awareness && Object.keys(draft.awareness).length ? { awareness: { ...draft.awareness } } : {}), // decision 366
    ...(draft.public ? { public: true } : {}),
  };
  for (const k of Object.keys(entry)) if (entry[k] === undefined) delete entry[k];
  return entry;
}

/** What changed against the archetype: [{ key, from, to }] for the numbers, plus attacks and talents counts. */
export function deltas(entry, base) {
  if (!base) return [];
  const out = STATS.filter((k) => (entry[k] ?? 0) !== (base[k] ?? 0)).map((k) => ({ key: k, from: base[k] ?? 0, to: entry[k] }));
  const best = (e) => Math.max(0, ...(e.attacks ?? []).map((a) => Number(a.tn) || 0));
  if (best(entry) !== best(base)) out.push({ key: 'best TN', from: best(base), to: best(entry) });
  if ((entry.attacks ?? []).length !== (base.attacks ?? []).length) out.push({ key: 'attacks', from: (base.attacks ?? []).length, to: entry.attacks.length });
  if ((entry.talents ?? []).length !== (base.talents ?? []).length) out.push({ key: 'talents', from: (base.talents ?? []).length, to: entry.talents.length });
  return out;
}

/** The archetype an entry comes from, following variants of variants back to a hand-made one. */
export function rootOf(entry, library) {
  let e = entry;
  const seen = new Set();
  while (e?.variantOf && !seen.has(e.id)) { seen.add(e.id); e = library.find((x) => x.id === e.variantOf) ?? null; }
  return e;
}

/** The id whose pictures an enemy shows (art index by id): its own if it has any, else its archetype's (decision 343). */
export function artId(art, en) {
  const own = en?.templateId ?? en?.id;
  return art?.[own] || !en?.artOf ? own : en.artOf;
}
