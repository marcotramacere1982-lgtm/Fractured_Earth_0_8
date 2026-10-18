// Drive picker (decision 47): Justice or Ambition, and a personal line — pick one of the suggestions or
// write your own. A story compass for how the character naturally behaves; never a score, never judged.
// Used in the builder's last step and on the Dossier (mode 'builder' | 'sheet' — they save differently).

import { html, raw } from '../dom.js';
import { t } from '../../i18n/index.js';
import { info } from '../ref.js';

export function driveEditor(c, data, mode = 'sheet') {
  const d = c.drive ?? { type: null, line: '' };
  const save = (path) => raw(mode === 'builder' ? `data-field="${path}"` : `data-action="field" data-path="${path}"`);
  const pick = (value) => raw(`data-action="driveType" data-value="${value}"`);
  const lines = data.crew.lines.filter((l) => !d.type || l.drive === d.type);
  return html`<div class="drive stack stack--tight">
    <span class="label">${t('drive.title')}${info('drive', t('drive.title'))}</span>
    <div class="segmented" role="group">${data.crew.drives.map((x) => html`<button class="segmented__opt" ${pick(x.id)} aria-pressed="${d.type === x.id}" title="${x.desc}">${x.name}</button>`)}</div>
    ${d.type ? html`<p class="hint">${data.crew.drives.find((x) => x.id === d.type)?.desc}</p>` : html`<p class="hint">${t('drive.pickHint')}</p>`}
    <select class="select" ${save('drive.line')} aria-label="${t('drive.suggestions')}">
      <option value="">${t('drive.suggestions')}…</option>
      ${lines.map((l) => html`<option value="${l.text}" ${d.line === l.text ? raw('selected') : ''}>${l.text}</option>`)}
    </select>
    <input class="input" ${save('drive.line')} value="${d.line}" placeholder="${t('drive.linePlaceholder')}" aria-label="${t('drive.line')}">
    <p class="hint">${t('drive.notJudged')}</p>
  </div>`;
}
