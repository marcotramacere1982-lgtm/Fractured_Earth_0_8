// Imports v0.8 files (pg_builder init files and Play_game saves) into schema v1.

import { createCharacter, SCHEMA_VERSION } from './character.js';
import { ATTRIBUTES } from '../rules/stats.js';

export function detectFormat(json) {
  if (json?.schemaVersion) return 'v1';
  if (json?.saveVersion) return 'legacy-save';
  if (json?.stats?.attributes?.final) return 'legacy-init';
  return 'unknown';
}

/** @returns {{character: object, warnings: string[]}} */
export function importCharacter(json, data) {
  const format = detectFormat(json);
  if (format === 'v1') {
    if (json.schemaVersion > SCHEMA_VERSION) throw new Error('This file was made by a newer version of the app.');
    return { character: json, warnings: [] };
  }
  if (format === 'unknown') throw new Error('Not a Fractured Earth character file.');
  return migrateLegacy(json, data, format);
}

function migrateLegacy(json, data, format) {
  const warnings = [];
  const c = createCharacter(data, { player: json.identity?.playerName ?? '', name: json.identity?.characterName ?? '' });

  // attributes: init files keep them under stats.attributes.final, saves under stats
  const attrSource = format === 'legacy-init' ? json.stats.attributes.final : json.stats;
  for (const k of ATTRIBUTES) {
    const v = attrSource?.[k]?.val ?? attrSource?.[k];
    if (typeof v === 'number') c.attributes[k] = v;
  }

  const combat = format === 'legacy-init' ? json.stats.combatValues : json.combatValues;
  for (const d of data.combat.derived) {
    if (typeof combat?.[`${d.id}_offset`] === 'number') c.rowOffsets[d.id] = combat[`${d.id}_offset`];
  }

  c.age = json.meta?.age ?? c.age;

  // adolescence events: legacy stores full rows whose `id` is the roll
  for (const ev of json.meta?.adolescenceEvents ?? []) {
    const match = data.adolescence.events.find((e) => e.roll === ev.id);
    if (match) {
      c.history.adolescence.push({ roll: match.roll, eventId: match.id });
      // v0.8 never recorded adolescence credentials (bug); restore them
      if (match.effects?.credential && !c.credentials.includes(match.effects.credential)) c.credentials.push(match.effects.credential);
      if (match.effects?.tag && !c.tags.includes(match.effects.tag)) c.tags.push(match.effects.tag);
    }
  }

  // career history: index strings; v0.8 pushed each commit twice, so collapse consecutive repeats
  const careerIdx = (json.meta?.careerHistory ?? []).map(Number).filter((n, i, arr) => i === 0 || n !== arr[i - 1]);
  for (const idx of careerIdx) {
    const career = data.careers.careers.find((k) => k.legacyIndex === idx);
    if (career) c.history.careers.push({ careerId: career.id, events: [] });
  }
  if (careerIdx.length) warnings.push('Career events were not recorded by v0.8; repeated terms of the same career may have been merged.');

  for (const m of json.meta?.notableMilestones ?? []) {
    const cred = data.careers.credentials.find((k) => k.name === m);
    if (cred && !c.credentials.includes(cred.id)) c.credentials.push(cred.id);
    else if (m === 'Criminal Record') c.criminalRecord = true;
    else if (!cred && !c.tags.includes(m)) c.tags.push(m);
  }

  const subIdx = Number(json.buildDetails?.selectedMainClass);
  const subId = Number.isInteger(subIdx) ? data.classes.legacySubclassOrder[subIdx] : null;
  if (subId) {
    const cls = data.classes.classes.find((k) => k.subclasses.some((s) => s.id === subId));
    c.classId = cls.id;
    c.subclassId = subId;
  } else {
    warnings.push('No class found in file; pick one on the sheet.');
  }

  const debt = data.debts.find((d) => d.legacyId === Number(json.buildDetails?.specialDebt));
  c.debtId = debt?.id ?? null;

  c.narrative.backstoryHtml = json.narrative?.backstoryText ?? '';
  c.narrative.backstoryPrompt = json.narrative?.backstoryPrompt ?? '';
  c.narrative.portraitPrompt = json.narrative?.portraitPrompt ?? '';

  if (format === 'legacy-save') {
    const byLegacy = (list, id) => list.find((x) => x.legacyId === Number(id))?.id;
    const add = (kind, list, ids) => {
      for (const legacyId of ids ?? []) {
        const id = byLegacy(list, legacyId);
        if (!id) { warnings.push(`Unknown ${kind} #${legacyId} skipped.`); continue; }
        const existing = c.play.inventory.find((x) => x.kind === kind && x.id === id);
        if (existing) existing.qty += 1; else c.play.inventory.push({ kind, id, qty: 1 });
      }
    };
    add('weapon', data.weapons, json.userWeapons);
    add('armor', data.armor, json.userArmor);
    add('item', data.items, json.userItems);
    c.play.worn = c.play.inventory.filter((x) => x.kind === 'armor').map((x) => x.id);
    c.play.cash = json.combatStatus?.physicalCash ?? 0;
    c.portrait.dataUrl = json.portraitDataUrl ?? '';
    if (json.portraitFraming) c.portrait.framing = { ...c.portrait.framing, ...json.portraitFraming };
    warnings.push('v0.8 saves did not store HP, ammo, equipped weapons or abilities; these start fresh.');
  }

  return { character: c, warnings };
}
