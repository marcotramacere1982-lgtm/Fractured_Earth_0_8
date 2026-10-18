// Builder step views. Each step: { id, title, lede, view(draft, data), done(draft, data) -> true | 'reason' }.

import { html, raw, signed } from '../dom.js';
import { driveEditor } from '../sheet/drive.js';
import { counter, nameOf } from '../sheet/parts.js';
import { bonus } from '../../rules/stats.js';
import { pointsRemaining, canAdjust, careerChecks } from '../../rules/creation.js';
import { scoreQuiz, careerClosed, recommendationLabel } from '../../rules/builder.js';
import { findSubclass, classTN } from '../../rules/classes.js';
import { deriveSheet } from '../../state/character.js';
import { storyPrompt, portraitPrompt } from './prompts.js';
import { explain, hint } from '../explain.js';
import { t } from '../../i18n/index.js';
import { ruleText } from '../rule-text.js';

// ------------------------------------------------------------------ shared fragments

function summary(c, data) {
  const s = deriveSheet(c, data);
  return html`
    <div class="b-summary">
      ${data.attributes.attributes.map((a) => html`<span class="b-summary__item"><span class="label">${a.id}</span><span class="mono">${c.attributes[a.id]}</span></span>`)}
      <span class="b-summary__sep"></span>
      <span class="b-summary__item"><span class="label">HP</span><span class="mono">${s.hp.max}</span></span>
      ${['sqr', 'off', 'act', 'def', 'per'].map((k) => html`<span class="b-summary__item"><span class="label">${k}</span><span class="mono">${k === 'off' ? signed(s.combat[k].value) : s.combat[k].value}</span></span>`)}
      <span class="b-summary__item"><span class="label">${t('common.age')}</span><span class="mono">${c.age}</span></span>
    </div>`;
}

const recs = (draft, data) => scoreQuiz(draft.quiz, data.quiz).slice(0, 2);

function terminal(draft) {
  return html`<div class="term" id="term" tabindex="0" aria-live="polite" title="${t('builder.tapSkip')}">${draft.log.length ? '' : html`<div class="term__line term__line--dim">${t('builder.awaiting')}</div>`}</div>`;
}

function pendingChoices(draft, data) {
  if (!draft.pending.length) return '';
  return html`<div class="stack">${draft.pending.map((ev, i) => html`
    <div class="b-choice">
      <div><strong>${ev.name}</strong> <span class="muted">— ${t('builder.chooseWhere', { n: ev.effects.choice.amount })}</span></div>
      <div class="cluster">${ev.effects.choice.of.map((k) => html`<button class="btn btn--primary btn--sm" data-action="choose" data-index="${i}" data-attr="${k}">+${ev.effects.choice.amount} ${k} <span class="muted">(${draft.character.attributes[k]})</span></button>`)}</div>
    </div>`)}</div>`;
}

function eventPicker(table, name, count) {
  return html`<div class="cluster">
    ${Array.from({ length: count }, (_, i) => html`
      <select class="select" data-pick="${name}" data-index="${i}" aria-label="${t('builder.event')} ${i + 1}">
        ${table.events.map((e) => html`<option value="${e.roll}">${e.roll} · ${e.name}</option>`)}
      </select>`)}
  </div>`;
}

// ------------------------------------------------------------------ steps

export const STEPS = [
  {
    id: 'quiz',
    get title() { return t('builder.quiz.title'); },
    get lede() { return t('builder.quiz.lede'); },
    view(draft, data) {
      const ranked = recs(draft, data);
      return html`
        <div class="b-quiz">
          ${data.quiz.questions.map((q, n) => html`
            <fieldset class="b-q">
              <legend><span class="b-q__n">${n + 1}</span>${q.text}</legend>
              <div class="b-q__opts">${q.options.map((o) => html`
                <button class="b-opt" data-action="answer" data-q="${q.id}" data-o="${o.id}" aria-pressed="${draft.quiz[q.id] === o.id}">${o.text}</button>`)}</div>
            </fieldset>`)}
        </div>
        ${ranked.length ? html`<div class="b-rec">
          <span class="label">${t('builder.fit')}</span>
          ${ranked.map((r, i) => html`<span class="pill ${i === 0 ? 'pill--accent' : 'pill--info'}">${i === 0 ? t('builder.primary') : t('builder.secondary')} · ${recommendationLabel(r, data.classes)} (${r.score})</span>`)}
        </div>` : ''}`;
    },
    done: () => true,
  },
  {
    id: 'identity',
    get title() { return t('builder.identity.title'); },
    get lede() { return t('builder.identity.lede'); },
    view: (draft) => html`
      <div class="form-grid b-narrow">
        <label class="field"><span class="label">${t('builder.playerName')}</span><input class="input" data-field="player" value="${draft.character.player}" placeholder="${t('builder.eg')} Marco" autocomplete="off"></label>
        <label class="field"><span class="label">${t('builder.charName')}</span><input class="input" data-field="name" value="${draft.character.name}" placeholder="${t('builder.eg')} Silas Vane" autocomplete="off"></label>
      </div>`,
    done: (d) => (d.character.name.trim() && d.character.player.trim() ? true : t('builder.needNames')),
  },
  {
    id: 'attributes',
    ref: 'point-buy',
    get title() { return t('builder.attributes.title'); },
    get lede() { return t('builder.attributes.lede'); },
    view(draft, data) {
      const c = draft.character;
      const rules = data.attributes.creation;
      const left = pointsRemaining(c.attributes, rules);
      const ranked = recs(draft, data);
      // quiz picks first, then every other class
      const suggestions = [...ranked.map((r) => r.classId), ...Object.keys(data.quiz.suggestedStats)]
        .filter((v, i, list) => list.indexOf(v) === i);
      const s = deriveSheet(c, data);
      return html`
        <div class="b-attr-layout">
          <div class="stack">
            <div class="b-pool ${left === 0 ? 'is-done' : left < 0 ? 'is-over' : ''}"><span class="label">${t('builder.pointsLeft')}</span><span class="b-pool__n">${left}</span></div>
            <div class="cluster"><span class="label">${t('builder.suggested')}</span>${suggestions.map((id, i) => html`<button class="btn btn--sm ${i < ranked.length && ranked.length ? 'btn--primary' : ''}" data-action="suggest" data-class="${id}">${nameOf(data.classes.classes, id)}</button>`)}</div>
            <div class="b-attrs">
              ${data.attributes.attributes.map((a) => html`
                <div class="b-attr" ${hint('attr', a.id)}>
                  <span class="icon">${raw(data.icons[a.id.toLowerCase()] ?? '')}</span>
                  <div class="b-attr__name"><strong>${a.id}${explain('attr', a.id, a.name)}</strong><span class="muted">${a.name}</span></div>
                  ${draft.advanced
                    ? html`<input class="input input--num" type="number" data-action="setAttr" data-key="${a.id}" value="${c.attributes[a.id]}">`
                    : html`<span class="counter">
                        <button class="counter__btn" data-action="attr" data-key="${a.id}" data-delta="-1" ${canAdjust(c.attributes, a.id, -1, rules) ? '' : raw('disabled')} aria-label="${t('common.decrease', { name: a.name })}">−</button>
                        <span class="counter__value">${c.attributes[a.id]}</span>
                        <button class="counter__btn" data-action="attr" data-key="${a.id}" data-delta="1" ${canAdjust(c.attributes, a.id, 1, rules) ? '' : raw('disabled')} aria-label="${t('common.increase', { name: a.name })}">+</button>
                      </span>`}
                  <span class="b-attr__bonus">${a.id === 'CRS' ? '' : signed(bonus(c.attributes[a.id]))}</span>
                </div>`)}
            </div>
          </div>
          <div class="stack">
            <span class="label">${t('builder.gives')}</span>
            <div class="b-derived">
              <div class="stat" ${hint('hp')}><span class="label">HP${explain('hp', '', t('explain.feeds.hp'))}</span><span class="stat__value">${s.hp.max}</span></div>
              ${data.combat.derived.map((d) => html`<div class="stat" ${hint('combat', d.id)}><span class="label">${d.id}${explain('combat', d.id, d.name)}</span><span class="stat__value">${d.id === 'off' ? signed(s.combat[d.id].value) : s.combat[d.id].value}</span></div>`)}
              <div class="stat" ${hint('initiative')}><span class="label">INIT${explain('initiative', '', t('explain.feeds.initiative'))}</span><span class="stat__value">${signed(s.initiative)}</span></div>
            </div>
            <span class="label">${t('builder.bestSkills')}</span>
            <div class="b-skills">${[...s.skills].sort((x, y) => y.value - x.value).slice(0, 8).map((k) => html`<span class="pill" ${hint('skill', k.id)}>${k.name} <strong class="text-accent">${k.value}</strong></span>`)}</div>
            <p class="hint">${t('builder.attrHint')}</p>
          </div>
        </div>`;
    },
    done(d, data) {
      if (d.advanced) return true;
      const left = pointsRemaining(d.character.attributes, data.attributes.creation);
      return left === 0 ? true : left > 0 ? t('builder.spendLeft', { n: left }) : t('builder.overspent');
    },
  },
  {
    id: 'adolescence',
    ref: 'adolescence',
    get title() { return t('builder.adolescence.title'); },
    get lede() { return t('builder.adolescence.lede'); },
    view(draft, data) {
      const rolled = draft.character.history.adolescence.length > 0;
      return html`
        ${summary(draft.character, data)}
        <div class="cluster">
          ${!rolled ? html`<button class="btn btn--primary" data-action="rollYouth">${t('builder.rollYouth')}</button>` : html`<button class="btn btn--danger btn--sm" data-action="resetYouth">${t('builder.reroll')}</button>`}
          ${draft.advanced && !rolled ? html`<details class="details"><summary>[${t('builder.advanced')}] ${t('builder.pickInstead')}</summary>${eventPicker(data.adolescence, 'youth', data.adolescence.rolls)}<button class="btn btn--sm" data-action="pickYouth">${t('builder.applyPicked')}</button></details>` : ''}
        </div>
        ${terminal(draft)}
        ${pendingChoices(draft, data)}`;
    },
    done: (d) => (!d.character.history.adolescence.length ? t('builder.rollYouthFirst') : d.pending.length ? t('builder.pendingChoice') : true),
  },
  {
    id: 'career',
    ref: 'careers',
    get title() { return t('builder.career.title'); },
    get lede() { return t('builder.career.lede'); },
    view(draft, data) {
      const c = draft.character;
      const closed = careerClosed(c);
      const sel = data.careers.careers.find((k) => k.id === draft.careerId);
      const terms = c.history.careers;
      return html`
        ${summary(c, data)}
        <div class="cluster">
          ${c.credentials.map((id) => html`<span class="pill pill--info">${nameOf(data.careers.credentials, id)}</span>`)}
          ${c.criminalRecord ? html`<span class="pill pill--danger">${t('dossier.criminal')}</span>` : ''}
          ${c.waivers.length ? html`<span class="pill pill--success">${t('builder.waiver')}</span>` : ''}
        </div>
        ${closed ? html`<p class="notice notice--danger">${t('builder.careerEnded')}</p>` : html`
          <div class="b-careers">
            ${data.careers.careers.map((k) => {
              const { eligible, checks, waived } = careerChecks(c, k, data.careers);
              return html`<button class="b-career ${eligible ? '' : 'is-blocked'}" data-action="pickCareer" data-id="${k.id}" aria-pressed="${draft.careerId === k.id}">
                <span class="b-career__cat">${k.category}</span>
                <span class="b-career__name">${k.name === 'Standard' ? k.category : k.name}</span>
                <span class="b-career__mods mono">${Object.entries(k.modifiers).map(([a, v]) => `${a} ${signed(v)}`).join(' · ')}</span>
                <span class="b-career__req">${checks.length ? checks.map((x) => html`<span class="${x.met || waived ? 'text-success' : 'text-danger'}">${x.met || waived ? '✓' : '✗'} ${ruleText(x)}</span>`) : html`<span class="text-success">✓ ${t('builder.noReqs')}</span>`}</span>
              </button>`;
            })}
          </div>
          <div class="cluster">
            <button class="btn btn--primary" data-action="serveTerm" ${sel && (careerChecks(c, sel, data.careers).eligible || draft.ignoreReqs) && !draft.pending.length ? '' : raw('disabled')}>
              ${sel ? t('builder.serveTerm', { career: sel.name === 'Standard' ? sel.category : sel.name }) : t('builder.pickCareer')}</button>
            ${terms.length ? html`<button class="btn btn--sm" data-action="undoTerm">${t('builder.undoTerm')}</button>` : ''}
            ${draft.advanced ? html`<label class="cluster"><input type="checkbox" data-action="ignoreReqs" ${draft.ignoreReqs ? raw('checked') : ''}> <span class="label">[${t('builder.advanced')}] ${t('builder.ignoreReqs')}</span></label>
              <details class="details"><summary>[${t('builder.advanced')}] ${t('builder.pickTermEvents')}</summary>${eventPicker(data.careerEvents, 'term', data.careers.eventsPerTerm)}<label class="cluster"><input type="checkbox" data-action="useTermPicks" ${draft.useTermPicks ? raw('checked') : ''}> <span class="label">${t('builder.useTheseInstead')}</span></label></details>` : ''}
          </div>`}
        ${terms.length ? html`<p class="mono muted">${t('builder.path')}: ${terms.map((x) => nameOf(data.careers.careers, x.careerId)).join(' → ')}</p>` : ''}
        ${terminal(draft)}
        ${pendingChoices(draft, data)}`;
    },
    done: (d) => (d.pending.length ? t('builder.pendingChoice') : true),
  },
  {
    id: 'debt',
    ref: 'debt',
    get title() { return t('builder.debt.title'); },
    get lede() { return t('builder.debt.lede'); },
    view(draft, data) {
      const debt = data.debts.find((x) => x.id === draft.character.debtId);
      return html`
        <div class="cluster">
          <button class="btn btn--primary" data-action="rollDebt">${t('builder.rollDebt')}</button>
          <select class="select" data-field="debtId" aria-label="${t('builder.chooseDebt')}">
            <option value="">— ${t('builder.orChoose')} —</option>
            ${data.debts.map((x) => html`<option value="${x.id}" ${draft.character.debtId === x.id ? raw('selected') : ''}>${x.name}</option>`)}
          </select>
        </div>
        ${debt ? html`<article class="b-debt"><h3 class="card__title">${debt.name}</h3><p>${debt.debt}</p><p class="hint"><strong>${t('builder.ifNotPaid')}:</strong> ${debt.threat}</p></article>` : ''}`;
    },
    done: (d) => (d.character.debtId ? true : t('builder.needDebt')),
  },
  {
    id: 'class',
    ref: 'class-tn',
    get title() { return t('builder.class.title'); },
    get lede() { return t('builder.class.lede'); },
    view(draft, data) {
      const c = draft.character;
      const ranked = recs(draft, data).map((r) => r.subclassId);
      const sel = c.subclassId ? findSubclass(data.classes, c.subclassId) : null;
      return html`
        <div class="b-classes">
          ${data.classes.classes.map((cls) => html`
            <div class="b-class">
              <div class="b-class__head"><span class="icon">${raw(data.icons[cls.id] ?? '')}</span><strong>${cls.name}</strong><span class="muted">${cls.resources.engine}</span></div>
              <p class="hint">${cls.summary}</p>
              <div class="b-class__subs">${cls.subclasses.map((sub) => html`
                <button class="b-sub" data-action="pickClass" data-id="${sub.id}" aria-pressed="${c.subclassId === sub.id}">
                  <span class="b-sub__name">${sub.name} ${ranked.includes(sub.id) ? html`<span class="pill pill--accent">${ranked[0] === sub.id ? t('builder.quizPick') : t('builder.quizAlt')}</span>` : ''}</span>
                  <span class="mono muted">${sub.stats.join(' + ')} · TN ${classTN(c.attributes, sub)}</span>
                  <span class="b-sub__desc">${sub.desc}</span>
                </button>`)}</div>
            </div>`)}
        </div>
        ${sel ? html`<div class="b-abilities"><span class="label">${t('builder.subAbilities', { sub: sel.sub.name })}</span>
          <div class="cluster">${data.abilities[sel.cls.id].filter((a) => a.subclasses.includes(sel.sub.id)).map((a) => html`<span class="pill" title="${a.desc ?? `${a.mend} / ${a.surge}`}">${a.name}</span>`)}</div></div>` : ''}`;
    },
    done: (d) => (d.character.subclassId ? true : t('builder.needSub')),
  },
  {
    id: 'story',
    get title() { return t('builder.story.title'); },
    get lede() { return t('builder.story.lede'); },
    view(draft, data) {
      const c = draft.character;
      return html`
        <div class="b-story">
          <div class="stack">
            <div class="spread"><span class="label">${t('builder.storyPrompt')}</span><button class="btn btn--sm" data-action="copy" data-target="p-story">${t('common.copy')}</button></div>
            <textarea class="textarea mono b-prompt" id="p-story" readonly>${storyPrompt(c, data)}</textarea>
            <div class="spread"><span class="label">${t('builder.portraitPrompt')}</span><button class="btn btn--sm" data-action="copy" data-target="p-portrait">${t('common.copy')}</button></div>
            <textarea class="textarea mono b-prompt b-prompt--short" id="p-portrait" readonly>${portraitPrompt(c, data)}</textarea>
          </div>
          <div class="stack">
            <label class="field"><span class="label">${t('builder.pasteStory')}</span>
              <textarea class="textarea" data-field="narrative.backstoryHtml" placeholder="${t('builder.pastePlaceholder')}">${c.narrative.backstoryHtml}</textarea></label>
            <div class="cluster">
              ${c.portrait.dataUrl ? html`<img class="avatar" src="${c.portrait.dataUrl}" alt="">` : ''}
              <label class="btn btn--sm">${t('builder.uploadPortrait')}<input type="file" accept="image/*" class="visually-hidden" data-action="portrait"></label>
            </div>
          </div>
        </div>`;
    },
    done: () => true,
  },
  {
    id: 'review',
    get title() { return t('builder.review.title'); },
    get lede() { return t('builder.review.lede'); },
    view(draft, data) {
      const c = draft.character;
      const s = deriveSheet(c, data);
      const debt = data.debts.find((x) => x.id === c.debtId);
      return html`
        <div class="b-review">
          <div class="stack">
            <div class="b-review__name">${c.name}<span class="muted"> · ${c.player}</span></div>
            <div class="sheet-status__class">${s.class ? `${s.class.name} · ${s.class.subclass.name} · Class TN ${s.class.tn}` : t('common.noClass')}</div>
            ${summary(c, data)}
            <dl class="kv">
              <dt>${t('builder.adolescence.title')}</dt><dd>${c.history.adolescence.map((h) => nameOf(data.adolescence.events, h.eventId)).join(', ')}</dd>
              <dt>${t('dossier.career')}</dt><dd>${c.history.careers.map((x) => nameOf(data.careers.careers, x.careerId)).join(' → ') || t('common.none')}</dd>
              <dt>${t('dossier.credentials')}</dt><dd>${c.credentials.map((id) => nameOf(data.careers.credentials, id)).join(', ') || '—'}</dd>
              <dt>${t('dossier.record')}</dt><dd>${c.criminalRecord ? t('dossier.criminal') : t('dossier.clean')}</dd>
              <dt>${t('builder.debt.title')}</dt><dd>${debt?.name ?? '—'}</dd>
            </dl>
          </div>
          <div class="stack">
            <span class="label">${t('builder.topSkills')}</span>
            <div class="b-skills">${[...s.skills].sort((x, y) => y.value - x.value).slice(0, 10).map((k) => html`<span class="pill">${k.name} <strong class="text-accent">${k.value}</strong></span>`)}</div>
            ${driveEditor(c, data, 'builder')}
            <button class="btn btn--primary btn--block b-create" data-action="create">${t('builder.create')}</button>
          </div>
        </div>`;
    },
    done: () => true,
  },
];
