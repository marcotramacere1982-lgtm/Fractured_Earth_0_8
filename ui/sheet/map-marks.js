// Sheet: marks on the table map (decision 82). ✎ Mark switches the map to marking: pick a crosshair, an arrow,
// a question mark or a freehand line and draw; tap one of your marks to keep it (📌) or remove it. Your colour
// (chosen here) is also your marker's. Purely visual: nothing is logged, nothing touches the rules.

import { html } from '../dom.js';
import { t } from '../../i18n/index.js';
import { toast } from '../shell.js';
import { cleanMark, markColor, secondsLeft } from '../../rules/marks.js';

const ICON = { crosshair: '⊕', arrow: '➜', question: '?', line: '〰' };
const ui = { tool: null, sel: null }; // the tool being drawn with (null: not marking), your mark tapped

export const marking = () => Boolean(ui.tool);

/** The header button that switches marking on and off. */
export const marksButton = () => html`<button class="btn btn--sm ${ui.tool ? 'btn--primary' : ''}" data-action="mapMarkMode" data-tour="map-marks" aria-pressed="${Boolean(ui.tool)}" title="${t('map.mark.buttonHint')}">✎ ${t('map.mark.button')}</button>`;

/** The marks this map shows: the table's list when it belongs to this map. */
const listFor = (marks, map) => (marks && marks.map === map.id ? marks.list : []);

/** Side panel while marking: tools, your colour, the mark you tapped. */
export function marksPanel(map, data, id, marks, myColor) {
  if (!ui.tool) return '';
  const cfg = data.map.marks;
  const list = listFor(marks, map);
  const sel = list.find((m) => m.id === ui.sel && m.by === id) ?? null;
  if (!sel) ui.sel = null;
  const takenBy = (color) => map.tokens.find((tk) => tk.kind === 'player' && tk.key !== id && tk.color === color)?.name;
  const left = sel ? secondsLeft(sel, cfg, Date.now(), marks.skew) : null;
  return html`<section class="map-marks" data-tour="map-marks-panel">
    <div class="map-marks__tools" role="group" aria-label="${t('map.mark.tools')}">${cfg.tools.map((tool) => html`
      <button class="btn btn--sm ${ui.tool === tool ? 'btn--primary' : ''}" data-action="mapMarkTool" data-tool="${tool}" aria-pressed="${ui.tool === tool}" title="${t(`map.mark.tool.${tool}`)}">${ICON[tool]} <span class="st-small">${t(`map.mark.tool.${tool}`)}</span></button>`)}</div>
    <p class="hint">${t(`map.mark.how.${ui.tool}`)}</p>
    ${sel ? html`<div class="cluster"><span class="label">${t('map.mark.yours')}</span>
      <button class="btn btn--sm" data-action="mapMarkPin" data-id="${sel.id}" data-on="${sel.pinned ? '0' : '1'}">📌 ${t(sel.pinned ? 'map.mark.unpin' : 'map.mark.pin')}</button>
      <button class="btn btn--sm btn--ghost text-danger" data-action="mapMarkRemove" data-id="${sel.id}">✕ ${t('map.mark.remove')}</button>
      ${left != null ? html`<span class="muted st-small">${t('map.mark.fadesIn', { s: Math.ceil(left) })}</span>` : ''}</div>` : ''}
    <div class="mark-swatches"><span class="label">${t('map.mark.colour')}</span>${cfg.colors.map((color) => html`
      <button class="mark-swatch mark-swatch--${color} ${takenBy(color) ? 'is-taken' : ''}" data-action="mapMarkColor" data-color="${color}" aria-pressed="${myColor === color}"
        title="${t(`map.mark.color.${color}`)}${takenBy(color) ? ` · ${t('map.mark.taken', { name: takenBy(color) })}` : ''}" aria-label="${t(`map.mark.color.${color}`)}"></button>`)}</div>
    <p class="hint">${t('map.mark.note', { n: Math.round(cfg.fadeSeconds / 60) })}</p>
    <button class="btn btn--sm" data-action="mapMarkMode">${t('map.mark.done')}</button>
  </section>`;
}

/** What the viewer needs to draw marks and let you mark (merged into viewer.on). */
export function markHooks({ map, data, id, marks, myColor, onIdle, send }) {
  const cfg = data.map.marks;
  return {
    view: { list: listFor(marks, map), skew: marks?.skew ?? 0, selected: ui.sel },
    on: {
      markTool: () => ui.tool,
      markColor: () => myColor,
      mayTouch: (m) => m.by === id,
      tapMark(mid) { ui.sel = ui.sel === mid ? null : mid; onIdle(); },
      async drawMark(raw) {
        const mark = cleanMark(raw, cfg);
        if (!mark) { toast(t('map.mark.tooShort'), 'danger'); return; }
        if (!(await send({ mark }))) toast(t('map.mark.failed'), 'danger');
      },
    },
  };
}

/** Sheet handlers for the marking controls. ctx: { draw, run, send } */
export function markHandlers({ draw, run, send }) {
  return {
    mapMarkMode() { ui.tool = ui.tool ? null : 'crosshair'; ui.sel = null; draw(); },
    mapMarkTool({ tool }) { ui.tool = tool; draw(); },
    mapMarkColor({ color }) { run('mapColor', { color }); },
    async mapMarkPin({ id, on }) { await send({ pin: { id, on: on === '1' } }); },
    async mapMarkRemove({ id }) { ui.sel = null; await send({ remove: id }); draw(); },
  };
}

/** Your colour for the map: your choice, else the one the GM's table gave your marker, else the one from your id. */
export const myMarkColor = (c, data, map = null) => markColor(c.id, c.play?.mapColor ?? map?.tokens.find((tk) => tk.key === c.id)?.color, data.map.marks);
