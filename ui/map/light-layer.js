// Decision 357: the map's light — exact sight shapes, soft edges, darkness and coloured lamps. Display only: what
// players may see is still the rules' squares (fog.visible / fog.seen, worked out by the GM's console); the shapes
// only draw the true edges of those squares (round corners, through door gaps) and the light falling on them.
// Painted on small canvases in map squares and slipped into the map drawing as images, under the markers, so pan,
// zoom and floors need nothing more. Colours: the map palette (CSS tokens), the lamps' palette in data.map.light.

import { sightSegments } from '../../rules/map.js';
import { wallCut } from '../../rules/areas.js'; // owner 2026-11-21: the slack never crosses a known wall
import { activeProps, propDef, propEdges, propCorners, normRot } from '../../rules/props.js';
import { propOutline, propsLoaded } from './props.js'; // decision 359: traced outlines
import { darkSquares } from '../../rules/light.js';
import { visPolygon } from '../../rules/sight-shapes.js';
import { lightingOf, lightColor } from '../../rules/lighting.js';

const segKey = (s) => `${s.a.x},${s.a.y},${s.b.x},${s.b.y}`;
const poly = (pts) => { const p = new Path2D(); p.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) p.lineTo(pts[i], pts[i + 1]); p.closePath(); return p; };
const squares = (list) => { const p = new Path2D(); for (const k of list) { const [x, y] = k.split(',').map(Number); p.rect(x, y, 1, 1); } return p; };
const rgba = (color, a) => {
  const c = String(color).trim();
  const hex = c.startsWith('#') ? c.slice(1) : null;
  if (!hex) return c; // already rgb(), keep
  const n = parseInt(hex.length === 3 ? hex.split('').map((h) => h + h).join('') : hex.slice(0, 6), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
};

// decision 359: pieces cast shadows by their height (display only): footprint + footprint pushed away from the lamp
const SHADE_M = { low: 0.5, table: 0.9, high: 1.5, tall: 2.2 };
const hull = (pts) => { // convex hull (monotone chain) of [{x, y}]
  const p = [...pts].sort((a, b) => a.x - b.x || a.y - b.y);
  const cr = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lo = []; for (const q of p) { while (lo.length >= 2 && cr(lo.at(-2), lo.at(-1), q) <= 0) lo.pop(); lo.push(q); }
  const up = []; for (const q of [...p].reverse()) { while (up.length >= 2 && cr(up.at(-2), up.at(-1), q) <= 0) up.pop(); up.push(q); }
  return [...lo.slice(0, -1), ...up.slice(0, -1)];
};
/** A piece's footprint (round pieces as an octagon), in squares. */
function footprint(p, def, data) {
  const traced = propOutline(p.prop); // the drawing's real outline, when it has one
  if (traced) {
    const a = (normRot(p.rot) * Math.PI) / 180; const cos = Math.cos(a); const sin = Math.sin(a);
    const { w, h } = def.size;
    return traced.map(([u, v]) => { const dx = (u - 0.5) * w; const dy = (v - 0.5) * h; return { x: p.x + dx * cos - dy * sin, y: p.y + dx * sin + dy * cos }; });
  }
  const c = propCorners(p, data);
  if (!def.round) return c;
  const r = Math.min(def.size.w, def.size.h) / 2;
  return Array.from({ length: 8 }, (_, i) => ({ x: p.x + r * Math.cos((i * Math.PI) / 4), y: p.y + r * Math.sin((i * Math.PI) / 4) }));
}
/** The shadow a footprint of height h casts from a light at L, H metres up, reaching R: a flat [x, y…] polygon. */
function castShadow(L, H, feet, h, R) {
  const far = h >= H * 0.95;
  const away = feet.map((c) => {
    const dx = c.x - L.x; const dy = c.y - L.y; const d = Math.hypot(dx, dy) || 1e-6;
    const len = far ? R * 2 : Math.min(R * 2, d * (H / (H - h)) - d); // how far past the piece the shadow runs
    return { x: c.x + (dx / d) * len, y: c.y + (dy / d) * len };
  });
  return hull([...feet, ...away]).flatMap((q) => [q.x, q.y]);
}

/** Decision 360–361: a beam's wedge (origin, facing°, angle°, reach) as a flat polygon, a little longer than the reach. */
function coneOf(o, facing, angle, R) {
  const half = ((angle / 2) * Math.PI) / 180; const a0 = (facing * Math.PI) / 180;
  const pts = [o.x, o.y];
  for (let k = 0; k <= 12; k++) { const a = a0 - half + (2 * half * k) / 12; pts.push(o.x + Math.cos(a) * R * 1.05, o.y + Math.sin(a) * R * 1.05); }
  return pts;
}

/** Is the light layer what this map draws with? (a map can keep the classic look) */
export const drawsShapes = (map, data) => lightingOf(map, data).look === 'shapes';

/**
 * One per viewer. draw(map, { fog, tokens, colors }) → { under, over } SVG markup: `under` goes beneath the GM's
 * fog marks (light and darkness), `over` above them (the players' fog). colors: { unseen, shade } from the map palette.
 */
export function createLightLayer(data) {
  const U = data.map.square.units;
  const cv = {};
  const canvas = (name, w, h, P) => {
    const c = cv[name] ?? (cv[name] = document.createElement('canvas'));
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    const ctx = c.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, w, h);
    ctx.setTransform(P, 0, 0, P, 0, 0);
    return ctx;
  };
  let lampMemo = { key: '', lamps: [] };
  const sheetKeys = {}; // decision 359: which map state each fixed-lamp sheet was painted for
  let out = { key: '', value: { under: '', over: '' } };

  /** The lamps that are on, each with its light's outline (worked out once per map state: lamps don't move). */
  /** Decision 359: the shadows of the pieces a light reaches, and their footprints (their tops stay lit). */
  function withShadows(L, casters) {
    const near = casters.filter(({ p, def }) => p.id !== L.id && Math.hypot(p.x - L.x, p.y - L.y) <= L.R + Math.max(def.size.w, def.size.h));
    L.feet = near.map(({ p, def }) => footprint(p, def, data));
    L.shadows = near.map(({ def }, i) => castShadow(L, L.H, L.feet[i], SHADE_M[def.shade], L.R));
    return L;
  }
  function lampsOf(map, T) {
    const key = JSON.stringify([map.cols, map.rows, map.walls, map.props, map.floors ?? null, T.reach, propsLoaded()]);
    if (lampMemo.key === key) return lampMemo.lamps;
    const segs = sightSegments(map, data).filter((s) => s.kind !== 'prop'); // decision 359: walls stop light; pieces cast their own shadows
    const casters = activeProps(map).map((p) => ({ p, def: propDef(data, p.prop) })).filter(({ def }) => SHADE_M[def?.shade]);
    const lamps = activeProps(map).flatMap((p) => {
      const def = propDef(data, p.prop);
      const r = p.on === false ? 0 : def?.light?.radius ?? 0;
      if (!r) return [];
      const own = new Set(propEdges(p, data).map(segKey)); // a lamp doesn't shade itself
      const beam = def.light.beam ?? null; // decision 361: screens and wall signs light the way they face
      const R = ((beam ? beam.range : r) + 0.5) * T.reach * (p.lightReach ?? 1); // decision 358: a lamp may glow further or less (display only)
      return [withShadows({ x: p.x, y: p.y, R, H: def.light.height ?? 2.6, id: p.id, color: lightColor(def, data, p), corners: propCorners(p, data), weak: def.light.strength ?? 1,
        ...(beam ? { cone: coneOf({ x: p.x, y: p.y }, (90 + normRot(p.rot)) % 360, beam.angle, R) } : {}),
        shape: visPolygon(p, own.size ? segs.filter((s) => !own.has(segKey(s))) : segs, { cols: map.cols, rows: map.rows, radius: R }) }, casters)];
    });
    lampMemo = { key, lamps };
    return lamps;
  }

  function draw(map, { fog = null, tokens = [], colors }) {
    const T = lightingOf(map, data);
    const player = fog?.mode === 'player' && !fog.all;
    const eyes = player ? tokens.filter((t) => t.kind === 'player') : [];
    const key = JSON.stringify([map.cols, map.rows, map.walls, map.props, map.ambient, map.lighting ?? null, map.floors ?? null,
      fog && [fog.mode, fog.all, fog.seen?.length, fog.visible, fog.light], eyes.map((e) => [e.x, e.y]), colors,
      tokens.filter((t) => t.torch || t.vision?.torch).map((t) => [t.x, t.y, t.torch ?? t.vision.torch, t.torchColor ?? t.vision?.torchColor, t.facing ?? 0])]);
    if (out.key === key) return out.value;
    const { cols, rows } = map;
    const P = Math.max(4, Math.min(12, Math.floor(Math.sqrt(900000 / (cols * rows))))); // pixels per square: soft, small
    const w = cols * P;
    const h = rows * P;
    // decision 358: a lit torch is a lamp that walks; 360: with a beam, a cone where its carrier faces plus a small spill round them
    const casters = () => activeProps(map).map((p) => ({ p, def: propDef(data, p.prop) })).filter(({ def }) => SHADE_M[def?.shade]);
    const wallsOnly = () => sightSegments(map, data).filter((s) => s.kind !== 'prop');
    const torches = tokens.map((t) => ({ t, r: t.torch ?? t.vision?.torch ?? 0, c: t.torchColor ?? t.vision?.torchColor, beam: t.beam ?? t.vision?.beam ?? null, facing: t.facing ?? 0 })).filter((x) => x.r > 0)
      .flatMap(({ t, r, c, beam, facing }) => {
        const o = { x: t.x + 0.5, y: t.y + 0.5 };
        const color = data.map.light.colors[c] ?? data.map.light.colors.cold;
        const lamp = (R, extra = {}) => withShadows({ ...o, R, H: 1.5, id: null, color, corners: [], shape: visPolygon(o, wallsOnly(), { cols: map.cols, rows: map.rows, radius: R }), ...extra }, casters());
        if (!beam) return [lamp((r + 0.5) * T.reach)];
        const R = (beam.range + 0.5) * T.reach;
        const cone = coneOf(o, facing, beam.angle, R);
        return [lamp(R, { cone }), lamp((beam.spill + 0.7) * T.reach, { weak: 0.55 })];
      });
    const fixed = lampsOf(map, T);
    const lamps = [...fixed, ...torches];
    const light = fog?.light ?? null;
    const dark = fog ? (light ? (light.allDark ? 'all' : new Set(light.dark ?? [])) : new Set()) : darkSquares(map, data);
    const anyDark = dark === 'all' || dark.size > 0;
    const paintGlow = (ctx, L, color, a, clip) => {
      ctx.save();
      ctx.clip(poly(L.shape));
      if (L.cone) ctx.clip(poly(L.cone)); // decision 360: a torch's beam
      if (clip) ctx.clip(clip);
      a *= L.weak ?? 1; // the spill round a torch is dimmer than its beam
      const g = ctx.createRadialGradient(L.x, L.y, 0, L.x, L.y, L.R);
      g.addColorStop(0, rgba(color, a)); g.addColorStop(T.core, rgba(color, a * 0.8)); g.addColorStop(1, rgba(color, 0));
      ctx.fillStyle = g;
      ctx.fillRect(L.x - L.R, L.y - L.R, L.R * 2, L.R * 2);
      ctx.restore();
    };
    // decision 359: each light on its own sheet — its glow, minus the soft shadows of the pieces it reaches (their tops
    // stay lit) — then added to the others, so a piece between two lamps throws two shadows
    const glow = (ctx, L, color, a) => {
      if (!L.shadows?.length) { paintGlow(ctx, L, color, a); return; }
      const one = canvas('oneLamp', w, h, P);
      paintGlow(one, L, color, a);
      one.globalCompositeOperation = 'destination-out';
      one.globalAlpha = 0.85; // a little light bounces in
      paste(one, soft('oneShadow', (c) => { for (const sh of L.shadows) c.fill(poly(sh)); }));
      one.globalAlpha = 1;
      one.globalCompositeOperation = 'source-over';
      const tops = new Path2D(); for (const f of L.feet) tops.addPath(poly(f.flatMap((q) => [q.x, q.y])));
      if (T.tops) paintGlow(one, L, color, a, tops); // owner 2026-11-20: off by default — the lit tops glowed round every piece
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(cv.oneLamp, 0, 0); ctx.restore();
    };
    // owner 2026-11-19 (options 1 + 2): square-shaped masks are painted small (S px a square) and smoothed when laid
    // over the map, so their edges feather by about a third of a square instead of stepping like tiles
    const S = 3;
    const soft = (name, fill, s = S) => { const ctx = canvas(name, cols * s, rows * s, s); ctx.fillStyle = '#ffffff'; fill(ctx); return cv[name]; }; // s px a square: 3 ≈ a third of a square of feather, 2 ≈ half
    const paste = (ctx, src) => { ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(src, 0, 0, cols, rows); ctx.restore(); };
    /** The squares and every square touching them: the sight shape, not the grid, draws the edge of what is seen. */
    // …never into a square the dark hides (dark and unlit): darkness keeps its meaning
    const litSet = new Set(light?.lit ?? []);
    const hidden = (k) => (dark === 'all' || dark.has(k)) && !litSet.has(k);
    const cut = wallCut(map); // a wall between two squares: the slack stops there (the walls round what was seen are known)
    const grow = (list) => { const out = new Set(list); for (const k of list) { const [x, y] = k.split(',').map(Number); for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) { const n = `${x + dx},${y + dy}`; if (!hidden(n) && !cut(x, y, x + dx, y + dy)) out.add(n); } } return [...out]; };
    /** The fixed lamps' light, shadows and all, painted once per map state and levels (lamps don't move). */
    const fixedSheet = (name, color, a) => {
      const k = JSON.stringify([lampMemo.key, w, h, T.core, T.tops, a, name]);
      if (sheetKeys[name] !== k) {
        const c = canvas(name, w, h, P);
        c.globalCompositeOperation = 'lighter';
        for (const L of fixed) glow(c, L, color ?? L.color, a);
        sheetKeys[name] = k;
      }
      return cv[name];
    };
    const addSheet = (ctx, src) => { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(src, 0, 0); ctx.restore(); };
    // owner 2026-11-21: a players' map carries only the walls they have seen, so a light worked out here could shine
    // through a wall they don't know yet. There, light is drawn only where the rules (the GM's console, every wall) say
    // it falls — lit squares in the dark, any square where it isn't dark — with the usual soft edge.
    const allowed = (() => {
      if (!player || !light) return null;
      const litSet = new Set(light.lit ?? []);
      const darkSet = light.allDark ? null : new Set(light.dark ?? []);
      const out = [];
      for (let x = 0; x < cols; x++) for (let y = 0; y < rows; y++) { const k = `${x},${y}`; if (litSet.has(k) || (darkSet && !darkSet.has(k))) out.push(k); }
      return out;
    })();
    const clipToRules = (ctx) => {
      if (!allowed) return;
      ctx.save(); ctx.globalCompositeOperation = 'destination-in';
      paste(ctx, soft('allowSoft', (c) => c.fill(squares(allowed))));
      ctx.restore();
    };
    const pieces = (ctx) => { for (const L of lamps) if (L.corners.length) ctx.fill(poly(L.corners.flatMap((c) => [c.x, c.y]))); };
    const img = (c, cls) => `<image class="map-light ${cls}" href="${c.toDataURL()}" x="0" y="0" width="${cols * U}" height="${rows * U}" preserveAspectRatio="none"/>`;
    let under = '';
    let over = '';

    // the lamps' colour, blended into the map; the lamp pieces themselves keep their own drawing
    if (lamps.length) {
      const col = canvas('color', w, h, P);
      col.globalCompositeOperation = 'lighter';
      addSheet(col, fixedSheet('colorFixed', null, T.bright));
      for (const L of torches) glow(col, L, L.color, T.bright);
      clipToRules(col);
      col.globalCompositeOperation = 'destination-out';
      pieces(col);
      under += img(cv.color, `map-light--tint map-light--${T.blend}`);
    }
    // darkness where it is dark, pushed back by the light (the lamps, plus every square the rules call lit: torches, flares)
    const shade = canvas('shade', w, h, P);
    const dim = T.dim ?? 0; // owner 2026-11-20: a bright map can still look like night lighting — mood only, the rules stay bright
    if (anyDark || dim > 0) {
      const lit = canvas('lit', w, h, P);
      lit.globalCompositeOperation = 'lighter';
      addSheet(lit, fixedSheet('litFixed', '#ffffff', 1));
      for (const L of torches) glow(lit, L, '#ffffff', 1);
      clipToRules(lit);
      // the squares the rules call lit stand in for lamps a player hasn't seen yet; on the GM's map every lamp is drawn
      if (player && light?.lit?.length) { lit.globalAlpha = 0.35; paste(lit, soft('litSoft', (c) => c.fill(squares(light.lit)))); lit.globalAlpha = 1; }
      shade.fillStyle = rgba(colors.shade, T.dark);
      if (dark === 'all') shade.fillRect(0, 0, cols, rows);
      else if (!anyDark) { shade.fillStyle = rgba(colors.shade, dim); shade.fillRect(0, 0, cols, rows); }
      else { paste(shade, soft('darkSoft', (c) => c.fill(squares([...dark])))); shade.globalCompositeOperation = 'source-in'; shade.fillRect(0, 0, cols, rows); if (dim > 0) { shade.globalCompositeOperation = 'destination-over'; shade.fillStyle = rgba(colors.shade, dim); shade.fillRect(0, 0, cols, rows); } shade.globalCompositeOperation = 'source-over'; } // darkness zones, feathered
      shade.setTransform(1, 0, 0, 1, 0, 0);
      shade.globalAlpha = T.lift;
      shade.globalCompositeOperation = 'destination-out';
      shade.drawImage(cv.lit, 0, 0);
      shade.globalAlpha = 1;
      shade.setTransform(P, 0, 0, P, 0, 0);
      pieces(shade);
      shade.globalCompositeOperation = 'source-over';
    }
    // every lamp outlined in its colour, so the sources read at a glance
    shade.lineJoin = 'round';
    for (const L of lamps) {
      if (!L.corners.length) continue;
      const p = poly(L.corners.flatMap((c) => [c.x, c.y]));
      shade.lineWidth = 0.12; shade.strokeStyle = 'rgba(0,0,0,0.7)'; shade.stroke(p);
      shade.lineWidth = 0.05; shade.strokeStyle = L.color; shade.stroke(p);
    }
    if (anyDark || dim > 0 || lamps.length) under += img(cv.shade, 'map-light--shade');

    // the players' fog: what was seen stays faint, what the crew sees now is open — cut to the true sight lines
    if (player) {
      const segs = sightSegments(map, data);
      const fogc = canvas('fog', w, h, P);
      fogc.fillStyle = rgba(colors.unseen, 1); // unseen is unseen: nothing shows through
      fogc.fillRect(0, 0, cols, rows);
      fogc.globalCompositeOperation = 'destination-out';
      if (fog.seen?.length) { fogc.globalAlpha = T.mem; paste(fogc, soft('seenSoft', (c) => c.fill(squares(fog.seen)))); } // remembered, feathered
      fogc.globalAlpha = 1;
      // seen now: each eye's true sight shape, kept within one square of what the rules show (walls, pieces and people
      // still arrive only for the rules' squares; at most a band of floor shows past them)
      const near = squares(eyes.length ? grow(fog.visible ?? []) : fog.visible ?? []);
      const shapes = eyes.map((e) => poly(visPolygon({ x: e.x + 0.5, y: e.y + 0.5 }, segs, { cols, rows })));
      paste(fogc, soft('nowSoft', (c) => {
        for (const sh of shapes) { c.save(); c.clip(sh); c.fill(near); c.restore(); }
        if (!eyes.length) c.fill(near);
      }, 2));
      // owner 2026-11-19: in sight but too dark to make out is darkness, not the unknown — a deep shade the lamps'
      // glow fades into, instead of black tiles (nothing in those squares is sent: a guard there stays hidden)
      if (anyDark && shapes.length) {
        // owner 2026-11-21: only the band right next to what the crew sees — a sheet knows only the walls it has seen, so a
        // sight shape reaches through walls it doesn't know: anything wider would show rooms nobody has looked into
        const ring = new Set(); for (const k of fog.visible ?? []) { const [x, y] = k.split(',').map(Number); for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if (!cut(x, y, x + dx, y + dy)) ring.add(`${x + dx},${y + dy}`); }
        const darkInSight = [...ring].filter((k) => hidden(k));
        fogc.globalAlpha = 0.22;
        paste(fogc, soft('duskSoft', (c) => { const sq = squares(darkInSight); for (const sh of shapes) { c.save(); c.clip(sh); c.fill(sq); c.restore(); } }, 2));
        // …and lit as the lamps really fall off: the glow, not the square, says how much of that dark floor shows
        fogc.save();
        const union = new Path2D();
        for (const sh of shapes) union.addPath(sh);
        fogc.clip(union);
        fogc.clip(squares(darkInSight)); // owner 2026-11-21: the same band only — never rooms nobody has looked into
        fogc.setTransform(1, 0, 0, 1, 0, 0);
        fogc.globalAlpha = 0.55;
        fogc.drawImage(cv.lit, 0, 0);
        fogc.restore();
        fogc.globalAlpha = 1;
      }
      over += img(cv.fog, 'map-light--fog');
    }
    out = { key, value: { under, over } };
    return out.value;
  }

  return { draw };
}
