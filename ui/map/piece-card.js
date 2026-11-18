// Decision 340: what a map piece is, read-only — the card players get when they tap a piece (name, kind, what it does
// physically, open / on, or what the crew knows about a district), for the TV. Built from the public map only: hidden
// pieces never reach it, and nothing here is the GM's.

import { html } from '../dom.js';
import { t } from '../../i18n/index.js';
import { interactKind } from '../../rules/interact.js';
import { districtTitle, districtBody } from './district-card.js';

/** map: the public map; id: a prop's id. null when the piece isn't on the public map (hidden, or another map). */
export function pieceCard(map, data, id) {
  const p = (map?.props ?? []).find((x) => x.id === id);
  const d = p && data.props.props.find((x) => x.id === p.prop);
  if (!d) return null;
  const dist = map.districts?.[p.id];
  if (dist) return { title: `🏙 ${districtTitle(dist)}`, body: html`${dist.name ? html`<p class="muted">${dist.kind}</p>` : ''}${districtBody(dist, data)}` };
  const kind = interactKind(d, p);
  const state = kind === 'open' ? t(p.open ? 'map.door.isOpen' : 'map.door.isClosed') : kind === 'toggle' || kind === 'light' ? t(p.on !== false ? 'map.device.isOn' : 'map.device.isOff') : '';
  const traits = [d.shell ? t('map.info.shell') : null, d.blocksMove ? t('map.info.blocksMove') : d.difficult ? t('map.info.difficult') : null, d.blocksSight ? t('map.info.blocksSight') : null,
    d.cover !== 'none' ? t(`map.cover.${d.cover}`) : null].filter(Boolean);
  return {
    title: p.caption || d.name,
    body: html`<div class="cluster"><span class="pill">${t(`map.group.${d.category}`)}</span>${state ? html`<span class="pill">${state}</span>` : ''}</div>
      ${p.caption ? html`<p class="muted">${d.name}</p>` : ''}<p>${traits.length ? traits.join(' · ') : t('map.info.nothing')}</p>`,
  };
}
