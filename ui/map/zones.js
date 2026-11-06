// Drawing of the GM's event zones (decision 83): a tinted, dashed rectangle per zone with its tag (IN, T2, OUT, N)
// and label in the top-left corner. GM screens only (the builder and the Deploy tab); players never get zones —
// except hazards that are on and shown (decision 258).

import { escape } from '../dom.js';
import { zoneTag, hazardOf } from '../../rules/zones.js';

/**
 * Decision 258: hazard areas — a tinted block per zone, coloured by nature, its icon and name in the corner. Players
 * get the ones on and shown (`hazards` on their map); GM screens draw every hazard zone this way (off ones faded,
 * hidden ones dashed) with its tag.
 */
export function hazardsSvg(hazards, data, { gm = false, selected = null } = {}) {
  const U = data.map.square.units;
  return (hazards ?? []).map((z) => {
    const h = hazardOf(data, z.nature);
    const text = `${gm ? `${zoneTag(z, data)} · ` : ''}${h.icon} ${gm && z.label ? z.label : h.name}`;
    const state = gm ? `${z.on ? '' : ' map-hazard--off'}${z.shown ? '' : ' map-hazard--hidden'}${z.id === selected ? ' map-zone--selected' : ''}` : '';
    return `<g class="map-hazard map-hazard--${escape(h.id)}${state}">`
      + `<rect class="map-hazard__area" x="${z.x * U + 2}" y="${z.y * U + 2}" width="${z.w * U - 4}" height="${z.h * U - 4}" rx="${U * 0.06}" stroke-width="${U * 0.035}"${gm && !z.shown ? ` stroke-dasharray="${U * 0.16} ${U * 0.08}"` : ''}/>`
      + `<text class="map-hazard__tag" x="${z.x * U + U * 0.12}" y="${z.y * U + U * 0.36}" font-size="${U * 0.28}">${escape(text)}</text></g>`;
  }).join('');
}

export function zonesSvg(zones, data, { selected = null } = {}) {
  const U = data.map.square.units;
  return (zones ?? []).map((z) => {
    if (z.type === 'hazard') return hazardsSvg([z], data, { gm: true, selected }); // decision 258
    const tag = zoneTag(z, data);
    const text = z.label ? `${tag} · ${z.label}` : tag;
    return `<g class="map-zone map-zone--${escape(z.type)}${z.id === selected ? ' map-zone--selected' : ''}">`
      + `<rect class="map-zone__area" x="${z.x * U + 4}" y="${z.y * U + 4}" width="${z.w * U - 8}" height="${z.h * U - 8}" rx="${U * 0.08}" stroke-width="${U * 0.04}" stroke-dasharray="${U * 0.16} ${U * 0.08}"/>`
      + `<text class="map-zone__tag" x="${z.x * U + U * 0.14}" y="${z.y * U + U * 0.38}" font-size="${U * 0.32}">${escape(text)}</text></g>`;
  }).join('');
}
