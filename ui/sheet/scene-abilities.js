// Decision 322: abilities at the investigation table. Out of a fight the scene picture shows a thin strip — *What you
// can do here* — with this character's equipped out-of-fight abilities (and the Ping, which works out of a fight too),
// each with the uses left; a tap is the Class tab's own (abilityRoll). And when the GM asks for a skill an ability
// can stand in for (Read the Room for Perception…), the roll-call card offers it beside the plain roll.

import { html } from '../dom.js';
import { t } from '../../i18n/index.js';
import { ruleText } from '../rule-text.js';
import { engineSnapshot } from './engine.js';
import { outOfFight, standsIn } from '../../rules/engines.js';

/** The equipped (and housekeeping) abilities that work out of a fight, each with its check. */
function pool(c, s, data) {
  if (!c.classId || !s.class) return { list: [], ctx: {} };
  const snap = engineSnapshot(c, s, data);
  return { list: [...snap.equipped, ...snap.chores].filter(outOfFight), ctx: snap.ctx };
}

const left = (a, ctx) => (a.perMission ? a.perMission - (ctx.missionUses?.[a.id] ?? 0) : a.perScene ? a.perScene - (ctx.sceneUses?.[a.id] ?? 0) : null);
const limit = (a, ctx) => { const n = left(a, ctx); return n == null ? '' : t(a.perMission ? 'sceneAb.perMission' : 'sceneAb.perScene', { n: Math.max(0, n) }); };

/** The abilities usable now that may answer a roll on this skill: [{ a, limit }]. */
export function standInsFor(c, s, data, skillId) {
  const { list, ctx } = pool(c, s, data);
  return list.filter((a) => standsIn(a, skillId) && a.check.ok).map((a) => ({ a, limit: limit(a, ctx) }));
}

/** The strip under the scene picture; '' in a fight or with nothing to show. */
export function sceneAbilities(c, s, data) {
  if (c.play.turn?.inCombat) return '';
  const { list, ctx } = pool(c, s, data);
  if (!list.length) return '';
  return html`<div class="scene-abilities" data-tour="scene-abilities"><span class="label">${t('sceneAb.title')}</span>
    <span class="cluster">${list.map((a) => {
      const n = limit(a, ctx);
      return html`<button class="btn btn--sm" data-action="abilityRoll" data-id="${a.id}" ${a.check.ok ? '' : 'disabled'} title="${a.check.ok ? a.desc : ruleText(a.check)}">${a.name}${n ? html` <span class="muted st-small">· ${n}</span>` : ''}</button>`;
    })}</span></div>`;
}
