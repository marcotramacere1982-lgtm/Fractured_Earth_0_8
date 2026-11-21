// Decision 357: exact sight shapes, for drawing only. From one point, rays are cast at every blocker's ends (and a
// hair either side), each stopped by the nearest blocker; the hits, in angle order, outline everything visible.
// The rules stay square by square (rules/fog.js, rules/light.js): the map uses these outlines to draw the edges of
// what the rules already show. Squares are the unit. Pure.

const raySeg = (o, dx, dy, s) => {
  const sx = s.b.x - s.a.x;
  const sy = s.b.y - s.a.y;
  const den = dx * sy - dy * sx;
  if (Math.abs(den) < 1e-12) return Infinity;
  const ax = s.a.x - o.x;
  const ay = s.a.y - o.y;
  const u = (ax * dy - ay * dx) / den;
  if (u < -1e-9 || u > 1 + 1e-9) return Infinity;
  return (ax * sy - ay * sx) / den;
};

/** Distance from a point to a segment. */
const segDist = (p, s) => {
  const vx = s.b.x - s.a.x;
  const vy = s.b.y - s.a.y;
  const l2 = vx * vx + vy * vy || 1e-12;
  const t = Math.max(0, Math.min(1, ((p.x - s.a.x) * vx + (p.y - s.a.y) * vy) / l2));
  return Math.hypot(p.x - (s.a.x + t * vx), p.y - (s.a.y + t * vy));
};

/**
 * The outline of what `o` sees: a flat [x0, y0, x1, y1, …] polygon in squares.
 * segs: [{ a, b }] blockers; cols / rows: the board; radius: a light's reach (Infinity: the board's edge).
 */
export function visPolygon(o, segs, { cols, rows, radius = Infinity } = {}) {
  const finite = Number.isFinite(radius);
  const pool = finite ? segs.filter((s) => segDist(o, s) <= radius) : segs;
  const [x0, y0, x1, y1] = finite
    ? [Math.max(0, o.x - radius), Math.max(0, o.y - radius), Math.min(cols, o.x + radius), Math.min(rows, o.y + radius)]
    : [0, 0, cols, rows];
  const box = [[x0, y0, x1, y0], [x1, y0, x1, y1], [x1, y1, x0, y1], [x0, y1, x0, y0]].map(([ax, ay, bx, by]) => ({ a: { x: ax, y: ay }, b: { x: bx, y: by } }));
  const edges = [...pool, ...box];
  const angles = [];
  for (const s of edges) {
    for (const p of [s.a, s.b]) {
      const a = Math.atan2(p.y - o.y, p.x - o.x);
      angles.push(a - 1e-5, a, a + 1e-5);
    }
  }
  if (finite) for (let i = 0; i < 96; i++) angles.push(-Math.PI + (i * 2 * Math.PI) / 96); // a round edge for lights
  angles.sort((a, b) => a - b);
  const out = [];
  for (const a of angles) {
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    let best = finite ? radius : 1e9;
    for (const s of edges) {
      const t = raySeg(o, dx, dy, s);
      if (t > 1e-6 && t < best) best = t;
    }
    out.push(o.x + dx * best, o.y + dy * best);
  }
  return out;
}
