// Marks on the table map (decision 82): a crosshair, an arrow, a question mark or a freehand line, drawn by a
// player (in their colour) or the GM, to point at something. Purely visual: no rules, no log, never saved.
// The table server keeps the list; these functions are shared by the server, the sheet and the GM console.
// cfg = data.map.marks. Points are in squares (floats); `by` is a character id or 'gm'.

const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const round2 = (v) => Math.round(v * 100) / 100;
const LIMIT = 500; // no map is wider or taller than this many squares

/** A player's colour: their choice when it is one of the palette, else one picked from their id (stable). */
export function markColor(by, chosen, cfg) {
  if (by === 'gm') return 'gm';
  if (cfg.colors.includes(chosen)) return chosen;
  let h = 0;
  for (const ch of String(by)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return cfg.colors[h % cfg.colors.length];
}

/**
 * Colours for everyone at the table: a player's own choice stays (even if two chose the same); the others get
 * their id's colour when nobody uses it yet, else the first one free. players: [{ key, chosen }] → { key: colour }.
 */
export function assignColors(players, cfg) {
  const out = {};
  const used = new Set();
  for (const p of players) if (cfg.colors.includes(p.chosen)) { out[p.key] = p.chosen; used.add(p.chosen); }
  for (const p of [...players].filter((x) => !out[x.key]).sort((a, b) => String(a.key).localeCompare(String(b.key)))) {
    const own = markColor(p.key, null, cfg);
    out[p.key] = !used.has(own) ? own : cfg.colors.find((c) => !used.has(c)) ?? own;
    used.add(out[p.key]);
  }
  return out;
}

/** Drops points closer than `step` to the last one kept, then keeps at most `max` (evenly spread, ends kept). */
export function thin(points, step, max) {
  const out = [];
  for (const p of points) if (!out.length || Math.hypot(p.x - out.at(-1).x, p.y - out.at(-1).y) >= step) out.push(p);
  if (points.length > 1 && out.at(-1) !== points.at(-1)) out.push(points.at(-1));
  if (out.length <= max) return out;
  return Array.from({ length: max }, (_, i) => out[Math.round((i * (out.length - 1)) / (max - 1))]);
}

/** A mark as sent by a screen → { tool, points } ready to store, or null when it isn't a valid mark. */
export function cleanMark(raw, cfg) {
  if (!raw || !cfg.tools.includes(raw.tool) || !Array.isArray(raw.points)) return null;
  const pts = raw.points.filter((p) => finite(p?.x) && finite(p?.y) && p.x >= 0 && p.y >= 0 && p.x <= LIMIT && p.y <= LIMIT)
    .map((p) => ({ x: round2(p.x), y: round2(p.y) }));
  if (!pts.length) return null;
  if (raw.tool === 'line') {
    const line = thin(pts, cfg.minStep, cfg.maxPoints);
    return line.length >= 2 ? { tool: 'line', points: line } : null;
  }
  if (raw.tool === 'arrow') {
    const [a, b] = [pts[0], pts.at(-1)];
    return Math.hypot(b.x - a.x, b.y - a.y) >= 0.5 ? { tool: 'arrow', points: [a, b] } : null; // a tap is not an arrow
  }
  return { tool: raw.tool, points: [pts[0]] };
}

const expired = (m, cfg, now) => !m.pinned && now - m.t >= cfg.fadeSeconds * 1000;

/** The marks still showing at `now` (pinned ones never fade). */
export const liveMarks = (list, cfg, now) => list.filter((m) => !expired(m, cfg, now));

/**
 * Adds a mark (already cleaned) for its author: { id, by, color, tool, points }. Faded marks go; an author keeps
 * at most cfg.stamps stamps and cfg.lines lines (arrows count as stamps), the oldest unpinned one making room.
 */
export function addMark(list, mark, cfg, now) {
  let next = [...liveMarks(list, cfg, now), { ...mark, t: now, pinned: false }];
  const isLine = (m) => m.tool === 'line';
  for (const [test, max] of [[isLine, cfg.lines], [(m) => !isLine(m), cfg.stamps]]) {
    const mine = next.filter((m) => m.by === mark.by && test(m));
    const extra = mine.length - max;
    if (extra > 0) {
      const drop = new Set([...mine.filter((m) => !m.pinned), ...mine.filter((m) => m.pinned)].slice(0, extra).map((m) => m.id));
      next = next.filter((m) => !drop.has(m.id));
    }
  }
  return next;
}

/** Removes a mark: its author, or the GM (any mark). Unknown or someone else's: the list is unchanged. */
export const removeMark = (list, id, by) => list.filter((m) => !(m.id === id && (m.by === by || by === 'gm')));

/** Pins (keeps) or unpins an author's own mark. One pin each: pinning another unpins the old one, which starts fading now. */
export function pinMark(list, id, by, pin, cfg, now) {
  const target = list.find((m) => m.id === id && m.by === by);
  if (!target) return list;
  return liveMarks(list, cfg, now).map((m) => {
    if (m.id === id) return { ...m, pinned: Boolean(pin), t: now };
    if (pin && m.by === by && m.pinned) return { ...m, pinned: false, t: now };
    return m;
  });
}

/** Seconds left before a mark fades (null when pinned). `skew`: this screen's clock minus the server's. */
export const secondsLeft = (m, cfg, now, skew = 0) => (m.pinned ? null : Math.max(0, cfg.fadeSeconds - (now - skew - m.t) / 1000));
