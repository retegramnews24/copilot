// Device-local panel proportions; gameplay data stays on the server.
const KEY = 'binotto-simulator-view-v1';
let saved = {};
try { saved = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch {}
if (!saved || typeof saved !== 'object' || Array.isArray(saved)) saved = {};
const write = () => { try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch {} };
export function saveView(value) { saved.view = value; write(); }
export function readView() { return saved.view || {}; }
const profile = () => innerWidth <= 700 ? 'phone' : innerWidth <= 850 ? 'tablet' : 'desktop';

// Preserve the actual separator node, focus and pointer capture across live updates.
export function replacePanelContent(el, html) {
  for (const child of [...el.childNodes]) if (!child.classList?.contains('layout-handle')) child.remove();
  el.insertAdjacentHTML('afterbegin', html);
}

export function installPanelLayouts(root, page) {
  const selector = '.paddock,.two,.grid,.driver-controls,.session-stage,.session-layout,.calendar,.team-layout,.box-workspace';
  const records = new Map();
  let queued = false, disposed = false;
  const tracks = (el, axis) => {
    const css = getComputedStyle(el);
    const text = css['gridTemplate' + axis].trim();
    let sizes = text.split(/\s+/).map(value => /^\d+(?:\.\d+)?px$/.test(value) ? parseFloat(value) : NaN);
    if (sizes.some(n => !Number.isFinite(n))) {
      // Some engines expose track expressions instead of resolved pixel lengths.
      const rects = [...el.children].filter(c => !c.classList.contains('layout-handle')).map(c => c.getBoundingClientRect());
      const start = axis === 'Columns' ? 'left' : 'top', size = axis === 'Columns' ? 'width' : 'height';
      const lines = new Map();
      for (const r of rects) if (r[size] > 0) lines.set(Math.round(r[start]), Math.max(lines.get(Math.round(r[start])) || 0, r[size]));
      sizes = [...lines].sort((a, b) => a[0] - b[0]).map(([, n]) => n);
    }
    return {sizes, gap: parseFloat(css[axis === 'Columns' ? 'columnGap' : 'rowGap']) || 0};
  };
  function refresh(el, rec) {
    if (disposed || rec.drag) return;
    const mode = profile();
    if (rec.profile !== mode) {
      el.style.gridTemplateColumns = ''; el.style.gridTemplateRows = ''; rec.profile = mode;
      const values = saved[rec.key + ':' + mode];
      for (const axis of ['Columns', 'Rows']) {
        const value = values?.[axis];
        if (typeof value === 'string' && /^[\d\s.()%a-z,-]+$/.test(value)) el.style['gridTemplate' + axis] = value;
      }
    }
    const wanted = new Set();
    if (getComputedStyle(el).display === 'grid') for (const axis of ['Columns', 'Rows']) {
      const {sizes, gap} = tracks(el, axis);
      if (sizes.length < 2 || sizes.some(n => n <= 0)) continue;
      let offset = 0;
      for (let index = 0; index < sizes.length - 1; index++) {
        offset += sizes[index];
        const id = axis + ':' + index; wanted.add(id);
        let handle = rec.handles.get(id);
        if (!handle) {
          handle = document.createElement('div');
          handle.className = 'layout-handle ' + (axis === 'Columns' ? 'vertical' : 'horizontal');
          handle.setAttribute('role', 'separator'); handle.tabIndex = 0;
          handle.setAttribute('aria-orientation', axis === 'Columns' ? 'vertical' : 'horizontal');
          handle.setAttribute('aria-label', axis === 'Columns' ? 'Redimensiona larghezza pannelli' : 'Redimensiona altezza pannelli');
          handle.title = 'Trascina per ridimensionare · doppio clic per ripristinare';
          bind(handle, el, rec, axis, index); rec.handles.set(id, handle);
        }
        if (handle.parentElement !== el) el.append(handle);
        handle.style[axis === 'Columns' ? 'left' : 'top'] = (offset + gap / 2) + 'px';
        handle.setAttribute('aria-valuenow', Math.round(sizes[index] / (sizes[index] + sizes[index + 1]) * 100));
        handle.setAttribute('aria-valuemin', '0'); handle.setAttribute('aria-valuemax', '100');
        offset += gap;
      }
    }
    for (const [id, handle] of rec.handles) if (!wanted.has(id)) { handle.remove(); rec.handles.delete(id); }
  }
  function bind(handle, el, rec, axis, index) {
    const coordinate = axis === 'Columns' ? 'clientX' : 'clientY';
    let drag = null;
    const change = (initial, delta) => {
      const values = [...initial.sizes], total = values[index] + values[index + 1];
      const min = Math.min(axis === 'Columns' ? 100 : 64, total * .25);
      values[index] = Math.max(min, Math.min(total - min, values[index] + delta));
      values[index + 1] = total - values[index];
      const fluid = axis === 'Columns' || (el.matches('.paddock') && rec.profile === 'desktop') || el.matches('.session-layout');
      const value = values.map(n => fluid ? `minmax(0,${n.toFixed(3)}fr)` : n.toFixed(1) + 'px').join(' ');
      el.style['gridTemplate' + axis] = value;
      handle.style[axis === 'Columns' ? 'left' : 'top'] = (values.slice(0, index + 1).reduce((a,b) => a+b,0) + initial.gap * (index + .5)) + 'px';
      saved[rec.key + ':' + rec.profile] = {...saved[rec.key + ':' + rec.profile], [axis]:value}; write();
    };
    handle.onpointerdown = event => {
      if (event.button !== 0) return;
      const initial = tracks(el, axis); if (!initial.sizes[index + 1]) return;
      event.preventDefault(); handle.focus({preventScroll:true});
      drag = {...initial, at:event[coordinate], pointer:event.pointerId}; rec.drag = true;
      try { handle.setPointerCapture(event.pointerId); } catch {}
      document.body.classList.add('panel-dragging');
    };
    const move = event => { if (drag && event.pointerId === drag.pointer) change(drag, event[coordinate] - drag.at); };
    const end = event => {
      if (!drag || (event.pointerId !== undefined && event.pointerId !== drag.pointer)) return;
      const pointer = drag.pointer; drag = null; rec.drag = false;
      try { if (handle.hasPointerCapture(pointer)) handle.releasePointerCapture(pointer); } catch {}
      document.body.classList.remove('panel-dragging'); refresh(el, rec); write();
    };
    // Window listeners also cover older WebViews without pointer capture.
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end); window.addEventListener('pointercancel', end);
    handle.onlostpointercapture = end;
    rec.cleanup.push(() => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end); });
    handle.onkeydown = event => {
      const keys = axis === 'Columns' ? ['ArrowLeft','ArrowRight'] : ['ArrowUp','ArrowDown'];
      if (!keys.includes(event.key)) return;
      const initial = tracks(el, axis); if (!initial.sizes[index + 1]) return;
      event.preventDefault(); change(initial, (event.key === keys[0] ? -1 : 1) * (event.shiftKey ? 30 : 10)); refresh(el, rec);
    };
    handle.ondblclick = () => {
      delete saved[rec.key + ':' + rec.profile]; el.style.gridTemplateColumns = ''; el.style.gridTemplateRows = ''; write(); refresh(el, rec);
    };
  }
  function release(rec) { rec.ro?.disconnect(); for (const fn of rec.cleanup) fn(); }
  const scan = () => {
    queued = false; if (disposed) return;
    for (const [el, rec] of records) if (!el.isConnected) { release(rec); records.delete(el); }
    [...root.querySelectorAll(selector)].filter(el=>el.dataset.noResize!=='true').forEach((el, index) => {
      let rec = records.get(el);
      if (!rec) {
        rec = {key:page + ':' + index, profile:null, handles:new Map(), cleanup:[]}; records.set(el, rec); el.classList.add('resizable-panels');
        if (typeof ResizeObserver !== 'undefined') { rec.ro = new ResizeObserver(() => refresh(el, rec)); rec.ro.observe(el); }
      }
      refresh(el, rec);
    });
  };
  const schedule = () => { if (!queued) { queued = true; queueMicrotask(scan); } };
  const observer = new MutationObserver(changes => {
    if (changes.some(c => [...c.addedNodes, ...c.removedNodes].some(n => n.nodeType === 1 && !n.classList.contains('layout-handle')))) schedule();
  });
  observer.observe(root, {childList:true, subtree:true}); window.addEventListener('resize', schedule); scan();
  return () => { disposed = true; observer.disconnect(); window.removeEventListener('resize', schedule); for (const rec of records.values()) release(rec); document.body.classList.remove('panel-dragging'); write(); };
}
window.addEventListener('pagehide', write);
document.addEventListener('visibilitychange', () => { if (document.hidden) write(); });
