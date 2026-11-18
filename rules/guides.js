// Construction guides (decision 290): the map builder's drawing aids — faint lines, rectangles, circles and polylines
// the GM sketches to keep track of a building (the walls of the floor above, a sewer's route under the street). They do
// nothing in play, never reach the table (publicMap lists its fields; guides aren't among them) and show on every floor
// of a building at the same spot, so a sketch made on one floor lines up on the others. Pure.

export const GUIDE_KINDS = ['line', 'rect', 'circle', 'poly'];
export const GUIDE_COLORS = ['cyan', 'coral', 'magenta', 'lime']; // not amber: the floor frames are
const MAX_GUIDES = 400;
const MAX_POINTS = 60;

const num = (v) => (Number.isFinite(Number(v)) ? Math.round(Number(v) * 100) / 100 : null);
const point = (p) => (p && num(p.x) != null && num(p.y) != null ? { x: num(p.x), y: num(p.y) } : null);

/** Guides read from a file: known kinds and colours, finite points, enough of them; ids kept or made. */
export function normalizeGuides(raw) {
  const out = [];
  const used = new Set();
  for (const g of Array.isArray(raw) ? raw.slice(0, MAX_GUIDES) : []) {
    if (!GUIDE_KINDS.includes(g?.kind)) continue;
    const pts = (Array.isArray(g.pts) ? g.pts : []).slice(0, MAX_POINTS).map(point).filter(Boolean);
    if (pts.length < 2) continue;
    let id = typeof g.id === 'string' && /^g\d+$/.test(g.id) && !used.has(g.id) ? g.id : null;
    for (let n = out.length + 1; !id; n++) if (!used.has(`g${n}`)) id = `g${n}`;
    used.add(id);
    out.push({ id, kind: g.kind, pts: g.kind === 'poly' ? pts : pts.slice(0, 2), color: GUIDE_COLORS.includes(g.color) ? g.color : GUIDE_COLORS[0] });
  }
  return out;
}

const nextId = (map) => { const used = new Set((map.guides ?? []).map((g) => g.id)); for (let n = (map.guides ?? []).length + 1; ; n++) if (!used.has(`g${n}`)) return `g${n}`; };

/** One more guide (a too-small one — two points in the same place — is ignored). */
export function addGuide(map, { kind, pts, color }) {
  const [g] = normalizeGuides([{ kind, pts, color }]);
  if (!g || (g.pts.length === 2 && g.pts[0].x === g.pts[1].x && g.pts[0].y === g.pts[1].y)) return map;
  return { ...map, guides: [...(map.guides ?? []), { ...g, id: nextId(map) }] };
}
export const removeGuide = (map, id) => ({ ...map, guides: (map.guides ?? []).filter((g) => g.id !== id) });
export const clearGuides = (map) => { const { guides: _g, ...rest } = map; return rest; };

const segDist = (p, a, b) => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
};
/** How far a point is from a guide's line (squares). */
export function guideDistance(g, p) {
  const [a, b] = g.pts;
  if (g.kind === 'circle') return Math.abs(Math.hypot(p.x - a.x, p.y - a.y) - Math.hypot(b.x - a.x, b.y - a.y));
  if (g.kind === 'rect') {
    const c = [a, { x: b.x, y: a.y }, b, { x: a.x, y: b.y }];
    return Math.min(...c.map((q, i) => segDist(p, q, c[(i + 1) % 4])));
  }
  return Math.min(...g.pts.slice(1).map((q, i) => segDist(p, g.pts[i], q)));
}

/** The guide nearest a point within `tolerance` squares — its own drawing or one of its copies on another floor. */
export function guideAt(map, p, tolerance) {
  let best = null;
  for (const g of map.guides ?? []) {
    for (const off of guideOffsets(map, g)) {
      const d = guideDistance(g, { x: p.x - off.x, y: p.y - off.y });
      if (d <= tolerance && (!best || d < best.d)) best = { id: g.id, d };
    }
  }
  return best?.id ?? null;
}

/**
 * Where a guide shows: its own place, and on a building with floors the same spot in every other floor's frame
 * (offsets in squares, its own first). A guide outside every floor shows once.
 */
export function guideOffsets(map, g) {
  const floors = map.floors ?? [];
  const p = g.pts[0];
  const home = floors.find((f) => p.x >= f.x && p.y >= f.y && p.x < f.x + f.w && p.y < f.y + f.h);
  if (!home) return [{ x: 0, y: 0 }];
  return [{ x: 0, y: 0 }, ...floors.filter((f) => f !== home).map((f) => ({ x: f.x - home.x, y: f.y - home.y }))];
}
