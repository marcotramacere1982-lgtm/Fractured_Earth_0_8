// Fatigue on the sheet (decision 362): the line beside Strain — n / max, the band, − / + to fix it — and the Push tile
// for a fight (one more action this turn, +1 Fatigue). Push on a roll lives in the check window (dialogs.js).
// Numbers come from rules/fatigue.js through deriveSheet.

import { counter } from './parts.js'; // owner 2026-11-22: the same counter as HP
import { html, raw } from '../dom.js';
import { t } from '../../i18n/index.js';
import { info } from '../ref.js';
import { meter } from './parts.js';

/** The Fatigue line in the status bar. */
export function fatigueStat(c, s, data) {
  const d = data.fatigue;
  if (!d) return '';
  const f = s.fatigue;
  const kind = f.band.id === 'fresh' ? 'info' : f.band.id === 'tired' ? 'warning' : 'danger';
  return html`<div class="stat track stat--fatigue">
    <span class="track__head"><span class="label">${t('fatigue.label')}${info('fatigue', t('fatigue.label'))}</span>
      <span class="pill ${f.band.id === 'fresh' ? '' : kind === 'warning' ? 'pill--warning' : 'pill--danger'}" title="${t(`fatigue.hint.${f.band.id}`)}">${t(`fatigue.band.${f.band.id}`)}${f.band.tn ? ` ${f.band.tn}` : ''}</span>
      ${c.play.stimmed ? html`<span class="pill" title="${t('fatigue.stimmedHint')}">💊</span>` : ''}</span>
    <div class="cluster track__row">${counter({ action: 'fatigueHand', value: f.value, min: 0, max: d.max, label: t('fatigue.label') })}<span class="mono muted">/ ${d.max}</span></div>
    ${meter(f.value, d.max, kind)}
  </div>`;
}

/** The Push tile for the fight strip: one more action this turn (once per turn). '' out of a fight or once used. */
export function pushTile(c, data, icon) {
  const d = data.fatigue;
  const turn = c.play.turn;
  if (!d || !turn?.inCombat) return '';
  const done = turn.pushed === turn.round;
  return html`<button class="action-btn action-btn--k-push ${done ? 'action-btn--on' : ''}" data-action="pushAction" ${done ? raw('disabled') : ''} title="${t('push.actionHint', { n: d.gains.push })}"><span class="action-btn__name">${icon}<span class="action-btn__label">${t(done ? 'push.actionDone' : 'push.action')}</span></span></button>`;
}
