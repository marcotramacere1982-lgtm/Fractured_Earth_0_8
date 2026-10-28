// Whisper to the GM (decision 149): a private note from the sheet, only the GM reads it. Shown while at the table.

import { html } from '../dom.js';
import { openDialog } from './dialogs.js';
import { t } from '../../i18n/index.js';

/** The ✉ button in the sheet's bar, when this sheet is at the table. */
export function whisperButton(table, id) {
  if (table?.state.joinedId !== id) return '';
  return html`<button class="btn btn--sm btn--ghost" data-action="whisper" title="${t('whisper.hint')}" aria-label="${t('whisper.hint')}">✉ GM</button>`;
}

export function openWhisper({ table, toast }) {
  let sending = false;
  const d = openDialog(() => html`
    <header class="card__head"><h2 class="card__title">${t('whisper.title')}</h2><button class="btn btn--ghost btn--icon" data-action="close" aria-label="${t('common.close')}">✕</button></header>
    <div class="dialog__body stack">
      <p class="hint">${t('whisper.private')}</p>
      <textarea class="input whisper__text" rows="4" maxlength="500" placeholder="${t('whisper.placeholder')}" aria-label="${t('whisper.title')}"></textarea>
      <div class="cluster"><button class="btn btn--primary" data-action="send">${t('whisper.send')}</button>
        <button class="btn btn--ghost" data-action="close">${t('common.cancel')}</button></div>
    </div>`, {
    click: {
      async send(_, e) {
        const text = e.target.closest('.dialog').querySelector('.whisper__text').value.trim();
        if (!text || sending) return;
        sending = true;
        if (await table.whisper(text)) { d.close(); toast(t('whisper.sent'), 'success'); } else { sending = false; toast(t('crewStash.why.offline'), 'danger'); }
      },
    },
  });
  document.querySelector('.whisper__text')?.focus();
}
