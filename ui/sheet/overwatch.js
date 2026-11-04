// Overwatch (decision 250): the GM saw an enemy cross this character's watched quarter circle and lets them shoot.
// The sheet says so mid-screen: take the shot (a free attack at that enemy — the overwatch ends) or let it pass and
// keep watching until the start of your next turn. Shown once per call, on this device.

import { html } from '../dom.js';
import { t } from '../../i18n/index.js';

let seen = null; // the call this device already answered

/** The window, or '' — call: the table's last overwatch call ({ at, key, label }); only while this sheet is on overwatch. */
export function overwatchOverlay(call, watching) {
  if (!call || !watching || call.at === seen) return '';
  return html`<div class="loadout" role="dialog" aria-modal="true" aria-labelledby="ow-title">
    <div class="loadout__box loadout__box--fight hit-box">
      <header class="loadout__head"><h2 id="ow-title" class="loadout__title">🎯 ${t('overwatch.callTitle')}</h2>
        <p class="loadout__lead">${t('overwatch.callLead', { who: call.label })}</p></header>
      <footer class="loadout__foot cluster">
        <button class="btn btn--primary" data-action="owShoot" data-at="${call.at}" data-key="${call.key}">${t('overwatch.shoot')}</button>
        <button class="btn" data-action="owPass" data-at="${call.at}" data-label="${call.label}">${t('overwatch.pass')}</button></footer>
    </div>
  </div>`;
}
export const closeOverwatch = (at) => { seen = Number(at); };
