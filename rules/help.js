// Helping a crewmate (decision 270). One crewmate who can say how they help rolls a related skill: a success gives
// the other a TN bonus on their next skill or attribute check, a natural 20 means they got in the way (a penalty),
// any other failure changes nothing. One helper at a time: a second one adds nothing. Numbers in data.difficulty.help.
// Pure.

/** What a helper's roll gives: d.success, d.fumble or 0. result: rules/checks resolveCheck's. */
export function helpFrom(result, d) {
  if (!result || !d) return 0;
  if (result.natural === 'crit-failure') return d.fumble;
  return result.success ? d.success : 0;
}

/** Can this help land? Not when another helper's bonus is still waiting. */
export const canTakeHelp = (play) => !play?.help;
