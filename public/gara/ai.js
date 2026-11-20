// IA della gara: cerca la sequenza di mosse più corta fino al traguardo, con le stesse regole del giocatore
// (inerzia, marce che salgono o scendono di una, partenza in prima). Non ha livelli: gioca sempre al meglio che trova.
import { goodCell, crossesBorder, finishCross, dir8, MAX_GEAR } from './rules.js';

const key = (x, y) => x + ',' + y;
const FIELD = new WeakMap();

// Mappa delle distanze: da ogni casella buona, quanti passi di una casella servono per passare la linea in avanti.
// Si calcola all'indietro partendo dalle caselle subito dietro la linea, senza mai attraversarla.
export function distField(t) {
  const cached = FIELD.get(t);
  if (cached) return cached;
  const D = new Map(), q = [], b = t.bbox;
  const good = new Map();
  const isGood = (x, y) => { const k = key(x, y); if (!good.has(k)) good.set(k, goodCell(t, { x, y })); return good.get(k); };
  const f = t.finish;
  const x0 = Math.floor(Math.min(f.a.x, f.b.x)) - 3, x1 = Math.ceil(Math.max(f.a.x, f.b.x)) + 3;
  const y0 = Math.floor(Math.min(f.a.y, f.b.y)) - 3, y1 = Math.ceil(Math.max(f.a.y, f.b.y)) + 3;
  for (let x = x0; x <= x1; x++)
    for (let y = y0; y <= y1; y++) {
      if (!isGood(x, y)) continue;
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        if (!dx && !dy) continue;
        const p = { x, y }, n = { x: x + dx, y: y + dy };
        if (isGood(n.x, n.y) && !crossesBorder(t, p, n) && finishCross(t, p, n) === 1 && !D.has(key(x, y))) { D.set(key(x, y), 1); q.push(p); }
      }
    }
  for (let h = 0; h < q.length; h++) {
    const c = q[h], d = D.get(key(c.x, c.y));
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      if (!dx && !dy) continue;
      const p = { x: c.x + dx, y: c.y + dy }, k = key(p.x, p.y);
      if (D.has(k) || p.x < b.minX - 1 || p.x > b.maxX + 1 || p.y < b.minY - 1 || p.y > b.maxY + 1) continue;
      if (!isGood(p.x, p.y) || crossesBorder(t, p, c) || finishCross(t, p, c) !== 0) continue;
      D.set(k, d + 1); q.push(p);
    }
  }
  // lunghezza di un giro: dalle caselle subito oltre la linea fino a ripassarla
  // (solo le caselle accanto al tratto di linea, non quelle lontane allineate con lei)
  let L = Infinity;
  const fl = Math.hypot(f.b.x - f.a.x, f.b.y - f.a.y), ux = (f.b.x - f.a.x) / fl, uy = (f.b.y - f.a.y) / fl;
  for (const [k, d] of D) {
    const [x, y] = k.split(',').map(Number);
    const s = (x - f.a.x) * t.normal.x + (y - f.a.y) * t.normal.y, along = (x - f.a.x) * ux + (y - f.a.y) * uy;
    if (s >= 0 && s < 1.5 && along >= -0.5 && along <= fl + 0.5) L = Math.min(L, d);
  }
  const out = { D, L: isFinite(L) ? L : 1, isGood };
  FIELD.set(t, out);
  return out;
}

// strada che manca alla fine della gara, in caselle
function remaining(F, x, y, prog, laps) {
  if (prog > laps) return 0;
  const d = F.D.get(key(x, y));
  if (d === undefined) return Infinity;
  return d + (laps - Math.max(0, prog)) * F.L;
}

const RING = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
function forward3(d) {
  const i = RING.findIndex(([x, y]) => x === d.x && y === d.y);
  return [-1, 0, 1].map((o) => { const [x, y] = RING[(i + o + 8) % 8]; return { x, y }; });
}

// mosse senza urto da uno stato (stessa logica di carOptions nelle regole, ma con i controlli veloci della mappa)
function moves(t, F, s, blocked) {
  const out = new Map(), P = { x: s.x, y: s.y }, g0 = s.gear;
  const gears = g0 === 0 ? [1] : [g0 - 1, g0, g0 + 1].filter((g) => g >= 1 && g <= MAX_GEAR);
  const add = (x, y, need) => {
    const g = Math.max(Math.abs(x - P.x), Math.abs(y - P.y));
    if ((need && g !== need) || !gears.includes(g)) return;
    const k = key(x, y);
    if (out.has(k) || blocked.has(k) || !F.isGood(x, y) || crossesBorder(t, P, { x, y })) return;
    out.set(k, { x, y, gear: g });
  };
  if (g0 <= 1) for (const d of forward3(s.dir)) add(P.x + d.x, P.y + d.y, 1);
  if (g0 >= 1) {
    const v = s.lx || s.ly ? { x: s.lx, y: s.ly } : s.dir;
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) add(P.x + v.x + i, P.y + v.y + j, g0 === 1 ? 2 : 0);
  }
  return [...out.values()];
}

// coda a priorità (heap)
class Heap {
  constructor() { this.a = []; }
  push(n) { const a = this.a; a.push(n); let i = a.length - 1; while (i) { const p = (i - 1) >> 1; if (a[p].f <= a[i].f) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } }
  pop() {
    const a = this.a, top = a[0], last = a.pop();
    if (a.length) { a[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && a[l].f < a[m].f) m = l; if (r < a.length && a[r].f < a[m].f) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } }
    return top;
  }
  get size() { return this.a.length; }
}

// stima per difetto delle mosse che servono per fare r caselle partendo alla marcia g (si sale di una marcia per mossa)
function minMoves(r, g) {
  let k = 0, d = 0, v = g;
  while (d < r) { v = Math.min(MAX_GEAR, v + 1); d += v; k++; if (v === MAX_GEAR) return k + Math.ceil((r - d) / MAX_GEAR); }
  return k;
}

// Cerca la sequenza più corta (A*). Restituisce la prima mossa da fare e tutto il piano.
// avoid: caselle dove non può fermarsi (per esempio dove ha scelto di andare il giocatore).
export function bestMove(t, car, laps, avoid = [], limit = 400000) {
  const F = distField(t);
  const blocked = new Set(avoid.map((p) => key(p.x, p.y)));
  const W = 1.15;
  const start = { x: car.pos.x, y: car.pos.y, lx: car.last.x, ly: car.last.y, gear: car.gear, dir: car.dir, prog: car.progress, g: 0, parent: null, mv: null };
  const h0 = remaining(F, start.x, start.y, start.prog, laps);
  start.f = W * minMoves(h0, start.gear);
  const heap = new Heap(), seen = new Map();
  const sk = (s) => `${s.x},${s.y},${s.lx},${s.ly},${s.gear <= 1 ? s.dir.x + ':' + s.dir.y : ''},${s.prog}`;
  heap.push(start); seen.set(sk(start), 0);
  let best = start, bestR = h0, n = 0;
  while (heap.size && n++ < limit) {
    const s = heap.pop();
    const r = remaining(F, s.x, s.y, s.prog, laps);
    if (r < bestR || (r === bestR && s.g < best.g)) { best = s; bestR = r; }
    if (s.prog > laps) { best = s; break; }
    // solo il primo passo deve evitare le caselle bloccate: dopo, gli altri si saranno già mossi
    for (const m of moves(t, F, s, s === start ? blocked : new Set())) {
      const fc = finishCross(t, { x: s.x, y: s.y }, m);
      const ns = { x: m.x, y: m.y, lx: m.x - s.x, ly: m.y - s.y, gear: m.gear, dir: dir8(m.x - s.x, m.y - s.y), prog: s.prog + fc, g: s.g + 1, parent: s, mv: m };
      const hr = remaining(F, ns.x, ns.y, ns.prog, laps);
      if (!isFinite(hr)) continue;
      const k = sk(ns);
      if (seen.has(k) && seen.get(k) <= ns.g) continue;
      seen.set(k, ns.g);
      ns.f = ns.g + W * minMoves(hr, ns.gear);
      heap.push(ns);
    }
  }
  // risale dal miglior punto trovato fino alla prima mossa
  if (best === start) return null;
  const plan = [];
  for (let s = best; s && s !== start; s = s.parent) plan.unshift(s.mv);
  return { first: plan[0], plan, steps: best.g, done: best.prog > laps, nodes: n };
}

// Pilota dell'IA: tiene il piano e lo rifà solo se la situazione cambia (per esempio una casella occupata).
export class AiDriver {
  constructor(t, laps) { this.t = t; this.laps = laps; this.plan = []; }
  choose(race, i, avoid, opts) {
    const car = race.cars[i], ok = (m) => m && opts.find((o) => !o.crash && o.x === m.x && o.y === m.y);
    let pick = this.plan.length && ok(this.plan[0]) && !avoid.some((p) => p.x === this.plan[0].x && p.y === this.plan[0].y) ? ok(this.plan[0]) : null;
    if (!pick) {
      const b = bestMove(this.t, car, this.laps, avoid);
      this.plan = b ? b.plan : [];
      pick = ok(this.plan[0]);
    }
    if (pick) { this.plan.shift(); return pick; }
    // nessuna mossa sicura: l'urto che la lascia più avanti
    this.plan = [];
    const F = distField(this.t);
    return opts.slice().sort((a, b) => (F.D.get(key(a.stop.x, a.stop.y)) ?? 1e9) - (F.D.get(key(b.stop.x, b.stop.y)) ?? 1e9))[0] || null;
  }
}
