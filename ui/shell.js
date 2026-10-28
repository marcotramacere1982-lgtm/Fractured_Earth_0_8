// Header: brand, section navigation, theme toggle.

import { html, render, raw } from './dom.js';
import { t, LANGS, getLang, setLang } from '../i18n/index.js';

const ICONS = {
  sheet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h5"/></svg>',
  builder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>',
  manual: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4z"/><path d="M20 4h-6a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h7z"/></svg>',
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
};

const NAV = [
  { name: '', alt: 'sheet', label: 'nav.characters', icon: 'sheet' },
  { name: 'builder', label: 'nav.builder', icon: 'builder' },
  { name: 'manual', label: 'nav.manual', icon: 'manual', newTab: true }, // decision 157: a player at the sheet stays at the sheet
];

export const theme = () => document.documentElement.dataset.theme ?? 'dark';

/** Dark ↔ light, remembered per device (`fe.theme`), shared by the player app and the GM console (decision 103). */
export function toggleTheme() {
  const next = theme() === 'light' ? 'dark' : 'light';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('fe.theme', next); } catch { /* private mode */ }
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', getComputedStyle(document.documentElement).getPropertyValue('--color-bg').trim());
}

let bound = false;

export function renderHeader(el, route) {
  render(el, html`
    <a class="brand" href="#/"><span class="brand__mark">//</span><span class="brand__name">Fractured Earth</span><span class="brand__ver">v0.9</span></a>
    <nav class="app-nav" aria-label="${t('nav.sections')}">
      ${NAV.map((n) => {
        const here = route.name === n.name || route.name === n.alt;
        return html`<a href="#/${n.name}" ${here ? raw('aria-current="page"') : ''} ${n.newTab && !here ? raw(`target="_blank" rel="noopener" title="${t('nav.newTab')}"`) : ''}>
        <span class="icon">${raw(ICONS[n.icon])}</span><span class="nav-text">${t(n.label)}</span></a>`;
      })}
    </nav>
    <div class="app-actions">
      <div class="lang-switch" role="group" aria-label="${t('nav.language')}">${LANGS.map((l) => html`<button class="lang-switch__opt" data-action="lang" data-id="${l.id}" aria-pressed="${l.id === getLang()}" title="${l.name}">${l.label}</button>`)}</div>
      <button class="btn btn--ghost btn--icon" data-action="theme" title="${t('nav.theme')}" aria-label="${t('nav.theme')}">
        <span class="icon">${raw(theme() === 'light' ? ICONS.moon : ICONS.sun)}</span>
      </button>
    </div>`);
  if (!bound) {
    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-action="theme"]')) { toggleTheme(); renderHeader(el, route); }
      const lang = e.target.closest('[data-action="lang"]');
      if (lang && lang.dataset.id !== getLang()) setLang(lang.dataset.id);
    });
    bound = true;
  }
}

const TOASTS_MAX = 3;
/** Decision 160: a pop-up stays until its ✕ (playtest: they went too fast); at most 3 — the oldest makes room. */
export function toast(message, kind = '') {
  const host = document.getElementById('toasts');
  if (!host) return;
  const el = document.createElement('div');
  el.className = `toast${kind ? ` toast--${kind}` : ''}`;
  el.setAttribute('role', kind === 'danger' ? 'alert' : 'status');
  const text = document.createElement('span');
  text.className = 'toast__text';
  text.textContent = message;
  const close = document.createElement('button');
  close.className = 'toast__close';
  close.type = 'button';
  close.textContent = '✕';
  close.setAttribute('aria-label', t('common.close'));
  close.addEventListener('click', () => el.remove());
  el.append(text, close);
  host.append(el);
  while (host.children.length > TOASTS_MAX) host.firstElementChild.remove();
}
