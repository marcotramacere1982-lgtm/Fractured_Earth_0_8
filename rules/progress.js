// Advancement (decision 44) and talents. Pure: character + data in, numbers and codes out.
//   level = 1 + ⌊XP ÷ 10⌋ (cap 10) · every level 1 talent point · levels 2/4/6/8/10 +1 attribute ·
//   levels 3/6/9 +1 equipped-ability slot · tier 2 from level 3, tier 3 from level 5 (max 2).
// Bought talents cost 1 point each; GM gifts cost nothing and skip the prerequisites.

export const emptyProgress = () => ({ xp: 0, talents: [], gifts: [], raises: [], open: false, seen: [] });

const P = (data) => data.progress;
const talentOf = (data, id) => data.talents.find((t) => t.id === id) ?? null;

export const levelOf = (xp, data) => Math.min(P(data).maxLevel, 1 + Math.floor(Math.max(0, xp) / P(data).xpPerLevel));

/** Everything the Progress tab shows: level, XP towards the next one, points earned / spent / left. */
export function progressStatus(c, data) {
  const pr = c.progress ?? emptyProgress();
  const level = levelOf(pr.xp, data);
  const { xpPerLevel, maxLevel, grants } = P(data);
  const reached = (levels) => levels.filter((l) => l <= level).length;
  const talentsEarned = (level - 1) * grants.talentPerLevel;
  const attrsEarned = reached(grants.attributeLevels);
  return {
    xp: pr.xp, level, maxed: level >= maxLevel,
    nextAt: level >= maxLevel ? null : level * xpPerLevel, into: pr.xp - (level - 1) * xpPerLevel, per: xpPerLevel,
    talentPoints: { earned: talentsEarned, spent: pr.talents.length, left: Math.max(0, talentsEarned - pr.talents.length) },
    attributePoints: { earned: attrsEarned, spent: pr.raises.length, left: Math.max(0, attrsEarned - pr.raises.length) },
    abilitySlots: reached(grants.abilitySlotLevels),
    owned: [...pr.talents, ...pr.gifts],
    open: Boolean(pr.open),
  };
}

/** Trees this character may use: the general ones and their own class's. */
export const treesFor = (c, data) => P(data).trees.filter((t) => t.kind === 'general' || t.id === c.classId);

/**
 * Can this talent be bought now? { owned, gift, ok, code, vars }. code (when not ok):
 * owned · wrongClass · wrongBranch · level · needsTier · attribute · tier3Max · noPoints · closed
 */
export function talentStatus(c, talent, data) {
  const pr = c.progress ?? emptyProgress();
  const st = progressStatus(c, data);
  const owned = st.owned.includes(talent.id);
  const no = (code, vars = {}) => ({ owned, gift: pr.gifts.includes(talent.id), ok: false, code, vars });
  if (owned) return no('owned');
  const tree = P(data).trees.find((t) => t.id === talent.tree);
  if (tree.kind === 'class' && tree.id !== c.classId) return no('wrongClass', { tree: tree.name });
  if (talent.branch && talent.branch !== c.subclassId) return no('wrongBranch', { branch: talent.branch });
  const gate = P(data).tiers[String(talent.tier)];
  if (gate && st.level < gate.level) return no('level', { n: gate.level });
  if (talent.tier > 1) {
    const below = st.owned.map((id) => talentOf(data, id)).filter((t) => t && t.tree === talent.tree && t.tier === talent.tier - 1);
    if (!below.length) return no('needsTier', { tier: talent.tier - 1, tree: tree.name });
  }
  for (const [attr, min] of Object.entries(talent.needs ?? {})) {
    if ((c.attributes[attr] ?? 0) < min) return no('attribute', { attr, n: min });
  }
  if (gate?.max && st.owned.map((id) => talentOf(data, id)).filter((t) => t?.tier === talent.tier).length >= gate.max) return no('tier3Max', { n: gate.max });
  if (st.talentPoints.left < 1) return no('noPoints');
  if (!st.open) return no('closed');
  return { owned, gift: false, ok: true, code: null, vars: {} };
}

/** Raising an attribute at level-up: needs a point and the GM's level-up open. */
export function canRaise(c, data) {
  const st = progressStatus(c, data);
  if (st.attributePoints.left < 1) return { ok: false, code: 'noAttributePoints' };
  if (!st.open) return { ok: false, code: 'closed' };
  return { ok: true, code: null };
}

/**
 * The automatic effects of every talent the character has, merged:
 * numbers add up, per-ability and per-stance tables merge, lists join, flags OR.
 */
export function talentEffects(c, data) {
  const out = {};
  const add = (target, src) => {
    for (const [k, v] of Object.entries(src)) {
      if (typeof v === 'number') target[k] = (target[k] ?? 0) + v;
      else if (typeof v === 'boolean') target[k] = target[k] || v;
      else if (typeof v === 'string') target[k] = v;
      else if (Array.isArray(v)) target[k] = [...(target[k] ?? []), ...v];
      else if (v && typeof v === 'object') add((target[k] ??= {}), v);
    }
  };
  for (const id of progressStatus(c, data).owned) {
    const t = talentOf(data, id);
    if (t?.effects) add(out, Object.fromEntries(Object.entries(t.effects).filter(([k]) => k !== 'onBuy')));
  }
  return out;
}

/**
 * An ability as this character's talents change it: cost / RAM / heat deltas, a looser pendulum
 * requirement, fewer rounds needed, more uses per combat.
 */
export function tunedAbility(ability, effects = {}) {
  const mod = effects.abilities?.[ability.id];
  if (!mod) return ability;
  const a = { ...ability };
  if (mod.cost && 'cost' in a) a.cost = Math.max(0, a.cost + mod.cost);
  if (mod.ram && 'ram' in a) a.ram = Math.max(0, a.ram + mod.ram);
  if (mod.heat && 'heat' in a) a.heat = Math.max(0, a.heat + mod.heat);
  if ('requires' in mod) a.requires = mod.requires; // e.g. 0 = also works at Composure
  if (mod.minAmmo && a.weapon) a.weapon = { ...a.weapon, minAmmo: mod.minAmmo };
  if (mod.uses) a.uses = (a.uses ?? 1) + mod.uses - 1;
  if (mod.perMission) a.perMission = mod.perMission; // decision 186: Network, Social Engineer
  if (mod.perScene) a.perScene = mod.perScene; // Scrounger
  return a;
}

/**
 * Suggested mission XP for one player (decision 44), from the GM's Story tab mission:
 * objectives (main/primary succeeded 3, secondary 1, failed 1), dangerous fights they were in
 * (rated when the fight started: amber/Hard +1, red/Deadly +2), and Spotlight (+1 each, capped).
 */
export function missionXp(mission, playerId, data) {
  const x = P(data).xp;
  const objectives = (mission.objectives ?? []).reduce((s, o) => {
    if (o.status === 'success') return s + (['main', 'primary'].includes(o.kind) ? x.primary : x.secondary);
    if (o.status === 'fail') return s + x.failed;
    return s;
  }, 0);
  const danger = (mission.fights ?? []).filter((f) => f.players.includes(playerId)).reduce((s, f) => s + (x.danger[f.band] ?? 0), 0);
  const spotlight = Math.min(x.spotlightMax, mission.spotlight?.[playerId] ?? 0) * x.spotlight;
  return { objectives, danger, spotlight, total: objectives + danger + spotlight };
}
