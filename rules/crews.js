// Crews inside a campaign (decision 326): two groups of players in one world, on different nights. A character has one
// home crew (the GM sets it); a mission belongs to one crew or several (`crews`) and may take guests from another
// (`guests`, character ids). The mission on the table tonight decides who plays: its crews' members and its guests.
// A campaign with no crews — or a mission with none set — plays as before: everyone. Pure: the server and the console share it.

/** The mission on the table and who it is for: { mission, crews: [crewId], guests: [characterId] }. */
export function tonight(campaign) {
  const m = (campaign?.missions ?? []).find((x) => x.id === campaign?.activeMissionId) ?? null;
  return { mission: m?.id ?? null, crews: Array.isArray(m?.crews) ? m.crews : [], guests: Array.isArray(m?.guests) ? m.guests : [] };
}

/**
 * Does this character play tonight? crews: the campaign's crews; home: { characterId: crewId }; t: tonight().
 * A character with no home crew yet plays (the GM places them).
 */
export function playsTonight(crews, home, t, characterId) {
  if (!crews?.length || !t?.crews?.length) return true;
  const h = home?.[characterId];
  if (!h) return true;
  return t.crews.includes(h) || t.guests.includes(characterId);
}

/** Is this character a guest tonight (in the roster, from another crew)? */
export const isGuest = (home, t, characterId) => Boolean(t?.guests?.includes(characterId) && home?.[characterId] && !t.crews.includes(home[characterId]));

/** A crew's name, "Crew A" when it has only its letter. */
export const crewLabel = (crew) => (crew ? (/^[A-Z]$/.test(crew.name) ? `Crew ${crew.name}` : crew.name) : '');

/** Mission crews and guests cleaned against the campaign's crews. */
export function cleanMissionCrews(crews, ids, guests) {
  const known = new Set((crews ?? []).map((c) => c.id));
  return { crews: [...new Set((ids ?? []).filter((x) => known.has(x)))], guests: [...new Set((guests ?? []).filter((x) => typeof x === 'string' && x.length < 80))] };
}
