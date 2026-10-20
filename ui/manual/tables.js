// Data-driven tables for the manual: ::table[name] → HTML string built from app/data.
// The manual can never drift from the rules: change the data, the book follows.

import { escape as e } from '../dom.js';
import { creditScoreCost } from '../../rules/economy.js';
import { t, hasKey } from '../../i18n/index.js';

/** Column headers are keyed by their English text (th.<English>); codes and data names pass through. */
const th = (h) => (h && hasKey(`th.${h}`) ? t(`th.${h}`) : h);

const signed = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');
const nameOf = (list, id) => list.find((x) => x.id === id)?.name ?? id;

function table(headers, rows, cls = '') {
  return `<div class="md-table-wrap"><table class="md-table ${cls}"><thead><tr>${headers.map((h) => `<th>${e(th(h))}</th>`).join('')}</tr></thead><tbody>${
    rows.map((r) => `<tr>${r.map((c) => `<td>${c ?? ''}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

/** Human summary of an event's structured effects (used by tables; mirrors rules/creation.applyEvent). */
export function describeEffects(fx, data) {
  if (!fx) return '—';
  const parts = [];
  if (fx.attributes) parts.push(Object.entries(fx.attributes).map(([k, v]) => `${k} ${signed(v)}`).join(', '));
  if (fx.minAttributes) parts.push(Object.entries(fx.minAttributes).map(([k, v]) => t('fx.atLeast', { attr: k, n: v })).join(', '));
  if (fx.setAttributes) parts.push(Object.entries(fx.setAttributes).map(([k, v]) => t('fx.setTo', { attr: k, n: v })).join(', '));
  if (fx.choice) parts.push(t('fx.choose', { n: fx.choice.amount, of: fx.choice.of.join('/') }));
  if (fx.rowOffsets) parts.push(Object.entries(fx.rowOffsets).map(([k, v]) => t('fx.row', { stat: k.toUpperCase(), n: signed(v) })).join(', '));
  if (fx.maxHp) parts.push(t('fx.maxHp', { n: signed(fx.maxHp) }));
  if (fx.criminalRecord === 'add') parts.push(t('fx.record'));
  if (fx.criminalRecord === 'clear') parts.push(t('fx.recordCleared'));
  if (fx.credential) parts.push(`${t('fx.credential')}: ${nameOf(data.careers.credentials, fx.credential)}`);
  if (fx.tag) parts.push(`${t('fx.notable')}: ${fx.tag}`);
  if (fx.waives) parts.push(fx.waives.includes('*') ? t('fx.waiveAll') : t('fx.waive', { careers: fx.waives.map((id) => nameOf(data.careers.careers, id)).join(', ') }));
  if (fx.ageDice) parts.push(t('fx.years', { n: fx.ageDice }));
  if (fx.endsCareer) parts.push(t('fx.endsCareer'));
  return e(parts.join(' · ') || '—');
}

const crs = (entry, kind, data) => {
  const v = creditScoreCost(entry, kind, data.economy);
  return v === null ? `<span class="md-badge md-badge--danger">${e(t('fx.streetOnly'))}</span>` : String(v);
};
const rarity = (r) => `<span class="md-badge ${['A', 'B'].includes(r) ? 'md-badge--danger' : ''}">${e(r)}</span>`;

const events = (tbl, data) => table(['Roll', 'Event', 'What happens', 'Mechanics'],
  tbl.events.map((ev) => [`<span class="mono">${ev.roll}</span>`, `<strong>${e(ev.name)}</strong>`, e(ev.text), describeEffects(ev.effects, data)]), 'md-table--events');

const ABILITY_TABLES = {
  soldier: (list, data) => table(['Ability', 'TP cost', 'Gain', 'Stance', 'Subclass', 'Effect'],
    list.map((a) => [`<strong>${e(a.name)}</strong>`, a.cost, a.gain ? `+${a.gain}` : '—', `${e(a.stanceFrom)} → ${e(a.stanceTo)}`, e(a.subclasses.map((s) => nameOf(data.classes.classes.flatMap((c) => c.subclasses), s)).join(', ')), e(a.desc)])),
  hacker: (list, data) => table(['Ability', 'RAM', 'Heat', 'Type', 'Subclass', 'Effect'],
    list.map((a) => [`<strong>${e(a.name)}</strong>`, a.ram, a.heat, a.sustained ? 'Sustained' : 'Instant', e(a.subclasses.map((s) => nameOf(data.classes.classes.flatMap((c) => c.subclasses), s)).join(', ')), e(a.desc)])),
  techwiz: (list, data) => table(['Ability', 'Needs', 'Subclass', 'Mend (support)', 'Surge (offense)'],
    list.map((a) => [`<strong>${e(a.name)}</strong>${a.brownout ? ' <span class="md-badge md-badge--danger">Brownout</span>' : ''}`, `Sync ${e(data.classes.classes.find((c) => c.id === 'techwiz').resources.levels[a.minSync])}`, e(a.subclasses.map((s) => nameOf(data.classes.classes.flatMap((c) => c.subclasses), s)).join(', ')), e(a.mend), e(a.surge)])),
  scavenger: (list, data) => table(['Ability', 'Tells', 'Subclass', 'Effect'],
    list.map((a) => [`<strong>${e(a.name)}</strong>`, a.tells ? `${a.tells} on the target` : a.gain?.target ? `+${a.gain.target} on the target` : a.gain?.spread ? `+1 on up to ${a.gain.spread}` : a.oncePerCombat ? 'once per combat' : '—', e(a.subclasses.map((s) => nameOf(data.classes.classes.flatMap((c) => c.subclasses), s)).join(', ')), e(a.desc)])),
  smuggler: (list, data) => table(['Ability', 'Needs', 'Shift', 'Subclass', 'Effect'],
    list.map((a) => [`<strong>${e(a.name)}</strong>`, a.requires == null ? e(t('engine.any')) : `${a.requires > 0 ? '≥ ' : '≤ '}${signed(a.requires)}`, 'set' in a.shift ? `= ${signed(a.shift.set)}` : signed(a.shift.delta), e(a.subclasses.map((s) => nameOf(data.classes.classes.flatMap((c) => c.subclasses), s)).join(', ')), e(a.desc)])),
};

const TABLES = {
  attributes: (d) => table(['', 'Attribute', 'Covers'], d.attributes.attributes.map((a) => [`<strong class="mono">${a.id}</strong>`, e(a.name), e(a.desc)])),
  skills: (d) => table(['Skill', 'Category', 'Attributes', 'Used for'],
    d.skills.skills.map((s) => [`<strong>${e(s.name)}</strong>`, e(nameOf(d.skills.categories, s.category)), `<span class="mono">${s.stats.join(' + ')}</span>`, e(s.desc)])),
  combat: (d) => table(['Sum of the two attributes', ...d.combat.derived.map((x) => `${x.id.toUpperCase()} (${x.stats.join('+')})`)],
    d.combat.table.map((r) => [`<span class="mono">${r.min}–${r.max}</span>`, ...d.combat.derived.map((x) => (x.id === 'off' ? signed(r[x.id]) : r[x.id]))])),
  'hit-locations': (d) => table(['d20', 'Location', 'If it gets through the armor', 'Synthetic target'], d.body.hitLocation.table.map((r) => {
    const names = [...new Set(r.locations.map((id) => t(`body.part.${d.body.locations.find((l) => l.id === id)?.bp}`)))];
    const label = r.locations.length > 1 && names.length === 1 ? t('fx.eitherSide', { name: names[0] }) : names.join(' / ');
    const bp = d.body.locations.find((l) => l.id === r.locations[0])?.bp;
    const inj = d.body.injuries;
    const cond = (id) => `<strong>${e(nameOf(d.conditions, id))}</strong>`;
    const effect = bp === 'head' ? `${cond(inj.head.condition)} · ${e(t('fx.headSevere', { severe: nameOf(d.conditions, inj.head.severe) }))}` : cond(inj[bp].condition);
    return [`<span class="mono">${r.min === r.max ? r.min : `${r.min}–${r.max}`}</span>`, e(label), effect, cond(inj.synthetic[bp])];
  })),
  cover: (d) => table(['Cover', 'Armor bonus'], d.difficulty.cover.map((c) => [e(c.name), c.armor ? `+${c.armor}` : '—'])),
  difficulty: (d) => table(['Tier', 'Penalty to TN', 'Example'], d.difficulty.tiers.map((x) => [`<strong>${x.id} · ${e(x.name)}</strong>`, `−${x.penalty}`, e(x.example)])),
  conditions: (d) => table(['Condition', 'Affects', 'Effects', 'Clears'], d.conditions.map((c) => [`<strong>${e(c.name)}</strong>`, e(c.targets), `<ul>${c.effects.map((x) => `<li>${e(x)}</li>`).join('')}</ul>`, e(c.clear)])),
  adolescence: (d) => events(d.adolescence, d),
  'career-events': (d) => events(d.careerEvents, d),
  careers: (d) => table(['Career', 'Requirements', 'Per term'],
    d.careers.careers.map((k) => [`<strong>${e(k.name === 'Standard' ? k.category : `${k.category} — ${k.name}`)}</strong>`, e(k.requirementsText),
      e(Object.entries(k.modifiers).map(([a, v]) => `${a} ${signed(v)}`).join(', ') + (k.grantsCredential ? ` · ${t('fx.credential')}: ${nameOf(d.careers.credentials, k.grantsCredential)}` : ''))])),
  aging: (d) => table(['Age', 'Each term', 'Caps', 'Death check'], d.aging.brackets.map((b) => [`<span class="mono">${b.min}–${b.max}</span>`,
    e(Object.entries(b.modifiers).map(([k, v]) => `${k} ${signed(v)}`).join(', ') || '—'), e(Object.entries(b.caps).map(([k, v]) => `${k} max ${v}`).join(', ') || '—'), b.deathCheck ? e(t('common.yes')) : '—'])),
  debts: (d) => table(['Debt', 'What happened', 'If you fail to pay'], d.debts.map((x) => [`<strong>${e(x.name)}</strong>`, e(x.debt), e(x.threat)])),
  classes: (d) => table(['Class', 'Engine', 'Subclass', 'Main stats', 'Focus'], d.classes.classes.flatMap((c) => c.subclasses.map((s, i) => [
    i === 0 ? `<strong>${e(c.name)}</strong>` : '', i === 0 ? e(c.resources.engine) : '', `<strong>${e(s.name)}</strong>`, `<span class="mono">${s.stats.join(' / ')}</span>`, e(s.desc)]))),
  economy: (d) => {
    const samples = [50, 500, 5000];
    return table(['Bought officially', ...samples.map((s) => t('fx.crItem', { n: s })), 'Street price'], Object.entries(d.economy.official.scrutiny).map(([kind, f]) => [
      `<strong>${e(t(`gear.kind.${kind}`))}</strong> <span class="muted">×${f}</span>`,
      ...samples.map((cr) => `${creditScoreCost({ cost: { cr } }, kind, d.economy)} CRS`), `×${d.economy.cash.minMultiplier}–×${d.economy.cash.maxMultiplier} ${e(t('fx.cash'))}`]));
  },
  weapons: (d) => table(['Weapon', 'Type', 'Skill', 'Damage', 'Range', 'Mag', 'Rel.', 'Rarity', 'List $', 'CRS'],
    [...d.weapons].sort((a, b) => a.cost.cr - b.cost.cr).map((w) => [`<strong>${e(w.name)}</strong><br><span class="muted">${e(w.manufacturer)}</span>`, `${e(w.type)}${w.hands === 2 ? `<br><span class="muted">${e(t('weapons.twoHanded'))}</span>` : ''}`, e(nameOf(d.skills.skills, w.skill)), `<span class="mono">${e(w.damage)}</span>`,
      `${w.range.min}–${w.range.max} m`, w.magSize || '—', `${w.reliability}/10`, rarity(w.rarity), w.cost.cr, crs(w, 'weapon', d)]), 'md-table--dense'),
  armor: (d) => table(['Armor', 'Type', 'Armor value', 'Visibility', 'Rarity', 'List $', 'CRS'],
    [...d.armor].sort((a, b) => a.cost.cr - b.cost.cr).map((a) => [`<strong>${e(a.name)}</strong><br><span class="muted">${e(a.material)}</span>`, e(a.type),
      `<span class="mono">+${a.maxHits}</span>`, `${a.visibility}/5`, rarity(a.rarity), a.cost.cr, crs(a, 'armor', d)]), 'md-table--dense'),
  items: (d) => table(['Item', 'Type', 'Effect', 'Skill bonus', 'Rarity', 'List $', 'CRS'],
    [...d.items].sort((a, b) => a.cost.cr - b.cost.cr).map((i) => [`<strong>${e(i.name)}</strong><br><span class="muted">${e(i.desc)}</span>`, e(i.effectType), e(i.effect), e(i.skillBonus), rarity(i.rarity), i.cost.cr, crs(i, 'item', d)]), 'md-table--dense'),
  decks: (d) => table(['Deck', 'RAM', 'Heat cap', 'Mod slots', 'Battery (idle / use)', 'Visibility', 'Rarity', 'List $', 'CRS'],
    [...d.decks].sort((a, b) => a.cost.cr - b.cost.cr).map((k) => [`<strong>${e(k.name)}</strong><br><span class="muted">${e(k.desc)}</span>`, k.ram, k.heatCap, k.modSlots, `${e(k.battery.idle)} / ${e(k.battery.usage)}`, `${k.visibility}/5`, rarity(k.rarity), k.cost.cr, crs(k, 'deck', d)]), 'md-table--dense'),
  optics: (d) => table(['Optic', 'Range', 'Track', 'Mode', 'Visibility', 'Rarity', 'List $', 'CRS'],
    [...d.optics].sort((a, b) => a.cost.cr - b.cost.cr).map((o) => [`<strong>${e(o.name)}</strong><br><span class="muted">${e(o.desc)}</span>`, o.range, o.track,
      o.mode ? e(nameOf(d.classes.classes.find((c) => c.id === 'scavenger').resources.modes, o.mode)) : '—', `${o.visibility}/5`, rarity(o.rarity), o.cost.cr, crs(o, 'optic', d)]), 'md-table--dense'),
  talents: (d, tree) => table(['Talent', 'Tier', 'Needs', 'Effect'],
    d.talents.filter((x) => !tree || x.tree === tree).map((x) => [
      `<strong>${e(x.name)}</strong>${x.branch ? `<br><span class="muted">${e(nameOf(d.classes.classes.flatMap((c) => c.subclasses), x.branch))}</span>` : ''}`,
      `<span class="mono">${x.tier}</span>`,
      e(Object.entries(x.needs ?? {}).map(([k, n]) => `${k} ${n}`).join(', ') || '—'),
      `${e(x.desc)}${x.kind === 'auto' ? '' : ` <span class="muted">(${e(t('progress.kind.table'))})</span>`}`,
    ]), 'md-table--dense'),
  'deck-mods': (d) => table(['Mod', 'Type', 'Adds', 'Rarity', 'List $', 'CRS'],
    d.deckMods.mods.map((m) => [`<strong>${e(m.name)}</strong>`, e(nameOf(d.deckMods.types, m.type)), `+${m.amount} ${m.type === 'ram' ? 'RAM' : 'heat cap'}`, rarity(m.rarity), m.cost.cr, crs(m, 'deckMod', d)])),
  lifestyle: (d) => table(['Category', 'Entry', 'Tier', '$ / month', 'CRS / month'],
    d.lifestyle.entries.map((x) => [e(nameOf(d.lifestyle.categories, x.category)), `<strong>${e(x.name)}</strong><br><span class="muted">${e(x.desc)}</span>`, x.tier ?? '—', x.cost.cr, crs(x, 'lifestyle', d)])),
};

const TALENT_TREES = ['survival', 'street', 'tactics', 'soldier', 'hacker', 'techwiz', 'smuggler', 'scavenger'];

export const TABLE_NAMES = [...Object.keys(TABLES), ...Object.keys(ABILITY_TABLES).map((k) => `abilities:${k}`), ...TALENT_TREES.map((k) => `talents:${k}`)];

export function renderTable(name, data) {
  if (name.startsWith('talents:')) return TABLES.talents(data, name.split(':')[1]); // one talent tree
  if (name.startsWith('abilities:')) {
    const cls = name.split(':')[1];
    return ABILITY_TABLES[cls]?.(data.abilities[cls], data) ?? `<p class="md-missing">${e(t('manual.unknownTable'))} ${e(name)}</p>`;
  }
  return TABLES[name]?.(data) ?? `<p class="md-missing">${e(t('manual.unknownTable'))} ${e(name)}</p>`;
}
