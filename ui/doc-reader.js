// Decision 299: a document handout — Markdown the GM sent from local/gm/handouts/ (a letter, a report, a notice),
// read in a window set out like the manual. Pictures it shows are other handouts from the same folder (the server
// shared them with it). Used by the GM message card and the case dossier / board.

import { html, raw } from './dom.js';
import { t } from '../i18n/index.js';
import { renderMarkdown } from './manual/markdown.js';
import { openDialog } from './sheet/dialogs.js';

/** A bare picture name in the document → the address the table serves it at. */
const picture = (src) => (/^[\w.%-]+\.(webp|png|jpe?g|gif)$/i.test(src) ? `/api/table/handout?name=${encodeURIComponent(decodeURIComponent(src))}` : src);

/** The document as HTML (renderMarkdown escapes everything it doesn't build itself). */
export async function docHtml(url) {
  const r = await fetch(url, { cache: 'no-cache' });
  if (!r.ok) throw new Error(String(r.status));
  return renderMarkdown(await r.text(), { image: picture, table: () => '' }).html;
}

/** Opens the reader. url: /api/table/handout?name=….md · title: what the GM called it. */
export function openDoc(url, title) {
  let body = null;
  let failed = false;
  const d = openDialog(() => html`<header class="card__head"><h2 class="card__title">📄 ${title}</h2>
      <button class="btn btn--ghost btn--icon" data-action="close" aria-label="${t('common.close')}">✕</button></header>
    <div class="dialog__body"><article class="manual-prose doc-paper">${body ? raw(body) : html`<p class="muted">${t(failed ? 'doc.missing' : 'doc.loading')}</p>`}</article></div>`, { click: {} }, { wide: true });
  docHtml(url).then((h) => { body = h; d.redraw(); }).catch(() => { failed = true; d.redraw(); });
  return d;
}
