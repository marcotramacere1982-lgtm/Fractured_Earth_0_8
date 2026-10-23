// Skyline view (decision 123): what rises from each city tile. A recipe turns a tile's footprint (W × H squares),
// its height (0–4) and a seed (its position, so two downtown tiles never match) into boxes:
// { x, y, w, h } on the ground in squares from the footprint's corner, z0 / z1 in storeys of the view,
// and an optional look: 'frame' (scaffolding, outline only) or 'green' (trees). Drawing is skyline.js's job.

/** How tall each height level may grow, in view units (1 ≈ the width of a square). */
export const LEVEL = [0, 0.14, 0.32, 0.62, 1.15];

/** A small seeded random generator (mulberry32). */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const box = (x, y, w, h, z1, z0 = 0, look) => ({ x, y, w, h, z0, z1, ...(look ? { look } : {}) });
/** n × n cells over the footprint with a street gap; fn(cell) → boxes. */
function cells(W, H, n, gap, fn) {
  const out = [];
  const cw = (W - gap) / n;
  const ch = (H - gap) / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) out.push(...fn({ x: gap + i * cw, y: gap + j * ch, w: cw - gap, h: ch - gap, i, j }));
  return out;
}
const vary = (r, top, lo = 0.55) => top * (lo + r() * (1 - lo));

export const RECIPES = {
  towers: (W, H, top, r) => cells(W, H, 3, 0.07, (c) => {
    const z = vary(r, top, 0.45);
    const k = 0.2;
    return [box(c.x, c.y, c.w, c.h, z * 0.55), box(c.x + c.w * k, c.y + c.h * k, c.w * (1 - 2 * k), c.h * (1 - 2 * k), z, z * 0.55),
      ...(r() < 0.3 ? [box(c.x + c.w * 0.45, c.y + c.h * 0.45, c.w * 0.1, c.h * 0.1, z * 1.18, z)] : [])];
  }),
  round: (W, H, top, r) => cells(W, H, 3, 0.07, (c) => ((c.i + c.j) % 2
    ? [box(c.x, c.y, c.w, c.h, vary(r, top * 0.35))]
    : [box(c.x + c.w * 0.12, c.y + c.h * 0.12, c.w * 0.76, c.h * 0.76, vary(r, top, 0.7))])),
  offices: (W, H, top, r) => cells(W, H, 4, 0.06, (c) => [box(c.x, c.y, c.w, c.h, vary(r, top, 0.5))]),
  arcology: (W, H, top) => [0, 1, 2, 3].map((k) => box(0.08 + k * 0.2 * W / 2, 0.08 + k * 0.2 * H / 2, W - 0.16 - k * 0.4 * W / 2, H - 0.16 - k * 0.4 * H / 2, top * (0.32 + k * 0.32), k ? top * (k * 0.32) : 0))
    .concat([box(W / 2 - 0.05, H / 2 - 0.05, 0.1, 0.1, top * 1.75, top * 1.28)]),
  courts: (W, H, top, r) => cells(W, H, 4, 0.06, (c) => {
    const z = vary(r, top, 0.75);
    const t = c.w * 0.3;
    return [box(c.x, c.y, c.w, t, z), box(c.x, c.y + c.h - t, c.w, t, z), box(c.x, c.y + t, t, c.h - 2 * t, z), box(c.x + c.w - t, c.y + t, t, c.h - 2 * t, z)];
  }),
  mega: (W, H, top, r) => cells(W, H, 2, 0.08, (c) => [box(c.x, c.y, c.w, c.h, vary(r, top, 0.8))]),
  slabs: (W, H, top, r) => cells(W, H, 3, 0.08, (c) => [box(c.x, c.y, c.w, c.h * 0.35, vary(r, top, 0.7)), box(c.x, c.y + c.h * 0.6, c.w * 0.7, c.h * 0.35, vary(r, top, 0.7))]),
  houses: (W, H, top, r) => {
    const out = [];
    for (let row = 0; row < 4; row++) for (let k = 0; k < 8; k++) out.push(box(0.06 + k * 0.115 * W + r() * 0.01, 0.1 + row * 0.24 * H, 0.06 * W, 0.05 * H, vary(r, top, 0.6)));
    return out;
  },
  oldtown: (W, H, top, r) => {
    const out = [];
    for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) {
      if (i >= 2 && i <= 3 && j >= 2 && j <= 3) continue; // the square
      out.push(box(0.04 + i * 0.16 * W, 0.04 + j * 0.16 * H, 0.13 * W, 0.13 * H, vary(r, top, 0.5)));
    }
    return [...out, box(0.47 * W, 0.43 * H, 0.08 * W, 0.08 * H, top * 2.4)]; // the bell tower over the square
  },
  shacks: (W, H, top, r) => Array.from({ length: Math.round(70 * W * H) }, () => box(r() * (W - 0.06), r() * (H - 0.06), 0.03 + r() * 0.03, 0.03 + r() * 0.03, vary(r, top, 0.4))),
  grey: (W, H, top, r) => [box(0.1, 0.1, 0.26, 0.22, top * 1.6), box(0.62, 0.58, 0.28, 0.3, top * 1.2), box(0.6, 0.1, 0.3, 0.24, top * 0.6, 0, 'frame'),
    ...RECIPES.shacks(W, H, top * 0.6, r).slice(0, 28)],
  bazaar: (W, H, top, r) => {
    const out = [];
    for (let x = 0.06; x < W - 0.08; x += 0.1) for (let y = 0.08; y < H - 0.06; y += 0.09) if (Math.abs(x - 0.5) > 0.04 && Math.abs(y - 0.5) > 0.04) out.push(box(x, y, 0.07, 0.04, vary(r, top, 0.6)));
    return out;
  },
  sheds: (W, H, top, r) => cells(W, H, 3, 0.06, (c) => [box(c.x, c.y, c.w, c.h * 0.6, vary(r, top, 0.7)),
    box(c.x + c.w * 0.15, c.y + c.h * 0.72, c.w * 0.22, c.h * 0.22, top * 0.9), box(c.x + c.w * 0.55, c.y + c.h * 0.72, c.w * 0.22, c.h * 0.22, top * 0.9)]),
  heavy: (W, H, top, r) => [box(0.06, 0.06, 0.52, 0.4, top), ...[0.66, 0.78, 0.9].map((x) => box(x, 0.12, 0.06, 0.06, top * (3 + r()))),
    ...[[0.1, 0.58], [0.32, 0.58], [0.1, 0.8], [0.32, 0.8]].map(([x, y]) => box(x, y, 0.16, 0.16, top * 0.8)), box(0.6, 0.56, 0.34, 0.38, top * 0.4, 0, 'frame')],
  power: (W, H, top) => [[0.1, 0.12], [0.1, 0.56]].flatMap(([x, y]) => [box(x, y, 0.36, 0.36, top * 1.2), box(x + 0.05, y + 0.05, 0.26, 0.26, top * 2.2, top * 1.2)])
    .concat([box(0.58, 0.1, 0.36, 0.4, top), box(0.86, 0.14, 0.06, 0.06, top * 3)]),
  construction: (W, H, top) => [box(0.08, 0.08, 0.36, 0.36, top * 0.4, 0, 'frame'), box(0.56, 0.08, 0.36, 0.36, top * 1.4, 0, 'frame'), box(0.08, 0.56, 0.36, 0.36, top * 0.2),
    box(0.56, 0.56, 0.36, 0.36, top * 0.9), box(0.2, 0.2, 0.04, 0.04, top * 3.2), box(0.2, 0.2, 0.6, 0.04, top * 3.25, top * 3.1)],
  civic: (W, H, top) => [box(0.24, 0.4, 0.52, 0.28, top * 0.25, 0, 'green'), box(0.3, 0.08, 0.4, 0.26, top), box(0.42, 0.13, 0.16, 0.16, top * 1.6, top),
    ...[[0.06, 0.4], [0.78, 0.4], [0.06, 0.76], [0.3, 0.76], [0.54, 0.76], [0.78, 0.76]].map(([x, y]) => box(x, y, 0.16, 0.16, top * 0.8))],
  campus: (W, H, top) => [box(0.06, 0.18, 0.38, 0.14, top * 1.3), box(0.18, 0.06, 0.14, 0.38, top * 1.3),
    ...[[0.56, 0.1], [0.56, 0.3], [0.1, 0.58], [0.1, 0.8]].map(([x, y]) => box(x, y, 0.2, 0.12, top * 0.8)), box(0.46, 0.58, 0.42, 0.3, top * 0.1, 0, 'green')],
  fortress: (W, H, top) => [box(0.1, 0.1, 0.8, 0.06, top * 0.8), box(0.1, 0.84, 0.8, 0.06, top * 0.8), box(0.1, 0.16, 0.06, 0.68, top * 0.8), box(0.84, 0.16, 0.06, 0.68, top * 0.8),
    ...[[0.06, 0.06], [0.84, 0.06], [0.06, 0.84], [0.84, 0.84]].map(([x, y]) => box(x, y, 0.1, 0.1, top * 1.4)), box(0.3, 0.3, 0.24, 0.4, top * 1.2)],
  railyard: (W, H, top) => [box(0.06, 0.84, 0.4, 0.12, top)],
  airport: (W, H, top) => [box(0.6, 0.66, 0.8, 0.22, top), box(1.5, 0.7, 0.06, 0.06, top * 4)],
  port: (W, H, top, r) => [...[0.1, 0.42, 0.74].flatMap((x) => [box(x + 0.04, 0.42, 0.03, 0.03, top * 3), box(x - 0.06, 0.42, 0.24, 0.03, top * 3.1, top * 2.9)]),
    ...cells(W, 0.36, 4, 0.04, (c) => [box(c.x, c.y + 0.04, c.w, c.h, vary(r, top * 0.6, 0.4))])],
  park: (W, H, top, r) => Array.from({ length: 14 }, () => { const x = 0.06 + r() * 0.84; const y = 0.06 + r() * 0.84; return Math.hypot(x - 0.62, y - 0.6) < 0.25 ? null : box(x, y, 0.06, 0.06, 0.05 + r() * 0.04, 0, 'green'); }).filter(Boolean),
  stadium: (W, H, top) => [box(0.08, 0.12, 0.64, 0.12, top), box(0.08, 0.56, 0.64, 0.12, top), box(0.08, 0.24, 0.12, 0.32, top), box(0.6, 0.24, 0.12, 0.32, top),
    box(0.76, 0.14, 0.18, 0.18, top * 0.8), box(0.76, 0.44, 0.18, 0.18, top * 0.8)],
  cemetery: (W, H, top) => [box(0.44, 0.44, 0.12, 0.12, top * 2)],
  ruins: (W, H, top, r) => [[0.08, 0.08], [0.4, 0.08], [0.7, 0.12], [0.08, 0.42], [0.7, 0.46], [0.1, 0.74], [0.44, 0.72]]
    .map(([x, y]) => box(x, y, 0.22, 0.22, vary(r, top * 2.4, 0.2), 0, r() < 0.4 ? 'frame' : undefined)),
};

/** The boxes for one placed tile: its recipe, its height (the piece's own, or the tile's default), seeded by where it is. */
export function tileBoxes(p, def) {
  const recipe = RECIPES[def.skyline];
  const level = p.height ?? def.height ?? 0;
  if (!recipe) return [];
  const W = def.size.w; // drawn unturned; skyline.js turns the boxes with the piece
  const H = def.size.h;
  const seed = Math.round(p.x * 7919 + p.y * 104729) + def.id.length * 31;
  return recipe(W, H, LEVEL[level], rng(seed)).filter((b) => b.z1 > b.z0);
}
