// GM transmissions: big, persistent message cards over every page until the player closes them.
// Messages live in the character's play.inbox, so they survive a refresh; private ones look different.

import { html, render } from './dom.js';
import { t } from '../i18n/index.js';
import { downtimeReport } from './sheet/timeline.js';

const time = (t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export function installTransmissions(store, table) {
  const host = document.getElementById('transmissions');
  if (!host) return;

  const characterId = () => table.state.joinedId;
  const seen = new Set(); // ids already shown: only new messages animate in
  let shown = null; // redraw only when the inbox changes, not on every sheet edit

  const draw = () => {
    const c = characterId() ? store.get(characterId()) : null;
    const inbox = c?.play?.inbox ?? [];
    const signature = inbox.map((m) => m.id).join('|');
    if (signature === shown) return;
    shown = signature;
    render(host, html`${inbox.map((m) => html`
      <section class="transmission ${m.private ? 'transmission--private' : ''} ${m.tone === 'hit' ? 'transmission--hit' : ''} ${seen.has(m.id) ? '' : 'transmission--new'}" role="${seen.has(m.id) ? 'region' : 'alert'}" aria-label="${t('gm.message')}">
        <header class="transmission__head">
          <span class="transmission__tag">${m.kind === 'downtime' ? `◷ ${t('downtime.tag')} · ${m.title}` : ''}${m.kind === 'downtime' ? '' : m.image ? `▣ ${t('gm.image')} · ` : ''}${m.kind === 'downtime' ? '' : m.tone === 'hit' ? `✖ ${t('gm.hit')}` : m.private ? `◉ ${t('gm.private')}` : `▲ ${t('gm.incoming')}`}</span>
          <span class="transmission__meta">GM · ${time(m.t)}</span>
          <button class="transmission__close" data-dismiss="${m.id}" aria-label="${t('gm.close')}">✕</button>
        </header>
        ${m.image ? html`<a class="transmission__image" href="${m.image}" target="_blank" rel="noopener" title="${t('gm.imageOpen')}"><img src="${m.image}" alt="${t('gm.image')}"></a>` : ''}
        ${m.kind === 'downtime' ? downtimeReport(m) : html`${m.text ? html`<p class="transmission__text">${m.text}</p>` : ''}
        ${m.private ? html`<p class="transmission__hint">${t('gm.privateHint')}</p>` : ''}`}
      </section>`)}`);
    inbox.forEach((m) => seen.add(m.id));
  };

  host.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-dismiss]');
    if (!btn) return;
    store.update(characterId(), (c) => { c.play.inbox = (c.play.inbox ?? []).filter((m) => m.id !== btn.dataset.dismiss); });
  });
  store.subscribe((change) => { if (change.id === characterId()) draw(); });
  table.subscribe(draw);
  draw();
}
