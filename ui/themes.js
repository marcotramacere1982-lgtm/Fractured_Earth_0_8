// Themes (decision 219): the interface's look — colours, panels, borders, corners, title type, page background —
// picked per device in the Display menu. Each theme is a token block in styles/tokens.css ([data-theme='id']) and
// says which of the map's two tested palettes it uses (data-map): the tactical map never follows a theme's colours.
// Night (dark) is the default; the boot script in index.html applies the saved one before the first paint.

export const THEMES = [
  { id: 'dark', map: 'dark' }, // Night: the default
  { id: 'light', map: 'light' }, // Day
  { id: 'corp', map: 'dark' }, // Corp Interface
  { id: 'terminal', map: 'dark' }, // Grey Zone Terminal (decision 221)
  { id: 'dossier', map: 'light' }, // Field Dossier
  { id: 'hacker', map: 'dark' }, // Netrunner
  { id: 'nightops', map: 'dark' }, // Field Soldier · Night Ops
  { id: 'violet', map: 'dark' }, // Graphite Violet (decision 225)
  { id: 'crimson', map: 'dark' }, // Graphite Crimson
];
/** The themes whose map uses the light palette (the boot script in index.html repeats this list). */
export const LIGHT_MAPS = THEMES.filter((x) => x.map === 'light').map((x) => x.id);
let KEY = 'fe.theme';
/** Decision 225: the GM console remembers its theme apart (fe.gm.theme), so a test sheet on the same computer doesn't change it. */
export const useThemeKey = (key) => { KEY = key; };

export const theme = () => document.documentElement.dataset.theme ?? 'dark';

/** Applies a theme and remembers it on this device. */
export function setTheme(id) {
  const th = THEMES.find((x) => x.id === id) ?? THEMES[0];
  const root = document.documentElement;
  root.dataset.theme = th.id;
  root.dataset.map = th.map;
  try { localStorage.setItem(KEY, th.id); } catch { /* private mode: this visit only */ }
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', getComputedStyle(root).getPropertyValue('--color-bg').trim());
}
