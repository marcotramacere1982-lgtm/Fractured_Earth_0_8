// Tiny rendering helpers: escaped tagged templates + delegated actions.

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const RAW = Symbol('raw');

export const escape = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

/** Marks trusted HTML (e.g. our own SVG icons) so html`` does not escape it. */
export const raw = (s) => ({ [RAW]: String(s ?? '') });

function toHtml(v) {
  if (v == null || v === false) return '';
  if (Array.isArray(v)) return v.map(toHtml).join('');
  if (typeof v === 'object' && RAW in v) return v[RAW];
  return escape(v);
}

/** html`<p>${userText}</p>` — interpolations are escaped unless wrapped in raw() or nested html``. */
export function html(strings, ...values) {
  return raw(strings.reduce((out, s, i) => out + s + (i < values.length ? toHtml(values[i]) : ''), ''));
}

export const render = (el, view) => { el.innerHTML = toHtml(view); };

/**
 * Event delegation: elements declare data-action="name" (and any data-* args).
 * handlers[name](dataset, event, element). Returns a function that removes the listener.
 */
export function delegate(root, type, handlers) {
  const listener = (event) => {
    const el = event.target.closest('[data-action]');
    if (!el || !root.contains(el)) return;
    const fn = handlers[el.dataset.action];
    if (fn) fn(el.dataset, event, el);
  };
  root.addEventListener(type, listener);
  return () => root.removeEventListener(type, listener);
}

/** Runs several cleanup functions as one. */
export const cleanup = (...fns) => () => fns.forEach((fn) => fn?.());

export const signed = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');

export function icon(svg, label = '') {
  return raw(`<span class="icon" aria-hidden="${label ? 'false' : 'true'}"${label ? ` role="img" aria-label="${escape(label)}"` : ''}>${svg ?? ''}</span>`);
}
