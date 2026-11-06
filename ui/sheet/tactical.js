// The Tactical View (decision 162): the Map tab grown into the place where a fight is played. On tablets and desktops
// it fills the window and never scrolls as a page — only its panels do:
//   top:    the stats in one row, the sheet's tabs and the table buttons
//   centre: the map, as big as the window allows
//   header: the actions as one row of icons in the map card's header (decision 195), the torch among them; under it
//           one context line — what you tapped, or what you can do (decision 198)
//   under:  the class bar — the meter, a tile per equipped ability, housekeeping (decision 198); outside the area the
//           bookmarks slide over, so an open one ends above it and never covers it (decision 200)
//   sides:  bookmarks (decision 190) — left: the turn and order · your conditions; right: the class engine (meter,
//           then the abilities) · what you tapped on the map (decision 192) · the log. One opens over the map's edge
//           at a time per side; a fight opens Turn (decision 198: nothing opens on the right by itself),
//           the end of the fight folds them back
//   bottom: only when something waits for you (a hit, a card from an ally); the GM's roll calls come mid-screen (calls.js)
// Phones stack it and scroll as usual. Every button opens the same windows as the Play tab.

import { html } from '../dom.js';
import { railLayout, railOpen, railClose } from '../rails.js';
import { t } from '../../i18n/index.js';
import { statusBar, conditionsGrid } from './play.js';
import { turnPieces } from './turn.js';
import { engineCard } from './engine.js';
import { mapTab, mapPanel } from './map-tab.js';
import { classBar } from './class-bar.js';
import { icon } from './parts.js';
import { displayMenu } from '../scale.js';
import { boonsCard } from './hits.js';
import { breathCard } from './breath.js'; // decision 273

const time = (ms) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

// what the panels last reacted to: a fight starting or ending, your turn coming round (decision 190)
let seenFight = null;
function react(c, combat) {
  const fight = combat?.active ? combat.id : null;
  if (fight !== seenFight) {
    // decision 198: the abilities are on the class bar — on the right, nothing opens by itself
    if (fight) railOpen('tac', 'left', 'turn'); else if (seenFight) { railClose('tac', 'left'); railClose('tac', 'right'); }
    seenFight = fight;
  }
}

/** nav: the sheet's tabs and table buttons, as the sheet draws them. ctx: the tab context (combat, map, tips…). */
export function tacticalView(c, s, data, ctx, nav) {
  react(c, ctx.combat);
  // decision 198: the torch is a tile in the strip, lit while on (shown only when you carry one)
  const torch = ctx.torch == null ? '' : html`<button class="action-btn action-btn--k-torch ${ctx.torch ? 'action-btn--on' : ''}" data-action="mapTorch" data-on="${ctx.torch ? '0' : '1'}" aria-pressed="${ctx.torch}" data-tour="map-gear"
    title="${t(ctx.torch ? 'map.torch.on' : 'map.torch.off')} — ${t('map.torch.hint')}"><span class="action-btn__name">${icon(data, 'sun')}<span class="action-btn__label">${t(ctx.torch ? 'map.torch.on' : 'map.torch.off')}</span></span></button>`;
  const { head, actors, grid } = turnPieces(c, s, data, ctx.combat, { hint: false, bare: true, strip: true, atTable: ctx.atTable, extra: torch });
  const waiting = [boonsCard(c, data), breathCard(c, s, data)].filter(Boolean); // decision 273: holding your breath // initiative, roll calls (decision 193) and hits (decision 207) come mid-screen
  const ico = (id) => data.icons[id] ?? '';
  const conds = (c.play.conditions ?? []).length;
  const left = [
    { id: 'turn', icon: ico('ini'), label: t('tac.rail.turn'), body: html`<div class="tac__turn">${head}</div><div class="tac__actors" aria-label="${t('tac.actors')}">${actors || html`<p class="muted st-small">${t('tac.noFight')}</p>`}</div>` },
    { id: 'conds', icon: ico('cond_wounded'), label: t('tac.rail.conds'), badge: conds || null, body: html`<div class="tac__conds">${conditionsGrid(c, s, data, { tips: ctx.actionTips, bare: true })}</div>` },
  ];
  const right = [
    { id: 'class', icon: ico(c.classId) || ico('class_tn'), label: t('tac.rail.class'), body: html`<div class="tac__engine">${engineCard(c, s, data, ctx.combat, { mapDark: ctx.mapDark ?? null, reference: true })}</div>` },
    { id: 'map', icon: ico('optic_motion') || ico('reticle'), label: t('tac.rail.map'), body: mapPanel(c, s, data, ctx) },
    { id: 'log', icon: ico('act_other'), label: t('tac.rail.log'), body: html`<div class="log">${(c.play.log ?? []).slice(0, 30).map((l) => html`<div class="log__row log__row--${l.kind}"><span class="mono muted">${time(l.t)}</span><span>${l.text}</span></div>`)}</div>` },
  ];
  return html`<div class="tac" data-tour="tactical">
    <div class="tac__top">${ctx.strip ?? ''}<div class="tac__statusrow">${statusBar(c, s, data, { compact: true, all: true })}${displayMenu()}</div>${nav}</div>
    ${railLayout('tac', { left, right, className: 'tac__rails', main: html`<section class="tac__map">${mapTab(c, s, data, { ...ctx, tactical: true, actions: grid })}</section>` })}
    ${classBar(c, s, data)}
    ${waiting.length ? html`<div class="tac__bottom">${waiting}</div>` : ''}
  </div>`;
}
