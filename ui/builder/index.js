// Character builder wizard: #/builder. The draft autosaves, so a refresh never loses progress.

import { html, render, delegate, cleanup } from '../dom.js';
import { go } from '../router.js';
import { toast } from '../shell.js';
import { STEPS } from './steps.js';
import { typeInto } from './console.js';
import { info } from '../ref.js';
import { createCharacter } from '../../state/character.js';
import { setExplainSource } from '../explain.js';
import { t, getLang } from '../../i18n/index.js';
import { storyPrompt } from './prompts.js';
import { shrinkImage } from '../../state/store.js';
import { runAdolescence, runCareerTerm, resolveChoice } from '../../rules/builder.js';

const KEY = 'fe.builder.draft.v1';

function newDraft(data) {
  return {
    v: 1, step: 0, maxStep: 0, advanced: false, quiz: {},
    character: createCharacter(data),
    logs: { adolescence: [], career: [] },
    pending: [],
    snapshots: { youth: null, terms: [] },
    careerId: null, ignoreReqs: false, useTermPicks: false,
    picks: { youth: [], term: [] },
  };
}

function loadDraft(data) {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d?.v === 1) return d;
  } catch { /* no draft */ }
  return newDraft(data);
}
/** Drops the saved draft (used when a stale draft cannot be opened). */
export function resetBuilderDraft() { try { localStorage.removeItem(KEY); } catch { /* storage blocked */ } }
const saveDraft = (d) => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* storage blocked */ } };

const setPath = (obj, path, value) => {
  const keys = path.split('.');
  let o = obj;
  while (keys.length > 1) o = o[keys.shift()];
  o[keys[0]] = value;
};

export function builderView({ data, store, main, table, library }) {
  let draft = loadDraft(data);
  setExplainSource(() => draft.character);
  let animateFrom = null; // index in the current log to start typing from (transient)

  const step = () => STEPS[draft.step];
  const logKey = () => (step().id === 'adolescence' ? 'adolescence' : step().id === 'career' ? 'career' : null);

  const navState = () => {
    const ok = step().done(draft, data);
    return { ok: ok === true, reason: ok === true ? '' : ok };
  };

  const draw = () => {
    const st = step();
    const log = logKey() ? draft.logs[logKey()] : [];
    const nav = navState();
    render(main, html`
      <div class="builder">
        <header class="b-head">
          <div>
            <h1 class="page-title">${t('home.defaultName')}</h1>
            <p class="page-lede">${t('builder.stepOf', { n: draft.step + 1, total: STEPS.length })}</p>
          </div>
          <div class="cluster">
            <label class="b-toggle"><input type="checkbox" data-action="advanced" ${draft.advanced ? 'checked' : ''}><span>${t('builder.advancedMode')}</span></label>
            <button class="btn btn--sm btn--ghost" data-action="restart">${t('builder.startOver')}</button>
          </div>
        </header>
        <ol class="b-steps">
          ${STEPS.map((s, i) => html`<li><button class="b-step ${i === draft.step ? 'is-current' : i < draft.step ? 'is-done' : ''}" data-action="goto" data-step="${i}" ${i > draft.maxStep ? 'disabled' : ''}>
            <span class="b-step__n">${i + 1}</span><span class="b-step__t">${s.title}</span></button></li>`)}
        </ol>
        <section class="card b-card">
          <header class="card__head"><div><h2 class="card__title">${st.title}${st.ref ? info(st.ref, st.title) : ''}</h2><p class="hint b-lede">${st.lede}</p></div></header>
          <div class="card__body stack">${st.view({ ...draft, log }, data, { atTable: Boolean(table?.state.available) })}</div>
          <footer class="card__foot">
            <button class="btn" data-action="prev" ${draft.step === 0 ? 'disabled' : ''}>${t('common.back')}</button>
            <span class="hint b-nav-reason">${nav.reason}</span>
            ${draft.step < STEPS.length - 1 ? html`<button class="btn btn--primary" data-action="next" ${nav.ok ? '' : 'disabled'}>${st.id === 'quiz' && !Object.keys(draft.quiz).length ? t('common.skip') : t('common.next')}</button>` : ''}
          </footer>
        </section>
      </div>`);
    // restore advanced pickers
    main.querySelectorAll('select[data-pick]').forEach((sel) => {
      const v = draft.picks[sel.dataset.pick]?.[sel.dataset.index];
      if (v) sel.value = v;
    });
    const term = main.querySelector('#term');
    if (term && log.length) {
      const from = animateFrom ?? log.length;
      animateFrom = null;
      typeInto(term, log, from);
    }
  };

  const commit = (mutate, { redraw = true } = {}) => {
    mutate(draft);
    draft.maxStep = Math.max(draft.maxStep, draft.step);
    saveDraft(draft);
    if (redraw) draw();
  };

  /** Updates only the footer (keeps focus in text inputs). */
  const refreshNav = () => {
    const nav = navState();
    const next = main.querySelector('[data-action="next"]');
    if (next) next.disabled = !nav.ok;
    const reason = main.querySelector('.b-nav-reason');
    if (reason) reason.textContent = nav.reason;
  };

  const pushLog = (key, entries) => {
    animateFrom = draft.logs[key].length;
    draft.logs[key].push(...entries);
  };

  const picks = (name, count) => Array.from({ length: count }, (_, i) => ({ roll: Number(draft.picks[name]?.[i] ?? 2) }));

  const offClick = delegate(main, 'click', {
    next: () => commit((d) => { d.step = Math.min(STEPS.length - 1, d.step + 1); d.maxStep = Math.max(d.maxStep, d.step); }),
    prev: () => commit((d) => { d.step = Math.max(0, d.step - 1); }),
    goto: ({ step: i }) => commit((d) => { d.step = Number(i); }),
    restart: () => { if (confirm(t('builder.confirmRestart'))) { draft = newDraft(data); saveDraft(draft); draw(); } },
    answer: ({ q, o }) => commit((d) => { d.quiz[q] = o; }),
    attr: ({ key, delta }) => commit((d) => { d.character.attributes[key] += Number(delta); }),
    suggest: ({ class: cls }) => commit((d) => {
      Object.assign(d.character.attributes, data.quiz.suggestedStats[cls].stats, { CRS: data.attributes.creation.crs.start });
    }),
    rollYouth: () => commit((d) => {
      d.snapshots.youth = structuredClone(d.character);
      const r = runAdolescence(d.character, data);
      d.character = r.character; d.pending = r.pending;
      pushLog('adolescence', r.entries);
    }),
    pickYouth: () => commit((d) => {
      d.snapshots.youth = structuredClone(d.character);
      const r = runAdolescence(d.character, data, { picks: picks('youth', data.adolescence.rolls) });
      d.character = r.character; d.pending = r.pending;
      pushLog('adolescence', r.entries);
    }),
    resetYouth: () => {
      if (!confirm(t('builder.confirmReroll'))) return;
      commit((d) => {
        d.character = d.snapshots.youth ?? d.character;
        d.snapshots = { youth: null, terms: [] };
        d.pending = []; d.logs = { adolescence: [], career: [] };
      });
    },
    choose: ({ index, attr }) => commit((d) => {
      const ev = d.pending[Number(index)];
      const r = resolveChoice(d.character, ev, { [attr]: ev.effects.choice.amount });
      d.character = r.character;
      d.pending.splice(Number(index), 1);
      pushLog(logKey() ?? 'career', r.entries);
    }),
    pickCareer: ({ id }) => commit((d) => { d.careerId = id; }),
    serveTerm: () => commit((d) => {
      const career = data.careers.careers.find((k) => k.id === d.careerId);
      d.snapshots.terms.push(structuredClone(d.character));
      const r = runCareerTerm(d.character, career, data, {
        ignoreRequirements: d.advanced && d.ignoreReqs,
        picks: d.advanced && d.useTermPicks ? picks('term', data.careers.eventsPerTerm) : null,
      });
      if (!r.ok) d.snapshots.terms.pop();
      d.character = r.character; d.pending = r.pending;
      pushLog('career', r.entries);
    }),
    undoTerm: () => commit((d) => {
      const prev = d.snapshots.terms.pop();
      if (!prev) return;
      d.character = prev; d.pending = [];
      pushLog('career', [{ kind: 'warn', text: '> Last term undone.' }]);
    }),
    driveType: ({ value }) => commit((d) => { d.character.drive = { ...(d.character.drive ?? { line: '' }), type: value }; }),
    rollDebt: () => commit((d) => { d.character.debtId = data.debts[Math.floor(Math.random() * data.debts.length)].id; }),
    pickClass: ({ id }) => commit((d) => {
      const cls = data.classes.classes.find((k) => k.subclasses.some((s) => s.id === id));
      d.character.classId = cls.id; d.character.subclassId = id;
    }),
    async copy({ target }) {
      const el = document.getElementById(target);
      try { await navigator.clipboard.writeText(el.value); toast(t('builder.copied'), 'success'); }
      catch { el.select(); document.execCommand('copy'); toast(t('builder.copied')); }
    },
    /** Decision 50: the GM's Claude writes the backstory; it arrives on the sheet once the GM sends it. */
    sendStory: async () => {
      const c = draft.character;
      const mode = c.narrative.backstoryHtml?.trim() ? 'revise' : 'write';
      const ok = await table?.askBackstory({ id: c.id, name: c.name, player: c.player, lang: getLang(), prompt: storyPrompt(c, data), current: c.narrative.backstoryHtml ?? '', mode });
      if (!ok) { toast(t('dossier.askFailed'), 'danger'); return; }
      commit((d) => { d.character.narrative.backstoryRequest = { at: Date.now(), mode }; });
      toast(t('dossier.askedToast'), 'success');
    },
    create: () => {
      const c = structuredClone(draft.character);
      c.tags = c.tags.filter((t) => t !== 'Career ended');
      c.waivers = [];
      const id = store.add(c);
      localStorage.removeItem(KEY);
      toast(t('builder.ready', { name: c.name }), 'success');
      if (library?.state.player) library.keep(id).then(() => table.join(id)); // at a table: saved under your name (decision 87)
      go('sheet', id);
    },
  });

  const offInput = delegate(main, 'input', {});
  const onInput = (e) => {
    const f = e.target.closest('[data-field]');
    if (!f) return;
    commit((d) => setPath(d.character, f.dataset.field, f.value), { redraw: false });
    refreshNav();
  };
  main.addEventListener('input', onInput);

  const offChange = delegate(main, 'change', {
    advanced: (_, e) => commit((d) => { d.advanced = e.target.checked; }),
    setAttr: ({ key }, e) => commit((d) => { d.character.attributes[key] = Number(e.target.value) || 0; }),
    ignoreReqs: (_, e) => commit((d) => { d.ignoreReqs = e.target.checked; }),
    useTermPicks: (_, e) => commit((d) => { d.useTermPicks = e.target.checked; }, { redraw: false }),
    async portrait(_, e) {
      const file = e.target.files[0];
      if (!file) return;
      try { const url = await shrinkImage(file); commit((d) => { d.character.portrait.dataUrl = url; }); }
      catch { toast(t('dossier.badImage'), 'danger'); }
    },
  });
  const onSelect = (e) => {
    const sel = e.target.closest('select');
    if (!sel) return;
    if (sel.dataset.pick) commit((d) => { (d.picks[sel.dataset.pick] ??= [])[Number(sel.dataset.index)] = sel.value; }, { redraw: false });
    if (sel.dataset.field) { commit((d) => setPath(d.character, sel.dataset.field, sel.value)); }
  };
  main.addEventListener('change', onSelect);

  draw();
  return cleanup(offClick, offInput, offChange, () => main.removeEventListener('input', onInput), () => main.removeEventListener('change', onSelect));
}
