// Player side of the table's character library (decision 87). Only active at a table (the GM's server); offline
// and on GitHub Pages nothing changes. A player picks who they are ("Play as…"); their characters at the table
// show on any device, opening one copies it down (the newest copy wins), and characters created, imported or opened
// while playing as someone are saved to the table under their name. Players are names only: no passwords on the LAN.

const PLAYER = 'fe.table.player'; // { id, name } of who plays on this device
const json = (url, body) => fetch(url, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : { cache: 'no-store' })
  .then(async (r) => ({ ok: r.ok, json: await r.json().catch(() => ({})) }));

/** table: the table link (net/table.js); store: the character store. */
export function createLibrary(table, store) {
  const state = { player: read(), players: [], remote: [], owners: {}, loaded: false }; // owners: character id → player name
  const listeners = new Set();
  const emit = () => listeners.forEach((fn) => fn(state));

  function read() { try { return JSON.parse(localStorage.getItem(PLAYER)) ?? null; } catch { return null; } }
  function remember(p) { state.player = p; try { if (p) localStorage.setItem(PLAYER, JSON.stringify(p)); else localStorage.removeItem(PLAYER); } catch { /* private mode */ } }
  const on = () => Boolean(table.state.available);

  async function refresh() {
    if (!on()) return;
    const r = await json('/api/table/library').catch(() => null);
    state.players = r?.json?.players ?? [];
    if (state.player && !state.players.some((p) => p.id === state.player.id)) remember(null); // the GM merged or removed that name
    const mine = state.player ? await json(`/api/table/library/characters?player=${encodeURIComponent(state.player.id)}`).catch(() => null) : null;
    state.remote = mine?.json?.characters ?? [];
    const own = await json('/api/table/library/owners').catch(() => null);
    state.owners = own?.json?.owners ?? {};
    // this device's copies carry their owner's name (the GM may have moved one): fixed without touching their save time
    for (const c of store.list()) {
      const name = state.owners[c.id];
      if (name && c.player !== name) store.update(c.id, (d) => { d.player = name; }, { silent: true, keepTime: true });
    }
    state.loaded = true;
    emit();
  }

  /** Saves a character to the table under the current player (and writes their name on the sheet if it has none). */
  async function claim(id) {
    if (!on() || !state.player || !store.get(id)) return false;
    if (!store.get(id).player) store.update(id, (c) => { c.player = state.player.name; }, { silent: true });
    const r = await json('/api/table/library/claim', { player: state.player.id, character: store.get(id) }).catch(() => null);
    return Boolean(r?.ok);
  }

  return {
    state,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    available: on,
    refresh,

    /** Picks who plays on this device: an existing player id, or a new name. */
    async choose({ id = null, name = null }) {
      if (!id && !name) { remember(null); state.remote = []; emit(); return; }
      let p = state.players.find((x) => x.id === id) ?? null;
      if (!p && name) { const r = await json('/api/table/library/player', { name }).catch(() => null); p = r?.json?.player ?? null; }
      if (!p) return;
      remember({ id: p.id, name: p.name });
      await refresh();
    },

    /** Whose character it is at the table (a player name), or null when the table doesn't know it. */
    ownerOf: (id) => state.owners[id] ?? null,
    /** The table's copy of one of my characters, if any: { id, savedAt, online, … } */
    remoteOf: (id) => state.remote.find((c) => c.id === id) ?? null,

    claim,
    /** After creating or importing: saved to the table when someone is playing on this device. */
    async keep(id) { if (await claim(id)) await refresh(); },

    /**
     * Opening a character at the table: warns when it is open on another device, takes the table's copy when it is
     * newer (or this device has none), saves this one to the table otherwise, and joins with it.
     * @returns 'opened' | 'cancelled' | 'failed', and `updated` when the table's copy replaced this device's
     */
    async open(id, { confirmOther }) {
      await refresh(); // the list on screen may be old: another device may have played since
      const remote = state.remote.find((c) => c.id === id);
      if (remote?.online && table.state.joinedId !== id && !confirmOther(remote.name)) return { result: 'cancelled' };
      const local = store.get(id);
      let updated = false;
      if (remote && (!local || (Number(remote.savedAt) || 0) > (Number(local.savedAt) || 0))) {
        const r = await json(`/api/table/library/character?id=${encodeURIComponent(id)}`).catch(() => null);
        if (!r?.ok) return { result: 'failed' };
        store.put(r.json.character);
        updated = Boolean(local);
      } else if (!(await claim(id))) {
        if (!local) return { result: 'failed' };
      }
      table.join(id);
      return { result: 'opened', updated };
    },
  };
}
