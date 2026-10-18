// Unity Check card (decision 47), shown over every page while the GM has a check open.
// The table talks it through first; then each player locks a secret ballot. Only the tally is revealed.

import { html } from './dom.js';
import { t } from '../i18n/index.js';

const VOTES = ['back', 'object', 'abstain'];

/** u: the open check from the table · me: this sheet's character id · mine: this sheet's ballot */
export function unityCard(u, me, mine) {
  if (!u) return '';
  const actor = u.actorId === me;
  const tally = u.tally;
  return html`<section class="transmission transmission--unity" role="region" aria-label="${t('unity.title')}">
    <header class="transmission__head">
      <span class="transmission__tag">◆ ${t('unity.title')}</span>
      <span class="transmission__meta">${u.phase === 'revealed' ? t('unity.revealed') : t('unity.open')}</span>
    </header>
    <p class="transmission__text">${t('unity.intent', { name: u.actorName })} <strong>${u.intent}</strong></p>
    ${u.phase === 'revealed' && tally ? html`<p class="unity-tally mono">${VOTES.map((v) => `${t(`unity.vote.${v}`)} ${tally[v] ?? 0}`).join(' · ')}</p>
        <p class="transmission__hint">${t('unity.tallyHint')}</p>`
      : actor ? html`<p class="transmission__hint">${t('unity.actorHint')}</p>`
      : html`<div class="cluster unity-votes">${VOTES.map((v) => html`<button class="btn ${mine === v ? 'btn--primary' : ''}" data-unity-vote="${v}" data-check="${u.id}" aria-pressed="${mine === v}">${t(`unity.vote.${v}`)}</button>`)}</div>
        <p class="transmission__hint">${mine ? t('unity.voted', { vote: t(`unity.vote.${mine}`) }) : t('unity.voteHint')}</p>`}
  </section>`;
}

