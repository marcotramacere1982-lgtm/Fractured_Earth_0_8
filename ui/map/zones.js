// Drawing of the GM's event zones (decision 83): a tinted, dashed rectangle per zone with its tag (IN, T2, OUT, N)
// and label in the top-left corner. GM screens only (the builder and the Deploy tab); players never get zones.

import { escape } from '../dom.js';
import { zoneTag } from '../../rules/zones.js';

export function zonesSvg(zones, data, { selected = null } = {}) {
  const U = data.map.square.units;
  return (zones ?? []).map((z) => {
    const tag = zoneTag(z, data);
    const text = z.label ? `${tag} · ${z.label}` : tag;
    return `<g class="map-zone map-zone--${escape(z.type)}${z.id === selected ? ' map-zone--selected' : ''}">`
      + `<rect class="map-zone__area" x="${z.x * U + 4}" y="${z.y * U + 4}" width="${z.w * U - 8}" height="${z.h * U - 8}" rx="${U * 0.08}" stroke-width="${U * 0.04}" stroke-dasharray="${U * 0.16} ${U * 0.08}"/>`
      + `<text class="map-zone__tag" x="${z.x * U + U * 0.14}" y="${z.y * U + U * 0.38}" font-size="${U * 0.32}">${escape(text)}</text></g>`;
  }).join('');
}
