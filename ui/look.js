// Appearance & manner (decision 94): flavour the player writes once (builder) and edits any time (Dossier).
// It only feeds the AI prompts: never the rules, never the GM's change audit.
import { html } from './dom.js';
import { t } from '../i18n/index.js';

export const LOOK_KEYS = ['gender', 'build', 'hair', 'eyes', 'marks', 'attitude'];

/** where: 'builder' (data-field inputs) or 'sheet' (the sheet's `field` action, saved on change). */
export function lookFields(look = {}, where = 'sheet') {
  const attrs = (k) => (where === 'builder' ? { field: `narrative.look.${k}` } : { action: 'field', path: `narrative.look.${k}` });
  return html`<div class="look-grid">${LOOK_KEYS.map((k) => {
    const a = attrs(k);
    return html`<label class="field"><span class="label">${t(`look.${k}`)}</span>
      <input class="input" maxlength="120" value="${look[k] ?? ''}" placeholder="${t(`look.${k}Hint`)}"
        ${a.field ? html`data-field="${a.field}"` : html`data-action="${a.action}" data-path="${a.path}"`}></label>`;
  })}</div>
  <p class="hint">${t('look.hint')}</p>`;
}
