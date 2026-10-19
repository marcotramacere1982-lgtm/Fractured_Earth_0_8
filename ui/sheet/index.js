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
import { openCheck, openShop, openChoice } from './dialogs.js';
import { bonus } from '../../rules/stats.js';
import { formatRoll } from '../../rules/dice.js';
import { turnStatus, newTurn } from '../../rules/turn.js';
import { abilityWeapon } from '../../rules/engines.js';
import { weaponFlow, hackFlow } from './attack-flow.js';
import { openTrade } from './trade.js';
import { itemName } from './inventory-actions.js';
import { findGear, sellPrice } from '../../rules/economy.js';
import { t, getLang } from '../../i18n/index.js';
import { storyPrompt } from '../builder/prompts.js';
import { soundOn, setSound } from '../sound.js';
import { startTour, tourDone, markTourDone } from '../tour.js';
import { ruleText } from '../rule-text.js';

const rollText = (r) => `d20 ${r.roll} vs ${r.effective}`;

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
        ${tourDone('general') ? '' : html`<p class="notice tour-offer"><span>${t('tour.offer')}</span>
          <button class="btn btn--sm btn--primary" data-action="tour" data-id="general">${t('tour.offerStart')}</button>
          <button class="btn btn--sm btn--ghost" data-action="tourSkip">${t('tour.offerNo')}</button></p>`}
        <div class="sheet-nav">
          <nav class="tabs" data-tour="tabs" role="tablist" aria-label="${t('sheet.sections')}">
            ${TABS.map((x) => html`<a class="tab" role="tab" href="${href('sheet', id, x.id)}" aria-selected="${x.id === tab.id}">${t(x.label)}</a>`)}
          </nav>
          <div class="cluster">
            ${crewBadge(table, data)}${soundButton(table)}<button class="btn btn--sm btn--ghost" data-action="tour" data-id="general" title="${t('tour.startHint')}" aria-label="${t('tour.startHint')}">?</button>${tableButton(table, id)}
            <button class="btn btn--sm" data-action="export" title="${t('sheet.exportHint')}">${t('common.export')}</button>
          </div>
        </div>
        <div class="sheet-body">${tab.view(c, s, data, { combat: table?.state.joinedId === id ? table.state.combat : null, atTable: Boolean(table?.state.available) })}</div>
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

  const tableCombat = () => (table?.state.joinedId === id ? table.state.combat : null);
  /** Damage steps after a successful ability: its weapon's dice (Called Shot, Kill Shot…) or a hack's own dice. */
  const abilityFlow = (c, sh, ability) => {
    const onDone = (o) => run('attackDamage', o);
    if (ability.damage) return hackFlow({ ability, onDone });
    const w = abilityWeapon(ability, sh.armed);
    return w && !ability.weapon.noDamage ? weaponFlow({ c, sh, data, w, spec: ability.weapon, onDone }) : null;
  };

  const offClick = delegate(main, 'click', {
    hp: ({ delta }) => run('hp', { delta }),
    heal: () => run('heal'),
    repairArmor: () => run('repairArmor'),
    buyTalent: (d) => run('buyTalent', d),
    driveType: ({ value }) => run('field', { path: 'drive.type', value }),
    payInstalment: () => {
      const out = run('payInstalment');
      if (out) toast(t('downtime.paid', { cr: out.paid, n: out.pressure }), 'success');
    },
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
        { tier: tableTier(), once: true, flow: abilityFlow(c, sh, ability), after: (r) => (!r.success && data.classes.abilityRoll.onFailure === 'spend' ? html`<p class="hint">${t('check.abilityFailed')}</p>` : '') });
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
      openCheck({ name: t(aimed ? 'attack.locatedTitle' : 'attack.title', { weapon: w.name }), tn: w.tn - penalty, sub: aimed ? `${nameOfSkill(w.skill)} · ${t('attack.locatedSub', { n: penalty })}` : nameOfSkill(w.skill) }, data,
        (r) => run('attack', { slot, hit: r.success, rollText: rollText(r), located: aimed }),
        { tier: tableTier(), once: true,
          after: (r) => (r.success ? '' : html`<p class="hint">${w.magSize ? t('attack.missAmmo') : t('attack.miss')}</p>`),
          flow: weaponFlow({ c, sh, data, w, spec: { located: aimed }, exploit: true, combat: tableCombat(), onDone: (o) => run('attackDamage', o) }) });
    },
    dodgeRoll: () => {
      const c = character();
      const sh = deriveSheet(c, data);
      const avoid = sh.skills.find((k) => k.id === 'avoid_reflexes');
      openCheck({ name: t('dodge.title'), tn: avoid.value, sub: `${avoid.name} · ${t('dodge.sub')}` }, data,
        (r) => run('dodge', { success: r.success, rollText: rollText(r) }), { tier: tableTier(), once: true });
    },
    act: ({ kind, detail }) => { const c = character(); if (actionAvailable(c, deriveSheet(c, data))) run('act', { kind, detail }); },
    /** Reload / swap (decision 56): a small choice — reload the weapon in hand, or swap to the other one. */
    reloadPick: () => {
      const c = character();
      const sh = deriveSheet(c, data);
      if (!actionAvailable(c, sh)) return;
      const inHand = sh.weapons.find((w) => w.inHand);
      const other = sh.weapons.find((w) => !w.empty && !w.inHand);
      const choices = [];
      if (inHand?.magSize) {
        const why = inHand.rounds >= inHand.magSize ? t('reload.full') : !inHand.spares ? t('weapons.noSpares') : '';
        choices.push({ value: `r${inHand.slot}`, label: t('reload.reload', { weapon: inHand.name, rounds: inHand.rounds, max: inHand.magSize, n: inHand.spares }), why });
      }
      if (other) choices.push({ value: `s${other.slot}`, label: t('reload.swap', { weapon: other.name }), why: other.usable === false ? t(`weapons.unusable.${other.why}`) : '' });
      if (!choices.length) { toast(t('reload.nothing')); return; }
      openChoice(t('action.reload'), choices, (v) => run(v[0] === 'r' ? 'reload' : 'hand', { slot: v.slice(1) }));
    },
    hand: ({ slot }) => { const c = character(); if (actionAvailable(c, deriveSheet(c, data))) run('hand', { slot }); },
    combatEnd: () => run('combatEnd'),
    /** Decision 50: the GM's Claude writes (or polishes) the backstory; it comes back as a durable message. */
    askBackstory: async () => {
      const c = character();
      const mode = c.narrative.backstoryHtml?.trim() ? 'revise' : 'write';
      const ok = await table?.askBackstory({ id, name: c.name, player: c.player, lang: getLang(), prompt: storyPrompt(c, data), current: c.narrative.backstoryHtml ?? '', mode });
      if (ok) { run('backstoryAsked', { mode }); toast(t('dossier.askedToast'), 'success'); } else toast(t('dossier.askFailed'), 'danger');
    },
    backstoryUndo: () => run('backstoryUndo'),
    soundToggle: () => { setSound(!soundOn()); draw(); },
    /** Decision 55: drop one (asks first). */
    trash: ({ kind, id: itemId }) => {
      const row = character().play.inventory.find((x) => x.kind === kind && x.id === itemId);
      if (row && confirm(t('trade.trashConfirm', { item: itemName(row, data) }))) run('trash', { kind, id: itemId });
    },
    /** Decision 55: sell for half the list price, or hand it to another player at the table. */
    trade: ({ kind, id: itemId }) => {
      const c = character();
      const row = c.play.inventory.find((x) => x.kind === kind && x.id === itemId);
      if (!row) return;
      const name = itemName(row, data);
      const atTable = table?.state.available && table.state.joinedId === id;
      openTrade({ name, price: kind === 'custom' ? null : sellPrice(findGear(kind, itemId, data), data.economy) }, {
        inCombat: Boolean(c.play.turn?.inCombat),
        players: atTable ? async () => (await table.players()).filter((p) => p.id !== id) : null,
        onSell: (price) => { let cash = 0; store.update(id, (draft) => { cash = actions.sell(draft, data, { kind, id: itemId, price }); }); return t('trade.sold', { item: name, n: cash }); },
        onGift: async (player) => {
          const now = character();
          if (!actionAvailable(now, deriveSheet(now, data))) throw new Error(t('turn.noActions'));
          const item = kind === 'custom' ? { kind, name: row.name, note: row.note ?? '' } : { kind, id: itemId };
          if (!(await table.gift(player.id, item))) throw new Error(t('dossier.askFailed'));
          store.update(id, (draft) => { actions.giveItem(draft, data, { kind, id: itemId, toName: player.name }); }); // braces: update() would take a returned object as the new character
          return t('trade.given', { item: name, to: player.name });
        },
      });
    },
    /** Decision 53: guided tours (general, or class.<id>) — they switch tabs as they go. */
    tour: ({ id: tourId }) => {
      const tour = data.tours.tours.find((x) => x.id === tourId);
      if (tour) startTour(tour, { openTab: (tabId) => { if (location.hash !== href('sheet', id, tabId)) go('sheet', id, tabId); }, onClose: () => draw() });
    },
    tourSkip: () => { markTourDone('general'); draw(); },
    copyPrompt: async ({ target }) => {
      const el = document.getElementById(target);
      try { await navigator.clipboard.writeText(el.value); toast(t('builder.copied'), 'success'); } catch { el.select(); document.execCommand('copy'); toast(t('builder.copied')); }
    },
    release: (d) => run('release', d),
    res: (d) => run('res', d),
    setRes: (d) => run('setRes', d),
    techMode: (d) => run('techMode', d),
    tell: ({ key, delta }) => run('tell', { key, delta, combat: table?.state.joinedId === id ? table.state.combat : null }),
    tellTarget: ({ key }) => run('tellTarget', { key }),
    markRemove: ({ key }) => run('markRemove', { key }),
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
    shop: ({ kind, free }) => openShop({ kind, free: Boolean(free) }, character, data, ({ kind: k, id: itemId, method, multiplier, ...rest }) => {
      if (method === 'free') { run('add', { kind: k, id: itemId }); return t('shop.added'); }
      if (method === 'custom') { store.update(id, (draft) => { actions.addCustom(draft, data, rest); }); return t('shop.added'); }
      let notice;
      store.update(id, (draft) => { notice = actions.buy(draft, data, { kind: k, id: itemId, method, multiplier }); });
      return ruleText(notice);
    }),
  });

  const offChange = delegate(main, 'change', {
    slot: (d, e) => run('slot', { slot: d.slot, value: e.target.value }),
    deck: (_, e) => run('deck', { value: e.target.value }),
    optic: (_, e) => run('optic', { value: e.target.value }),
    markAdd: (_, e) => run('markAdd', { name: e.target.value }),
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
/** The crew's shared trust (decision 47), while at the table. */
function crewBadge(table, data) {
  const crew = table?.state.crew;
  if (!crew || !table.state.joinedId) return '';
  const band = data.crew.bands.find((b) => b.id === crew.band);
  return html`<span class="pill crew-pill crew-pill--${crew.band}" title="${band?.effect ?? ''}">${t('crew.badge', { n: crew.value, band: band?.name ?? '' })}</span>`;
}

/** Decision 52: soft sounds at the table (your turn, GM messages, hits), switched per device. */
function soundButton(table) {
  if (!table?.state.available) return '';
  const on = soundOn();
  return html`<button class="btn btn--sm btn--ghost" data-action="soundToggle" aria-pressed="${on}" title="${t('sheet.soundHint')}" aria-label="${t(on ? 'sheet.soundOn' : 'sheet.soundOff')}">${on ? '🔔' : '🔕'}</button>`;
}

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
