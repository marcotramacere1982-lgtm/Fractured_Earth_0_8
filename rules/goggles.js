// Decision 369: goggles are personal (step 4 of the stealth plan). The shared map is what plain eyes see; each wearer
// gets their own layer — night vision (unlit squares it reaches, and who stands there), thermal (heat through dark
// and smoke, stopped by glass: people and running lights hot, sensors and fresh bodies warm, fire and steam hot) and a
// motion tracker (blips through walls for whatever moved lately, give or take a square). Tac-Mesh AR wearers share
// each other's layers. Pure.

import { sightSegments, sightHits, onBoard } from './map.js';
import { darkSquares, litSquares, torchesOf } from './light.js';
import { activeProps, propDef, sensesOf, squaresUnder } from './props.js';
import { hazardsAt } from './zones.js';
import { eyesOf } from './fog.js';

const k = (x, y) => `${x},${y}`;
const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

/** A people list with goggles taken off (night vision, thermal, motion): the eyes the shared map is made from. */
export const plainPeople = (people) => people.map((p) => (p.vision && (p.vision.dark || p.vision.thermal || p.vision.motion)
  ? { ...p, vision: { ...p.vision, dark: 0, thermal: 0, motion: 0 } } : p));

/** Has this person anything for a layer (goggles on, a tracker, or a mesh to share through)? */
export const hasLayer = (p) => Boolean(p?.vision && (p.vision.dark || p.vision.thermal || p.vision.motion || p.vision.mesh));

/** Who feeds this player's layer: themselves, and every other Tac-Mesh wearer on the map if they wear one too. */
export function feedsOf(people, key, tokens) {
  const me = people.find((p) => p.key === key);
  if (!me) return [];
  if (!me.vision?.mesh) return [me];
  return people.filter((p) => p.kind === 'player' && tokens[p.key] && (p.key === key || p.vision?.mesh));
}

/** A small, steady offset (−1, 0, +1 each way) for a blip, so it doesn't jump at every update. */
function fuzz(key, t) {
  let h = 0;
  for (const c of `${key}:${t}`) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return { dx: (h % 3) - 1, dy: (Math.floor(h / 3) % 3) - 1 };
}

/** Decision 371: squares a torch beam or a flare lights (the glare that washes night vision out). people: for the torches. */
export function glareSquares(live, people, data, segs = sightSegments(live.map, data)) {
  const flares = new Set(data.awareness.goggles.glare.props);
  const only = { ...live.map, props: (live.map.props ?? []).filter((p) => flares.has(p.prop)) };
  return litSquares(only, data, segs, torchesOf(eyesOf(live, people)));
}

/**
 * One player's layer. live: { map (working), tokens }; people: [{ key, kind, vision }]; visible: Set of "x,y" the
 * shared map shows now; tokens: the public tokens (publicMap) to show on night squares; now / since: the motion window.
 * @returns { night: [[x, y]], heat: [{ x, y, hot }], blips: [[x, y]], tokens: [public token], blind: their own night vision is in a glare }
 */
export function layerFor(live, people, data, key, { visible = new Set(), tokens = [], now = Date.now(), since = null } = {}) {
  const g = data.awareness.goggles;
  const map = live.map;
  const feeds = feedsOf(people, key, live.tokens);
  const crew = new Set(people.filter((p) => p.kind === 'player').map((p) => p.key));
  const segs = sightSegments(map, data);
  const clear = (a, b, s = segs) => { const [l, r] = sightHits({ x: a.x + 0.5, y: a.y + 0.5 }, { x: b.x + 0.5, y: b.y + 0.5 }, s); return !(l && r); };
  const night = new Set();
  const heat = new Map();
  const blips = new Map();
  const dark = darkSquares(map, data);
  const lit = dark === 'all' || dark.size ? litSquares(map, data, segs, torchesOf([])) : null;
  const isDark = (x, y) => (dark === 'all' || dark.has(k(x, y))) && !lit?.has(k(x, y));
  const glass = new Set(g.thermalBlockers);
  const thermalSegs = [...segs, ...map.walls.filter((w) => glass.has(w.kind) && !w.broken).map((w) => ({ a: w.a, b: w.b, kind: w.kind }))];
  const box = (e, r, fn) => { for (let x = e.x - r; x <= e.x + r; x++) for (let y = e.y - r; y <= e.y + r; y++) if (onBoard(map, { x, y })) fn(x, y); };
  // warm and hot things that aren't people: running lights, sensors, fresh bodies (by square)
  const things = new Map();
  for (const p of activeProps(map)) {
    const def = propDef(data, p.prop);
    if (!def) continue;
    const hot = g.hot.lights && def.light && p.on !== false;
    const warm = (g.warm.sensors && sensesOf(def).length && p.on !== false) || g.warm.props.includes(p.prop);
    if (!hot && !warm) continue;
    for (const s of squaresUnder(p, data)) if (!things.has(k(s.x, s.y)) || hot) things.set(k(s.x, s.y), hot ? 'hot' : 'warm');
  }
  const others = Object.entries(live.tokens).filter(([kk]) => !crew.has(kk));
  const glare = feeds.some((f) => f.vision?.dark) ? glareSquares(live, people, data, segs) : new Set(); // decision 371
  let blind = false;
  for (const f of feeds) {
    const e = live.tokens[f.key];
    const v = f.vision ?? {};
    if (!e) continue;
    const glared = v.dark && glare.has(k(e.x, e.y));
    if (glared && f.key === key) blind = true;
    if (v.dark && !glared) box(e, v.dark, (x, y) => { if (!visible.has(k(x, y)) && isDark(x, y) && clear(e, { x, y })) night.add(k(x, y)); });
    if (v.thermal) {
      box(e, v.thermal, (x, y) => {
        const person = g.hot.people && others.some(([, t]) => t.x === x && t.y === y);
        const thing = things.get(k(x, y));
        const fire = hazardsAt(map, { x, y }).some((z) => g.hot.hazards.includes(z.nature));
        if (!person && !thing && !fire) return;
        if (!clear(e, { x, y }, thermalSegs)) return;
        heat.set(k(x, y), { x, y, hot: Boolean(person || fire || thing === 'hot') });
      });
    }
    if (v.motion) {
      const from = since ?? now - g.motionWindowMs;
      for (const [kk, t] of others) {
        if (!t.movedAt || t.movedAt < from || cheb(e, t) > v.motion) continue;
        const o = fuzz(kk, t.movedAt);
        const b = { x: Math.min(map.cols - 1, Math.max(0, t.x + o.dx)), y: Math.min(map.rows - 1, Math.max(0, t.y + o.dy)) };
        blips.set(k(b.x, b.y), [b.x, b.y]);
      }
    }
  }
  const nightTokens = tokens.filter((t) => t.kind !== 'player' && night.has(k(t.x, t.y)));
  return { night: [...night].map((s) => s.split(',').map(Number)), heat: [...heat.values()], blips: [...blips.values()], tokens: nightTokens, ...(blind ? { blind: true } : {}) };
}
