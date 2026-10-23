// Builder layers (decision 126): every wall, piece and zone of a map belongs to one layer, and the GM can show,
// dim (drawn faded, not clickable) or hide each layer to declutter the drawing. Only how the builder shows the map:
// nothing is removed, the table never sees it. The first step towards checking wiring (Lights & power on its own).

import { GROUND, sensesOf } from './props.js';

export const LAYERS = [
  { id: 'floors', name: 'Floors' },
  { id: 'walls', name: 'Walls & openings' },
  { id: 'pieces', name: 'Pieces' },
  { id: 'power', name: 'Lights & power' },
  { id: 'sensors', name: 'Sensors & lasers' },
  { id: 'network', name: 'Network' },
  { id: 'links', name: 'Links' },
  { id: 'zones', name: 'Zones' },
];
export const LAYER_STATES = ['show', 'dim', 'hide'];

/** A piece's layer, from its library record. */
export function propLayer(def) {
  if (!def) return 'pieces';
  if (['uplink', 'router', 'ap', 'repeater'].includes(def.net)) return 'network'; // decision 129
  if (sensesOf(def).length || def.category === 'sensor' || def.category === 'security') return 'sensors';
  if (def.light || def.category === 'light' || def.circuit) return 'power'; // decision 136: powered desks and machines stay with the pieces
  if (def.category === 'zone') return 'zones'; // darkness tiles and the like
  if (GROUND.has(def.category)) return 'floors'; // floors, terrain, outlines, city tiles
  return 'pieces';
}

/** A wall's layer: lasers with the sensors, links on their own, the rest are walls and openings. */
export const wallLayer = (w) => (w.kind === 'laser' ? 'sensors' : w.kind.startsWith('link_') ? 'links' : 'walls');

const stateOf = (layers, id) => (LAYER_STATES.includes(layers?.[id]) ? layers[id] : 'show');

/**
 * The part of a map in one state ('show' | 'dim' | 'hide'): the same map with only the walls, pieces and zones whose
 * layer is in that state. Builders draw 'show' and 'dim', and pick only from 'show'.
 */
export function layerView(map, data, layers, state = 'show') {
  const defOf = (p) => data.props.props.find((d) => d.id === p.prop);
  return {
    ...map,
    walls: (map.walls ?? []).filter((w) => stateOf(layers, wallLayer(w)) === state),
    props: (map.props ?? []).filter((p) => stateOf(layers, propLayer(defOf(p))) === state),
    zones: stateOf(layers, 'zones') === state ? map.zones ?? [] : [],
  };
}

/** How many of each layer the map has (shown beside each row). */
export function layerCounts(map, data) {
  const out = Object.fromEntries(LAYERS.map((l) => [l.id, 0]));
  for (const w of map.walls ?? []) out[wallLayer(w)]++;
  for (const p of map.props ?? []) out[propLayer(data.props.props.find((d) => d.id === p.prop))]++;
  out.zones += (map.zones ?? []).length;
  return out;
}

/** True when every layer is shown. */
export const allShown = (layers) => LAYERS.every((l) => stateOf(layers, l.id) === 'show');
