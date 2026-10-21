// What items in play add to a roll (decision 77). A hypo or a stim leaves a timed effect (play.effects) that
// raises an attribute or a modifier; the sheet already counts it in the target number, but the roll window
// didn't say so, so it looked as if the item did nothing. Here: for one roll, each active effect and how much
// it changes that target — worked out by deriving the sheet with and without it (no formula repeated).

import { deriveSheet } from '../../state/character.js';

/**
 * target: { kind: 'attr' | 'skill', id } or { kind: 'weapon', slot }.
 * @returns [{ name, delta }] — only effects that change this roll (delta ≠ 0)
 */
export function boostsFor(c, data, target) {
  const effects = c.play.effects ?? [];
  if (!effects.length) return [];
  const value = (ch) => {
    const s = deriveSheet(ch, data);
    if (target.kind === 'attr') return s.attributes[target.id];
    if (target.kind === 'weapon') return s.weapons.find((w) => w.slot === Number(target.slot))?.tn;
    return s.skills.find((k) => k.id === target.id)?.value;
  };
  const now = value(c);
  return effects.map((e) => {
    const without = value({ ...c, play: { ...c.play, effects: effects.filter((x) => x !== e) } });
    return { name: e.name, delta: (now ?? 0) - (without ?? 0) };
  }).filter((x) => x.delta);
}
