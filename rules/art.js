// Enemy art (decision 152): pictures kept by the GM (local/gm/art/<id>_<size>_<n>.webp), shown on the sheets only for
// enemies on the board. Sheets never see the bestiary id: a picture travels under an opaque key. Pure.

export const ART_SIZES = ['portrait', 'full'];
const FILE = /^([a-z]+\.[a-z0-9_]+)_(portrait|full)_(\d+)\.webp$/;

/** The opaque key a picture travels under (FNV-1a of the bestiary id): the same id always gives the same key. */
export function artKey(id) {
  let h = 0x811c9dc5;
  for (const ch of String(id)) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return `a${h.toString(36)}`;
}

/** The art folder's file names → { id: { key, portrait: [n…], full: [n…] } }. */
export function artIndex(files) {
  const out = {};
  for (const f of files) {
    const m = FILE.exec(f);
    if (!m) continue;
    const e = (out[m[1]] ??= { key: artKey(m[1]), portrait: [], full: [] });
    e[m[2]].push(Number(m[3]));
  }
  for (const e of Object.values(out)) for (const s of ART_SIZES) e[s].sort((a, b) => a - b);
  return out;
}

/** How many looks an id has (the portraits count). */
export const looksOf = (index, id) => index?.[id]?.portrait.length ?? 0;

/** Which file a look shows: looks cycle through what exists (copy #4 of a 3-look enemy wears look 1). null: no picture. */
export function pickLook(index, id, size, look = 1) {
  const list = index?.[id]?.[size] ?? [];
  if (!list.length) return null;
  return list[(Math.max(1, Math.round(Number(look) || 1)) - 1) % list.length];
}
