// Abilities in play (decision 155): pick (an option, the targets) → Class TN → on a success the dice (weapon damage,
// the ability's own damage by target type, a heal) → what happens: pending hits and notes to the GM, effects on the
// caster, cards on allies' sheets. The window says it in plain words, so nobody has to guess what a success did.

import { html, raw } from '../dom.js';
import { openDialog, openCheck } from './dialogs.js';
import { weaponFlow } from './attack-flow.js';
import { abilityFaces, chosen, damageFor, canTarget, playEffects } from '../../rules/ability-play.js';
import { abilityWeapon } from '../../rules/engines.js';
import { roll, formatRoll, addFlat } from '../../rules/dice.js';
import { t } from '../../i18n/index.js';
import { bonus } from '../../rules/stats.js';

const ENEMY = ['enemy', 'enemies'];
const ALLY = ['ally', 'allies'];
const condName = (data, id) => data.conditions.find((k) => k.id === id)?.name ?? id;
const faceName = (data, f) => (f ? data.classes.classes.find((k) => k.id === 'techwiz').resources.modes.find((m) => m.id === f)?.name ?? f : '');

/** Decision 175: dice with a stat bonus in — '1d6+{CON}' → '1d6+3' (the attribute's bonus). */
const withStats = (expr, sh) => expr.replace(/\+\{(STR|DEX|CON|INT|WIS|CHA|MST)\}/g, (_, k) => { const b = bonus(sh.attributes[k] ?? 0); return b ? `${b > 0 ? '+' : ''}${b}` : ''; });

/** What a success does, in plain words (shown after the roll). */
function whatHappens(spec, pick, data) {
  const lines = [];
  const who = pick.enemies.map((e) => e.label).join(', ');
  const bits = [spec.weapon ? t('ability.weaponDamage') : '', damageFor(spec, pick.enemies[0]?.tag) ?? '', ...(spec.conditions ?? []).map((k) => condName(data, k)),
    spec.crack ? t('ability.crack', { n: spec.crack }) : '', spec.armor === 'half' ? t('ability.armorHalf') : spec.armor === 'ignore' ? t('ability.armorIgnore') : ''].filter(Boolean);
  if (bits.length && who) lines.push(t('ability.toGm', { who, what: bits.join(' · ') }));
  if (spec.ally) lines.push(t('ability.toAlly', { who: pick.allies.map((a) => a.name).join(', ') || '—' }));
  if (spec.ping) lines.push(t('ping.sent'));
  if (spec.self) lines.push(t('ability.toSelf', { what: [...(spec.self.conditions ?? []).map((k) => condName(data, k)), spec.self.note, spec.self.custom].filter(Boolean).join(' · ') }));
  return lines;
}

/** Decision 166: what only the GM can apply (cover, a decoy, a reveal…) — a call-out the player can't miss, not a hint line. */
function askGm(gm, data, sent) {
  if (!gm.length) return '';
  return html`<div class="notice notice--warn ask-gm"><strong>${data.icons.fx_gm ? html`<span class="ico" aria-hidden="true">${raw(data.icons.fx_gm)}</span>` : ''}${t('ability.askGm')}</strong>
    ${gm.map((g) => html`<p>${g}</p>`)}<p class="st-small">${t(sent ? 'ability.askGmSent' : 'ability.askGmSay')}</p></div>`;
}

/**
 * ctx: { c, sh, data, ability, resonant, combat (the table's, or null), table, run, toast, rollText(r), tier }
 * Opens the setup (when there is something to pick), then the Class TN roll.
 */
export async function playAbility(ctx) {
  const { c, data, ability, resonant, combat, table } = ctx;
  const faces = abilityFaces(ability, c.play.resources, { resonant });
  const hostiles = (combat?.hostiles ?? []).filter((h) => !h.ally && h.band !== 'down');
  const others = table?.state.joinedId === c.id ? (await table.players()).filter((p) => p.id !== c.id) : [];
  const picks = faces.map(() => ({ choice: 0, enemies: [], allies: [] }));
  const specOf = (i) => chosen(faces[i].spec, picks[i].choice);
  // Scavenger: an ability that spends Tells can only go at an enemy carrying enough of them
  const tellsOk = (h) => !ability.tells || (c.play.resources?.tells?.[h.key] ?? 0) >= ability.tells;
  const enemyOptions = (spec) => hostiles.filter((h) => canTarget(spec, h) && tellsOk(h)).map((h) => ({ key: h.key, label: `${h.letter} · ${h.name}`, tag: h.tag, letter: h.letter, img: h.art ? `/api/table/art?art=${h.art}&size=portrait&look=${h.look ?? 1}` : null }));
  const allyOptions = (spec) => [...(spec.withSelf ? [{ id: c.id, name: t('ability.me'), me: true }] : []), ...others.map((p) => ({ id: p.id, name: p.name }))];
  const preset = (i) => { // sensible first picks: the Scavenger's target, every ally for "allies"
    const spec = specOf(i);
    const foes = enemyOptions(spec);
    picks[i].enemies = spec.target === 'enemy' ? foes.filter((e) => e.key === c.play.resources?.target).slice(0, 1) : [];
    picks[i].allies = spec.target === 'allies' ? allyOptions(spec) : spec.withSelf ? allyOptions(spec).slice(0, 1) : [];
  };
  faces.forEach((_, i) => preset(i));
  const needs = faces.some((f, i) => f.spec.choose || (ENEMY.includes(specOf(i).target) && enemyOptions(specOf(i)).length) || (ALLY.includes(specOf(i).target) && allyOptions(specOf(i)).length));
  if (!needs) { rollClass(); return; }

  const ready = () => faces.every((_, i) => {
    const s = specOf(i);
    if (s.target === 'enemy' && enemyOptions(s).length) return picks[i].enemies.length === 1;
    if (s.target === 'enemies' && enemyOptions(s).length) return picks[i].enemies.length >= 1;
    if (ALLY.includes(s.target) && allyOptions(s).length) return picks[i].allies.length >= 1;
    return true;
  });
  const d = openDialog(() => html`
    <header class="card__head"><h2 class="card__title">${ability.name}<small>${t('ability.setup')}</small></h2><button class="btn btn--ghost btn--icon" data-action="close" aria-label="${t('common.close')}">✕</button></header>
    <div class="dialog__body stack">${faces.map((f, i) => {
      const s = specOf(i);
      const foes = enemyOptions(s);
      const pals = allyOptions(s);
      return html`<div class="stack">
        ${f.face ? html`<h3 class="label">${faceName(data, f.face)}</h3>` : ''}
        ${f.spec.choose ? html`<div class="stack stack--tight"><span class="label">${t('ability.pick')}</span><div class="segmented" role="group">${f.spec.choose.map((o, k) => html`<button class="segmented__opt" data-action="choice" data-face="${i}" data-k="${k}" aria-pressed="${picks[i].choice === k}">${o.label}</button>`)}</div></div>` : ''}
        ${ENEMY.includes(s.target) && foes.length ? html`<div class="stack stack--tight"><span class="label">${t('attack.foe')}${s.target === 'enemies' ? ` · ${t('ability.upTo', { n: Math.min(s.max ?? 9, foes.length) })}` : ''}</span>
          <div class="foe-chips" role="group">${foes.map((e) => html`<button class="foe-chip" data-action="foe" data-face="${i}" data-key="${e.key}" aria-pressed="${picks[i].enemies.some((x) => x.key === e.key)}">${e.img ? html`<img src="${e.img}" alt="" loading="lazy">` : html`<span class="foe-chip__letter">${e.letter}</span>`}<span>${e.label}</span></button>`)}</div></div>` : ''}
        ${ENEMY.includes(s.target) && !foes.length ? html`<p class="hint">${t('ability.noFoes')}</p>` : ''}
        ${ALLY.includes(s.target) && pals.length ? html`<div class="stack stack--tight"><span class="label">${t(s.target === 'allies' ? 'ability.allies' : 'ability.ally')}</span>
          <div class="segmented" role="group">${pals.map((p) => html`<button class="segmented__opt" data-action="pal" data-face="${i}" data-id="${p.id}" aria-pressed="${picks[i].allies.some((x) => x.id === p.id)}">${p.name}</button>`)}</div></div>` : ''}
        ${ALLY.includes(s.target) && !pals.length ? html`<p class="hint">${t('ability.noAllies')}</p>` : ''}
        ${whatHappens(s, picks[i], data).map((l) => html`<p class="hint">${l}</p>`)}
      </div>`;
    })}
      <div class="cluster"><button class="btn btn--primary" data-action="go" ${ready() ? '' : raw('disabled')}>🎲 ${t('ability.roll')}</button>
        <button class="btn btn--ghost" data-action="close">${t('common.cancel')}</button></div>
    </div>`, {
    click: {
      choice: ({ face, k }) => { picks[face].choice = Number(k); preset(face); d.redraw(); },
      foe: ({ face, key }) => {
        const s = specOf(face);
        const e = enemyOptions(s).find((x) => x.key === key);
        const on = picks[face].enemies.some((x) => x.key === key);
        picks[face].enemies = s.target === 'enemy' ? [e] : on ? picks[face].enemies.filter((x) => x.key !== key) : [...picks[face].enemies, e].slice(0, s.max ?? 9);
        d.redraw();
      },
      pal: ({ face, id }) => {
        const s = specOf(face);
        const p = allyOptions(s).find((x) => x.id === id);
        const on = picks[face].allies.some((x) => x.id === id);
        picks[face].allies = s.target === 'ally' ? [p] : on ? picks[face].allies.filter((x) => x.id !== id) : [...picks[face].allies, p];
        d.redraw();
      },
      go: () => { if (!ready()) return; d.close(); rollClass(); },
    },
  });

  function rollClass() {
    const specs = faces.map((_, i) => specOf(i));
    const w = specs.some((s) => s.weapon) ? abilityWeapon(ability, ctx.sh.armed) : null;
    const state = { rollText: '' };
    const flow = w && !ability.weapon?.noDamage
      ? weaponFlow({ c, sh: ctx.sh, data, w, spec: { ...ability.weapon, armorHalf: ability.weapon?.armorHalf || specs[0].armor === 'half', targetTag: picks[0].enemies[0]?.tag ?? null }, onDone: (o) => { ctx.run('attackDamage', o); dispatch({ weapon: o }); } })
      : diceFlow(specs);
    openCheck({ name: resonant ? `${ability.name} · ${t('engine.resonantCast')}` : ability.name, tn: ctx.sh.class.tn + (ability.tnBonus ?? 0), sub: `Class TN · ${ctx.sh.class.subclass.name}${ability.tnBonus ? ` · +${ability.tnBonus}` : ''}${ability.weapon ? ` · ${t('ability.notWeaponSkill')}` : ''}` }, data, // decision 174: Quick-Draw's +2; decision 179: not the weapon's skill
      (r) => {
        state.rollText = ctx.rollText(r);
        if (ability.tells && picks[0]?.enemies[0]) ctx.run('tellTarget', { key: picks[0].enemies[0].key }); // the Tells come off the enemy picked
        ctx.run('useRolled', { id: ability.id, success: r.success, rollText: state.rollText, resonant: Boolean(resonant) });
        if (specs.some((s) => s.ping)) ctx.ping?.(r); // decision 170: success or not, the networks hear it — the GM's console answers
        if (r.success && !flow) dispatch({});
      },
      { tier: ctx.tier(), once: true, flow,
        after: (r) => (r.success ? html`<div class="stack stack--tight">${specs.flatMap((s, i) => whatHappens(s, picks[i], data)).map((l) => html`<p class="hint">${l}</p>`)}
            ${askGm([...new Set(specs.map((s) => s.gm).filter(Boolean))], data, Boolean(combat && table))}</div>`
          : data.classes.abilityRoll.onFailure !== 'nothing' ? html`<p class="hint">${t(`check.abilityFailed.${data.classes.abilityRoll.onFailure}`)}</p>` : '') });

    /** The ability's own dice (damage by target type, a heal), face by face. */
    function diceFlow(list) {
      const steps = [];
      list.forEach((s, i) => {
        const surge = faces[i].face === 'surge' ? ctx.sh.talents?.surgeDamage ?? 0 : 0; // decision 186: Live Wire
        const exprs = [...new Set((picks[i].enemies.length ? picks[i].enemies.map((e) => damageFor(s, e.tag)) : [damageFor(s, 'organic') ?? damageFor(s, 'synthetic')]).filter(Boolean).map((x) => addFlat(x, surge)))];
        exprs.forEach((expr) => steps.push({ id: `d${i}_${expr}`, title: `${t('flow.damage')} · ${ability.name}`, dice: [{ key: 'r', label: ability.name, expr }] }));
        if (s.ally?.heal) steps.push({ id: `h${i}`, title: `${t('ability.heal')} · ${ability.name}`, dice: [{ key: 'r', label: t('ability.heal'), expr: addFlat(withStats(s.ally.heal, ctx.sh), faces[i].face === 'mend' ? ctx.sh.talents?.mendHeal ?? 0 : 0) }] }); // decision 186: Field Medic
      });
      if (!steps.length) return null;
      return {
        next: (a) => steps.find((x) => !a[x.id]) ?? null,
        recap: (id, a) => `${id.startsWith('h') ? t('ability.heal') : t('flow.damage')}: ${formatRoll(a.r)}`,
        summary: (a) => html`<div class="roll-extra">${steps.map((x) => html`<div class="roll-extra__main"><span class="label">${x.title}</span><span class="roll-extra__n">${a[x.id].r.total}</span><span class="mono muted">${formatRoll(a[x.id].r)}</span></div>`)}</div>`,
        complete: (a) => dispatch({ rolls: a }),
      };
    }

    /** Everything a success does, sent where it belongs. */
    function dispatch({ weapon = null, rolls = {} }) {
      let toGm = 0;
      let cards = 0;
      specs.forEach((s, i) => {
        const pick = picks[i];
        const surgeBonus = faces[i].face === 'surge' ? ctx.sh.talents?.surgeDamage ?? 0 : 0;
        const damage = weapon ? weapon.damage : Object.fromEntries(pick.enemies.map((e) => [e.key, rolls[`d${i}_${addFlat(damageFor(s, e.tag) ?? '', surgeBonus)}`]?.r.total ?? null]));
        const out = playEffects(s, { ability: `${ability.name}${faces[i].face ? ` (${faceName(data, faces[i].face)})` : ''}`, enemies: pick.enemies, allies: pick.allies, damage,
          weaponText: weapon?.text ?? '', heal: rolls[`h${i}`]?.r.total ?? null, healText: rolls[`h${i}`] ? formatRoll(rolls[`h${i}`].r) : '', roll: state.rollText });
        if (combat) for (const rep of out.reports) { table?.report(rep); toGm += 1; }
        if (out.self) ctx.run('abilitySelf', { ability: ability.name, self: out.self });
        for (const b of out.boons) {
          if (b.me) ctx.run('applyBoon', { boon: { ...b, from: '' } });
          else { table?.boon(b.to, b); cards += 1; }
        }
        if (s.bomb && pick.enemies[0]) ctx.run('setBomb', { target: pick.enemies[0].key, label: pick.enemies[0].label });
      });
      if (toGm || cards) ctx.toast([toGm ? t('ability.sentGm') : '', cards ? t('ability.cardsSent', { n: cards }) : ''].filter(Boolean).join(' · '), 'success');
    }
  }
}

/** Release Payload with a Logic Bomb planted: it detonates — 3d6 to the target, 1d6 to each one next to it (the GM's call). */
export function detonate({ c, data, combat, table, run, toast }) {
  const bomb = c.play.bomb;
  const spec = data.abilities.hacker.find((a) => a.id === 'logic_bomb')?.play?.bomb;
  if (!bomb || !spec) return;
  const main = roll(spec.damage);
  const splash = roll(spec.splash);
  const d = openDialog(() => html`
    <header class="card__head"><h2 class="card__title">${t('ability.detonate')}<small>${bomb.label}</small></h2><button class="btn btn--ghost btn--icon" data-action="close" aria-label="${t('common.close')}">✕</button></header>
    <div class="dialog__body stack"><div class="roll-extra">
      <div class="roll-extra__main"><span class="label">${bomb.label}</span><span class="roll-extra__n">${main.total}</span><span class="mono muted">${formatRoll(main)}</span></div>
      <div class="roll-extra__main"><span class="label">${t('ability.splash')}</span><span class="roll-extra__n">${splash.total}</span><span class="mono muted">${formatRoll(splash)}</span></div></div>
      <div class="cluster"><button class="btn btn--primary" data-action="send">${t('ability.sendGm')}</button></div></div>`, {
    click: { send: () => {
      if (combat) table?.report({ target: bomb.target, targetLabel: bomb.label, hit: true, ability: 'Logic Bomb', damage: main.total, armor: '', conditions: [], crack: 0,
        note: `Detonated: ${splash.total} damage (${formatRoll(splash)}) to each one next to it.`, roll: formatRoll(main) });
      run('clearBomb');
      d.close();
      toast(t('ability.sentGm'), 'success');
    } },
  });
}
