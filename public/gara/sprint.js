// Modalità Sprint: la stessa pista disegnata, ma la corsa è in tempo reale.
// Tutte le auto hanno la stessa accelerazione e la stessa velocità massima: accelerano da sole, tu sterzi
// (e freni se serve). I muri non fermano per due turni: rimbalzi e perdi velocità. Le auto dell'IA seguono
// una traiettoria calcolata sulla pista e rallentano prima delle curve, con le stesse regole di guida.
import * as R from './rules.js?v=b5d4680e25';
import { distField } from './ai.js?v=e75e4102f6';

export const SPRINT = { vmax: 8.5, accel: 5.5, brake: 14, drag: 0.15, steer: 3.1, grip: 7, radius: 0.33 };
const key = (x, y) => x + ',' + y;

// traiettoria dell'IA: dalla linea si scende la mappa delle distanze fino a ripassarla (un giro intero),
// poi la si ammorbidisce e la si allontana dai muri
export function racingLine(t) {
  const F = distField(t), f = t.finish;
  const fl = Math.hypot(f.b.x - f.a.x, f.b.y - f.a.y), ux = (f.b.x - f.a.x) / fl, uy = (f.b.y - f.a.y) / fl;
  let start = null;
  for (const [k, d] of F.D) {
    const [x, y] = k.split(',').map(Number);
    const s = (x - f.a.x) * t.normal.x + (y - f.a.y) * t.normal.y, along = (x - f.a.x) * ux + (y - f.a.y) * uy;
    if (s >= 0 && s < 1.5 && along >= -0.5 && along <= fl + 0.5 && (!start || d > start.d || (d === start.d && Math.abs(along - fl / 2) < Math.abs(start.along - fl / 2)))) start = { x, y, d, along };
  }
  if (!start) return [];
  const path = [{ x: start.x, y: start.y }];
  let c = start;
  for (let guard = 0; guard < 20000 && c.d > 1; guard++) {
    let best = null;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      if (!dx && !dy) continue;
      const d = F.D.get(key(c.x + dx, c.y + dy));
      // un passo alla volta in avanti, senza ripassare la linea all'indietro
      if (d !== c.d - 1 || R.finishCross(t, c, { x: c.x + dx, y: c.y + dy }) !== 0) continue;
      const room = R.clearance(t, { x: c.x + dx, y: c.y + dy }, 4);
      if (!best || d < best.d || (d === best.d && room > best.room)) best = { x: c.x + dx, y: c.y + dy, d, room };
    }
    if (!best) break;
    c = best; path.push({ x: c.x, y: c.y });
  }
  // ammorbidisce (Chaikin, chiuso) e tiene lontano dai muri
  let p = path;
  for (let k = 0; k < 3; k++) {
    const out = [];
    for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i + 1) % p.length];
      out.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 }, { x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
    }
    p = out;
  }
  for (const q of p) {
    for (let it = 0; it < 4; it++) {
      const room = R.clearance(t, q, 3);
      if (room >= 1.1) break;
      const n = wallNormal(t, q);
      q.x += n.x * (1.1 - room) * 0.6; q.y += n.y * (1.1 - room) * 0.6;
    }
  }
  return p.filter((q) => R.inTrack(t, q));
}

// verso opposto al muro più vicino (gradiente della distanza dal bordo)
export function wallNormal(t, p) {
  const e = 0.12, c = (x, y) => R.clearance(t, { x, y }, 3);
  const gx = c(p.x + e, p.y) - c(p.x - e, p.y), gy = c(p.x, p.y + e) - c(p.x, p.y - e), l = Math.hypot(gx, gy);
  return l > 1e-6 ? { x: gx / l, y: gy / l } : { x: 0, y: 0 };
}

const wrap = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };

// una corsa: auto con posizione, velocità e direzione; step(dt, input) la fa avanzare
export class Sprint {
  constructor(track, laps, n) {
    this.t = track; this.laps = laps; this.time = 0; this.order = []; this.done = false;
    this.F = distField(track);
    this.line = racingLine(track);
    // distanza media tra due punti della traiettoria (per contare in caselle)
    let len = 0; for (let i = 1; i < this.line.length; i++) len += Math.hypot(this.line[i].x - this.line[i - 1].x, this.line[i].y - this.line[i - 1].y);
    this.gap = this.line.length > 1 ? len / (this.line.length - 1) : 1;
    // tutte sulla linea, affiancate, rivolte nel verso di gara (prima casella buona per ognuna, come nel gioco a turni)
    const race = R.newRace(track, laps, n);
    for (let i = 0; i < n; i++) { const s = R.placeable(race)[i === 0 ? Math.floor(R.placeable(race).length / 2) : 0]; R.placeCar(race, s); }
    const h = Math.atan2(track.normal.y, track.normal.x);
    this.cars = race.cars.map((c, i) => ({
      id: i, x: c.pos.x, y: c.pos.y, vx: 0, vy: 0, h, steer: 0, progress: 0, finished: null, best: null, lapStart: 0,
      ai: i > 0, idx: 0, rank: 0, bump: 0, look: 2.2 + (i % 3) * 0.35, care: 0.92 + ((i * 37) % 7) / 100
    }));
    for (const c of this.cars) c.idx = this.nearestIdx(c, 0, this.line.length);
  }
  speed(c) { return Math.hypot(c.vx, c.vy); }
  nearestIdx(c, from, span) {
    const L = this.line, n = L.length;
    if (!n) return 0;
    let best = from, bd = Infinity;
    for (let k = 0; k < span; k++) {
      const i = (from + k) % n, d = (L[i].x - c.x) ** 2 + (L[i].y - c.y) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }
  // l'IA: punta un punto avanti sulla traiettoria e rallenta se la curva davanti è stretta
  driveAI(c) {
    const L = this.line, n = L.length;
    if (!n) return { steer: 0, gas: true, brake: false };
    const g = this.gap, cells = (k) => Math.max(1, Math.round(k / g));
    c.idx = this.nearestIdx(c, (c.idx - cells(1) + n) % n, cells(5));
    const v = this.speed(c), ahead = cells(c.look + v * 0.3);
    const T = L[(c.idx + ahead) % n];
    const want = Math.atan2(T.y - c.y, T.x - c.x), err = wrap(want - c.h);
    // quanto gira la traiettoria nei prossimi metri: più gira, più bisogna arrivarci piano
    let bend = 0;
    const s = cells(1.6);
    for (let k = cells(1); k <= cells(4 + v * 0.7); k += s) {
      const a = L[(c.idx + k) % n], b = L[(c.idx + k + s) % n], d = L[(c.idx + k + 2 * s) % n];
      bend = Math.max(bend, Math.abs(wrap(Math.atan2(d.y - b.y, d.x - b.x) - Math.atan2(b.y - a.y, b.x - a.x))));
    }
    const target = SPRINT.vmax * c.care * Math.max(0.38, 1 - bend * 0.55);
    return { steer: Math.max(-1, Math.min(1, err * 2.2)), gas: v < target, brake: v > target + 1.2 };
  }
  step(dt, input) {
    if (this.done) return [];
    this.time += dt;
    const ev = [], S = SPRINT, t = this.t;
    for (const c of this.cars) {
      if (c.finished !== null) { c.vx *= 0.97; c.vy *= 0.97; }
      const ctl = c.finished !== null ? { steer: 0, gas: false, brake: true } : c.ai ? this.driveAI(c) : input;
      const v = this.speed(c);
      // sterzo: più forte quando l'auto va, quasi niente da ferma
      c.steer += ((ctl.steer || 0) - c.steer) * Math.min(1, dt * 12);
      c.h = wrap(c.h + c.steer * S.steer * Math.min(1, 0.25 + v / 4) * dt);
      const fx = Math.cos(c.h), fy = Math.sin(c.h);
      let fwd = c.vx * fx + c.vy * fy, lat = -c.vx * fy + c.vy * fx;
      if (ctl.brake) fwd = Math.max(0, fwd - S.brake * dt);
      else if (ctl.gas !== false) fwd += S.accel * dt * (1 - fwd / S.vmax);
      fwd -= fwd * S.drag * dt;
      lat *= Math.exp(-S.grip * dt); // le gomme tengono: la scivolata laterale si spegne in fretta
      c.vx = fx * fwd - fy * lat; c.vy = fy * fwd + fx * lat;
      // movimento, con il controllo dei muri
      const old = { x: c.x, y: c.y }, nx = c.x + c.vx * dt, ny = c.y + c.vy * dt, np = { x: nx, y: ny };
      if (!R.inTrack(t, np) || R.clearance(t, np, 1) < S.radius || R.crossesBorder(t, old, np)) {
        const nrm = wallNormal(t, old), into = c.vx * nrm.x + c.vy * nrm.y;
        if (into < 0) { c.vx -= 1.35 * into * nrm.x; c.vy -= 1.35 * into * nrm.y; }
        c.vx *= 0.62; c.vy *= 0.62;
        c.x = old.x + nrm.x * 0.03; c.y = old.y + nrm.y * 0.03;
        if (this.time - c.bump > 0.35) { c.bump = this.time; ev.push({ type: 'wall', car: c.id, speed: v, at: old }); }
      } else { c.x = nx; c.y = ny; }
      // linea: giro in avanti o indietro
      const fc = R.finishCross(t, old, { x: c.x, y: c.y });
      if (fc) {
        c.progress += fc;
        if (fc > 0 && c.progress >= 2) { const lap = this.time - c.lapStart; c.best = c.best === null ? lap : Math.min(c.best, lap); }
        if (fc > 0) c.lapStart = this.time;
        if (c.progress > this.laps && c.finished === null) {
          c.finished = this.time; this.order.push(c.id);
          ev.push({ type: 'finish', car: c.id, place: this.order.length });
        } else if (fc > 0 && c.progress > 1) ev.push({ type: 'lap', car: c.id, lap: c.progress });
      }
    }
    // urti tra auto: si spingono via e si scambiano un po' di velocità
    for (let i = 0; i < this.cars.length; i++) for (let j = i + 1; j < this.cars.length; j++) {
      const a = this.cars[i], b = this.cars[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), min = S.radius * 2;
      if (d >= min || d < 1e-6) continue;
      const nx = dx / d, ny = dy / d, push = (min - d) / 2;
      const ta = { x: a.x - nx * push, y: a.y - ny * push }, tb = { x: b.x + nx * push, y: b.y + ny * push };
      if (R.inTrack(t, ta)) { a.x = ta.x; a.y = ta.y; }
      if (R.inTrack(t, tb)) { b.x = tb.x; b.y = tb.y; }
      const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (rel < 0) { a.vx += rel * nx * 0.5; a.vy += rel * ny * 0.5; b.vx -= rel * nx * 0.5; b.vy -= rel * ny * 0.5; }
      if (this.time - a.bump > 0.5) { a.bump = this.time; ev.push({ type: 'touch', car: a.id, other: b.id }); }
    }
    this.rank();
    if (this.cars[0].finished !== null) this.done = true;
    return ev;
  }
  // posizioni in gara: giri fatti, poi strada che manca alla linea
  rank() {
    const L = this.F.L || 1;
    const score = (c) => {
      if (c.finished !== null) return 1e9 - c.finished;
      const d = this.F.D.get(key(Math.round(c.x), Math.round(c.y)));
      if (d !== undefined) c.lastD = d;
      return c.progress * L + (L - (c.lastD ?? L));
    };
    [...this.cars].sort((a, b) => score(b) - score(a)).forEach((c, k) => { c.rank = k + 1; });
  }
}
