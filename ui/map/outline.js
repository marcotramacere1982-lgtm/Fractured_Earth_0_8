// Decision 359: a piece's real outline, traced from its drawing's `solid` shapes (paths, rects, circles, ellipses,
// polygons) and reduced to their convex hull, as 0–1 fractions of the viewBox. Shadows are cast from it, so rubble
// throws a jagged shadow and a round table a round one, not their bounding box. Pure (no DOM): it reads markup.

/** Points along an SVG path's commands (end points and control points; arcs by their ends and bulge). */
export function pathPoints(d) {
  const toks = String(d).match(/[a-zA-Z]|[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) ?? [];
  const pts = [];
  let i = 0; let cmd = ''; let x = 0; let y = 0; let sx = 0; let sy = 0;
  const isCmd = (t) => /^[a-zA-Z]$/.test(t);
  const num = () => Number(toks[i++]);
  let guard = 0;
  while (i < toks.length && guard++ < 10000) {
    if (isCmd(toks[i])) cmd = toks[i++];
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    const at = (nx, ny) => (rel ? [x + nx, y + ny] : [nx, ny]);
    if (C === 'Z') { x = sx; y = sy; if (i < toks.length && !isCmd(toks[i])) i++; continue; }
    if (C === 'M' || C === 'L' || C === 'T') {
      [x, y] = at(num(), num()); pts.push([x, y]);
      if (C === 'M') { sx = x; sy = y; cmd = rel ? 'l' : 'L'; }
    } else if (C === 'H') { x = rel ? x + num() : num(); pts.push([x, y]); }
    else if (C === 'V') { y = rel ? y + num() : num(); pts.push([x, y]); }
    else if (C === 'C') { const a = at(num(), num()); const b = at(num(), num()); const e = at(num(), num()); pts.push(a, b, e); [x, y] = e; }
    else if (C === 'S' || C === 'Q') { const a = at(num(), num()); const e = at(num(), num()); pts.push(a, e); [x, y] = e; }
    else if (C === 'A') {
      const rx = Math.abs(num()); const ry = Math.abs(num()); num(); const large = num(); num();
      const e = at(num(), num());
      const r = Math.max(rx, ry);
      const cx = (x + e[0]) / 2; const cy = (y + e[1]) / 2;
      const half = Math.hypot(e[0] - x, e[1] - y) / 2;
      const sag = large ? r + Math.sqrt(Math.max(0, r * r - half * half)) : r - Math.sqrt(Math.max(0, r * r - half * half));
      const len = half * 2 || 1; const nx = -(e[1] - y) / len; const ny = (e[0] - x) / len;
      pts.push([cx + nx * sag, cy + ny * sag], [cx - nx * sag, cy - ny * sag], e); // both sides: a little generous
      [x, y] = e;
    } else i++; // unknown: skip
    if (pts.length && pts.at(-1).some((v) => !Number.isFinite(v))) pts.pop();
  }
  return pts;
}

const ring = (cx, cy, rx, ry, n = 12) => Array.from({ length: n }, (_, k) => [cx + rx * Math.cos((k * 2 * Math.PI) / n), cy + ry * Math.sin((k * 2 * Math.PI) / n)]);

/** Convex hull (monotone chain) of [[x, y]]. */
export function hull2(points) {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = []; for (const q of p) { while (lo.length >= 2 && cr(lo.at(-2), lo.at(-1), q) <= 0) lo.pop(); lo.push(q); }
  const up = []; for (const q of [...p].reverse()) { while (up.length >= 2 && cr(up.at(-2), up.at(-1), q) <= 0) up.pop(); up.push(q); }
  return [...lo.slice(0, -1), ...up.slice(0, -1)];
}

/**
 * The outline of a drawing (a parsed <svg> element): the hull of its `solid` shapes, outside any `wreck-only`
 * group, as [[u, v]] fractions of the viewBox; null when there is nothing to trace (then the box is used).
 */
export function outlineOf(svg) {
  const vb = (svg.getAttribute('viewBox') ?? '0 0 100 100').split(/[\s,]+/).map(Number);
  const [mx, my, vw, vh] = vb.length === 4 && vb.every(Number.isFinite) ? vb : [0, 0, 100, 100];
  const n = (k, el) => Number(el.getAttribute(k) ?? 0);
  const pts = [];
  for (const el of svg.querySelectorAll('.solid')) {
    if (el.closest('.wreck-only')) continue;
    const tag = el.tagName.toLowerCase();
    if (tag === 'path') pts.push(...pathPoints(el.getAttribute('d')));
    else if (tag === 'rect') { const x = n('x', el); const y = n('y', el); const w = n('width', el); const h = n('height', el); pts.push([x, y], [x + w, y], [x + w, y + h], [x, y + h]); }
    else if (tag === 'circle') pts.push(...ring(n('cx', el), n('cy', el), n('r', el), n('r', el)));
    else if (tag === 'ellipse') pts.push(...ring(n('cx', el), n('cy', el), n('rx', el), n('ry', el)));
    else if (tag === 'polygon' || tag === 'polyline') { const v = (el.getAttribute('points') ?? '').split(/[\s,]+/).map(Number); for (let k = 0; k + 1 < v.length; k += 2) pts.push([v[k], v[k + 1]]); }
  }
  const h = hull2(pts.filter((q) => q.every(Number.isFinite)));
  if (h.length < 3) return null;
  return h.map(([x, y]) => [Math.max(0, Math.min(1, (x - mx) / vw)), Math.max(0, Math.min(1, (y - my) / vh))]);
}
