// Abilities in play (decision 155): what a success does to the caster, the cards allies receive, the Logic Bomb.
// Logs stay English ("Brace & Dig In: Braced"); a fabricated item is logged "Added …" for the GM's audit.

import { boonResult } from '../../rules/ability-play.js';
import { deriveSheet } from '../../state/character.js';
import { uid } from '../../state/id.js';
import { log } from './actions.js';

const condName = (data, id) => data.conditions.find((k) => k.id === id)?.name ?? id;
const text = (v, n) => String(v ?? '').slice(0, n);

export const abilityActions = {
  /** The caster's own effects: conditions (some only until the round ends), special rounds, a fabricated item, a reminder. */
  abilitySelf(c, data, { ability, self }) {
    if (!self) return;
    const parts = [];
    for (const id of self.conditions ?? []) {
      if (!c.play.conditions.includes(id)) c.play.conditions.push(id);
      if (self.roundEnd) c.play.roundConditions = [...new Set([...(c.play.roundConditions ?? []), id])];
      parts.push(condName(data, id));
    }
    if (self.ammo) {
      const slot = deriveSheet(c, data).handSlot;
      c.play.specialAmmo = { slot, mode: self.ammo };
      parts.push(self.ammo === 'half' ? 'special rounds: half armor' : 'special rounds: +1d6');
    }
    if (self.custom) {
      c.play.inventory.push({ kind: 'custom', id: uid(), name: text(self.custom, 60), note: `${ability}`, qty: 1 });
      log(c, `Added ${text(self.custom, 60)} (custom item, ${ability})`);
    }
    if (self.note) parts.push(self.note);
    if (parts.length) log(c, `${ability}: ${parts.join(' · ')}`, 'ok');
  },
  /** A card from another sheet (durable `boon`). @returns true when new. */
  receiveBoon(c, _d, { msg }) {
    c.play.boons ??= [];
    if (!msg?.id || c.play.boons.some((b) => b.id === msg.id)) return false;
    c.play.boons.push({ id: text(msg.id, 40), from: text(msg.fromName, 40), ability: text(msg.ability, 60), heal: Number.isFinite(Number(msg.heal)) && msg.heal != null ? Math.max(0, Math.round(Number(msg.heal))) : null,
      healText: text(msg.healText, 80), conditions: (msg.conditions ?? []).filter((id) => /^[a-z_]{1,24}$/.test(id)).slice(0, 4), clear: (msg.clear ?? []).filter((id) => /^[a-z_]{1,24}$/.test(id)).slice(0, 4),
      cracks: Math.max(0, Math.min(10, Math.round(Number(msg.cracks) || 0))), note: text(msg.note, 300) });
    return true;
  },
  /** Takes a card (one received, or `boon` given directly when the caster picked themself). */
  applyBoon(c, data, { id, boon = null }) {
    const b = boon ?? (c.play.boons ?? []).find((x) => x.id === id);
    if (!b) return null;
    c.play.boons = (c.play.boons ?? []).filter((x) => x !== b);
    const s = deriveSheet(c, data);
    const out = boonResult({ hp: s.hp.current, maxHp: s.hp.max, conditions: c.play.conditions, armorDamage: c.play.armorDamage ?? 0 }, b);
    c.play.hp = out.hp >= s.hp.max ? null : out.hp;
    c.play.conditions = out.conditions;
    c.play.armorDamage = out.armorDamage;
    const parts = [out.gained ? `+${out.gained} HP${b.healText ? ` (${b.healText})` : ''}` : '', ...(b.conditions ?? []).map((k) => condName(data, k)),
      ...(b.clear ?? []).map((k) => `no longer ${condName(data, k)}`), b.cracks ? `${b.cracks} armor cracks mended` : '', b.note].filter(Boolean);
    log(c, `${b.from ? `${b.from}'s ` : ''}${b.ability}: ${parts.join(' · ') || 'taken'}`, 'ok');
    return out;
  },
  /** Logic Bomb planted on an enemy: remembered until it detonates (Release Payload) or the deck reboots. */
  setBomb(c, _d, { target, label }) { c.play.bomb = { target: text(target, 16), label: text(label, 40) }; },
  clearBomb(c) { c.play.bomb = null; },
};
