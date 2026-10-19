// What follows a hit in the roll window, one step at a time: damage dice, then (Scavenger attacks) Exploit —
// which enemy, how many Tells, the dice — then the hit location of a location attack. Every die can be rolled
// by the app or typed from physical dice (dialogs.js → openCheck flow). Numbers come from rules/.

import { html } from '../dom.js';
import { t } from '../../i18n/index.js';
import { formatRoll } from '../../rules/dice.js';
import { damageDice, damageFrom } from '../../rules/turn.js';
import { hitLocations } from '../../rules/body.js';
import { stanceMultiplier, exploitDice, isRanged } from '../../rules/engines.js';
import { locationRule } from './play.js';
import { tellTargets } from './engine.js';

/** Breakdown of a damage roll: dice, second roll, bonus dice, Exploit, OFF, Hot, stance multiplier. */
export const damageBreakdown = (d) => [formatRoll(d.base ?? d), d.second ? `+ ${formatRoll(d.second)}` : '', d.extra ? `+ ${formatRoll(d.extra)}` : '', d.exploit ? `+ Exploit ${formatRoll(d.exploit)}` : '',
  d.off ? `${d.off > 0 ? '+' : '−'} OFF ${Math.abs(d.off)}` : '', d.flat ? `+ ${d.flat} Hot` : '', ...(d.extras ?? []).map((x) => `+ ${x.n} ${x.label}`), d.multiplier !== 1 ? `× ${d.multiplier}` : ''].filter(Boolean).join(' ');

const upTo = (n) => Array.from({ length: n }, (_, i) => i + 1);

/** Where a location roll lands, and what that does if it gets through the armor. */
function located(total, data) {
  const ids = hitLocations(total, data.body);
  const bp = data.body.locations.find((l) => l.id === ids[0])?.bp;
  const cond = (id) => data.conditions.find((k) => k.id === id)?.name ?? id;
  const where = [...new Set(ids.map((x) => t(`body.part.${data.body.locations.find((l) => l.id === x)?.bp}`)))].join(' / ');
  return {
    where,
    html: html`<div class="roll-extra__main"><span class="label">${t('attack.location')}</span><span class="roll-extra__n">${where}</span><span class="mono muted">d20 ${total} · ${t('attack.aimNote')}</span></div>
      <p class="hint">${t('attack.locationIf', { condition: cond(data.body.injuries[bp].condition) })}${bp === 'head' ? ` ${locationRule(data).head}` : ''} ${t('attack.locationCrack')}</p>`,
  };
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
    if (spec.located && !a.loc) return { id: 'loc', title: t('flow.location'), dice: [{ key: 'd20', label: t('flow.location'), expr: data.body.hitLocation.die }] };
    return null;
  };

  const result = (a) => {
    const dmg = expr ? damageFrom({ base: a.damage.base, second: a.damage.second ?? null, extra: a.damage.extra ?? null, exploit: a.exploit?.dice ?? null },
      sh.combat.off.value, { multiplier: stanceMultiplier(c.classId, c.play.resources, data.classes), flat: sh.zone.damage,
        extras: !isRanged(w) && sh.conditionMods.meleeDamage ? [{ n: sh.conditionMods.meleeDamage, label: 'Enraged' }] : [] }) : null;
    return { dmg, loc: a.loc ? located(a.loc.d20.total, data) : null };
  };

  return {
    next,
    recap(id, a) {
      if (id === 'damage') return `${t('flow.damage')}: ${Object.values(a).map(formatRoll).join(' + ')}`;
      if (id === 'who') return `Exploit: ${a ? label(a) : '—'}`;
      if (id === 'n') return Number(a) ? `Exploit: ${a} Tell${a > 1 ? 's' : ''}` : 'Exploit: —';
      if (id === 'exploit') return `Exploit: ${formatRoll(a.dice)}`;
      if (id === 'loc') return `${t('flow.location')}: d20 ${a.d20.total}`;
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
      onDone({ text: text || 'hit', exploit: spent(a) ? { key: a.who, n: spent(a), name: label(a.who) } : null });
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
