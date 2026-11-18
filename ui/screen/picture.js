// The TV's picture view (owner 2026-11-16): a scene picture the GM sent to everyone, fitted to the screen, with
// zoom and pan — drag, the mouse wheel, or the bar's − / Fit / + — so a detail can be shown to the whole table.
// Decision 338: the players' pins on it (who points where), by percent of the picture, moving with zoom and pan.
// The TV only shows: no taps.

const STEP = 1.25;
const MAX = 6;

/** host: an element that fills the stage. Returns { show(view), clear(), zoom(dir), fit(), shown() }. */
export function createPictureViewer(host) {
  host.innerHTML = '<div class="tv-pic__frame"><img class="tv-pic__img" alt="" draggable="false"><div class="tv-pic__pins"></div></div><p class="tv-pic__caption" hidden></p>';
  const frame = host.querySelector('.tv-pic__frame'); // exactly the painted picture (container units): zoom, pan and pins move together
  const img = host.querySelector('img');
  const pinLayer = host.querySelector('.tv-pic__pins');
  const caption = host.querySelector('p');
  let cam = { s: 1, x: 0, y: 0 };
  let current = null;
  const drag = new Map(); // pointerId -> last point
  let pinch = 0; // the last distance between two fingers

  const apply = () => { frame.style.transform = `translate(${cam.x}px, ${cam.y}px) scale(${cam.s})`; pinLayer.style.setProperty('--tv-zoom', String(cam.s)); };
  /** Zoom by k around a point of the stage (client coordinates); the point stays under the finger. */
  function zoomAt(k, cx, cy) {
    const s = Math.min(MAX, Math.max(1, cam.s * k));
    const r = host.getBoundingClientRect();
    const px = cx - r.left - r.width / 2;
    const py = cy - r.top - r.height / 2;
    const f = s / cam.s;
    cam = s === 1 ? { s: 1, x: 0, y: 0 } : { s, x: px - (px - cam.x) * f, y: py - (py - cam.y) * f };
    apply();
  }
  const center = () => { const r = host.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };

  host.addEventListener('wheel', (e) => { if (!current) return; e.preventDefault(); zoomAt(e.deltaY < 0 ? STEP : 1 / STEP, e.clientX, e.clientY); }, { passive: false });
  host.addEventListener('pointerdown', (e) => { if (!current) return; host.setPointerCapture(e.pointerId); drag.set(e.pointerId, { x: e.clientX, y: e.clientY }); });
  host.addEventListener('pointermove', (e) => {
    const last = drag.get(e.pointerId);
    if (!last) return;
    if (drag.size === 2) { // two fingers: pinch
      drag.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const [a, b] = [...drag.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch) zoomAt(d / pinch, (a.x + b.x) / 2, (a.y + b.y) / 2);
      pinch = d;
      return;
    }
    if (cam.s > 1) { cam = { ...cam, x: cam.x + e.clientX - last.x, y: cam.y + e.clientY - last.y }; apply(); }
    drag.set(e.pointerId, { x: e.clientX, y: e.clientY });
  });
  const up = (e) => { drag.delete(e.pointerId); pinch = 0; };
  host.addEventListener('pointerup', up);
  host.addEventListener('pointercancel', up);

  return {
    /** A `view` message: { id, image, caption }. A new picture starts fitted. */
    show(view) {
      if (current?.id !== view.id) { cam = { s: 1, x: 0, y: 0 }; apply(); pinLayer.replaceChildren(); }
      current = view;
      if (img.getAttribute('src') !== view.image) img.src = view.image;
      img.alt = view.caption ?? '';
      caption.textContent = view.caption ?? '';
      caption.hidden = !view.caption;
    },
    clear() { current = null; img.removeAttribute('src'); caption.hidden = true; pinLayer.replaceChildren(); },
    /** Decision 338: the pins on this picture — [{ name, color, x, y }] (x, y: 0–1). */
    setPins(list) {
      pinLayer.replaceChildren(...(list ?? []).map((p) => {
        const el = document.createElement('span');
        el.className = `tv-pin tv-pin--c-${String(p.color ?? 'white').replace(/[^a-z]/g, '')}`;
        el.style.left = `${Number(p.x) * 100}%`;
        el.style.top = `${Number(p.y) * 100}%`;
        const label = document.createElement('span');
        label.className = 'tv-pin__name';
        label.textContent = p.name ?? '';
        el.append(label);
        return el;
      }));
    },
    zoom(dir) { if (current) zoomAt(dir === 'in' ? STEP : 1 / STEP, ...center()); },
    fit() { cam = { s: 1, x: 0, y: 0 }; apply(); },
    /** Decision 337: the GM's arrows — move the view by a share of the screen (only when zoomed in). */
    pan(fx, fy) { if (cam.s <= 1) return; const r = host.getBoundingClientRect(); cam = { ...cam, x: cam.x - fx * r.width, y: cam.y - fy * r.height }; apply(); },
    shown: () => current,
  };
}
