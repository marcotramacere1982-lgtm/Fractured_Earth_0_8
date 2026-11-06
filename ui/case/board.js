// The crew's board (decision 279), drawn the same on the sheet and in the GM console: a grid of fixed cells, cards of
// three sizes snapped to it, links between cards (straight lines, a word on them). Taps: a card → data-action
// "caseCard"; an empty cell (while placing or moving) → "caseCell". A "case file" look from the theme's tokens.

import { html, raw } from '../dom.js';
import { GRID, SIZES } from '../../rules/case-board.js';

const U = 76; // one cell, in SVG units — drawn 1:1 at zoom 1, so card text stays at its normal size
const ICON = { person: '👤', place: '📍', clue: '🔎', lead: '➜', question: '❓', document: '📄' };
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const centre = (c) => { const [w, h] = SIZES[c.size] ?? SIZES.s; return [(c.x + w / 2) * U, (c.y + h / 2) * U]; };

/**
 * b: the board; st: { selected, mode ('move' | 'link' | 'place' | null), zoom (0.5…1.5) }; opts: { cells (show tap cells), tipWord }.
 */
export function boardSvg(b, st = {}, { cells = false, tipWord = 'anonymous tip' } = {}) {
  const W = GRID.cols * U; const H = GRID.rows * U;
  const cardById = new Map(b.cards.map((c) => [c.id, c]));
  const grid = Array.from({ length: GRID.cols - 1 }, (_, i) => `<line class="case-grid" x1="${(i + 1) * U}" y1="0" x2="${(i + 1) * U}" y2="${H}"/>`).join('')
    + Array.from({ length: GRID.rows - 1 }, (_, i) => `<line class="case-grid" x1="0" y1="${(i + 1) * U}" x2="${W}" y2="${(i + 1) * U}"/>`).join('');
  const taps = cells ? Array.from({ length: GRID.cols * GRID.rows }, (_, i) => { const x = i % GRID.cols; const y = Math.floor(i / GRID.cols); return `<rect class="case-cell" x="${x * U}" y="${y * U}" width="${U}" height="${U}" data-action="caseCell" data-x="${x}" data-y="${y}"/>`; }).join('') : '';
  const links = b.links.map((l) => {
    const a = cardById.get(l.a); const z = cardById.get(l.b);
    if (!a || !z) return '';
    const [x1, y1] = centre(a); const [x2, y2] = centre(z);
    return `<g class="case-link"><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>${l.label ? `<text x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2 - 6}" text-anchor="middle">${esc(l.label)}</text>` : ''}</g>`;
  }).join('');
  const cards = b.cards.map((c) => {
    const [w, h] = SIZES[c.size] ?? SIZES.s;
    const pw = w * U - 8; const ph = h * U - 8;
    const sel = st.selected === c.id;
    const body = c.image && c.size === 'b'
      ? `<image href="${esc(c.image)}" x="4" y="22" width="${pw - 8}" height="${ph - 44}" preserveAspectRatio="xMidYMid slice"/>`
      : '';
    return `<g class="case-card case-card--${c.type}${sel ? ' is-selected' : ''}${c.tip ? ' case-card--tip' : ''}" transform="translate(${c.x * U + 4} ${c.y * U + 4})" data-action="caseCard" data-id="${esc(c.id)}">
      <rect class="case-card__paper" width="${pw}" height="${ph}" rx="4"/><rect class="case-card__stripe" width="${pw}" height="5" rx="2"/>
      ${body}
      <foreignObject x="4" y="${c.image && c.size === 'b' ? ph - 24 : 8}" width="${pw - 8}" height="${c.image && c.size === 'b' ? 22 : ph - 12}"><div xmlns="http://www.w3.org/1999/xhtml" class="case-card__text">
        <strong>${ICON[c.type] ?? ''} ${esc(c.title)}</strong>${c.image && c.size === 'b' ? '' : `<span>${esc(c.text)}</span>`}${c.tip ? `<em>${esc(tipWord)}</em>` : ''}</div></foreignObject></g>`;
  }).join('');
  const z = Math.max(0.5, Math.min(1.5, st.zoom ?? 1));
  return html`<svg class="case-board ${st.mode ? `case-board--${st.mode}` : ''}" viewBox="0 0 ${W} ${H}" width="${Math.round(W * z)}" height="${Math.round(H * z)}" role="img" aria-label="Board">
    <rect class="case-board__bg" width="${W}" height="${H}"/>${raw(grid)}${raw(cards)}${raw(links)}${raw(taps)}</svg>`;
}

export { ICON };
