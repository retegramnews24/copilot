// Gara a quadretti: regole pure, senza disegno. Le unità sono caselle (1 = un quadretto).
// Tutto lo stato è un oggetto semplice (JSON), così più avanti si può giocare online.

// La pista si approva dalla linea verde di partenza: ci devono stare tutte le auto affiancate.
// La larghezza tra i bordi ha solo un minimo piccolo e fisso, per far passare le auto.
export const MIN_WIDTH = 2.5;
// Versione delle regole: da aumentare quando un cambio di questo file cambia il risultato delle mosse. Il server la
// scrive nella gara; un telefono rimasto aperto con regole diverse chiede di chiudere e riaprire (analisi 10.14).
export const RULES_VERSION = 1;
export const MAX_CARS = 16;
export const minWidth = () => MIN_WIDTH;
// griglia di disegno quasi infinita
export const BOARD = 2000;
export const boardSize = () => BOARD;
// vista iniziale del disegno: più auto, più larga (caselle da un lato all'altro dello schermo)
export const startCells = (n) => Math.min(400, 40 + Math.max(0, n - 2) * 18);
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

// ---------- limiti della pista (analisi 10.2 e 10.10) ----------
// Il gioco disegna i bordi con un punto ogni mezza casella dentro la griglia. Il server li ricontrolla prima di ogni
// calcolo pesante: una pista fatta apposta (punti lontanissimi, bordo fittissimo, pista enorme) lo terrebbe occupato
// per decine di secondi. Le stesse regole valgono mentre si disegna, alla fine di ogni bordo, così il giocatore lo
// sa subito (analisi 11.2).
// Tetto per il tempo di calcolo, non per la memoria (analisi 11.6). Con inTrack per righe (11.1) una pista da 1 milione
// di caselle si controlla in circa 1,2 s e la mappa del pilota automatico costa 0,3 s su un PC; il vecchio tetto da
// 150 mila rifiutava quasi ogni pista disegnata con la vista oltre le 650 caselle.
export const MAX_TRACK_CELLS = 1000000; // caselle tra i due bordi
export const MIN_GAP = 0.1, MAX_GAP = 2; // distanza tra due punti vicini dello stesso bordo
const MARGIN = 5;
export const polyArea = (poly) => {
  let a = 0;
  for (const [p, q] of segsOf(poly)) a += p.x * q.y - q.x * p.y;
  return Math.abs(a) / 2;
};
export function trackCells(outer, inner) {
  return polyArea(outer) - polyArea(inner);
}
export function checkBorderShape(poly) {
  for (const [a, b] of segsOf(poly)) {
    if (a.x < -MARGIN || a.y < -MARGIN || a.x > BOARD + MARGIN || a.y > BOARD + MARGIN)
      return 'Bordo fuori dalla griglia: ridisegnalo più verso il centro.';
    const d = dist(a, b);
    if (d < MIN_GAP || d > MAX_GAP) return 'Bordo disegnato male: ridisegnalo con un tratto più morbido.';
  }
  return null;
}
export function checkTrackSize(outer, inner) {
  return trackCells(outer, inner) > MAX_TRACK_CELLS
    ? 'Pista troppo grande: disegnala più piccola (al massimo un milione di caselle tra i due bordi).'
    : null;
}
// Tutti i controlli di una pista online, nello stesso ordine, usati dal server (f1-server.js, makeTrack) e dal gioco
// sulla pista già arrotondata prima di mandarla (analisi 11.10): i due non possono più dare esiti diversi.
// Restituisce {track} oppure {error}. buildTrack è dichiarata più sotto (le funzioni si possono usare prima).
export function checkOnlineTrack({ outer, inner, finish, normal, players }) {
  const limit = checkBorderShape(outer) || checkBorderShape(inner) || checkTrackSize(outer, inner);
  if (limit) return { error: limit };
  const inside = checkInner(outer, inner, MIN_WIDTH);
  if (inside.error) return { error: inside.error };
  const ends = checkFinishEnds(outer, inner, finish);
  if (ends) return { error: ends };
  const nl = Math.hypot(normal.x, normal.y);
  const built = buildTrack(outer, inner, finish, { x: normal.x / nl, y: normal.y / nl }, players);
  return built.error ? { error: built.error } : { track: built.track };
}
export const onlineTrackError = (t) => checkOnlineTrack(t).error || null;
// la linea di partenza va da un bordo all'altro: un estremo sul segmento dichiarato del bordo esterno, l'altro
// su quello del bordo interno
export function checkFinishEnds(outer, inner, finish) {
  const on = (p, poly, k) => distToSeg(p, poly[k], poly[(k + 1) % poly.length]).d < 0.1;
  const ok =
    (on(finish.a, outer, finish.outerSeg) && on(finish.b, inner, finish.innerSeg)) ||
    (on(finish.b, outer, finish.outerSeg) && on(finish.a, inner, finish.innerSeg));
  return ok ? null : 'Linea di partenza non valida.';
}

// Indice a "secchi" dei segmenti di bordo: ogni controllo guarda solo i segmenti vicini,
// così anche le piste enormi (griglia quasi infinita) restano veloci.
const BUCKET = 4;
const bkey = (x, y) => (x + 20000) * 40000 + (y + 20000);
function makeIndex(polys) {
  const map = new Map();
  let stamp = 0;
  polys.forEach((poly, pi) => poly.forEach((a, i) => {
    const b = poly[(i + 1) % poly.length], s = { a, b, pi, i, m: 0 };
    const x0 = Math.floor(Math.min(a.x, b.x) / BUCKET), x1 = Math.floor(Math.max(a.x, b.x) / BUCKET);
    const y0 = Math.floor(Math.min(a.y, b.y) / BUCKET), y1 = Math.floor(Math.max(a.y, b.y) / BUCKET);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
      const k = bkey(x, y);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(s);
    }
  }));
  return {
    query(minX, minY, maxX, maxY) {
      const out = [];
      stamp++;
      const x0 = Math.floor(minX / BUCKET), x1 = Math.floor(maxX / BUCKET), y0 = Math.floor(minY / BUCKET), y1 = Math.floor(maxY / BUCKET);
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
        const l = map.get(bkey(x, y));
        if (l) for (const s of l) if (s.m !== stamp) { s.m = stamp; out.push(s); }
      }
      return out;
    }
  };
}
// un indice per pista, tenuto fuori dallo stato (che resta JSON semplice)
const IDX = new WeakMap();
function trackIndex(t) {
  let e = IDX.get(t.outer);
  if (!e || e.inner !== t.inner) { e = { inner: t.inner, idx: makeIndex([t.outer, t.inner]) }; IDX.set(t.outer, e); }
  return e.idx;
}

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

// In uno spigolo vivo due punti presi a mezza casella lungo il tratto possono finire quasi uno sopra l'altro: il
// server li rifiutava (punti a meno di MIN_GAP) dopo che il gioco aveva accettato la pista (analisi 11.2). Si tolgono
// qui, con margine per l'arrotondamento a due decimali che si fa prima di mandarli.
function dropClose(poly) {
  const out = [];
  for (const p of poly) if (!out.length || dist(out[out.length - 1], p) >= MIN_GAP * 2) out.push(p);
  while (out.length > 2 && dist(out[out.length - 1], out[0]) < MIN_GAP * 2) out.pop();
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
  poly = dropClose(resample(chaikin(chaikin(poly)), 0.5, true));
  if (poly.length < 12) return { error: 'Bordo troppo piccolo.', at: first };
  const x = selfCross(poly);
  if (x) return { error: 'Il bordo si incrocia da solo.', at: x };
  return { poly };
}

function selfCross(poly) {
  const idx = makeIndex([poly]), n = poly.length;
  for (let i = 0; i < n; i++) {
    const a = poly[i], b = poly[(i + 1) % n];
    for (const s of idx.query(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.max(a.x, b.x), Math.max(a.y, b.y))) {
      const j = s.i;
      if (j <= i + 1 || (i === 0 && j === n - 1)) continue;
      const t = segHit(a, b, s.a, s.b);
      if (t >= 0) return lerp(a, b, t);
    }
  }
  return null;
}

const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

function polyCross(p, q) {
  const idx = makeIndex([q]);
  for (const [a, b] of segsOf(p))
    for (const s of idx.query(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.max(a.x, b.x), Math.max(a.y, b.y))) {
      const t = segHit(a, b, s.a, s.b);
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
  const polys = [outer, inner], idx = makeIndex(polys);
  const inTrack = (p) => pointInPoly(p, outer) && !pointInPoly(p, inner);
  // distanza lungo il bordo da un punto all'altro (analisi 11.5): prima si contavano i punti come se fossero sempre a
  // mezza casella, e un bordo fittissimo faceva migliaia di controlli inutili
  const along = polys.map((P) => {
    const acc = [0];
    for (let i = 1; i < P.length; i++) acc.push(acc[i - 1] + dist(P[i - 1], P[i]));
    return { acc, total: acc[P.length - 1] + dist(P[P.length - 1], P[0]) };
  });
  for (let pi = 0; pi < 2; pi++) {
    const P = polys[pi], { acc, total } = along[pi];
    for (let i = 0; i < P.length; i++) {
      const v = P[i];
      for (const s of idx.query(v.x - MIN_WIDTH, v.y - MIN_WIDTH, v.x + MIN_WIDTH, v.y + MIN_WIDTH)) {
        if (s.pi === pi) {
          const gap = Math.abs(acc[i] - acc[s.i]), k = Math.min(gap, total - gap);
          if (k < MIN_WIDTH * 1.6) continue; // vicini sullo stesso bordo
        }
        const { d, q } = distToSeg(v, s.a, s.b);
        if (d < MIN_WIDTH && d > 1e-6 && inTrack(lerp(v, q, 0.5))) return { error: `Pista troppo stretta qui: servono almeno ${String(MIN_WIDTH).replace('.', ',')} caselle.`, at: lerp(v, q, 0.5) };
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

// Dentro la pista? Le caselle hanno y intera: per ogni riga si calcola una volta sola dove incrocia i due bordi
// (stessa formula di pointInPoly, quindi stesso risultato) e poi basta una ricerca. Prima ogni casella scorreva tutti
// i punti dei bordi: su una pista grande la mappa del pilota automatico passava lì quasi tutto il tempo (analisi 11.1).
const ROWS = new WeakMap();
function rowCrossings(poly, y) {
  const xs = [];
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if (a.y > y !== b.y > y) xs.push(((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x);
  }
  return xs.sort((m, n) => m - n);
}
// quanti incroci stanno a destra di x (come il conteggio di pointInPoly: p.x < incrocio)
function rightOf(xs, x) {
  let lo = 0, hi = xs.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (xs[mid] > x) hi = mid; else lo = mid + 1; }
  return xs.length - lo;
}
export function inTrack(t, p) {
  if (!Number.isInteger(p.y)) return pointInPoly(p, t.outer) && !pointInPoly(p, t.inner);
  let rows = ROWS.get(t);
  if (!rows) ROWS.set(t, (rows = new Map()));
  let r = rows.get(p.y);
  if (!r) rows.set(p.y, (r = { o: rowCrossings(t.outer, p.y), i: rowCrossings(t.inner, p.y) }));
  return rightOf(r.o, p.x) % 2 === 1 && rightOf(r.i, p.x) % 2 === 0;
}

// distanza dal bordo più vicino, guardando fino a maxR caselle (oltre restituisce maxR)
export function clearance(t, p, maxR = 8) {
  let m = maxR;
  for (const s of trackIndex(t).query(p.x - maxR, p.y - maxR, p.x + maxR, p.y + maxR)) m = Math.min(m, distToSeg(p, s.a, s.b).d);
  return m;
}

const nearBorder = (t, p) => clearance(t, p, SAFE + 0.05) < SAFE;

export function goodCell(t, p) {
  return !nearBorder(t, p) && inTrack(t, p);
}

export function crossesBorder(t, p, q) {
  for (const s of trackIndex(t).query(Math.min(p.x, q.x), Math.min(p.y, q.y), Math.max(p.x, q.x), Math.max(p.y, q.y)))
    if (segHit(p, q, s.a, s.b) >= 0) return true;
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
      if (goodCell(t, p) && !crossesBorder(t, p, { x: p.x + t.normal.x, y: p.y + t.normal.y })) out.push({ x, y, along });
    }
  return out.sort((a, b) => a.along - b.along).map(({ x, y }) => ({ x, y }));
}

// quante auto ci stanno sulla linea, lasciando una casella libera tra due auto
export function capacity(slots) {
  const taken = [];
  for (const s of slots) if (taken.every((q) => Math.hypot(q.x - s.x, q.y - s.y) >= 1.5)) taken.push(s);
  return taken.length;
}

// posti sulla linea in un verso di gara
export function capacityFor(outer, inner, finish, normal) {
  return capacity(startSlots({ outer, inner, finish, normal }));
}

// posti sulla linea appena disegnata, nel verso migliore (il verso si sceglie dopo, e lì si ricontrolla)
export function finishCapacity(outer, inner, finish) {
  return Math.max(...finishNormals(finish).map((normal) => capacityFor(outer, inner, finish, normal)));
}

// Prova che esista un giro: dalle caselle davanti alla linea, a passi di una casella, senza ripassare la linea,
// si deve arrivare alle caselle dietro la linea.
function checkLapPossible(t) {
  const key = (p) => p.x + ',' + p.y;
  const goal = new Set(t.startSlots.map(key));
  const queue = [], seen = new Set();
  // primo passo dalla partenza: una casella in avanti (anche se cade proprio sulla linea)
  const fw = dir8(t.normal.x, t.normal.y);
  for (const s of t.startSlots) {
    const q = { x: s.x + fw.x, y: s.y + fw.y };
    if (goodCell(t, q) && !crossesBorder(t, s, q) && !seen.has(key(q))) { queue.push(q); seen.add(key(q)); }
  }
  const b = t.bbox;
  // si parte dentro la pista e non si attraversano mai i bordi: basta controllare la distanza dal bordo
  const good = (p) => !nearBorder(t, p);
  let head = 0;
  while (head < queue.length && head < 4000000) {
    const p = queue[head++];
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++) {
        if (!dx && !dy) continue;
        const q = { x: p.x + dx, y: p.y + dy };
        if (q.x < b.minX - 1 || q.x > b.maxX + 1 || q.y < b.minY - 1 || q.y > b.maxY + 1) continue;
        const k = key(q);
        // stessa regola della gara: è vietato solo passare da un lato all'altro della linea
        if (seen.has(k) || !good(q) || finishCross(t, p, q) !== 0 || crossesBorder(t, p, q)) continue;
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
  const car = race.cars[race.turn];
  return carOptions(race.track, car, (p) => occupied(race, car, p));
}

// Mosse possibili per un'auto qualsiasi (stato: pos, gear, dir, last). blocked(p) dice se una casella è occupata.
// Serve anche all'IA, che così gioca con le stesse identiche regole.
export function carOptions(t, car, blocked = () => false) {
  const P = car.pos;
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
    if (blocked(o)) continue;
    if (goodCell(t, o) && !crossesBorder(t, P, o)) out.push({ ...o, crash: false, stop: { x: o.x, y: o.y } });
    else out.push({ ...o, crash: true, stop: crashStop(t, P, o, blocked) });
  }
  return out;
}

// ultima casella buona prima del bordo, lungo la mossa
function crashStop(t, P, q, blocked) {
  const n = cheb(P, q);
  let last = { x: P.x, y: P.y };
  for (let k = 1; k <= n; k++) {
    const c = { x: Math.round(P.x + ((q.x - P.x) * k) / n), y: Math.round(P.y + ((q.y - P.y) * k) / n) };
    if (!goodCell(t, c) || crossesBorder(t, P, c) || blocked(c)) break;
    last = c;
  }
  return last;
}

// Muove un'auto (stato puro) con la mossa scelta: nuova posizione, marcia, direzione, giri. Restituisce gli eventi.
export function stepCar(t, car, opt) {
  const P = car.pos, Q = opt.stop, ev = [];
  const fc = finishCross(t, P, Q);
  if (fc) { car.progress += fc; ev.push({ type: fc > 0 ? 'line' : 'lineBack', car: car.id }); }
  car.pos = { x: Q.x, y: Q.y };
  const mv = { x: opt.x - P.x, y: opt.y - P.y };
  if (opt.crash) {
    car.gear = 0; car.last = { x: 0, y: 0 }; car.crash = CRASH_TURNS;
    car.dir = dir8(mv.x, mv.y);
    ev.push({ type: 'crash', car: car.id });
  } else {
    car.gear = opt.gear; car.last = mv; car.dir = dir8(mv.x, mv.y);
  }
  return ev;
}

// ---------- gara con mosse insieme (contro l'IA) ----------
// Tutte le auto scelgono, poi si muovono nello stesso momento. moves[i] = mossa dell'auto i (null se è ferma per urto).
// Un'auto ferma salta il giro di mosse: al primo resta com'è, al secondo si gira nel verso della pista, poi riparte in prima.
export function applyRound(race, moves) {
  const t = race.track, ev = [], over = [];
  race.cars.forEach((car, i) => {
    if (car.crash) {
      car.crash--;
      if (car.crash === 0) car.dir = trackDir(t, car.pos);
      ev.push({ type: 'skip', car: car.id, left: car.crash, turned: car.crash === 0 });
      return;
    }
    const opt = moves[i];
    if (!opt) return;
    const from = { ...car.pos };
    ev.push(...stepCar(t, car, opt));
    car.moves++;
    car.path.push({ x: car.pos.x, y: car.pos.y, lap: Math.max(1, car.progress) });
    // chi finisce: conta quanto è andato oltre la linea (in caso di arrivo nello stesso momento vince chi è più avanti)
    if (car.progress > race.laps) over.push({ id: car.id, beyond: side(t, car.pos), from });
  });
  race.moves++;
  if (over.length) {
    over.sort((a, b) => b.beyond - a.beyond || a.id - b.id);
    race.winner = over[0].id; race.phase = 'over';
    ev.push({ type: 'win', car: race.winner });
  }
  return ev;
}

// mosse dell'auto i in un giro di mosse insieme: non può fermarsi dove c'è un'auto ferma
export function roundOptions(race, i, avoid = []) {
  const car = race.cars[i];
  const still = race.cars.filter((c) => c !== car && c.crash && c.pos).map((c) => c.pos);
  const bad = [...still, ...avoid];
  return carOptions(race.track, car, (p) => bad.some((q) => q.x === p.x && q.y === p.y));
}

// Applica la mossa scelta. Restituisce gli eventi per l'interfaccia.
export function applyMove(race, opt) {
  const car = race.cars[race.turn];
  const ev = stepCar(race.track, car, opt);
  car.moves++; race.moves++;
  car.path.push({ x: car.pos.x, y: car.pos.y, lap: Math.max(1, car.progress) });
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
