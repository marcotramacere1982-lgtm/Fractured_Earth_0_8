// Crew trust and Unity Checks (decision 47). One shared track for the crew: it measures whether the
// crew acts together, never whether the act was good. Pure: values and data in, codes out.

const C = (data) => data.crew;

export const clampCrew = (v, data) => Math.max(C(data).track.min, Math.min(C(data).track.max, v));

/** The band a value sits in: broken · fractured · steady · tight. */
export const bandOf = (value, data) => C(data).bands.find((b) => value >= b.min && value <= b.max) ?? C(data).bands[0];

/** A secret ballot counted: { back, object, abstain, voted, majority: 'back' | 'object' | 'split' | null }. */
export function tally(votes) {
  const t = { back: 0, object: 0, abstain: 0 };
  for (const v of Object.values(votes ?? {})) if (v in t) t[v] += 1;
  const voted = t.back + t.object + t.abstain;
  const majority = !voted ? null : t.back > t.object ? 'back' : t.object > t.back ? 'object' : 'split';
  return { ...t, voted, majority };
}

/**
 * What a Unity Check does to the track once the actor has chosen (the GM confirms):
 * backed — the crew committed together (+1, whatever the result); override — the actor went ahead
 * against a crew that objected (−1); none — no change (the actor held back, or the GM rules so).
 */
export const unityDelta = (outcome, data) => (outcome === 'backed' ? C(data).unity.backed : outcome === 'override' ? C(data).unity.override : 0);
