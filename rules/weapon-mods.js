// Weapon mods (decision 173): small, simple upgrades so the Soldier and the Smuggler have something to build. A weapon
// has mod slots by rarity (F/E 1 · D/C 2 · B 3 · A 4; fists and the stun gun none; a record may say its own `modSlots`).
// One mod of each kind per weapon: melee — balanced hilt (+1 TN), sharpened edge (+1 damage); firearms — grip (+1 TN),
// heavy barrel (+1 damage), improved sights (+25% range), extended magazine (+50%, at least +1). Out of a fight only,
// free, and only a Soldier or a Tech Wizard installs them. A modded copy is its own record (and inventory row): its
// stock weapon plus its mods, worked out here. Pure.

import { RuleError } from './messages.js';
import { addFlat } from './dice.js';

const MELEE = ['melee_cqc', 'brawling'];
export const INSTALLERS = ['soldier', 'techwiz'];

export const isMelee = (w) => MELEE.includes(w?.skill);
/** How many mods this weapon takes. */
export const weaponSlots = (w, modsData) => (w.natural ? 0 : Number.isInteger(w.modSlots) ? w.modSlots : modsData.slotsByRarity[w.rarity] ?? 1);
const typeOf = (mod, modsData) => modsData.types.find((t) => t.id === mod.type);

/** Can this mod go on this kind of weapon at all? (melee / firearms; a magazine only on a gun that has one) */
export function modFits(w, mod, modsData) {
  const ty = typeOf(mod, modsData);
  if (!ty) return false;
  if (ty.for === 'melee' ? !isMelee(w) : isMelee(w)) return false;
  return ty.adds !== 'mag' || Boolean(w.magSize);
}

/**
 * May this character put `mod` on weapon `w` (installed: its current mod ids) now? Throws a RuleError with the reason.
 * c: the character (class, combat).
 */
export function checkInstall(c, w, installed, mod, modsData) {
  if (!INSTALLERS.includes(c.classId)) throw new RuleError('modWho', {}, 'Only a Soldier or a Tech Wizard installs weapon mods.');
  if (c.play.turn?.inCombat) throw new RuleError('modCombat', {}, 'Not in a fight: mods go on between scenes.');
  if (!modFits(w, mod, modsData)) throw new RuleError('modFit', {}, 'It doesn’t fit this weapon.');
  const mods = installed.map((id) => modsData.mods.find((m) => m.id === id)).filter(Boolean);
  if (mods.some((m) => m.type === mod.type)) throw new RuleError('modSame', {}, 'One mod of each kind per weapon.');
  const slots = weaponSlots(w, modsData);
  if (mods.length >= slots) throw new RuleError('modSlots', { n: slots }, `No free mod slot (${slots}).`);
}

/** The modded record: the stock weapon with its mods applied. stock: the weapon without mods. */
export function moddedWeapon(stock, installed, modsData) {
  const w = { ...stock, range: { ...stock.range }, modded: true, mods: [] };
  for (const id of installed) {
    const m = modsData.mods.find((x) => x.id === id);
    const ty = m && typeOf(m, modsData);
    if (!ty) continue;
    w.mods.push(id);
    if (ty.adds === 'tn') w.tnBonus = (w.tnBonus ?? 0) + m.amount;
    if (ty.adds === 'damage') w.damage = addFlat(w.damage, m.amount);
    if (ty.adds === 'range') w.range.max = Math.floor(w.range.max * (1 + m.amount / 100));
    if (ty.adds === 'mag' && w.magSize) w.magSize += Math.max(1, Math.floor(w.magSize * (m.amount / 100)));
  }
  return w;
}
