// Live "what is this / how is it made" tooltips for attributes, skills and combat values.
// explain('skill', 'stealth') → ⓘ button; hint('skill', 'stealth') → hover-only attribute for a whole row.
// The view on screen says which character to explain with setExplainSource(() => character).

import { html, raw, escape } from './dom.js';
import { registerExplainer } from './ref.js';
import { t } from '../i18n/index.js';
import { explainAttribute, explainSkill, explainCombat, explainInitiative, explainHp, explainClassTN } from '../rules/explain.js';

let source = () => null;
let data = null;

export const setExplainSource = (fn) => { source = fn; };

export function explain(kind, id = '', label = '') {
  return html`<button type="button" class="info" data-explain="${kind}:${id}" aria-label="${t('ref.about', { name: label || id || kind })}" aria-expanded="false">i</button>`;
}

/** Hover-only: put inside an element's opening tag, e.g. <div class="stat" ${hint('combat', 'def')}>. */
export const hint = (kind, id = '') => raw(`data-hint="${escape(`${kind}:${id}`)}"`);

const e = escape;
const sign = (n) => (n >= 0 ? `+${n}` : `−${Math.abs(n)}`);
const p = (text) => (text ? `<p class="ref-pop__text">${e(text)}</p>` : '');
const calc = (text) => `<p class="ref-pop__calc">${text}</p>`;
const list = (label, items) => (items.length ? `<p class="ref-pop__text"><span class="ref-pop__label">${e(label)}</span> ${items.map(e).join(' · ')}</p>` : '');
const parts = (stats, key) => stats.map((s) => `${e(s.id)} ${s.value}${key === 'bonus' ? ` → ${s.bonus}` : ''}`);

const RENDER = {
  attr(id, c) {
    const x = explainAttribute(id, c, data);
    if (id === 'CRS') return { title: `${x.name} (CRS)`, html: p(x.desc) + calc(`${e(t('explain.yourScore'))}: <strong>${x.value}</strong> (0–100)`), anchor: data.refs.refs['credit-score']?.anchor };
    return {
      title: `${x.name} (${id})`,
      html: p(x.desc)
        + calc(`${x.value} → bonus <strong>${sign(x.bonus)}</strong> <span class="muted">(${e(t('explain.half'))})</span>`)
        + list(t('explain.skills'), x.skills.map((k) => `${k.name} ${k.value}`))
        + list(t('explain.combat'), x.combat)
        + list(t('explain.also'), x.other.map((o) => (o.key === 'class-tn' ? `Class TN (${o.subclass})` : t(`explain.feeds.${o.key}`)))),
      anchor: data.refs.refs.attributes?.anchor,
    };
  },
  skill(id, c) {
    const x = explainSkill(id, c, data);
    return {
      title: x.name,
      html: p(x.desc)
        + calc(`${parts(x.stats, 'bonus').join(' + ')}${x.talent ? ` ${sign(x.talent)} (${e(t('explain.talents'))})` : ''} = <strong>${x.value}</strong> <span class="muted">(${e(t('explain.halfEach'))})</span>`)
        + p(t('explain.skillRoll', { tn: x.value, passive: x.passive })),
      anchor: data.refs.refs['skill-check']?.anchor,
    };
  },
  combat(id, c) {
    const x = explainCombat(id, c, data);
    const shift = x.offset ? ` · ${e(t('explain.rowShift', { n: sign(x.offset) }))}` : '';
    return {
      title: `${x.name} (${id.toUpperCase()})`,
      html: p(x.use)
        + calc(`${parts(x.stats).join(' + ')} = ${x.sum} → ${e(t('explain.tableRow'))} ${x.rowMin}–${x.rowMax}${shift} → <strong>${id === 'off' ? sign(x.value) : x.value}</strong>`),
      anchor: data.refs.refs['combat-values']?.anchor,
    };
  },
  initiative(_, c) {
    const x = explainInitiative(c, data);
    return {
      title: t('explain.feeds.initiative'),
      html: p(x.use) + calc(`${parts(x.stats, 'bonus').join(' + ')} ${sign(x.offset)}${x.talent ? ` ${sign(x.talent)} (${e(t('explain.talents'))})` : ''} = <strong>${sign(x.value)}</strong> <span class="muted">(${e(t('explain.halfEach'))})</span>`),
      anchor: data.refs.refs.initiative?.anchor,
    };
  },
  hp(_, c) {
    const x = explainHp(c, data);
    return {
      title: t('explain.feeds.hp'),
      html: calc(`${x.conX} × CON ${x.con} + ${x.mstX === 1 ? '' : `${x.mstX} × `}MST ${x.mst}${x.mod ? ` ${sign(x.mod)} (${e(t('explain.lifeEvents'))})` : ''}${x.talent ? ` ${sign(x.talent)} (${e(t('explain.talents'))})` : ''} = <strong>${x.value}</strong>`) + p(data.refs.refs.hp?.text),
      anchor: data.refs.refs.hp?.anchor,
    };
  },
  'class-tn'(_, c) {
    const x = explainClassTN(c, data);
    if (!x) return { title: 'Class TN', html: p(t('explain.pickClass')), anchor: data.refs.refs['class-tn']?.anchor };
    const [a, b] = x.stats;
    return {
      title: `Class TN — ${x.subclass}`,
      html: calc(`(${a.id} ${a.value} + ${b.id} ${b.value}) ÷ 2 = <strong>${x.value}</strong> <span class="muted">(${e(t('explain.rounded'))})</span>`) + p(data.refs.refs['class-tn']?.text),
      anchor: data.refs.refs['class-tn']?.anchor,
    };
  },
};

export function installExplain(appData) {
  data = appData;
  registerExplainer((key) => {
    const [kind, id] = key.split(':');
    const c = source();
    if (!c || !RENDER[kind]) return null;
    try { return RENDER[kind](id, c); } catch { return null; }
  });
}
