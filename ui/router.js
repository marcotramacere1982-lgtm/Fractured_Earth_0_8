// Hash router: #/sheet/<id>/<tab> → { name: 'sheet', params: ['<id>', '<tab>'] }

export function parseHash(hash = location.hash) {
  const [name = '', ...params] = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  return { name, params };
}

export const href = (...parts) => `#/${parts.map(encodeURIComponent).join('/')}`;

export function go(...parts) {
  location.hash = href(...parts);
}

let teardown = null;

/** Views may return a cleanup function, called before the next route renders. */
export function startRouter(onRoute) {
  const run = () => {
    if (typeof teardown === 'function') teardown();
    teardown = onRoute(parseHash());
    window.scrollTo(0, 0);
  };
  window.addEventListener('hashchange', run);
  run();
}
