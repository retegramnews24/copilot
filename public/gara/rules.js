// Gara a quadretti: regole pure, senza disegno. Le unità sono caselle (1 = un quadretto).
// Tutto lo stato è un oggetto semplice (JSON), così più avanti si può giocare online.

export const MIN_WIDTH = 3; // larghezza minima della pista con 2 auto, in caselle
export const MAX_CARS = 16;
// più auto, pista più larga: mezza casella in più per ogni auto oltre la seconda
export const minWidth = (n) => MIN_WIDTH + Math.max(0, n - 2) * 0.5;
// spazio di disegno, in caselle per lato
export const boardSize = (n) => Math.min(480, 160 + Math.max(0, n - 2) * 30);
export const SAFE = 0.6; // distanza minima dal bordo per una casella buona
export const MAX_GEAR = 7;
export const CRASH_TURNS = 2;

// ---------- geometria ----------
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

export function distToSeg(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
  let t = l2 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  const q = { x: a.x + t * dx, y: a.y + t * dy };
  return { d: dist(p, q), q };
}

// intersezione propria di due segmenti: restituisce t sul primo (0..1) oppure -1
function segHit(a, b, c, d) {
  const r = { x: b.x - a.x, y: b.y - a.y }, s = { x: d.x - c.x, y: d.y - c.y };
  const den = r.x * s.y - r.y * s.x;
  if (Math.abs(den) < 1e-12) return -1;
  const t = ((c.x - a.x) * s.y - (c.y - a.y) * s.x) / den;
  const u = ((c.x - a.x) * r.y - (c.y - a.y) * r.x) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? t : -1;
}

export function pointInPoly(p, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

const segsOf = (poly) => poly.map((p, i) => [p, poly[(i + 1) % poly.length]]);

function polyLength(poly) {
  let l = 0;
  for (const [a, b] of segsOf(poly)) l += dist(a, b);
  return l;
}

// ---------- pulizia del tratto disegnato ----------
function resample(pts, step, closed) {
  const src = closed ? [...pts, pts[0]] : pts;
  const out = [src[0]];
  let acc = 0;
  for (let i = 1; i < src.length; i++) {
    let a = src[i - 1];
    const b = src[i];
    let seg = dist(a, b);
    while (acc + seg >= step) {
      const t = (step - acc) / seg;
      a = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      out.push(a);
      seg = dist(a, b);
      acc = 0;
    }
    acc += seg;
  }
  if (closed && out.length > 2 && dist(out[out.length - 1], out[0]) < step * 0.5) out.pop();
  return out;
}

function chaikin(poly) {
  const out = [];
  for (const [a, b] of segsOf(poly)) {
    out.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 });
    out.push({ x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
  }
  return out;
}

// Chiude un bordo disegnato col dito. Restituisce {poly} oppure {error, at}.
export function closeBorder(raw) {
  if (raw.length < 8) return { error: 'Tratto troppo corto.' };
  const first = raw[0], last = raw[raw.length - 1];
  let len = 0;
  for (let i = 1; i < raw.length; i++) len += dist(raw[i - 1], raw[i]);
  if (len < 20) return { error: 'Bordo troppo piccolo: disegna una pista più grande.', at: first };
  if (dist(first, last) > Math.max(3, len * 0.08))
    return { error: 'Bordo non chiuso: finisci vicino al punto di partenza.', at: last };
  let poly = resample(raw, 0.5, true);
  poly = resample(chaikin(chaikin(poly)), 0.5, true);
  if (poly.length < 12) return { error: 'Bordo troppo piccolo.', at: first };
  const x = selfCross(poly);
  if (x) return { error: 'Il bordo si incrocia da solo.', at: x };
  return { poly };
}

function selfCross(poly) {
  const s = segsOf(poly), n = s.length;
  for (let i = 0; i < n; i++)
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      const t = segHit(s[i][0], s[i][1], s[j][0], s[j][1]);
      if (t >= 0) return lerp(s[i][0], s[i][1], t);
    }
  return null;
}

const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

function polyCross(p, q) {
  for (const [a, b] of segsOf(p))
    for (const [c, d] of segsOf(q)) {
      const t = segHit(a, b, c, d);
      if (t >= 0) return lerp(a, b, t);
    }
  return null;
}

// Il bordo interno deve stare tutto dentro l'esterno, senza toccarlo.
export function checkInner(outer, inner, minW = MIN_WIDTH) {
  const x = polyCross(outer, inner);
  if (x) return { error: 'I due bordi si incrociano.', at: x };
  if (!inner.every((p) => pointInPoly(p, outer))) return { error: 'Il bordo interno deve stare dentro quello esterno.', at: inner[0] };
  return checkWidth(outer, inner, minW);
}

// Strettoie: due punti di bordo troppo vicini con la pista in mezzo.
function checkWidth(outer, inner, MIN_WIDTH) {
  const polys = [outer, inner];
  const inTrack = (p) => pointInPoly(p, outer) && !pointInPoly(p, inner);
  for (let pi = 0; pi < 2; pi++) {
    const P = polys[pi];
    for (let i = 0; i < P.length; i++) {
      const v = P[i];
      for (let qi = 0; qi < 2; qi++) {
        const Q = polys[qi], n = Q.length;
        for (let j = 0; j < n; j++) {
          if (pi === qi) {
            const k = Math.min(Math.abs(i - j), n - Math.abs(i - j));
            if (k * 0.5 < MIN_WIDTH * 1.6) continue; // vicini sullo stesso bordo
          }
          const { d, q } = distToSeg(v, Q[j], Q[(j + 1) % n]);
          if (d < MIN_WIDTH && d > 1e-6 && inTrack(lerp(v, q, 0.5))) return { error: `Pista troppo stretta qui: servono almeno ${String(MIN_WIDTH).replace('.', ',')} caselle.`, at: lerp(v, q, 0.5) };
        }
      }
    }
  }
  return { ok: true };
}

// Linea di partenza: la retta tra inizio e fine del tratto, tagliata tra bordo interno ed esterno.
export function makeFinish(raw, outer, inner) {
  if (raw.length < 2) return { error: 'Disegna la linea di partenza attraverso la pista.' };
  let a = raw[0], b = raw[raw.length - 1];
  if (dist(a, b) < 1) return { error: 'Linea troppo corta: tracciala da un bordo all’altro.', at: a };
  const m = lerp(a, b, 0.5), ext = 0.35;
  a = lerp(m, a, 1 + ext);
  b = lerp(m, b, 1 + ext);
  const hits = [];
  for (const [poly, kind] of [[outer, 'o'], [inner, 'i']])
    segsOf(poly).forEach(([c, d], k) => {
      const t = segHit(a, b, c, d);
      if (t >= 0) hits.push({ t, kind, k });
    });
  hits.sort((u, v) => u.t - v.t);
  let best = null;
  for (let i = 1; i < hits.length; i++) {
    const h0 = hits[i - 1], h1 = hits[i];
    if (h0.kind === h1.kind) continue;
    const mid = lerp(a, b, (h0.t + h1.t) / 2);
    if (!(pointInPoly(mid, outer) && !pointInPoly(mid, inner))) continue;
    if (!best || h1.t - h0.t < best[1].t - best[0].t) best = [h0, h1];
  }
  if (!best) return { error: 'La linea deve andare dal bordo interno a quello esterno.', at: m };
  const p0 = lerp(a, b, best[0].t), p1 = lerp(a, b, best[1].t);
  const o = best[0].kind === 'o' ? best[0] : best[1], i = best[0].kind === 'i' ? best[0] : best[1];
  return { finish: { a: p0, b: p1, outerSeg: o.k, innerSeg: i.k } };
}

// Le due direzioni possibili: perpendicolari alla linea.
export function finishNormals(f) {
  const dx = f.b.x - f.a.x, dy = f.b.y - f.a.y, l = Math.hypot(dx, dy);
  return [{ x: -dy / l, y: dx / l }, { x: dy / l, y: -dx / l }];
}

// ---------- pista completa ----------
export function buildTrack(outer, inner, finish, normal, players = 2) {
  const t = { outer, inner, finish, normal, players };
  // verso di percorrenza di ciascun bordo (per sapere dov'è "avanti" lungo la pista)
  t.outerSign = sideSign(outer, finish.outerSeg, normal);
  t.innerSign = sideSign(inner, finish.innerSeg, normal);
  const bb = bbox(outer);
  t.bbox = bb;
  t.startSlots = startSlots(t);
  const cap = capacity(t.startSlots);
  if (cap < players) return { error: `Sulla linea ci stanno ${cap} auto, ne servono ${players}: allarga la pista alla partenza.`, at: lerp(finish.a, finish.b, 0.5) };
  const lap = checkLapPossible(t);
  if (!lap) return { error: 'Non si riesce a fare un giro intero: controlla strettoie e linea di partenza.', at: lerp(finish.a, finish.b, 0.5) };
  return { track: t };
}

function sideSign(poly, k, n) {
  const a = poly[k], b = poly[(k + 1) % poly.length];
  return (b.x - a.x) * n.x + (b.y - a.y) * n.y >= 0 ? 1 : -1;
}

export function bbox(poly) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of poly) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY };
}

export function inTrack(t, p) {
  return pointInPoly(p, t.outer) && !pointInPoly(p, t.inner);
}

export function clearance(t, p) {
  let m = Infinity;
  for (const poly of [t.outer, t.inner]) for (const [a, b] of segsOf(poly)) m = Math.min(m, distToSeg(p, a, b).d);
  return m;
}

export function goodCell(t, p) {
  return inTrack(t, p) && clearance(t, p) >= SAFE;
}

export function crossesBorder(t, p, q) {
  for (const poly of [t.outer, t.inner]) for (const [a, b] of segsOf(poly)) if (segHit(p, q, a, b) >= 0) return true;
  return false;
}

// lato della linea: >0 davanti (nel verso di gara), <0 dietro
function side(t, p) {
  return (p.x - t.finish.a.x) * t.normal.x + (p.y - t.finish.a.y) * t.normal.y;
}

function crossesFinish(t, p, q) {
  return segHit(p, q, t.finish.a, t.finish.b) >= 0;
}

// +1 passaggio in avanti, -1 all'indietro, 0 nessuno
export function finishCross(t, p, q) {
  if (!crossesFinish(t, p, q)) return 0;
  const sp = side(t, p), sq = side(t, q);
  if (sp < 0 && sq >= 0) return 1;
  if (sp >= 0 && sq < 0) return -1;
  return 0;
}

// Caselle di partenza: una sola fila, subito dietro la linea, dentro la pista. Tutte le auto partono affiancate.
function startSlots(t) {
  const f = t.finish, out = [];
  const minX = Math.floor(Math.min(f.a.x, f.b.x)) - 2, maxX = Math.ceil(Math.max(f.a.x, f.b.x)) + 2;
  const minY = Math.floor(Math.min(f.a.y, f.b.y)) - 2, maxY = Math.ceil(Math.max(f.a.y, f.b.y)) + 2;
  const L = dist(f.a, f.b), ux = (f.b.x - f.a.x) / L, uy = (f.b.y - f.a.y) / L;
  for (let x = minX; x <= maxX; x++)
    for (let y = minY; y <= maxY; y++) {
      const p = { x, y }, s = side(t, p);
      const along = (x - f.a.x) * ux + (y - f.a.y) * uy;
      if (s < -1 || s >= 0 || along < 0 || along > L) continue;
      if (goodCell(t, p) && !crossesBorder(t, p, { x: p.x + t.normal.x * 1.6, y: p.y + t.normal.y * 1.6 })) out.push({ x, y, along });
    }
  return out.sort((a, b) => a.along - b.along).map(({ x, y }) => ({ x, y }));
}

// quante auto ci stanno sulla linea, lasciando una casella libera tra due auto
export function capacity(slots) {
  const taken = [];
  for (const s of slots) if (taken.every((q) => Math.hypot(q.x - s.x, q.y - s.y) >= 1.5)) taken.push(s);
  return taken.length;
}

// posti sulla linea appena disegnata, nel verso peggiore (il verso si sceglie dopo)
export function finishCapacity(outer, inner, finish) {
  const base = { outer, inner, finish };
  return Math.min(...finishNormals(finish).map((normal) => capacity(startSlots({ ...base, normal }))));
}

// Prova che esista un giro: dalle caselle davanti alla linea, a passi di una casella, senza ripassare la linea,
// si deve arrivare alle caselle dietro la linea.
function checkLapPossible(t) {
  const key = (p) => p.x + ',' + p.y;
  const goal = new Set(t.startSlots.map(key));
  const queue = [], seen = new Set();
  for (const s of t.startSlots) {
    const q = { x: Math.round(s.x + t.normal.x * 1.5), y: Math.round(s.y + t.normal.y * 1.5) };
    if (goodCell(t, q) && !crossesBorder(t, s, q)) { queue.push(q); seen.add(key(q)); }
  }
  const b = t.bbox, cache = new Map();
  const good = (p) => { const k = key(p); if (!cache.has(k)) cache.set(k, goodCell(t, p)); return cache.get(k); };
  let guard = 0;
  while (queue.length && guard++ < 200000) {
    const p = queue.shift();
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++) {
        if (!dx && !dy) continue;
        const q = { x: p.x + dx, y: p.y + dy };
        if (q.x < b.minX - 1 || q.x > b.maxX + 1 || q.y < b.minY - 1 || q.y > b.maxY + 1) continue;
        const k = key(q);
        if (seen.has(k) || !good(q) || crossesFinish(t, p, q) || crossesBorder(t, p, q)) continue;
        if (goal.has(k)) return true;
        seen.add(k);
        queue.push(q);
      }
  }
  return false;
}

// direzione "avanti" lungo la pista in un punto, arrotondata a 8 direzioni
export function trackDir(t, p) {
  let sx = 0, sy = 0;
  for (const [poly, sign] of [[t.outer, t.outerSign], [t.inner, t.innerSign]]) {
    let best = Infinity, tx = 0, ty = 0;
    segsOf(poly).forEach(([a, b]) => {
      const d = distToSeg(p, a, b).d;
      if (d < best) { best = d; const l = dist(a, b) || 1; tx = ((b.x - a.x) / l) * sign; ty = ((b.y - a.y) / l) * sign; }
    });
    sx += tx; sy += ty;
  }
  return dir8(sx, sy);
}

export function dir8(dx, dy) {
  if (!dx && !dy) return { x: 1, y: 0 };
  const k = Math.round(Math.atan2(dy, dx) / (Math.PI / 4));
  const a = (k * Math.PI) / 4;
  return { x: Math.round(Math.cos(a)), y: Math.round(Math.sin(a)) };
}

const RING = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
function forward3(d) {
  const i = RING.findIndex(([x, y]) => x === d.x && y === d.y);
  return [-1, 0, 1].map((o) => { const [x, y] = RING[(i + o + 8) % 8]; return { x, y }; });
}

function allowedGears(g) {
  if (g === 0) return [1];
  return [g - 1, g, g + 1].filter((x) => x >= 1 && x <= MAX_GEAR);
}

// ---------- gara ----------
// 10 auto pronte; dall'11ª i colori li crea il gioco
const BASE_COLORS = [
  ['Giallo', '#facc15'], ['Rosso', '#ef4444'], ['Blu', '#2563eb'], ['Verde', '#16a34a'], ['Arancio', '#f97316'],
  ['Viola', '#9333ea'], ['Azzurro', '#06b6d4'], ['Rosa', '#ec4899'], ['Bianco', '#f1f5f9'], ['Nero', '#27272a']
];

function hsl(h, s, l) {
  const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))));
  return '#' + [f(0), f(8), f(4)].map((v) => v.toString(16).padStart(2, '0')).join('');
}

// colori delle auto: il primo è l'ospite che mette l'auto per primo, l'ultimo chi ha creato la pista
export function carColors(n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const [name, hex] = BASE_COLORS[i] || [`Auto ${i + 1}`, hsl((i * 137.508 + 20) % 360, 0.72, i % 2 ? 0.42 : 0.6)];
    out.push({ name, hex, num: i + 1, role: i === n - 1 ? 'creatore' : 'ospite' });
  }
  return out;
}
export const COLORS = carColors(2);

export function newRace(track, laps, n = 2) {
  const d = dir8(track.normal.x, track.normal.y);
  return {
    track, laps, turn: 0, moves: 0, winner: null, phase: 'place', colors: carColors(n),
    cars: Array.from({ length: n }, (_, i) => ({ id: i, pos: null, gear: 0, dir: d, last: { x: 0, y: 0 }, progress: 0, crash: 0, path: [], moves: 0 }))
  };
}

// caselle di partenza dove l'auto di turno può andare: libere e tali che le auto ancora da mettere ci stiano tutte
export function placeable(race) {
  const placed = race.cars.filter((c) => c.pos).map((c) => c.pos);
  const left = race.cars.length - placed.length - 1;
  const freeOf = (list) => race.track.startSlots.filter((s) => list.every((q) => Math.hypot(q.x - s.x, q.y - s.y) >= 1.5));
  return freeOf(placed).filter((s) => capacity(freeOf([...placed, s])) >= left);
}

export function placeCar(race, p) {
  const car = race.cars[race.turn];
  const slot = race.track.startSlots.find((s) => s.x === p.x && s.y === p.y);
  if (!slot) return { error: 'Metti l’auto su una casella di partenza.' };
  if (!placeable(race).some((s) => s.x === p.x && s.y === p.y)) return { error: 'Lì non va bene: lascia posto alle altre auto.' };
  if (race.cars.some((c) => c !== car && c.pos && Math.hypot(c.pos.x - p.x, c.pos.y - p.y) < 1.5)) return { error: 'Troppo vicina a un’altra auto.' };
  car.pos = { x: p.x, y: p.y };
  car.path.push({ x: p.x, y: p.y, lap: 0 });
  if (race.cars.every((c) => c.pos)) { race.phase = 'race'; race.turn = 0; }
  else race.turn = (race.turn + 1) % race.cars.length;
  return { ok: true };
}

const occupied = (race, car, p) => race.cars.some((c) => c !== car && c.pos && c.pos.x === p.x && c.pos.y === p.y);

// Mosse possibili per l'auto di turno. Ogni mossa: {x, y, gear, crash, stop}
export function options(race) {
  const car = race.cars[race.turn], t = race.track, P = car.pos;
  const gears = allowedGears(car.gear);
  const cand = new Map();
  const add = (q, needGear) => {
    const g = cheb(q, P);
    if (needGear && g !== needGear) return;
    if (!gears.includes(g)) return;
    cand.set(q.x + ',' + q.y, { x: q.x, y: q.y, gear: g });
  };
  if (car.gear <= 1) for (const d of forward3(car.dir)) add({ x: P.x + d.x, y: P.y + d.y }, 1);
  if (car.gear >= 1) {
    const v = car.last.x || car.last.y ? car.last : car.dir;
    const ref = { x: P.x + v.x, y: P.y + v.y };
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) add({ x: ref.x + i, y: ref.y + j }, car.gear === 1 ? 2 : 0);
  }
  const out = [];
  for (const o of cand.values()) {
    if (occupied(race, car, o)) continue;
    if (goodCell(t, o) && !crossesBorder(t, P, o)) out.push({ ...o, crash: false, stop: { x: o.x, y: o.y } });
    else out.push({ ...o, crash: true, stop: crashStop(race, car, o) });
  }
  return out;
}

// ultima casella buona prima del bordo, lungo la mossa
function crashStop(race, car, q) {
  const P = car.pos, n = cheb(P, q), t = race.track;
  let last = { x: P.x, y: P.y };
  for (let k = 1; k <= n; k++) {
    const c = { x: Math.round(P.x + ((q.x - P.x) * k) / n), y: Math.round(P.y + ((q.y - P.y) * k) / n) };
    if (!goodCell(t, c) || crossesBorder(t, P, c) || occupied(race, car, c)) break;
    last = c;
  }
  return last;
}

// Applica la mossa scelta. Restituisce gli eventi per l'interfaccia.
export function applyMove(race, opt) {
  const car = race.cars[race.turn], t = race.track, P = car.pos, Q = opt.stop;
  const ev = [];
  const fc = finishCross(t, P, Q);
  if (fc) { car.progress += fc; ev.push({ type: fc > 0 ? 'line' : 'lineBack', car: car.id }); }
  const lap = Math.max(1, car.progress);
  car.pos = { x: Q.x, y: Q.y };
  car.moves++; race.moves++;
  car.path.push({ x: Q.x, y: Q.y, lap });
  const mv = { x: opt.x - P.x, y: opt.y - P.y };
  if (opt.crash) {
    car.gear = 0; car.last = { x: 0, y: 0 }; car.crash = CRASH_TURNS;
    car.dir = dir8(mv.x, mv.y);
    ev.push({ type: 'crash', car: car.id });
  } else {
    car.gear = opt.gear; car.last = mv; car.dir = dir8(mv.x, mv.y);
  }
  if (car.progress > race.laps) { race.winner = car.id; race.phase = 'over'; ev.push({ type: 'win', car: car.id }); return ev; }
  return ev.concat(nextTurn(race));
}

// Passa il turno. Un'auto ferma per urto salta i suoi turni: al primo resta com'è,
// al secondo si gira nel verso della pista; poi riparte in prima.
export function nextTurn(race) {
  const ev = [];
  for (let guard = 0; guard < race.cars.length * (CRASH_TURNS + 1) + 1; guard++) {
    race.turn = (race.turn + 1) % race.cars.length;
    const car = race.cars[race.turn];
    if (!car.crash) break;
    car.crash--;
    if (car.crash === 0) car.dir = trackDir(race.track, car.pos);
    ev.push({ type: 'skip', car: car.id, left: car.crash, turned: car.crash === 0 });
  }
  return ev;
}

export function currentLap(car) {
  return Math.max(1, car.progress);
}
