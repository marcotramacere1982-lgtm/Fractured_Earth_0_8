// Pan and zoom for a map SVG (decision 64), shared by the GM builder and the map viewer. The viewBox keeps the
// element's shape, so screen → map is a plain linear conversion. Wheel and buttons zoom at a point; two fingers
// zoom and pan together.

const ZOOM_STEP = 1.25;

/** svg: the element; units: SVG units per square; size(): { cols, rows } of the map shown. */
export function createCamera(svg, { units: U, size }) {
  let view = null;
  const rect = () => svg.getBoundingClientRect();
  const aspect = () => { const r = rect(); return r.width ? r.height / r.width : 0.6; };

  function set(v) {
    view = v;
    svg.setAttribute('viewBox', `${v.x} ${v.y} ${v.w} ${v.h}`);
  }
  /** The whole map with one square of margin. */
  function fit() {
    const { cols, rows } = size();
    const bw = (cols + 2) * U;
    const bh = (rows + 2) * U;
    const a = aspect();
    const w = bh / bw > a ? bh / a : bw;
    set({ x: (cols * U - w) / 2, y: (rows * U - w * a) / 2, w, h: w * a });
  }
  /** Keeps the centre and zoom when the element changes shape (first time: fit). */
  function keepAspect() {
    if (!rect().width) return;
    if (!view) { fit(); return; }
    const h = view.w * aspect();
    set({ ...view, y: view.y + (view.h - h) / 2, h });
  }
  function zoomAt(cx, cy, factor, base = view) {
    const r = rect();
    const { cols, rows } = size();
    const fx = (cx - r.left) / r.width;
    const fy = (cy - r.top) / r.height;
    const w = Math.max(3 * U, Math.min(Math.max(cols, rows) * U * 4, base.w * factor));
    const h = w * (r.height / r.width);
    set({ x: base.x + fx * base.w - fx * w, y: base.y + fy * base.h - fy * h, w, h });
  }
  function zoomStep(dir) {
    const r = rect();
    zoomAt(r.left + r.width / 2, r.top + r.height / 2, dir === 'in' ? 1 / ZOOM_STEP : ZOOM_STEP);
  }
  function wheel(e) {
    e.preventDefault();
    zoomAt(e.clientX, e.clientY, Math.exp(e.deltaY * 0.0015));
  }

  /** Screen point → map point, in squares. */
  const toMap = (e) => {
    const r = rect();
    return { x: (view.x + ((e.clientX - r.left) / r.width) * view.w) / U, y: (view.y + ((e.clientY - r.top) / r.height) * view.h) / U };
  };
  /** Screen pixels → squares at the current zoom. */
  const pxToSq = (px) => (px * view.w) / (rect().width || 1) / U;

  const panStart = (e) => ({ sx: e.clientX, sy: e.clientY, view: { ...view } });
  /** Moves the view with the pointer; returns how far it moved on screen. */
  function panMove(g, e) {
    const k = g.view.w / rect().width;
    set({ ...g.view, x: g.view.x - (e.clientX - g.sx) * k, y: g.view.y - (e.clientY - g.sy) * k });
    return Math.hypot(e.clientX - g.sx, e.clientY - g.sy);
  }
  const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  function pinchStart(pointers) {
    const [a, b] = [...pointers.values()];
    return { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, mid: mid(a, b), view: { ...view } };
  }
  function pinchMove(g, pointers) {
    const [a, b] = [...pointers.values()];
    if (!b) return;
    const m = mid(a, b);
    zoomAt(g.mid.x, g.mid.y, g.d / (Math.hypot(a.x - b.x, a.y - b.y) || 1), g.view);
    const k = view.w / rect().width;
    set({ ...view, x: view.x - (m.x - g.mid.x) * k, y: view.y - (m.y - g.mid.y) * k });
  }

  return { fit, keepAspect, zoomAt, zoomStep, wheel, toMap, pxToSq, panStart, panMove, pinchStart, pinchMove, rect, get ready() { return Boolean(view); } };
}
