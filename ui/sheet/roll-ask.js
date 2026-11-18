// The GM asks for a roll (decision 165): a card per ask, shown mid-screen by calls.js (decision 193). *Roll* opens the usual check
// window (difficulty, tools, light, typed dice); the first result goes back to the GM and the card goes. Decision 322:
// an ability that stands in for the skill (Read the Room…) is offered beside it — the Class TN roll answers the GM. Nothing
// imported from actions: the sheet's `check` handler does the rolling.

import { html } from '../dom.js';
import { card } from './parts.js';
import { t } from '../../i18n/index.js';
import { standInsFor } from './scene-abilities.js';

const nameOf = (a, s, data) => (a.kind === 'attr' ? data.attributes.attributes.find((x) => x.id === a.target)?.name : s.skills.find((k) => k.id === a.target)?.name) ?? a.target;

export function rollAskCard(c, s, data) {
  const asks = c.play.rollAsks ?? [];
  if (!asks.length) return '';
  return card(t('ask.title'), html`<div class="stack">${asks.map((a) => {
    if (a.kind === 'help') return html`<div class="spread roll-ask">
      <div><strong>${t('ask.helpTitle', { name: a.helpName })}</strong>${a.helpSkill ? html` <span class="muted">· ${a.helpSkill}</span>` : ''}${a.note ? html`<div class="muted st-small">${a.note}</div>` : ''}</div>
      <div class="cluster">
        <button class="btn btn--primary" data-action="helpCrew" data-to="${a.helpTo}" data-ask="${a.id}">🤝 ${t('ask.help')}</button>
        <button class="btn btn--sm btn--ghost" data-action="askSkip" data-id="${a.id}" data-name="${t('ask.help')}" title="${t('ask.skipHint')}" aria-label="${t('ask.skipHint')}">✕</button>
      </div></div>`; // decision 321: the GM asked this character to help
    const name = nameOf(a, s, data);
    const tier = a.tier != null ? data.difficulty.tiers.find((x) => x.id === a.tier) : null;
    const tn = a.kind === 'attr' ? s.attributes[a.target] : s.skills.find((k) => k.id === a.target)?.value;
    return html`<div class="spread roll-ask">
      <div><strong>${name}</strong> <span class="mono muted">TN ${tn}</span>${tier ? html` <span class="pill ${tier.penalty > 0 ? 'pill--danger' : tier.penalty < 0 ? 'pill--success' : ''}">${tier.name}</span>` : ''}${a.note ? html`<div class="muted st-small">${a.note}</div>` : ''}</div>
      <div class="cluster">
        <button class="btn btn--primary" data-action="check" data-kind="${a.kind}" data-id="${a.target}" data-ask="${a.id}">🎲 ${t('ask.roll')}</button>
        ${a.kind === 'skill' ? standInsFor(c, s, data, a.target).map(({ a: ab, limit }) => html`<button class="btn" data-action="abilityAsk" data-id="${ab.id}" data-ask="${a.id}" title="${t('ask.standInHint')}">🎯 ${t('ask.standIn', { name: ab.name, tn: s.class.tn })}${limit ? html` <span class="muted st-small">· ${limit}</span>` : ''}</button>`) : ''}
        <button class="btn btn--sm btn--ghost" data-action="askSkip" data-id="${a.id}" data-name="${name}" title="${t('ask.skipHint')}" aria-label="${t('ask.skipHint')}">✕</button>
      </div></div>`;
  })}</div>`, { sub: t('ask.sub'), ref: 'skill-check' });
}
