// Keeps only simple formatting from pasted HTML (LLM backstories): text, p, h3/h4, em/strong, lists, br.

const ALLOWED = new Set(['P', 'H3', 'H4', 'EM', 'STRONG', 'B', 'I', 'UL', 'OL', 'LI', 'BR']);

export function sanitizeHtml(input) {
  const doc = new DOMParser().parseFromString(`<div>${input ?? ''}</div>`, 'text/html');
  const walk = (node) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        walk(child);
        if (!ALLOWED.has(child.tagName)) child.replaceWith(...child.childNodes);
        else [...child.attributes].forEach((a) => child.removeAttribute(a.name));
      } else if (child.nodeType !== Node.TEXT_NODE) {
        child.remove();
      }
    }
  };
  const root = doc.body.firstElementChild;
  walk(root);
  return root.innerHTML;
}
