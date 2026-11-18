// Districts on a city map (decision 301). A city tile that grows a skyline is a district. The GM gives it what the
// story needs — a name, a status notice, the response level, who holds jurisdiction, a curfew, checkpoint density,
// a minimum Credit Score, a GM-only note — and ticks what the players know. The map holds the district's defaults
// (`p.district`, set in the builder); a campaign that changes one keeps its own whole version (kept in the campaign,
// so another group's city can differ; *Back to the map's* drops it). Players only ever receive the fields they know (`publicDistrict`). Pure.

import { propDef } from './props.js';

export const FIELDS = ['name', 'notice', 'response', 'jurisdiction', 'access', 'curfew', 'checkpoints', 'minCrs', 'residents', 'enemies'];
/** Decision 304: lists of bestiary ids — who lives there (NPCs, named elites), the usual trouble (enemy types, elites). */
export const LISTS = ['residents', 'enemies'];
const ids = (v) => (Array.isArray(v) ? [...new Set(v.filter((x) => typeof x === 'string' && /^[\w.-]{1,60}$/.test(x)))].slice(0, 12) : undefined);
const text = (v, n) => (typeof v === 'string' && v.trim() ? v.trim().replace(/\s+/g, ' ').slice(0, n) : undefined);
const level = (v, lo, hi) => (Number.isInteger(Number(v)) && v !== '' && v != null && Number(v) >= lo && Number(v) <= hi ? Number(v) : undefined);

/** A piece that is a district: a city tile with a skyline (not water, a road, a rail or a decal). */
export const isDistrict = (def) => Boolean(def && def.category === 'city' && def.skyline && !def.decal);

/**
 * A district's fields made safe. Unknown or empty ones are dropped, so a campaign's change carries only what it changes.
 * known: the fields the players know (a list).
 */
export function cleanDistrict(raw, data) {
  if (!raw || typeof raw !== 'object') return {};
  const d = data.districts;
  const out = {
    name: text(raw.name, 40),
    notice: d.notices.some((x) => x.id === raw.notice) ? raw.notice : undefined,
    response: level(raw.response, 1, 5),
    jurisdiction: d.jurisdictions.some((x) => x.id === raw.jurisdiction) ? raw.jurisdiction : undefined,
    access: text(raw.access, 60), // decision 310: who gets in — a line for the table ("Grid staff pass")
    curfew: text(raw.curfew, 40),
    checkpoints: level(raw.checkpoints, 0, 5),
    minCrs: level(raw.minCrs, 0, 100),
    note: text(raw.note, 300),
    residents: ids(raw.residents)?.length ? ids(raw.residents) : undefined, // decision 304
    enemies: ids(raw.enemies)?.length ? ids(raw.enemies) : undefined,
    known: Array.isArray(raw.known) ? FIELDS.filter((f) => raw.known.includes(f)) : undefined,
  };
  for (const k of Object.keys(out)) if (out[k] === undefined) delete out[k];
  return out;
}

/** The district as it stands in this campaign: its own version once the GM changed it on the table, else the map's. */
export const effective = (p, change = null) => change ?? p?.district ?? {};

/**
 * What players get for a district: its kind (the tile's name) and the fields they know — never the GM's note.
 * name: null when the district has a name they don't know yet; absent when it has none.
 */
export function publicDistrict(p, def, eff, nameOf = () => null) {
  const known = new Set(eff.known ?? []);
  const out = { kind: def.name };
  if (eff.name) out.name = known.has('name') ? eff.name : null;
  for (const f of FIELDS) {
    if (f === 'name' || !known.has(f) || eff[f] === undefined) continue;
    out[f] = LISTS.includes(f) ? eff[f].map(nameOf).filter(Boolean) : eff[f]; // decision 304: names, never the bestiary's ids
    if (LISTS.includes(f) && !out[f].length) delete out[f];
  }
  return out;
}

/** Every district on a map with its public card: { [propId]: card } (changes: the campaign's for this map). */
export function publicDistricts(map, data, changes = {}, nameOf = () => null) {
  const out = {};
  for (const p of map.props ?? []) {
    const def = propDef(data, p.prop);
    if (isDistrict(def)) out[p.id] = publicDistrict(p, def, effective(p, changes[p.id]), nameOf);
  }
  return out;
}

/** A value in words, for the GM's log line and the cards. */
export function fieldText(f, v, data, nameOf = (x) => x) {
  const d = data.districts;
  if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) return '—';
  if (Array.isArray(v)) return v.map((x) => nameOf(x) ?? x).join(', ');
  if (f === 'notice') return d.notices.find((x) => x.id === v)?.name ?? v;
  if (f === 'jurisdiction') return d.jurisdictions.find((x) => x.id === v)?.name ?? v;
  if (f === 'response') return `${v} · ${d.response.find((x) => x.n === v)?.name ?? ''}`;
  if (f === 'checkpoints') return `${v} · ${d.checkpoints.find((x) => x.n === v)?.name ?? ''}`;
  return String(v);
}

const LABEL = { name: 'name', notice: 'status', response: 'response', jurisdiction: 'jurisdiction', access: 'access', curfew: 'curfew', checkpoints: 'checkpoints', minCrs: 'min Credit Score', residents: 'who lives there', enemies: 'usual trouble' };
/**
 * What changed, for the session log (English: the GM's language): "Milton Heights: status Compliant → Lockdown ·
 * players now know the curfew". null when nothing a debrief would mention changed (the GM note never counts).
 */
export function changeLine(title, before, after, data, nameOf = (x) => x) {
  const parts = [];
  const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  for (const f of FIELDS) if (!same(before[f], after[f])) parts.push(`${LABEL[f]} ${fieldText(f, before[f], data, nameOf)} → ${fieldText(f, after[f], data, nameOf)}`);
  const kb = new Set(before.known ?? []);
  const ka = new Set(after.known ?? []);
  const told = FIELDS.filter((f) => ka.has(f) && !kb.has(f)).map((f) => LABEL[f]);
  const hidden = FIELDS.filter((f) => kb.has(f) && !ka.has(f)).map((f) => LABEL[f]);
  if (told.length) parts.push(`players now know: ${told.join(', ')}`);
  if (hidden.length) parts.push(`no longer shown: ${hidden.join(', ')}`);
  return parts.length ? `${title}: ${parts.join(' · ')}` : null;
}

/** Decision 303: the difficulty step a crossing roll suggests for this district's checkpoints (a tier record), or null. */
export function crossStep(eff, data) {
  const c = data.districts.checkpoints.find((x) => x.n === eff.checkpoints);
  return c?.tier == null ? null : data.difficulty.tiers.find((t) => t.id === c.tier) ?? null;
}
