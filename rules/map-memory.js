// Map memories (decision 122): what this character saw of each map that was on the table, kept in the save so the
// player can look back (Notes & maps tab). Built only from the public view the sheet received, already cut by fog:
// the seen squares and what lies on them, doors as last seen, NPC markers with their names and last positions.
// Crew-mates' markers, heat signatures and anything never seen are not kept. The 15 most recent maps stay.

export const MEMORY_MAX = 15;
export const MEMORY_NOTE_MAX = 140;

const square = (p) => `${Math.floor(p.x)},${Math.floor(p.y)}`;
const sameBut = (a, b) => JSON.stringify({ ...a, last: 0 }) === JSON.stringify({ ...b, last: 0 });

/** One piece as remembered: where it was, how it looked (open, wrecked, lit…) and its caption — nothing else. */
const keepProp = ({ reach, ...p }) => p;
const keepNpc = (tk) => ({ key: tk.key, kind: tk.kind, label: tk.label, name: tk.name, x: tk.x, y: tk.y, ...(tk.down ? { down: true } : {}) });

/**
 * Folds a public map message into the list of memories. Returns the same list when nothing new was seen.
 * Without fog the crew sees the whole map (seen: null). Something remembered in a square the crew can see now but
 * that isn't there any more is gone; elsewhere the old memory stays.
 */
export function rememberMap(list, msg, now) {
  const memories = list ?? [];
  const key = msg?.mapId ?? msg?.name;
  if (!key || msg.closed) return memories;
  const prev = memories.find((m) => m.key === key);
  const all = !msg.fog;
  const seenNow = all ? null : new Set(msg.fog.seen);
  const stale = (x) => !all && !seenNow.has(square(x)); // remembered, and not in view to be checked again
  const props = msg.props.map(keepProp);
  const walls = msg.walls;
  const npcs = msg.tokens.filter((tk) => tk.kind !== 'player' && !tk.thermal).map(keepNpc);
  const mid = (w) => ({ x: Math.min(w.a.x, w.b.x) + Math.abs(w.a.x - w.b.x) / 2, y: Math.min(w.a.y, w.b.y) + Math.abs(w.a.y - w.b.y) / 2 });
  const seen = all || prev?.seen === null ? null : [...new Set([...(prev?.seen ?? []), ...seenNow])];
  const next = {
    key, name: msg.name, cols: msg.cols, rows: msg.rows,
    walls: [...walls, ...(prev?.walls ?? []).filter((w) => !walls.some((x) => x.id === w.id) && stale(mid(w)))],
    props: [...props, ...(prev?.props ?? []).filter((p) => !props.some((x) => x.id === p.id) && stale(p))],
    npcs: [...npcs, ...(prev?.npcs ?? []).filter((n) => !npcs.some((x) => x.key === n.key))],
    seen, first: prev?.first ?? now, last: now, ...(prev?.note ? { note: prev.note } : {}),
  };
  if (prev && sameBut(prev, next)) return memories;
  return [next, ...memories.filter((m) => m.key !== key)].slice(0, MEMORY_MAX);
}

export const forgetMap = (list, key) => (list ?? []).filter((m) => m.key !== key);

/** The player's own line about a map ("the fence at the bar owes us"). */
export function noteMap(list, key, text) {
  const note = String(text ?? '').trim().slice(0, MEMORY_NOTE_MAX);
  return (list ?? []).map((m) => (m.key !== key ? m : note ? { ...m, note } : (({ note: _, ...rest }) => rest)(m)));
}

/** A memory as the map viewer draws it: the remembered map, the NPC markers, and fog over what was never seen. */
export function memoryView(m) {
  return {
    map: { id: m.key, name: m.name, cols: m.cols, rows: m.rows, walls: m.walls, props: m.props },
    tokens: m.npcs,
    fog: m.seen ? { mode: 'player', seen: m.seen, visible: m.seen } : null,
  };
}
