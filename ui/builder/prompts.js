// AI prompts compiled from the finished build: a backstory prompt for an LLM and a portrait prompt for an image model.

import { findSubclass } from '../../rules/classes.js';
import { getLang } from '../../i18n/index.js';

// The prompt stays English (any AI understands it); only the requested output language changes.
const LANGUAGE_LINE = {
  it: '\n\nLANGUAGE: write the backstory in Italian. Keep game terms in English (class and subclass names, Credit Score, Grey Zones, Operator, the Hum).',
};

const eventName = (list, id) => list.find((e) => e.id === id);

/** Appearance & manner (decision 94), only what the player filled in: [["gender", "woman"], …]. */
const lookOf = (c) => Object.entries(c.narrative?.look ?? {}).map(([k, v]) => [k, String(v ?? '').trim()]).filter(([, v]) => v);
const LOOK_LABEL = { gender: 'gender', build: 'build', hair: 'hair', eyes: 'eyes', marks: 'marks / distinctive signs', attitude: 'attitude' };

/** One career term for the prompt, with how it went under the entry roll (decision 93). */
function termLine(h, data) {
  const name = (id) => { const k = data.careers.careers.find((x) => x.id === id); return k ? `${k.category}${k.name !== 'Standard' ? ` (${k.name})` : ''}` : id; };
  const evs = h.events.map((e) => eventName(data.careerEvents.events, e.eventId)?.name).filter(Boolean);
  const how = h.forced ? `${name(h.careerId)} — fired, two years out of work`
    : h.tried ? `rejected by ${name(h.tried)}, spent the two years as ${name(h.careerId)}`
      : name(h.careerId);
  return `${how}${evs.length ? ` — events: ${evs.join(', ')}` : ''}`;
}

/** lang: the language the backstory is written in (default: the interface language). */
export function storyPrompt(c, data, lang = getLang()) {
  const sub = c.subclassId ? findSubclass(data.classes, c.subclassId) : null;
  const adolescence = c.history.adolescence.map((h) => eventName(data.adolescence.events, h.eventId)).filter(Boolean);
  const careers = c.history.careers.map((h) => termLine(h, data));
  const look = lookOf(c);
  const debt = data.debts.find((d) => d.id === c.debtId);
  return `Write a grounded, gritty backstory (300–500 words) for a character in "Fractured Earth", a hard science-fiction RPG set about twenty years from now.

SETTING (keep it consistent):
- No glowing cyberpunk clichés. The world is administrative, exhausted and quietly oppressive: corporate cartels (the Euro-Grid Syndicate, the Avalon-Collins Liquidity Ledger, Centurion-Vanguard "The Watch") run infrastructure, money and security after the Three Years War.
- Lower classes live on Credit Score debt, company scrip and street barter; physical cash is illegal but used everywhere.
- People hear "the Hum" and suffer "the Clinical Static" (night terrors of cold geometric shapes), treated with neural-dampeners.
- The character is an Operator: a freelancer working deniable jobs from the unmonitored Grey Zones.

CHARACTER:
- Name: ${c.name || 'Unnamed'} · Age: ${c.age}
- Role: ${sub ? `${sub.cls.name} (${sub.sub.name}) — ${sub.sub.desc}` : 'not chosen yet'}
- Attributes: ${Object.entries(c.attributes).map(([k, v]) => `${k} ${v}`).join(', ')}
- Youth (to age 15): ${adolescence.map((e) => `${e.name}: ${e.text}`).join(' | ') || 'uneventful'}
- Career path (2 years per term; every job had to be won with an entry test, and a rejection meant two years out of work): ${careers.join(' → ') || 'none, hit the streets at 15'}${c.tags.includes('Career ended') ? ' — the career path ended early (see Notable)' : ''}
- Credentials: ${c.credentials.join(', ') || 'none'} · Criminal record: ${c.criminalRecord ? 'yes' : 'no'}
- Notable: ${c.tags.filter((t) => t !== 'Career ended').join(', ') || 'none'}
- Special debt (the reason they take dangerous jobs): ${debt ? `${debt.name} — ${debt.debt}` : 'none'}
- Appearance & manner (the player's own words — use them, don't contradict them): ${look.map(([k, v]) => `${LOOK_LABEL[k] ?? k}: ${v}`).join('; ') || 'not given — keep descriptions light'}${c.drive?.line ? `
- Drive: ${c.drive.type ?? ''} — ${c.drive.line}` : ''}

FORMAT: plain HTML only — start with <h3>Backstory</h3>, then 5–6 <p> paragraphs. No markdown, no code fences, no other tags.${LANGUAGE_LINE[lang] ?? ''}`;
}

export function portraitPrompt(c, data) {
  const sub = c.subclassId ? findSubclass(data.classes, c.subclassId) : null;
  const lastCareer = data.careers.careers.find((k) => k.id === c.history.careers.at(-1)?.careerId);
  const role = lastCareer ? `${lastCareer.category.split('/')[0].trim().toLowerCase()} ${lastCareer.name !== 'Standard' ? lastCareer.name.toLowerCase() : ''}`.trim() : 'street survivor';
  const scars = [...c.history.adolescence, ...c.history.careers.flatMap((h) => h.events)]
    .map((h) => h.eventId).some((id) => /disabled|bone|concussion|crime|hard_labor/.test(id));
  const ageBand = c.age < 22 ? 'early twenties' : c.age < 30 ? 'late twenties' : c.age < 40 ? 'in their thirties' : 'middle-aged';
  const look = Object.fromEntries(lookOf(c));
  const who = [look.gender, look.build ? `${look.build} build` : ''].filter(Boolean).join(', ');
  const face = [look.hair ? `${look.hair} hair` : '', look.eyes ? `${look.eyes} eyes` : '', look.marks, look.attitude ? `expression: ${look.attitude}` : ''].filter(Boolean).join(', ');
  const missing = ['gender', 'build', 'hair', 'eyes', 'marks'].filter((k) => !look[k]).map((k) => LOOK_LABEL[k]);
  return `35mm candid documentary photograph, portrait of a tired ${ageBand} ${role}${who ? ` (${who})` : ''}${sub ? `, now a ${sub.cls.name.toLowerCase()} for hire` : ''}, ${face ? `${face}, ` : ''}${scars ? 'old scars and a hard-worn face, ' : ''}cheap plastic smart glasses, layered worn workwear with scratched corporate patches, rainy concrete alley under dripping plastic awnings, flickering amber AR notices, overcast light, film grain, realistic skin texture, muted palette --ar 2:3 --style raw${missing.length ? `

[Add: ${missing.join(', ')}]` : ''}`;
}
