// The crew's case (decisions 278–279). Per mission (and a General one): a dossier the GM feeds — objectives (the main
// one always; secondaries when the GM shows them), handouts and messages sent to everyone, people and places the GM
// reveals — and a board the crew builds: cards on a grid (fixed sizes, snapped), links between them, one editor at a
// time (they pass the pen among themselves; the GM can do anything and adds anonymous tips). Nothing is deleted:
// unpinned cards wait in a drawer. Pure: the server calls applyCaseOp and saves the result.

export const GRID = { cols: 16, rows: 12 };
export const SIZES = { s: [1, 1], w: [2, 1], b: [2, 2] };
export const TYPES = ['person', 'place', 'clue', 'lead', 'question', 'document'];
export const GENERAL = 'general';
const ENTRY_KINDS = ['handout', 'puzzle', 'message', 'person', 'place'];
const text = (v, n) => String(v ?? '').replace(/[ \t]+/g, ' ').trim().slice(0, n);

export const emptyCase = () => ({ missions: [], active: null, boards: {}, dossier: {} });
export const board = (book, key) => book.boards[key] ?? { editor: null, cards: [], drawer: [], links: [], suggestions: [] };

/** The cells a card covers. */
const cells = (c) => { const [w, h] = SIZES[c.size] ?? SIZES.s; const out = []; for (let x = c.x; x < c.x + w; x++) for (let y = c.y; y < c.y + h; y++) out.push(`${x},${y}`); return out; };
/** Does a card fit at (x, y) — on the grid, and not over another card (but itself)? */
export function fits(b, card, x, y) {
  const [w, h] = SIZES[card.size] ?? SIZES.s;
  if (x < 0 || y < 0 || x + w > GRID.cols || y + h > GRID.rows) return false;
  const mine = new Set(cells({ ...card, x, y }));
  return !b.cards.some((o) => o.id !== card.id && cells(o).some((k) => mine.has(k)));
}

/** A card as the editor sends it, made safe. */
function cleanCard(raw) {
  return {
    type: TYPES.includes(raw?.type) ? raw.type : 'clue',
    size: raw?.size in SIZES ? raw.size : 's',
    title: text(raw?.title, 60),
    text: String(raw?.text ?? '').slice(0, 600),
    ...(typeof raw?.image === 'string' && /^\/api\/table\/handout\?name=[\w.%-]{1,120}$/.test(raw.image) ? { image: raw.image } : {}),
    ...(typeof raw?.entry === 'string' ? { entry: text(raw.entry, 40) } : {}),
  };
}

const fail = (why) => ({ ok: false, why });

/**
 * One change. who: { gm, id (a character id), name }. Board ops: add { board, card: { …, x, y } } · move { board, card, x, y } ·
 * edit { board, card, fields } · unpin { board, card } · restore { board, card, x, y } · link { board, a, b, label } ·
 * unlink { board, link } · pass { board, to } (the editor or the GM) · claim { board } (a free pen) · suggest { board, text } (anyone).
 * GM only: editor { board, to } · tip { board, card } · entry { mission, entry } · forget { mission, entry }.
 * @returns { ok, why?, book, notice? } — why: editor | gm | noCard | noRoom | name | unknown
 */
export function applyCaseOp(book, op, who, { now = Date.now(), newId = () => `k${now.toString(36)}` } = {}) {
  const next = structuredClone(book);
  const key = op?.board === GENERAL || next.missions.some((m) => m.id === op?.board) ? op.board : null;
  const done = (extra = {}) => ({ ok: true, book: next, ...extra });
  if (op?.op === 'entry' || op?.op === 'forget') { // the dossier: GM only
    if (!who.gm) return fail('gm');
    const mid = op.mission === GENERAL || next.missions.some((m) => m.id === op.mission) ? op.mission : null;
    if (!mid) return fail('unknown');
    const d = (next.dossier[mid] ??= { entries: [] });
    if (op.op === 'forget') { d.entries = d.entries.filter((e) => e.id !== op.entry); return done(); }
    const e = op.entry ?? {};
    if (!ENTRY_KINDS.includes(e.kind) || !text(e.title, 80)) return fail('name');
    d.entries.push({ id: newId(), kind: e.kind, title: text(e.title, 80), text: String(e.text ?? '').slice(0, 800), ...(typeof e.image === 'string' ? { image: e.image.slice(0, 200) } : {}), t: now });
    return done();
  }
  if (!key) return fail('unknown');
  const b = (next.boards[key] ??= board(next, key));
  const editor = who.gm || (who.id && b.editor === who.id);
  if (op.op === 'suggest') {
    const line = text(op.text, 160);
    if (!line) return fail('name');
    b.suggestions = [{ t: now, by: who.name ?? 'GM', text: line }, ...b.suggestions].slice(0, 20);
    return done({ notice: { kind: 'suggest', by: who.name, text: line, editor: b.editor } });
  }
  if (op.op === 'editor') { if (!who.gm) return fail('gm'); b.editor = typeof op.to === 'string' && op.to ? op.to : null; return done(); }
  if (op.op === 'claim') { if (b.editor && b.editor !== who.id && !who.gm) return fail('editor'); b.editor = who.id ?? null; return done({ notice: { kind: 'claim', by: who.name } }); } // a free pen: anyone picks it up
  if (op.op === 'pass') { if (!editor) return fail('editor'); b.editor = typeof op.to === 'string' && op.to ? op.to : null; return done({ notice: { kind: 'pass', by: who.name, to: b.editor } }); }
  if (!editor && !(who.gm && op.op === 'tip')) return fail('editor');
  const card = (id) => b.cards.find((c) => c.id === id);
  switch (op.op) {
    case 'add':
    case 'tip': {
      const c = { id: newId(), ...cleanCard(op.card), x: Math.round(Number(op.card?.x)), y: Math.round(Number(op.card?.y)), by: op.op === 'tip' ? null : who.name ?? 'GM', ...(op.op === 'tip' ? { tip: true } : {}) };
      if (!c.title && !c.text && !c.image) return fail('name');
      if (!fits(b, c, c.x, c.y)) { // no room there: the first free place
        const spot = freeSpot(b, c);
        if (!spot) return fail('noRoom');
        Object.assign(c, spot);
      }
      b.cards.push(c);
      return done({ card: c.id });
    }
    case 'move': {
      const c = card(op.card);
      if (!c) return fail('noCard');
      const x = Math.round(Number(op.x)); const y = Math.round(Number(op.y));
      if (!fits(b, c, x, y)) return fail('noRoom');
      c.x = x; c.y = y;
      return done();
    }
    case 'edit': {
      const c = card(op.card);
      if (!c) return fail('noCard');
      const f = cleanCard({ ...c, ...op.fields });
      if (f.size !== c.size && !fits(b, { ...c, size: f.size }, c.x, c.y)) return fail('noRoom');
      Object.assign(c, f);
      return done();
    }
    case 'unpin': {
      const c = card(op.card);
      if (!c) return fail('noCard');
      b.cards = b.cards.filter((x) => x !== c);
      b.links = b.links.filter((l) => l.a !== c.id && l.b !== c.id);
      b.drawer = [{ ...c, unpinnedAt: now }, ...b.drawer].slice(0, 100);
      return done();
    }
    case 'restore': {
      const c = b.drawer.find((x) => x.id === op.card);
      if (!c) return fail('noCard');
      const spot = fits(b, c, Number(op.x), Number(op.y)) ? { x: Number(op.x), y: Number(op.y) } : freeSpot(b, c);
      if (!spot) return fail('noRoom');
      const { unpinnedAt: _, ...rest } = c;
      b.drawer = b.drawer.filter((x) => x !== c);
      b.cards.push({ ...rest, ...spot });
      return done();
    }
    case 'link': {
      if (!card(op.a) || !card(op.b) || op.a === op.b) return fail('noCard');
      if (b.links.some((l) => (l.a === op.a && l.b === op.b) || (l.a === op.b && l.b === op.a))) return done();
      b.links.push({ id: newId(), a: op.a, b: op.b, label: text(op.label, 30) });
      return done();
    }
    case 'unlink': b.links = b.links.filter((l) => l.id !== op.link); return done();
    default: return fail('unknown');
  }
}

/** The first free place for a card, row by row. */
export function freeSpot(b, card) {
  for (let y = 0; y < GRID.rows; y++) for (let x = 0; x < GRID.cols; x++) if (fits(b, card, x, y)) return { x, y };
  return null;
}

/** What players see of the campaign (decision 278): active and finished missions; the main objective always, secondaries the GM shows. */
export function publicMissions(campaign) {
  return (campaign?.missions ?? []).filter((m) => m.status === 'active' || m.status === 'done').map((m) => ({
    id: m.id, code: text(m.code, 12), title: text(m.title, 120), status: m.status,
    objectives: (m.objectives ?? []).filter((o) => o.kind === 'main' || o.shown).map((o) => ({ id: o.id, kind: o.kind, text: String(o.text ?? '').slice(0, 400), status: o.status ?? null })),
  }));
}
