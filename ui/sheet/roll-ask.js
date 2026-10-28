// The GM asks for a roll (decision 165): a card per ask on Setup and in the Tactical View. *Roll* opens the usual check
// window (difficulty, tools, light, typed dice); the first result goes back to the GM and the card goes. Nothing
// imported from actions: the sheet's `check` handler does the rolling.

import { html } from '../dom.js';
import { card } from './parts.js';
import { t } from '../../i18n/index.js';

const nameOf = (a, s, data) => (a.kind === 'attr' ? data.attributes.attributes.find((x) => x.id === a.target)?.name : s.skills.find((k) => k.id === a.target)?.name) ?? a.target;

export function rollAskCard(c, s, data) {
  const asks = c.play.rollAsks ?? [];
  if (!asks.length) return '';
  return card(t('ask.title'), html`<div class="stack">${asks.map((a) => {
    const name = nameOf(a, s, data);
    const tn = a.kind === 'attr' ? s.attributes[a.target] : s.skills.find((k) => k.id === a.target)?.value;
    return html`<div class="spread roll-ask">
      <div><strong>${name}</strong> <span class="mono muted">TN ${tn}</span>${a.note ? html`<div class="muted st-small">${a.note}</div>` : ''}</div>
      <div class="cluster">
        <button class="btn btn--primary" data-action="check" data-kind="${a.kind}" data-id="${a.target}" data-ask="${a.id}">🎲 ${t('ask.roll')}</button>
        <button class="btn btn--sm btn--ghost" data-action="askSkip" data-id="${a.id}" data-name="${name}" title="${t('ask.skipHint')}" aria-label="${t('ask.skipHint')}">✕</button>
      </div></div>`;
  })}</div>`, { sub: t('ask.sub'), ref: 'skill-check' });
}
