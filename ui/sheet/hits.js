// Hits from the GM (decision 154): each enemy hit the GM sent — who hit you, with what, how much, where — and what it
// does to you (the sheet does the armor maths: rules/injuries.js → hitOutcome). Decision 207: a window in the middle of
// the screen, answered before anything else; Take the hit, or Dodge (in a fight) rolls Avoid first. No actions imported here: play.js imports this module.

import { html } from '../dom.js';
import { card } from './parts.js';
import { hitOutcome } from '../../rules/injuries.js';
import { allowance, newTurn, roundAllowance } from '../../rules/turn.js';
import { t } from '../../i18n/index.js';

/** What a hit would do, in words: "Your armor 3 → you lose 6 HP · Broken arm". */
export function hitEffect(s, data, hit) {
  const o = hitOutcome(s, { damage: hit.damage, loc: hit.loc, cover: hit.cover ?? null }, data.body);
  const cond = o.condition ? data.conditions.find((k) => k.id === o.condition)?.name ?? o.condition : '';
  return [t('hit.effect', { armor: o.armor, taken: o.taken }), hit.cover ? t('hit.cover', { n: hit.cover }) : '', cond, o.crack ? t('hit.crack', { n: o.crack }) : ''].filter(Boolean).join(' · ');
}

/**
 * Decision 207: a hit the GM sent comes up in the middle of the screen, like the pre-fight window, and stays until you
 * answer it — Take the hit, or Dodge (which says what it costs). One at a time ("1 of 2"). The effect is the big line
 * (−N HP, the condition, the crack); the maths stays under it, small.
 */
export function hitOverlay(c, s, data) {
  const hits = c.play.hits ?? [];
  if (!hits.length) return '';
  const h = hits[0];
  const o = hitOutcome(s, { damage: h.damage, loc: h.loc, cover: h.cover ?? null }, data.body);
  const cond = o.condition ? data.conditions.find((k) => k.id === o.condition)?.name ?? o.condition : '';
  const fight = Boolean(c.play.turn?.inCombat);
  const avoid = s.skills.find((k) => k.id === 'avoid_reflexes')?.value;
  const turn = c.play.turn ?? newTurn();
  const thisRound = turn.used < roundAllowance(turn, s.combat.act.value, c.play.conditions, data.actions); // decision 161: this round's action first
  return html`<div class="loadout" role="dialog" aria-modal="true" aria-labelledby="hit-title">
    <div class="loadout__box loadout__box--fight hit-box">
      <header class="loadout__head"><h2 id="hit-title" class="loadout__title">✖ ${t('hit.title')}${hits.length > 1 ? html` <small class="hit-box__count">${t('hit.of', { n: 1, total: hits.length })}</small>` : ''}</h2>
        <p class="loadout__lead">${t(h.loc ? 'hit.byAt' : 'hit.by', { from: h.from, attack: h.attack, where: h.where })}</p></header>
      <div class="loadout__body hit-box__body">
        <p class="hit-box__big ${o.taken ? 'is-hurt' : ''}">${o.taken ? t('hit.loseHp', { n: o.taken }) : t('hit.stopped')}</p>
        ${cond || o.crack ? html`<p class="hit-box__more">${cond ? html`<span class="pill pill--danger">${cond}</span>` : ''}${o.crack ? html`<span class="pill pill--warning">${t('hit.crack', { n: o.crack })}</span>` : ''}</p>` : ''}
        <p class="mono muted st-small">${t('hit.calc', { damage: h.damage, armor: o.armor })}${h.cover ? ` · ${t('hit.cover', { n: h.cover })}` : ''} · ${h.roll} · ${h.dmgText}</p>
      </div>
      <footer class="loadout__foot hit-box__foot">
        <button class="btn btn--danger hit-box__btn" data-action="hitApply" data-id="${h.id}"><strong>${t('hit.take')}</strong><span class="st-small">${o.taken ? t('hit.loseHp', { n: o.taken }) : t('hit.noHp')}</span></button>
        ${fight ? html`<button class="btn hit-box__btn" data-action="hitDodge" data-id="${h.id}"><strong>${t('dodge.title')} · Avoid ${avoid}</strong>
          <span class="st-small">${t(thisRound ? 'hit.dodgeNow' : 'hit.dodgeBorrow')} · ${t('hit.dodgeRisk')}</span></button>` : ''}
      </footer>
    </div>
  </div>`;
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
