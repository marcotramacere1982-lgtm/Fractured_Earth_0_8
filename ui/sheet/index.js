// Character sheet view: #/sheet/<id>/<tab>

import { html, render, delegate, cleanup, signed } from '../dom.js';
import { href, go } from '../router.js';
import { toast } from '../shell.js';
import { deriveSheet } from '../../state/character.js';
import { exportCharacter, shrinkImage } from '../../state/store.js';
import { actions, log } from './actions.js';
import { statusBar } from './play.js';
import { sheetTab, setOpen, isOpen, SECTIONS, onSectionToggle } from './sheet-tab.js';
import { progressTab } from './progress.js';
import { setExplainSource } from '../explain.js';
import { findSkill } from './skills.js';
import { tacticalView } from './tactical.js';
import { dossierTab, notesTab } from './dossier.js';
import { openCheck, openShop, openChoice, openDialog, setTierLock } from './dialogs.js';
import { withinReach, knowsLocked } from '../../rules/interact.js';
import { nameEn } from '../../data/index.js';
import { bothNames } from '../term.js';
import { flightOutcome, checkFlight } from '../../rules/drone.js';
import { droneAbility } from '../../rules/field-drone.js';
import { openWeaponMods } from './weapon-mods-dialog.js';
import { bonus } from '../../rules/stats.js';
import { formatRoll, roll as rollDice, typedRoll } from '../../rules/dice.js';
import { turnStatus, newTurn, loadoutOpen } from '../../rules/turn.js';
import { studyLevel, studiedEdge, intelFor } from '../../rules/intel.js';
import { weaponFlow, hackFlow, locationTable } from './attack-flow.js';
import { attackCrit, critUpTo, fumbleFrom, fumbleKind, jams } from '../../rules/crits.js';
import { info as ruleInfo } from '../ref.js';
import { againstMods } from '../../rules/conditions.js';
import { openTrade } from './trade.js';
import { startUseItem } from './use-item.js';
import { toolsFor } from '../../rules/tools.js';
import { withUniques } from '../../rules/uniques.js';
import { abilityWeapon, isRanged } from '../../rules/engines.js';
import { itemName } from './inventory-actions.js';
import { crewStashHandlers } from './crew-stash-handlers.js';
import { initiativeHandlers, prepareHandlers } from './initiative.js';
import { tableStrip, startStripClock } from './table-strip.js';
import { whisperButton, openWhisper } from './whisper.js';
import { hitHandlers } from './hit-handlers.js';
import { playAbility, detonate } from './ability-play.js';
import { findGear, sellPrice, nextIsOfficial } from '../../rules/economy.js';
import { t, tn, getLang } from '../../i18n/index.js';
import { storyPrompt } from '../builder/prompts.js';
import { soundOn, setSound } from '../sound.js';
import { startTour, tourDone, markTourDone } from '../tour.js';
import { ruleText } from '../rule-text.js';
import { boostsFor } from './check-boosts.js';
import { mapTab, attachMap, mapBusy, mapFit, mapZoom, clearTarget, targetSeen, toggleSky, mapTarget, coverTo } from './map-tab.js';
import { railOpen } from '../rails.js';
import { loadoutOverlay, openSwap, closeSwap } from './loadout.js';
import { hitOverlay, grantOverlay } from './hits.js';
import { strainOverlay } from './strain.js'; // decision 266
import { steadyAmount } from '../../rules/strain.js';
import { contactOverlay, closeContact } from './contact.js';
import { overwatchOverlay, closeOverwatch } from './overwatch.js';
import { DIRS, reachOf } from '../../rules/overwatch.js';
import { callOverlay } from './calls.js';
import { abilityWindow, toggleClassBar } from './class-bar.js';
import { attachMemory, memoryBusy, toggleMemory, memoryFit, memoryZoom, toggleMemorySky } from './map-memories.js';
import { forgetMap, noteMap } from '../../rules/map-memory.js';
import { markHandlers, myMarkColor, myMarks } from './map-marks.js';
import { carriesTorch, visionOf } from '../../rules/light.js';
import { lightOptions, lightKind, squareLight } from '../../rules/darkness.js';
import { siteTn } from '../../rules/site.js';
import { helpFrom } from '../../rules/help.js';
import { moveChecks } from '../../rules/chase.js'; // decision 275
import { chaseBlock } from './chase.js';
import { caseTab } from './case-tab.js'; // decisions 278–279
import { caseHandlers, caseChanges } from './case-handlers.js';
import { frameOf } from '../portrait.js';

const rollText = (r) => `d20 ${r.roll} vs ${r.effective}${r.tool ? ` (+${r.tool.tn} ${r.tool.name})` : ''}${r.light ? ` (${r.light.label} ${r.light.tn > 0 ? '+' : ''}${r.light.tn})` : ''}${r.site ? ` (${r.site.label} ${r.site.tn})` : ''}${r.help ? ` (${r.help.label} ${r.help.tn > 0 ? '+' : ''}${r.help.tn})` : ''}`; // decision 268: the site alert; 270: help

const TABS = [
  { id: 'play', label: 'sheet.tab.sheet', view: sheetTab }, // decision 215: Setup + Gear → Sheet, folding sections (the id stays: links, tours)
  { id: 'dossier', label: 'sheet.tab.dossier', view: dossierTab },
  { id: 'notes', label: 'sheet.tab.notes', view: notesTab },
  { id: 'progress', label: 'sheet.tab.progress', view: progressTab },
  { id: 'case', label: 'sheet.tab.case', view: caseTab }, // decisions 278–279: the crew's case (only at a table)
  { id: 'map', label: 'sheet.tab.tactical', view: mapTab }, // only while the GM has a map on the table (decision 64); the Tactical View (decision 162)
];

export function sheetView({ data, store, main, table }, route) {
  const [id, askedTab] = route.params;
  if (askedTab === 'gear') setOpen(['inventory', 'money']); // decision 215: the old Gear tab is the Sheet's Inventory and Money
  const asked = askedTab === 'skills' || askedTab === 'gear' ? 'play' : askedTab; // decision 164: old Skills links land on Setup
  const tableMap = () => (table?.state.joinedId === id ? table.state.map : null);
  // decision 162 → 232: with a map on the table the Tactical View is the tab next to Sheet; a sheet opens on Sheet
  const tabs = () => { const rest = TABS.filter((x) => x.id !== 'map' && (x.id !== 'case' || (table?.state.joinedId === id && table.state.case))); return tableMap() ? [rest[0], TABS.find((x) => x.id === 'map'), ...rest.slice(1)] : rest; };
  const tabId = asked ?? 'play';
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
  setTierLock(() => table?.state.joinedId === id); // decision 192: at the table only the GM sets the difficulty
  const nameOfSkill = (skillId) => data.skills.skills.find((k) => k.id === skillId)?.name ?? skillId;
  /** In combat, an action needs a free action this round. */
  const actionAvailable = (c, sh) => {
    const ts = turnStatus(c.play.turn ?? newTurn(), sh.combat.act.value, c.play.conditions, data.actions);
    // decision 202: when the GM runs the rounds, actions are spent on your own turn (reactions don't come through here)
    const combat = table?.state.joinedId === id ? table.state.combat : null;
    if (ts.inCombat && combat?.active && c.play.turn?.tableCombat === combat.id && combat.current && combat.current !== c.id) { toast(t('turn.notYours'), 'danger'); return false; }
    if (ts.inCombat && ts.left <= 0) { toast(t('turn.noActions'), 'danger'); return false; }
    return true;
  };

  // decision 97: the action buttons show names + the live number; descriptions on demand, remembered per device
  // decision 134: on the Active map the status bar is one slim row unless opened (remembered per device)
  const STATUS = 'fe.sheet.mapStatusOpen';
  const statusOpen = () => { try { return localStorage.getItem(STATUS) === '1'; } catch { return false; } };
  const SMALL = 'fe.sheet.statusSmall'; // the slim header on every tab (the Map tab keeps its own, decision 134)
  const statusSmall = () => { try { return localStorage.getItem(SMALL) === '1'; } catch { return false; } };
  let tabNow = null;
  const TIPS = 'fe.sheet.actionTips';
  const tipsOn = () => { try { return localStorage.getItem(TIPS) === '1'; } catch { return false; } };
  // decision 163: the Tactical View's class engine — compact (default) or full in the right column, remembered per device
  const draw = () => {
    if (mapBusy() || memoryBusy()) return; // a finger on the map: it redraws when the finger lifts
    const tab = tabs().find((x) => x.id === tabId) ?? TABS[0];
    const c = character();
    const s = deriveSheet(c, data);
    // keep collapsible sections open across re-renders
    const open = new Set([...main.querySelectorAll('details[data-keep][open]')].map((d) => d.dataset.keep));
    // decision 237: the table strip — the GM's environment, a timer for this character, the round countdowns shown
    const atTableNow = table?.state.joinedId === id;
    const strip = atTableNow ? html`${chaseBlock(table.state.chase, c, data)}${tableStrip(data, { env: table.state.environment, timer: table.state.timer, countdowns: table.state.combat?.countdowns ?? [] })}` : ''; // decision 275: a chase on top
    if (strip) startStripClock();
    const ctx = { strip, combat: table?.state.joinedId === id ? table.state.combat : null, atTable: Boolean(table?.state.available), map: tableMap(), id, mapMove: tab.id === 'map' ? mapMove() : null, doorUse: tab.id === 'map' ? doorUse() : null, torch: tab.id === 'map' ? (carriesTorch(c, withUniques(data, c)) ? Boolean(c.play.torch) : null) : null, actionTips: tipsOn(), mapDark: (tab.id === 'play' || tab.id === 'map') && c.classId === 'scavenger' && tableMap() ? (() => { const d = darkCtx(); return d.dark && !d.lit; })() : null, marks: tableMarks(), myColor: myMarkColor(c, data, tableMap()), stashes: table?.state.joinedId === id ? table.state.stashes : null, caseState: table?.state.joinedId === id ? table.state.case : null, names: caseNames() };
    const tabNav = html`<nav class="tabs" data-tour="tabs" role="tablist" aria-label="${t('sheet.sections')}">
            ${tabs().map((x) => html`<a class="tab ${x.id === 'map' ? 'tab--live' : ''}" role="tab" href="${href('sheet', id, x.id)}" aria-selected="${x.id === tab.id}">${t(x.label)}</a>`)}
          </nav>`;
    const tools = html`${crewBadge(table, data)}${whisperButton(table, id)}${soundButton(table)}<button class="btn btn--sm btn--ghost" data-action="tour" data-id="general" title="${t('tour.startHint')}" aria-label="${t('tour.startHint')}">?</button>${tableButton(table, id)}
            <button class="btn btn--sm" data-action="export" title="${t('sheet.exportHint')}">${t('common.export')}</button>`;
    // the Tactical View keeps its own bar (tabs + tools); elsewhere the tabs sit in the status bar and the tools in the app header (decision 220)
    const nav = html`
        <div class="sheet-nav">
          ${tabNav}
          <div class="cluster">${tools}</div>
        </div>
`;
    const loadout = loadoutOverlay(c, s, withUniques(data, c), ctx.combat, table?.state.joinedId === id ? table.state.prepare : null) || hitOverlay(c, s, withUniques(data, c)) || grantOverlay(c, withUniques(data, c)) /* decision 276 */ || strainOverlay(c, s, data) || (table?.state.joinedId === id ? contactOverlay(table.state.contact) : '') || (table?.state.joinedId === id ? overwatchOverlay(table.state.overwatchCall, c.play.overwatch) : '') || callOverlay(c, s, withUniques(data, c)); // decision 211: contact // decision 192: before a fight, or Swap abilities; then a hit (decision 207); then the GM's roll calls (decision 193)
    const tactical = tab.id === 'map' && Boolean(tableMap());
    const loadoutTop = main.querySelector('.loadout__body')?.scrollTop ?? 0; // the get-ready window keeps its place through a redraw (rolling initiative)
    if (toolsEl) render(toolsEl, tactical ? '' : tools);
    if (tactical) { // decision 162: the Tactical View has its own frame
      render(main, html`${tacticalView(c, s, withUniques(data, c), ctx, nav)}${loadout}`);
    } else render(main, html`
      <div class="sheet">
        ${strip}
        ${table?.state.stale ? html`<p class="notice notice--warn sheet-stale">${t('table.stale')} <button class="btn btn--sm btn--primary" data-action="reloadApp">${t('table.reload')}</button></p>` : ''}
        ${(() => { // the header collapses on every tab: ▴ on the full bar, ▾ on the slim one (remembered on the device)
          tabNow = tab.id;
          const small = tab.id === 'map' ? !statusOpen() : statusSmall();
          return html`${statusBar(c, s, data, { compact: small, all: small && tab.id !== 'map', tabs: tabNav, atTable: table?.state.joinedId === id })}${small && tab.id !== 'map' ? html`<div class="sheet-status__tabs">${tabNav}<button class="btn btn--sm btn--ghost" data-action="statusOpen" title="${t('status.expand')}" aria-label="${t('status.expand')}">▾</button></div>` : html`<button class="btn btn--sm btn--ghost sheet-status__less" data-action="statusOpen" title="${t('status.collapse')}">${t('status.collapse')}</button>`}`;
        })()}
        ${tableBanner(table, id, data)}
        ${tourDone('general') ? '' : html`<p class="notice tour-offer"><span>${t('tour.offer')}</span>
          <button class="btn btn--sm btn--primary" data-action="tour" data-id="general">${t('tour.offerStart')}</button>
          <button class="btn btn--sm btn--ghost" data-action="tourSkip">${t('tour.offerNo')}</button></p>`}
        <div class="sheet-body">${tab.view(c, s, withUniques(data, c), ctx)}</div>
      </div>${loadout}`);
    const body = loadoutTop && main.querySelector('.loadout__body');
    if (body) body.scrollTop = loadoutTop;
    document.documentElement.classList.toggle('tac-open', tab.id === 'map' && Boolean(tableMap())); // decision 162: on wide screens the page doesn't scroll under the Tactical View
    document.documentElement.classList.add('sheet-open'); // decision 216: the character sheet uses the whole window
    const bar = main.querySelector('.sheet-status')?.offsetHeight; // the Sheet tab's index sticks just under the status bar
    if (bar) main.style.setProperty('--status-h', `${bar}px`);
    if (tab.id === 'map') attachMap(main, data, tableMap(), id, { onIdle: draw, move: mapMove, onMove: mapMoved, marks: tableMarks(), myColor: myMarkColor(c, data, tableMap()), onMark: sendMark, overwatch: c.play.overwatch }); // decision 251
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
    if (combat.current !== id && combat.round !== 0) return { why: 'notTurn' }; // decision 233: in a head start everyone moves
    const c = character();
    const s = deriveSheet(c, data);
    const turn = c.play.turn ?? newTurn();
    const left = turn.moveLeft ?? 0; // squares left from this round's Move (decision 73)
    // decision 161: dragging in a fight needs a Move first — no drag spends an action by itself
    if (!left) return { why: turnStatus(turn, s.combat.act.value, c.play.conditions, data.actions).left > 0 ? 'pressMove' : 'noActions', move: s.move };
    return { max: left, combat: true, left, move: s.move };
  };
  /**
   * Decision 241: Interact in a fight with a marker on the table map — a list of the doors, switches and devices
   * within reach (or something else, for the GM). Decision 255: with nothing within reach it still asks (something
   * else, or Cancel) so a tap never burns the action by mistake; a lock you found offers "try to open it" (asks the
   * GM, no action). @returns false off the map (a plain Interact).
   */
  const interactPick = () => {
    const map = tableMap();
    const me = map?.tokens?.find((tk) => tk.key === id);
    if (!me || !tableCombat()?.active || doorUse() !== 'ok') return false;
    const near = withinReach(map, data, me);
    const c = character();
    const lockedNow = (x) => (x.kind === 'door' || x.kind === 'open') && !x.open && knowsLocked(c, map.id, x.id);
    const side = (x) => ` (${t(`interact.side.${x.side}`)})`;
    const doorName = (x) => t(x.powered ? 'map.door.electric' : 'interact.door'); // decision 256
    const label = (x) => (lockedNow(x) ? `🔒 ${x.kind === 'door' ? doorName(x) : x.name}${side(x)} — ${t('map.lock.try')}`
      : x.kind === 'door' ? `🚪 ${doorName(x)}${side(x)} — ${t(x.open ? 'map.door.doClose' : 'map.door.doOpen')}`
      : x.kind === 'open' ? `🚪 ${x.name}${side(x)} — ${t(x.open ? 'map.door.doClose' : 'map.door.doOpen')}`
      : x.kind === 'search' ? `🔍 ${x.name}${side(x)} — ${t('map.device.search')}` // decision 277
      : `💡 ${x.name}${side(x)} — ${x.kind === 'switch' ? t('map.device.flip') : x.kind === 'ask' ? t('map.device.ask') : t(x.on ? 'map.device.off' : 'map.device.on')}`);
    const choices = [...near.map((x, i) => ({ value: String(i), label: label(x), ...(lockedNow(x) ? { sub: t('map.lock.free') } : {}) })),
      { value: 'other', label: t('interact.other') }, ...(near.length ? [] : [{ value: 'cancel', label: t('common.cancel'), quiet: true }])];
    openChoice(t('interact.title'), choices, (v) => {
      if (v === 'cancel') return;
      if (v === 'other') { run('act', { kind: 'interact', detail: '' }); return; }
      const x = near[Number(v)];
      if (lockedNow(x)) clicks.mapLockTry({ kind: x.kind, target: x.id });
      else if (x.kind === 'door') clicks.mapDoor({ door: x.id, open: x.open ? '0' : '1' });
      else clicks.mapDevice({ prop: x.id, kind: x.kind, on: x.kind === 'toggle' ? (x.on ? '0' : '1') : x.kind === 'open' ? (x.open ? '0' : '1') : '' });
    }, { lead: near.length ? t('interact.hint') : t('interact.nothing') });
    return true;
  };
  /** Decision 250: Overwatch in a fight — pick the direction (8 points); the weapon in hand sets how far. */
  const overwatchPick = () => {
    const c = character();
    if (!c.play.turn?.inCombat) return false;
    const sh = deriveSheet(c, data);
    const w = sh.weapons.find((x) => x.inHand) ?? sh.weapons[0];
    const reach = reachOf(data.weapons.find((x) => x.id === w?.id) ?? data.weapons.find((x) => x.natural), data);
    // decision 251: eight arrows round your marker, the way the map lies (north up)
    const ARROW = { nw: '↖', n: '↑', ne: '↗', w: '←', e: '→', sw: '↙', s: '↓', se: '↘' };
    const me = tableMap()?.tokens?.find((tk) => tk.key === id);
    const grid = ['nw', 'n', 'ne', 'w', null, 'e', 'sw', 's', 'se'];
    const d = openDialog(() => html`<header class="card__head"><h2 class="card__title">${t('overwatch.pickTitle')}<small>${w?.name ?? ''} · ${tn('overwatch.reach', reach)}</small></h2>
        <button class="btn btn--ghost btn--icon" data-action="close" aria-label="${t('common.close')}">✕</button></header>
      <div class="dialog__body"><div class="ow-pick" role="group" aria-label="${t('overwatch.pickTitle')}">${grid.map((dir) => (dir
        ? html`<button class="ow-pick__dir" data-action="owDir" data-dir="${dir}" aria-label="${t(`interact.side.${dir}`)}" title="${t(`interact.side.${dir}`)}">${ARROW[dir]}</button>`
        : html`<span class="ow-pick__me map-legend__dot map-legend__dot--player" aria-hidden="true">${me?.label ?? '•'}</span>`))}</div></div>`, {
      click: { owDir: ({ dir }) => { d.close(); run('overwatch', { dir, slot: w?.slot ?? 1, reach }); } },
    });
    return true;
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
  /** Decision 268: the site alert on the map you stand on — { level, tn } for a roll it bites (check: { kind: 'skill' | 'class', id }), else null. */
  const siteFor = (check) => {
    const map = tableMap();
    if (!map?.site || !map.tokens?.some((tk) => tk.key === id)) return null;
    const tn = siteTn(map.site, check, data.map.site);
    return tn ? { level: map.site, tn } : null;
  };

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
      return { name: t('check.attribute', { name: a.name }), en: `${a.id} check`, tn: v, sub: `${a.id} ${v} (bonus ${bonus(v)})`, tools: toolsFor(c.play.inventory, data.items, { attr: targetId }), boosts: boostsFor(c, data, { kind: 'attr', id: targetId }) };
    }
    const k = s.skills.find((x) => x.id === targetId);
    return { name: bothNames(k), en: nameEn(k), tn: k.value, sub: k.stats.join(' + '), tools: toolsFor(c.play.inventory, data.items, { skill: targetId }), boosts: boostsFor(c, data, { kind: 'skill', id: targetId }) };
  };

  const tableCombat = () => (table?.state.joinedId === id ? table.state.combat : null);
  // decision 279: who is who on the board (the editor's name) — the table's roster as the sheet knows it
  let caseNameCache = {};
  let caseNameAt = 0;
  const caseNames = () => { if (Date.now() - caseNameAt < 20000) return caseNameCache; caseNameAt = Date.now(); table?.players?.().then((ps) => { const next = Object.fromEntries((ps ?? []).map((p) => [p.id, p.name])); if (JSON.stringify(next) !== JSON.stringify(caseNameCache)) { caseNameCache = next; draw(); } }).catch(() => {}); return caseNameCache; };
  /** Decision 266: a breaking point's die — rolled by the app or typed from a physical die. */
  const strainDie = (action, die, mode, e) => {
    let r;
    try { r = mode === 'roll' ? rollDice(die) : typedRoll(die, e.target.closest('.loadout__box')?.querySelector('[data-strain-typed]')?.value); } catch { toast(t('init.badRoll', { die }), 'danger'); return; }
    run(action, { roll: r.total, rollText: formatRoll(r) });
  };
  /** Damage steps after a successful ability: its weapon's dice (Called Shot, Kill Shot…) or a hack's own dice. */
  const abilityFlow = (c, sh, ability) => {
    const onDone = (o) => run('attackDamage', o);
    if (ability.damage) return hackFlow({ ability, onDone });
    const w = abilityWeapon(ability, sh.armed);
    return w && !ability.weapon.noDamage ? weaponFlow({ c, sh, data, w, spec: ability.weapon, onDone }) : null;
  };

  /** An ability's roll (from the engine, the class bar or its window). */
  const rollAbility = ({ id: abilityId, resonant }) => {
    const c = character();
    const sh = deriveSheet(c, data);
    const ability = droneAbility(data.abilities[c.classId].find((a) => a.id === abilityId), sh.drone); // decision 172
    const freeBreathe = ability.steer && sh.talents.freeSteer && !c.play.talentUses?.[sh.talents.freeSteer]; // decision 186: Poker Face
    if (!sh.class || (!ability.reaction && !freeBreathe && !actionAvailable(c, sh))) return; // decision 174: a reaction may borrow next round's action
    if (ability.stanceShift) { // decision 175: Shift Stance — Defensive or Attack, whichever you aren't in
      const now = c.play.resources?.stance ?? 'ready';
      const stances = data.classes.classes.find((k) => k.id === 'soldier').resources.stances.filter((x) => ['defensive', 'attack'].includes(x.id) && x.id !== now);
      openChoice(ability.name, stances.map((x) => ({ value: x.id, label: x.name, sub: t('engine.unsteadyCost') })), (stance) => run('useRolled', { id: abilityId, success: true, rollText: 'no roll', stance }));
      return;
    }
    if (ability.steer) { // decision 174: Breathe — one step of the pendulum, your choice, no roll
      openChoice(ability.name, [{ value: '-1', label: t('engine.steerCool') }, { value: '1', label: t('engine.steerHot') }], (dir) => run('useRolled', { id: abilityId, success: true, rollText: 'no roll', steer: Number(dir) }));
      return;
    }
    if (ability.auto) { // housekeeping: no Class TN roll
      run('useRolled', { id: abilityId, success: true, rollText: 'no roll' });
      if (abilityId === 'system_hard_reboot') run('clearBomb');
      return;
    }
    const ping = async (r) => { // decision 170: the GM's console works out the list from the map
      if (!(await table?.ping(tableMap()?.id ?? null, { success: r.success, margin: r.margin }))) toast(t('ping.offline'), 'danger');
    };
    if (ability.play) { playAbility({ c, sh, data, ability, resonant: Boolean(resonant), combat: tableCombat(), table, run, toast, rollText, tier: tableTier, ping, onMap: mapTarget(), site: siteFor({ kind: 'class', id: c.classId }) }); return; } // decision 155; onMap: decision 192
    openCheck({ name: resonant ? `${ability.name} · ${t('engine.resonantCast')}` : ability.name, tn: sh.class.tn, sub: `Class TN · ${sh.class.subclass.name}` }, data,
      (r) => run('useRolled', { id: abilityId, success: r.success, rollText: rollText(r), resonant: Boolean(resonant) }),
      { tier: tableTier(), once: true, site: siteFor({ kind: 'class', id: c.classId }), flow: abilityFlow(c, sh, ability), after: (r) => (!r.success && data.classes.abilityRoll.onFailure !== 'nothing' ? html`<p class="hint">${t(`check.abilityFailed.${data.classes.abilityRoll.onFailure}`)}</p>` : '') });
  };

  const clicks = {
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
    reload: (d) => { const c = character(); if (actionAvailable(c, deriveSheet(c, data))) run('reload', d); }, // decision 202: an action — on your turn
    wear: (d) => run('wear', d),
    qty: (d) => run('qty', d),
    dropLifestyle: (d) => run('dropLifestyle', d),
    maxAbilities: (d) => run('maxAbilities', d),
    equip: (d) => run('equip', d),
    useKit: ({ id: kitId }) => run('equipKit', { id: kitId }), // decision 183
    abilityRoll: (d) => rollAbility(d),
    /** Decision 198: a class bar tile's whole card, in a window; Use from there too. */
    abilityInfo: ({ id: abilityId }) => {
      const c = character();
      const view = abilityWindow(c, deriveSheet(c, data), withUniques(data, c), abilityId);
      if (!view) return;
      const d = openDialog(() => abilityWindow(character(), deriveSheet(character(), data), withUniques(data, character()), abilityId), { click: { use: (args) => { d.close(); rollAbility(args); } } });
    },
    classBarFold: () => { toggleClassBar(); draw(); },
    actionTips: () => { try { localStorage.setItem(TIPS, tipsOn() ? '0' : '1'); } catch { /* private mode: stays as is */ } draw(); },
    attackRoll: ({ slot, located, overwatch = null }) => {
      const c = character();
      const sh = deriveSheet(c, data);
      const w = sh.weapons.find((x) => String(x.slot) === String(slot));
      if (!w || w.empty || (!overwatch && !actionAvailable(c, sh))) return; // decision 250: the overwatch shot needs no action
      if (w.usable === false) { toast(t(`weapons.unusable.${w.why}`), 'danger'); return; }
      if (w.magSize && w.rounds <= 0) { toast(t('attack.empty', { weapon: w.name }), 'danger'); return; }
      if ((c.play.jams ?? []).includes(String(slot))) { toast(t('crit.jammedNo', { weapon: w.name }), 'danger'); return; } // decision 265
      // decision 97: one Attack button; where to aim (body, or ⌖ a location at −N TN) is chosen in the roll window
      const spec = { located: Boolean(located) || Boolean(c.play.aimed), aimed: Boolean(c.play.aimed) }; // decision 150: aimed → a location attack, picked for you
      const ammo = String(c.play.specialAmmo?.slot) === String(slot) ? c.play.specialAmmo.mode : null; // decision 155: Black-Market Ammo
      if (ammo === 'half') spec.armorHalf = true;
      if (ammo === 'd6') spec.bonus = '1d6';
      const aim = { pick: spec.located ? 'located' : 'body', onPick: (id) => { spec.located = id === 'located'; },
        options: [{ id: 'body', tn: 0, label: t('attack.aimBody') }, { id: 'located', tn: -sh.locationPenalty, label: `⌖ ${t('turn.located')}`, hint: t('turn.locatedHint') }] }; // Marksman lowers the penalty
      // decision 153: which enemy — the result goes to the GM as a pending hit (or a miss)
      const combat = tableCombat();
      const foes = (combat?.hostiles ?? []).filter((h) => !h.ally && h.band !== 'down');
      const onMap = overwatch && foes.some((h) => h.key === overwatch) ? overwatch : foes.some((h) => h.key === mapTarget()) ? mapTarget() : ''; // decision 192: the enemy you tapped on the map, picked to start with; 250: the one in your overwatch
      if (onMap) { spec.target = onMap; spec.targetTag = foes.find((h) => h.key === onMap)?.tag ?? null; }
      const foe = foes.length ? { pick: onMap, onPick: (k) => { spec.target = k; spec.targetTag = foes.find((h) => h.key === k)?.tag ?? null; },
        options: [...foes.map((h) => { // decision 158: what its conditions give you (Prone vs melee +4, Blinded vs ranged +4, Marked +2)
          const vs = againstMods(h.conditions, data.conditions, { melee: !isRanged(w) });
          const edge = studiedEdge(c.play.intel, h.ref, data); // decision 197: you know how this type fights
          const parts = [...vs.parts.map((p) => p.name), ...(edge ? [t('intel.studied')] : [])];
          const cover = tableMap() ? coverTo(tableMap(), data, id, h.key) : null; // decision 204: shown, never added — the GM counts it on the damage
          return { id: h.key, mapped: h.key === onMap, cover, label: `${h.letter} · ${h.name}${vs.tn + edge ? ` · +${vs.tn + edge} (${parts.join(', ')})` : ''}`, letter: h.letter, tn: vs.tn + edge, img: h.art ? `/api/table/art?art=${h.art}&size=portrait&look=${h.look ?? 1}` : null };
        }), { id: '', label: t('attack.foeNone') }] } : null;
      aim.table = (k) => locationTable(data, foes.find((h) => h.key === k)?.tag ?? null); // decision 156: what each location does to this target
      const report = (extra) => {
        if (!combat) return;
        const h = foes.find((x) => x.key === spec.target);
        table?.report({ target: spec.target ?? '', targetLabel: h ? `${h.letter} · ${h.name}` : '', weapon: w.name, ...extra });
      };
      // decision 265: critical hits and fumbles — the odds before rolling, the banner after, the crit told to the GM
      const crits = data.encounter.crits;
      const span = (a, b) => (a >= b ? String(a) : `${a}–${b}`);
      const odds = (eff) => html`<p class="check-odds">💥 ${t('crit.odds', { range: span(1, critUpTo(eff, w, crits)) })} · ${t('crit.fumbleOdds', { range: span(fumbleFrom(eff, crits), 20) })} ${ruleInfo('critical', t('crit.title'))}</p>`;
      const banner = (r) => {
        const k = attackCrit(r, w, crits);
        if (k === 'crit') return html`<p class="notice notice--crit">${t(spec.located ? 'crit.hitLocated' : 'crit.hit')}</p>`;
        if (k === 'fumble') return html`<p class="notice notice--danger">${fumbleKind(w) === 'jam' ? t('crit.fumbleJam', { die: crits.jamDie, weapon: w.name, n: w.reliability ?? 10 }) : fumbleKind(w) === 'lost' ? t('crit.fumbleLost', { weapon: w.name }) : t('crit.fumbleExposed')}</p>`;
        return '';
      };
      const jamFlow = (r) => (attackCrit(r, w, crits) === 'fumble' && fumbleKind(w) === 'jam' ? {
        next: (a) => (a.jam ? null : { id: 'jam', title: t('crit.jamTitle', { weapon: w.name }), hint: t('crit.jamHint', { n: w.reliability ?? 10 }), dice: [{ key: 'd', label: t('crit.jamDie'), expr: crits.jamDie }] }),
        recap: (id, a) => `${t('crit.jamDie')}: ${formatRoll(a.d)}`,
        summary: (a) => html`<p class="notice ${jams(w, a.jam.d.total) ? 'notice--danger' : 'notice--ok'}">${jams(w, a.jam.d.total) ? t('crit.jammed') : t('crit.holds')}</p>`,
        complete: (a) => run('attackFumble', { slot, kind: 'jam', roll: a.jam.d.total, rollText: formatRoll(a.jam.d) }),
      } : null);
      openCheck({ name: overwatch ? `🎯 ${t('overwatch.shotTitle', { weapon: w.name })}` : t('attack.title', { weapon: w.name }), tn: w.tn, sub: nameOfSkill(w.skill) }, data,
        (r) => {
          const k = attackCrit(r, w, crits);
          spec.crit = k === 'crit';
          spec.rollText = `${rollText(r)}${k === 'crit' ? ' · CRITICAL HIT' : k === 'fumble' ? ' · FUMBLE' : ''}`;
          run('attack', { slot, hit: r.success, rollText: spec.rollText, located: spec.located, free: Boolean(overwatch) });
          if (k === 'fumble' && fumbleKind(w) !== 'jam') run('attackFumble', { slot, kind: fumbleKind(w) });
          if (!r.success) report({ hit: false, roll: spec.rollText });
        },
        { tier: tableTier(), once: true, aim, odds, narrative: false, notice: spec.aimed ? `🎯 ${t('attack.aimedNotice')}` : '', tools: toolsFor(c.play.inventory, data.items, { skill: w.skill, attack: isRanged(w) ? 'gun' : null }), light: lightFor('attack'), boosts: boostsFor(c, data, { kind: 'weapon', slot }),
          after: (r) => html`${banner(r)}${r.success ? '' : html`<p class="hint">${w.magSize ? t('attack.missAmmo') : t('attack.miss')}</p>`}`,
          missFlow: jamFlow,
          foe, flow: weaponFlow({ c, sh, data, w, spec, exploit: true, combat: tableCombat(), onDone: (o) => { run('attackDamage', o); report({ hit: true, damage: o.damage, part: o.part, where: o.where, armorHalf: o.armorHalf, armor: spec.crit ? 'ignore' : o.armorHalf ? 'half' : '', crit: Boolean(spec.crit), roll: spec.rollText ?? '' }); } }) });
    },
    dodgeRoll: () => {
      const c = character();
      const sh = deriveSheet(c, data);
      const avoid = sh.skills.find((k) => k.id === 'avoid_reflexes');
      openCheck({ name: t('dodge.title'), tn: avoid.value, sub: `${avoid.name} · ${t('dodge.sub')}` }, data,
        (r) => run('dodge', { success: r.success, rollText: rollText(r) }), { tier: tableTier(), once: true, boosts: boostsFor(c, data, { kind: 'skill', id: 'avoid_reflexes' }) });
    },
    /**
     * Decision 197: Study — an action and a roll (the better of the Study skills) at one enemy on the board, downed
     * ones too; once per fight. A success asks the table for the next level of Intel on its type.
     */
    studyPick: () => {
      const c = character();
      const sh = deriveSheet(c, data);
      if (!actionAvailable(c, sh)) return;
      const foes = (tableCombat()?.hostiles ?? []).filter((h) => !h.ally && h.ref);
      if (!foes.length) { toast(t('intel.nobodyToStudy'), 'danger'); return; }
      const skill = data.intel.study.skills.map((k) => sh.skills.find((x) => x.id === k)).filter(Boolean).sort((a, b) => b.value - a.value)[0];
      const levelOf = (h) => studyLevel(c.play.intel, h.ref);
      const open = foes.filter((h) => levelOf(h) != null);
      if (!open.length) { toast(t('intel.allStudied'), 'danger'); return; }
      const first = open.find((h) => h.key === mapTarget()) ?? open[0];
      let pick = first.key;
      const foe = { pick, onPick: (k) => { pick = k; },
        options: open.map((h) => ({ id: h.key, mapped: h.key === mapTarget(), letter: h.letter, label: `${h.letter} · ${h.name} → ${t(levelOf(h) >= 2 ? 'intel.toStudied' : 'intel.toKnown')}`, img: h.art ? `/api/table/art?art=${h.art}&size=portrait&look=${h.look ?? 1}` : null })) };
      openCheck({ name: t('intel.studyTitle'), tn: skill.value, sub: skill.name }, data, async (r) => {
        const h = open.find((x) => x.key === pick) ?? first;
        run('study', { name: `${h.letter} · ${h.name}`, hit: r.success });
        if (!r.success) return;
        const res = await table?.intel('study', { ref: h.ref, level: levelOf(h) });
        if (res?.entry) run('receiveIntel', { msg: { entry: res.entry } });
        else toast(t('intel.noFile'), 'danger');
      }, { tier: tableTier(), once: true, foe });
    },
    /** Decision 197: a background pick — the type chosen, an INT roll; kept, so it can't be rolled again. */
    intelBgRoll: ({ source }) => {
      const sh = deriveSheet(character(), data);
      const id = main.querySelector(`[data-intel-pick="${source}"]`)?.value;
      if (!id) return;
      const name = [...data.collection.enemies, ...data.collection.elites].find((x) => x.id === id)?.name ?? id;
      openCheck({ name: t('intel.bgRollTitle', { name }), tn: sh.attributes.INT, sub: 'INT' }, data, (r) => run('intelBackgroundRoll', { source, id, ok: r.success }), { once: true });
    },
    intelBgSend: async () => {
      const c = character();
      const rolls = c.play.intelBackground?.rolls ?? {};
      const nemesis = main.querySelector('[data-intel-nemesis]')?.value ?? null;
      const res = await table?.intel('background', { answer: { picks: Object.entries(rolls).map(([source, r]) => ({ source, id: r.id, ok: r.ok })), nemesis } });
      if (!res) { toast(t('intel.offline'), 'danger'); return; }
      run('receiveIntel', { msg: { entries: res.entries } });
      run('intelBackgroundDone', { nemesis });
      toast(t('intel.bgDone', { n: res.entries.length }), 'success');
    },
    intelShare: async ({ id: entry }) => {
      const res = await table?.intel('share', { id: entry });
      toast(res ? t('intel.sharedOut', { n: res.shared }) : t('intel.offline'), res ? 'success' : 'danger');
    },
    act: ({ kind, detail }) => {
      const c = character();
      if (!actionAvailable(c, deriveSheet(c, data))) return;
      if (kind === 'interact' && interactPick()) return; // decision 241: what's within reach on the table map
      if (kind === 'overwatch' && overwatchPick()) return; // decision 250: which way you watch
      run('act', { kind, detail });
    },
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
    combatEnd: () => { if (!table?.state.available) run('combatEnd'); }, // decision 203: at the table only the GM ends a fight
    /** Decision 50: the GM's Claude writes (or polishes) the backstory; it comes back as a durable message. */
    askBackstory: async () => {
      const c = character();
      const mode = c.narrative.backstoryHtml?.trim() ? 'revise' : 'write';
      const ok = await table?.askBackstory({ id, name: c.name, player: c.player, lang: getLang(), prompt: storyPrompt(c, data), current: c.narrative.backstoryHtml ?? '', mode });
      if (ok) { run('backstoryAsked', { mode }); toast(t('dossier.askedToast'), 'success'); } else toast(t('dossier.askFailed'), 'danger');
    },
    backstoryUndo: () => run('backstoryUndo'),
    soundToggle: () => { setSound(!soundOn()); draw(); },
    whisper: () => openWhisper({ table, toast }), // decision 149
    foeImage: ({ art, look, name }) => openDialog(() => html`
      <header class="card__head"><h2 class="card__title">${name}</h2><button class="btn btn--ghost btn--icon" data-action="close" aria-label="${t('common.close')}">✕</button></header>
      <div class="dialog__body foe-full"><img src="/api/table/art?art=${art}&size=full&look=${look}" alt="${name}"></div>`, { click: {} }), // decision 152
    acceptDeal: ({ id: dealId }) => run('acceptDeal', { id: dealId }), // decision 143: the washer
    declineDeal: ({ id: dealId }) => run('declineDeal', { id: dealId }),
    stashRename: () => { const name = prompt(t('stash.name'), character().play.stash?.name ?? ''); if (name !== null) run('stashName', { value: name }); }, // decision 144
    ...hitHandlers({ character, data, run, table, toast, rollText, tier: tableTier }), // decision 154
    ...caseHandlers({ table, id, toast, redraw: () => draw(), character }), // decisions 278–279
    boonApply: ({ id: boonId }) => run('applyBoon', { id: boonId }), // decision 155: a card from an ally
    askSkip: ({ id: askId, name }) => run('rollAsked', { id: askId, name }), // decision 165
    clearScan: () => run('clearScan'), // decision 170
    netDoorAsk: ({ net, name }) => { // decision 256: Door Control when equipped (its own roll, RAM, Heat); else ask the GM — a hack action in a fight, the GM calls the roll
      const ops = ['unlock', 'lock', 'open', 'close'];
      const viaAbility = character().play.abilities.includes('door_control');
      openChoice(t('ping.doorTitle', { name: name || t('ping.doorOn', { key: net }) }), ops.map((op) => ({ value: op, label: t(`ping.op.${op}`) })), async (op) => {
        const c = character();
        if (viaAbility) {
          if (c.play.turn?.inCombat && !actionAvailable(c, deriveSheet(c, data))) return;
          if (!(await table?.netDoor(net, name, op, 'door_control'))) { toast(t('ping.offline'), 'danger'); return; }
          rollAbility({ id: 'door_control' });
          return;
        }
        if (c.play.turn?.inCombat) {
          if (!actionAvailable(c, deriveSheet(c, data))) return;
          try { store.update(id, (d) => { actions.act(d, withUniques(data, d), { kind: 'other', detail: `hack: ${op} ${name ? `the door “${name}”` : 'a door'} on network ${net} (remote)` }); }); } catch (err) { toast(ruleText(err), 'danger'); return; }
        }
        toast(await table?.netDoor(net, name, op) ? t('ping.doorAsked') : t('ping.offline'), 'success');
      }, { lead: t(viaAbility ? 'ping.doorLeadAbility' : 'ping.doorLead') });
    },
    ...initiativeHandlers({ character, sheet: () => deriveSheet(character(), data), data, run, table, toast }), // decision 148
    ...prepareHandlers({ character, sheet: () => deriveSheet(character(), data), data, run, table, toast }), // decision 232
    ...crewStashHandlers({ character, data, run, table, toast }), // decision 145: 📦 picks your stash or the crew's
    stashTake: ({ kind, id: itemId }) => run('stashTake', { kind, id: itemId }),
    stashCash: ({ dir }, e) => run('stashCash', { dir, amount: e.target.closest('.stash-cash')?.querySelector('input')?.value }),
    /** Decision 58: use a consumable (1 action in combat) — from the Turn card or an inventory row. */
    useItem: ({ id: itemId }) => {
      const c = character();
      if (!actionAvailable(c, deriveSheet(c, data))) return;
      startUseItem({ character, data, run, onlyId: itemId ?? null, onUsed: (item) => { // decision 75: a flare lands on the table map
        const map = tableMap();
        if (item.light?.drop && map?.tokens.some((tk) => tk.key === id)) table.flare(map.id);
      } });
    },
    /** Decision 171: fly a toy drone — recon or decoy, one Drones / Remote Craft roll; the GM gets a line (and Trace +1). */
    droneFly: ({ id: itemId }) => {
      const e = findGear('item', itemId, data);
      try { checkFlight(character()); } catch (err) { toast(ruleText(err), 'danger'); return; }
      openChoice(t('drone.title'), ['recon', 'decoy'].map((v) => ({ value: v, label: t(`drone.${v}`), sub: t(`drone.${v}Sub`) })), (purpose) => {
        const target = checkTarget({ kind: 'skill', id: e.drone.skill });
        openCheck({ ...target, name: `${e.name} · ${t(`drone.${purpose}`)}` }, data, (r) => {
          const outcome = run('droneFlight', { id: itemId, purpose, success: r.success, margin: r.margin, rollText: rollText(r) });
          if (outcome) table?.drone(tableMap()?.id ?? null, { purpose, outcome, margin: r.margin });
        }, { tier: tableTier(), once: true, tools: target.tools, boosts: target.boosts,
          after: (r) => html`<p class="notice ${r.success ? 'notice--ok' : 'notice--danger'}">${t(`drone.outcome.${flightOutcome(r, e.drone)}`)}</p>` });
      });
    },
    droneCharge: () => run('droneCharge'),
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
      if (tourId === 'map') railOpen('tac', 'right', 'map'); // the tour points at the Map bookmark (decision 192)
      if (tour) startTour(tour, { openTab: (tabId) => { if (location.hash !== href('sheet', id, tabId)) go('sheet', id, tabId); }, onClose: () => draw() });
    },
    statusOpen: () => { try { if (tabNow === 'map') localStorage.setItem(STATUS, statusOpen() ? '0' : '1'); else localStorage.setItem(SMALL, statusSmall() ? '0' : '1'); } catch { /* private mode */ } draw(); },
    loadoutOpen: () => { if (!loadoutOpen(character().play.turn)) { toast(t('rule.loadoutLocked'), 'danger'); return; } openSwap(); draw(); }, // decision 192: Swap abilities; 194: not mid-fight
    loadoutClose: () => { closeSwap(); draw(); },
    combatReady: () => { closeSwap(); run('combatReady'); },
    reloadApp: () => location.reload(), // decision 234: the table's app was updated
    contactOk: ({ at }) => { closeContact(at); draw(); }, // decision 211
    owShoot: ({ at, key }) => { closeOverwatch(at); draw(); const ow = character().play.overwatch; if (ow) clicks.attackRoll({ slot: ow.slot, overwatch: key }); }, // decision 250
    owPass: ({ at, label }) => { closeOverwatch(at); run('overwatchPass', { name: label }); },
    secJump: ({ id: sec }) => { // decision 215: open it and bring its title just under the sticky status bar; decision 216: tapped again, it closes
      if (isOpen(sec)) { setOpen([sec], false); draw(); return; }
      setOpen([sec]);
      draw();
      const el = main.querySelector(`#sec-${sec}`);
      const bar = main.querySelector('.sheet-status')?.getBoundingClientRect().bottom ?? 0;
      if (el) window.scrollTo({ top: window.scrollY + el.getBoundingClientRect().top - Math.max(0, bar) - 8, behavior: 'smooth' });
    },
    secAll: ({ on }) => { setOpen(SECTIONS, on === '1'); draw(); }, // the pre-fight window: once per fight (decision 195)
    tourSkip: ({ id: tourId }) => { markTourDone(tourId ?? 'general'); draw(); },
    copyPrompt: async ({ target }) => {
      const el = document.getElementById(target);
      try { await navigator.clipboard.writeText(el.value); toast(t('builder.copied'), 'success'); } catch { el.select(); document.execCommand('copy'); toast(t('builder.copied')); }
    },
    release: (d) => { // decision 176: releasing the Logic Bomb detonates it
      run('release', d);
      if (d.id === 'logic_bomb' && character().play.bomb) detonate({ c: character(), data, combat: tableCombat(), table, run, toast });
    },
    releaseAll: () => {
      const ids = run('releaseAll') ?? [];
      if (ids.includes('logic_bomb') && character().play.bomb) detonate({ c: character(), data, combat: tableCombat(), table, run, toast });
    },
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
    droneMod: (d) => run('droneMod', d), // decision 172
    weaponMods: ({ id: weaponId }) => openWeaponMods(weaponId, { character, data, run }), // decision 173
    droneWreck: () => run('droneWreck'),
    roundEnd: () => { if (!table?.state.available) run('roundEnd'); }, // decision 203: at the table only the GM advances rounds
    combatStart: () => { if (!table?.state.available) run('combatStart'); },
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
    ...markHandlers({ draw, run, send: sendMark, mine: () => myMarks(tableMarks(), tableMap(), id) }),
    inDark: ({ on }) => run('inDark', { on: on === '1' }),
    mapDevice: ({ prop, kind, on }) => { // decision 241: a switch or a device next to the marker — an Interact action in a fight; a breaker is only asked
      const map = tableMap();
      const p = map?.props?.find((x) => x.id === prop);
      const name = p?.caption || data.props.props.find((x) => x.id === p?.prop)?.name || '';
      if (kind === 'search') { // decision 277: searching a piece — an Interact action in a fight only; the GM's map says what's there
        if (tableCombat()?.active) {
          try { store.update(id, (d) => { actions.act(d, withUniques(data, d), { kind: 'interact', detail: `searches the ${name} on the map` }); }); } catch (err) { toast(ruleText(err), 'danger'); return; }
        }
        table.device(map.id, prop, undefined);
        toast(t('map.device.searching', { name }), 'success');
        return;
      }
      if (kind === 'open') { // decision 248: like a door — an Interact action in a fight only
        if (tableCombat()?.active) {
          try { store.update(id, (d) => { actions.act(d, withUniques(data, d), { kind: 'interact', detail: `${on === '1' ? 'opens' : 'closes'} the ${name} on the map` }); }); } catch (err) { toast(ruleText(err), 'danger'); return; }
        }
        table.device(map.id, prop, on === '1');
        return;
      }
      if (kind !== 'ask') {
        const what = kind === 'switch' ? `flips the ${name}` : `switches ${on === '1' ? 'on' : 'off'} the ${name}`;
        try { store.update(id, (d) => { actions.act(d, withUniques(data, d), { kind: 'interact', detail: `${what} on the map` }); }); } catch (err) { toast(ruleText(err), 'danger'); return; }
      }
      table.device(map.id, prop, kind === 'toggle' ? on === '1' : undefined);
      if (kind === 'ask') toast(t('map.device.asked', { name }), 'success');
    },
    mapLockTry: ({ kind, target }) => { // decision 255: a lock this sheet found — ask the GM to try it (no action: the GM's roll decides what it costs)
      const map = tableMap();
      if (kind === 'door') table.door(map.id, target, true, true);
      else table.device(map.id, target, true, true);
      toast(t('map.lock.asked'), 'success');
    },
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
    // decision 266: Strain — steady yourself (a Mental Strength roll halves it) or take it; the breaking point's dice
    strainSteady: ({ id: askId }) => {
      const target = checkTarget({ kind: 'attr', id: 'MST' });
      openCheck(target, data, (r) => run('strainTake', { id: askId, steady: r.success, rollText: `${r.roll} vs ${r.effective}` }), { tier: tableTier(), once: true, tools: target.tools, boosts: target.boosts });
    },
    strainTake: ({ id: askId }) => run('strainTake', { id: askId }),
    strainHand: ({ delta }) => run('strainHand', { delta: Number(delta) }),
    breakRoll: ({ mode }, e) => strainDie('breakingRoll', data.strain.breaking.die, mode, e),
    scarRoll: ({ mode }, e) => strainDie('scarRoll', data.strain.scars.die, mode, e),
    breakSeen: () => run('breakingSeen'),
    breathHold: () => openChoice(t('breath.hold'), [{ value: '0', label: t('breath.ready'), sub: t('breath.readySub', { n: deriveSheet(character(), data).attributes.CON }) }, { value: '1', label: t('breath.surprised'), sub: t('breath.surprisedSub') }],
      (v) => run('breathStart', { surprised: v === '1', why: '' })), // decision 273
    breathRound: () => run('breathTick'),
    breathAir: () => run('breathEnd', { why: '' }),
    breathRoll: () => {
      const c = character();
      const ask = c.play.breath?.ask;
      if (ask?.kind !== 'check') return;
      const con = deriveSheet(c, data).attributes.CON;
      openCheck({ name: t('breath.checkTitle'), tn: con + ask.penalty, sub: `CON ${con} · −${Math.abs(ask.penalty)}` }, data, (r) => run('breathCheck', { success: r.success, rollText: rollText(r) }), { tier: tableTier(), once: true });
    },
    breathDrown: ({ mode }, e) => {
      const die = character().play.breath?.ask?.dice ?? data.body.breath.drown;
      let r;
      try { r = mode === 'roll' ? rollDice(die) : typedRoll(die, e.target.closest('.breath-drown')?.querySelector('[data-breath-typed]')?.value); } catch { toast(t('init.badRoll', { die }), 'danger'); return; }
      run('breathDrown', { n: r.total, rollText: formatRoll(r) });
    },
    chaseMove: ({ move }) => { // decision 275: one move this leg — one roll; it counts for its effect and for keeping pace
      const ch = table?.state.chase;
      const c = character();
      if (!ch?.active || !ch.crew.includes(id)) return;
      const s = deriveSheet(c, data);
      const bonus = ch.crewBonus ?? 0;
      const report = (r, extra = '') => {
        store.update(id, (dd) => { dd.play.chaseMove = { chase: ch.id, leg: ch.leg, move, success: r.success }; log(dd, `Chase, leg ${ch.leg} — ${move}: ${rollText(r)} → ${r.success ? 'kept pace' : 'fell back'}${extra}`, r.success ? 'ok' : 'bad'); });
        table.chaseMove({ chase: ch.id, leg: ch.leg, move, success: r.success, margin: r.margin, natural: r.natural, rollText: `${r.roll} vs ${r.effective}` }).then((ok) => { if (!ok) toast(t('crewStash.why.offline'), 'danger'); });
      };
      const roll = (target, extra = {}) => openCheck({ ...target, tn: target.tn + bonus, sub: `${target.sub ?? ''}${bonus ? ` · ${t('chase.bonus', { n: bonus })}` : ''}` }, data, (r) => report(r, extra.note ?? ''),
        { tier: tableTier(), once: true, tools: target.tools ?? [], boosts: target.boosts ?? [], site: extra.site ?? null, light: extra.light ?? null });
      const options = moveChecks(move, data.chase).flatMap((k) => {
        if (k === 'weapon') { const w = s.weapons.find((x) => x.inHand && !x.empty); return w ? [{ value: 'weapon', label: w.name, sub: `TN ${w.tn}` }] : []; }
        if (k.startsWith('class:')) return c.classId === k.slice(6) && s.class ? [{ value: 'class', label: `Class TN · ${s.class.subclass.name}`, sub: `TN ${s.class.tn}` }] : [];
        if (k === 'any') return [{ value: 'any', label: t('chase.helpPick') }];
        const [kind, cid] = k.split(':');
        const tg = checkTarget({ kind: kind === 'attr' ? 'attr' : 'skill', id: cid });
        return [{ value: k, label: tg.name, sub: `TN ${tg.tn}` }];
      });
      const go = (v) => {
        if (v === 'weapon') {
          const w = s.weapons.find((x) => x.inHand && !x.empty);
          try { store.update(id, (dd) => { actions.chaseShot(dd, withUniques(data, dd), { slot: w.slot }); }); } catch (err) { toast(ruleText(err), 'danger'); return; }
          roll({ name: `${t('chase.move.cover')} · ${w.name}`, tn: w.tn, sub: nameOfSkill(w.skill) });
        } else if (v === 'class') roll({ name: t('chase.move.hack'), tn: s.class.tn, sub: `Class TN · ${s.class.subclass.name}` }, { site: siteFor({ kind: 'class', id: c.classId }) });
        else if (v === 'any') clicks.helpCrew({ chase: true, then: (r) => report(r, ' (helped a crewmate)') });
        else { const [kind, cid] = v.split(':'); const tg = checkTarget({ kind: kind === 'attr' ? 'attr' : 'skill', id: cid }); roll({ ...tg, name: `${t(`chase.move.${move}`)} · ${tg.name}` }, kind === 'skill' ? { site: siteFor({ kind: 'skill', id: cid }), light: lightFor(lightKind(cid)) } : {}); }
      };
      if (!options.length) { toast(t('chase.cant'), 'danger'); return; }
      if (options.length === 1) go(options[0].value); else openChoice(t(`chase.move.${move}`), options, go);
    },
    grantAccept: ({ id: gid }) => { const got = run('acceptGrant', { id: gid }); if (got) toast(t('grant.taken', { what: got.join(', ') }), 'success'); }, // decision 276
    helpCrew: async (opts = {}) => { // decision 270: say how you help, roll a related skill — +2 on their next check (a natural 20: −2); an action in a fight
      const c = character();
      const fight = Boolean(c.play.turn?.inCombat) && !opts.chase; // decision 275: in a chase, Help is the leg's move
      const mates = table?.state.joinedId === id ? (await table.players()).filter((p) => p.id !== id && (!opts.chase || table.state.chase?.crew.includes(p.id))) : [];
      if (!mates.length) { toast(t('strain.steadyNobody'), 'danger'); return; }
      openChoice(t('help.pickMate'), mates.map((p) => ({ value: p.id, label: p.name })), (to) => {
        const name = mates.find((p) => p.id === to)?.name ?? '';
        const s = deriveSheet(character(), data);
        const skills = [...s.skills].sort((a, b) => b.value - a.value);
        openChoice(t('help.pickSkill', { name }), skills.map((k) => ({ value: k.id, label: bothNames(k), sub: `TN ${k.value}` })), (skillId) => {
          if (fight) {
            if (!actionAvailable(character(), deriveSheet(character(), data))) return;
            try { store.update(id, (d) => { actions.act(d, withUniques(data, d), { kind: 'other', detail: `Help ${name}` }); }); } catch (err) { toast(ruleText(err), 'danger'); return; }
          }
          const target = checkTarget({ kind: 'skill', id: skillId });
          openCheck({ ...target, name: t('help.title', { name }), sub: target.name }, data, async (r) => {
            opts.then?.(r); // decision 275: a chase's Help move — its roll is the leg's move
            const n = helpFrom(r, data.difficulty.help);
            store.update(id, (d) => log(d, `Helped ${name} (${target.en ?? target.name}): ${rollText(r)} → ${n ? `${n > 0 ? '+' : ''}${n} on their next check` : 'no help this time'}`, n > 0 ? 'ok' : n < 0 ? 'bad' : ''));
            if (!n) return;
            const ok = await table.boon(to, { ability: 'Help', help: n, skill: target.en ?? target.name, note: '' });
            toast(ok ? t(n > 0 ? 'help.sent' : 'help.fumbled', { name, n: `${n > 0 ? '+' : ''}${n}` }) : t('crewStash.why.offline'), ok && n > 0 ? 'success' : 'danger');
          }, { tier: tableTier(), once: true, tools: target.tools, boosts: target.boosts, light: lightFor(lightKind(skillId)), site: siteFor({ kind: 'skill', id: skillId }),
            after: (r) => html`<p class="notice ${helpFrom(r, data.difficulty.help) > 0 ? 'notice--ok' : helpFrom(r, data.difficulty.help) < 0 ? 'notice--danger' : ''}">${t(helpFrom(r, data.difficulty.help) > 0 ? 'help.outcomeOk' : helpFrom(r, data.difficulty.help) < 0 ? 'help.outcomeBad' : 'help.outcomeNone', { name })}</p>` });
        });
      });
    },
    steadyCrew: async () => { // a boon card on a crewmate's sheet: −1 Strain (−2 when the crew is Tight); an action in a fight
      const c = character();
      const fight = Boolean(c.play.turn?.inCombat);
      const n = steadyAmount(table?.state.crew?.band ?? 'steady', fight, data.strain);
      if (!n) { toast(t('strain.steadyNo'), 'danger'); return; }
      const mates = table?.state.joinedId === id ? (await table.players()).filter((p) => p.id !== id) : [];
      if (!mates.length) { toast(t('strain.steadyNobody'), 'danger'); return; }
      openChoice(t('strain.steadyCrew'), mates.map((p) => ({ value: p.id, label: p.name, sub: t('strain.steadyGives', { n }) })), async (to) => {
        const name = mates.find((p) => p.id === to)?.name ?? '';
        if (fight) {
          if (!actionAvailable(character(), deriveSheet(character(), data))) return;
          try { store.update(id, (d) => { actions.act(d, withUniques(data, d), { kind: 'other', detail: `Steady ${name}` }); }); } catch (err) { toast(ruleText(err), 'danger'); return; }
        }
        toast(await table.boon(to, { ability: 'Steady', strain: -n, note: '' }) ? t('strain.steadySent', { name }) : t('crewStash.why.offline'), 'success');
      });
    },
    check: (d) => {
      const target = checkTarget(d);
      let answered = false;
      const helpNow = character().play.help ?? null; // decision 270: a crewmate's help, spent on this check
      openCheck(target, data, (r) => store.update(id, (c) => {
        if (helpNow && c.play.help?.id === helpNow.id) c.play.help = null;
        if (d.ask && !answered) { // decision 165: the GM asked for this roll — the first result goes back, the card goes
          answered = true;
          table?.rollResult({ ask: d.ask, name: target.en ?? target.name, roll: r.roll, tn: r.effective, success: r.success, margin: r.margin }).then((ok) => { if (!ok) toast(t('crewStash.why.offline'), 'danger'); });
          c.play.rollAsks = (c.play.rollAsks ?? []).filter((a) => a.id !== d.ask);
        }
        if (r.natural === 'crit-failure' && data.strain) actions.strainAsk(c, data, { id: `nat${Date.now()}`, n: data.strain.gains.fumble, why: `A natural 20 (${target.en ?? target.name})` }); // decision 266
        log(c, `${target.en ?? target.name}${d.ask ? ' (GM asked)' : ''}: rolled ${r.roll} vs ${r.effective}${r.tool ? ` (+${r.tool.tn} ${r.tool.name})` : ''}${r.light ? ` (${r.light.label} ${r.light.tn > 0 ? '+' : ''}${r.light.tn})` : ''}${r.site ? ` (${r.site.label} ${r.site.tn})` : ''}${r.help ? ` (${r.help.label} ${r.help.tn > 0 ? '+' : ''}${r.help.tn})` : ''} → ${r.success ? 'success' : 'failure'} (${r.margin >= 0 ? '+' : ''}${r.margin})`, r.success ? 'ok' : 'bad');
      }), { tier: tableTier(), tools: target.tools, boosts: target.boosts, light: d.kind === 'skill' ? lightFor(lightKind(d.id)) : null, site: d.kind === 'skill' ? siteFor({ kind: 'skill', id: d.id }) : null, help: helpNow });
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
  };
  const offClick = delegate(main, 'click', clicks);
  // decision 220: the sheet's tools sit in the app header (outside main): same handlers
  const toolsEl = document.getElementById('page-tools');
  const offTools = toolsEl ? delegate(toolsEl, 'click', clicks) : null;

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
  const onToggle = (e) => { if (e.target.matches?.('details.sheet-sec')) onSectionToggle(e.target); }; // decision 215: remember what is open
  main.addEventListener('toggle', onToggle, true);

  const offChange = delegate(main, 'change', {
    ...caseChanges(() => draw()), // decision 279: the board picker
    portraitFrame: ({ key }, e) => saveFrame({ [key]: Number(e.target.value) }),
    slot: (d, e) => run('slot', { slot: d.slot, value: e.target.value }),
    deck: (_, e) => run('deck', { value: e.target.value }),
    droneSel: (_, e) => run('droneSel', { value: e.target.value }), // decision 172
    optic: (_, e) => run('optic', { value: e.target.value }),
    markAdd: (_, e) => run('markAdd', { name: e.target.value }),
    subclass: (_, e) => run('subclass', { value: e.target.value }),
    cash: (_, e) => run('cash', { value: e.target.value }),
    dealPoints: ({ id: dealId }, e) => run('dealPoints', { id: dealId, value: e.target.value }), // decision 143
    stashName: (_, e) => run('stashName', { value: e.target.value }), // decision 144
    mapTag: (_, e) => run('mapTag', { value: e.target.value }), // decision 160: your letters on the map
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
    findSkill: (_, e) => findSkill(main, e.target.value), // decision 164
  });

  const unsubscribe = store.subscribe((change) => { if (change.id === id && change.type === 'update' && !change.silent) draw(); });
  // decision 232: a new map on the table no longer takes the sheet to the Tactical View — its tab appears next to Sheet
  const offTable = table?.subscribe(() => draw());

  draw();
  return cleanup(offClick, offChange, offInput, unsubscribe, offTable, () => main.removeEventListener('pointerdown', onFrameDown), () => main.removeEventListener('toggle', onToggle, true),
    () => document.documentElement.classList.remove('sheet-open', 'tac-open'), // decision 216: other pages keep their reading width
    () => offTools?.()); // decision 220: the header re-renders the slot empty on other pages; clearing it here would wipe the next sheet's tools (the cleanup can run after it drew)
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
