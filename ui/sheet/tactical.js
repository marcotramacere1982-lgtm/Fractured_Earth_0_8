// The Tactical View (decision 162): the Map tab grown into the place where a fight is played. On tablets and desktops
// it fills the window and never scrolls as a page — only its panels do:
//   top:    the stats in one row, the sheet's tabs and the table buttons
//   left:   the turn (round, actions, end round) · the actors (order, who's on the board) · your conditions
//   centre: the map
//   right:  the actions · the class engine · the log
//   bottom: only when something waits for you (the GM asks for initiative, a hit, a card from an ally)
// Phones stack it and scroll as usual. Every button opens the same windows as the Play tab.

import { html } from '../dom.js';
import { t } from '../../i18n/index.js';
import { statusBar, conditionsGrid } from './play.js';
import { turnPieces } from './turn.js';
import { engineCard } from './engine.js';
import { mapTab } from './map-tab.js';
import { initiativeCard } from './initiative.js';
import { rollAskCard } from './roll-ask.js';
import { hitsCard, boonsCard } from './hits.js';

const time = (ms) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/** nav: the sheet's tabs and table buttons, as the sheet draws them. ctx: the tab context (combat, map, tips…). */
export function tacticalView(c, s, data, ctx, nav) {
  const { head, actors, grid } = turnPieces(c, s, data, ctx.combat, { tips: ctx.actionTips, hint: false, bare: true });
  const waiting = [initiativeCard(c, s, data), rollAskCard(c, s, data), hitsCard(c, s, data), boonsCard(c, data)].filter(Boolean);
  return html`<div class="tac" data-tour="tactical">
    <div class="tac__top">${statusBar(c, s, data, { compact: true, all: true })}${nav}</div>
    <aside class="tac__left">
      <section class="tac__panel tac__turn">${head}</section>
      <section class="tac__panel tac__actors" aria-label="${t('tac.actors')}">${actors || html`<p class="muted st-small">${t('tac.noFight')}</p>`}</section>
      <section class="tac__panel tac__conds" aria-label="${t('body.conditions')}">${conditionsGrid(c, s, data, { tips: ctx.actionTips, bare: true })}</section>
    </aside>
    <section class="tac__map">${mapTab(c, s, data, { ...ctx, tactical: true })}</section>
    <aside class="tac__right ${ctx.engineFull ? 'tac__right--engine' : ''}">
      ${ctx.engineFull ? '' : html`<section class="tac__panel tac__actions" aria-label="${t('turn.title')}">${grid}</section>`}
      <section class="tac__panel tac__engine">${engineCard(c, s, data, ctx.combat, { mapDark: ctx.mapDark ?? null, compact: !ctx.engineFull, expandable: true })}</section>
      <section class="tac__panel tac__log" aria-label="${t('notes.log')}"><h3 class="label">${t('notes.log')}</h3>
        <div class="log">${(c.play.log ?? []).slice(0, 30).map((l) => html`<div class="log__row log__row--${l.kind}"><span class="mono muted">${time(l.t)}</span><span>${l.text}</span></div>`)}</div></section>
    </aside>
    ${waiting.length ? html`<div class="tac__bottom">${waiting}</div>` : ''}
  </div>`;
}
