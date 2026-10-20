// Using consumables (decision 58). On yourself the effect lands on this sheet; on an ally the sheet only logs
// the result (they enter it on their own sheet, as on paper). Logs stay English for the GM.

import { RuleError } from '../../rules/messages.js';
import { effectFrom, tickEffects, endCombatEffects } from '../../rules/items.js';
import { deriveSheet } from '../../state/character.js';
import { uid } from '../../state/id.js';
import { log, spend, actions } from './actions.js';

/** After effects change, HP above the (new) maximum is lost; full stays full. */
function fitHp(c, data) {
  if (c.play.hp != null && c.play.hp >= deriveSheet(c, data).hp.max) c.play.hp = null;
}
/** A CON or MST boost raises max HP; give the same HP now (painkillers buy time). */
function boostHp(c, data, before) {
  const gain = deriveSheet(c, data).hp.max - before;
  if (gain > 0 && c.play.hp != null) c.play.hp += gain;
}

/** Round end (called from actions.roundEnd, after the round's conditions cleared): effects count down; a crash Slows. */
export function tickItemEffects(c, data) {
  const out = tickEffects(c.play.effects);
  c.play.effects = out.effects;
  if (!out.ended.length) return;
  if (out.crash && !c.play.conditions.includes('slowed')) c.play.conditions.push('slowed');
  fitHp(c, data);
  log(c, `${out.ended.map((e) => e.name).join(', ')} wore off${out.crash ? ' — crash: Slowed next round' : ''}`, out.crash ? 'bad' : 'info');
}
/** Combat over: effects counted in rounds end; scene effects stay. */
export function endItemEffects(c, data) {
  const before = (c.play.effects ?? []).length;
  c.play.effects = endCombatEffects(c.play.effects);
  if (c.play.effects.length !== before) fitHp(c, data);
}

export const itemActions = {
  /**
   * Uses one item. option: the item's use option id. target: 'self' | 'ally'. heal: the heal roll's total
   * (rolled or typed in the window). limb: which injury a trauma kit treats.
   * @returns a short English summary (also shown to the player for an ally: "heal 7…").
   */
  useItem(c, data, { id, option, target = 'self', heal = null, healText = '', limb = null }) {
    const row = c.play.inventory.find((x) => x.kind === 'item' && x.id === id);
    const item = data.items.find((i) => i.id === id);
    const opt = item?.use?.options?.find((o) => o.id === option);
    if (!row?.qty || !opt) throw new RuleError('noItem', {}, 'Not in your inventory any more.');
    if (target === 'ally' && !item.use.ally) throw new RuleError('selfOnly', { item: item.name }, `${item.name} only works on yourself.`);
    const prefix = spend(c, data, { kind: 'use_item', name: item.name });
    actions.qty(c, data, { kind: 'item', id, delta: -1 });
    const parts = [];
    if (opt.heal) parts.push(`heal ${heal ?? '?'}${healText ? ` (${healText})` : ''}`);
    if (target === 'ally' || opt.table) {
      if (opt.table) parts.push(opt.table);
      else parts.push(opt.text);
      const text = parts.join(' · ');
      log(c, `${prefix}Used ${item.name}${target === 'ally' ? ' on an ally' : ''}: ${text}`);
      return text;
    }
    // on yourself
    const s = deriveSheet(c, data);
    if (opt.heal && heal != null) {
      const now = Math.min(s.hp.max, s.hp.current + Number(heal));
      c.play.hp = now >= s.hp.max ? null : now;
    }
    if (opt.treatLimb === 'all' && (c.play.injuries ?? []).length) { parts.push('all injuries treated'); c.play.injuries = []; }
    else if (opt.treatLimb && (c.play.injuries ?? []).length) {
      const loc = limb && c.play.injuries.includes(limb) ? limb : c.play.injuries[0];
      c.play.injuries = c.play.injuries.filter((x) => x !== loc);
      parts.push(`treated ${data.body.locations.find((l) => l.id === loc)?.name ?? loc}`);
    }
    for (const cond of opt.clears ?? []) if (c.play.conditions.includes(cond)) { c.play.conditions = c.play.conditions.filter((x) => x !== cond); parts.push(`${data.conditions.find((k) => k.id === cond)?.name ?? cond} ended`); }
    if (opt.revive && c.play.conditions.includes('incapacitated') && deriveSheet(c, data).hp.current > 0) {
      c.play.conditions = c.play.conditions.filter((x) => x !== 'incapacitated');
      parts.push('back on your feet');
    }
    if (opt.endStims) {
      const stims = (c.play.effects ?? []).filter((e) => e.crash);
      if (stims.length) { c.play.effects = c.play.effects.filter((e) => !e.crash); parts.push(`${stims.map((e) => e.name).join(', ')} ended`); fitHp(c, data); }
    }
    if (opt.boost || opt.immune) {
      const before = deriveSheet(c, data).hp.max;
      c.play.effects = [...(c.play.effects ?? []), effectFrom(item, opt, uid())];
      boostHp(c, data, before);
      parts.push(opt.text);
    }
    const text = parts.join(' · ') || opt.text;
    log(c, `${prefix}Used ${item.name}: ${text}`, 'ok');
    return text;
  },
  /** Ends an item effect early (the GM says the scene is over, or it simply wore off): no crash. */
  endEffect(c, data, { id }) {
    const e = (c.play.effects ?? []).find((x) => x.id === id);
    if (!e) return;
    c.play.effects = c.play.effects.filter((x) => x.id !== id);
    fitHp(c, data);
    log(c, `${e.name} ended`);
  },
};
