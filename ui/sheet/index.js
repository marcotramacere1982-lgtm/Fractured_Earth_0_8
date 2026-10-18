// Character sheet view: #/sheet/<id>/<tab>

import { html, render, delegate, cleanup } from '../dom.js';
import { href, go } from '../router.js';
import { toast } from '../shell.js';
import { deriveSheet } from '../../state/character.js';
import { exportCharacter, shrinkImage } from '../../state/store.js';
import { actions, log } from './actions.js';
import { statusBar, playTab } from './play.js';
import { progressTab } from './progress.js';
import { setExplainSource } from '../explain.js';
import { skillsTab } from './skills.js';
import { gearTab } from './gear.js';
import { dossierTab, notesTab } from './dossier.js';
import { openCheck, openShop } from './dialogs.js';
import { bonus } from '../../rules/stats.js';
import { roll, formatRoll } from '../../rules/dice.js';
import { hitLocations } from '../../rules/body.js';
import { locationRule } from './play.js';
import { rollDamage, turnStatus, newTurn } from '../../rules/turn.js';
import { abilityWeapon, stanceMultiplier } from '../../rules/engines.js';
import { t } from '../../i18n/index.js';
import { ruleText } from '../rule-text.js';

const rollText = (r) => `d20 ${r.roll} vs ${r.effective}`;

/** Breakdown of a damage roll: dice, second roll, bonus dice, OFF, stance multiplier. */
const damageBreakdown = (d) => [formatRoll(d.base ?? d), d.second ? `+ ${formatRoll(d.second)}` : '', d.extra ? `+ ${formatRoll(d.extra)}` : '',
  d.off ? `${d.off > 0 ? '+' : '−'} OFF ${Math.abs(d.off)}` : '', d.flat ? `+ ${d.flat} Hot` : '', d.multiplier !== 1 ? `× ${d.multiplier}` : ''].filter(Boolean).join(' ');

const TABS = [
  { id: 'play', label: 'sheet.tab.play', view: playTab },
  { id: 'skills', label: 'sheet.tab.skills', view: skillsTab },
  { id: 'gear', label: 'sheet.tab.gear', view: gearTab },
  { id: 'dossier', label: 'sheet.tab.dossier', view: dossierTab },
  { id: 'notes', label: 'sheet.tab.notes', view: notesTab },
  { id: 'progress', label: 'sheet.tab.progress', view: progressTab },
];

export function sheetView({ data, store, main, table }, route) {
  const [id, tabId = 'play'] = route.params;
  const tab = TABS.find((x) => x.id === tabId) ?? TABS[0];
  if (!store.get(id)) {
    render(main, html`<div class="card"><div class="empty"><div class="empty__title">${t('sheet.notFound')}</div><a class="btn" href="#/">${t('common.backToCharacters')}</a></div></div>`);
    return;
  }
  store.setActive(id);
  setExplainSource(() => store.get(id));
  const character = () => store.get(id);
  const tableTier = () => (table?.state.joinedId === id ? table.state.difficulty ?? 0 : 0);
  const nameOfSkill = (skillId) => data.skills.skills.find((k) => k.id === skillId)?.name ?? skillId;
  /** In combat, an action needs a free action this round. */
  const actionAvailable = (c, sh) => {
    const ts = turnStatus(c.play.turn ?? newTurn(), sh.combat.act.value, c.play.conditions, data.actions);
    if (ts.inCombat && ts.left <= 0) { toast(t('turn.noActions'), 'danger'); return false; }
    return true;
  };

  const draw = () => {
    const c = character();
    const s = deriveSheet(c, data);
    // keep collapsible sections open across re-renders
    const open = new Set([...main.querySelectorAll('details[data-keep][open]')].map((d) => d.dataset.keep));
    render(main, html`
      <div class="sheet">
        ${statusBar(c, s, data)}
        ${tableBanner(table, id, data)}
        <div class="sheet-nav">
          <nav class="tabs" role="tablist" aria-label="${t('sheet.sections')}">
            ${TABS.map((x) => html`<a class="tab" role="tab" href="${href('sheet', id, x.id)}" aria-selected="${x.id === tab.id}">${t(x.label)}</a>`)}
          </nav>
          <div class="cluster">
            ${tableButton(table, id)}
            <button class="btn btn--sm" data-action="export" title="${t('sheet.exportHint')}">${t('common.export')}</button>
          </div>
        </div>
        <div class="sheet-body">${tab.view(c, s, data, { combat: table?.state.joinedId === id ? table.state.combat : null })}</div>
      </div>`);
    main.querySelectorAll('details[data-keep]').forEach((d) => { if (open.has(d.dataset.keep)) d.open = true; });
  };

  /** Runs a sheet action against the store; errors become toasts. */
  const run = (name, args = {}, opts = {}) => {
    let result;
    try {
      store.update(id, (draft) => { result = actions[name](draft, data, args); }, opts);
    } catch (err) {
      toast(ruleText(err), 'danger');
    }
    return result;
  };

  const checkTarget = ({ kind, id: targetId }) => {
    const c = character();
    if (kind === 'attr') {
      const a = data.attributes.attributes.find((x) => x.id === targetId);
      // attribute check: roll against the attribute value itself
      return { name: t('check.attribute', { name: a.name }), tn: c.attributes[targetId], sub: `${a.id} ${c.attributes[targetId]} (bonus ${bonus(c.attributes[targetId])})` };
    }
    const k = deriveSheet(c, data).skills.find((x) => x.id === targetId);
    return { name: k.name, tn: k.value, sub: k.stats.join(' + ') };
  };

  /** Damage + hit location for a hit with weapon w (normal attack, or an ability firing it). */
  /** Hack damage depends on what the target is (organic / cybernetic / synthetic): roll each option, the GM applies the matching one. */
  function hackDamage(ability) {
    return html`<div class="roll-extra">
      ${ability.damage.map((d) => { const r = roll(d.dice); return html`<div class="roll-extra__main"><span class="label">${t('attack.damage')} · ${t(`tag.${d.vs}`)}</span><span class="roll-extra__n">${r.total}</span><span class="mono muted">${formatRoll(r)}</span></div>`; })}
      <p class="hint">${t('attack.hackNote')}</p></div>`;
  }

  function damagePanel(w, sh, c, spec = {}) {
    const dmg = rollDamage(w, sh.combat.off.value, Math.random, { bonus: spec.bonus, twice: spec.twice, multiplier: stanceMultiplier(c.classId, c.play.resources, data.classes), flat: sh.zone.damage });
    let located = '';
    let where = '';
    if (spec.located) { // a declared location attack: where it lands, and what that does if it gets through
      const loc = roll(data.body.hitLocation.die);
      const ids = hitLocations(loc.total, data.body);
      const bp = data.body.locations.find((l) => l.id === ids[0])?.bp;
      const inj = data.body.injuries[bp];
      const cond = (id) => data.conditions.find((k) => k.id === id)?.name ?? id;
      where = [...new Set(ids.map((x) => t(`body.part.${data.body.locations.find((l) => l.id === x)?.bp}`)))].join(' / ');
      located = html`<div class="roll-extra__main"><span class="label">${t('attack.location')}</span><span class="roll-extra__n">${where}</span><span class="mono muted">d20 ${loc.total} · ${t('attack.aimNote')}</span></div>
        <p class="hint">${t('attack.locationIf', { condition: cond(inj.condition) })}${bp === 'head' ? ` ${locationRule(data).head}` : ''} ${t('attack.locationCrack')}</p>`;
    }
    return {
      text: dmg ? `${dmg.total} damage (${damageBreakdown(dmg)})${where ? ` · ${where}` : ''}` : '',
      html: html`<div class="roll-extra">
        ${dmg ? html`<div class="roll-extra__main"><span class="label">${t('attack.damage')} · ${w.name}</span><span class="roll-extra__n">${dmg.total}</span><span class="mono muted">${damageBreakdown(dmg)}</span></div>` : ''}
        ${located}
        <p class="hint">${spec.armorHalf ? t('attack.armorHalf') : t('attack.armorNote')}</p></div>`,
    };
  }

  const offClick = delegate(main, 'click', {
    hp: ({ delta }) => run('hp', { delta }),
    heal: () => run('heal'),
    repairArmor: () => run('repairArmor'),
    buyTalent: (d) => run('buyTalent', d),
    raiseAttribute: (d) => run('raiseAttribute', d),
    useTalent: (d) => {
      const out = run('useTalent', d);
      if (out?.rolled) toast(t('progress.healed', { roll: formatRoll(out.rolled) }), 'success');
    },
    armorCrack: (d) => run('armorCrack', d),
    injury: (d) => run('injury', d),
    takeHit: () => {
      const form = main.querySelector('[data-hit-form]');
      const damage = Number(form?.elements.damage.value);
      if (!form || !(damage >= 0) || form.elements.damage.value === '') { toast(t('hit.needDamage'), 'danger'); return; }
      const loc = form.elements.loc.value;
      const out = run('takeHit', { damage, loc });
      if (!out) return;
      const cond = out?.condition ? data.conditions.find((k) => k.id === out.condition)?.name : null;
      toast([t('hit.lost', { n: out.taken }), cond ? t('hit.condition', { condition: cond }) : '', out.crack ? t('hit.cracked') : ''].filter(Boolean).join(' '), out.taken || cond ? 'danger' : 'success');
    },
    cover: ({ value }) => run('cover', { value }),
    condition: ({ id: cid }) => run('condition', { id: cid }),
    attr: (d) => run('attr', d),
    ammo: (d) => run('ammo', d),
    reload: (d) => run('reload', d),
    wear: (d) => run('wear', d),
    qty: (d) => run('qty', d),
    dropLifestyle: (d) => run('dropLifestyle', d),
    maxAbilities: (d) => run('maxAbilities', d),
    equip: (d) => run('equip', d),
    abilityRoll: ({ id: abilityId, resonant }) => {
      const c = character();
      const sh = deriveSheet(c, data);
      if (!sh.class || !actionAvailable(c, sh)) return;
      const ability = data.abilities[c.classId].find((a) => a.id === abilityId);
      if (ability.auto) { run('useRolled', { id: abilityId, success: true, rollText: 'no roll' }); return; } // housekeeping: no Class TN roll
      openCheck({ name: resonant ? `${ability.name} · ${t('engine.resonantCast')}` : ability.name, tn: sh.class.tn, sub: `Class TN · ${sh.class.subclass.name}` }, data,
        (r) => run('useRolled', { id: abilityId, success: r.success, rollText: rollText(r), resonant: Boolean(resonant) }),
        { tier: tableTier(), once: true, after: (r) => {
          if (!r.success) return data.classes.abilityRoll.onFailure === 'spend' ? html`<p class="hint">${t('check.abilityFailed')}</p>` : '';
          if (ability.damage) return hackDamage(ability);
          const w = abilityWeapon(ability, sh.weapons);
          if (!w || ability.weapon.noDamage) return '';
          return damagePanel(w, sh, c, ability.weapon).html;
        } });
    },
    attackRoll: ({ slot, located }) => {
      const c = character();
      const sh = deriveSheet(c, data);
      const w = sh.weapons.find((x) => String(x.slot) === String(slot));
      if (!w || w.empty || !actionAvailable(c, sh)) return;
      if (w.usable === false) { toast(t(`weapons.unusable.${w.why}`), 'danger'); return; }
      if (w.magSize && w.rounds <= 0) { toast(t('attack.empty', { weapon: w.name }), 'danger'); return; }
      const aimed = Boolean(located);
      const penalty = aimed ? sh.locationPenalty : 0; // Marksman lowers it
      let damageText = '';
      openCheck({ name: t(aimed ? 'attack.locatedTitle' : 'attack.title', { weapon: w.name }), tn: w.tn - penalty, sub: aimed ? `${nameOfSkill(w.skill)} · ${t('attack.locatedSub', { n: penalty })}` : nameOfSkill(w.skill) }, data,
        (r) => run('attack', { slot, hit: r.success, rollText: rollText(r), damageText, located: aimed }),
        { tier: tableTier(), once: true, after: (r) => {
          if (!r.success) return html`<p class="hint">${w.magSize ? t('attack.missAmmo') : t('attack.miss')}</p>`;
          const panel = damagePanel(w, sh, c, { located: aimed });
          damageText = panel.text;
          return panel.html;
        } });
    },
    dodgeRoll: () => {
      const c = character();
      const sh = deriveSheet(c, data);
      const avoid = sh.skills.find((k) => k.id === 'avoid_reflexes');
      openCheck({ name: t('dodge.title'), tn: avoid.value, sub: `${avoid.name} · ${t('dodge.sub')}` }, data,
        (r) => run('dodge', { success: r.success, rollText: rollText(r) }), { tier: tableTier(), once: true });
    },
    act: ({ kind, detail }) => { const c = character(); if (actionAvailable(c, deriveSheet(c, data))) run('act', { kind, detail }); },
    reloadPick: () => {
      const c = character();
      const sh = deriveSheet(c, data);
      const w = sh.weapons.filter((x) => !x.empty && x.magSize && x.rounds < x.magSize).sort((a, b) => a.rounds - b.rounds)[0];
      if (!w) { toast(t('reload.full')); return; }
      if (actionAvailable(c, sh)) run('reload', { slot: w.slot });
    },
    combatEnd: () => run('combatEnd'),
    release: (d) => run('release', d),
    res: (d) => run('res', d),
    setRes: (d) => run('setRes', d),
    techMode: (d) => run('techMode', d),
    deckMod: (d) => run('deckMod', d),
    roundEnd: () => run('roundEnd'),
    combatStart: () => run('combatStart'),
    portraitClear: () => run('field', { path: 'portrait.dataUrl', value: '' }),
    export: () => exportCharacter(character()),
    joinTable: () => table.join(id),
    leaveTable: () => table.leave(),
    check: (d) => {
      const target = checkTarget(d);
      openCheck(target, data, (r) => store.update(id, (c) => {
        log(c, `${target.name}: rolled ${r.roll} vs ${r.effective} → ${r.success ? 'success' : 'failure'} (${r.margin >= 0 ? '+' : ''}${r.margin})`, r.success ? 'ok' : 'bad');
      }), { tier: tableTier() });
    },
    shop: ({ kind, free }) => openShop({ kind, free: Boolean(free) }, character, data, ({ kind: k, id: itemId, method, multiplier }) => {
      if (method === 'free') { run('add', { kind: k, id: itemId }); return t('shop.added'); }
      let notice;
      store.update(id, (draft) => { notice = actions.buy(draft, data, { kind: k, id: itemId, method, multiplier }); });
      return ruleText(notice);
    }),
  });

  const offChange = delegate(main, 'change', {
    slot: (d, e) => run('slot', { slot: d.slot, value: e.target.value }),
    deck: (_, e) => run('deck', { value: e.target.value }),
    subclass: (_, e) => run('subclass', { value: e.target.value }),
    cash: (_, e) => run('cash', { value: e.target.value }),
    field: (d, e) => run('field', { path: d.path, value: d.number ? Number(e.target.value) : e.target.value }),
    async portrait(_, e) {
      const file = e.target.files[0];
      if (!file) return;
      try { run('field', { path: 'portrait.dataUrl', value: await shrinkImage(file) }); }
      catch { toast(t('dossier.badImage'), 'danger'); }
    },
  });

  // typing in notes must not re-render (keeps focus and cursor)
  const offInput = delegate(main, 'input', {
    notes: (_, e) => store.update(id, (c) => { c.play.notes = e.target.value; }, { silent: true }),
  });

  const unsubscribe = store.subscribe((change) => { if (change.id === id && change.type === 'update' && !change.silent) draw(); });
  const offTable = table?.subscribe(() => draw());

  draw();
  return cleanup(offClick, offChange, offInput, unsubscribe, offTable);
}

/** Join / leave the GM's live table (only shown when the app is served by the table server). */
function tableButton(table, id) {
  if (!table?.state.available) return '';
  const here = table.state.joinedId === id;
  if (!here) return html`<button class="btn btn--sm btn--primary" data-action="joinTable" title="${t('table.joinHint')}">${t('table.join')}</button>`;
  return html`<button class="btn btn--sm" data-action="leaveTable" title="${t('table.leaveHint')}">${table.state.online ? `● ${t('table.here')}` : `○ ${t('table.reconnecting')}`}</button>`;
}

function tableBanner(table, id, data) {
  if (table?.state.joinedId !== id || table.state.difficulty == null) return '';
  const tier = data.difficulty.tiers.find((x) => x.id === table.state.difficulty);
  return tier ? html`<p class="notice notice--warn">${t('table.difficulty')}: <strong>${tier.name} (−${tier.penalty})</strong> — ${t('table.difficultyNote')}</p>` : '';
}

export { go };
