// Air (decision 273): the card while you hold your breath — rounds left, then the CON roll, then the drowning dice;
// "A round passes" out of a fight (in one, your turn's start does it), and "Air!" when you get it back.

import { html } from '../dom.js';
import { card, meter } from './parts.js';
import { t } from '../../i18n/index.js';

export function breathCard(c, s, data) {
  const b = c.play.breath;
  if (!b) return '';
  const fight = Boolean(c.play.turn?.inCombat);
  const con = s.attributes.CON;
  const ask = b.ask;
  return card(html`🫁 ${t('breath.title')}`, html`<div class="stack breath-card">
    ${b.why ? html`<p class="muted st-small">${b.why}</p>` : ''}
    ${b.out ? html`<p class="notice notice--danger">${t('breath.out')}</p>`
      : b.left ? html`<p><strong>${t('breath.left', { n: b.left, max: b.max })}</strong></p>${meter(b.left, b.max, b.left > b.max / 3 ? 'info' : 'danger')}`
      : html`<p class="notice notice--danger">${t('breath.empty')}</p>`}
    ${ask?.kind === 'check' ? html`<button class="btn btn--primary" data-action="breathRoll">🎲 ${t('breath.check', { tn: con + ask.penalty, penalty: `−${Math.abs(ask.penalty)}` })}</button>` : ''}
    ${ask?.kind === 'drown' ? html`<div class="cluster breath-drown"><span class="label">${t('breath.drown', { dice: ask.dice })}</span>
      <button class="btn btn--danger" data-action="breathDrown" data-mode="roll">🎲 ${t('strain.roll', { die: ask.dice })}</button>
      <input class="input input--num" type="number" min="1" max="6" inputmode="numeric" placeholder="${ask.dice}" aria-label="${t('strain.typed')}" data-breath-typed>
      <button class="btn" data-action="breathDrown" data-mode="typed">${t('check.resolve')}</button></div>` : ''}
    <div class="cluster">
      ${fight ? html`<span class="hint">${t('breath.inFight')}</span>` : html`<button class="btn btn--sm" data-action="breathRound" ${ask ? 'disabled' : ''}>⏱ ${t('breath.round')}</button>`}
      <button class="btn btn--sm btn--primary" data-action="breathAir">${t('breath.air')}</button>
    </div>
  </div>`, { ref: 'breath' });
}
