// Turn panel: round, action pips, the action menu. Every action is logged (and seen by the GM).

import { portraitImg } from '../portrait.js';
import { html, raw } from '../dom.js';
import { card, temp, icon } from './parts.js';
import { info } from '../ref.js';
import { turnStatus, newTurn } from '../../rules/turn.js';
import { t } from '../../i18n/index.js';

/** The GM's initiative order, as the sheet sees it (enemies are just "Hostile"). */
/** Decision 159: a player's face in the order — their portrait (blue ring), or their initial; enemies stay faceless. */
function face(o, c) {
  if (o.key === 'hostile' || o.key === 'ally') return '';
  if (o.key === c.id && c.portrait?.dataUrl) return portraitImg(c.portrait, 'init-face');
  if (o.face) return portraitImg({ dataUrl: `/api/table/portrait?id=${encodeURIComponent(o.key)}`, frame: o.face }, 'init-face');
  return html`<span class="init-face init-face--none" aria-hidden="true">${(o.name || '?').trim().charAt(0).toUpperCase()}</span>`;
}

function orderStrip(c, combat) {
  const now = combat.order.find((o) => o.current);
  const mineNow = now?.key === c.id;
  // decision 152: who acts now, in words — a player or an ally by name, an enemy as "a Hostile"
  const who = !now ? '' : now.key === c.id ? t('turn.yours') : now.key === 'hostile' ? t('turn.nowHostile') : t('turn.nowActing', { name: now.name });
  return html`
    ${mineNow ? html`<div class="your-turn" role="status">▶ ${t('turn.yours')}</div>` : who ? html`<p class="turn-now" role="status">▶ ${who}</p>` : ''}
    <ol class="init-strip" aria-label="${t('turn.order')}">${combat.order.map((o) => html`
      <li class="init-strip__item ${o.current ? 'is-current' : ''} ${o.done ? 'is-done' : ''} ${o.key === c.id ? 'is-me' : ''} ${o.key === 'hostile' ? 'is-hostile' : ''} ${o.key === 'ally' ? 'is-ally' : ''} ${o.down ? 'is-down' : ''}">${face(o, c)}${o.key === c.id ? t('map.you') : o.name}</li>`)}</ol>`;
}

/**
 * The enemies the GM has revealed, by letter: what anyone at the table could see of them (decision 152: a portrait
 * when the GM has one — tap for the full picture —, orange for elites; allies apart, named, in green).
 */
function foeCard(h, data) {
  const condName = (id) => data.conditions.find((x) => x.id === id)?.name ?? id;
  const pic = h.art ? `/api/table/art?art=${h.art}&size=portrait&look=${h.look ?? 1}` : null;
  return html`<li class="foe ${h.elite ? 'foe--elite' : ''} ${h.ally ? 'foe--ally' : ''} ${h.band === 'down' ? 'is-down' : ''}">
    ${pic ? html`<button class="foe__pic" data-action="foeImage" data-art="${h.art}" data-look="${h.look ?? 1}" data-name="${h.name}" title="${t('foe.full')}" aria-label="${t('foe.full')}: ${h.name}">
      <span class="foe__letter" aria-hidden="true">${h.letter}</span><img src="${pic}" alt="" loading="lazy"></button>`
      : html`<span class="foe__pic foe__pic--none"><span class="foe__letter">${h.letter}</span></span>`}
    <div class="foe__body">
      <div class="foe__head"><span class="letter-badge">${h.letter}</span><span class="foe__name">${h.name}</span>
        ${h.elite ? html`<span class="pill pill--warning">${t('foe.elite')}</span>` : ''}${h.ally ? html`<span class="pill pill--success">${t('foe.ally')}</span>` : ''}</div>
      <div class="foe__tags"><span class="pill hostiles__band hostiles__band--${h.band}">${t(`turn.band.${h.band}`)}</span><span class="pill tag--${h.tag}">${h.tag}</span>
        ${h.conditions.map((id) => html`<span class="pill pill--danger">${icon(data, data.conditions.find((k) => k.id === id)?.icon)}${condName(id)}</span>`)}</div>
    </div>
  </li>`;
}
function hostilesList(combat, data) {
  if (!combat.hostiles?.length) return '';
  const allies = combat.hostiles.filter((h) => h.ally);
  const foes = combat.hostiles.filter((h) => !h.ally);
  return html`
    ${allies.length ? html`<h3 class="label hostiles__title">${t('foe.allies')}</h3><ul class="foes">${allies.map((h) => foeCard(h, data))}</ul>` : ''}
    ${foes.length ? html`<h3 class="label hostiles__title">${t('turn.hostiles')}${info('hostiles', t('turn.hostiles'))}</h3>
    <ul class="foes" data-tour="hostiles">${foes.map((h) => foeCard(h, data))}</ul>` : ''}`;
}

/** What this round's actions were, in order: "Attack · Pistol", "Move", "Ping Sweep"… */
function spentList(spent) {
  if (!spent?.length) return '';
  const label = (w) => (w.kind === 'ability' ? w.name
    : `${w.kind === 'dodge' ? t('dodge.title') : t(['attack', 'move', 'located'].includes(w.kind) ? `turn.${w.kind}` : `action.${w.kind}`)}${w.name ? ` · ${w.name}` : ''}${w.borrowed ? ` (${t('turn.fromLastRound')})` : ''}`);
  return html`<ol class="act-spent" aria-label="${t('turn.doneThisRound')}">${spent.map((w) => html`<li class="act-spent__item act-spent__item--${w.kind}">${label(w)}</li>`)}</ol>`;
}

/**
 * Decision 162: the Turn card's pieces — `head` (round, actions, end round), `actors` (the order and who's on the
 * board), `grid` (the action buttons) — so the Tactical View can lay them out apart; the Play tab composes them as before.
 * combat: the GM's combat state when this sheet is at the table and the GM runs the rounds.
 */
export function turnPieces(c, s, data, combat = null, { tips = false, hint = true, bare = false } = {}) {
  const ts = turnStatus(c.play.turn ?? newTurn(), s.combat.act.value, c.play.conditions, data.actions);
  const gmRuns = Boolean(combat && ts.inCombat && c.play.turn?.tableCombat === combat.id);
  const pipsHtml = Array.from({ length: ts.max }, (_, i) => html`<span class="act-pip ${i < ts.used ? 'is-used' : ''}" aria-hidden="true"></span>`);
  const weapons = s.weapons.filter((w) => !w.empty && w.inHand); // decision 97: one Attack, the weapon in hand (aim at a location inside the roll window)
  const otherWeapon = s.weapons.find((w) => !w.empty && !w.inHand);
  const sub = (text) => (tips ? html`<span class="action-btn__sub">${text}</span>` : '');
  const noActions = ts.inCombat && ts.left === 0;
  const label = (text) => html`<span class="action-btn__label">${text}</span>`; // decision 163: hidden in the Tactical View's bare grid

  const head = ts.inCombat
    ? html`<div class="turn-head">
        <div class="turn-round"><span class="label">${t('turn.round')}</span><span class="turn-round__n">${ts.round}</span></div>
        <div class="turn-actions"><span class="label">${t('stat.actions')}${info('actions', t('stat.actions'))}</span>
          <div class="act-pips" role="img" aria-label="${t('turn.leftOf', { left: ts.left, max: ts.max })}">${pipsHtml}</div>
          <span class="mono muted">${t('turn.left', { n: ts.left })}${ts.reserved ? ` · ${t('turn.borrowed', { n: ts.reserved })}` : ''}${c.play.conditions.includes('stunned') ? ` · ${t('turn.stunned')}` : ''}</span>
          ${spentList(ts.spent)}</div>
        ${gmRuns ? html`<p class="muted turn-controls">${t('turn.gmRuns')}${info('round-end', t('turn.endRound'))}</p>` : html`<div class="cluster turn-controls">
          <button class="btn btn--primary" data-action="roundEnd">${t('turn.endRound')}${info('round-end', t('turn.endRound'))}</button>
          <button class="btn btn--ghost btn--sm" data-action="combatEnd">${t('turn.endCombat')}</button>
        </div>`}
      </div>
      `
    : html`<div class="turn-head">
        <p class="muted turn-idle">${t('turn.idle')}</p>
        <button class="btn btn--primary" data-action="combatStart">${t('turn.startCombat')}</button>
      </div>`;

  const actors = gmRuns ? html`${orderStrip(c, combat)}${hostilesList(combat, data)}` : '';
  const moveLeft = ts.inCombat ? c.play.turn?.moveLeft ?? 0 : 0; // decision 161: the squares a Move gave, still to walk
  const grid = html`
    ${noActions ? html`<p class="notice notice--warn">${t('turn.noneLeft')}</p>` : ''}
    <div class="action-grid ${bare && !tips ? 'action-grid--bare' : ''}" data-tour="actions">
      ${weapons.length ? weapons.map((w) => {
        const off = noActions || w.usable === false;
        return html`
        <button class="action-btn action-btn--attack action-btn--wide" data-action="attackRoll" data-slot="${w.slot}" ${off ? raw('disabled') : ''} title="${t('turn.attack')} — ${w.usable === false ? t(`weapons.unusable.${w.why}`) : t('turn.attackHint')}">
          <span class="action-btn__name">${icon(data, data.actions.actions.find((x) => x.id === 'attack')?.icon)}${label(t('turn.attack'))}</span><span class="action-btn__live">${w.name} · TN ${temp(w.base, w.tn)}${w.magSize ? ` · ${w.rounds}/${w.magSize}${w.burst > 1 ? ` · ${t('turn.attacksLeft', { n: w.attacksLeft })}` : ''}` : ''}</span>${sub(t('turn.attackHint'))}</button>`;
      })
        : html`<button class="action-btn" disabled><span class="action-btn__name">${t('turn.attack')}</span><span class="action-btn__sub">${t('turn.noWeapon')}</span></button>`}
      ${otherWeapon ? html`<button class="action-btn" data-action="hand" data-slot="${otherWeapon.slot}" ${noActions ? raw('disabled') : ''} title="${t('turn.swapTo', { weapon: otherWeapon.name })} — ${t('turn.swapHint')}">
        <span class="action-btn__name">${icon(data, 'act_swap')}${label(t('turn.swapTo', { weapon: otherWeapon.name }))}</span>${sub(t('turn.swapSub'))}</button>` : ''}
      <button class="action-btn action-btn--wide" data-action="act" data-kind="move" data-detail="up to ${s.move} squares" ${noActions ? raw('disabled') : ''} title="${t('turn.move')} — ${t('turn.moveHint')}">
        <span class="action-btn__name">${icon(data, data.actions.actions.find((x) => x.id === 'move')?.icon)}${label(t('turn.move'))}</span><span class="action-btn__live">${moveLeft ? t('turn.squaresLeft', { n: moveLeft }) : s.move !== s.moveBase ? html`<span class="temp temp--down">${t('turn.squares', { n: s.move })}</span>` : t('turn.squares', { n: s.move })}</span></button>
      ${data.actions.actions.filter((a) => !['move', 'attack', 'ability'].includes(a.id)).map((a) => {
        const lit = a.id === 'aim' && c.play.aimed; // decision 150: aimed, until the next attack
        return html`
        <button class="action-btn ${lit ? 'action-btn--on' : ''}" data-action="${a.id === 'reload' ? 'reloadPick' : a.id === 'use_item' ? 'useItem' : 'act'}" data-kind="${a.id}" title="${t(`action.${a.id}`)} — ${a.desc}" ${lit ? raw('aria-pressed="true"') : ''} ${noActions || lit ? raw('disabled') : ''}>
          <span class="action-btn__name">${icon(data, a.icon)}${label(t(`action.${a.id}`))}</span>${lit ? html`<span class="action-btn__live">${t('turn.aimed')}</span>` : sub(a.desc.split('.')[0])}</button>`;
      })}
      ${ts.inCombat ? html`<button class="action-btn action-btn--reaction action-btn--wide" data-action="dodgeRoll" title="${t('dodge.title')} — ${data.actions.reactions[0].desc}">
        <span class="action-btn__name">${icon(data, data.actions.reactions[0].icon)}${label(t('dodge.title'))}</span><span class="action-btn__live">Avoid ${s.skills.find((k) => k.id === 'avoid_reflexes')?.value}</span>${sub(t('turn.dodgeSub'))}</button>` : ''}
    </div>
    <div class="spread">${hint ? html`<p class="hint">${t('turn.abilitiesHint', { tn: s.class ? ` (${s.class.tn})` : '' })}</p>` : ''}
      <button class="btn btn--sm btn--ghost" data-action="actionTips" aria-pressed="${tips}" title="${t('turn.tipsHint')}">? ${t(tips ? 'turn.tipsHide' : 'turn.tipsShow')}</button></div>`;
  return { head, actors, grid };
}

export function turnCard(c, s, data, combat = null, opts = {}) {
  const { head, actors, grid } = turnPieces(c, s, data, combat, opts);
  return card(t('turn.title'), html`${head}${actors}${grid}`, { ref: 'actions', tour: 'turn' });
}
