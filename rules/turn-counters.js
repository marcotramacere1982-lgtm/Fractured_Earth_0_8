// Turn counters (decision 318): the GM's manual countdowns in turns, beside the table clock — narrative only, nothing
// in the rules reads them. One optional *main* counter the players see; any number of *extra* counters only the GM
// sees (a patrol's loop, reinforcements, a reactor). The GM moves them by hand: a tick advances (−1), a rewind (+1).
// An extra with `sync` moves with the main buttons; one with `loop` starts again from its `start` after 0
// (start 3: 3 → 2 → 1 → 0 → 3). Pure.
//
// counters = { main: { label, value, start, to } | null, extra: [{ id, label, value, start, sync, loop }] }

export const emptyCounters = () => ({ main: null, extra: [] });

const clean = (n, fallback = 0) => (Number.isFinite(Number(n)) ? Math.max(0, Math.round(Number(n))) : fallback);

/** One counter moved by dir (−1 tick, +1 rewind); a looping one wraps around 0 ↔ start, others stop at 0. */
export function stepCounter(c, dir) {
  const d = dir < 0 ? -1 : 1;
  let value = c.value + d;
  if (c.loop && c.start > 0) {
    if (value < 0) value = c.start; // past 0: back to the start
    else if (value > c.start) value = 0; // a rewind past the start goes back round
  }
  return { ...c, value: Math.max(0, value) };
}

/** The main buttons: the main counter (if any) and every synced extra move together. */
export function tickAll(counters, dir) {
  const cs = counters ?? emptyCounters();
  return {
    main: cs.main ? stepCounter(cs.main, dir) : null,
    extra: cs.extra.map((x) => (x.sync ? stepCounter(x, dir) : x)),
  };
}

/** One extra's own −/+ (sync or not). */
export const tickExtra = (counters, id, dir) => ({ ...counters, extra: counters.extra.map((x) => (x.id === id ? stepCounter(x, dir) : x)) });

/** A new counter from the GM's form: a label and a starting value (at least 1). */
export function newCounter({ id = null, label = '', start = 3, sync = true, loop = false, to = null } = {}) {
  const s = Math.max(1, clean(start, 3));
  return { ...(id ? { id } : {}), label: String(label ?? '').trim().slice(0, 40) || 'Turns', value: s, start: s, ...(id ? { sync: Boolean(sync), loop: Boolean(loop) } : { to }) };
}

/** The main counter's colour band for the sheets: 3 or more green, 2 yellow, 1 and 0 red. */
export const band = (value) => (value >= 3 ? 'ok' : value === 2 ? 'warn' : 'danger');
