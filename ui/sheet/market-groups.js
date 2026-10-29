// Market lists grouped by what things are (weapon type, where armor is worn, what an item is for), each group
// sorted by price. Presentation only: the catalogs stay as they are. Groups with nothing in them don't show.

import { t } from '../../i18n/index.js';

const WEAPON = { knife: 'melee', blunt: 'melee', melee: 'melee', 'stun gun': 'melee', pistol: 'pistols', SMG: 'smgs', 'assault rifle': 'rifles', shotgun: 'rifles', 'sniper rifle': 'snipers' };
const WEAPON_ORDER = ['melee', 'pistols', 'smgs', 'rifles', 'snipers'];
const ARMOR = { helmet: 'head', vest: 'torso', jacket: 'torso', suit: 'body', sleeves: 'arms', bracers: 'arms', pants: 'legs', greaves: 'legs' };
const ARMOR_ORDER = ['head', 'torso', 'body', 'arms', 'legs'];
const TOOL_DOMAIN = {
  sleight_of_hand: 'breakin', electronics_security: 'breakin', computers_hacking: 'breakin', stealth: 'breakin',
  mechanics_fabrication: 'force', forensics_investigation: 'force', climb_physical: 'climbing', perception_awareness: 'seeing', medicine_first_aid: 'medical',
};
const ITEM_ORDER = ['medical', 'stims', 'combat', 'breakin', 'force', 'climbing', 'seeing', 'weapongear', 'story', 'other'];

/** What an item is for, from what it does (decisions 58–60). */
function itemGroup(e) {
  if (e.use) {
    const opts = e.use.options;
    if (opts.some((o) => o.table)) return 'combat';
    if (opts.some((o) => o.boost || o.endStims)) return 'stims';
    return 'medical';
  }
  if (e.drone) return 'seeing'; // a toy drone (decision 171)
  const tool = e.tool?.[0];
  if (tool) return tool.attack ? 'weapongear' : tool.attr ? 'force' : TOOL_DOMAIN[tool.skill] ?? 'other';
  return e.story ? 'story' : 'other';
}

/**
 * The list in groups: [{ key, label, items }], each sorted by price; groups in a sensible order
 * (or by their cheapest item). Short catalogs (decks, optics) come back as one group without a label.
 * fits(e): an ammo entry for a gun the character owns (its own group, first).
 */
export function marketGroups(kind, list, data, fits = () => false) {
  const byPrice = (a, b) => a.cost.cr - b.cost.cr;
  let keyOf; let order = null; let label;
  switch (kind) {
    case 'weapon': keyOf = (e) => WEAPON[e.type] ?? 'melee'; order = WEAPON_ORDER; label = (k) => t(`shop.group.${k}`); break;
    case 'armor': keyOf = (e) => ARMOR[e.type] ?? 'torso'; order = ARMOR_ORDER; label = (k) => t(`shop.group.${k}`); break;
    case 'item': keyOf = itemGroup; order = ITEM_ORDER; label = (k) => t(`shop.group.${k}`); break;
    case 'ammo': keyOf = (e) => (fits(e) ? ' yours' : e.ammo); label = (k) => (k === ' yours' ? t('shop.group.yours') : k); break;
    case 'deckMod': keyOf = (e) => e.type; label = (k) => data.deckMods.types?.find((x) => x.id === k)?.name ?? k; break;
    case 'weaponMod': keyOf = (e) => data.weaponMods.types.find((x) => x.id === e.type)?.for ?? 'other'; label = (k) => t(`wmod.for.${k}`); break; // decision 173
    case 'droneMod': keyOf = (e) => e.type; label = (k) => data.droneMods.types?.find((x) => x.id === k)?.name ?? k; break; // decision 172
    case 'lifestyle': keyOf = (e) => e.category; label = (k) => data.lifestyle.categories.find((x) => x.id === k)?.name ?? k; break;
    default: return list.length ? [{ key: 'all', label: '', items: [...list].sort(byPrice) }] : [];
  }
  const groups = new Map();
  for (const e of list) {
    const k = keyOf(e);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(e);
  }
  const rank = (k) => (order ? order.indexOf(k) : k === ' yours' ? -1 : Math.min(...groups.get(k).map((e) => e.cost.cr)));
  return [...groups.keys()].sort((a, b) => rank(a) - rank(b) || String(a).localeCompare(String(b)))
    .map((k) => ({ key: k, label: label(k), items: groups.get(k).sort(byPrice) }));
}
