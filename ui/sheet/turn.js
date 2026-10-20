// Turn panel: round, action pips, the action menu. Every action is logged (and seen by the GM).

import { html, raw } from '../dom.js';
import { card, temp } from './parts.js';
import { info } from '../ref.js';
import { turnStatus, newTurn } from '../../rules/turn.js';
import { t } from '../../i18n/index.js';

/** The GM's initiative order, as the sheet sees it (enemies are just "Hostile"). */
function orderStrip(c, combat) {
  const mineNow = combat.order.find((o) => o.current)?.key === c.id;
  return html`
    ${mineNow ? html`<div class="your-turn" role="status">▶ ${t('turn.yours')}</div>` : ''}
    <ol class="init-strip" aria-label="${t('turn.order')}">${combat.order.map((o) => html`
      <li class="init-strip__item ${o.current ? 'is-current' : ''} ${o.done ? 'is-done' : ''} ${o.key === c.id ? 'is-me' : ''} ${o.key === 'hostile' ? 'is-hostile' : ''} ${o.down ? 'is-down' : ''}">${o.name}</li>`)}</ol>`;
}

/** The enemies the GM has revealed, by letter: what anyone at the table could see of them. */
function hostilesList(combat, data) {
  if (!combat.hostiles?.length) return '';
  const condName = (id) => data.conditions.find((x) => x.id === id)?.name ?? id;
  return html`
    <h3 class="label hostiles__title">${t('turn.hostiles')}${info('hostiles', t('turn.hostiles'))}</h3>
    <ul class="hostiles" data-tour="hostiles">${combat.hostiles.map((h) => html`
      <li class="hostiles__row ${h.band === 'down' ? 'is-down' : ''}">
        <span class="letter-badge">${h.letter}</span>
        <span class="hostiles__name">${h.name}</span>
        <span class="pill tag--${h.tag}">${h.tag}</span>
        <span class="pill hostiles__band hostiles__band--${h.band}">${t(`turn.band.${h.band}`)}</span>
        ${h.conditions.map((id) => html`<span class="pill pill--danger">${condName(id)}</span>`)}
      </li>`)}</ul>`;
}

/** What this round's actions were, in order: "Attack · Pistol", "Move", "Ping Sweep"… */
function spentList(spent) {
  if (!spent?.length) return '';
  const label = (w) => (w.kind === 'ability' ? w.name
    : `${w.kind === 'dodge' ? t('dodge.title') : t(['attack', 'move', 'located'].includes(w.kind) ? `turn.${w.kind}` : `action.${w.kind}`)}${w.name ? ` · ${w.name}` : ''}${w.borrowed ? ` (${t('turn.fromLastRound')})` : ''}`);
  return html`<ol class="act-spent" aria-label="${t('turn.doneThisRound')}">${spent.map((w) => html`<li class="act-spent__item act-spent__item--${w.kind}">${label(w)}</li>`)}</ol>`;
}

/** combat: the GM's combat state when this sheet is at the table and the GM runs the rounds. */
export function turnCard(c, s, data, combat = null) {
  const ts = turnStatus(c.play.turn ?? newTurn(), s.combat.act.value, c.play.conditions, data.actions);
  const gmRuns = Boolean(combat && ts.inCombat && c.play.turn?.tableCombat === combat.id);
  const pipsHtml = Array.from({ length: ts.max }, (_, i) => html`<span class="act-pip ${i < ts.used ? 'is-used' : ''}" aria-hidden="true"></span>`);
  const weapons = s.weapons.filter((w) => !w.empty && (!ts.inCombat || w.inHand)); // in combat: only the weapon in hand
  const otherWeapon = ts.inCombat ? s.weapons.find((w) => !w.empty && !w.inHand) : null;
  const noActions = ts.inCombat && ts.left === 0;

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
      ${gmRuns ? html`${orderStrip(c, combat)}${hostilesList(combat, data)}` : ''}`
    : html`<div class="turn-head">
        <p class="muted turn-idle">${t('turn.idle')}</p>
        <button class="btn btn--primary" data-action="combatStart">${t('turn.startCombat')}</button>
      </div>`;

  const body = html`
    ${head}
    ${noActions ? html`<p class="notice notice--warn">${t('turn.noneLeft')}</p>` : ''}
    <div class="action-grid" data-tour="actions">
      ${weapons.length ? weapons.map((w) => {
        const off = noActions || w.usable === false;
        return html`
        <button class="action-btn action-btn--attack" data-action="attackRoll" data-slot="${w.slot}" ${off ? raw('disabled') : ''} title="${w.usable === false ? t(`weapons.unusable.${w.why}`) : ''}">
          <span class="action-btn__name">${t('turn.attack')}</span><span class="action-btn__sub">${w.name} · TN ${temp(w.base, w.tn)}${w.magSize ? ` · ${w.rounds}/${w.magSize}${w.burst > 1 ? ` · ${t('turn.attacksLeft', { n: w.attacksLeft })}` : ''}` : ''}</span></button>
        <button class="action-btn action-btn--attack action-btn--located" data-action="attackRoll" data-slot="${w.slot}" data-located="1" ${off ? raw('disabled') : ''} title="${t('turn.locatedHint')}">
          <span class="action-btn__name">⌖ ${t('turn.located')}</span><span class="action-btn__sub">${w.name} · TN ${w.tn - s.locationPenalty}</span></button>`;
      })
        : html`<button class="action-btn" disabled><span class="action-btn__name">${t('turn.attack')}</span><span class="action-btn__sub">${t('turn.noWeapon')}</span></button>`}
      ${otherWeapon ? html`<button class="action-btn" data-action="hand" data-slot="${otherWeapon.slot}" ${noActions ? raw('disabled') : ''} title="${t('turn.swapHint')}">
        <span class="action-btn__name">⇆ ${t('turn.swapTo', { weapon: otherWeapon.name })}</span><span class="action-btn__sub">${t('turn.swapSub')}</span></button>` : ''}
      <button class="action-btn" data-action="act" data-kind="move" data-detail="up to ${s.move} squares" ${noActions ? raw('disabled') : ''}>
        <span class="action-btn__name">${t('turn.move')}</span><span class="action-btn__sub">${s.move !== s.moveBase ? html`<span class="temp temp--down">${t('turn.squares', { n: s.move })}</span>` : t('turn.squares', { n: s.move })}</span></button>
      ${data.actions.actions.filter((a) => !['move', 'attack', 'ability'].includes(a.id)).map((a) => html`
        <button class="action-btn" data-action="${a.id === 'reload' ? 'reloadPick' : a.id === 'use_item' ? 'useItem' : 'act'}" data-kind="${a.id}" title="${a.desc}" ${noActions ? raw('disabled') : ''}>
          <span class="action-btn__name">${t(`action.${a.id}`)}</span><span class="action-btn__sub">${a.desc.split('.')[0]}</span></button>`)}
      ${ts.inCombat ? html`<button class="action-btn action-btn--reaction" data-action="dodgeRoll" title="${data.actions.reactions[0].desc}">
        <span class="action-btn__name">${t('dodge.title')}</span><span class="action-btn__sub">${t('turn.dodgeSub')} · Avoid ${s.skills.find((k) => k.id === 'avoid_reflexes')?.value}</span></button>` : ''}
    </div>
    <p class="hint">${t('turn.abilitiesHint', { tn: s.class ? ` (${s.class.tn})` : '' })}</p>`;
  return card(t('turn.title'), body, { ref: 'actions', tour: 'turn' });
}
