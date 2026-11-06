// The Case tab's clicks (decisions 278–279): pick a mission, switch Dossier / Board, open an entry or a card, and —
// for the board's editor — add, move, link, edit, unpin and restore cards, pass the pen. Anyone suggests.

import { html } from '../dom.js';
import { openDialog, openChoice } from './dialogs.js';
import { t } from '../../i18n/index.js';
import { caseUi, currentBoard } from './case-tab.js';
import { board as boardOf, TYPES, SIZES, freeSpot } from '../../rules/case-board.js';
import { ICON } from '../case/board.js';

/** ctx: { table, id (this character), toast, redraw } */
export function caseHandlers({ table, id, toast, redraw, character }) {
  const cs = () => table?.state.case;
  const key = () => currentBoard(cs());
  const b = () => boardOf(cs(), key());
  const op = async (body) => {
    const r = await table.caseOp({ board: key(), ...body });
    if (!r?.ok) toast(t(`case.why.${r?.why ?? 'offline'}`), 'danger');
    return r?.ok;
  };
  const entries = () => cs()?.dossier[key()]?.entries ?? [];
  /** The pictures this player can pin: the dossier's, and any handout they got themselves (a private one too — pinning shares it). */
  const pictures = () => {
    const seen = new Map();
    for (const e of entries()) if (e.image) seen.set(e.image, e.title);
    const mine = [...(character?.()?.play?.pictures ?? []), ...(character?.()?.play?.inbox ?? []).map((m) => ({ image: m.image, title: m.text?.split(/\r?\n/)[0] }))]; // every picture received, read or not
    for (const p of mine) if (p.image && !seen.has(p.image)) seen.set(p.image, p.title?.slice(0, 60) || t('case.handout'));
    return [...seen].map(([image, title]) => ({ image, title }));
  };

  /** The card window: read it whole; the editor edits it here too. */
  function cardWindow(c, { edit = false, at = null } = {}) {
    const f = { type: c?.type ?? 'clue', size: c?.size ?? 's', title: c?.title ?? '', text: c?.text ?? '', image: c?.image ?? '', entry: c?.entry ?? '' };
    const pics = pictures();
    const d = openDialog(() => html`<header class="card__head"><h2 class="card__title">${edit ? (c ? t('case.edit') : t('case.newCard')) : html`${ICON[f.type]} ${f.title || t('case.card')}`}</h2>
        <button class="btn btn--ghost btn--icon" data-action="close" aria-label="${t('common.close')}">✕</button></header>
      <div class="dialog__body stack">${edit ? html`
        <div class="segmented" role="group">${TYPES.map((x) => html`<button class="segmented__opt" data-action="type" data-v="${x}" aria-pressed="${f.type === x}">${ICON[x]} ${t(`case.type.${x}`)}</button>`)}</div>
        <div class="segmented" role="group">${Object.keys(SIZES).map((x) => html`<button class="segmented__opt" data-action="size" data-v="${x}" aria-pressed="${f.size === x}">${t(`case.size.${x}`)}</button>`)}</div>
        <label class="field"><span class="label">${t('case.cardTitle')}</span><input class="input" maxlength="60" data-f="title" value="${f.title}"></label>
        <label class="field"><span class="label">${t('case.cardText')}</span><textarea class="textarea" rows="4" maxlength="600" data-f="text">${f.text}</textarea></label>
        <div class="stack stack--tight"><span class="label">🖼 ${t('case.picture')}</span>${pics.length ? html`<div class="case-pics">
          <button class="btn btn--sm ${f.image ? '' : 'btn--primary'}" data-action="pic" data-v="">${t('case.noPicture')}</button>
          ${pics.map((e) => html`<button class="case-pic ${f.image === e.image ? 'is-on' : ''}" data-action="pic" data-v="${e.image}" title="${e.title}"><img src="${e.image}" alt="${e.title}"></button>`)}</div>` : html`<p class="hint">${t('case.noPictures')}</p>`}</div>
        <div class="cluster"><button class="btn btn--primary" data-action="save">${t('case.save')}</button><button class="btn btn--ghost" data-action="close">${t('common.cancel')}</button></div>`
        : html`${f.image ? html`<img class="case-full" src="${f.image}" alt="">` : ''}${f.text ? html`<p class="case-fulltext">${f.text}</p>` : ''}
          ${c?.tip ? html`<p class="muted st-small">${t('case.tip')}</p>` : c?.by ? html`<p class="muted st-small">${t('case.by', { name: c.by })}</p>` : ''}`}
      </div>`, {
      click: {
        type: ({ v }) => { read(); f.type = v; d.redraw(); },
        size: ({ v }) => { read(); f.size = v; d.redraw(); },
        pic: ({ v }) => { read(); f.image = v; if (v && f.size !== 'b') f.size = 'b'; if (v && !f.title) f.title = pics.find((e) => e.image === v)?.title ?? ''; d.redraw(); },
        async save() {
          read();
          const fields = { type: f.type, size: f.size, title: f.title.trim(), text: f.text, ...(f.image ? { image: f.image } : {}) };
          const spot = at ?? freeSpot(b(), { ...fields, id: '' }) ?? { x: 0, y: 0 };
          if (await (c ? op({ op: 'edit', card: c.id, fields }) : op({ op: 'add', card: { ...fields, ...spot } }))) d.close();
        },
      },
    });
    function read() { const v = (k) => d.el.querySelector(`[data-f=${k}]`)?.value; if (v('title') != null) f.title = v('title'); if (v('text') != null) f.text = v('text'); }
  }

  return {
    caseView: ({ v }) => { caseUi.view = v; caseUi.mode = null; redraw(); },
    caseZoom: ({ d }) => { caseUi.zoom = Math.max(0.5, Math.min(1.5, (caseUi.zoom ?? 1) + Number(d) * 0.25)); redraw(); },
    caseEntry: ({ id: eid }) => {
      const e = entries().find((x) => x.id === eid);
      if (!e) return;
      const mine = b().editor === id;
      const d = openDialog(() => html`<header class="card__head"><h2 class="card__title">${e.title}</h2><button class="btn btn--ghost btn--icon" data-action="close" aria-label="${t('common.close')}">✕</button></header>
        <div class="dialog__body stack">${e.image ? html`<img class="case-full" src="${e.image}" alt="">` : ''}${e.text ? html`<p class="case-fulltext">${e.text}</p>` : ''}
          ${mine ? html`<button class="btn btn--primary" data-action="pin">📌 ${t('case.pin')}</button>` : ''}</div>`, {
        click: {
          async pin() { // decision 279: the dossier entry as a card — a handout as a big picture card
            const fields = { type: e.kind === 'person' ? 'person' : e.kind === 'place' ? 'place' : e.image ? 'document' : 'clue', size: e.image ? 'b' : 'w', title: e.title.slice(0, 60), text: (e.text ?? '').slice(0, 600), ...(e.image ? { image: e.image } : {}) };
            const spot = freeSpot(b(), { ...fields, id: '' }) ?? { x: 0, y: 0 };
            if (await op({ op: 'add', card: { ...fields, ...spot } })) { d.close(); toast(t('case.pinned'), 'success'); }
          },
        },
      });
    },
    caseCard: async ({ id: cid }) => {
      const mine = b().editor === id;
      if (mine && caseUi.mode === 'link' && caseUi.selected && caseUi.selected !== cid) {
        const label = window.prompt(t('case.linkLabel'), '') ?? '';
        if (await op({ op: 'link', a: caseUi.selected, b: cid, label })) { caseUi.mode = null; redraw(); }
        return;
      }
      if (caseUi.selected === cid || !mine) cardWindow(b().cards.find((x) => x.id === cid));
      caseUi.selected = cid; caseUi.mode = null; redraw();
    },
    caseCell: async ({ x, y }) => {
      if (caseUi.mode === 'move' && caseUi.selected && await op({ op: 'move', card: caseUi.selected, x: Number(x), y: Number(y) })) { caseUi.mode = null; redraw(); }
    },
    caseMode: ({ m }) => { caseUi.mode = caseUi.mode === m ? null : m; redraw(); },
    caseAdd: () => cardWindow(null, { edit: true }),
    caseEdit: () => { const c = b().cards.find((x) => x.id === caseUi.selected); if (c) cardWindow(c, { edit: true }); },
    caseUnpin: async () => { if (caseUi.selected && await op({ op: 'unpin', card: caseUi.selected })) { caseUi.selected = null; redraw(); } },
    caseDrawer: () => openChoice(t('case.drawerTitle'), b().drawer.map((c) => ({ value: c.id, label: `${ICON[c.type]} ${c.title || c.text.slice(0, 30)}`, sub: t('case.restore') })), (cid) => op({ op: 'restore', card: cid, x: -1, y: -1 })),
    casePass: async () => {
      const mates = (await table.players()).filter((p) => p.id !== id);
      if (!mates.length) { toast(t('strain.steadyNobody'), 'danger'); return; }
      openChoice(t('case.pass'), mates.map((p) => ({ value: p.id, label: p.name })), (to) => op({ op: 'pass', to }));
    },
    caseTakePen: () => op({ op: 'claim' }),
    caseSuggest: async () => { const text = window.prompt(t('case.suggestAsk'), ''); if (text?.trim() && await op({ op: 'suggest', text: text.trim() })) toast(t('case.suggested'), 'success'); },
  };
}

/** The board picker (a change). */
export const caseChanges = (redraw) => ({ caseBoardPick: (_, e) => { caseUi.board = e.target.value; caseUi.selected = null; caseUi.mode = null; redraw(); } });
