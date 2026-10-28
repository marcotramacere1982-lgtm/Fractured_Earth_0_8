// Rule tooltips: html`${info('cover')}` renders an ⓘ button; tapping it opens a short explanation
// with a "Learn more" link into the manual. One popover for the whole app, installed once in main.js.
// Live explanations (data-explain="kind:id", built from the character on screen) come from a registered
// explainer. In the GM console (opts.hover), hovering an ⓘ or an element with data-hint with a mouse opens it too.

import { html, escape } from './dom.js';
import { t } from '../i18n/index.js';

let refs = {};
let pop = null;
let current = null;
let pinned = false; // opened by a click (stays) vs by hover (closes when the pointer leaves)
let explainer = () => null;
let manual = { href: '#/manual/', newTab: false }; // where "Learn more" goes

/** fn(key) → { title, html, anchor } | null for data-explain / data-hint elements. */
export function registerExplainer(fn) { explainer = fn; }

export function info(id, label = '') {
  return html`<button type="button" class="info" data-ref="${id}" aria-label="${t('ref.about', { name: label || id })}" aria-expanded="false">i</button>`;
}

function close() {
  if (!pop) return;
  pinned = false;
  pop.hidden = true;
  current?.setAttribute('aria-expanded', 'false');
  current = null;
}

function content(el) {
  const key = el.dataset.explain ?? el.dataset.hint;
  if (key) return explainer(key);
  const ref = refs[el.dataset.ref];
  return ref ? { title: ref.title, html: `<p class="ref-pop__text">${escape(ref.text)}</p>`, anchor: ref.anchor } : null;
}

function open(button, { hover = false } = {}) {
  const c = content(button);
  if (!c) return;
  if (current === button) {
    if (hover) return;
    if (!pinned) { pinned = true; return; } // a click on a hover-opened tip keeps it open
    close(); return;
  }
  current?.setAttribute('aria-expanded', 'false');
  current = button;
  pinned = !hover;
  button.setAttribute('aria-expanded', 'true');
  pop.innerHTML = `
    <div class="ref-pop__title">${escape(c.title)}</div>
    ${c.html}
    ${c.anchor ? `<a class="ref-pop__more" href="${manual.href}${escape(c.anchor)}"${manual.newTab ? ' target="_blank" rel="noopener"' : ''}>${escape(t('ref.more'))} →</a>` : ''}`;
  pop.hidden = false;
  // position under the button, kept inside the viewport (phones get a bottom sheet via CSS)
  const r = button.getBoundingClientRect();
  const w = pop.offsetWidth;
  const left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2));
  const below = r.bottom + 8 + pop.offsetHeight < window.innerHeight;
  pop.style.setProperty('--x', `${left + window.scrollX}px`);
  pop.style.setProperty('--y', `${(below ? r.bottom + 8 : r.top - pop.offsetHeight - 8) + window.scrollY}px`);
}

/**
 * Installs the shared popover and global listeners. `opts.manual`: { href, newTab } for the "Learn more" link;
 * `opts.hover`: open on mouse hover too (the GM console; the sheets are tap-only since decision 160 — it cluttered the view).
 */
export function installRefs(refsData, opts = {}) {
  refs = refsData.refs;
  if (opts.manual) manual = { ...manual, ...opts.manual };
  pop = document.createElement('div');
  pop.className = 'ref-pop';
  pop.setAttribute('role', 'dialog');
  pop.hidden = true;
  document.body.append(pop);
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-ref], [data-explain]');
    if (btn) { e.preventDefault(); e.stopPropagation(); open(btn); return; }
    if (e.target.closest('.ref-pop__more')) { close(); return; }
    if (!e.target.closest('.ref-pop')) close();
  }, true);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

  // hover (mouse / trackpad only — touch screens use the ⓘ tap)
  if (opts.hover && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const TARGETS = '[data-ref], [data-explain], [data-hint]';
    let timer = null;
    document.addEventListener('pointerover', (e) => {
      const el = e.target.closest(TARGETS);
      if (!el || el === current) return;
      clearTimeout(timer);
      timer = setTimeout(() => { if (!pinned || !current) open(el, { hover: true }); }, 350);
    });
    document.addEventListener('pointerout', (e) => {
      const from = e.target.closest(`${TARGETS}, .ref-pop`);
      const to = e.relatedTarget?.closest?.(`${TARGETS}, .ref-pop`);
      if (!from || from === to || (to && (to === current || to === pop))) return;
      clearTimeout(timer);
      if (!pinned) timer = setTimeout(() => { if (!pinned) close(); }, 200);
    });
  }
  window.addEventListener('hashchange', close);
  window.addEventListener('resize', close);
}
