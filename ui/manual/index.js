// Manual view: #/manual, #/manual/<chapter-id>, #/manual/<section-anchor>

import { html, raw, render, delegate, cleanup } from '../dom.js';
import { t, tn, getLang } from '../../i18n/index.js';
import { renderMarkdown, slugify } from './markdown.js';
import { renderTable } from './tables.js';

const BASE = new URL('../../manual/', import.meta.url);
let cache = null;

/** Loads and renders every chapter once. Returns { manifest, chapters: [{id, title, part, html, toc}], anchors: Map<id, chapterId> }. */
export async function loadManual(data) {
  if (cache) return cache;
  const manifest = localize(await (await fetch(new URL('index.json', BASE))).json(), await translation(getLang()));
  const list = manifest.parts.flatMap((p) => p.chapters.map((c) => ({ ...c, part: p.title })));
  const texts = await Promise.all(list.map(async (c) => (await fetch(new URL(`chapters/${c.dir ?? ''}${c.file}`, BASE))).text()));
  const anchors = new Map();
  const chapters = list.map((c, i) => {
    const { html: body, toc } = renderMarkdown(texts[i], {
      table: (name) => renderTable(name, data),
      image: (src) => new URL(src, BASE).href,
    });
    toc.forEach((t) => anchors.set(t.id, c.id));
    return { ...c, html: body, toc, sections: splitSections(texts[i], c) };
  });
  cache = { manifest, chapters, anchors };
  return cache;
}

/** <lang>/index.json: translated titles + which chapter files exist in chapters/<lang>/ (others stay English). */
async function translation(lang) {
  if (lang === 'en') return null;
  try {
    const res = await fetch(new URL(`${lang}/index.json`, BASE));
    return res.ok ? { lang, ...(await res.json()) } : null;
  } catch {
    return null;
  }
}

function localize(manifest, tr) {
  if (!tr) return manifest;
  return {
    ...manifest,
    title: tr.title ?? manifest.title,
    parts: manifest.parts.map((p, i) => ({
      ...p,
      title: tr.parts?.[i] ?? p.title,
      chapters: p.chapters.map((c) => (tr.chapters?.[c.id] ? { ...c, title: tr.chapters[c.id], dir: `${tr.lang}/` } : c)),
    })),
  };
}

const strip = (s) => s.replace(/::table\[[^\]]*\]|!\[[^\]]*\]\([^)]*\)|[#*>`|_]/g, ' ').replace(/\s+/g, ' ').trim();

/** Splits a chapter's markdown into searchable sections at level-2/3 headings. */
function splitSections(md, chapter) {
  const sections = [];
  let cur = { id: chapter.id, title: chapter.title, text: '' };
  for (const line of md.split(/\r?\n/)) {
    const h = line.match(/^#{2,3} (.*?)(?:\s*\{#([\w-]+)\})?\s*$/);
    if (h) {
      sections.push(cur);
      cur = { id: h[2] ?? slugify(h[1]), title: h[1], text: '' };
    } else {
      cur.text += ` ${line}`;
    }
  }
  sections.push(cur);
  return sections.map((x) => ({ ...x, text: strip(x.text) })).filter((x) => x.text);
}

function search(chapters, query) {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const results = [];
  for (const chapter of chapters) {
    for (const section of chapter.sections) {
      const at = section.text.toLowerCase().indexOf(q);
      const inTitle = section.title.toLowerCase().includes(q);
      if (at === -1 && !inTitle) continue;
      const snippet = at === -1 ? section.text.slice(0, 140) : section.text.slice(Math.max(0, at - 60), at + q.length + 90);
      results.push({ chapter, section, inTitle, snippet });
    }
  }
  return results.sort((a, b) => b.inTitle - a.inTitle).slice(0, 40);
}

export function manualView({ data, main }, route) {
  const target = route.params[0] ?? '';
  let query = '';
  let state = null;

  const draw = () => {
    if (!state) {
      render(main, html`<div class="empty"><div class="empty__title">Opening the manual…</div></div>`);
      return;
    }
    const chapterId = state.anchors.get(target) ?? (state.chapters.some((c) => c.id === target) ? target : state.chapters[0].id);
    const chapter = state.chapters.find((c) => c.id === chapterId);
    const idx = state.chapters.indexOf(chapter);
    const prev = state.chapters[idx - 1];
    const next = state.chapters[idx + 1];
    const results = search(state.chapters, query);
    render(main, html`
      <div class="manual">
        <aside class="manual-nav" aria-label="${t('manual.contents')}">
          <input class="input manual-search" type="search" placeholder="${t('manual.searchPlaceholder')}" value="${query}" data-action="search" aria-label="${t('manual.search')}">
          ${state.manifest.parts.map((p) => html`
            <div class="manual-nav__part">
              <span class="label">${p.title}</span>
              ${state.chapters.filter((c) => c.part === p.title).map((c) => html`
                <details class="manual-nav__chapter" ${c.id === chapterId ? raw('open') : ''}>
                  <summary><a href="#/manual/${c.id}" ${c.id === chapterId ? raw('aria-current="page"') : ''}>${c.title}</a></summary>
                  <ul>${c.toc.filter((x) => x.level === 2).map((x) => html`<li><a href="#/manual/${x.id}">${x.text}</a></li>`)}</ul>
                </details>`)}
            </div>`)}
        </aside>
        <article class="manual-body">
          ${query.trim().length >= 2 ? html`
            <section class="card manual-results">
              <header class="card__head"><h2 class="card__title">${t('common.search')}<small>${tn('manual.results', results.length, { query })}</small></h2>
                <button class="btn btn--sm btn--ghost" data-action="clear">${t('manual.clear')}</button></header>
              <div class="rows">${results.map((r) => html`
                <a class="row row--link" href="#/manual/${r.section.id}">
                  <div class="row__main"><div class="row__title">${r.section.title} <span class="muted">· ${r.chapter.title}</span></div><div class="row__meta">…${r.snippet}…</div></div>
                </a>`)}
              ${results.length ? '' : html`<p class="empty">${t('common.noMatch')}</p>`}</div>
            </section>` : ''}
          <div class="prose manual-prose">${raw(chapter.html)}</div>
          <nav class="manual-pager">
            ${prev ? html`<a class="btn" href="#/manual/${prev.id}">← ${prev.title}</a>` : html`<span></span>`}
            ${next ? html`<a class="btn btn--primary" href="#/manual/${next.id}">${next.title} →</a>` : ''}
          </nav>
        </article>
      </div>`);
    if (target && target !== chapterId) {
      const el = document.getElementById(target);
      if (el) { el.scrollIntoView({ block: 'start' }); el.classList.add('is-target'); }
    }
  };

  const offInput = delegate(main, 'input', {
    search: (_, e) => {
      query = e.target.value;
      const pos = e.target.selectionStart;
      draw();
      const box = main.querySelector('[data-action="search"]');
      box?.focus();
      box?.setSelectionRange(pos, pos);
    },
  });
  const offClick = delegate(main, 'click', { clear: () => { query = ''; draw(); } });

  draw();
  loadManual(data).then((m) => { state = m; draw(); }).catch((err) => {
    render(main, html`<div class="empty"><div class="empty__title">${t('manual.failed')}</div><p>${err.message}</p></div>`);
  });
  return cleanup(offInput, offClick);
}
