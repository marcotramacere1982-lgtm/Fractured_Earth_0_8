// Abilities in play (decision 155): each ability's `play` block (abilities.json) says who it targets, what it rolls
// and what a success does. Pure: the sheet asks what to pick and roll, then hands the rolls here and gets back
// what goes where — pending hits for the GM, effects on the caster, cards for allies, notes for the GM.
//
// spec = { target: enemy|enemies|ally|allies|self|none, max?, tags?, withSelf?, weapon?, damage? (dice, or by tag),
//          armor?: half|ignore, conditions?, crack?, self? { conditions, roundEnd, note, ammo, custom },
//          ally? { heal, conditions, clear, cracks, note }, bomb? { damage, splash }, choose? [option…], gm? }

/** The specs that fire: Tech Wizard → the face of the current mode (both for a Resonant burst); others → `play`. */
export function abilityFaces(ability, resources = {}, { resonant = false } = {}) {
  const p = ability?.play;
  if (!p) return [];
  if (p.mend || p.surge) {
    const faces = resonant ? ['mend', 'surge'] : [resources.mode === 'surge' ? 'surge' : 'mend'];
    return faces.filter((f) => p[f]).map((f) => ({ face: f, spec: p[f] }));
  }
  return [{ face: null, spec: p }];
}

/**
 * Decision 163: what an ability does at a glance — effect icon ids (data/icons.json fx_*), from its play block:
 * attack (damage), heal, armor (Braced, cracks mended…), control (a condition on an enemy), ally (a card for others),
 * search (reveals), gm (needs the GM: cover, a decoy…). Every face and option counts.
 */
export function abilityEffects(ability) {
  const p = ability?.play;
  if (!p) return [];
  const specs = (p.mend || p.surge ? [p.mend, p.surge] : [p]).filter(Boolean).flatMap((s) => (s.choose ? s.choose.map((_, i) => chosen(s, i)) : [s]));
  const out = new Set();
  for (const s of specs) {
    if (s.weapon || s.damage || s.bomb) out.add('fx_attack');
    if (s.ally?.heal) out.add('fx_heal');
    if ([...(s.self?.conditions ?? []), ...(s.ally?.conditions ?? [])].some((k) => ['braced', 'bolstered', 'guarded'].includes(k)) || s.ally?.cracks) out.add('fx_armor');
    if (s.conditions?.length || s.crack) out.add('fx_control');
    if (s.ally && !s.ally.heal) out.add('fx_ally');
    if (/reveal|hidden|map the/i.test(s.gm ?? '')) out.add('fx_search');
    else if (s.gm && !s.weapon && !s.damage && !s.conditions?.length && !s.ally && !s.self) out.add('fx_gm');
  }
  return [...out];
}

/** A choice made: the option's fields over the spec's (gm notes join). */
export function chosen(spec, index) {
  if (!spec.choose?.length) return spec;
  const o = spec.choose[Math.max(0, Math.min(spec.choose.length - 1, Number(index) || 0))];
  const { choose, ...base } = spec;
  return { ...base, ...o, gm: [base.gm, o.gm].filter(Boolean).join(' ') || undefined };
}

/** The damage dice for a target of this tag ('3d6'…), or null. */
export function damageFor(spec, tag = 'organic') {
  if (!spec.damage) return null;
  return typeof spec.damage === 'string' ? spec.damage : spec.damage[tag] ?? null;
}

/** May this enemy be picked? (hacks: only cybernetic / synthetic ones; Bribe: only organic). */
export const canTarget = (spec, hostile) => !spec.tags || spec.tags.includes(hostile.tag ?? 'organic');

/**
 * What a success does, once the dice are in.
 * input: { ability: name, by: caster name, enemies: [{ key, label, tag }], allies: [{ id, name, me }],
 *          damage: { [enemyKey]: total } | total, weaponText, heal: total, healText, roll (the Class TN roll text) }
 * @returns { reports: [pending hit for the GM], self: { conditions, roundEnd, note, ammo, custom, heal }, boons: [{ to, …card }], note }
 */
export function playEffects(spec, { ability, enemies = [], allies = [], damage = null, weaponText = '', heal = null, healText = '', roll = '' }) {
  const dmgOf = (key) => (damage == null ? null : typeof damage === 'number' ? damage : damage[key] ?? null);
  const hitsEnemy = Boolean(spec.weapon || spec.damage || spec.conditions?.length || spec.crack);
  const reports = hitsEnemy || (spec.target === 'enemy' || spec.target === 'enemies')
    ? enemies.map((e) => ({ target: e.key, targetLabel: e.label, hit: true, ability, damage: dmgOf(e.key), armor: spec.armor ?? '',
      conditions: spec.conditions ?? [], crack: spec.crack ?? 0, note: spec.gm ?? '', roll: [roll, weaponText].filter(Boolean).join(' · ') }))
    : [];
  // nothing aimed at an enemy, but the GM has to do something: a note-only report
  if (!reports.length && spec.gm) reports.push({ target: '', targetLabel: '', hit: true, ability, damage: null, armor: '', conditions: [], crack: 0, note: spec.gm, roll });
  const boon = spec.ally ? { ability, heal: spec.ally.heal ? heal : null, healText, conditions: spec.ally.conditions ?? [], clear: spec.ally.clear ?? [], cracks: spec.ally.cracks ?? 0, note: spec.ally.note ?? '' } : null;
  const boons = boon ? allies.map((a) => ({ ...boon, to: a.id, toName: a.name, me: Boolean(a.me) })) : [];
  const self = spec.self ? { conditions: spec.self.conditions ?? [], roundEnd: Boolean(spec.self.roundEnd), note: spec.self.note ?? '', ammo: spec.self.ammo ?? null, custom: spec.self.custom ?? '' } : null;
  return { reports, self, boons };
}

/** What a card from an ally does to you, in order: heal (never past max), conditions on, conditions off, cracks mended. */
export function boonResult({ hp, maxHp, conditions = [], armorDamage = 0 }, boon) {
  const healed = boon.heal ? Math.min(maxHp, hp + boon.heal) : hp;
  const on = [...new Set([...conditions.filter((c) => !(boon.clear ?? []).includes(c)), ...(boon.conditions ?? [])])];
  return { hp: healed, gained: healed - hp, conditions: on, armorDamage: Math.max(0, armorDamage - (boon.cracks ?? 0)) };
}
