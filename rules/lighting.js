// Decision 357: how a map draws light and sight — display only. The defaults live in data.map.light.lighting;
// a map may keep its own levels (map.lighting), set in the Maps tab. Pure.

const LOOKS = ['shapes', 'squares'];
const BLENDS = ['screen', 'soft-light'];
/** Each level: [min, max]. */
export const LIGHTING_RANGES = { dim: [0, 0.9], dark: [0, 0.95], bright: [0, 1], lift: [0, 1], reach: [0.5, 2], core: [0.05, 0.9], mem: [0, 1] };

/** A map's own lighting, cleaned: known looks and blends, levels inside their ranges, two decimals. {} when nothing. */
export function normalizeLighting(raw) {
  if (!raw || typeof raw !== 'object') return {};
  const out = {};
  if (LOOKS.includes(raw.look)) out.look = raw.look;
  if (BLENDS.includes(raw.blend)) out.blend = raw.blend;
  if (typeof raw.paint === 'boolean') out.paint = raw.paint; // decision 358: pieces in their materials' colours
  if (typeof raw.tops === 'boolean') out.tops = raw.tops; // decision 359: pieces' tops re-lit above their shadows (a glow round each piece)
  for (const [k, [min, max]] of Object.entries(LIGHTING_RANGES)) {
    const n = Number(raw[k]);
    if (raw[k] != null && Number.isFinite(n)) out[k] = Math.round(Math.max(min, Math.min(max, n)) * 100) / 100;
  }
  return out;
}

/** What the map draws with: the defaults, then the map's own levels. */
export const lightingOf = (map, data) => ({ ...data.map.light.lighting, ...normalizeLighting(map?.lighting) });

/** The colour of a light's light (hex): the placed piece's own (decision 358), else its library colour, from the palette. */
export const lightColor = (def, data, p = null) => data.map.light.colors[p?.lightColor] ?? data.map.light.colors[def?.light?.color] ?? data.map.light.colors.cold;

/** Decision 358: a placed light's glow, × the map's reach (display only — the rules keep the radius). */
export const LIGHT_REACH = [0.5, 2];

/** Decision 358: the material a placed piece is drawn in — its own pick, else the library's; null: plain. */
export const materialOf = (p, def, data) => (data.map.light.materials.includes(p?.mat) ? p.mat : data.map.light.materials.includes(def?.material) ? def.material : null);

/** Decision 358: a placed piece's own look, cleaned — a known material, a light's colour and reach. */
export function pieceLook(q, def, data) {
  const out = {};
  if (data.map.light.materials.includes(q?.mat)) out.mat = q.mat;
  if (def?.light && data.map.light.colors[q?.lightColor]) out.lightColor = q.lightColor;
  const r = Number(q?.lightReach);
  if (def?.light && q?.lightReach != null && Number.isFinite(r)) out.lightReach = Math.round(Math.max(LIGHT_REACH[0], Math.min(LIGHT_REACH[1], r)) * 10) / 10;
  return out;
}
