// Portrait framing (decision 96): zoom, position and brightness saved with the character and applied everywhere
// the photo shows (Dossier, sheet header, characters page, builder, the GM's Explore). Non-destructive: the image
// is never re-encoded. The frame travels as CSS custom properties — the one inline style in the app (owner OK).
import { html, raw } from './dom.js';

export const FRAME = { x: [0, 100, 50], y: [0, 100, 50], zoom: [1, 3, 1], light: [0.6, 1.6, 1] }; // [min, max, default]
const clamp = (k, v) => { const [lo, hi, d] = FRAME[k]; const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };

/** The saved frame with defaults and limits applied. */
export const frameOf = (portrait) => Object.fromEntries(Object.keys(FRAME).map((k) => [k, clamp(k, portrait?.frame?.[k] ?? FRAME[k][2])]));
export const isFramed = (portrait) => Object.entries(frameOf(portrait)).some(([k, v]) => v !== FRAME[k][2]);

/** The style attribute carrying a frame. */
export const frameStyle = (f) => `--px:${f.x}%;--py:${f.y}%;--pz:${f.zoom};--pl:${f.light}`;

/** A framed photo: `cls` sizes the frame (avatar, portrait__img, gm-explore__face…); extra = attributes for the frame. */
export function portraitImg(portrait, cls, alt = '', extra = '') {
  if (!portrait?.dataUrl) return '';
  return html`<span class="portrait-frame ${cls}" style="${frameStyle(frameOf(portrait))}" ${raw(extra)}><img class="portrait-frame__img" src="${portrait.dataUrl}" alt="${alt}" draggable="false"></span>`;
}
