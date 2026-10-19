// Backstory written by the GM's Claude (decision 50): the sheet asks, the GM sends it back as a durable message.

import { log } from './actions.js';

export const storyActions = {
  /** The request went to the GM: the Dossier says so until the backstory arrives. */
  backstoryAsked(c, _d, { mode = 'write' }) {
    c.narrative.backstoryRequest = { at: Date.now(), mode };
    log(c, mode === 'revise' ? 'Asked the GM to polish the backstory' : 'Asked the GM for a backstory');
  },
  /** The GM's `backstory` message. The previous text is kept, in case the player liked theirs better. */
  applyBackstory(c, _d, { msg }) {
    if (typeof msg.html !== 'string' || !msg.html.trim()) return false;
    const before = c.narrative.backstoryHtml ?? '';
    if (before.trim() && before !== msg.html) c.narrative.backstoryPrevious = before;
    c.narrative.backstoryHtml = msg.html;
    delete c.narrative.backstoryRequest;
    log(c, 'GM: backstory delivered (Dossier)', 'ok');
    return true;
  },
  /** Back to the text the player had before the GM's version. */
  backstoryUndo(c) {
    if (!c.narrative.backstoryPrevious) return;
    [c.narrative.backstoryHtml, c.narrative.backstoryPrevious] = [c.narrative.backstoryPrevious, c.narrative.backstoryHtml];
  },
};
