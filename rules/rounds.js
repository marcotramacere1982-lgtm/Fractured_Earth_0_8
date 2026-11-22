// Decision 365: exploration rounds — the careful pace between free exploring and a fight. Each player plans one action
// (a move, a door, a device, or something else in a few words) and may change it until the GM resolves the round;
// then everything happens together: doors and devices first, then moves, step by step. A mover seen or caught by a
// sensor stops on that square; the others finish. Then the world's turn: the GM moves guards, cameras, drones.

export const OTHER_MAX = 80; // the words of "something else"

export const newRounds = () => ({ n: 1, phase: 'plan', plans: {}, summary: null, pace: {}, shadow: {}, met: {}, pending: {}, notes: [] }); // decision 367: pace, Shadow, who met whom this round, rolls waiting

/** A plan from a sheet or the console, cleaned; null clears it. */
export function cleanPlan(p) {
  if (!p || typeof p !== 'object') return null;
  if (p.kind === 'move' && Number.isInteger(p.to?.x) && Number.isInteger(p.to?.y)) {
    const path = Array.isArray(p.path) ? p.path.filter((s) => Number.isInteger(s?.x) && Number.isInteger(s?.y)).map((s) => ({ x: s.x, y: s.y })) : [];
    return { kind: 'move', to: { x: p.to.x, y: p.to.y }, path };
  }
  if (p.kind === 'door' && typeof p.door === 'string') return { kind: 'door', door: p.door, open: Boolean(p.open) };
  if (p.kind === 'device' && typeof p.prop === 'string') return { kind: 'device', prop: p.prop, on: Boolean(p.on) };
  if (p.kind === 'other') {
    const text = String(p.text ?? '').replace(/\s+/g, ' ').trim().slice(0, OTHER_MAX);
    return text ? { kind: 'other', text } : null;
  }
  return null;
}

export function setPlan(r, key, plan) {
  const plans = { ...r.plans };
  const p = cleanPlan(plan);
  if (p) plans[key] = p; else delete plans[key];
  return { ...r, plans };
}

const ORDER = { door: 0, device: 0, other: 1, move: 2 };
/** The order a round happens in: doors and devices, then the rest, then moves (an opened door helps a move). */
export const resolveOrder = (plans) => Object.entries(plans ?? {}).sort((a, b) => (ORDER[a[1].kind] ?? 3) - (ORDER[b[1].kind] ?? 3));

/**
 * Where a planned move stops: the first step on which the mover is seen or sets off a sensor.
 * steps: the squares after the start; seenAt(step, i) → true when someone awake sees them there; trip: index or -1.
 * @returns { i: last step index taken (-1 = none), seen: bool, tripped: bool }
 */
export function stopOf(steps, seenAt, trip = -1) {
  const last = trip >= 0 ? Math.min(trip, steps.length - 1) : steps.length - 1;
  for (let i = 0; i <= last; i++) if (seenAt(steps[i], i)) return { i, seen: true, tripped: i === trip };
  return { i: last, seen: false, tripped: trip >= 0 };
}

/** After the round: the world's turn — plans already made for the next round are kept. */
export const afterResolve = (r, summary) => ({ ...r, phase: 'world', plans: {}, summary: [...(r.notes ?? []), ...summary], notes: [] });
export const nextRound = (r) => ({ ...r, n: r.n + 1, phase: 'plan', summary: null, met: {}, notes: [] });

/** What the sheets get: the round, the phase and everyone's plans (the crew coordinates). */
export const publicRounds = (r) => (r ? { n: r.n, phase: r.phase, plans: r.plans, pace: r.pace ?? {}, shadow: r.shadow ?? {}, waiting: Object.keys(r.pending ?? {}), spots: r.spots ?? {} } : null); // decision 367; 368: who each player spots first

/** The planned moves to draw on the maps: [{ key, path, to }]. */
export const movePlans = (r) => Object.entries(r?.plans ?? {}).filter(([, p]) => p.kind === 'move').map(([key, p]) => ({ key, path: p.path ?? [], to: p.to }));
