// Sounds on the sheet. Decision 52 began it with three soft attention cues (your turn, a GM message, a hit);
// decision 314 widens it to short feedback for what you just did — every sound answers something that happened to
// you or the table, never decoration. The sounds are files (app/data/sounds.json → app/sounds/<id>.wav, made by
// tools/sounds.mjs); if one can't load, the old generated tone stands in. Per device: 🔔 switches everything,
// the Display menu sets the volume and whether interface sounds play (alerts always do while 🔔 is on).
// Browsers only allow sound after the first tap on the page, so the audio unlocks on the first pointerdown.

const KEY = 'fe.sound'; // 'off' = silent
const FEEDBACK_KEY = 'fe.sound.feedback'; // 'off' = alerts only
const VOLUME_KEY = 'fe.sound.volume'; // 0–1
const TONE = 0.4; // the generated tones' peak gain

// the generated fallback: [frequency Hz, start s, length s] per cue
const TONES = {
  turn: { wave: 'triangle', notes: [[660, 0, 0.18], [880, 0.19, 0.26]] },
  message: { wave: 'triangle', notes: [[784, 0, 0.24]] },
  hit: { wave: 'triangle', notes: [[392, 0, 0.12], [311, 0.13, 0.24]] },
};
const VIBRATE = { turn: [80, 60, 80] };

const read = (k, fallback) => { try { return localStorage.getItem(k) ?? fallback; } catch { return fallback; } };
const write = (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage blocked: this page only */ } };

let ctx = null;
const audio = () => {
  if (!ctx) { const AC = window.AudioContext ?? window.webkitAudioContext; ctx = AC ? new AC() : null; }
  return ctx;
};

// the cue list and the decoded files, loaded once after the first tap
let cues = null; // { id: { group, gain } }
const buffers = new Map(); // id → AudioBuffer | null (failed)
async function load() {
  if (cues) return;
  cues = {};
  try {
    const list = (await (await fetch(new URL('../data/sounds.json', import.meta.url))).json()).cues ?? [];
    for (const c of list) cues[c.id] = { group: c.group, gain: Number(c.gain) || 0.6 };
    const ac = audio();
    await Promise.all(list.map(async (c) => {
      try {
        const bytes = await (await fetch(new URL(`../sounds/${c.id}.wav`, import.meta.url))).arrayBuffer();
        buffers.set(c.id, await new Promise((ok, ko) => ac.decodeAudioData(bytes, ok, ko))); // callback form: older Safari
      } catch { buffers.set(c.id, null); }
    }));
  } catch { /* no list: the tones still work */ }
}
if (typeof document !== 'undefined') document.addEventListener('pointerdown', () => { if (soundOn()) { audio()?.resume?.(); load(); } }, { once: true, capture: true }); // not in Node (tests import the sheet's modules)

export const soundOn = () => read(KEY, 'on') !== 'off';
export const feedbackOn = () => read(FEEDBACK_KEY, 'on') !== 'off';
export const volume = () => { const v = Number(read(VOLUME_KEY, '0.8')); return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.8; };
export function setSound(on) { write(KEY, on ? 'on' : 'off'); if (on) { load(); cue('message'); } }
export function setFeedback(on) { write(FEEDBACK_KEY, on ? 'on' : 'off'); if (on) cue('done'); }
export function setVolume(v) { write(VOLUME_KEY, String(Math.max(0, Math.min(1, Number(v) || 0)))); cue('toggle'); }

function tone(name, ac, level) {
  const c = TONES[name];
  if (!c) return;
  const now = ac.currentTime;
  for (const [freq, start, length] of c.notes) {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = c.wave;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, now + start);
    gain.gain.linearRampToValueAtTime(TONE * level, now + start + 0.02); // soft attack, no click
    gain.gain.exponentialRampToValueAtTime(0.0001, now + start + length);
    osc.connect(gain).connect(ac.destination);
    osc.start(now + start);
    osc.stop(now + start + length + 0.05);
  }
}

/**
 * Plays a sound: alerts 'turn' · 'message' · 'hit' · 'spotted'; feedback 'toggle' · 'done' · 'refused' · 'success' ·
 * 'fail' · 'crit' · 'fumble' · 'cash' · 'item' · 'dice'. Silent when switched off, not allowed yet, or unknown.
 */
export function cue(name) {
  if (!soundOn()) return;
  const meta = cues?.[name];
  if (meta?.group === 'feedback' && !feedbackOn()) return;
  if (VIBRATE[name]) try { navigator.vibrate?.(VIBRATE[name]); } catch { /* not supported */ }
  const ac = audio();
  if (!ac) return;
  if (ac.state === 'suspended') { ac.resume?.(); if (ac.state === 'suspended') return; }
  if (!cues) load();
  const level = volume();
  const buf = buffers.get(name);
  if (!buf) { tone(name, ac, level); return; } // not loaded (yet) or failed: the generated tone, if this cue has one
  const src = ac.createBufferSource();
  const gain = ac.createGain();
  src.buffer = buf;
  gain.gain.value = (meta?.gain ?? 0.6) * level;
  src.connect(gain).connect(ac.destination);
  src.start();
}

/** The Display menu's sound rows (player app only) — wired once by installSoundControls(). */
export function installSoundControls() {
  document.addEventListener('change', (e) => {
    const el = e.target;
    if (el.matches?.('[data-ui-sound-volume]')) setVolume(Number(el.value) / 100);
    else if (el.matches?.('[data-ui-sound-feedback]')) setFeedback(el.checked);
  });
}
