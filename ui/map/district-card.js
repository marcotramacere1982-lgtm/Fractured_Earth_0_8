// Decision 301: what the crew knows about a district on a city map — tapped on the sheet's map. Only the fields the
// GM ticked ever reach the sheet (rules/districts.js → publicDistrict); this draws them.

import { html } from '../dom.js';
import { t } from '../../i18n/index.js';

const ROWS = [
  ['notice', 'district.status', (v, d) => d.notices.find((x) => x.id === v)?.name ?? v],
  ['response', 'district.response', (v, d) => `${v} · ${d.response.find((x) => x.n === v)?.name ?? ''}`],
  ['jurisdiction', 'district.jurisdiction', (v, d) => d.jurisdictions.find((x) => x.id === v)?.name ?? v],
  ['access', 'district.access', (v) => v], // decision 310
  ['curfew', 'district.curfew', (v) => v],
  ['checkpoints', 'district.checkpoints', (v, d) => `${v} · ${d.checkpoints.find((x) => x.n === v)?.name ?? ''}`],
  ['minCrs', 'district.minCrs', (v) => String(v)],
  ['residents', 'district.residents', (v) => v.join(', ')], // decision 304
  ['enemies', 'district.enemies', (v) => v.join(', ')],
];

/** The district's title: its name, "?" when it has one nobody told them, else the kind of district. */
export const districtTitle = (card) => (card.name ? card.name : card.name === null ? `? · ${card.kind}` : card.kind);

/** The known fields as a definition list (or a line saying nothing is known). */
export function districtBody(card, data) {
  const rows = ROWS.filter(([f]) => card[f] !== undefined);
  if (!rows.length) return html`<p class="muted st-small">${t('district.nothing')}</p>`;
  return html`<dl class="kv district-card">${rows.map(([f, key, fmt]) => html`<dt>${t(key)}</dt><dd>${fmt(card[f], data.districts)}</dd>`)}</dl>`;
}
