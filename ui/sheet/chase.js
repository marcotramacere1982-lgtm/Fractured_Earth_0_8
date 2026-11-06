// A chase on the sheet (decision 275): the gap as a track, the leg, the stretch's complication, and — while you're
// running and haven't moved this leg — your move: Run, Lead, Cover fire, Hack, Trick, Help, Hide. One roll each leg.

import { html } from '../dom.js';
import { info } from '../ref.js';
import { t } from '../../i18n/index.js';

export function chaseBlock(chase, c, data) {
  if (!chase) return '';
  const d = data.chase;
  const mine = chase.crew?.includes(c.id);
  const behind = chase.behind?.includes(c.id);
  const moved = chase.moved?.includes(c.id) || (c.play.chaseMove?.chase === chase.id && c.play.chaseMove?.leg === chase.leg);
  const cells = Array.from({ length: chase.max + 1 }, (_, i) => html`<span class="chase-track__cell ${i === 0 ? 'is-them' : ''} ${i === chase.gap ? 'is-crew' : ''} ${i > 0 && i < chase.gap ? 'is-gap' : ''}">${i === 0 ? '⚑' : i === chase.gap ? '🏃' : i === chase.max ? '◎' : ''}</span>`);
  if (chase.ended) {
    return html`<section class="chase-strip chase-strip--end" aria-live="polite"><strong>🏃 ${t(`chase.ended.${chase.ended}`)}</strong></section>`;
  }
  const canHide = chase.gap >= d.gap.hideFrom && !chase.drone;
  const mv = c.play.chaseMove?.chase === chase.id && c.play.chaseMove?.leg === chase.leg ? c.play.chaseMove : null;
  return html`<section class="chase-strip" aria-label="${t('chase.title')}">
    <div class="spread"><strong>🏃 ${t('chase.title')} · ${t('chase.leg', { n: chase.leg })}${info('chase', t('chase.title'))}</strong>
      <span class="muted st-small">${t('chase.after', { who: chase.pursuers })}${chase.drone ? ` · 🛸 ${t('chase.drone')}` : ''}</span></div>
    <div class="chase-track" aria-label="${t('chase.gap', { n: chase.gap, max: chase.max })}">${cells}</div>
    <p class="st-small"><strong>${t('chase.gap', { n: chase.gap, max: chase.max })}</strong>${chase.last ? html` · ${chase.last}` : ''}${chase.crewBonus ? html` · <span class="pill pill--success">${t('chase.bonus', { n: chase.crewBonus })}</span>` : ''}</p>
    ${chase.complication ? html`<p class="st-small"><strong>${chase.complication.name}</strong> — ${chase.complication.text}</p>` : ''}
    ${!mine ? '' : behind ? html`<p class="notice notice--danger">${t('chase.behind')}</p>`
      : moved ? html`<p class="muted st-small">${mv ? t('chase.youMoved', { move: t(`chase.move.${mv.move}`), ok: mv.success ? '✓' : '✗' }) : t('chase.waiting')}</p>`
      : html`<div class="chase-moves">${d.moves.map((m) => html`<button class="btn btn--sm ${m.id === 'run' ? 'btn--primary' : ''}" data-action="chaseMove" data-move="${m.id}" ${m.id === 'hide' && !canHide ? 'disabled' : ''} title="${t(`chase.hint.${m.id}`)}">${m.icon} ${t(`chase.move.${m.id}`)}</button>`)}</div>`}
  </section>`;
}
