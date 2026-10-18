// Downtime (decision 46): what a character's story looks like to the event matcher, how well each
// event fits (a confidence score 0–100 with reasons), the debt pressure track, and upkeep for the period.
// Pure: character + data (+ the GM's event library) in, numbers and codes out. Nothing here is applied.

import { lifestyleUpkeep } from './economy.js';

const D = (data) => data.downtime;
export const emptyDowntime = () => ({ pressure: 0, timeline: [], seen: [] });

/** Debt stage a downtime brings: pressure rises by 1 (max 3). */
export const nextPressure = (c, data) => Math.min(D(data).debt.max, (c.downtime?.pressure ?? 0) + 1);
export const stageOf = (pressure, data) => D(data).debt.stages.find((s) => s.id === pressure) ?? null;

/** Upkeep for the period (shown, never charged): monthly lifestyle × months. */
export function upkeepFor(c, data, durationId) {
  const d = D(data).durations.find((x) => x.id === durationId) ?? D(data).durations[0];
  const u = lifestyleUpkeep(c.play.lifestyle ?? [], data);
  return { months: d.months, cr: Math.round(u.cr * d.months), crs: Math.round(u.crs * d.months), injuries: d.injuries };
}

/** The tags the matcher reads from a sheet. */
export function storyProfile(c, data) {
  const careers = (c.history?.careers ?? []).map((h, i, all) => {
    const k = data.careers.careers.find((x) => x.id === h.careerId);
    return k ? { category: k.category, track: k.id, recent: i === all.length - 1 } : null;
  }).filter(Boolean);
  const life = new Set([
    ...(c.history?.adolescence ?? []).map((h) => h.eventId),
    ...(c.history?.careers ?? []).flatMap((h) => (h.events ?? []).map((e) => e.eventId)),
  ]);
  const st = D(data).state;
  const monthly = lifestyleUpkeep(c.play.lifestyle ?? [], data).cr;
  const housing = (c.play.lifestyle ?? []).map((id) => data.lifestyle.entries.find((x) => x.id === id)).find((x) => x?.category === 'housing');
  const state = new Set([
    ...(c.play.cash < monthly ? ['broke'] : []),
    ...(c.play.cash >= st.flushCash ? ['flush'] : []),
    ...(c.attributes.CRS <= st.lowCrs ? ['lowCrs'] : []),
    ...(c.attributes.CRS >= st.highCrs ? ['highCrs'] : []),
    ...((c.play.injuries ?? []).length ? ['injured'] : []),
    ...(housing?.tier === 1 ? ['lowHousing'] : []),
    ...(c.age >= st.olderAge ? ['older'] : []),
  ]);
  const recent = (c.downtime?.timeline ?? []).slice(-D(data).match.recentWindow).map((x) => x.id);
  return { debtId: c.debtId ?? null, stage: nextPressure(c, data), careers, life, record: Boolean(c.criminalRecord), state, recent: new Set(recent) };
}

/**
 * How well one event fits a profile: { score 0–100, reasons: [{ code, vars }] }.
 * codes: debt · life · state · career · track · recent · world · used
 */
export function scoreEvent(event, profile, data) {
  const w = D(data).match;
  const m = event.match ?? {};
  let score = 0;
  const reasons = [];
  if (m.debt) {
    if (m.debt === profile.debtId && m.stage === profile.stage) { score = w.debt; reasons.push({ code: 'debt', vars: { stage: m.stage } }); }
  } else if (m.life) {
    const hit = m.life.filter((id) => profile.life.has(id));
    if (hit.length) { score = w.life; reasons.push({ code: 'life', vars: { events: hit } }); }
  } else if (m.state) {
    if (profile.state.has(m.state)) { score = w.state; reasons.push({ code: 'state', vars: { state: m.state } }); }
  } else if (m.careerCategory) {
    const own = profile.careers.filter((k) => k.category === m.careerCategory);
    if (own.length) {
      score = w.career;
      reasons.push({ code: 'career', vars: { category: m.careerCategory } });
      if (m.track && own.some((k) => k.track === m.track)) { score += w.careerTrack; reasons.push({ code: 'track', vars: { track: m.track } }); }
      if (own.some((k) => k.recent)) { score += w.careerRecent; reasons.push({ code: 'recent', vars: {} }); }
    }
  } else if (m.world) {
    score = w.world;
    reasons.push({ code: 'world', vars: {} });
  }
  if (score && profile.recent.has(event.id)) { score = Math.round(score * w.recentlyUsed); reasons.push({ code: 'used', vars: {} }); }
  return { score: Math.min(100, score), reasons };
}

/** The best personal events for a character (crew events are offered separately, once for the group). */
export function suggestEvents(events, c, data, n = D(data).match.suggestions) {
  const profile = storyProfile(c, data);
  return events.filter((e) => e.group !== 'crew')
    .map((e) => ({ event: e, ...scoreEvent(e, profile, data) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.event.id.localeCompare(b.event.id))
    .slice(0, n);
}
