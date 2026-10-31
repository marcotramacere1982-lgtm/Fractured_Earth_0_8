// Intel on the sheet (decision 197): what this character knows about enemy types — on the enemy's card in a fight,
// in the Map bookmark and the attack window; the whole file (with Share) and the one-time background picks on the
// Dossier. The facts arrive from the table (rules/intel.js, server/intel.mjs); nothing here works them out.

import { html, raw } from '../dom.js';
import { t } from '../../i18n/index.js';
import { card } from './parts.js';
import { STUDIED, backgroundIntel } from '../../rules/intel.js';

const signed = (n) => (n > 0 ? `+${n}` : String(n));

/** The facts one entry holds, compact: armor, HP, squares and weapons; Studied adds the rest. */
export function intelFactsView(entry, data) {
  if (!entry) return '';
  if (entry.rumour) return html`<p class="intel__rumour"><span class="pill">${t('intel.rumour')}</span> ${entry.rumour}</p>`;
  const f = entry.facts ?? {};
  const cond = (id) => data.conditions.find((x) => x.id === id)?.name ?? id;
  return html`<div class="intel__facts">
    <div class="cluster intel__stats"><span class="pill ${entry.level >= STUDIED ? 'pill--accent' : 'pill--info'}">${t(entry.level >= STUDIED ? 'intel.studied' : 'intel.known')}</span>
      <span class="mono">${t('intel.armor')} ${f.armor}</span><span class="mono">HP ${f.hp}</span>${f.sqr != null ? html`<span class="mono">${t('intel.squares', { n: f.sqr })}</span>` : ''}
      ${entry.level >= STUDIED ? html`<span class="mono">${t('intel.actions', { n: f.actions })}</span><span class="mono">INIT ${signed(f.init ?? 0)}</span>` : ''}</div>
    ${(f.attacks ?? []).length ? html`<ul class="intel__attacks">${f.attacks.map((a) => html`<li><strong>${a.name}</strong> <span class="muted">${a.type}</span> <span class="mono">${a.damage}</span></li>`)}</ul>` : ''}
    ${entry.level >= STUDIED && f.behaviour ? html`<p class="intel__line"><span class="label">${t('intel.behaviour')}</span> ${f.behaviour}</p>` : ''}
    ${entry.level >= STUDIED ? (f.talents ?? []).map((x) => html`<p class="intel__line"><span class="label">${t('intel.special')}</span> <strong>${x.name}</strong> — ${x.desc}</p>`) : ''}
    ${entry.level >= STUDIED && f.immune?.length ? html`<p class="intel__line"><span class="label">${t('intel.immune')}</span> ${f.immune.map(cond).join(', ')}</p>` : ''}
    ${entry.from ? html`<p class="muted st-small">${t('intel.from', { name: entry.from })}</p>` : ''}
  </div>`;
}

/** Background Intel (decision 197): once, at the table — the Known types the careers give, one INT roll per pick. */
function backgroundCard(c, s, data, atTable) {
  const bg = backgroundIntel(c, data);
  const done = c.play.intelBackground?.done;
  if (done || (!bg.auto.length && !bg.picks.length && !bg.nemesis)) return '';
  const rolls = c.play.intelBackground?.rolls ?? {};
  const nameOf = (id) => [...data.collection.enemies, ...data.collection.elites].find((x) => x.id === id)?.name ?? id;
  const career = (id) => { const k = data.careers.careers.find((x) => x.id === id); return k ? (k.name === 'Standard' ? k.category : `${k.category} · ${k.name}`) : id; };
  const lifeEvents = [...data.adolescence.events, ...(Array.isArray(data.careerEvents.events) ? data.careerEvents.events : Object.values(data.careerEvents.events ?? {}).flat())];
  const eventName = (id) => { const n = lifeEvents.find((x) => x.id === id)?.name ?? id; return n.charAt(0) + n.slice(1).toLowerCase(); };
  const sourceName = (p) => (p.kind === 'career' ? career(p.source) : eventName(p.source));
  return html`<section class="stack intel-bg">
    <h3 class="label">${t('intel.bgTitle')}</h3>
    <p class="hint">${t('intel.bgLead', { int: s.attributes.INT })}</p>
    ${bg.auto.length ? html`<p>${t('intel.bgAuto')} ${bg.auto.map((id) => html`<span class="pill pill--info">${nameOf(id)}</span> `)}</p>` : ''}
    ${bg.picks.map((p) => {
      const r = rolls[p.source];
      return html`<div class="spread spread--wrap intel-bg__pick"><span class="st-small"><strong>${sourceName(p)}</strong></span>
        ${r ? html`<span class="pill ${r.ok ? 'pill--success' : ''}">${nameOf(r.id)} · ${t(r.ok ? 'intel.bgOk' : 'intel.bgNo')}</span>`
          : html`<span class="cluster"><select class="select" data-intel-pick="${p.source}" aria-label="${t('intel.bgPick')}">${p.options.map((id) => html`<option value="${id}">${nameOf(id)}</option>`)}</select>
            <button class="btn btn--sm btn--primary" data-action="intelBgRoll" data-source="${p.source}">🎲 INT ${s.attributes.INT}</button></span>`}</div>`;
    })}
    ${bg.nemesis ? html`<div class="spread spread--wrap intel-bg__pick"><span class="st-small"><strong>${t('intel.bgNemesis')}</strong></span>
      <select class="select" data-intel-nemesis aria-label="${t('intel.bgNemesis')}">${bg.nemesis.map((id) => html`<option value="${id}">${nameOf(id)}</option>`)}</select></div>` : ''}
    ${atTable ? html`<button class="btn btn--primary" data-action="intelBgSend" ${bg.picks.every((p) => rolls[p.source]) ? '' : raw('disabled')}>${t('intel.bgSend')}</button>`
      : html`<p class="hint">${t('intel.bgAtTable')}</p>`}
  </section>`;
}

/** The Dossier's Intel card: the background picks (once), then the file — each entry with Share. */
export function intelCard(c, s, data, ctx) {
  const entries = Object.values(c.play.intel ?? {}).sort((a, b) => a.name.localeCompare(b.name));
  const bg = backgroundCard(c, s, data, ctx.atTable);
  if (!entries.length && !bg) return '';
  return card(t('intel.title'), html`<div class="stack">
    ${bg}
    ${entries.length ? html`<ul class="intel-file">${entries.map((e) => html`<li class="intel-file__row">
      <div class="spread"><strong>${e.name}</strong>${ctx.atTable ? html`<button class="btn btn--sm btn--ghost" data-action="intelShare" data-id="${e.id}" title="${t('intel.shareHint')}">⇪ ${t('intel.share')}</button>` : ''}</div>
      ${intelFactsView(e, data)}</li>`)}</ul>` : html`<p class="muted">${t('intel.empty')}</p>`}
  </div>`, { sub: t('intel.sub'), ref: 'intel' });
}
