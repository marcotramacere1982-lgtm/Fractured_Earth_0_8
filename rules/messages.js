// Messages from the rules that the player reads: a code + values the screen words in its language,
// plus the English text (used in saved logs, the GM console and as a fallback).

/** A message: { code, vars, text }. */
export const message = (code, vars, text) => ({ code, vars, text });

/** A refusal the screen can translate: catch it and show ruleText(err). */
export class RuleError extends Error {
  constructor(code, vars, text) {
    super(text);
    this.code = code;
    this.vars = vars;
  }
}
