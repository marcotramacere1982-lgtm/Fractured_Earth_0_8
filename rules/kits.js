// Starter kits (decision 183): for each subclass, a few ready loadouts — 3 abilities and deliberately cheap gear.
// In the builder a kit is taken once (gear free, guns in the slots with their spare magazines, armor worn, the deck /
// optic made active); on the engine card the same kits only swap the equipped abilities. Pure: returns a new character.

import { addItem, magazineId } from './economy.js';

export const kitsFor = (subclassId, data) => (data.kits?.kits ?? []).filter((k) => k.subclass === subclassId);

/** The kit's abilities this character can equip now (its subclass, within the brain fog limit). */
export function kitAbilities(kit, c, data, limit) {
  const list = data.abilities[c.classId] ?? [];
  return kit.abilities.filter((id) => list.some((a) => a.id === id && a.subclasses.includes(c.subclassId) && !a.housekeeping)).slice(0, limit);
}

/** A new character with the kit taken: abilities equipped, gear added, guns slotted with spares, armor worn. */
export function takeKit(character, kit, data) {
  const c = structuredClone(character);
  c.play.abilities = kitAbilities(kit, c, data, c.play.maxAbilities ?? 3);
  const weapons = [];
  for (const [kind, id, qty] of kit.gear) {
    addItem(c, kind, id, qty);
    if (kind === 'weapon') {
      weapons.push(id);
      if (data.weapons.find((w) => w.id === id)?.magSize) addItem(c, 'ammo', magazineId(id), data.economy.magazine.startSpares * qty);
    }
    if (kind === 'armor' && !c.play.worn.includes(id)) c.play.worn.push(id);
    if (kind === 'deck') c.play.deck = id;
    if (kind === 'optic') c.play.optic = id;
  }
  weapons.slice(0, 2).forEach((id, i) => {
    const slot = i + 1;
    c.play.slots[slot] = id;
    c.play.ammo[slot] = data.weapons.find((w) => w.id === id)?.magSize ?? 0;
  });
  (c.play.log ??= []).unshift({ t: Date.now(), kind: 'info', text: `Starter kit: ${kit.name}` });
  return c;
}
