// Decisions 243, 247: a puzzle the GM sends — what the players see. The GM console builds it (gm/puzzles/) and sends
// only this view (never the solution): the device's opening line, the picture (wire panel, keypad), what is at the lock,
// and — as the crew earns them — the clues the GM sends one by one, each with where it came from ("Access log: …").
// Every line is worded here, in the sheet's language, from its code ({ k, v, src } → t('puzzle.<kind>.<k>', v)).

import { html, raw } from './dom.js';
import { t, getLang } from '../i18n/index.js';

export const PUZZLE_COLORS = ['red', 'blue', 'yellow', 'green', 'white', 'black'];
const KINDS = ['wires', 'keypad', 'password', 'cipher', 'helpers'];
const str = (v, n = 40) => (typeof v === 'string' ? v.slice(0, n) : typeof v === 'number' && Number.isFinite(v) ? v : '');
const val = (v) => (v && typeof v === 'object' ? { en: str(v.en), it: str(v.it) } : str(v)); // a word in each language (the cipher's flagged word)
/** One clue, kept to what can be worded. */
export const cleanClue = (x) => (x && typeof x.k === 'string' && /^[a-zA-Z][a-zA-Z0-9]{0,19}$/.test(x.k)
  ? { k: x.k, v: Object.fromEntries(Object.entries(x.v ?? {}).slice(0, 6).map(([k, v]) => [k, val(v)])), src: /^[a-zA-Z]{1,16}$/.test(x.src ?? '') ? x.src : '' } : null);

/** A puzzle from a message, kept to what can be drawn and worded (or null). */
export function cleanPuzzle(p) {
  if (!p || !KINDS.includes(p.kind)) return null;
  const list = (l, n) => (Array.isArray(l) ? l.slice(0, n).map(cleanClue).filter(Boolean) : []);
  const base = { kind: p.kind, id: str(p.id, 60), open: cleanClue(p.open), lock: list(p.lock, 4), found: list(p.found, 12), warn: p.warn === true,
    names: (Array.isArray(p.names) ? p.names : []).slice(0, 3).map((n) => str(n, 16)) };
  const digits = (l) => (Array.isArray(l) ? l : []).filter((d) => Number.isInteger(d) && d >= 0 && d <= 9).slice(0, 10);
  if (p.kind === 'wires') {
    const wires = (Array.isArray(p.wires) ? p.wires : []).slice(0, 8).filter((w) => PUZZLE_COLORS.includes(w?.color)).map((w) => ({ color: w.color, stripe: PUZZLE_COLORS.includes(w.stripe) ? w.stripe : null }));
    return wires.length ? { ...base, wires } : null;
  }
  if (p.kind === 'keypad' || p.kind === 'helpers') return { ...base, worn: digits(p.worn) };
  if (p.kind === 'cipher') {
    const texts = Object.fromEntries(['en', 'it'].map((l) => [l, typeof p.texts?.[l] === 'string' ? p.texts[l].slice(0, 200) : '']));
    return texts.en ? { ...base, texts } : null;
  }
  return { ...base, who: str(p.who) };
}

const colorName = (c) => t(`puzzle.color.${c}`);
/** One clue in words, with where it came from: "Access log: the second digit isn't 4." */
export function clueLine(kind, { k, v, src }) {
  const vars = { ...v };
  if (vars.c) vars.c = colorName(vars.c);
  if (vars.animal) vars.animal = t(`puzzle.animal.${vars.animal}`);
  if (vars.role) vars.role = t(`puzzle.role.${vars.role}`);
  if (vars.word && typeof vars.word === 'object') vars.word = vars.word[getLang()] || vars.word.en;
  if (vars.n && (kind === 'keypad' || kind === 'helpers') && (k === 'pos' || k === 'notPos')) vars.n = t(`puzzle.ord.${vars.n}`);
  const book = kind === 'helpers' && !['honest', 'liar', 'open'].includes(k) ? 'keypad' : kind;
  const text = t(`puzzle.${book}.${k}`, vars);
  return src ? `${t(`puzzle.src.${src}`, { name: v.name ?? '' })}: ${text}` : text;
}

function wiresArt(p) {
  const W = 60; const top = 30; const bottom = 170;
  const width = p.wires.length * W + 40;
  return raw(`<svg class="pz-art pz-wires" viewBox="0 0 ${width} 210" role="img" aria-label="${t('puzzle.title.wires')}">
    <rect class="pz-casing" x="4" y="4" width="${width - 8}" height="202" rx="10"/>
    <rect class="pz-rail" x="16" y="${top - 12}" width="${width - 32}" height="12" rx="3"/><rect class="pz-rail" x="16" y="${bottom}" width="${width - 32}" height="12" rx="3"/>
    ${p.wires.map((w, i) => {
      const x = 40 + i * W;
      const path = `M${x} ${top} C ${x - 14} ${top + 50}, ${x + 14} ${bottom - 60}, ${x} ${bottom}`;
      return `<path class="pz-wire pz-c-${w.color}" d="${path}"/>${w.stripe ? `<path class="pz-stripe pz-c-${w.stripe}" d="${path}"/>` : ''}
        <circle class="pz-screw" cx="${x}" cy="${top - 6}" r="4"/><circle class="pz-screw" cx="${x}" cy="${bottom + 6}" r="4"/>
        <text class="pz-num" x="${x}" y="200" text-anchor="middle">${i + 1}</text>`;
    }).join('')}</svg>`);
}

function keypadArt(p) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];
  return raw(`<svg class="pz-art pz-keypad" viewBox="0 0 200 270" role="img" aria-label="${t('puzzle.title.keypad')}">
    <rect class="pz-casing" x="4" y="4" width="192" height="262" rx="14"/><rect class="pz-screen" x="22" y="18" width="156" height="34" rx="4"/>
    <text class="pz-screentext" x="100" y="40" text-anchor="middle">${'_ '.repeat(p.worn.length).trim()}</text>
    ${keys.map((k, i) => {
      const x = 22 + (i % 3) * 54; const y = 66 + Math.floor(i / 3) * 50;
      const worn = /\d/.test(k) && p.worn.includes(Number(k));
      return `<rect class="pz-key ${worn ? 'pz-key--worn' : ''}" x="${x}" y="${y}" width="46" height="42" rx="6"/><text class="pz-keylabel ${worn ? 'pz-keylabel--worn' : ''}" x="${x + 23}" y="${y + 28}" text-anchor="middle">${k}</text>`;
    }).join('')}</svg>`);
}

/** Decision 252: an old phone's keypad, letters on the keys (for phone-key messages). */
function phoneKeysArt() {
  const keys = [['1', ''], ['2', 'ABC'], ['3', 'DEF'], ['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO'], ['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ'], ['*', ''], ['0', '␣'], ['#', '']];
  return raw(`<svg class="pz-art pz-keypad" viewBox="0 0 200 230" role="img" aria-label="${t('puzzle.cipher.keypadArt')}">
    <rect class="pz-casing" x="4" y="4" width="192" height="222" rx="14"/>
    ${keys.map(([k, l], i) => { const x = 22 + (i % 3) * 54; const y = 18 + Math.floor(i / 3) * 52;
      return `<rect class="pz-key" x="${x}" y="${y}" width="46" height="44" rx="6"/><text class="pz-keylabel" x="${x + 23}" y="${y + 22}" text-anchor="middle">${k}</text><text class="pz-keysub" x="${x + 23}" y="${y + 37}" text-anchor="middle">${l}</text>`; }).join('')}</svg>`);
}
/** Decision 252: the keyword grid — 26 alphabets, each shifted one more (row = key letter, column = message letter). */
function squareArt() {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const row = (r) => `<tr><th>${A[r]}</th>${[...A].map((_, c) => `<td>${A[(r + c) % 26]}</td>`).join('')}</tr>`;
  return raw(`<div class="pz-square" role="img" aria-label="${t('puzzle.cipher.squareArt')}"><table><thead><tr><th></th>${[...A].map((c) => `<th>${c}</th>`).join('')}</tr></thead><tbody>${[...A].map((_, r) => row(r)).join('')}</tbody></table></div>`);
}

/** The puzzle as players see it: the opening line, the picture, what is at the lock, then what they've found. */
export function puzzleView(p) {
  if (!p) return '';
  const open = p.open ? t(`puzzle.${p.kind}.${p.open.k}`, { ...p.open.v, digits: (p.worn ?? []).join(' · '), who: p.who ?? '' }) : '';
  const art = p.kind === 'wires' ? wiresArt(p) : p.kind === 'keypad' || p.kind === 'helpers' ? keypadArt(p) : '';
  const note = p.kind === 'cipher' ? html`<p class="pz-cipher">${p.texts[getLang()] || p.texts.en}</p>` : '';
  // decision 252: the helper pictures arrive with the clue that names them
  const has = (k) => (p.found ?? []).some((x) => x.k === k);
  const aid = p.kind === 'cipher' ? (has('keypad') ? phoneKeysArt() : has('keyword') ? squareArt() : '') : '';
  return html`<div class="pz">
    <strong class="pz__title">🧩 ${t(`puzzle.title.${p.kind}`)}</strong>
    ${open ? html`<p class="pz__intro">${open}</p>` : ''}${art}${note}${aid}
    ${p.lock?.length ? html`<ul class="pz__lines pz__lines--lock">${p.lock.map((x) => html`<li>${clueLine(p.kind, x)}</li>`)}</ul>` : ''}
    ${p.warn ? html`<p class="pz__warn">⚠ ${t('puzzle.warn')}</p>` : ''}
    ${p.found?.length ? html`<span class="label">${t('puzzle.found')}</span><ol class="pz__lines">${p.found.map((x) => html`<li>${clueLine(p.kind, x)}</li>`)}</ol>`
      : html`<p class="muted st-small">${t('puzzle.nothingYet')}</p>`}</div>`;
}
