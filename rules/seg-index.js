// Decision 293: walls and edges bucketed by grid cell, so a step or a line of sight only tests the segments near it
// (a big map has hundreds; each move, sight check and fog pass tested all of them for every square). Pure.

const CELL = 2; // squares per cell

/** An index over segments { a, b }: `box(a, b)` — those near a short step; `along(A, B)` — those a line may cross. */
export function segIndex(segs) {
  const cells = new Map();
  const add = (k, s) => { let l = cells.get(k); if (!l) { l = []; cells.set(k, l); } l.push(s); };
  for (const s of segs) {
    const x0 = Math.floor(Math.min(s.a.x, s.b.x) / CELL);
    const x1 = Math.floor(Math.max(s.a.x, s.b.x) / CELL);
    const y0 = Math.floor(Math.min(s.a.y, s.b.y) / CELL);
    const y1 = Math.floor(Math.max(s.a.y, s.b.y) / CELL);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) add(`${x},${y}`, s);
  }
  const collect = (keys) => {
    const out = new Set();
    for (const k of keys) for (const s of cells.get(k) ?? []) out.add(s);
    return [...out];
  };
  return {
    /** Segments in the cells a box (points, squares; a margin of `pad`) touches. */
    box(p, q, pad = 1) {
      const x0 = Math.floor((Math.min(p.x, q.x) - pad) / CELL);
      const x1 = Math.floor((Math.max(p.x, q.x) + pad) / CELL);
      const y0 = Math.floor((Math.min(p.y, q.y) - pad) / CELL);
      const y1 = Math.floor((Math.max(p.y, q.y) + pad) / CELL);
      const keys = [];
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) keys.push(`${x},${y}`);
      return collect(keys);
    },
    /** Segments in the cells a line A→B passes through, and the cells beside them (grid walk, Amanatides–Woo). */
    along(A, B) {
      let cx = Math.floor(A.x / CELL);
      let cy = Math.floor(A.y / CELL);
      const ex = Math.floor(B.x / CELL);
      const ey = Math.floor(B.y / CELL);
      const dx = B.x - A.x;
      const dy = B.y - A.y;
      const sx = Math.sign(dx);
      const sy = Math.sign(dy);
      const tdx = dx ? Math.abs(CELL / dx) : Infinity;
      const tdy = dy ? Math.abs(CELL / dy) : Infinity;
      let tx = dx ? ((sx > 0 ? (cx + 1) * CELL - A.x : A.x - cx * CELL) / Math.abs(dx)) : Infinity;
      let ty = dy ? ((sy > 0 ? (cy + 1) * CELL - A.y : A.y - cy * CELL) / Math.abs(dy)) : Infinity;
      const keys = new Set();
      const mark = (x, y) => { for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) keys.add(`${x + i},${y + j}`); };
      mark(cx, cy);
      for (let n = 0; (cx !== ex || cy !== ey) && n < 10000; n++) {
        if (tx < ty) { tx += tdx; cx += sx; } else { ty += tdy; cy += sy; }
        mark(cx, cy);
      }
      return collect(keys);
    },
  };
}

const memo = new WeakMap(); // segment list → its index
/** The index of a segment list, built once per list (lists are rebuilt when the map changes). */
export function indexOf(segs) {
  let ix = memo.get(segs);
  if (!ix) { ix = segIndex(segs); memo.set(segs, ix); }
  return ix;
}
