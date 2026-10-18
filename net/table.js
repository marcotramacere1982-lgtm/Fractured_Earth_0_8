// Player-side link to the GM's live table server. Only active when the app is served by that server
// (GitHub Pages builds simply never find /api/ping and keep working offline).

import { uid } from '../state/id.js';
import { t } from '../i18n/index.js';

const JOINED = 'fe.table.joined';
const SYNC_DELAY = 700;

const setPath = (obj, path, value) => {
  const keys = path.split('.');
  let o = obj;
  for (const k of keys.slice(0, -1)) o = o[k] ??= {};
  o[keys.at(-1)] = value;
};

/**
 * @param store  character store (state/store.js)
 * @param hooks  { toast(text, kind), log(character, text, kind), combat(id, combatState), progress(id, msg) → summary }
 */
export function createTableLink(store, hooks) {
  const state = { available: false, joinedId: null, online: false, difficulty: null, combat: null };
  const listeners = new Set();
  const handled = new Set(); // message ids already applied (the server re-sends until acknowledged)
  let source = null;
  let timer = null;
  let unsubscribe = null;

  const emit = () => listeners.forEach((fn) => fn(state));

  async function push() {
    const character = store.get(state.joinedId);
    if (!character) return;
    try {
      await fetch('/api/table/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ character }) });
    } catch { /* server gone: EventSource reconnect will re-sync */ }
  }
  const schedule = () => { clearTimeout(timer); timer = setTimeout(push, SYNC_DELAY); };

  const ack = (id, mid) => fetch('/api/table/ack', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, mids: [mid] }) })
    .catch(() => { /* not confirmed: the server re-sends on reconnect and `handled` drops the copy */ });

  function onMessage(msg) {
    const id = state.joinedId;
    if (msg.mid) {
      if (handled.has(msg.mid)) { ack(id, msg.mid); return; }
      handled.add(msg.mid);
    }
    apply(id, msg);
    if (msg.mid) ack(id, msg.mid);
  }

  function apply(id, msg) {
    switch (msg.type) {
      case 'message':
        store.update(id, (c) => {
          const mid = msg.mid ?? uid();
          if ((c.play.inbox ?? []).some((m) => m.id === mid)) return;
          c.play.inbox = [{ id: mid, t: Date.now(), text: msg.text ?? '', private: Boolean(msg.private), tone: msg.tone === 'hit' ? 'hit' : null,
            image: typeof msg.image === 'string' && msg.image.startsWith('/api/table/handout?') ? msg.image : null }, ...(c.play.inbox ?? [])].slice(0, 20);
          hooks.log(c, `${msg.tone === 'hit' ? 'HIT' : msg.private ? 'GM (private)' : 'GM'}: ${[msg.text, msg.image ? '[image]' : ''].filter(Boolean).join(' ')}`, msg.tone === 'hit' ? 'bad' : 'warn');
        });
        break;
      case 'difficulty':
        if ((msg.tier ?? null) === state.difficulty) break; // replayed on reconnect: nothing new
        state.difficulty = msg.tier ?? null;
        hooks.toast(msg.tier == null ? t('table.difficultyCleared') : t('table.difficultySet', { tier: msg.label ?? msg.tier }));
        emit();
        break;
      case 'restore':
        store.update(id, (c) => {
          for (const [path, value] of Object.entries(msg.values ?? {})) setPath(c, path, value);
          hooks.log(c, `GM restored: ${Object.keys(msg.values ?? {}).join(', ')}`, 'bad');
        });
        hooks.toast(t('table.restored'), 'danger');
        break;
      case 'combat':
        state.combat = msg.active ? msg : null;
        if (id) hooks.combat?.(id, msg);
        emit();
        break;
      case 'progress': { // XP, a gifted talent, level-up opened / closed (decision 44)
        const out = id ? hooks.progress?.(id, msg) : null;
        if (out?.levelUp) hooks.toast(t('progress.levelUpToast'), 'success');
        else if (out?.xp) hooks.toast(t('progress.xpToast', { n: out.xp }), 'success');
        if (out?.gift) hooks.toast(t('progress.giftToast', { name: out.gift }), 'success');
        if (out?.open) hooks.toast(t('progress.openToast'), 'success');
        break;
      }
      case 'downtime': // the GM's downtime report (decision 46)
        if (id && hooks.downtime?.(id, msg)) hooks.toast(t('downtime.toast'), 'success');
        break;
      case 'request-sync':
        push();
        break;
      default:
        break;
    }
  }

  function connect(id) {
    source?.close();
    source = new EventSource(`/api/table/events?id=${encodeURIComponent(id)}`);
    source.onopen = () => { state.online = true; emit(); push(); };
    source.onerror = () => { state.online = false; emit(); };
    source.onmessage = (e) => { try { onMessage(JSON.parse(e.data)); } catch { /* ignore malformed */ } };
  }

  return {
    state,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },

    async detect() {
      // the table server marks the page it serves; static hosts (GitHub Pages) skip the probe entirely
      if (!document.querySelector('meta[name="fe-table"]')) { emit(); return false; }
      try {
        const ctrl = new AbortController();
        setTimeout(() => ctrl.abort(), 1500);
        const res = await fetch('/api/ping', { signal: ctrl.signal, cache: 'no-store' });
        state.available = res.ok && (await res.json()).app === 'fractured-earth-table';
      } catch {
        state.available = false;
      }
      if (state.available) {
        const remembered = sessionStorage.getItem(JOINED);
        if (remembered && store.get(remembered)) this.join(remembered);
      }
      emit();
      return state.available;
    },

    join(id) {
      if (!state.available || !store.get(id)) return;
      state.joinedId = id;
      try { sessionStorage.setItem(JOINED, id); } catch { /* private mode */ }
      connect(id);
      unsubscribe?.();
      unsubscribe = store.subscribe((change) => { if (change.id === id) schedule(); });
      emit();
    },

    leave() {
      source?.close();
      source = null;
      unsubscribe?.();
      unsubscribe = null;
      state.joinedId = null;
      state.online = false;
      state.difficulty = null;
      state.combat = null;
      try { sessionStorage.removeItem(JOINED); } catch { /* private mode */ }
      emit();
    },
  };
}
