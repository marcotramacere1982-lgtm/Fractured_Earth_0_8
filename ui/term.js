// Decision 242: in Italian, skills and conditions read "Furtività · Stealth" — the Italian name, and the English one the
// GM and the log use beside it (the loader keeps it as `nameEn`, data/index.js). In English nothing is added.

import { html } from './dom.js';

/** The English name as a small aside, when the screen shows another language; else ''. */
export const enTerm = (rec) => (rec?.nameEn && rec.nameEn !== rec.name ? html`<span class="term-en">${rec.nameEn}</span>` : '');
/** "Furtività · Stealth" as plain text (titles, tooltips); just the name in English. */
export const bothNames = (rec) => (rec?.nameEn && rec.nameEn !== rec.name ? `${rec.name} · ${rec.nameEn}` : rec?.name ?? '');
