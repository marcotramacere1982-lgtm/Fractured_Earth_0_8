// Character store: in-memory state + localStorage autosave + JSON import/export.
// The UI never mutates characters directly; it calls update(id, fn).

import { importCharacter } from './migrate.js';
import { upgradeSave } from './character.js';
import { uid } from './id.js';

const KEY = 'fe.characters.v1';
const ACTIVE = 'fe.active';

const safe = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } },
};

/** data: game tables, for save upgrades that need them (spare magazines, decision 55). */
export function createStore({ data = null } = {}) {
  let characters = {};
  try { characters = JSON.parse(safe.get(KEY) ?? '{}'); } catch { characters = {}; }
  for (const c of Object.values(characters)) upgradeSave(c, data);
  let activeId = safe.get(ACTIVE);
  const listeners = new Set();
  let saveTimer = null;
  let lastSaveOk = true;

  const persist = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      lastSaveOk = safe.set(KEY, JSON.stringify(characters));
      if (activeId) safe.set(ACTIVE, activeId);
    }, 250);
  };
  const emit = (change) => listeners.forEach((fn) => fn(change));

  return {
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    list: () => Object.values(characters).sort((a, b) => a.name.localeCompare(b.name)),
    get: (id) => characters[id] ?? null,
    get active() { return characters[activeId] ?? null; },
    get saveOk() { return lastSaveOk; },

    setActive(id) { activeId = id; safe.set(ACTIVE, id); emit({ type: 'active', id }); },

    add(character) {
      characters[character.id] = character;
      persist();
      emit({ type: 'add', id: character.id });
      return character.id;
    },

    /** fn receives a draft clone and may mutate it or return a new object. `silent` skips re-render. */
    update(id, fn, { silent = false } = {}) {
      const current = characters[id];
      if (!current) return;
      const draft = structuredClone(current);
      characters[id] = fn(draft) ?? draft;
      persist();
      emit({ type: 'update', id, silent });
    },

    remove(id) {
      delete characters[id];
      if (activeId === id) activeId = null;
      persist();
      emit({ type: 'remove', id });
    },

    /** Parses a file (v1 or legacy) and adds it. Returns { id, warnings }. */
    async importFile(file, data) {
      const json = JSON.parse(await file.text());
      const { character, warnings } = importCharacter(json, data);
      if (characters[character.id]) character.id = uid();
      return { id: this.add(character), warnings };
    },
  };
}

export function exportCharacter(character) {
  const blob = new Blob([JSON.stringify(character, null, 2)], { type: 'application/json' });
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  const name = `${character.player || 'player'}_${character.name || 'character'}`.replace(/[^\w-]+/g, '_');
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `FE_${name}_${stamp}.json` });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Downscales an image file to a small WebP data URL so saves stay light. */
export async function shrinkImage(file, maxSize = 600, quality = 0.82) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const canvas = Object.assign(document.createElement('canvas'), {
    width: Math.round(bitmap.width * scale),
    height: Math.round(bitmap.height * scale),
  });
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/webp', quality);
}
