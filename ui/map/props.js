// The prop library's drawings (decision 68): app/props/*.svg, read once and inlined into maps so their
// `currentColor` and class names follow the theme. Anything that could run or leak is stripped on load.

const cache = new Map(); // prop id -> { viewBox, inner } | null
let loading = null;

function clean(text) {
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  const svg = doc.documentElement;
  if (svg?.nodeName !== 'svg') return null;
  svg.querySelectorAll('script, foreignObject, style, image, text, a').forEach((n) => n.remove());
  for (const el of svg.querySelectorAll('*')) {
    for (const a of [...el.attributes]) if (/^on/i.test(a.name) || a.name === 'id' || /href$/i.test(a.name)) el.removeAttribute(a.name);
  }
  return { viewBox: svg.getAttribute('viewBox') ?? '0 0 100 100', inner: svg.innerHTML };
}

/** Fetches every drawing once (later calls get the same promise). */
export function loadProps(data) {
  loading ??= Promise.all(data.props.props.map(async (p) => {
    try {
      const res = await fetch(new URL(`../../props/${p.file}`, import.meta.url));
      cache.set(p.id, res.ok ? clean(await res.text()) : null);
    } catch { cache.set(p.id, null); }
  }));
  return loading;
}

/** The drawing for a prop id, or null while it loads (the map shows its outline meanwhile). */
export const propMarkup = (id) => cache.get(id) ?? null;
export const propsLoaded = () => cache.size > 0;
