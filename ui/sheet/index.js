// Character sheet view: #/sheet/<id>/<tab>

import { html, render, delegate, cleanup, signed } from '../dom.js';
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
import { weaponFlow, hackFlow } from './attack-flow.js';
import { openTrade } from './trade.js';
import { startUseItem } from './use-item.js';
import { toolsFor } from '../../rules/tools.js';
import { withUniques } from '../../rules/uniques.js';
import { abilityWeapon, isRanged } from '../../rules/engines.js';
import { itemName } from './inventory-actions.js';
import { findGear, sellPrice, nextIsOfficial } from '../../rules/economy.js';
import { t, getLang } from '../../i18n/index.js';
import { storyPrompt } from '../builder/prompts.js';
import { soundOn, setSound } from '../sound.js';
import { startTour, tourDone, markTourDone } from '../tour.js';
import { ruleText } from '../rule-text.js';
import { boostsFor } from './check-boosts.js';
import { mapTab, attachMap, mapBusy, mapFit, mapZoom, clearTarget, targetSeen, toggleSky, toggleSide, openSide } from './map-tab.js';
import { attachMemory, memoryBusy, toggleMemory, memoryFit, memoryZoom, toggleMemorySky } from './map-memories.js';
import { forgetMap, noteMap } from '../../rules/map-memory.js';
import { markHandlers, myMarkColor } from './map-marks.js';
import { carriesTorch, visionOf } from '../../rules/light.js';
import { lightOptions, lightKind, squareLight } from '../../rules/darkness.js';
import { frameOf } from '../portrait.js';

const rollText = (r) => `d20 ${r.roll} vs ${r.effective}${r.tool ? ` (+${r.tool.tn} ${r.tool.name})` : ''}${r.light ? ` (${r.light.label} ${r.light.tn > 0 ? '+' : ''}${r.light.tn})` : ''}`;

const TABS = [
  { id: 'play', label: 'sheet.tab.play', view: playTab },
  { id: 'skills', label: 'sheet.tab.skills', view: skillsTab },
  { id: 'gear', label: 'sheet.tab.gear', view: gearTab },
  { id: 'dossier', label: 'sheet.tab.dossier', view: dossierTab },
  { id: 'notes', label: 'sheet.tab.notes', view: notesTab },
  { id: 'progress', label: 'sheet.tab.progress', view: progressTab },
  { id: 'map', label: 'sheet.tab.map', view: mapTab }, // only while the GM has a map on the table (decision 64)
];

export function sheetView({ data, store, main, table }, route) {
  const [id, tabId = 'play'] = route.params;
  const tableMap = () => (table?.state.joinedId === id ? table.state.map : null);
  const tabs = () => TABS.filter((x) => x.id !== 'map' || tableMap());
  const tableMarks = () => (table?.state.joinedId === id ? table.state.marks : null); // decision 82
  const sendMark = (body) => (tableMap() ? table.mark(tableMap().id, body) : Promise.resolve(false));
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

  // decision 97: the action buttons show names + the live number; descriptions on demand, remembered per device
  // decision 134: on the Active map the status bar is one slim row unless opened (remembered per device)
  const STATUS = 'fe.sheet.mapStatusOpen';
  const statusOpen = () => { try { return localStorage.getItem(STATUS) === '1'; } catch { return false; } };
  const TIPS = 'fe.sheet.actionTips';
  const tipsOn = () => { try { return localStorage.getItem(TIPS) === '1'; } catch { return false; } };
  const draw = () => {
    if (mapBusy() || memoryBusy()) return; // a finger on the map: it redraws when the finger lifts
    const tab = tabs().find((x) => x.id === tabId) ?? TABS[0];
    const c = character();
    const s = deriveSheet(c, data);
    // keep collapsible sections open across re-renders
    const open = new Set([...main.querySelectorAll('details[data-keep][open]')].map((d) => d.dataset.keep));
    render(main, html`
      <div class="sheet">
        ${statusBar(c, s, data, { compact: tab.id === 'map' && !statusOpen() })}${tab.id === 'map' && statusOpen() ? html`<button class="btn btn--sm btn--ghost sheet-status__less" data-action="statusOpen">${t('status.collapse')}</button>` : ''}
        ${tableBanner(table, id, data)}
        ${tourDone('general') ? '' : html`<p class="notice tour-offer"><span>${t('tour.offer')}</span>
          <button class="btn btn--sm btn--primary" data-action="tour" data-id="general">${t('tour.offerStart')}</button>
          <button class="btn btn--sm btn--ghost" data-action="tourSkip">${t('tour.offerNo')}</button></p>`}
        <div class="sheet-nav">
          <nav class="tabs" data-tour="tabs" role="tablist" aria-label="${t('sheet.sections')}">
            ${tabs().map((x) => html`<a class="tab ${x.id === 'map' ? 'tab--live' : ''}" role="tab" href="${href('sheet', id, x.id)}" aria-selected="${x.id === tab.id}">${t(x.label)}</a>`)}
          </nav>
          <div class="cluster">
            ${crewBadge(table, data)}${soundButton(table)}<button class="btn btn--sm btn--ghost" data-action="tour" data-id="general" title="${t('tour.startHint')}" aria-label="${t('tour.startHint')}">?</button>${tableButton(table, id)}
            <button class="btn btn--sm" data-action="export" title="${t('sheet.exportHint')}">${t('common.export')}</button>
          </div>
        </div>
        <div class="sheet-body">${tab.view(c, s, withUniques(data, c), { combat: table?.state.joinedId === id ? table.state.combat : null, atTable: Boolean(table?.state.available), map: tableMap(), id, mapMove: tab.id === 'map' ? mapMove() : null, doorUse: tab.id === 'map' ? doorUse() : null, torch: tab.id === 'map' ? (carriesTorch(c, withUniques(data, c)) ? Boolean(c.play.torch) : null) : null, actionTips: tipsOn(), mapDark: tab.id === 'play' && c.classId === 'scavenger' && tableMap() ? (() => { const d = darkCtx(); return d.dark && !d.lit; })() : null, marks: tableMarks(), myColor: myMarkColor(c, data, tableMap()) })}</div>
      </div>`);
    if (tab.id === 'map') attachMap(main, data, tableMap(), id, { onIdle: draw, move: mapMove, onMove: mapMoved, marks: tableMarks(), myColor: myMarkColor(c, data, tableMap()), onMark: sendMark });
    if (tab.id === 'notes') attachMemory(main, data, c, draw); // decision 122
    main.querySelectorAll('details[data-keep]').forEach((d) => { if (open.has(d.dataset.keep)) d.open = true; });
  };

  /**
   * Decision 64, step 3: may this player drag their marker now? In combat: their turn, an action left, up to
   * their move; out of combat: freely (data.map.move.explore). null: not on the map or the GM moves markers.
   */
  const mapMove = () => {
    const map = tableMap();
    if (!map?.canMove || !map.tokens.some((tk) => tk.key === id)) return null;
    const combat = tableCombat();
    if (!combat?.active) return { max: data.map.move.explore, combat: false };
    if (combat.current !== id) return { why: 'notTurn' };
    const c = character();
    const s = deriveSheet(c, data);
    const turn = c.play.turn ?? newTurn();
    const left = turn.moveLeft ?? 0; // squares left from this round's Move (decision 73)
    const more = turnStatus(turn, s.combat.act.value, c.play.conditions, data.actions).left > 0 ? s.move : 0;
    if (!left && !more) return { why: 'noActions' };
    return { max: left + more, combat: true, left, move: s.move };
  };
  /** Doors (decision 73): may this player open / close a door next to them now? 'ok' | 'gm' | 'wait' | 'noActions' */
  const doorUse = () => {
    const map = tableMap();
    if (!map?.canMove) return 'gm';
    const combat = tableCombat();
    if (!combat?.active) return 'ok';
    if (combat.current !== id) return 'wait';
    const c = character();
    return turnStatus(c.play.turn ?? newTurn(), deriveSheet(c, data).combat.act.value, c.play.conditions, data.actions).left > 0 ? 'ok' : 'noActions';
  };
  /** A move the sheet accepted: in combat it is a Move action (logged); then the GM console applies it. */
  const mapMoved = (to, steps, inCombat) => {
    if (inCombat) {
      try {
        store.update(id, (d) => { actions.mapMove(d, withUniques(data, d), { steps }); });
      } catch (err) { toast(ruleText(err), 'danger'); return false; }
    }
    table.move(tableMap().id, to);
    return true;
  };

  /**
   * Decision 76: the light situation for a check. With a map on the table (fog on) your own square decides;
   * otherwise the GM's table-wide Light switch. lit: a light reaches you, or your torch is on.
   */
  const darkCtx = () => {
    const c = character();
    const wd = withUniques(data, c);
    const map = tableMap();
    const me = map?.tokens.find((tk) => tk.key === id);
    const square = map && 'light' in map && me ? squareLight(map, me) : null;
    const dark = square ? square.dark : table?.state.joinedId === id && table.state.light === true;
    const torch = Boolean(c.play.torch && carriesTorch(c, wd));
    return { dark, lit: Boolean(square?.lit) || (dark && torch), vision: visionOf(c, wd), target: targetSeen(map, id) };
  };
  const lightFor = (kind) => { const l = kind ? lightOptions(kind, darkCtx(), data) : null; return l ? { ...l, kind } : null; };

  /** Runs a sheet action against the store; errors become toasts. */
  const run = (name, args = {}, opts = {}) => {
    let result;
    try {
      store.update(id, (draft) => { result = actions[name](draft, withUniques(data, draft), args); }, opts); // uniques read like catalog entries
    } catch (err) {
      toast(ruleText(err), 'danger');
    }
    return result;
  };

  const checkTarget = ({ kind, id: targetId }) => {
    const c = character();
    const s = deriveSheet(c, data);
    if (kind === 'attr') {
      const a = data.attributes.attributes.find((x) => x.id === targetId);
      const v = s.attributes[targetId]; // with item boosts (decision 58)
      // attribute check: roll against the attribute value itself
      return { name: t('check.attribute', { name: a.name }), tn: v, sub: `${a.id} ${v} (bonus ${bonus(v)})`, tools: toolsFor(c.play.inventory, data.items, { attr: targetId }), boosts: boostsFor(c, data, { kind: 'attr', id: targetId }) };
    }
    const k = s.skills.find((x) => x.id === targetId);
    return { name: k.name, tn: k.value, sub: k.stats.join(' + '), tools: toolsFor(c.play.inventory, data.items, { skill: targetId }), boosts: boostsFor(c, data, { kind: 'skill', id: targetId }) };
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
    actionTips: () => { try { localStorage.setItem(TIPS, tipsOn() ? '0' : '1'); } catch { /* private mode: stays as is */ } draw(); },
    attackRoll: ({ slot, located }) => {
      const c = character();
      const sh = deriveSheet(c, data);
      const w = sh.weapons.find((x) => String(x.slot) === String(slot));
      if (!w || w.empty || !actionAvailable(c, sh)) return;
      if (w.usable === false) { toast(t(`weapons.unusable.${w.why}`), 'danger'); return; }
      if (w.magSize && w.rounds <= 0) { toast(t('attack.empty', { weapon: w.name }), 'danger'); return; }
      // decision 97: one Attack button; where to aim (body, or ⌖ a location at −N TN) is chosen in the roll window
      const spec = { located: Boolean(located) };
      const aim = { pick: spec.located ? 'located' : 'body', onPick: (id) => { spec.located = id === 'located'; },
        options: [{ id: 'body', tn: 0, label: t('attack.aimBody') }, { id: 'located', tn: -sh.locationPenalty, label: `⌖ ${t('turn.located')}`, hint: t('turn.locatedHint') }] }; // Marksman lowers the penalty
      openCheck({ name: t('attack.title', { weapon: w.name }), tn: w.tn, sub: nameOfSkill(w.skill) }, data,
        (r) => run('attack', { slot, hit: r.success, rollText: rollText(r), located: spec.located }),
        { tier: tableTier(), once: true, aim, tools: toolsFor(c.play.inventory, data.items, { skill: w.skill, attack: isRanged(w) ? 'gun' : null }), light: lightFor('attack'), boosts: boostsFor(c, data, { kind: 'weapon', slot }),
          after: (r) => (r.success ? '' : html`<p class="hint">${w.magSize ? t('attack.missAmmo') : t('attack.miss')}</p>`),
          flow: weaponFlow({ c, sh, data, w, spec, exploit: true, combat: tableCombat(), onDone: (o) => run('attackDamage', o) }) });
    },
    dodgeRoll: () => {
      const c = character();
      const sh = deriveSheet(c, data);
      const avoid = sh.skills.find((k) => k.id === 'avoid_reflexes');
      openCheck({ name: t('dodge.title'), tn: avoid.value, sub: `${avoid.name} · ${t('dodge.sub')}` }, data,
        (r) => run('dodge', { success: r.success, rollText: rollText(r) }), { tier: tableTier(), once: true, boosts: boostsFor(c, data, { kind: 'skill', id: 'avoid_reflexes' }) });
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
    /** Decision 58: use a consumable (1 action in combat) — from the Turn card or an inventory row. */
    useItem: ({ id: itemId }) => {
      const c = character();
      if (!actionAvailable(c, deriveSheet(c, data))) return;
      startUseItem({ character, data, run, onlyId: itemId ?? null, onUsed: (item) => { // decision 75: a flare lands on the table map
        const map = tableMap();
        if (item.light?.drop && map?.tokens.some((tk) => tk.key === id)) table.flare(map.id);
      } });
    },
    endEffect: ({ id: effectId }) => run('endEffect', { id: effectId }),
    storyUse: ({ id: itemId }) => { run('storyUse', { id: itemId }); toast(t('use.storyDone')); },
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
      const name = itemName(row, withUniques(data, c));
      const atTable = table?.state.available && table.state.joinedId === id;
      const registered = nextIsOfficial(row);
      const unfenceable = Boolean(row.unique && !row.unique.cost?.cr); // a unique the GM marked "can't be fenced"
      openTrade({ name, registered, unfenceable, price: kind === 'custom' ? null : sellPrice(findGear(kind, itemId, withUniques(data, c)), data.economy, { official: registered }) }, {
        inCombat: Boolean(c.play.turn?.inCombat),
        players: atTable ? async () => (await table.players()).filter((p) => p.id !== id) : null,
        onSell: (price) => { let cash = 0; store.update(id, (draft) => { cash = actions.sell(draft, data, { kind, id: itemId, price }); }); return t('trade.sold', { item: name, n: cash }); },
        onGift: async (player) => {
          const now = character();
          if (!actionAvailable(now, deriveSheet(now, data))) throw new Error(t('turn.noActions'));
          const item = kind === 'custom' ? { kind, name: row.name, note: row.note ?? '' } : { kind, id: itemId, official: registered, ...(row.unique ? { unique: row.unique } : {}) };
          if (!(await table.gift(player.id, item))) throw new Error(t('dossier.askFailed'));
          store.update(id, (draft) => { actions.giveItem(draft, data, { kind, id: itemId, toName: player.name }); }); // braces: update() would take a returned object as the new character
          return t('trade.given', { item: name, to: player.name });
        },
      });
    },
    /** Decision 53: guided tours (general, or class.<id>) — they switch tabs as they go. */
    tour: ({ id: tourId }) => {
      const tour = data.tours.tours.find((x) => x.id === tourId);
      if (tourId === 'map') openSide(); // the tour points at the side panel
      if (tour) startTour(tour, { openTab: (tabId) => { if (location.hash !== href('sheet', id, tabId)) go('sheet', id, tabId); }, onClose: () => draw() });
    },
    statusOpen: () => { try { localStorage.setItem(STATUS, statusOpen() ? '0' : '1'); } catch { /* private mode */ } draw(); },
    mapSide: () => { toggleSide(); draw(); }, // decision 134
    tourSkip: ({ id: tourId }) => { markTourDone(tourId ?? 'general'); draw(); },
    copyPrompt: async ({ target }) => {
      const el = document.getElementById(target);
      try { await navigator.clipboard.writeText(el.value); toast(t('builder.copied'), 'success'); } catch { el.select(); document.execCommand('copy'); toast(t('builder.copied')); }
    },
    release: (d) => run('release', d),
    res: (d) => run('res', d),
    setRes: (d) => run('setRes', d),
    techMode: (d) => run('techMode', d),
    tell: ({ key, delta }) => run('tell', { key, delta, combat: table?.state.joinedId === id ? table.state.combat : null }),
    tellSet: ({ key, n }) => { // decision 90: tap a diamond to set that many Tells; tap the last one lit to take it off
      const have = character().play.resources?.tells?.[key] ?? 0;
      const want = Number(n) === have ? have - 1 : Number(n);
      if (want !== have) run('tell', { key, delta: want - have, combat: table?.state.joinedId === id ? table.state.combat : null });
    },
    tellTarget: ({ key }) => run('tellTarget', { key }),
    markRemove: ({ key }) => run('markRemove', { key }),
    deckMod: (d) => run('deckMod', d),
    roundEnd: () => run('roundEnd'),
    combatStart: () => run('combatStart'),
    portraitClear: () => { run('field', { path: 'portrait.dataUrl', value: '' }); run('field', { path: 'portrait.frame', value: null }); },
    portraitReset: () => run('field', { path: 'portrait.frame', value: null }),
    export: () => exportCharacter(character()),
    mapFit: () => mapFit(),
    mapSkyline: () => { toggleSky(); draw(); }, // decision 123
    memSkyline: () => { toggleMemorySky(); draw(); },
    memOpen: ({ key }) => { toggleMemory(key); draw(); }, // decision 122: maps we've seen
    memFit: () => memoryFit(),
    memZoom: ({ dir }) => memoryZoom(dir),
    memForget: ({ key }) => {
      const m = (character().play.mapMemories ?? []).find((x) => x.key === key);
      if (m && confirm(t('memory.forgetConfirm', { name: m.name }))) store.update(id, (c) => { c.play.mapMemories = forgetMap(c.play.mapMemories, key); });
    },
    mapZoom: ({ dir }) => mapZoom(dir),
    mapTarget: () => { clearTarget(); draw(); },
    mapInfoClose: () => { clearTarget(); draw(); },
    mapTorch: ({ on }) => run('torch', { on: on === '1' }),
    fixStance: ({ value }) => run('fixStance', { value }), // decision 88: a hand correction, logged
    ...markHandlers({ draw, run, send: sendMark }),
    inDark: ({ on }) => run('inDark', { on: on === '1' }),
    mapDoor: ({ door, open }) => { // a door next to the player's marker: an Interact action in combat; the GM console checks the lock
      if (tableCombat()?.active) {
        try {
          store.update(id, (d) => { actions.act(d, withUniques(data, d), { kind: 'interact', detail: `${open === '1' ? 'opens' : 'closes'} a door on the map` }); });
        } catch (err) { toast(ruleText(err), 'danger'); return; }
      }
      table.door(tableMap().id, door, open === '1');
    },
    joinTable: () => table.join(id),
    leaveTable: () => table.leave(),
    check: (d) => {
      const target = checkTarget(d);
      openCheck(target, data, (r) => store.update(id, (c) => {
        log(c, `${target.name}: rolled ${r.roll} vs ${r.effective}${r.tool ? ` (+${r.tool.tn} ${r.tool.name})` : ''}${r.light ? ` (${r.light.label} ${r.light.tn > 0 ? '+' : ''}${r.light.tn})` : ''} → ${r.success ? 'success' : 'failure'} (${r.margin >= 0 ? '+' : ''}${r.margin})`, r.success ? 'ok' : 'bad');
      }), { tier: tableTier(), tools: target.tools, boosts: target.boosts, light: d.kind === 'skill' ? lightFor(lightKind(d.id)) : null });
    },
    shop: ({ kind, free }) => openShop({ kind, free: Boolean(free) }, character, withUniques(data, character()), ({ kind: k, id: itemId, method, multiplier, ...rest }) => {
      if (method === 'free') { run('add', { kind: k, id: itemId }); return t('shop.added'); }
      if (method === 'choose') { run('chooseLifestyle', { id: itemId }); return t('shop.chosen'); }
      if (method === 'drop') { run('dropLifestyle', { id: itemId }); return t('shop.dropped'); }
      if (method === 'custom') { store.update(id, (draft) => { actions.addCustom(draft, data, rest); }); return t('shop.added'); }
      let notice;
      store.update(id, (draft) => { notice = actions.buy(draft, data, { kind: k, id: itemId, method, multiplier }); });
      return ruleText(notice);
    }),
  });

  // decision 96: portrait framing — the sliders preview live and save on release; dragging the photo moves it
  const framePreview = (el, key, value) => {
    const frame = el.closest('.portrait')?.querySelector('.portrait-frame');
    if (frame) frame.style.setProperty({ x: '--px', y: '--py', zoom: '--pz', light: '--pl' }[key], key === 'x' || key === 'y' ? `${value}%` : String(value));
  };
  const saveFrame = (patch) => run('field', { path: 'portrait.frame', value: { ...frameOf(character().portrait), ...patch } });
  const onFrameDown = (e) => {
    const frame = e.target.closest('[data-frame-drag]');
    if (!frame || !main.contains(frame)) return;
    e.preventDefault();
    frame.setPointerCapture?.(e.pointerId);
    const start = frameOf(character().portrait);
    const box = frame.getBoundingClientRect();
    const x0 = e.clientX; const y0 = e.clientY;
    let now = { x: start.x, y: start.y };
    const move = (ev) => {
      // dragging right shows more of the left side: the focus point moves the other way, slower when zoomed in
      now = { x: Math.min(100, Math.max(0, start.x - ((ev.clientX - x0) / box.width) * 100 / start.zoom)), y: Math.min(100, Math.max(0, start.y - ((ev.clientY - y0) / box.height) * 100 / start.zoom)) };
      frame.style.setProperty('--px', `${now.x}%`); frame.style.setProperty('--py', `${now.y}%`);
    };
    const up = () => {
      frame.removeEventListener('pointermove', move); frame.removeEventListener('pointerup', up); frame.removeEventListener('pointercancel', up);
      if (now.x !== start.x || now.y !== start.y) saveFrame({ x: Math.round(now.x), y: Math.round(now.y) });
    };
    frame.addEventListener('pointermove', move); frame.addEventListener('pointerup', up); frame.addEventListener('pointercancel', up);
  };
  main.addEventListener('pointerdown', onFrameDown);

  const offChange = delegate(main, 'change', {
    portraitFrame: ({ key }, e) => saveFrame({ [key]: Number(e.target.value) }),
    slot: (d, e) => run('slot', { slot: d.slot, value: e.target.value }),
    deck: (_, e) => run('deck', { value: e.target.value }),
    optic: (_, e) => run('optic', { value: e.target.value }),
    markAdd: (_, e) => run('markAdd', { name: e.target.value }),
    subclass: (_, e) => run('subclass', { value: e.target.value }),
    cash: (_, e) => run('cash', { value: e.target.value }),
    field: (d, e) => run('field', { path: d.path, value: d.number ? Number(e.target.value) : e.target.value }),
    memNote: ({ key }, e) => store.update(id, (c) => { c.play.mapMemories = noteMap(c.play.mapMemories, key, e.target.value); }),
    async portrait(_, e) {
      const file = e.target.files[0];
      if (!file) return;
      try { run('field', { path: 'portrait.dataUrl', value: await shrinkImage(file) }); run('field', { path: 'portrait.frame', value: null }); } // a new photo starts unframed
      catch { toast(t('dossier.badImage'), 'danger'); }
    },
  });

  // typing in notes must not re-render (keeps focus and cursor)
  const offInput = delegate(main, 'input', {
    portraitFrame: ({ key }, e) => framePreview(e.target, key, e.target.value),
    notes: (_, e) => store.update(id, (c) => { c.play.notes = e.target.value; }, { silent: true }),
  });

  const unsubscribe = store.subscribe((change) => { if (change.id === id && change.type === 'update' && !change.silent) draw(); });
  const offTable = table?.subscribe(() => draw());

  draw();
  return cleanup(offClick, offChange, offInput, unsubscribe, offTable, () => main.removeEventListener('pointerdown', onFrameDown));
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
  return tier ? html`<p class="notice ${tier.penalty < 0 ? 'notice--ok' : 'notice--warn'}">${t('table.difficulty')}: <strong>${tier.name} (${signed(-tier.penalty)})</strong> — ${t('table.difficultyNote')}</p>` : '';
}

export { go };
