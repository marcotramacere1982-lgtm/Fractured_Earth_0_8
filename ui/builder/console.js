// "Terminal" log with a superfast typewriter effect. Click/tap or Space to skip.
// Lines before `fromIndex` render instantly; newer lines are typed out.

const CHARS_PER_FRAME = 5;
const PAUSE = { roll: 260, event: 120, sys: 90, mod: 40, warn: 160, bad: 220, dim: 30 };

import { ruleText } from '../rule-text.js';

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** What a line says in the interface language (lists of checks are worded one by one). */
function lineText(entry) {
  if (!entry.code) return entry.text;
  const vars = Object.fromEntries(Object.entries(entry.vars ?? {}).map(([k, v]) => [k, Array.isArray(v) ? v.map(ruleText).join(', ') : v]));
  return ruleText({ code: entry.code, vars, text: entry.text });
}

function lineEl(entry) {
  const el = document.createElement('div');
  el.className = `term__line term__line--${entry.kind}`;
  return el;
}

/**
 * Mounts entries into `el`. Returns a promise resolved when typing finishes.
 * onDone is called once everything is printed (also when skipped).
 */
export function typeInto(el, entries, fromIndex = 0) {
  el.textContent = '';
  const cursor = document.createElement('span');
  cursor.className = 'term__cursor';
  let skip = reducedMotion();
  const onSkip = (e) => { if (e.type === 'click' || e.key === ' ' || e.key === 'Escape') skip = true; };
  el.addEventListener('click', onSkip);
  document.addEventListener('keydown', onSkip);

  const old = entries.slice(0, fromIndex);
  for (const entry of old) { const l = lineEl(entry); l.textContent = lineText(entry); el.append(l); }
  el.scrollTop = el.scrollHeight;

  const fresh = entries.slice(fromIndex);
  return new Promise((resolve) => {
    let i = 0;
    const next = () => {
      if (i >= fresh.length) {
        cursor.remove();
        el.removeEventListener('click', onSkip);
        document.removeEventListener('keydown', onSkip);
        el.classList.remove('term--typing');
        resolve();
        return;
      }
      const entry = fresh[i++];
      const text = lineText(entry);
      const l = lineEl(entry);
      el.append(l);
      if (skip) { l.textContent = text; el.scrollTop = el.scrollHeight; next(); return; }
      el.classList.add('term--typing');
      let n = 0;
      const frame = () => {
        if (skip) n = text.length;
        n = Math.min(text.length, n + CHARS_PER_FRAME);
        l.textContent = text.slice(0, n);
        l.append(cursor);
        el.scrollTop = el.scrollHeight;
        if (n < text.length) requestAnimationFrame(frame);
        else setTimeout(next, skip ? 0 : PAUSE[entry.kind] ?? 60);
      };
      requestAnimationFrame(frame);
    };
    next();
  });
}
