// Soft attention cues at the live table (decision 52): your turn starts, a GM message, you've been hit.
// Tones are generated in the browser (no audio files; works over the table's plain http). One switch per
// device (on by default). Browsers only allow sound after the first tap on the page, so the context is
// unlocked on the first pointerdown.

const KEY = 'fe.sound';
const VOLUME = 0.4; // peak gain: tablet and laptop speakers need it (0.07 was barely audible at full volume)

// [frequency Hz, start s, length s] per cue; wave shape per cue
const CUES = {
  // triangle carries better than a pure sine on small speakers; nothing below ~300 Hz (they can't play it)
  turn: { wave: 'triangle', notes: [[660, 0, 0.18], [880, 0.19, 0.26]], vibrate: [80, 60, 80] },
  message: { wave: 'triangle', notes: [[784, 0, 0.24]] },
  hit: { wave: 'triangle', notes: [[392, 0, 0.12], [311, 0.13, 0.24]] }, // falling: a hit
};

let ctx = null;
const audio = () => {
  if (!ctx) { const AC = window.AudioContext ?? window.webkitAudioContext; ctx = AC ? new AC() : null; }
  return ctx;
};
document.addEventListener('pointerdown', () => { if (soundOn()) audio()?.resume?.(); }, { once: true, capture: true });

export function soundOn() {
  try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; }
}
export function setSound(on) {
  try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* storage blocked: stays on for this page */ }
  if (on) cue('message');
}

/** Plays a cue: 'turn' · 'message' · 'hit'. Silent when switched off or not allowed yet. */
export function cue(name) {
  const c = CUES[name];
  if (!c || !soundOn()) return;
  if (c.vibrate) try { navigator.vibrate?.(c.vibrate); } catch { /* not supported */ }
  const ac = audio();
  if (!ac || ac.state === 'suspended') { ac?.resume?.(); if (!ac || ac.state === 'suspended') return; }
  const now = ac.currentTime;
  for (const [freq, start, length] of c.notes) {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = c.wave;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, now + start);
    gain.gain.linearRampToValueAtTime(VOLUME, now + start + 0.02); // soft attack, no click
    gain.gain.exponentialRampToValueAtTime(0.0001, now + start + length);
    osc.connect(gain).connect(ac.destination);
    osc.start(now + start);
    osc.stop(now + start + length + 0.05);
  }
}
