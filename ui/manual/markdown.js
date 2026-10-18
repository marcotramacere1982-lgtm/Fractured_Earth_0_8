// Minimal Markdown renderer for the manual (no dependencies, pure: string in, string out).
// Supports: # headings {#id}, paragraphs, - lists, 1. lists, > callouts, ![caption](src) figures,
// pipe tables, ``` code blocks, **bold**, *italic*, `code`, [text](link), and ::table[name] directives.

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const esc = (s) => s.replace(/[&<>"]/g, (c) => ESC[c]);

export const slugify = (s) => s.toLowerCase().replace(/<[^>]+>/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function inline(text) {
  let s = esc(text);
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*\s][^*]*?)\*(?!\*)/g, '$1<em>$2</em>');
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, url) => {
    const safe = /^(https?:|#|\.\/|[\w-]+\.)/.test(url) ? url : '#';
    const ext = /^https?:/.test(safe) ? ' target="_blank" rel="noopener"' : '';
    return `<a href="${safe}"${ext}>${label}</a>`;
  });
  return s;
}

/**
 * @param {string} md
 * @param {{ table?: (name: string) => string, image?: (src: string) => string }} hooks
 * @returns {{ html: string, toc: {level: number, id: string, text: string}[] }}
 */
export function renderMarkdown(md, hooks = {}) {
  const lines = md.replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  const toc = [];
  let i = 0;

  const isBlockStart = (l) => /^(#{1,6} |[-*] |\d+\. |> |!\[|\||```|::table\[)/.test(l) || l.trim() === '';

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === '') { i++; continue; }

    // code fence
    if (line.startsWith('```')) {
      const body = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) body.push(lines[i++]);
      i++;
      out.push(`<pre><code>${esc(body.join('\n'))}</code></pre>`);
      continue;
    }

    // heading
    const h = line.match(/^(#{1,6}) (.*?)(?:\s*\{#([\w-]+)\})?\s*$/);
    if (h) {
      const level = h[1].length;
      const text = h[2];
      const id = h[3] ?? slugify(text);
      toc.push({ level, id, text });
      out.push(`<h${level} id="${id}">${inline(text)}</h${level}>`);
      i++;
      continue;
    }

    // data table directive
    const d = line.match(/^::table\[([\w:-]+)\]\s*$/);
    if (d) {
      out.push(hooks.table ? hooks.table(d[1]) : `<div class="md-missing">[table ${esc(d[1])}]</div>`);
      i++;
      continue;
    }

    // figure
    const img = line.match(/^!\[([^\]]*)\]\(([^)\s]+)\)\s*$/);
    if (img) {
      const src = hooks.image ? hooks.image(img[2]) : img[2];
      out.push(`<figure class="md-figure"><img src="${esc(src)}" alt="${esc(img[1])}" loading="lazy">${img[1] ? `<figcaption>${inline(img[1])}</figcaption>` : ''}</figure>`);
      i++;
      continue;
    }

    // pipe table
    if (line.startsWith('|')) {
      const rows = [];
      while (i < lines.length && lines[i].startsWith('|')) rows.push(lines[i++]);
      const cells = (r) => r.replace(/^\||\|\s*$/g, '').split('|').map((c) => c.trim());
      const [head, , ...body] = rows;
      out.push(`<div class="md-table-wrap"><table class="md-table"><thead><tr>${cells(head).map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${
        body.map((r) => `<tr>${cells(r).map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
      continue;
    }

    // callout (blockquote)
    if (line.startsWith('> ')) {
      const block = [];
      while (i < lines.length && (lines[i].startsWith('> ') || lines[i] === '>')) block.push(lines[i++].replace(/^> ?/, ''));
      out.push(`<aside class="md-callout">${renderMarkdown(block.join('\n'), hooks).html}</aside>`);
      continue;
    }

    // lists
    if (/^([-*]|\d+\.) /.test(line)) {
      const ordered = /^\d+\./.test(line);
      const items = [];
      while (i < lines.length && /^([-*]|\d+\.) /.test(lines[i])) {
        let item = lines[i++].replace(/^([-*]|\d+\.) /, '');
        while (i < lines.length && /^\s{2,}\S/.test(lines[i])) item += ` ${lines[i++].trim()}`;
        items.push(`<li>${inline(item)}</li>`);
        while (i < lines.length && lines[i].trim() === '' && /^([-*]|\d+\.) /.test(lines[i + 1] ?? '')) i++;
      }
      out.push(ordered ? `<ol>${items.join('')}</ol>` : `<ul>${items.join('')}</ul>`);
      continue;
    }

    // paragraph
    const para = [line];
    i++;
    while (i < lines.length && !isBlockStart(lines[i])) para.push(lines[i++]);
    out.push(`<p>${inline(para.join(' '))}</p>`);
  }

  return { html: out.join('\n'), toc };
}
