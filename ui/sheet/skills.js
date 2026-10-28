// Skills and attributes (with in-play adjustments), every one a tap-to-roll target — on the Setup tab since decision 164,
// with a search that hides rows as you type (no redraw, so the field keeps its focus).

import { html, raw, signed } from '../dom.js';
import { counter, card, temp } from './parts.js';
import { bonus } from '../../rules/stats.js';
import { passiveScore } from '../../rules/checks.js';
import { explain, hint } from '../explain.js';
import { t } from '../../i18n/index.js';

let query = '';
const fold = (x) => x.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const matches = (text) => !query || fold(text).includes(fold(query));

/** Decision 164: type to find a skill — name, stats or group; applied in place by the sheet's input handler. */
export function findSkill(root, value) {
  query = value.trim();
  for (const row of root.querySelectorAll('.skill-row[data-find]')) row.hidden = !matches(row.dataset.find);
  for (const col of root.querySelectorAll('.skills-col')) col.hidden = !col.querySelector('.skill-row:not([hidden])');
  const none = root.querySelector('.skills-none');
  if (none) none.hidden = Boolean(root.querySelector('.skill-row:not([hidden])'));
}

export function skillsTab(c, s, data) {
  const attrs = card(t('attrs.title'), html`
    <div class="attr-grid">
      ${data.attributes.attributes.map((a) => html`
        <div class="attr" ${hint('attr', a.id)}>
          <div class="attr__top">
            <button class="attr__head" data-action="check" data-kind="attr" data-id="${a.id}" aria-label="${t('common.roll', { name: a.name })}">
              <span class="icon">${raw(data.icons[a.id.toLowerCase()] ?? '')}</span>
              <span class="attr__id">${a.id}</span>
              <span class="attr__name">${a.name}</span>
            </button>
            ${explain('attr', a.id, a.name)}
          </div>
          <div class="attr__values">
            ${counter({ action: 'attr', value: c.attributes[a.id], min: 0, max: a.id === 'CRS' ? 100 : null, args: { key: a.id }, size: 'sm', label: a.name })}
            ${a.id !== 'CRS' ? html`<span class="attr__bonus">${signed(bonus(c.attributes[a.id]))}</span>` : html`<span class="attr__bonus muted">/100</span>`}
          </div>
        </div>`)}
    </div>
    <p class="hint">${t('attrs.hint')}</p>`, { sub: t('attrs.sub'), ref: 'attributes' });

  const byCat = data.skills.categories.map((cat) => ({ cat, list: s.skills.filter((k) => k.category === cat.id).map((k) => ({ ...k, find: `${k.name} ${k.stats.join(' ')} ${cat.name}` })) }));
  const anyShown = byCat.some(({ list }) => list.some((k) => matches(k.find)));
  const skills = card(t('skills.title'), html`
    <input class="input skills-search" type="search" placeholder="${t('skills.search')}" value="${query}" data-action="findSkill" aria-label="${t('skills.search')}">
    <p class="muted skills-none" ${anyShown ? raw('hidden') : ''}>${t('common.noMatch')}</p>
    <div class="skills-cols">
      ${byCat.map(({ cat, list }) => html`
        <div class="skills-col" ${list.some((k) => matches(k.find)) ? '' : raw('hidden')}>
          <h3 class="label">${cat.name}</h3>
          ${list.map((k) => html`
            <div class="skill-row" data-find="${k.find}" ${matches(k.find) ? '' : raw('hidden')} ${hint('skill', k.id)}>
              <button class="skill" data-action="check" data-kind="skill" data-id="${k.id}" aria-label="${t('common.roll', { name: k.name })}">
                <span class="icon">${raw(data.icons[k.id.replace(/_(db|pb)$/, '')] ?? '')}</span>
                <span class="skill__name">${k.name}</span>
                <span class="skill__stats">${k.stats.join('+')}</span>
                <span class="skill__tn">${temp(k.base, k.value)}</span>
                <span class="skill__passive">${passiveScore(k.value, data.difficulty)}</span>
              </button>
              ${explain('skill', k.id, k.name)}
            </div>`)}
        </div>`)}
    </div>
    <p class="hint">${t('skills.hint')}</p>`, { sub: t('skills.sub'), ref: 'skill-check', tour: 'skills' });

  return html`<div class="stack">${skills}${attrs}</div>`;
}
