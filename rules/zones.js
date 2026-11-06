// Event zones on a tactical map (decision 83): GM-only rectangles — Entry, Trigger (numbered), Exit, Note — with
// a short label and a note. Narrative reminders only: no effect on movement, sight or any rule, and never part of
// the players' view (rules/map.js → publicMap leaves them out). Squares: x, y = top-left, w, h ≥ 1.
// Decision 258: Hazard zones (H1, H2…) are the exception: electric, gas, poison, steam, fire, heat, cold — on / off,
// shown or hidden, maybe controlled by a piece (a valve, a breaker). Players see the ones on and shown; the damage is
// the GM's to send (an Activity line), never automatic.

const LABEL_MAX = 40;
const NOTE_MAX = 600;
const clampInt = (n, min, max) => Math.max(min, Math.min(max, Math.round(Number(n) || 0)));

/** The rectangle of squares between two map points (both squares included). */
export function zoneRect(a, b) {
  const x0 = Math.floor(Math.min(a.x, b.x));
  const y0 = Math.floor(Math.min(a.y, b.y));
  return { x: x0, y: y0, w: Math.floor(Math.max(a.x, b.x)) - x0 + 1, h: Math.floor(Math.max(a.y, b.y)) - y0 + 1 };
}

const nextId = (zones) => {
  const used = new Set(zones.map((z) => z.id));
  for (let n = zones.length + 1; ; n++) if (!used.has(`z${n}`)) return `z${n}`;
};
/** The next number free on this map for a numbered type (T1, T2… and, decision 258, H1, H2…; a removed one's number is reused). */
const NUMBERED = ['trigger', 'hazard'];
const nextNumber = (zones, type = 'trigger') => {
  const used = new Set(zones.filter((z) => z.type === type).map((z) => z.n));
  for (let n = 1; ; n++) if (!used.has(n)) return n;
};
const DICE = /^\d{1,2}d\d{1,3}([+-]\d{1,2})?$/;
/** Decision 258: a hazard's nature from data (the first when unknown). */
export const hazardOf = (data, nature) => data.map.zones.hazards.find((h) => h.id === nature) ?? data.map.zones.hazards[0];
/** A hazard zone's own fields, cleaned: nature, dice, on, shown, control (a piece id or null). */
function hazardFields(q, data, base = {}) {
  const h = hazardOf(data, q.nature ?? base.nature);
  const nature = h.id;
  const dice = h.strain || !h.dice ? '' : typeof q.dice === 'string' && DICE.test(q.dice.trim()) ? q.dice.trim() : base.dice && nature === base.nature ? base.dice : h.dice; // decision 267: the Hum hurts the mind, no dice
  const shown = q.shown ?? (base.nature && base.nature !== nature && h.hidden ? false : base.shown) ?? !h.hidden; // a nature that starts hidden (the Hum)
  return { nature, dice, on: q.on ?? base.on ?? true, shown, control: typeof (q.control ?? base.control) === 'string' && (q.control ?? base.control) ? (q.control ?? base.control) : null };
}
const HAZARD_KEYS = ['nature', 'dice', 'on', 'shown', 'control'];

/** Adds a zone of `type` covering rect { x, y, w, h }. */
export function addZone(map, data, { type, ...rect }) {
  const t = data.map.zones.types.some((x) => x.id === type) ? type : 'note';
  const zones = map.zones ?? [];
  const z = { id: nextId(zones), type: t, x: clampInt(rect.x, 0, 999), y: clampInt(rect.y, 0, 999), w: clampInt(rect.w, 1, 999), h: clampInt(rect.h, 1, 999), label: '', note: '' };
  if (NUMBERED.includes(t)) z.n = nextNumber(zones, t);
  if (t === 'hazard') Object.assign(z, hazardFields({}, data));
  return { ...map, zones: [...zones, z] };
}

/** Type, label, note or rectangle. Becoming a trigger takes the next number; leaving it drops it. */
export function setZone(map, data, id, fields) {
  const zones = map.zones ?? [];
  const old = zones.find((z) => z.id === id);
  if (!old) return map;
  const z = { ...old };
  if (fields.type && data.map.zones.types.some((x) => x.id === fields.type)) z.type = fields.type;
  if (fields.label != null) z.label = String(fields.label).slice(0, LABEL_MAX);
  if (fields.note != null) z.note = String(fields.note).slice(0, NOTE_MAX);
  for (const k of ['x', 'y']) if (fields[k] != null) z[k] = clampInt(fields[k], 0, 999);
  for (const k of ['w', 'h']) if (fields[k] != null) z[k] = clampInt(fields[k], 1, 999);
  if (NUMBERED.includes(z.type) && (z.n == null || old.type !== z.type)) z.n = nextNumber(zones.filter((x) => x.id !== id), z.type);
  if (!NUMBERED.includes(z.type)) delete z.n;
  if (z.type === 'hazard') Object.assign(z, hazardFields({ ...fields, control: 'control' in fields ? fields.control ?? '' : undefined }, data, old.type === 'hazard' ? old : {})); // decision 258
  else for (const k of HAZARD_KEYS) delete z[k];
  return { ...map, zones: zones.map((x) => (x.id === id ? z : x)) };
}

export const removeZone = (map, id) => ({ ...map, zones: (map.zones ?? []).filter((z) => z.id !== id) });

/** The smallest zone under a map point (a small zone inside a big one is the one you mean), or null. */
export function zoneAt(map, p) {
  const hits = (map.zones ?? []).filter((z) => p.x >= z.x && p.x <= z.x + z.w && p.y >= z.y && p.y <= z.y + z.h);
  return hits.sort((a, b) => a.w * a.h - b.w * b.h)[0]?.id ?? null;
}

/** The short tag drawn on the map: IN, OUT, T2, N (from data), then the label if there is one. */
export function zoneTag(z, data) {
  const t = data.map.zones.types.find((x) => x.id === z.type);
  return `${t?.tag ?? '?'}${NUMBERED.includes(z.type) ? z.n : ''}`;
}

/** Zones read from a file or sent to the server: known types, whole squares, short text. */
export function normalizeZones(raw, data) {
  if (!Array.isArray(raw)) return [];
  let map = { zones: [] };
  for (const q of raw.slice(0, 200)) {
    if (!q || !data.map.zones.types.some((x) => x.id === q.type) || ![q.x, q.y, q.w, q.h].every(Number.isFinite)) continue;
    map = addZone(map, data, q);
    const z = map.zones.at(-1);
    if (/^z\d{1,4}$/.test(q.id ?? '') && !map.zones.some((x) => x.id === q.id)) z.id = q.id;
    if (NUMBERED.includes(q.type) && Number.isInteger(q.n) && q.n > 0 && !map.zones.some((x) => x !== z && x.type === q.type && x.n === q.n)) z.n = q.n;
    if (q.type === 'hazard') Object.assign(z, hazardFields({ ...q, on: typeof q.on === 'boolean' ? q.on : undefined, shown: typeof q.shown === 'boolean' ? q.shown : undefined }, data));
    z.label = String(q.label ?? '').slice(0, LABEL_MAX);
    z.note = String(q.note ?? '').slice(0, NOTE_MAX);
  }
  return map.zones;
}

/** Decision 258: the hazard zones that are on and cover square { x, y } (a marker's square). */
export const hazardsAt = (map, sq) => (map.zones ?? []).filter((z) => z.type === 'hazard' && z.on && sq && sq.x >= z.x && sq.x < z.x + z.w && sq.y >= z.y && sq.y < z.y + z.h);
/** Decision 258: the hazards a piece controls (a valve, a breaker, a switch). */
export const controlledBy = (map, propId) => (map.zones ?? []).filter((z) => z.type === 'hazard' && z.control === propId);
/** Decision 258: what players get of the hazards — on and shown ones, where and what nature (never dice, control or note). */
export const publicHazards = (map) => (map.zones ?? []).filter((z) => z.type === 'hazard' && z.on && z.shown).map((z) => ({ id: z.id, x: z.x, y: z.y, w: z.w, h: z.h, nature: z.nature }));
