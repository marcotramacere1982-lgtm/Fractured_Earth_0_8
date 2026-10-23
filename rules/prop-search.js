// Library search (decision 115): every word must match the start of a word in the piece's name or one of its
// tags ("tree" no longer finds "street"); chosen tag chips must all be on the piece. Pure, so tests can use it.
import { tagsOf } from './props.js';

const words = (s) => String(s).toLowerCase().split(/[^a-z0-9×½]+/i).filter(Boolean);

/** The words a piece answers to: its name, its tags (ids and names). */
export function pieceWords(data, d) {
  const tags = tagsOf(d);
  const names = [...(data.props.tags ?? []), ...(data.props.autoTags ?? [])].filter((t) => tags.includes(t.id)).map((t) => t.name);
  return [...words(d.name), ...tags.flatMap((t) => [t, ...words(t)]), ...names.flatMap(words)];
}

/** query: free text (a leading # is ignored); chips: tag ids that must all be on the piece. */
export function matchPieces(data, query = '', chips = []) {
  const terms = words(query.replace(/#/g, ' '));
  return data.props.props.filter((d) => {
    if (chips.length && !chips.every((c) => tagsOf(d).includes(c))) return false;
    if (!terms.length) return true;
    const w = pieceWords(data, d);
    return terms.every((t) => w.some((x) => x.startsWith(t)));
  });
}
