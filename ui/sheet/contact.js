// Contact (decision 211): one of the crew's markers saw an enemy the GM had waiting on the map. The console stops
// everyone's movement and the sheet says so in the middle of the screen; OK closes it — the GM takes over (a fight,
// or "carry on"). Shown once per contact, on this device.

import { html } from '../dom.js';
import { t } from '../../i18n/index.js';

let seen = null; // the contact this device already closed

/** The window, or '' — contact: the table's last contact time (table.state.contact). */
export function contactOverlay(contact) {
  if (!contact || contact === seen) return '';
  return html`<div class="loadout" role="dialog" aria-modal="true" aria-labelledby="contact-title">
    <div class="loadout__box loadout__box--fight hit-box">
      <header class="loadout__head"><h2 id="contact-title" class="loadout__title">⚠ ${t('contact.title')}</h2>
        <p class="loadout__lead">${t('contact.lead')}</p></header>
      <footer class="loadout__foot"><button class="btn btn--primary" data-action="contactOk" data-at="${contact}">${t('contact.ok')}</button></footer>
    </div>
  </div>`;
}
export const closeContact = (at) => { seen = Number(at); };
