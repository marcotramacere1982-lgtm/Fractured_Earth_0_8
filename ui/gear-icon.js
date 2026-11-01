// Inventory icons (decision 222): a silhouette for each piece of gear — by its own `icon`, else weapons by type
// (experimental ammo first), magazines by calibre, armor by type, lifestyle by category, the rest by kind. The
// mapping is data (data/gear-icons.json); the drawings are one sprite (images/gear-icons.svg, game-icons.net,
// CC BY 3.0), used through <use> so the theme colours them like text. Decorative: the name beside it speaks.

import { html } from './dom.js';

const SPRITE = new URL('../images/gear-icons.svg', import.meta.url).href;

/** The icon id for a catalogue record of this kind ('weapon', 'ammo', 'armor', 'item', 'lifestyle', …), or null. */
export function gearIconId(kind, entry, data) {
  if (!entry) return null;
  if (entry.icon) return entry.icon;
  const m = data.gearIcons;
  if (kind === 'weapon') return (m.experimentalAmmo.includes(entry.ammo) ? m.experimentalByType[entry.type] ?? 'experimental' : m.weapons[entry.type]) ?? m.kinds.weapon;
  if (kind === 'ammo') return m.ammo[entry.ammo] ?? m.kinds.ammo;
  if (kind === 'armor') return m.armor[entry.type] ?? m.kinds.armor;
  if (kind === 'lifestyle') return m.lifestyle[entry.category] ?? m.kinds.lifestyle;
  if (m.types[kind]?.[entry.type]) return m.types[kind][entry.type]; // mods by what they are (decision 223)
  return m.kinds[kind] ?? m.kinds.item;
}

/** An icon by id: <svg class="gi …"> drawing the sprite's symbol. */
export const gearIcon = (id, cls = '', title = '') => (id
  ? html`<svg class="gi ${cls}" ${title ? html`role="img" aria-label="${title}"` : html`aria-hidden="true"`} focusable="false">${title ? html`<title>${title}</title>` : ''}<use href="${SPRITE}#gi-${id}"></use></svg>`
  : '');

/** Every icon id, for a picker (the Forge, a misc item). */
export const allGearIcons = (data) => Object.keys(data.gearIcons.sources);

/** The icon of a catalogue record. */
export const iconFor = (kind, entry, data, cls = '', title = '') => gearIcon(gearIconId(kind, entry, data), cls, title);
