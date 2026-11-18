// Decision 314: the rolling dice — for suspense, never for information. The roll is made first; the dice only perform
// it (under a second, tap to skip), then land on the real numbers and the result shows as before. A check's d20 sits
// beside its numbers; decision 315 adds initiative (the ask card, Prepare) and damage (a tray of the real dice, each
// in its own shape). Off per device (Display menu) and for anyone whose tablet asks for reduced motion.

import { html, render } from './dom.js';
import { t } from '../i18n/index.js';
import { cue } from './sound.js';

const KEY = 'fe.dice'; // 'off' = no tumble
export const TUMBLE_MS = 850;
const FLICKER_MS = 70;
const TRAY_MAX = 8; // more dice than this: the first 8 and "+n"

export const diceOn = () => { try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; } };
export const setDice = (on) => { try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* this page only */ } };
const reduced = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
/** Whether a roll should tumble on this device. */
export const tumbles = () => diceOn() && !reduced();

// each die its shape: outline, inner edges (the d20 only), where the number sits
const SHAPES = {
  4: { body: '50,8 94,88 6,88', y: 64 },
  6: { body: '14,14 86,14 86,86 14,86', y: 52 },
  8: { body: '50,4 94,50 50,96 6,50', y: 52 },
  10: { body: '50,4 92,44 50,96 8,44', y: 48 },
  12: { body: '50,5 95,38 78,92 22,92 5,38', y: 56 },
  20: { body: '50,4 90,27 90,73 50,96 10,73 10,27', y: 53, edges: 'M50 22 L80 68 L20 68 Z M50 4 L50 22 M90 27 L50 22 M90 27 L80 68 M90 73 L80 68 M50 96 L80 68 M50 96 L20 68 M10 73 L20 68 M10 27 L20 68 M10 27 L50 22' },
};
const shape = (sides) => SHAPES[sides] ?? SHAPES[20];
const svg = (face, sides) => {
  const s = shape(sides);
  return html`<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <polygon class="die__body" points="${s.body}"/>${s.edges ? html`<path class="die__edge" d="${s.edges}"/>` : ''}
      <text class="die__face" x="50" y="${s.y}" text-anchor="middle" dominant-baseline="middle" data-die-face data-sides="${sides}">${face ?? ''}</text></svg>`;
};

/**
 * One die: face = the number to show (null: blank, waiting); state 'idle' | 'rolling' | 'success' | 'failure' |
 * 'landed'. Rolling, it's a button: a tap lands it at once (data-action="dieSkip").
 */
export function dieView(face, state = 'idle', sides = 20) {
  return state === 'rolling'
    ? html`<button type="button" class="die die--rolling" data-action="dieSkip" aria-label="${t('dice.skip')}">${svg(face, sides)}</button>`
    : html`<span class="die die--${state}" role="img" aria-label="${face ? t('dice.face', { n: face }) : t('dice.idle')}">${svg(face, sides)}</span>`;
}

/**
 * Decision 315: a tray of the dice really rolled — groups [{ sides, rolls: [n…] }] (from rules/dice.js → roll).
 * Rolling: the whole tray is one button (tap lands it, data-action="dieSkip"). Small dice; more than TRAY_MAX: "+n".
 */
export function diceTray(groups, rolling = false) {
  const dice = groups.flatMap((g) => g.rolls.map((v) => ({ sides: g.sides, v })));
  const shown = dice.slice(0, TRAY_MAX);
  const more = dice.length - shown.length;
  const inner = html`${shown.map((d) => html`<span class="die die--small ${rolling ? 'die--rolling' : 'die--landed'}">${svg(rolling ? '' : d.v, d.sides)}</span>`)}${more > 0 ? html`<span class="dice-tray__more mono">+${more}</span>` : ''}`;
  return rolling
    ? html`<button type="button" class="dice-tray" data-action="dieSkip" aria-label="${t('dice.skip')}">${inner}</button>`
    : html`<div class="dice-tray" role="img" aria-label="${dice.map((d) => d.v).join(', ')}">${inner}</div>`;
}

/** While dice tumble: a random face on each (within its own sides) every few frames, straight into the DOM. */
export function flicker(root) {
  const id = setInterval(() => {
    for (const el of root.querySelectorAll('.die--rolling [data-die-face]')) el.textContent = String(1 + Math.floor(Math.random() * (Number(el.dataset.sides) || 20)));
  }, FLICKER_MS);
  return () => clearInterval(id);
}

/**
 * Decision 315: a die rolled outside a dialog (initiative): it tumbles inside `slot`, then lands on `face` (state
 * 'landed'); resolves when it lands. A tap on the slot lands it early. No tumbling on this device: lands at once.
 */
export function tumbleIn(slot, face, sides = 20) {
  return new Promise((done) => {
    if (!slot || !tumbles()) { if (slot) render(slot, dieView(face, 'landed', sides)); done(); return; }
    render(slot, dieView('', 'rolling', sides));
    cue('dice');
    const stop = flicker(slot);
    let landed = false;
    const land = () => {
      if (landed) return;
      landed = true;
      stop();
      clearTimeout(timer);
      slot.removeEventListener('click', land);
      if (slot.isConnected) render(slot, dieView(face, 'landed', sides));
      done();
    };
    const timer = setTimeout(land, TUMBLE_MS);
    slot.addEventListener('click', land);
  });
}

/** The Display menu's row (player app only); installDiceControls() wires it once. */
export const diceRow = () => html`<label class="display-menu__check"><input type="checkbox" data-ui-dice ${diceOn() ? 'checked' : ''}><span>${t('display.dice')}</span></label>`;
export function installDiceControls() {
  document.addEventListener('change', (e) => { if (e.target.matches?.('[data-ui-dice]')) setDice(e.target.checked); });
}
