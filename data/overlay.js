// Translation overlays for game data. An overlay mirrors a data file but keeps only translated text;
// arrays of records become objects keyed by record id. Anything not in the overlay stays English.
//   base:    { skills: [{ id: 'stealth', name: 'Stealth', desc: '…' }] }
//   overlay: { skills: { stealth: { desc: '…' } } }

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

/** Returns a copy of `base` with the overlay's text laid over it (only existing fields of the same type). */
export function applyOverlay(base, overlay) {
  if (overlay == null) return base;
  if (Array.isArray(base)) {
    if (Array.isArray(overlay)) return base.every((x) => typeof x === 'string') ? overlay : base; // e.g. effects[]
    if (!isObj(overlay)) return base;
    return base.map((rec) => (isObj(rec) && rec.id != null && overlay[rec.id] != null ? applyOverlay(rec, overlay[rec.id]) : rec));
  }
  if (isObj(base)) {
    if (!isObj(overlay)) return base;
    const out = { ...base };
    for (const [k, v] of Object.entries(overlay)) if (k in base) out[k] = applyOverlay(base[k], v);
    return out;
  }
  return typeof overlay === typeof base ? overlay : base;
}

/**
 * Problems in an overlay: paths that point at no record or field, or change a value's type.
 * @returns {string[]}
 */
export function overlayProblems(base, overlay, path = '') {
  if (Array.isArray(base)) {
    if (Array.isArray(overlay)) return base.every((x) => typeof x === 'string') ? [] : [`${path}: list replaces records`];
    if (!isObj(overlay)) return [`${path}: expected records by id`];
    return Object.entries(overlay).flatMap(([id, v]) => {
      const rec = base.find((r) => isObj(r) && String(r.id) === id);
      return rec ? overlayProblems(rec, v, `${path}[${id}]`) : [`${path}[${id}]: no record with this id`];
    });
  }
  if (isObj(base)) {
    if (!isObj(overlay)) return [`${path}: expected an object`];
    return Object.entries(overlay).flatMap(([k, v]) => (k in base ? overlayProblems(base[k], v, `${path}.${k}`) : [`${path}.${k}: no such field`]));
  }
  return typeof overlay === typeof base ? [] : [`${path}: type ${typeof overlay} instead of ${typeof base}`];
}
