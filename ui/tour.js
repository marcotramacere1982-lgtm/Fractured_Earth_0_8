// Guided tours (decision 53): a highlight on one part of the sheet and a short note, step by step.
// Steps live in data/tours.json (text overlays per language). Each step may open a sheet tab first; its target
// is a [data-tour] mark. Optional steps are skipped when their target isn't on screen; a step without a
// target shows centred. Esc or ✕ closes. Finished tours are remembered per device (localStorage).

import { html, render } from './dom.js';
import { t } from '../i18n/index.js';

const DONE = 'fe.tour.done';

export function tourDone(id) {
  try { return JSON.parse(localStorage.getItem(DONE) ?? '[]').includes(id); } catch { return false; }
}
export function markTourDone(id) {
  try { localStorage.setItem(DONE, JSON.stringify([...new Set([...JSON.parse(localStorage.getItem(DONE) ?? '[]'), id])])); } catch { /* storage blocked */ }
}

const find = (target) => (target ? document.querySelector(`[data-tour="${target}"]`) : null);

/** Waits (a few frames) for the tab switch to render the step's target. */
function waitFor(target, ms = 1200) {
  return new Promise((ok) => {
    const until = performance.now() + ms;
    const look = () => { const el = find(target); if (el || performance.now() > until) ok(el); else requestAnimationFrame(look); };
    look();
  });
}

/**
 * tour: { id, steps } from data. openTab(tab): show that sheet tab (the caller's router).
 * Returns a function that closes the tour.
 */
export function startTour(tour, { openTab, onClose = () => {} }) {
  document.querySelector('.tour')?.remove();
  const root = document.createElement('div');
  root.className = 'tour';
  document.body.append(root);
  let index = 0;
  let current = null; // the highlighted element
  let currentTarget = null; // its [data-tour] mark: the sheet re-renders, so look it up again when needed
  let busy = false;

  const place = () => {
    const spot = root.querySelector('.tour__spot');
    const bubble = root.querySelector('.tour__bubble');
    if (!spot || !bubble) return;
    if (current && !current.isConnected) current = find(currentTarget);
    if (!current) { root.classList.add('tour--centred'); return; }
    root.classList.remove('tour--centred');
    const r = current.getBoundingClientRect();
    const pad = 6;
    Object.assign(spot.style, { top: `${r.top - pad}px`, left: `${r.left - pad}px`, width: `${r.width + 2 * pad}px`, height: `${r.height + 2 * pad}px` });
    const b = bubble.getBoundingClientRect();
    const below = r.bottom + pad + 12;
    const top = below + b.height < window.innerHeight ? below : Math.max(8, r.top - pad - 12 - b.height);
    const left = Math.min(Math.max(8, r.left), window.innerWidth - b.width - 8);
    Object.assign(bubble.style, { top: `${Math.max(8, Math.min(top, window.innerHeight - b.height - 8))}px`, left: `${left}px` });
  };

  const draw = () => {
    const step = tour.steps[index];
    render(root, html`
      <div class="tour__spot" aria-hidden="true"></div>
      <div class="tour__bubble" role="dialog" aria-modal="false" aria-labelledby="tour-title">
        <div class="spread"><span class="label">${t('tour.step', { n: index + 1, total: tour.steps.length })}</span>
          <button class="btn btn--ghost btn--icon btn--sm" data-tour-act="close" aria-label="${t('tour.close')}">✕</button></div>
        <h3 class="tour__title" id="tour-title">${step.title}</h3>
        <p class="tour__text">${step.text}</p>
        <div class="cluster">
          ${index > 0 ? html`<button class="btn btn--sm" data-tour-act="back">${t('tour.back')}</button>` : ''}
          <button class="btn btn--sm btn--primary" data-tour-act="next">${index < tour.steps.length - 1 ? t('tour.next') : t('tour.done')}</button>
        </div>
      </div>`);
    place();
    root.querySelector('[data-tour-act="next"]')?.focus({ preventScroll: true });
  };

  async function go(to, dir = 1) {
    if (busy) return;
    busy = true;
    for (let i = to; i >= 0 && i < tour.steps.length; i += dir) {
      const step = tour.steps[i];
      if (step.tab) openTab(step.tab);
      const el = step.target ? await waitFor(step.target) : null;
      if (step.target && !el && step.optional) continue;
      index = i;
      current = el;
      currentTarget = step.target ?? null;
      current?.scrollIntoView({ block: 'center', behavior: 'instant' });
      draw();
      busy = false;
      return;
    }
    busy = false;
    if (dir > 0) close(true);
  }

  const onKey = (e) => { if (e.key === 'Escape') close(false); };
  const onMove = () => place();
  function close(finished) {
    if (finished) markTourDone(tour.id);
    root.remove();
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', onMove);
    window.removeEventListener('scroll', onMove, true);
    onClose(finished);
  }
  root.addEventListener('click', (e) => {
    const act = e.target.closest('[data-tour-act]')?.dataset.tourAct;
    if (act === 'next') { if (index < tour.steps.length - 1) go(index + 1, 1); else close(true); }
    if (act === 'back') go(index - 1, -1);
    if (act === 'close') close(false);
  });
  document.addEventListener('keydown', onKey);
  window.addEventListener('resize', onMove);
  window.addEventListener('scroll', onMove, true);
  go(0, 1);
  return () => close(false);
}
