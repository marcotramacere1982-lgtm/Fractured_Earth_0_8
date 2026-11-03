// The table strip (decision 237): what the GM sets for the scene, narrative only — the date and time, the weather, the
// temperature, the hazards — plus a running timer and the round countdowns the GM shows. Drawn above the sheet's
// header while this character plays at the table; nothing in the rules reads it. The timer's seconds tick here.

import { html, raw } from '../dom.js';
import { t, tn } from '../../i18n/index.js';

const ico = (data, id) => (data.icons[id] ? html`<span class="ico" aria-hidden="true">${raw(data.icons[id])}</span>` : '');
const mmss = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

/** The timer's time left now (ms), on this device's clock (skew: this clock − the server's, when the timer arrived). */
export const timerLeft = (timer) => (timer?.state === 'running' ? (timer.endsAt ?? 0) - (Date.now() - (timer.skew ?? 0)) : timer?.state === 'paused' ? timer.leftMs ?? 0 : 0);

/** env: the table's environment (or null) · timer: the table's timer, if it's for this character · countdowns: from the fight. */
export function tableStrip(data, { env = null, timer = null, countdowns = [] } = {}) {
  const weather = env?.weather && data.environment.weather.find((w) => w.id === env.weather);
  const hazards = (env?.hazards ?? []).map((id) => data.environment.hazards.find((h) => h.id === id)).filter(Boolean);
  const when = [env?.date, env?.time].filter(Boolean).join(' · ');
  const temp = env?.temp != null && env.temp !== '' ? `${env.temp} °C` : '';
  const parts = [
    when ? html`<span class="strip__item">${ico(data, 'calendar')}${when}</span>` : '',
    weather ? html`<span class="strip__item" title="${weather.name}">${ico(data, `env_${weather.id}`)}<span class="strip__word">${weather.name}</span></span>` : '',
    temp ? html`<span class="strip__item mono">${temp}</span>` : '',
    hazards.length ? html`<span class="strip__item strip__hazards">${hazards.map((h) => html`<span class="strip__hazard" title="${h.name}">${ico(data, `haz_${h.id}`)}<span class="strip__word">${h.name}</span></span>`)}</span>` : '',
    timer && timer.state !== 'off' ? html`<span class="strip__item strip__timer ${timer.state === 'done' || (timer.state === 'running' && timerLeft(timer) <= 0) ? 'is-up' : ''}">${ico(data, 'timer')}<strong>${timer.label}</strong>
      <span class="mono strip__left" ${timer.state === 'running' ? raw(`data-ends="${timer.endsAt}" data-skew="${timer.skew ?? 0}"`) : ''}>${timer.state === 'done' ? t('strip.timeUp') : mmss(timerLeft(timer))}</span>${timer.state === 'paused' ? html`<span class="muted">${t('strip.paused')}</span>` : ''}</span>` : '',
    ...countdowns.map((c) => html`<span class="strip__item strip__countdown">${ico(data, 'countdown')}${tn('strip.rounds', c.left)} — <strong>${c.label}</strong></span>`),
  ].filter(Boolean);
  return parts.length ? html`<div class="strip" role="status" aria-label="${t('strip.label')}">${parts}</div>` : '';
}

// the seconds tick without redrawing the sheet (a running timer's own text only)
let ticking = false;
export function startStripClock() {
  if (ticking) return;
  ticking = true;
  setInterval(() => {
    for (const el of document.querySelectorAll('.strip__left[data-ends]')) {
      const left = Number(el.dataset.ends) - (Date.now() - Number(el.dataset.skew || 0));
      el.textContent = left > 0 ? mmss(left) : t('strip.timeUp');
      el.closest('.strip__timer')?.classList.toggle('is-up', left <= 0);
    }
  }, 1000);
}
