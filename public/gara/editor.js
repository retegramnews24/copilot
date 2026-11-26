// Disegno della pista in 2D sulla griglia. Un dito disegna, due dita spostano e ingrandiscono.
import { finishNormals } from './rules.js?v=b9ea8cb4e1';

export class Editor {
  constructor(canvas) {
    this.c = canvas;
    this.x = canvas.getContext('2d');
    this.board = 160; // area di disegno, in caselle per lato: cresce con il numero di auto
    this.cx = this.board / 2; this.cy = this.board / 2; // centro della vista, in caselle
    this.finishCheck = null; this.preview = null;
    this.s = 14; // pixel per casella
    this.outer = null; this.inner = null; this.finish = null; this.normalIdx = -1;
    this.stroke = null; this.error = null; this.mode = 'outer';
    this.onStroke = null; this.onArrow = null;
    this.pointers = new Map();
    this.pinch = null;
    const on = (n, f) => canvas.addEventListener(n, f, { passive: false });
    on('pointerdown', (e) => this.down(e));
    on('pointermove', (e) => this.move(e));
    on('pointerup', (e) => this.up(e));
    on('pointercancel', (e) => this.up(e, true));
    on('wheel', (e) => { e.preventDefault(); this.zoomAt(e.offsetX, e.offsetY, Math.exp(-e.deltaY * 0.0015)); });
    on('contextmenu', (e) => e.preventDefault());
    this.raf = 0;
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
  }

  resize() {
    const r = this.c.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2);
    this.w = r.width; this.h = r.height;
    this.c.width = Math.round(r.width * d); this.c.height = Math.round(r.height * d);
    this.x.setTransform(d, 0, 0, d, 0, 0);
    this.draw();
  }

  toCell(px, py) { return { x: (px - this.w / 2) / this.s + this.cx, y: (py - this.h / 2) / this.s + this.cy }; }
  toPx(p) { return { x: (p.x - this.cx) * this.s + this.w / 2, y: (p.y - this.cy) * this.s + this.h / 2 }; }

  setBoard(n) { this.board = n; this.cx = this.cy = n / 2; this.clamp(); this.draw(); }

  setZoom(cellsAcross) { this.s = this.w / cellsAcross; this.clamp(); this.draw(); }
  cellsAcross() { return Math.round(this.w / this.s); }
  zoomAt(px, py, f) {
    const before = this.toCell(px, py);
    this.s = Math.min(60, Math.max(Math.max(this.w, this.h) / this.board, this.s * f));
    const after = this.toCell(px, py);
    this.cx += before.x - after.x; this.cy += before.y - after.y;
    this.clamp(); this.draw();
    this.onZoom && this.onZoom();
  }
  clamp() {
    if (!this.w) return;
    this.s = Math.min(60, Math.max(Math.max(this.w, this.h) / this.board, this.s));
    this.cx = Math.min(this.board, Math.max(0, this.cx));
    this.cy = Math.min(this.board, Math.max(0, this.cy));
  }

  pos(e) { const r = this.c.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }

  down(e) {
    e.preventDefault();
    this.c.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, this.pos(e));
    if (this.pointers.size === 2) {
      this.stroke = null; // il secondo dito annulla il tratto: si sta spostando la vista
      const [a, b] = [...this.pointers.values()];
      this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), m: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
    } else if (this.pointers.size === 1) {
      if (e.button === 2 || e.button === 1) { this.pan = this.pos(e); return; }
      const p = this.pos(e);
      if (this.mode === 'dir') { this.tapArrow(p); return; }
      if (this.mode === 'outer' || this.mode === 'inner' || this.mode === 'finish') {
        this.error = null;
        this.stroke = [this.toCell(p.x, p.y)];
        this.preview = null;
        this.draw();
      }
    }
  }

  move(e) {
    if (!this.pointers.has(e.pointerId)) return;
    e.preventDefault();
    const p = this.pos(e);
    this.pointers.set(e.pointerId, p);
    if (this.pan) { this.cx -= (p.x - this.pan.x) / this.s; this.cy -= (p.y - this.pan.y) / this.s; this.pan = p; this.clamp(); this.draw(); return; }
    if (this.pointers.size === 2 && this.pinch) {
      const [a, b] = [...this.pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y), m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      this.cx -= (m.x - this.pinch.m.x) / this.s; this.cy -= (m.y - this.pinch.m.y) / this.s;
      this.zoomAt(m.x, m.y, d / (this.pinch.d || d));
      this.pinch = { d, m };
      return;
    }
    if (this.stroke) {
      const c = this.toCell(p.x, p.y), l = this.stroke[this.stroke.length - 1];
      if (Math.hypot(c.x - l.x, c.y - l.y) * this.s > 4) {
        this.stroke.push(c);
        // linea di partenza: controllo dal vivo dei posti, verde se ci stanno tutte le auto, rossa se no
        if (this.mode === 'finish' && this.finishCheck) this.preview = this.finishCheck(this.stroke);
        this.draw();
      }
    }
  }

  up(e, cancel) {
    this.pointers.delete(e.pointerId);
    this.pan = null;
    if (this.pointers.size < 2) this.pinch = null;
    if (this.stroke && this.pointers.size === 0) {
      const s = this.stroke; this.stroke = null; this.preview = null;
      if (!cancel && s.length > 1 && this.onStroke) this.onStroke(s);
      this.draw();
    }
  }

  // frecce del verso di gara, ai due lati della linea
  arrows() {
    if (!this.finish) return [];
    const m = { x: (this.finish.a.x + this.finish.b.x) / 2, y: (this.finish.a.y + this.finish.b.y) / 2 };
    const d = Math.max(3, 36 / this.s); // sempre ben staccate tra loro, anche da lontano
    return finishNormals(this.finish).map((n) => ({ n, p: { x: m.x + n.x * d, y: m.y + n.y * d } }));
  }
  tapArrow(px) {
    const arr = this.arrows();
    let best = -1, bd = 44;
    arr.forEach((a, i) => { const q = this.toPx(a.p), d = Math.hypot(q.x - px.x, q.y - px.y); if (d < bd) { bd = d; best = i; } });
    // il gioco può rifiutare un verso (per esempio se in quel verso non ci stanno tutte le auto)
    if (best >= 0 && (!this.onArrow || this.onArrow(best) !== false)) { this.normalIdx = best; this.draw(); }
  }

  fit() {
    if (!this.outer) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of this.outer) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
    this.cx = (minX + maxX) / 2; this.cy = (minY + maxY) / 2;
    this.s = Math.min(this.w / (maxX - minX + 6), this.h / (maxY - minY + 10));
    this.clamp(); this.draw();
  }

  draw() {
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => { this.raf = 0; this.paint(); });
  }

  paint() {
    const g = this.x, w = this.w, h = this.h, s = this.s;
    if (!w) return;
    g.fillStyle = '#f4f1ea'; g.fillRect(0, 0, w, h);
    // fuori dall'area di disegno
    const B = this.board, o0 = this.toPx({ x: 0, y: 0 }), o1 = this.toPx({ x: B, y: B });
    g.fillStyle = '#e3ded2';
    g.fillRect(0, 0, w, Math.max(0, o0.y)); g.fillRect(0, o1.y, w, h); g.fillRect(0, 0, Math.max(0, o0.x), h); g.fillRect(o1.x, 0, w, h);
    // griglia: sempre visibile nel disegno
    const c0 = this.toCell(0, 0), c1 = this.toCell(w, h);
    // passo delle righe che si adatta allo zoom: 1, 5, 25, 125... caselle, mai più fitte di 6 pixel
    let step = 1;
    while (step * s < 6) step *= 5;
    const major = step * 5;
    g.lineWidth = 1;
    for (let x = Math.max(0, Math.floor(c0.x / step) * step); x <= Math.min(B, c1.x); x += step) {
      const px = Math.round(this.toPx({ x, y: 0 }).x) + 0.5;
      g.strokeStyle = x % major ? '#e2ddd0' : '#c9c1ae';
      g.beginPath(); g.moveTo(px, Math.max(0, o0.y)); g.lineTo(px, Math.min(h, o1.y)); g.stroke();
    }
    for (let y = Math.max(0, Math.floor(c0.y / step) * step); y <= Math.min(B, c1.y); y += step) {
      const py = Math.round(this.toPx({ x: 0, y }).y) + 0.5;
      g.strokeStyle = y % major ? '#e2ddd0' : '#c9c1ae';
      g.beginPath(); g.moveTo(Math.max(0, o0.x), py); g.lineTo(Math.min(w, o1.x), py); g.stroke();
    }
    // pista: asfalto tra i bordi
    if (this.outer && this.inner) {
      g.beginPath(); this.path(this.outer, true); this.path(this.inner, true);
      g.fillStyle = 'rgba(63,69,77,.18)'; g.fill('evenodd');
    }
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (const poly of [this.outer, this.inner]) if (poly) { g.beginPath(); this.path(poly, true); g.strokeStyle = '#2563eb'; g.lineWidth = 3; g.stroke(); }
    if (this.finish) {
      const a = this.toPx(this.finish.a), b = this.toPx(this.finish.b);
      g.strokeStyle = '#16a34a'; g.lineWidth = 5; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
    }
    if (this.stroke && this.stroke.length > 1) {
      const pv = this.mode === 'finish' ? this.preview : null, good = pv && pv.finish && pv.cap >= pv.need;
      g.beginPath(); this.path(this.stroke, false);
      g.strokeStyle = this.mode !== 'finish' ? '#2563eb' : good ? 'rgba(22,163,74,.45)' : 'rgba(220,38,38,.45)'; g.lineWidth = 3; g.stroke();
      if (pv && pv.finish) {
        const a = this.toPx(pv.finish.a), b = this.toPx(pv.finish.b);
        g.strokeStyle = good ? '#16a34a' : '#dc2626'; g.lineWidth = 6; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
        const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - 22 }, txt = `${pv.cap} / ${pv.need} posti`;
        g.font = 'bold 14px system-ui, sans-serif'; const tw = g.measureText(txt).width + 16;
        g.fillStyle = good ? '#15803d' : '#b91c1c'; g.beginPath(); g.roundRect(m.x - tw / 2, m.y - 13, tw, 26, 8); g.fill();
        g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, m.x, m.y + 1);
      }
      if (this.mode !== 'finish') {
        const f = this.toPx(this.stroke[0]);
        g.setLineDash([4, 4]); g.strokeStyle = 'rgba(37,99,235,.6)'; g.beginPath(); g.arc(f.x, f.y, 16, 0, 7); g.stroke(); g.setLineDash([]);
      }
    }
    if (this.mode === 'dir') {
      this.arrows().forEach((a, i) => {
        const p = this.toPx(a.p), on = i === this.normalIdx;
        g.fillStyle = on ? '#2563eb' : 'rgba(15,23,42,.75)';
        g.beginPath(); g.arc(p.x, p.y, 20, 0, 7); g.fill();
        g.save(); g.translate(p.x, p.y); g.rotate(Math.atan2(a.n.y, a.n.x));
        g.fillStyle = '#fff'; g.beginPath(); g.moveTo(10, 0); g.lineTo(-6, -8); g.lineTo(-2, 0); g.lineTo(-6, 8); g.closePath(); g.fill();
        g.restore();
      });
    }
    if (this.error && this.error.at) {
      const p = this.toPx(this.error.at);
      g.strokeStyle = '#dc2626'; g.lineWidth = 3; g.beginPath(); g.arc(p.x, p.y, 18, 0, 7); g.stroke();
      g.fillStyle = 'rgba(220,38,38,.18)'; g.beginPath(); g.arc(p.x, p.y, 18, 0, 7); g.fill();
    }
  }

  path(poly, closed) {
    poly.forEach((p, i) => { const q = this.toPx(p); i ? this.x.lineTo(q.x, q.y) : this.x.moveTo(q.x, q.y); });
    if (closed) this.x.closePath();
  }
}
