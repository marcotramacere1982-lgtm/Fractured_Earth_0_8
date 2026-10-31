// The GM calls for a roll (decision 193): initiative (decision 148) and any skill or attribute roll (decision 165)
// come up mid-screen over whatever tab is open, instead of a card at the bottom that was easy to miss. The window goes
// when the roll is answered (or a roll ask is declined with its ✕); the pre-fight loadout window comes first.

import { html } from '../dom.js';
import { t } from '../../i18n/index.js';
import { initiativeCard } from './initiative.js';
import { rollAskCard } from './roll-ask.js';

export function callOverlay(c, s, data) {
  const parts = [initiativeCard(c, s, data), rollAskCard(c, s, data)].filter(Boolean);
  if (!parts.length) return '';
  return html`<div class="loadout loadout--call" role="dialog" aria-modal="true" aria-label="${t('ask.title')}">
    <div class="loadout__box loadout__box--call">
      <div class="loadout__body">${parts}</div>
    </div>
  </div>`;
}
