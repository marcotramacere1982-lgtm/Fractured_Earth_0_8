// Decision 332: what a downtime leaves to settle on the sheet — tick one option of your event (locked once chosen),
// roll what it asks, and pay the upkeep (cash, Credit Score or half and half). Shown on the Dossier while anything is
// open; the report in the message area points here. Every step goes to the GM's Activity and session log.
// Owner 2026-11-16: a clear loop — the card keeps a running receipt of what this downtime did, a job is an application
// the GM answers, and when everything is settled the card stays as a receipt until the player taps ✓.

import { html, raw } from '../dom.js';
import { card } from './parts.js';
import { t } from '../../i18n/index.js';
import { inline } from '../manual/markdown.js';
import { optionMeta, payWays } from '../../rules/downtime-choice.js';
import { upkeepWays } from './downtime-actions.js';
import { jobOf, applyFor } from '../../rules/jobs.js'; // decision 334
import { walletLine } from './timeline.js';

const md = (s) => raw(inline(s ?? ''));

/** The open downtime's event entries ('event' first). */
export function openEntries(c) {
  const mid = c.downtime?.open?.mid;
  return mid ? (c.downtime.timeline ?? []).filter((e) => e.mid === mid && e.kind === 'event' && e.options?.length) : [];
}
/** Decision 333: the open downtime's crew event, while the GM hasn't confirmed what the crew chose. */
export function openCrew(c) {
  const mid = c.downtime?.open?.mid;
  return mid ? (c.downtime.timeline ?? []).find((e) => e.mid === mid && e.kind === 'crew' && e.batch && e.options?.length && !e.chosen) ?? null : null;
}

/** Anything left to do? */
export function downtimePending(c, data) {
  const o = c.downtime?.open;
  if (!o) return false;
  const choice = openEntries(c).some((e) => !e.chosen || (e.chosen.skills?.length && !e.chosen.roll) || e.chosen.owe);
  const work = data.jobs && 'work' in o && (!o.work || (o.work.what === 'apply' && ['pending', 'roll'].includes(o.work.state)));
  return choice || Boolean(o.upkeep && !o.upkeepPaid) || Boolean(openCrew(c)) || Boolean(work);
}

const paidText = (p) => [p?.cash ? `$${p.cash}` : '', p?.crs ? `${p.crs} CRS` : ''].filter(Boolean).join(' + ');
const careerName = (data, id) => { const k = data.careers.careers.find((x) => x.id === id); return k ? `${k.category}${k.name !== 'Standard' ? ` — ${k.name}` : ''}` : ''; };

/** Owner 2026-11-16: what this downtime has done so far, one line each — the player sees every step land. */
function receipt(c, data) {
  const o = c.downtime.open;
  const r = o.report ?? {};
  const mid = o.mid;
  const lines = [];
  if (r.strain && r.strain.from !== r.strain.to) lines.push(t('downtime.strainEased', { from: r.strain.from, to: r.strain.to }));
  if (r.treated) lines.push(t('downtime.treated', { n: r.treated }));
  if (r.pay) lines.push(r.pay.crs || r.pay.gross ? t(r.pay.garnished ? 'downtime.paydayGarnished' : 'downtime.payday', { status: t(`job.status.${r.pay.status}`), crs: r.pay.crs, gross: r.pay.gross, cut: r.pay.garnished, cash: r.pay.cash }) : t('downtime.noPay', { status: t(`job.status.${r.pay.status}`) }));
  for (const e of (c.downtime.timeline ?? []).filter((x) => x.mid === mid && x.chosen)) {
    const ch = e.chosen;
    lines.push(t(e.kind === 'crew' ? 'downtime.rc.crew' : 'downtime.rc.chose', { title: e.title, label: ch.label })
      + (ch.paid ? ` · ${t('downtime.rc.paid', { what: paidText(ch.paid) })}` : '')
      + (ch.roll ? ` · ${ch.roll.name}: ${t(ch.roll.success ? 'downtime.rollOk' : 'downtime.rollKo')}` : '')
      + (ch.pressure && ch.pressure.from !== ch.pressure.to ? ` · ${t('downtime.pressureMoved', { from: ch.pressure.from, to: ch.pressure.to })}` : ''));
  }
  if (o.upkeepPaid) lines.push(t('downtime.rc.upkeep', { what: paidText(o.upkeepPaid) }));
  const w = o.work;
  if (w) {
    if (w.what === 'apply') { if (['hired', 'down'].includes(w.state)) lines.push(t(`downtime.rc.apply.${w.state}`, { career: careerName(data, w.careerId), status: t(`job.status.${w.as ?? 'employed'}`) })); } // pending / roll: the work section says it
    else lines.push(t(`downtime.rc.work.${w.what}`, { status: t(`job.status.${jobOf(c, data).status}`) }));
  }
  return lines.length ? html`<ul class="dt-receipt">${lines.map((l) => html`<li>✓ ${l}</li>`)}</ul>` : '';
}

const wayLabel = (w) => t(`downtime.way.${w.id}`, { cash: w.cash, crs: w.crs });

function entryBlock(e, c, s, data) {
  if (!e.chosen) {
    return html`<div class="dt-event">
      <div class="dt-event__title">${e.title}</div>
      <p class="dt-event__text">${md(e.text)}</p>
      <span class="label">${t('downtime.chooseOne')}</span>
      <div class="stack">${e.options.map((o, i) => {
        const m = optionMeta(o, data);
        return html`<button class="btn btn--block choice dt-choice" data-action="dtChoose" data-mid="${e.mid}" data-kind="${e.kind}" data-index="${i}">
          <span class="dt-choice__text">${md(o)}</span>
          ${m.cost || m.skills.length || m.hook ? html`<small class="choice__sub">${[m.cost ? t(m.costWhen === 'always' ? 'downtime.costNow' : 'downtime.costIf', { cr: m.cost }) : '', m.skills.length ? t('downtime.rollOf', { names: m.skills.map((id) => s.skills.find((k) => k.id === id)?.name ?? id).join(` ${t('downtime.or')} `) }) : '', m.hook ? t('downtime.hook') : ''].filter(Boolean).join(' · ')}</small>` : ''}
        </button>`;
      })}</div>
    </div>`;
  }
  const ch = e.chosen;
  return html`<div class="dt-event">
    <div class="dt-event__title">${e.title}</div>
    <p class="dt-chosen">✓ ${md(e.options[ch.i])}</p>
    ${ch.skills?.length && !ch.roll ? html`<div class="cluster">${ch.skills.map((id) => {
      const k = s.skills.find((x) => x.id === id);
      return html`<button class="btn btn--primary" data-action="dtRoll" data-mid="${e.mid}" data-kind="${e.kind}" data-skill="${id}">🎲 ${k?.name ?? id} <span class="mono">TN ${k?.value ?? '?'}</span></button>`;
    })}</div>` : ''}
    ${ch.owe ? html`<span class="label">${t('downtime.owe', { cr: ch.owe })}</span>
      <div class="cluster">${payWays(ch.owe, c, data).map((w) => html`<button class="btn btn--sm" data-action="dtPay" data-mid="${e.mid}" data-kind="${e.kind}" data-way="${w.id}" ${w.ok ? '' : raw('disabled')}>${wayLabel(w)}</button>`)}</div>` : ''}
  </div>`;
}

/** Decision 333: the crew's event — a secret vote (it can change) until the GM confirms. vote: my vote's index or undefined. */
function crewBlock(e, vote, atTable) {
  return html`<div class="dt-event">
    <span class="label">${t('downtime.crew')}</span>
    <div class="dt-event__title">${e.title}</div>
    <p class="dt-event__text">${md(e.text)}</p>
    <span class="label">${atTable ? t(vote == null ? 'downtime.crewVote' : 'downtime.crewVoted') : t('downtime.crewNoTable')}</span>
    <div class="stack">${e.options.map((o, i) => html`<button class="btn btn--block choice dt-choice ${vote === i ? 'is-on' : ''}" data-action="dtVote" data-batch="${e.batch}" data-index="${i}" aria-pressed="${vote === i}" ${atTable ? '' : raw('disabled')}>
      <span class="dt-choice__text">${vote === i ? '🗳 ' : ''}${md(o)}</span></button>`)}</div>
  </div>`;
}

/** Decision 334: your work this downtime — once: keep it, look for a job, take gig work, quit. */
function workBlock(c, data) {
  const o = c.downtime.open;
  if (!data.jobs || !('work' in o)) return '';
  const w = o.work;
  if (w?.what === 'apply' && w.state === 'pending') return html`<p class="notice" role="status">${t('downtime.rc.apply.pending', { career: careerName(data, w.careerId) })}</p>`;
  if (w?.what === 'apply' && w.state === 'roll') {
    const roll = applyFor(c, w.careerId, data).roll ?? { tn: Math.max(c.attributes.INT, c.attributes.CHA) + (data.careers.entry?.bonus ?? 0), stat: c.attributes.INT >= c.attributes.CHA ? 'INT' : 'CHA' };
    return html`<div class="stack-tight"><span class="label">${t('downtime.rc.apply.roll', { career: careerName(data, w.careerId) })}</span>
      <div class="cluster"><button class="btn btn--primary" data-action="dtJobRoll" data-tn="${roll.tn}" data-stat="${roll.stat}">🎲 ${t('downtime.work.entryTitle')} <span class="mono">TN ${roll.tn}</span></button></div></div>`;
  }
  if (w) return '';
  const job = jobOf(c, data);
  const flagged = (c.attributes?.CRS ?? 0) < data.jobs.flaggedBelow;
  return html`<div class="stack-tight">
    <span class="label">${t('downtime.work.title', { status: t(`job.status.${job.status}`) })}</span>
    <div class="cluster">
      <button class="btn btn--sm btn--primary" data-action="dtWork" data-what="keep">${t('downtime.work.keep')}</button>
      <button class="btn btn--sm" data-action="dtWork" data-what="look">${t('downtime.work.look')}</button>
      ${job.status !== 'gig' ? html`<button class="btn btn--sm" data-action="dtWork" data-what="gig" ${flagged ? raw('disabled') : ''}>${t('downtime.work.gig')}</button>` : ''}
      ${['employed', 'gig', 'student'].includes(job.status) ? html`<button class="btn btn--sm btn--ghost" data-action="dtWork" data-what="quit">${t('downtime.work.quit')}</button>` : ''}
    </div>
    ${flagged ? html`<span class="hint">${t('downtime.work.flagged')}</span>` : ''}
    <span class="hint">${t('downtime.work.how')}</span>
  </div>`;
}

/** The card on the Dossier. ctx: { joined (at the table as this character), crewVote(batch) → my vote } */
export function downtimeCard(c, s, data, ctx = {}) {
  const o = c.downtime?.open;
  if (!o || o.done) return '';
  if (!downtimePending(c, data)) { // owner 2026-11-16: settled — the receipt stays until they've read it
    return card(t('downtime.settledTitle', { name: o.durationName }), html`<div class="stack">
      ${receipt(c, data)}
      <div class="cluster"><button class="btn btn--primary" data-action="dtDone">✓ ${t('downtime.gotIt')}</button></div>
    </div>`, { ref: 'downtime' });
  }
  const upkeep = o.upkeep && !o.upkeepPaid ? html`<div class="stack">
    <span class="label">${t('downtime.upkeepTitle', { cr: o.upkeep.cr, crs: o.upkeep.crs })}</span>
    <div class="cluster">${upkeepWays(c, o.upkeep).map((w) => html`<button class="btn btn--sm" data-action="dtUpkeep" data-way="${w.id}" ${w.ok ? '' : raw('disabled')}>${wayLabel(w)}</button>`)}</div>
  </div>` : '';
  return card(t('downtime.settleTitle', { name: o.durationName }), html`<div class="stack">
    ${walletLine(c)}
    ${receipt(c, data)}
    ${openEntries(c).filter((e) => !e.chosen || (e.chosen.skills?.length && !e.chosen.roll) || e.chosen.owe).map((e) => entryBlock(e, c, s, data))}
    ${openCrew(c) ? crewBlock(openCrew(c), ctx.crewVote?.(openCrew(c).batch), Boolean(ctx.joined)) : ''}
    ${upkeep}
    ${workBlock(c, data)}
    <p class="hint">${t('downtime.settleHint')}</p>
  </div>`, { ref: 'downtime' });
}

export { wayLabel };
