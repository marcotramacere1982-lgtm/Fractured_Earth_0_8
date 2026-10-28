// Crew stashes (decision 145): shared stashes the table server keeps — anyone at the table puts things in or takes
// them out, every move goes in the stash's history; the GM creates, renames, locks, raids and removes them.
// Free by default; a locked stash can be seen but not touched. Pure: the server calls applyStashOp and saves the result.

import { putUnit, takeUnit } from './stash.js';

const HISTORY_MAX = 200;
export const PUBLIC_HISTORY = 12; // lines each sheet sees
const KINDS = new Set(['weapon', 'armor', 'item', 'deck', 'deckMod', 'drone', 'droneMod', 'weaponMod', 'optic', 'ammo', 'custom']);
const text = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

/** A unit as a sheet sends it, made safe: a known kind, a short id, a custom's name, a unique's record. null if unreadable. */
export function cleanUnit(raw) {
  if (!raw || !KINDS.has(raw.kind)) return null;
  const id = text(raw.id, 80);
  if (!id) return null;
  if (raw.kind === 'custom' && !text(raw.name, 60)) return null;
  return {
    kind: raw.kind,
    id,
    ...(raw.official === true ? { official: true } : {}),
    ...(raw.kind === 'custom' ? { name: text(raw.name, 60), note: text(raw.note, 200) } : {}),
    ...(raw.unique && typeof raw.unique === 'object' && /^u\.[\w-]{1,64}$/.test(id) ? { unique: raw.unique } : {}),
  };
}

/** The table's stashes as the server keeps them. */
export const emptyStashes = () => ({ stashes: [], removed: [] });

/** What every sheet gets (sticky `stashes`): the stashes, with only the latest lines of history. */
export const publicStashes = (book) => book.stashes.map((s) => ({ ...s, history: s.history.slice(0, PUBLIC_HISTORY) }));

const fail = (why) => ({ ok: false, why });

/**
 * One change to the table's stashes. by: the character's name, or 'GM'. now: the time.
 * Player ops: put { stash, unit, label } · take { stash, kind, id, label } · putCash / takeCash { stash, amount }.
 * GM ops (gm: true): create { name } · rename { stash, name } · lock { stash, on } · raid { stash } · remove { stash }.
 * @returns { ok, why?, book (a new one), unit? (taken), amount?, stash? (its name) } — why: unknown | locked | noItem | noCash | name | gm
 */
export function applyStashOp(book, op, { by, gm = false, now = Date.now(), newId = () => `s-${now.toString(36)}` } = {}) {
  const next = structuredClone(book);
  const s = next.stashes.find((x) => x.id === op?.stash);
  const line = (entry) => { s.history = [{ t: now, by, ...entry }, ...s.history].slice(0, HISTORY_MAX); };
  const done = (extra = {}) => ({ ok: true, book: next, stash: s?.name, ...extra });
  const GM_OPS = ['create', 'rename', 'lock', 'raid', 'remove'];
  if (GM_OPS.includes(op?.op) && !gm) return fail('gm');
  if (op?.op === 'create') {
    const name = text(op.name, 40);
    if (!name) return fail('name');
    next.stashes.push({ id: newId(), name, locked: false, cash: 0, items: [], history: [{ t: now, by, op: 'create' }] });
    return { ok: true, book: next, stash: name };
  }
  if (!s) return fail('unknown');
  switch (op.op) {
    case 'rename': {
      const name = text(op.name, 40);
      if (!name) return fail('name');
      line({ op: 'rename', what: s.name });
      s.name = name;
      return done();
    }
    case 'lock':
      s.locked = Boolean(op.on);
      line({ op: s.locked ? 'lock' : 'unlock' });
      return done();
    case 'raid': {
      const lost = [...s.items.map((r) => `${r.kind === 'custom' ? r.name : r.unique?.name ?? r.id}${r.qty > 1 ? ` ×${r.qty}` : ''}`), ...(s.cash ? [`$${s.cash}`] : [])];
      line({ op: 'raid', what: lost.join(', ') || 'nothing' });
      s.items = [];
      s.cash = 0;
      return done();
    }
    case 'remove':
      next.stashes = next.stashes.filter((x) => x !== s);
      next.removed = [{ ...s, removedAt: now }, ...(next.removed ?? [])];
      return done();
    default:
  }
  if (s.locked && !gm) return fail('locked');
  const amount = Math.floor(Number(op.amount) || 0);
  switch (op.op) {
    case 'put': {
      const unit = cleanUnit(op.unit);
      if (!unit) return fail('noItem');
      putUnit(s.items, unit);
      line({ op: 'put', what: text(op.label, 60) || unit.name || unit.id });
      return done({ unit });
    }
    case 'take': {
      const unit = takeUnit(s.items, op.kind, op.id);
      if (!unit) return fail('noItem');
      line({ op: 'take', what: text(op.label, 60) || unit.name || unit.unique?.name || unit.id });
      return done({ unit });
    }
    case 'putCash':
      if (amount <= 0) return fail('noCash');
      s.cash += amount;
      line({ op: 'putCash', amount });
      return done({ amount });
    case 'takeCash':
      if (amount <= 0 || amount > s.cash) return fail('noCash');
      s.cash -= amount;
      line({ op: 'takeCash', amount });
      return done({ amount });
    default:
      return fail('unknown');
  }
}

/** A history line in English (the GM console; sheets word it in their language). */
export function historyText(h) {
  const who = h.by === 'GM' ? 'The GM' : h.by;
  switch (h.op) {
    case 'create': return `${who} set it up`;
    case 'rename': return `${who} renamed it (was ${h.what})`;
    case 'lock': return `${who} locked it`;
    case 'unlock': return `${who} unlocked it`;
    case 'raid': return `Raided: ${h.what} gone`;
    case 'put': return `${who} put away ${h.what}`;
    case 'take': return `${who} took ${h.what}`;
    case 'putCash': return `${who} put away $${h.amount}`;
    case 'takeCash': return `${who} took $${h.amount}`;
    default: return `${who}: ${h.op}`;
  }
}
