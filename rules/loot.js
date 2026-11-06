// Loot in containers (decision 277). A placed piece may hold `loot` (set in the Maps tab, saved with the map): what is
// in plain sight (items, cash) and a hidden part found on a roll (`check`, often Perception) — the hidden part may be a
// custom item that is really a clue (a receipt with four digits, a loose panel). Opening or searching the piece on the
// table turns what's in it into a temporary crew stash (rules/crew-stash.js, `temp`); it goes when it's empty. Pure.

const text = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const CHECK = /^(skill|attr):[A-Za-z_]{1,40}$/;

/** One row of loot, made safe: { kind, id, name, qty, note?, unique? } (custom rows need a name). null if unreadable. */
function cleanRow(r) {
  if (!r || typeof r.kind !== 'string') return null;
  const kind = text(r.kind, 12);
  const name = text(r.name, 60);
  if (kind === 'custom' && !name) return null;
  return { kind, id: text(r.id, 80) || kind, name, qty: Math.max(1, Math.min(99, Math.round(Number(r.qty) || 1))), ...(text(r.note, 200) ? { note: text(r.note, 200) } : {}), ...(r.unique && typeof r.unique === 'object' ? { unique: r.unique } : {}) };
}
const cleanPart = (x) => ({ items: (Array.isArray(x?.items) ? x.items : []).map(cleanRow).filter(Boolean).slice(0, 30), cash: Math.max(0, Math.round(Number(x?.cash) || 0)) });

/** A piece's loot, made safe. hidden: { items, cash, check } — check defaults to Perception. */
export function cleanLoot(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const seen = cleanPart(raw);
  const h = cleanPart(raw.hidden);
  return {
    ...seen,
    hidden: { ...h, check: CHECK.test(raw.hidden?.check ?? '') ? raw.hidden.check : 'skill:perception_awareness' },
    ...(typeof raw.stash === 'string' && raw.stash ? { stash: raw.stash } : {}),
    ...(raw.found ? { found: true } : {}),
  };
}

/** Is there anything in this part? */
export const hasAny = (part) => Boolean(part && ((part.items ?? []).length || part.cash));

/** In words, for the GM: "Pistol, Trauma kit ×2, $200". */
export const lootText = (part) => [...(part?.items ?? []).map((r) => `${r.unique?.name ?? r.name ?? r.id}${r.qty > 1 ? ` ×${r.qty}` : ''}`), ...(part?.cash ? [`$${part.cash}`] : [])].join(', ');

/** The units one part puts into a stash (one per item: the stash rules count them), custom ones with a fresh id. */
export function stashUnits(part, newId) {
  return (part?.items ?? []).flatMap((r) => Array.from({ length: r.unique ? 1 : r.qty }, () => (r.kind === 'custom'
    ? { unit: { kind: 'custom', id: `c.${newId()}`, name: r.name, note: r.note ?? '' }, label: r.name }
    : { unit: { kind: r.kind, id: r.unique ? `u.${newId()}` : r.id, ...(r.unique ? { unique: r.unique } : {}) }, label: r.unique?.name ?? r.name ?? r.id })));
}

/** What a stash still holds, back as loot (when the map comes off the table). */
export function fromStash(s) {
  const rows = [];
  for (const u of s?.items ?? []) rows.push({ kind: u.kind, id: u.unique ? 'unique' : u.id, name: u.kind === 'custom' ? u.name : u.unique?.name ?? '', qty: u.qty ?? 1, ...(u.note ? { note: u.note } : {}), ...(u.unique ? { unique: u.unique } : {}) });
  return { items: rows, cash: Math.max(0, Number(s?.cash) || 0) };
}
