// Decision 301: tap again to reach what lies underneath. Pieces overlap (a desk on a rug, a switch on a wall, a tower in
// front of the district behind it on the skyline): a second tap on the same spot, soon after, selects the next one under
// the finger, round and round. Each viewer keeps its own cycle.

const NEAR = 0.35; // squares: "the same spot"
const SOON = 5000; // ms

export function createTapCycle({ near = NEAR, soon = SOON } = {}) {
  let last = null; // { x, y, t } — the previous tap
  return {
    /**
     * pt: where this tap landed (squares) · ids: every candidate under it, in the usual order · current: what is selected now.
     * @returns the next candidate after `current` when this tap repeats the last one, else null (pick as usual).
     */
    next(pt, ids, current) {
      const again = last && Date.now() - last.t < soon && Math.hypot(pt.x - last.x, pt.y - last.y) <= near;
      last = { x: pt.x, y: pt.y, t: Date.now() };
      if (!again || !current || ids.length < 2 || !ids.includes(current)) return null;
      return ids[(ids.indexOf(current) + 1) % ids.length];
    },
  };
}
