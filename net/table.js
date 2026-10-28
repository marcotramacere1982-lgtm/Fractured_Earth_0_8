// Player-side link to the GM's live table server. Only active when the app is served by that server
// (GitHub Pages builds simply never find /api/ping and keep working offline).

import { uid } from '../state/id.js';
import { t } from '../i18n/index.js';

const JOINED = 'fe.table.joined';
const TURN_CUE = 'fe.table.turnCue'; // last turn chimed (combat:round), so a reload or reconnect doesn't chime again
const MAP_CUE = 'fe.table.mapCue'; // last table map announced, so a reconnect doesn't announce it again
const SYNC_DELAY = 700;

const setPath = (obj, path, value) => {
  const keys = path.split('.');
  let o = obj;
  for (const k of keys.slice(0, -1)) o = o[k] ??= {};
  o[keys.at(-1)] = value;
};

/**
 * @param store  character store (state/store.js)
 * @param hooks  { toast(text, kind), log(character, text, kind), combat(id, combatState), progress(id, msg) → summary,
 *                 notify(cue): 'turn' · 'message' · 'hit' (decision 52: soft sounds) }
 */
export function createTableLink(store, hooks) {
  // crew: the shared trust track; unity: the open Unity Check; myVotes: this sheet's ballot per check (decision 47)
  // map: the table map the GM is showing (decision 64), already filtered by the server-side public view
  // light: the GM's table-wide switch, true = dark (decision 76)
  const state = { available: false, joinedId: null, online: false, difficulty: null, combat: null, crew: null, unity: null, map: null, light: false, myVotes: {}, marks: null, stashes: [] }; // marks: { map, list, skew } (decision 82; skew = this clock − the server's)
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
        hooks.notify?.(msg.tone === 'hit' ? 'hit' : 'message');
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
          hooks.log(c, msg.portrait ? 'New portrait from the GM' : msg.owner ? `Player: ${msg.values?.player} (set by the GM)` : msg.undo ? `↶ Undo by the GM (${String(msg.undo).slice(0, 120)})` : `GM restored: ${Object.keys(msg.values ?? {}).join(', ')}`, msg.portrait ? 'info' : msg.undo || msg.owner ? 'warn' : 'bad');
        });
        if (msg.portrait) hooks.toast(t('table.portrait'), 'success'); // decision 95: a gift, not an alarm
        else if (!msg.owner) hooks.toast(msg.undo ? t('table.undone') : t('table.restored'), msg.undo ? 'success' : 'danger'); // decision 87: a new owner is not an alarm
        hooks.notify?.('message');
        break;
      case 'combat': {
        // your turn starts: one soft chime per turn (Delay can bring you back the same round: no second chime)
        const mark = `${msg.id}:${msg.round}`;
        if (msg.active && id && msg.current === id) {
          let last = null;
          try { last = sessionStorage.getItem(TURN_CUE); sessionStorage.setItem(TURN_CUE, mark); } catch { /* private mode */ }
          if (last !== mark) hooks.notify?.('turn');
        }
        state.combat = msg.active ? msg : null;
        if (id) hooks.combat?.(id, msg);
        emit();
        break;
      }
      case 'progress': { // XP, a gifted talent, level-up opened / closed (decision 44)
        const out = id ? hooks.progress?.(id, msg) : null;
        if (out?.levelUp) hooks.toast(t('progress.levelUpToast'), 'success');
        else if (out?.xp) hooks.toast(t('progress.xpToast', { n: out.xp }), 'success');
        if (out?.gift) hooks.toast(t('progress.giftToast', { name: out.gift }), 'success');
        if (out?.open) hooks.toast(t('progress.openToast'), 'success');
        if (out?.refill) hooks.toast(t('progress.refillToast'), 'success');
        if (out) hooks.notify?.('message');
        break;
      }
      case 'gift': { // another player handed you something (decision 55)
        const name = id ? hooks.gift?.(id, msg) : null;
        if (name) { hooks.toast(t('trade.received', { item: name, from: msg.fromName ?? '' }), 'success'); hooks.notify?.('message'); }
        break;
      }
      case 'boon': // an ally's ability for you: Apply on the Play tab (decision 155)
        if (id && hooks.boon?.(id, msg)) { hooks.toast(t('boon.toast', { from: msg.fromName ?? '', ability: msg.ability ?? '' }), 'success'); hooks.notify?.('message'); }
        break;
      case 'hit': // an enemy hit you: Apply or Dodge on the Play tab (decision 154)
        if (id && hooks.hit?.(id, msg)) { hooks.toast(t('hit.toast', { from: msg.from ?? '' }), 'danger'); hooks.notify?.('hit'); }
        break;
      case 'ask': // the GM asks for a skill or attribute roll (decision 165)
        if (id && hooks.ask?.(id, msg)) { hooks.toast(t('ask.toast'), 'success'); hooks.notify?.('message'); }
        break;
      case 'scene': // the GM starts a new scene (decision 180)
        if (id && hooks.scene?.(id, msg)) hooks.toast(t('scene.toast'), 'success');
        break;
      case 'ping': // what your ping found, from the GM's console (decision 170)
        if (id && hooks.ping?.(id, msg)) { hooks.toast(t(msg.wipe ? 'ping.wiped' : msg.ok ? 'ping.toast' : 'ping.nothing'), msg.ok || msg.wipe ? 'success' : 'danger'); hooks.notify?.('message'); }
        break;
      case 'initiative': // the GM asks for your initiative roll (decision 148)
        if (id && hooks.initiative?.(id, msg)) { hooks.toast(t('init.toast'), 'success'); hooks.notify?.('message'); }
        break;
      case 'deal': // a fixer's offer from the GM (decision 143)
        if (id && hooks.deal?.(id, msg)) { hooks.toast(t('washer.toast'), 'success'); hooks.notify?.('message'); }
        break;
      case 'backstory': // written by the GM's Claude (decision 50)
        if (id && hooks.backstory?.(id, msg)) { hooks.toast(t('table.backstoryToast'), 'success'); hooks.notify?.('message'); }
        break;
      case 'downtime': // the GM's downtime report (decision 46)
        if (id && hooks.downtime?.(id, msg)) { hooks.toast(t('downtime.toast'), 'success'); hooks.notify?.('message'); }
        break;
      case 'stashes': // the crew's shared stashes (decision 145)
        state.stashes = Array.isArray(msg.list) ? msg.list : [];
        emit();
        break;
      case 'crew':
        state.crew = { value: msg.value, band: msg.band };
        emit();
        break;
      case 'unity':
        state.unity = msg.closed ? null : msg;
        emit();
        break;
      case 'light':
        state.light = msg.dark === true;
        emit();
        break;
      case 'map': {
        state.map = msg.closed ? null : msg;
        if (id && state.map) hooks.map?.(id, msg); // decision 122: the sheet remembers what it saw
        let last = null;
        try { last = sessionStorage.getItem(MAP_CUE); if (state.map) sessionStorage.setItem(MAP_CUE, msg.id); } catch { /* private mode */ }
        if (state.map && last !== msg.id) hooks.toast(t('map.toast', { name: msg.name }), 'success');
        emit();
        break;
      }
      case 'marks':
        state.marks = { map: msg.map, list: msg.list ?? [], skew: Date.now() - (msg.now ?? Date.now()) };
        emit();
        break;
      case 'leave': // decision 160: the same player took a seat with another character
        hooks.toast(t('table.steppedAside', { name: msg.by ?? '' }), 'danger');
        link.leave();
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

  const link = {
    state,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },

    /**
     * Ask the GM for a backstory (decision 50). Works before joining (the builder): the answer waits in the
     * server's mailbox for this character id. @returns true when the server took it.
     */
    async askBackstory(request) {
      try {
        const res = await fetch('/api/table/backstory', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) });
        return res.ok;
      } catch { return false; }
    },

    /** Characters at the table (to hand them items). [] when not at a table. */
    async players() {
      try { return (await (await fetch('/api/table/players', { cache: 'no-store' })).json()).players ?? []; } catch { return []; }
    },
    /** Asks to move this sheet's marker on the table map (decision 64, step 3); the GM console decides. */
    async move(mapId, to) {
      if (!state.joinedId) return false;
      try {
        const res = await fetch('/api/table/move', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: state.joinedId, map: mapId, to }) });
        return res.ok;
      } catch { return false; }
    },
    /** A flare was used (decision 75): the GM console drops a light on this sheet's marker. */
    async flare(mapId) {
      if (!state.joinedId) return false;
      try {
        const res = await fetch('/api/table/flare', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: state.joinedId, map: mapId }) });
        return res.ok;
      } catch { return false; }
    },
    /** Marks on the table map (decision 82): draw one ({ mark }), remove your own ({ remove: id }) or pin it ({ pin: { id, on } }). */
    async mark(mapId, body) {
      if (!state.joinedId) return false;
      try {
        const res = await fetch('/api/table/mark', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: state.joinedId, map: mapId, ...body }) });
        return res.ok;
      } catch { return false; }
    },
    /** Asks to open or close a door next to this sheet's marker (decision 73); the GM console decides. */
    async door(mapId, doorId, open) {
      if (!state.joinedId) return false;
      try {
        const res = await fetch('/api/table/door', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: state.joinedId, map: mapId, door: doorId, open }) });
        return res.ok;
      } catch { return false; }
    },
    /**
     * A crew stash (decision 145): { op: put | take | putCash | takeCash, stash, unit | kind + id, label, amount }.
     * @returns the server's answer ({ ok, unit?, amount?, stash?, why? }); why 'offline' when it can't be reached.
     */
    async stash(op) {
      if (!state.joinedId) return { ok: false, why: 'offline' };
      try {
        const res = await fetch('/api/table/stash', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...op, character: state.joinedId }) }); // op.id is the item's
        return await res.json();
      } catch { return { ok: false, why: 'offline' }; }
    },
    /** Decision 155: an ability's card for another player (a heal, Braced, a free action…). @returns true when sent. */
    async boon(to, boon) {
      if (!state.joinedId) return false;
      try {
        const res = await fetch('/api/table/boon', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ from: state.joinedId, to, boon }) });
        return res.ok;
      } catch { return false; }
    },
    /** Decision 154: what happened to a hit the GM sent (applied / dodged / dodge failed) — told to the GM. */
    async hitResult(hit, status, detail = '') {
      if (!state.joinedId) return false;
      try {
        const res = await fetch('/api/table/hit-result', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ character: state.joinedId, hit, status, detail }) });
        return res.ok;
      } catch { return false; }
    },
    /** Decision 153: an attack on an enemy this sheet picked — the GM applies or dismisses it. @returns true when sent. */
    async report(body) {
      if (!state.joinedId) return false;
      try {
        const res = await fetch('/api/table/report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, character: state.joinedId }) });
        return res.ok;
      } catch { return false; }
    },
    /** Decision 149: a private note to the GM. @returns true when the server took it. */
    async whisper(text) {
      if (!state.joinedId) return false;
      try {
        const res = await fetch('/api/table/whisper', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ character: state.joinedId, text }) });
        return res.ok;
      } catch { return false; }
    },
    /** Decision 148: the die rolled for the GM's ask; the GM console puts it in the combat setup. @returns true when sent. */
    async initiative(ask, roll) {
      if (!state.joinedId) return false;
      try {
        const res = await fetch('/api/table/initiative', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ character: state.joinedId, ask, roll }) });
        return res.ok;
      } catch { return false; }
    },
    /** Decision 170: a ping went out (rolled on the sheet); the GM's console answers with a durable `ping`. */
    async ping(mapId, { success, margin }) {
      if (!state.joinedId) return false;
      try {
        const res = await fetch('/api/table/ping', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: state.joinedId, map: mapId, success: Boolean(success), margin: Number(margin) || 0 }) });
        return res.ok;
      } catch { return false; }
    },
    /** Decision 171: a toy drone flew — the GM gets a line (and Trace +1 on the live map). */
    async drone(mapId, { purpose, outcome, margin }) {
      if (!state.joinedId) return false;
      try {
        const res = await fetch('/api/table/drone', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: state.joinedId, map: mapId, purpose, outcome, margin: Number(margin) || 0 }) });
        return res.ok;
      } catch { return false; }
    },
    /** Decision 165: the answer to the GM's ask — what was rolled, against what. @returns true when sent. */
    async rollResult(r) {
      if (!state.joinedId) return false;
      try {
        const res = await fetch('/api/table/roll', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ character: state.joinedId, ...r }) });
        return res.ok;
      } catch { return false; }
    },
    /** Sends an item to another sheet. @returns true when the server took it. */
    async gift(to, item) {
      try {
        const res = await fetch('/api/table/gift', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ from: state.joinedId, to, item }) });
        return res.ok;
      } catch { return false; }
    },

    /** A secret Unity Check ballot: back · object · abstain. It can change until the GM reveals the tally. */
    async vote(check, vote) {
      state.myVotes = { ...state.myVotes, [check]: vote };
      emit();
      try {
        await fetch('/api/table/vote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: state.joinedId, check, vote }) });
      } catch { /* offline: the GM can still record the outcome by voice */ }
    },

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

    /**
     * Decision 160: one character per player. If this player already has another character at the table (another tab
     * or device), hooks.oneAtATime({ player, here, there }) asks; yes sends that one off the table, no stays out.
     */
    async join(id) {
      if (!state.available || !store.get(id)) return;
      try {
        const mine = store.get(id).player ?? '';
        const { player, others = [] } = await (await fetch(`/api/table/peers?id=${encodeURIComponent(id)}&player=${encodeURIComponent(mine)}`, { cache: 'no-store' })).json();
        if (others.length) {
          const ok = await (hooks.oneAtATime?.({ player, here: store.get(id).name || 'Unnamed', there: others.map((o) => o.name) }) ?? true);
          if (!ok) return;
          for (const o of others) await fetch('/api/table/step-aside', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, other: o.id, player: mine, name: store.get(id).name ?? '' }) }).catch(() => {});
        }
      } catch { /* an older server, or not yet synced: join as before */ }
      this.connect(id);
    },
    connect(id) {
      state.joinedId = id;
      try { sessionStorage.setItem(JOINED, id); } catch { /* private mode */ }
      connect(id);
      unsubscribe?.();
      // every logged action is sent at once, so the server keeps a snapshot per action (the GM's undo, decision 56)
      let lastLine = store.get(id)?.play?.log?.[0]?.t ?? null;
      unsubscribe = store.subscribe((change) => {
        if (change.id !== id) return;
        const line = store.get(id)?.play?.log?.[0]?.t ?? null;
        if (line !== lastLine) { lastLine = line; clearTimeout(timer); push(); } else schedule();
      });
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
      state.map = null;
      state.marks = null;
      try { sessionStorage.removeItem(JOINED); } catch { /* private mode */ }
      emit();
    },
  };
  return link;
}
