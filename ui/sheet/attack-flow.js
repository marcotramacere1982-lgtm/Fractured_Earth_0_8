// What follows a hit in the roll window, one step at a time: damage dice, then (Scavenger attacks) Exploit —
// which enemy, how many Tells, the dice — then the hit location of a location attack. Every die can be rolled
// by the app or typed from physical dice (dialogs.js → openCheck flow). Numbers come from rules/.

import { html } from '../dom.js';
import { t } from '../../i18n/index.js';
import { formatRoll } from '../../rules/dice.js';
import { damageDice, damageFrom } from '../../rules/turn.js';
import { hitLocations } from '../../rules/body.js';
import { stanceMultiplier, exploitDice, isRanged } from '../../rules/engines.js';
import { tellTargets } from './engine.js';

/** Breakdown of a damage roll: dice, second roll, bonus dice, Exploit, OFF, Hot, stance multiplier. */
export const damageBreakdown = (d) => [formatRoll(d.base ?? d), d.second ? `+ ${formatRoll(d.second)}` : '', d.extra ? `+ ${formatRoll(d.extra)}` : '', d.exploit ? `+ Exploit ${formatRoll(d.exploit)}` : '',
  d.off ? `${d.off > 0 ? '+' : '−'} OFF ${Math.abs(d.off)}` : '', d.flat ? `+ ${d.flat} Hot` : '', ...(d.extras ?? []).map((x) => `+ ${x.n} ${x.label}`), d.multiplier !== 1 ? `× ${d.multiplier}` : ''].filter(Boolean).join(' ');

const upTo = (n) => Array.from({ length: n }, (_, i) => i + 1);

const condName = (data, id) => data.conditions.find((k) => k.id === id)?.name ?? id;

/** What a location does when the damage gets through (decision 156): synthetic targets (drones, robots) have their own column. */
export function partEffect(bp, data, tag = 'organic') {
  const inj = data.body.injuries;
  if (tag === 'synthetic') return condName(data, inj.synthetic[bp]);
  return bp === 'head' ? t('body.headRow', { stunned: condName(data, inj.head.condition), severe: condName(data, inj.head.severe) }) : condName(data, inj[bp].condition);
}

/** Decision 156: the location table for the roll window — d20 band, body part, what it does to this target (or both kinds). */
export function locationTable(data, tag = null, { at = null } = {}) {
  const kinds = tag ? [tag === 'synthetic' ? 'synthetic' : 'organic'] : ['organic', 'synthetic'];
  return html`<table class="loc-table">
    <thead><tr><th>d20</th><th>${t('attack.location')}</th>${kinds.map((k) => html`<th>${t(`loc.${k}`)}</th>`)}</tr></thead>
    <tbody>${data.body.hitLocation.table.map((r) => {
      const bp = data.body.locations.find((l) => l.id === r.locations[0])?.bp;
      return html`<tr class="${at != null && at >= r.min && at <= r.max ? 'is-on' : ''}"><td class="mono">${r.min}–${r.max}</td><td>${t(`body.part.${bp}`)}</td>${kinds.map((k) => html`<td>${partEffect(bp, data, k)}</td>`)}</tr>`;
    })}</tbody></table>
    <p class="hint">${t('attack.locationCrack')}${tag ? '' : ` ${t('loc.which')}`}</p>`;
}

/** Where a location roll lands, and what that does if it gets through the armor (for this target's kind). */
function located(total, data, tag = 'organic') {
  const ids = hitLocations(total, data.body);
  const bp = data.body.locations.find((l) => l.id === ids[0])?.bp;
  const where = [...new Set(ids.map((x) => t(`body.part.${data.body.locations.find((l) => l.id === x)?.bp}`)))].join(' / ');
  return {
    where,
    part: bp, // decision 153: what the GM's pending hit is prefilled with
    html: html`<div class="roll-extra__main"><span class="label">${t('attack.location')}</span><span class="roll-extra__n">${where}</span><span class="mono muted">d20 ${total}</span></div>
      <p class="hint">${t('attack.locationIf', { condition: partEffect(bp, data, tag) })} ${t('attack.locationCrack')}</p>`,
  };
}

/** Decision 156: Aim's ±N — the locations an aimed d20 can be moved to, each at the nearest value to the roll. */
function aimChoices(roll, data, tag) {
  const n = data.body.hitLocation.aim ?? 5;
  const lo = Math.max(1, roll - n);
  const hi = Math.min(20, roll + n);
  return data.body.hitLocation.table.filter((r) => r.max >= lo && r.min <= hi).map((r) => {
    const v = Math.min(Math.max(roll, r.min), r.max);
    const bp = data.body.locations.find((l) => l.id === r.locations[0])?.bp;
    return { value: v, label: `${t(`body.part.${bp}`)} (d20 ${v}) → ${partEffect(bp, data, tag)}`, primary: roll >= r.min && roll <= r.max };
  });
}

/**
 * After a hit with a weapon (an attack, or an ability that fires one). spec: { bonus, twice, located, armorHalf }.
 * exploit: offer the Scavenger's Tells (normal attacks only; abilities pay their own). combat: the GM's fight (names).
 * onDone({ text, exploit: { key, n, name } | null }) once every die is in.
 */
export function weaponFlow({ c, sh, data, w, spec = {}, exploit = false, combat = null, onDone }) {
  const expr = damageDice(w.damage);
  const r = c.play.resources ?? {};
  const targets = exploit && c.classId === 'scavenger' ? tellTargets(r, combat).filter((x) => (r.tells?.[x.key] ?? 0) > 0) : [];
  const dice = (n) => exploitDice(n, data.classes, { melee: !isRanged(w), talents: sh.talents });
  const label = (key) => { const x = targets.find((y) => y.key === key); return x ? `${x.letter ? `${x.letter} · ` : ''}${x.name}` : key; };
  const spent = (a) => (a.who && Number(a.n) > 0 ? Number(a.n) : 0);

  const next = (a) => {
    if (expr && !a.damage) {
      return { id: 'damage', title: `${t('flow.damage')} · ${w.name}`, dice: [
        { key: 'base', label: w.name, expr },
        ...(spec.twice ? [{ key: 'second', label: t('flow.secondRoll'), expr }] : []),
        ...(spec.bonus ? [{ key: 'extra', label: t('flow.bonusDice'), expr: spec.bonus }] : []),
      ] };
    }
    if (targets.length && a.who === undefined) {
      return { id: 'who', title: t('flow.exploitWho'), choose: [
        ...targets.map((x) => ({ value: x.key, label: `${label(x.key)} ${'●'.repeat(r.tells[x.key])}`, primary: x.key === r.target })),
        { value: '', label: t('flow.exploitNone') },
      ] };
    }
    if (a.who && a.n === undefined) {
      return { id: 'n', title: t('flow.exploitHow'), hint: t('flow.exploitHint', { die: dice(1) }), choose: [
        { value: 0, label: t('flow.exploitNo') }, ...upTo(r.tells[a.who] ?? 0).map((i) => ({ value: i, label: `${i} · +${dice(i)}` })),
      ] };
    }
    if (spent(a) && !a.exploit) return { id: 'exploit', title: `${t('flow.exploitDice')} · ${label(a.who)}`, dice: [{ key: 'dice', label: 'Exploit', expr: dice(spent(a)) }] };
    if (spec.located && !a.loc) return { id: 'loc', title: t('flow.location'), hint: spec.aimed ? `🎯 ${t('flow.aimedHint')}` : undefined, dice: [{ key: 'd20', label: t('flow.location'), expr: data.body.hitLocation.die }] };
    // decision 156: aimed — pick where it lands within ±5 of the roll; the window works out the parts in reach
    if (spec.located && spec.aimed && a.loc && a.shift === undefined) return { id: 'shift', title: `🎯 ${t('flow.aimShift')}`, hint: t('flow.aimShiftHint', { n: a.loc.d20.total, aim: data.body.hitLocation.aim ?? 5 }), choose: aimChoices(a.loc.d20.total, data, spec.targetTag) };
    return null;
  };

  const result = (a) => {
    const dmg = expr ? damageFrom({ base: a.damage.base, second: a.damage.second ?? null, extra: a.damage.extra ?? null, exploit: a.exploit?.dice ?? null },
      sh.combat.off.value, { multiplier: stanceMultiplier(c.classId, c.play.resources, data.classes), flat: sh.zone.damage,
        extras: !isRanged(w) && sh.conditionMods.meleeDamage ? [{ n: sh.conditionMods.meleeDamage, label: 'Enraged' }] : [] }) : null;
    return { dmg, loc: a.loc ? located(Number(a.shift ?? a.loc.d20.total), data, spec.targetTag) : null };
  };

  return {
    next,
    recap(id, a) {
      if (id === 'damage') return `${t('flow.damage')}: ${Object.values(a).map(formatRoll).join(' + ')}`;
      if (id === 'who') return `Exploit: ${a ? label(a) : '—'}`;
      if (id === 'n') return Number(a) ? `Exploit: ${a} Tell${a > 1 ? 's' : ''}` : 'Exploit: —';
      if (id === 'exploit') return `Exploit: ${formatRoll(a.dice)}`;
      if (id === 'loc') return `${t('flow.location')}: d20 ${a.d20.total}`;
      if (id === 'shift') return `🎯 ${t('flow.aimShift')}: d20 ${a}`;
      return '';
    },
    summary(a) {
      const { dmg, loc } = result(a);
      return html`<div class="roll-extra">
        ${dmg ? html`<div class="roll-extra__main"><span class="label">${t('attack.damage')} · ${w.name}</span><span class="roll-extra__n">${dmg.total}</span><span class="mono muted">${damageBreakdown(dmg)}</span></div>` : ''}
        ${loc ? loc.html : ''}
        <p class="hint">${spec.armorHalf ? t('attack.armorHalf') : t('attack.armorNote')}</p></div>`;
    },
    complete(a) {
      const { dmg, loc } = result(a);
      const text = [dmg ? `${dmg.total} damage (${damageBreakdown(dmg)})` : '', loc ? `location ${loc.where}` : ''].filter(Boolean).join(' · ');
      onDone({ text: text || 'hit', exploit: spent(a) ? { key: a.who, n: spent(a), name: label(a.who) } : null, damage: dmg?.total ?? null, part: loc?.part ?? null, where: loc?.where ?? '', armorHalf: Boolean(spec.armorHalf) });
    },
  };
}

/** Hacker abilities with their own damage dice (one roll per kind of target). */
export function hackFlow({ ability, onDone }) {
  const list = ability.damage.map((d, i) => ({ id: `h${i}`, ...d }));
  return {
    next: (a) => { const d = list.find((x) => !a[x.id]); return d ? { id: d.id, title: `${t('flow.hack')} · ${t(`tag.${d.vs}`)}`, dice: [{ key: 'r', label: t(`tag.${d.vs}`), expr: d.dice }] } : null; },
    recap: (id, a) => `${t('flow.hack')}: ${formatRoll(a.r)}`,
    summary: (a) => html`<div class="roll-extra">
      ${list.map((d) => html`<div class="roll-extra__main"><span class="label">${t('attack.damage')} · ${t(`tag.${d.vs}`)}</span><span class="roll-extra__n">${a[d.id].r.total}</span><span class="mono muted">${formatRoll(a[d.id].r)}</span></div>`)}
      <p class="hint">${t('attack.hackNote')}</p></div>`,
    complete: (a) => onDone({ text: list.map((d) => `${a[d.id].r.total} vs ${d.vs} (${formatRoll(a[d.id].r)})`).join(' · ') }),
  };
}
