// Hits from the GM (decision 154): a card on top of the Play tab for each enemy hit the GM sent — who hit you, with
// what, how much, where — and what it does to you (the sheet does the armor maths: rules/injuries.js → hitOutcome).
// Apply takes it; Dodge (in a fight) rolls Avoid first. No actions imported here: play.js imports this module.

import { html } from '../dom.js';
import { card } from './parts.js';
import { hitOutcome } from '../../rules/injuries.js';
import { t } from '../../i18n/index.js';

/** What a hit would do, in words: "Your armor 3 → you lose 6 HP · Broken arm". */
export function hitEffect(s, data, hit) {
  const o = hitOutcome(s, { damage: hit.damage, loc: hit.loc }, data.body);
  const cond = o.condition ? data.conditions.find((k) => k.id === o.condition)?.name ?? o.condition : '';
  return [t('hit.effect', { armor: o.armor, taken: o.taken }), cond, o.crack ? t('hit.crack', { n: o.crack }) : ''].filter(Boolean).join(' · ');
}

export function hitsCard(c, s, data) {
  const hits = c.play.hits ?? [];
  if (!hits.length) return '';
  const fight = Boolean(c.play.turn?.inCombat);
  const avoid = s.skills.find((k) => k.id === 'avoid_reflexes')?.value;
  return card(t('hit.title'), html`<div class="stack">${hits.map((h) => html`<div class="hit-card">
    <p class="hit-card__what">✖ ${t(h.loc ? 'hit.whatAt' : 'hit.what', { from: h.from, attack: h.attack, damage: h.damage, where: h.where })}</p>
    <p class="hit-card__effect">${hitEffect(s, data, h)}</p>
    <p class="mono muted st-small">${h.roll} · ${h.dmgText}</p>
    <div class="cluster">
      <button class="btn btn--danger" data-action="hitApply" data-id="${h.id}">${t('hit.apply')}</button>
      ${fight ? html`<button class="btn" data-action="hitDodge" data-id="${h.id}" title="${t('hit.dodgeHint')}">${t('dodge.title')} · Avoid ${avoid}</button>` : ''}
    </div>
  </div>`)}</div>`, { ref: 'location-attack' });
}

/** Decision 155: cards from allies' abilities — a heal, Braced, a free action, a reminder — taken with Apply. */
export function boonsCard(c, data) {
  const boons = c.play.boons ?? [];
  if (!boons.length) return '';
  const condName = (id) => data.conditions.find((k) => k.id === id)?.name ?? id;
  return card(t('boon.title'), html`<div class="stack">${boons.map((b) => html`<div class="boon-card">
    <p class="boon-card__what">✚ ${t('boon.from', { from: b.from, ability: b.ability })}</p>
    <p>${[b.heal != null ? t('boon.heal', { n: b.heal }) : '', ...(b.conditions ?? []).map(condName), ...(b.clear ?? []).map((k) => t('boon.clear', { name: condName(k) })), b.cracks ? t('boon.cracks', { n: b.cracks }) : '', b.note].filter(Boolean).join(' · ')}</p>
    ${b.healText ? html`<p class="mono muted st-small">${b.healText}</p>` : ''}
    <div class="cluster"><button class="btn btn--primary" data-action="boonApply" data-id="${b.id}">${t('hit.apply')}</button></div>
  </div>`)}</div>`);
}
