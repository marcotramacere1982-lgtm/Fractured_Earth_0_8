// Words a rule message (RuleError, a { code, vars } reason or check) in the interface language.
// Anything without a known code falls back to its English text.

import { t, hasKey } from '../i18n/index.js';

export function ruleText(m) {
  if (!m) return '';
  const key = m.code ? `rule.${m.code}` : null;
  if (key && hasKey(key)) return t(key, m.vars ?? {});
  return m.text ?? m.reason ?? m.label ?? m.message ?? '';
}
