// "How is this number made?" — structured explanations for attributes, skills, combat values, HP,
// initiative and Class TN, computed from a character + data. Pure: the UI only formats them.

import { bonus, computeCombat, computeSkills, initiative, skillValue } from './stats.js';
import { maxHp } from './body.js';
import { classTN, findSubclass } from './classes.js';
import { passiveScore } from './checks.js';

const attrName = (data, id) => data.attributes.attributes.find((a) => a.id === id)?.name ?? id;
const statParts = (ids, character, data) => ids.map((id) => ({ id, name: attrName(data, id), value: character.attributes[id], bonus: bonus(character.attributes[id]) }));

/** An attribute: its bonus and everything it feeds. */
export function explainAttribute(id, character, data) {
  const a = data.attributes.attributes.find((x) => x.id === id);
  const value = character.attributes[id];
  const skills = computeSkills(character.attributes, data.skills).filter((k) => k.stats.includes(id)).map((k) => ({ name: k.name, value: k.value }));
  const combat = data.combat.derived.filter((d) => d.stats.includes(id)).map((d) => d.name);
  const other = []; // { key: 'hp' | 'initiative' | 'class-tn', subclass? } — the screen words them
  if (data.body.maxHp[id.toLowerCase()]) other.push({ key: 'hp' });
  if (data.combat.initiative.stats.includes(id)) other.push({ key: 'initiative' });
  const sub = character.subclassId ? findSubclass(data.classes, character.subclassId)?.sub : null;
  if (sub?.stats.includes(id)) other.push({ key: 'class-tn', subclass: sub.name });
  return { kind: 'attribute', id, name: a?.name ?? id, desc: a?.desc ?? '', value, bonus: bonus(value), skills, combat, other };
}

/** A skill: TN = bonus(A) + bonus(B), and the passive score. */
export function explainSkill(id, character, data) {
  const skill = data.skills.skills.find((k) => k.id === id);
  const value = skillValue(skill, character.attributes);
  return { kind: 'skill', id, name: skill.name, desc: skill.desc, stats: statParts(skill.stats, character, data), value, passive: passiveScore(value, data.difficulty) };
}

/** A combat value: raw sum of two attributes → table row (± row shifts from life events) → value. */
export function explainCombat(id, character, data) {
  const d = data.combat.derived.find((x) => x.id === id);
  const c = computeCombat(character.attributes, character.rowOffsets, data.combat)[id];
  const row = data.combat.table[c.row];
  return { kind: 'combat', id, name: d.name, desc: d.desc, use: d.use ?? '', stats: statParts(d.stats, character, data), sum: c.sum, offset: c.offset, rowMin: row.min, rowMax: row.max, value: c.value };
}

export function explainInitiative(character, data) {
  const { stats, offset, use } = data.combat.initiative;
  return { kind: 'initiative', name: 'Initiative', use: use ?? '', stats: statParts(stats, character, data), offset, value: initiative(character.attributes, data.combat) };
}

export function explainHp(character, data) {
  const { con, mst } = data.body.maxHp;
  const mod = character.mods?.maxHp ?? 0;
  return { kind: 'hp', name: 'Max HP', con: character.attributes.CON, mst: character.attributes.MST, conX: con, mstX: mst, mod, value: maxHp(character.attributes, data.body, mod) };
}

export function explainClassTN(character, data) {
  const sub = character.subclassId ? findSubclass(data.classes, character.subclassId)?.sub : null;
  if (!sub) return null;
  return { kind: 'class-tn', name: 'Class TN', subclass: sub.name, stats: statParts(sub.stats, character, data), value: classTN(character.attributes, sub) };
}
