// Regole delle quattro specialità. Codice "puro" (niente pagina): lo usano il gioco, il computer e il server online.
// Una partita è un oggetto m serializzabile (JSON): bilie, birilli, punteggi, di chi è il turno.
// Un colpo: { dx, dz, speed, sy, sx } = direzione, velocità, effetto; più, se servono:
//   px, pz = dove mettere la bilia "in mano"; call = buca chiamata per la nera; qx, qz = dove mettere il pallino (boccette).
//
// Regolamenti di riferimento (vedi RULES e docs/biliardo.md):
//   Palla 8: World Standardized Rules WPA (8-Ball). Snooker: Official Rules of Snooker WPBSA.
//   5 birilli: regole UMB/FIBiS della specialità. Boccette: Regolamento tecnico FIBiS "Boccette 5 birilli" (2017).
//   Palla 9: World Standardized Rules WPA (9-Ball). Carambola (libera, una sponda, tre sponde): regolamento UMB.
import * as P from './physics.js?v=650caf6b85';

export const VARIANTS = {
  otto: { name: 'Palla 8', table: 'pool', desc: 'Piene contro rigate, poi la nera in una buca chiamata.' },
  nove: { name: 'Palla 9', table: 'pool', desc: 'Si colpisce sempre per prima la bilia col numero più basso: chi imbuca la 9 vince.' },
  snooker: { name: 'Snooker', table: 'snooker', desc: 'Rossa, colore, rossa… vince chi fa più punti.' },
  italiana: { name: 'Biliardo all\'italiana', table: 'carom', desc: '5 birilli: con la tua bilia colpisci quella dell\'avversario e mandala sui birilli o sul pallino.' },
  carambola: { name: 'Carambola', table: 'carom', desc: 'Senza buche né birilli: la tua bilia deve toccare le altre due (libera, a una sponda o a tre sponde).' },
  boccette: { name: 'Boccette', table: 'carom', desc: 'Si gioca a mano: accosto al pallino e birilli abbattuti con le bilie dell\'avversario.' },
};
export const TARGETS = { italiana: [25, 50, 60], boccette: [50, 80, 100], carambola: [10, 15, 25, 40] };
export const DEFAULT_TARGET = { italiana: 60, boccette: 80, carambola: 15 };
// carambola: sponde da toccare prima della seconda bilia (0 = libera, 1 = una sponda, 3 = tre sponde)
export const CUSHIONS = [0, 1, 3];
export const REDS = [6, 10, 15];
// colori del panno (online li sceglie chi crea la partita e li vedono uguali tutti)
export const CLOTH_KEYS = ['verde', 'blu', 'rosso', 'grigio', 'viola'];

const tables = {};
export const tableOf = (m) => tables[VARIANTS[m.variant].table] || (tables[VARIANTS[m.variant].table] = P.makeTable(VARIANTS[m.variant].table));

// ---------- numeri e colori delle bilie ----------
export const SOLID = 'piene', STRIPE = 'rigate';
export const groupOf = (id) => (id >= 1 && id <= 7 ? SOLID : id >= 9 && id <= 15 ? STRIPE : null);
export const snkValue = (id) => (id >= 1 && id <= 15 ? 1 : id >= 16 && id <= 21 ? id - 14 : 0);
export const SNK_NAMES = { 1: 'rossa', 2: 'gialla', 3: 'verde', 4: 'marrone', 5: 'blu', 6: 'rosa', 7: 'nera' };
export const POCKET_NAMES = ['in alto a sinistra', 'centrale in alto', 'in alto a destra', 'in basso a sinistra', 'centrale in basso', 'in basso a destra'];

// aspetto delle bilie per la grafica
export function ballLook(m, b) {
  const v = m.variant;
  if (v === 'otto' || v === 'nove') {
    const C = ['#f4f1e6', '#f2c414', '#1f4fc4', '#d42a26', '#5b2a8f', '#f0711c', '#16804a', '#7a1f1f', '#111111'];
    return { color: b.id === 0 ? C[0] : b.id === 8 ? C[8] : C[((b.id - 1) % 8) + 1], stripe: b.id >= 9, num: b.id || null, dot: b.id === 0 };
  }
  if (v === 'snooker') {
    const C = { 16: '#f2d214', 17: '#10804a', 18: '#6b3a1e', 19: '#1d4fd0', 20: '#ff7aa8', 21: '#0d0d0d' };
    return { color: b.id === 0 ? '#f4f1e6' : C[b.id] || '#c8141e', dot: b.id === 0 };
  }
  if (v === 'italiana' || v === 'carambola') return { color: ['#f4f1e6', '#f2c414', '#c8141e'][b.id], dot: b.id === 0 };
  // boccette: 0 pallino, 1-4 rosse, 5-8 bianche
  if (b.id === 0) return { color: '#2a6fe0' };
  return b.id <= 4 ? { color: '#c8141e', ring: '#f4f1e6' } : { color: '#f4f1e6', ring: '#c8141e' };
}

// ---------- nuova partita ----------
export function newGame(variant, players, opts = {}) {
  const m = {
    variant,
    players: players.map((p) => ({ name: String(p.name || 'Giocatore').slice(0, 40), cpu: !!p.cpu, group: null })),
    cur: 0, inHand: null, over: false, winner: -1, shots: 0, scores: [0, 0],
    target: 0, msg: '', balls: [], pins: null, seed: (opts.seed >>> 0) || Math.floor(Math.random() * 2 ** 31),
  };
  const T = tableOf(m), R = T.R, { L } = T;
  const ball = (id, x, z, r = R) => P.makeBall(id, x, z, r);
  if (variant === 'otto') {
    m.open = true; m.breakShot = true; m.inHand = 'kitchen'; m.racks = 0;
    m.balls = rackOtto(T, m.seed);
  } else if (variant === 'nove') {
    // WPA: rombo con la 1 sulla punta (punto di fondo) e la 9 al centro; si spacca dalla cucina
    m.breakShot = true; m.inHand = 'kitchen'; m.fouls = [0, 0];
    m.balls = rackNove(T, m.seed);
  } else if (variant === 'carambola') {
    // UMB: rosso sul punto di fondo, bilia avversaria sul punto di testa, quella di chi apre sulla linea di testa
    // a 18,2 cm dal punto di testa. Il primo colpo deve prendere prima il rosso.
    m.cush = CUSHIONS.includes(opts.cush) ? opts.cush : 3;
    m.target = TARGETS.carambola.includes(opts.target) ? opts.target : DEFAULT_TARGET.carambola;
    m.breakShot = true;
    m.balls = [ball(0, -L / 2, 0.182), ball(1, -L / 2, 0), ball(2, L / 2, 0)];
  } else if (variant === 'snooker') {
    const reds = REDS.includes(opts.reds) ? opts.reds : 6;
    m.reds = reds; m.on = 'red'; m.inHand = 'D';
    const bx = baulkX(T);
    m.balls.push(ball(0, bx - 0.12, 0.08));
    const apex = L / 2 + 2 * R + 0.004, gap = 1.0008;
    let id = 1;
    for (let row = 0; id <= reds; row++) for (let j = 0; j <= row && id <= reds; j++) {
      m.balls.push(ball(id++, apex + row * Math.sqrt(3) * R * gap, (j - row / 2) * 2 * R * gap));
    }
    // le rosse che non servono restano fuori dal tavolo: così m.balls[id] è sempre la bilia id
    for (; id <= 15; id++) { const b = ball(id, 0, 0); b.on = false; m.balls.push(b); }
    for (id = 16; id <= 21; id++) { const s = snkSpot(T, id); m.balls.push(ball(id, s.x, s.z)); }
  } else if (variant === 'italiana') {
    // apertura (UMB): la bilia di chi comincia in mano nella metà di partenza, il pallino rosso sul punto
    // di fondo, la bilia avversaria sull'asse lungo a 10 cm dalla sponda corta di fondo
    m.target = TARGETS.italiana.includes(opts.target) ? opts.target : DEFAULT_TARGET.italiana;
    m.inHand = 'head';
    m.balls = [ball(0, -L / 2, 0.12), ball(1, L - 0.1, 0), ball(2, L / 2, 0)];
    m.pins = P.makePins();
  } else if (variant === 'boccette') {
    m.target = TARGETS.boccette.includes(opts.target) ? opts.target : DEFAULT_TARGET.boccette;
    m.round = 0;
    m.balls = [ball(0, L / 2, 0, 0.0295)]; // pallino: 59 mm
    for (let id = 1; id <= 8; id++) { const b = ball(id, 0, 0); b.on = false; m.balls.push(b); }
    m.pins = P.makePins();
    newRound(m, 0);
  }
  m.first = m.cur;
  return m;
}

// Online a squadre (da 2 a 4 giocatori): i posti pari sono la squadra 0, i dispari la squadra 1.
// Tocca a turno ai compagni: ogni volta che la squadra riprende il tavolo tira il compagno successivo
// (come nel doppio di palla 8 e snooker); ptr = quale compagno per ciascuna squadra.
export const teamSeats = (seats, side) => seats.filter((_, i) => i % 2 === side);
export function shooterId(seats, ptr, side) {
  const list = teamSeats(seats, side);
  return list.length ? list[(ptr[side] || 0) % list.length] : null;
}
// Squadre scelte dai giocatori (online da 2 a 8, fino a 4 per squadra): net.teams = [[id…], [id…]].
// Le partite vecchie senza teams usano i posti alterni (teamSeats).
export const teamOf = (net, side) => (net.teams ? net.teams[side] || [] : teamSeats(net.seats || [], side));
export function shooterOf(net, side) {
  const list = teamOf(net, side);
  return list.length ? list[((net.ptr || [0, 0])[side] || 0) % list.length] : null;
}
export const sideOf = (net, id) => (net.teams ? net.teams.findIndex((t) => t.includes(id)) : (net.seats || []).indexOf(id) % 2);
// Doppio secondo i regolamenti: palla 8 e palla 9 come lo "scotch doubles" WPA (i compagni si alternano a ogni
// colpo), boccette a coppie FIBiS (ognuno la sua bocciata, a turno); snooker, 5 birilli e carambola: i compagni si
// alternano a ogni turno al tavolo. In ogni caso l'ordine dei compagni è fisso e obbligato.
export const EVERY_SHOT = ['otto', 'nove', 'boccette'];
export const MAX_TEAM = 4;
export function teamName(names) {
  return names.length > 1 ? names.slice(0, -1).join(', ') + ' e ' + names[names.length - 1] : names[0] || 'Giocatore';
}

// Chi comincia (a caso in 2 giocatori e online)
export function setStarter(m, pi) {
  m.cur = m.first = pi;
  if ((m.variant === 'italiana' || m.variant === 'carambola') && pi === 1) {
    const [a, b] = m.balls;
    [a.x, b.x] = [b.x, a.x]; [a.z, b.z] = [b.z, a.z];
  }
  if (m.variant === 'boccette') { m.round = 0; newRound(m, pi); }
}

export const baulkX = (T) => -T.L + 0.737;
export const D_R = 0.292;
export function snkSpot(T, id) {
  const bx = baulkX(T);
  return ({ 16: { x: bx, z: D_R }, 17: { x: bx, z: -D_R }, 18: { x: bx, z: 0 }, 19: { x: 0, z: 0 }, 20: { x: T.L / 2, z: 0 }, 21: { x: T.L - 0.324, z: 0 } })[id];
}
// penitenze (boccette): sull'asse lungo, al centro delle due metà e a 10 cm dalle sponde corte
export const penitenze = (T) => [T.L - 0.1, T.L / 2, -T.L / 2, -T.L + 0.1].map((x) => ({ x, z: 0 }));

// palla 9: rombo da 9 (righe 1-2-3-2-1), la 1 in punta sul punto di fondo, la 9 al centro, le altre a caso
function rackNove(T, seed) {
  let s = (seed >>> 0) || 1;
  const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  const R = T.R, gap = 1.0008, balls = [];
  for (let id = 0; id <= 9; id++) balls.push(P.makeBall(id, 0, 0, R));
  balls[0].x = -T.L / 2;
  const rest = [2, 3, 4, 5, 6, 7, 8];
  for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
  const rows = [1, 2, 3, 2, 1];
  let k = 0;
  rows.forEach((n, row) => {
    for (let j = 0; j < n; j++) {
      const id = row === 0 ? 1 : row === 2 && j === 1 ? 9 : rest[k++];
      const b = balls[id];
      b.x = T.L / 2 + row * Math.sqrt(3) * R * gap;
      b.z = (j - (n - 1) / 2) * 2 * R * gap;
    }
  });
  return balls;
}

function rackOtto(T, seed) {
  let s = (seed >>> 0) || 1;
  const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  const R = T.R;
  const balls = [];
  for (let id = 0; id <= 15; id++) balls.push(P.makeBall(id, 0, 0, R));
  balls[0].x = -T.L / 2; balls[0].z = 0;
  // WPA: la nera al centro, la punta sul punto di fondo, negli angoli dietro una piena e una rigata
  const solids = [1, 2, 3, 4, 5, 6, 7], stripes = [9, 10, 11, 12, 13, 14, 15];
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  shuffle(solids); shuffle(stripes);
  const order = new Array(15).fill(0);
  order[4] = 8;
  const flip = rnd() < 0.5;
  order[10] = flip ? solids.pop() : stripes.pop();
  order[14] = flip ? stripes.pop() : solids.pop();
  const rest = shuffle([...solids, ...stripes]);
  for (let i = 0; i < 15; i++) if (!order[i]) order[i] = rest.pop();
  const gap = 1.0008;
  let k = 0;
  for (let row = 0; row < 5; row++) for (let j = 0; j <= row; j++) {
    const b = balls[order[k++]];
    b.x = T.L / 2 + row * Math.sqrt(3) * R * gap;
    b.z = (j - row / 2) * 2 * R * gap;
  }
  return balls;
}

// boccette: una "giocata" comincia con il pallino messo in gioco da chi ha diritto alla bocciata d'acchito
function newRound(m, starter) {
  const T = tableOf(m);
  m.round++;
  m.left = [4, 4];
  m.starter = starter;
  m.cur = starter;
  m.acchito = true;
  m.lastThrow = -1;
  m.penPallino = null;
  for (const b of m.balls) if (b.id) { b.on = false; b.potted = false; }
  Object.assign(m.balls[0], { x: T.L / 2, z: 0, on: true });
  for (const p of m.pins) p.up = true;
  nextThrow(m);
}
function nextThrow(m) {
  const base = m.cur === 0 ? 1 : 5;
  m.nextBall = base + (4 - m.left[m.cur]);
  m.inHand = 'throw';
  const T = tableOf(m), b = m.balls[m.nextBall];
  const s = freeSpot(m, -T.L / 2 - 0.15, 0, -1, b.id);
  b.x = s.x; b.z = s.z;
}

// ---------- chi tira, cosa si deve colpire ----------
export function cueId(m) {
  if (m.variant === 'italiana' || m.variant === 'carambola') return m.cur === 0 ? 0 : 1;
  if (m.variant === 'boccette') return m.nextBall;
  return 0;
}
export const usesCue = (m) => m.variant !== 'boccette';
export const maxSpeed = (m) => (m.variant === 'boccette' ? 4.2 : m.variant === 'snooker' ? 7.5 : 7);
const onTable = (m, id) => m.balls[id] && m.balls[id].on;
// boccette: si possono bocciare (colpire direttamente) solo bilie e pallino oltre la linea di mezzeria
export const bocciabile = (b) => b.x - b.r > 0;

// Bilie che si possono colpire per prime (null = qualunque)
export function legalFirst(m) {
  if (m.variant === 'otto') {
    const g = m.players[m.cur].group;
    if (m.open || !g) return m.balls.filter((b) => b.on && b.id !== 0 && b.id !== 8).map((b) => b.id);
    const left = m.balls.filter((b) => b.on && groupOf(b.id) === g).map((b) => b.id);
    return left.length ? left : [8];
  }
  if (m.variant === 'nove') {
    const low = m.balls.find((b) => b.on && b.id);
    return low ? [low.id] : [];
  }
  if (m.variant === 'carambola') return m.breakShot ? [2] : null;
  if (m.variant === 'snooker') {
    // free ball: dopo un fallo, se chi entra è "snookerato", può colpire per prima qualunque bilia
    if (m.freeBall) return m.balls.filter((b) => b.on && b.id).map((b) => b.id);
    if (m.on === 'red') return m.balls.filter((b) => b.on && b.id >= 1 && b.id <= 15).map((b) => b.id);
    if (m.on === 'color') return [16, 17, 18, 19, 20, 21].filter((id) => onTable(m, id));
    const t = snkTarget(m);
    return t ? [t] : [];
  }
  if (m.variant === 'italiana') return [m.cur === 0 ? 1 : 0];
  if (m.acchito) return [0];
  return m.balls.filter((b) => b.on && bocciabile(b)).map((b) => b.id);
}
const snkTarget = (m) => [16, 17, 18, 19, 20, 21].find((id) => m.balls[id].on) || 0;
export const onEight = (m) => m.variant === 'otto' && !m.open && !m.breakShot && legalFirst(m)[0] === 8;

// Dove si può mettere la bilia in mano
export function canPlace(m, x, z) {
  const T = tableOf(m), id = cueId(m), b = m.balls[id], r = b.r;
  if (x < -T.L + r || x > T.L - r || z < -T.W + r || z > T.W - r) return false;
  if ((m.inHand === 'kitchen' || m.inHand === 'throw') && x > -T.L / 2) return false;
  if (m.inHand === 'head' && x > -r) return false;
  if (m.inHand === 'foot' && x < r) return false;
  if (m.inHand === 'D') {
    const bx = baulkX(T);
    if (x > bx || (x - bx) * (x - bx) + z * z > D_R * D_R) return false;
  }
  for (const o of m.balls) if (o.on && o.id !== id && (o.x - x) ** 2 + (o.z - z) ** 2 < (o.r + r + 0.0005) ** 2) return false;
  if (m.pins) for (const p of m.pins) if ((p.x - x) ** 2 + (p.z - z) ** 2 < (r + P.PIN_R + 0.002) ** 2) return false;
  return true;
}
// boccette: il pallino va messo oltre la linea di mezzeria, senza toccare i birilli
export function canPlacePallino(m, x, z) {
  const T = tableOf(m), r = m.balls[0].r;
  if (x - r <= 0 || x > T.L - r || z < -T.W + r || z > T.W - r) return false;
  for (const p of m.pins) if ((p.x - x) ** 2 + (p.z - z) ** 2 < (r + P.PIN_R + 0.004) ** 2) return false;
  return true;
}

function freeSpot(m, x, z, dir, skip) {
  const T = tableOf(m);
  for (let k = 0; k < 300; k++) {
    const tx = x + dir * k * 0.006;
    if (tx < -T.L + T.R || tx > T.L - T.R) break;
    if (m.balls.every((b) => !b.on || b.id === skip || (b.x - tx) ** 2 + (b.z - z) ** 2 > (b.r + T.R + 0.001) ** 2)) return { x: tx, z };
  }
  return { x, z: z + 3 * T.R };
}

// Snooker: bianca in mano nella D su un punto libero. Prima andava sempre allo stesso punto, anche dentro un'altra
// bilia (e la fisica le separava di colpo al primo istante del tiro). Si provano punti fissi, uguali su ogni telefono.
export function placeInD(m) {
  const T = tableOf(m), bx = baulkX(T), b = m.balls[0];
  m.inHand = 'D';
  Object.assign(b, { on: true, potted: false });
  for (const dx of [0.12, 0.06, 0.18, 0.24, 0.03])
    for (let k = 0; k < 19; k++) {
      const z = (k % 2 ? -1 : 1) * Math.ceil(k / 2) * 0.03;
      if (canPlace(m, bx - dx, z)) { b.x = bx - dx; b.z = z; return; }
    }
  b.x = bx - 0.12; b.z = 0;
}

// ---------- il colpo ----------
const num = (v) => typeof v === 'number' && Number.isFinite(v);
// Prepara il colpo (bilia in mano, pallino, buca chiamata) e lo dà alla bilia. Ritorna la bilia colpita.
export function beginShot(m, s) {
  const id = cueId(m), b = m.balls[id];
  if (m.variant === 'boccette' && m.acchito && num(s.qx) && num(s.qz) && canPlacePallino(m, s.qx, s.qz)) { m.balls[0].x = s.qx; m.balls[0].z = s.qz; }
  if (m.inHand && num(s.px) && num(s.pz) && canPlace(m, s.px, s.pz)) { b.x = s.px; b.z = s.pz; }
  b.on = true; b.potted = false;
  m.pre = {
    legal: legalFirst(m), cue: id, on: m.on, acchito: !!m.acchito, free: !!m.freeBall,
    target: m.variant === 'snooker' ? snkTarget(m) : 0,
    call: Number.isInteger(s.call) && s.call >= 0 && s.call < 6 ? s.call : -1,
    snap: m.variant === 'boccette' ? { balls: m.balls.map((o) => ({ on: o.on, x: o.x, z: o.z })), pins: m.pins.map((p) => ({ ...p })) } : null,
  };
  const sp = Math.max(0.05, Math.min(maxSpeed(m), +s.speed || 0));
  const cl = (v) => Math.max(-1, Math.min(1, +v || 0));
  // direzione: lo zero è una direzione vera (colpo di traverso), non un valore mancante
  let dx = num(s.dx) ? s.dx : 1;
  const dz = num(s.dz) ? s.dz : 0;
  if (dx === 0 && dz === 0) dx = 1;
  P.strike(b, dx, dz, sp, cl(s.sy), cl(s.sx));
  return b;
}

// Colpo completo senza grafica (server, computer): ritorna { events, out }
export function playShot(m, s) {
  beginShot(m, s);
  const events = P.simulate(tableOf(m), m.balls, m.pins);
  return { events, out: finishShot(m, events) };
}

const redsLeft = (m) => m.balls.filter((b) => b.on && b.id >= 1 && b.id <= 15).length;

// Il colpo è finito: giudica, assegna i punti, passa il turno. out = { msg, foul, keep, win }
export function finishShot(m, events) {
  for (const b of m.balls) { b.vx = b.vz = b.ux = b.uz = b.side = 0; }
  m.shots++;
  const fn = { otto: judgeOtto, nove: judgeNove, snooker: judgeSnooker, italiana: judgeItaliana, carambola: judgeCarambola, boccette: judgeBoccette }[m.variant];
  const out = fn(m, events);
  m.msg = out.msg || '';
  m.lastOut = { foul: out.foul || null, msg: m.msg, keep: !!out.keep };
  delete m.pre;
  return out;
}

const other = (m) => 1 - m.cur;
function firstHit(events, id) {
  for (const e of events) if (e.t === 'ball' && (e.a === id || e.b === id)) return e.a === id ? e.b : e.a;
  return null;
}
const pottedIds = (events) => events.filter((e) => e.t === 'pot').map((e) => e.a);
function endGame(m, winner, msg) {
  m.over = true; m.winner = winner; m.inHand = null; m.acchito = false;
  return { win: winner, msg };
}

// --- palla 8 (WPA World Standardized Rules)
function judgeOtto(m, events) {
  const pi = m.cur, me = m.players[pi], op = m.players[other(m)];
  const legal = m.pre.legal, T = tableOf(m);
  let first = null, railAfter = false;
  for (const e of events) {
    if (e.t === 'ball' && first === null && (e.a === 0 || e.b === 0)) first = e.a === 0 ? e.b : e.a;
    else if (e.t === 'rail' && first !== null) railAfter = true;
  }
  const potted = pottedIds(events);
  const cuePot = potted.includes(0), eight = potted.includes(8);
  const objPot = potted.filter((id) => id !== 0 && id !== 8);
  const wasBreak = m.breakShot, wasOnEight = !m.open && !wasBreak && legal.length === 1 && legal[0] === 8;
  // spacco valido: almeno una bilia in buca, oppure almeno quattro bilie numerate alla sponda
  if (wasBreak) {
    const railed = new Set(events.filter((e) => e.t === 'rail' && e.a !== 0).map((e) => e.a));
    if (!potted.some((id) => id) && railed.size < 4) {
      m.racks++;
      m.balls = rackOtto(T, m.seed + m.racks * 7919);
      m.cur = other(m); m.inHand = 'kitchen'; m.breakShot = true;
      return { foul: 'Spacco non valido', msg: `Spacco non valido (meno di 4 bilie alla sponda): si rifà il triangolo e spacca ${op.name}` };
    }
  }
  let foul = null;
  if (cuePot) foul = 'Bianca in buca';
  else if (!wasBreak && first === null) foul = 'Nessuna bilia toccata';
  else if (!wasBreak && !legal.includes(first)) foul = first === 8 ? 'Hai toccato prima la nera' : 'Hai toccato prima una bilia avversaria';
  else if (!wasBreak && !railAfter && !potted.length) foul = 'Nessuna bilia ha toccato la sponda dopo il contatto';
  m.breakShot = false;
  if (cuePot) { const s = freeSpot(m, -T.L / 2 - 0.1, 0, -1, 0); Object.assign(m.balls[0], { x: s.x, z: s.z, on: true, potted: false }); }
  if (eight) {
    const pocket = events.find((e) => e.t === 'pot' && e.a === 8).p;
    if (wasBreak) { const s = freeSpot(m, T.L / 2, 0, 1, 8); Object.assign(m.balls[8], { x: s.x, z: s.z, on: true, potted: false }); }
    else if (wasOnEight && !foul && m.pre.call === pocket) return endGame(m, pi, `${me.name} imbuca la nera nella buca chiamata e vince!`);
    else {
      const why = !wasOnEight ? 'Nera imbucata prima del tempo' : foul ? 'Nera imbucata con un fallo' : 'Nera nella buca sbagliata (non era quella chiamata)';
      return endGame(m, other(m), `${why}: vince ${op.name}`);
    }
  }
  let keep = false, assign = null;
  if (!foul) {
    // il tavolo resta aperto dopo lo spacco; poi il primo gruppo imbucato regolarmente decide
    if (m.open && !wasBreak && objPot.length) { assign = groupOf(objPot[0]); keep = true; }
    else if (m.open) keep = objPot.length > 0;
    else keep = objPot.some((id) => groupOf(id) === me.group);
  }
  if (assign) { m.open = false; me.group = assign; op.group = assign === SOLID ? STRIPE : SOLID; }
  let msg = '';
  if (foul) {
    // bianca in buca su uno spacco valido: bianca in mano dietro la linea di testa; altri falli: ovunque
    m.cur = other(m); m.inHand = wasBreak ? 'kitchen' : 'any';
    msg = `Fallo: ${foul.toLowerCase()}. Bianca in mano a ${op.name}${wasBreak ? ' (dietro la linea)' : ''}`;
  } else {
    m.inHand = null;
    if (assign) msg = `${me.name} gioca con le ${assign}`;
    else if (keep) msg = `Tocca ancora a ${me.name}`;
    else m.cur = other(m);
  }
  if (eight && wasBreak) msg = 'Nera in buca sullo spacco: torna sul punto. ' + msg;
  return { foul, keep, msg };
}

// --- snooker (WPBSA, senza "free ball", "miss" e richiesta di far rigiocare)
// --- palla 9 (WPA World Standardized Rules, 9-Ball; senza "push out")
function judgeNove(m, events) {
  const pi = m.cur, op = other(m), me = m.players[pi], T = tableOf(m);
  const lowest = m.pre.legal[0], wasBreak = m.breakShot;
  let first = null, railAfter = false;
  for (const e of events) {
    if (e.t === 'ball' && first === null && (e.a === 0 || e.b === 0)) first = e.a === 0 ? e.b : e.a;
    else if (e.t === 'rail' && first !== null) railAfter = true;
  }
  const potted = pottedIds(events), cuePot = potted.includes(0), nine = potted.includes(9);
  const objPot = potted.filter((id) => id !== 0);
  let foul = null;
  if (cuePot) foul = 'Bianca in buca';
  else if (first === null) foul = 'Nessuna bilia toccata';
  else if (first !== lowest) foul = `Dovevi colpire per prima la ${lowest}`;
  else if (wasBreak) {
    // spacco valido: prima la 1, poi almeno una bilia in buca o quattro bilie alla sponda
    const railed = new Set(events.filter((e) => e.t === 'rail' && e.a !== 0).map((e) => e.a));
    if (!objPot.length && railed.size < 4) foul = 'Spacco non valido (meno di 4 bilie alla sponda)';
  } else if (!railAfter && !objPot.length) foul = 'Nessuna bilia ha toccato la sponda dopo il contatto';
  m.breakShot = false;
  if (cuePot) { const s = freeSpot(m, -T.L / 2, 0, -1, 0); Object.assign(m.balls[0], { x: s.x, z: s.z, on: true, potted: false }); }
  if (nine && !foul) return endGame(m, pi, `${me.name} imbuca la 9 e vince!`);
  let msg = '';
  if (nine) { const s = freeSpot(m, T.L / 2, 0, 1, 9); Object.assign(m.balls[9], { x: s.x, z: s.z, on: true, potted: false }); msg = 'La 9 torna sul punto. '; }
  if (foul) {
    // tre falli di fila: partita persa
    m.fouls[pi]++;
    if (m.fouls[pi] >= 3) return endGame(m, op, `Tre falli di fila: vince ${m.players[op].name}`);
    m.cur = op; m.inHand = 'any';
    return { foul, keep: false, msg: msg + `Fallo: ${foul.toLowerCase()}. Bianca in mano a ${m.players[op].name}` + (m.fouls[pi] === 2 ? ` · ${me.name} è a due falli` : '') };
  }
  m.fouls[pi] = 0;
  m.inHand = null;
  const keep = objPot.length > 0;
  if (!keep) m.cur = op;
  return { foul: null, keep, msg: msg + (keep ? `Tocca ancora a ${me.name}` : '') };
}

// --- carambola (UMB): libera, a una sponda, a tre sponde
function judgeCarambola(m, events) {
  const pi = m.cur, op = other(m), me = m.players[pi];
  const mine = pi === 0 ? 0 : 1;
  // sequenza della propria bilia: le bilie toccate e quante sponde prima della seconda
  const hit = [];
  let rails = 0, railsBefore2nd = -1;
  for (const e of events) {
    if (e.t === 'rail' && e.a === mine) rails++;
    else if (e.t === 'ball' && (e.a === mine || e.b === mine)) {
      const o = e.a === mine ? e.b : e.a;
      if (!hit.includes(o)) { hit.push(o); if (hit.length === 2) { railsBefore2nd = rails; break; } }
    }
  }
  const wasBreak = m.breakShot;
  m.breakShot = false;
  let foul = null;
  if (wasBreak && hit[0] !== 2) foul = 'In apertura devi colpire per primo il pallino rosso';
  const point = !foul && hit.length === 2 && railsBefore2nd >= m.cush;
  let msg = '';
  if (point) {
    m.scores[pi]++;
    if (m.scores[pi] >= m.target) return endGame(m, pi, `${me.name} arriva a ${m.scores[pi]} e vince!`);
    msg = `Punto! ${me.name} ${m.scores[pi]}/${m.target}, tira ancora`;
  } else {
    m.cur = op;
    if (foul) msg = `Fallo: ${foul.toLowerCase()}. Tocca a ${m.players[op].name}`;
    else if (hit.length === 2) msg = `Carambola senza le ${m.cush} sponde prima della seconda bilia: niente punto`;
  }
  return { foul, keep: point, msg };
}

function respot(m, id) {
  const T = tableOf(m), b = m.balls[id];
  const free = (x, z) => m.balls.every((o) => !o.on || o.id === id || (o.x - x) ** 2 + (o.z - z) ** 2 > (2 * T.R + 0.001) ** 2);
  let s = snkSpot(T, id);
  if (!free(s.x, s.z)) {
    const alt = [21, 20, 19, 18, 17, 16].map((k) => snkSpot(T, k)).find((p) => free(p.x, p.z));
    s = alt || freeSpot(m, s.x, s.z, 1, id);
  }
  Object.assign(b, { x: s.x, z: s.z, on: true, potted: false });
}
function judgeSnooker(m, events) {
  const pi = m.cur, op = other(m);
  const pre = m.pre, T = tableOf(m);
  const first = firstHit(events, 0);
  const potted = pottedIds(events);
  const cuePot = potted.includes(0);
  const colors = potted.filter((id) => id >= 16);
  const reds = potted.filter((id) => id >= 1 && id <= 15);
  let foul = null, valueOn = 1;
  if (pre.on === 'color') valueOn = first >= 16 ? snkValue(first) : 0;
  if (pre.on === 'clear') valueOn = snkValue(pre.target);
  // free ball (regola 10 WPBSA): la bilia colpita per prima, se non è quella "on", vale come la bilia on
  const freeId = pre.free && first !== null && (pre.on === 'red' ? first >= 16 : pre.on === 'clear' ? first !== pre.target : false) ? first : 0;
  if (cuePot) foul = 'Bianca in buca';
  else if (first === null) foul = 'Nessuna bilia toccata';
  else if (freeId) { /* free ball: qualunque prima bilia va bene */ }
  else if (pre.on === 'red' && !(first >= 1 && first <= 15)) foul = 'Dovevi colpire una rossa';
  else if (pre.on === 'color' && first < 16) foul = 'Dovevi colpire un colore';
  else if (pre.on === 'clear' && first !== pre.target) foul = `Dovevi colpire la ${SNK_NAMES[snkValue(pre.target)]}`;
  if (!foul) {
    if (freeId && pre.on === 'red' && colors.some((c) => c !== freeId)) foul = 'Imbucato un colore diverso dalla free ball';
    else if (freeId && pre.on === 'clear' && potted.some((id) => id !== freeId && id !== pre.target)) foul = 'Imbucata la bilia sbagliata';
    else if (!freeId && pre.on === 'red' && colors.length) foul = 'Colore imbucato al posto della rossa';
    else if (pre.on === 'color' && (reds.length || colors.some((c) => c !== first))) foul = 'Imbucata la bilia sbagliata';
    else if (!freeId && pre.on === 'clear' && potted.some((id) => id !== pre.target)) foul = 'Imbucata la bilia sbagliata';
  }
  const blackDown = potted.includes(21) && pre.on === 'clear' && pre.target === 21;
  let keep = false, msg = '';
  if (foul) {
    // penale: almeno 4, oppure il valore più alto fra bilia "on", bilia colpita e bilie imbucate
    const pen = Math.max(4, valueOn, freeId ? 0 : snkValue(first || 0), ...potted.filter((id) => id !== freeId).map(snkValue));
    m.scores[op] += pen;
    msg = `Fallo: ${foul.toLowerCase()}. ${pen} punti a ${m.players[op].name}`;
    if (!blackDown) for (const c of colors) respot(m, c);
  } else if (freeId) {
    // la free ball imbucata vale come la bilia on (una rossa = 1, oppure il colore di turno) e torna sul suo punto
    const pts = pre.on === 'red' ? reds.length + (potted.includes(freeId) ? 1 : 0) : potted.length ? valueOn : 0;
    if (potted.includes(freeId)) respot(m, freeId);
    if (pts) { m.scores[pi] += pts; keep = true; msg = `Free ball: +${pts}`; }
  } else if (pre.on === 'red') { if (reds.length) { m.scores[pi] += reds.length; keep = true; msg = `+${reds.length}`; } }
  else if (pre.on === 'color') {
    if (colors.length) { m.scores[pi] += snkValue(first); keep = true; msg = `+${snkValue(first)} (${SNK_NAMES[snkValue(first)]})`; respot(m, first); }
  } else if (colors.length) { m.scores[pi] += valueOn; keep = true; msg = `+${valueOn}`; }
  if (cuePot) placeInD(m);
  else m.inHand = null;
  // fine del frame: l'ultima nera (imbucata o con un fallo)
  if (blackDown || (pre.on === 'clear' && pre.target === 21 && foul && potted.includes(21))) {
    const [a, b] = m.scores;
    if (a !== b) return endGame(m, a > b ? 0 : 1, `Frame finito ${a} a ${b}: vince ${m.players[a > b ? 0 : 1].name}`);
    // parità: nera di nuovo sul suo punto, si gioca dalla D
    respot(m, 21);
    placeInD(m);
    msg = 'Parità: la nera torna sul tavolo, bianca in mano nella D';
    keep = false;
  }
  if (!keep) m.cur = op;
  const left = redsLeft(m);
  if (keep && pre.on === 'red') m.on = 'color';
  else m.on = left ? 'red' : 'clear';
  if (foul && cuePot) msg += ' · bianca in mano nella D';
  // dopo un fallo: se chi entra non vede entrambi i bordi di nessuna bilia on, ha la free ball
  m.freeBall = false;
  if (foul && !cuePot && !m.over && snookered(m)) { m.freeBall = true; msg += ` · free ball per ${m.players[m.cur].name}`; }
  return { foul, keep, msg };
}
// "snookerato": per nessuna bilia on la bianca può arrivare in linea retta a sfiorarne entrambi i bordi
export function snookered(m) {
  const c = m.balls[0], R = tableOf(m).R;
  const free = m.freeBall; m.freeBall = false;
  const ons = legalFirst(m); m.freeBall = free;
  const clear = (tx, tz, skip) => {
    const dx = tx - c.x, dz = tz - c.z, l2 = dx * dx + dz * dz || 1e-9;
    return m.balls.every((b) => {
      if (!b.on || b.id === 0 || b.id === skip) return true;
      let t = ((b.x - c.x) * dx + (b.z - c.z) * dz) / l2;
      t = Math.max(0, Math.min(1, t));
      return (c.x + dx * t - b.x) ** 2 + (c.z + dz * t - b.z) ** 2 >= (2 * R * 0.99) ** 2;
    });
  };
  for (const id of ons) {
    const o = m.balls[id], dx = o.x - c.x, dz = o.z - c.z, l = Math.sqrt(dx * dx + dz * dz) || 1;
    const px = -dz / l, pz = dx / l;
    if ([-1, 1].every((s) => clear(o.x + px * s * 2 * R * 0.97, o.z + pz * s * 2 * R * 0.97, id))) return false;
  }
  return ons.length > 0;
}

// --- birilli
// valore dei birilli abbattuti (filtro: quali contare). Il rosso al centro abbattuto da solo vale `alone`.
function pinPoints(pins, filter, alone) {
  const all = pins.filter((p) => !p.up), down = all.filter(filter);
  if (!down.length) return 0;
  const red = down.some((p) => p.red), whites = down.filter((p) => !p.red).length;
  if (red && all.length === 1) return alone;
  return whites * 2 + (red ? 4 : 0);
}
const standPins = (m) => { for (const p of m.pins) { p.up = true; p.by = -1; } };

// --- 5 birilli (biliardo all'italiana, regole UMB/FIBiS)
function judgeItaliana(m, events) {
  const pi = m.cur, op = other(m);
  const mine = pi === 0 ? 0 : 1, opp = pi === 0 ? 1 : 0, red = 2;
  // ordine dei contatti della propria bilia
  let first = null, pinFirst = false;
  for (const e of events) {
    if (e.t === 'pin' && e.a === mine && first === null) { pinFirst = true; break; }
    if (e.t === 'ball' && (e.a === mine || e.b === mine)) { first = e.a === mine ? e.b : e.a; break; }
  }
  let foul = null, pen = 0, hand = false;
  if (pinFirst) { foul = 'La tua bilia ha preso i birilli prima della bilia avversaria'; pen = 2; hand = true; }
  else if (first === null) { foul = 'Non hai colpito la bilia avversaria'; pen = 2; hand = true; }
  else if (first === red) { foul = 'Hai colpito prima il pallino rosso'; pen = 2; hand = true; }
  else if (m.pins.some((p) => !p.up && p.by === mine)) { foul = 'La tua bilia ha abbattuto i birilli'; pen = pinPoints(m.pins, () => true, 10); }
  let pts = 0, msg = '';
  if (!foul) {
    // il rosso conta sui birilli solo se l'ha mosso la bilia avversaria
    let redByOpp = false, bonus = 0, seenOpp = false;
    for (const e of events) {
      if (e.t !== 'ball') continue;
      const has = (x, y) => (e.a === x && e.b === y) || (e.a === y && e.b === x);
      if (has(opp, red)) { redByOpp = true; if (!bonus) bonus = 3; } // "casin": l'avversaria sul rosso
      if (has(mine, opp)) seenOpp = true;
      else if (has(mine, red) && seenOpp && !bonus) bonus = 4; // carambola: la tua bilia sul rosso dopo l'avversaria
    }
    pts = pinPoints(m.pins, (p) => p.by === opp || (p.by === red && redByOpp), 10) + bonus;
    m.scores[pi] += pts;
    msg = pts ? `${m.players[pi].name}: +${pts} punti` : '';
  } else {
    m.scores[op] += pen;
    msg = `Fallo: ${foul.toLowerCase()}. ${pen} punti a ${m.players[op].name}${hand ? ', bilia in mano' : ''}`;
  }
  standPins(m);
  m.inHand = null;
  if (m.scores[pi] >= m.target) return endGame(m, pi, `${m.players[pi].name} arriva a ${m.scores[pi]} e vince!`);
  if (m.scores[op] >= m.target) return endGame(m, op, `${m.players[op].name} arriva a ${m.scores[op]} e vince!`);
  m.cur = op;
  // bilia in mano: nella metà del tavolo opposta alla bilia di chi ha fatto fallo
  if (hand) m.inHand = m.balls[mine].x > 0 ? 'head' : 'foot';
  return { foul, keep: false, msg, points: pts };
}

// --- boccette (Regolamento tecnico FIBiS "Boccette 5 birilli")
const ACCOSTO = [0, 2, 3, 5, 8]; // art. 12: 1, 2, 3, 4 bilie più vicine
const color = (id) => (id >= 1 && id <= 4 ? 0 : id >= 5 ? 1 : -1);
function dists(m, pl) {
  const p = m.balls[0], out = [];
  for (let id = pl === 0 ? 1 : 5, e = id + 4; id < e; id++) { const b = m.balls[id]; if (b.on) out.push((b.x - p.x) ** 2 + (b.z - p.z) ** 2); }
  return out.sort((a, b) => a - b);
}
function restore(m, snap) {
  snap.balls.forEach((s, i) => Object.assign(m.balls[i], s));
  m.pins = snap.pins.map((p) => ({ ...p }));
}
function judgeBoccette(m, events) {
  const pi = m.cur, op = other(m), thrown = m.pre.cue, T = tableOf(m);
  const snap = m.pre.snap;
  // primi contatti della bilia lanciata: sponda corta in fondo (3) o sponde lunghe (0, 1) prima del contatto
  let first = null, firstAt = -1, pinFirst = false, topRail = false, longRail = false;
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (e.t === 'pin' && e.a === thrown && first === null) { pinFirst = true; break; }
    if (e.t === 'rail' && e.a === thrown && first === null) { if (e.k === 3) topRail = true; else if (e.k === 0 || e.k === 1) longRail = true; }
    if (e.t === 'ball' && (e.a === thrown || e.b === thrown)) { first = e.a === thrown ? e.b : e.a; firstAt = i; break; }
  }
  // la bilia colpita per prima va "direttamente" sui birilli? (il suo primo evento dopo il colpo è un birillo)
  let firstDirect = false;
  if (first !== null) for (let i = firstAt + 1; i < events.length; i++) {
    const e = events[i];
    if (e.t === 'pin' && e.a === first) { firstDirect = true; break; }
    if ((e.t === 'rail' && e.a === first) || (e.t === 'ball' && (e.a === first || e.b === first))) break;
  }
  const all = m.pins.filter((p) => !p.up);
  const value = pinPoints(m.pins, () => true, 8);
  const anyOwn = all.some((p) => color(p.by) === pi);
  let msg = '', foul = null, toMe = 0, toOpp = 0;
  const wasAcchito = m.pre.acchito;
  const firstSnap = first !== null ? snap.balls[first] : null;
  const pallinoLow = !(snap.balls[0].x - m.balls[0].r > 0); // pallino non oltre la mezzeria (quadrato inferiore)
  // tiri irregolari (art. 9.3): e) birilli abbattuti direttamente dalla lanciata; q) bilia non bocciabile colpita;
  // p) pallino nel quadrato inferiore: l'accosto va fatto con la sponda corta in fondo o appoggiandosi a una bilia bocciabile
  const irregular = pinFirst ? 'La tua bilia ha abbattuto direttamente i birilli'
    // (dopo la sponda corta in fondo non è una bocciata ma un accosto di sponda: si può toccare anche una bilia bassa)
    : !wasAcchito && firstSnap && !topRail && !(firstSnap.x - m.balls[first].r > 0) ? 'Hai bocciato una bilia non oltre la linea di mezzeria'
      : !wasAcchito && pallinoLow && !topRail && !firstSnap ? 'Col pallino nella metà bassa l\'accosto va fatto di sponda (in fondo) o appoggiandosi a una bilia'
        : null;
  // tiro di traversino (art. 9.2b): sponda lunga, poi una bilia che va dritta sui birilli → punti all'avversario
  const traversino = !wasAcchito && !irregular && longRail && !topRail && first !== null && firstDirect && value > 0;
  // tiro indiretto (doppio), tranne sul pallino messo in penitenza dopo un fallo d'acchito (art. 13a)
  const onPenitenza = m.penPallino && first === 0 && Math.abs(snap.balls[0].x - m.penPallino.x) < 1e-9 && Math.abs(snap.balls[0].z - m.penPallino.z) < 1e-9;
  if (wasAcchito && (first !== 0 || pinFirst)) {
    // art. 16: pallino regolarmente posizionato non colpito → punti all'avversario, boccetta annullata, pallino in penitenza
    foul = 'Pallino non colpito nella bocciata d\'acchito';
    toOpp = value;
    restore(m, snap);
    const pen = penitenze(T).find((q) => m.balls.every((b) => !b.on || b.id === 0 || (b.x - q.x) ** 2 + (b.z - q.z) ** 2 > 0.004)) || { x: T.L - 0.1, z: 0 };
    Object.assign(m.balls[0], pen);
    m.penPallino = { x: pen.x, z: pen.z };
    m.balls[thrown].on = false;
  } else if (irregular) {
    // la situazione si rimette com'era, la boccetta è annullata e i punti vanno all'avversario
    foul = irregular;
    toOpp = value;
    restore(m, snap);
    m.balls[thrown].on = false;
  } else if (traversino) {
    toOpp = value;
  } else if (value) {
    // art. 13: birilli dalle bilie avversarie o dal pallino = positivi; dalle proprie = negativi (anche misti)
    const double = topRail && !onPenitenza ? 2 : 1;
    if (anyOwn) toOpp = value * double; else toMe = value * double;
  }
  m.scores[pi] += toMe; m.scores[op] += toOpp;
  if (foul) msg = `Fallo: ${foul.toLowerCase()}${toOpp ? `. ${toOpp} punti a ${m.players[op].name}` : ''}`;
  else if (traversino) msg = `Tiro di traversino: ${toOpp} punti a ${m.players[op].name}`;
  else if (toMe) msg = `${m.players[pi].name}: +${toMe} punti${toMe > value ? ' (tiro indiretto, doppio)' : ''}`;
  else if (toOpp) msg = `Birilli abbattuti con le tue bilie: ${toOpp} punti a ${m.players[op].name}`;
  standPins(m);
  m.left[pi]--;
  m.acchito = false;
  m.lastThrow = pi;
  // vittoria con i birilli: subito (art. 7)
  for (const w of [pi, op]) if (m.scores[w] >= m.target) return endGame(m, w, `${m.players[w].name} arriva a ${m.scores[w]} e vince!`);
  if (!m.left[0] && !m.left[1]) return endRound(m, msg, foul);
  // tira chi ha l'accosto peggiore (dopo l'acchito tocca all'avversario); a parità chi ha tirato per ultimo
  let next;
  if (wasAcchito) next = op;
  else {
    const a = dists(m, pi)[0] ?? Infinity, b = dists(m, op)[0] ?? Infinity;
    next = a === b ? pi : a > b ? pi : op;
  }
  if (!m.left[next]) next = 1 - next;
  m.cur = next;
  nextThrow(m);
  return { foul, keep: next === pi, msg };
}
function endRound(m, msg, foul) {
  // art. 12: punti d'accosto alle bilie dello stesso colore più vicine della migliore avversaria
  const d0 = dists(m, 0), d1 = dists(m, 1);
  const b0 = d0[0] ?? Infinity, b1 = d1[0] ?? Infinity;
  let w = -1, n = 0;
  if (b0 !== b1) { w = b0 < b1 ? 0 : 1; const mine = w === 0 ? d0 : d1, lim = w === 0 ? b1 : b0; n = mine.filter((d) => d < lim).length; }
  const pts = ACCOSTO[n] || 0;
  if (w >= 0) m.scores[w] += pts;
  msg = (msg ? msg + ' · ' : '') + (w >= 0 ? `Fine giocata: accosto a ${m.players[w].name}, +${pts}` : 'Fine giocata: accosto pari, nessun punto');
  if (w >= 0 && m.scores[w] >= m.target) return endGame(m, w, `${m.players[w].name} arriva a ${m.scores[w]} e vince!`);
  // il pallino lo rimette in gioco chi ha fatto l'accosto (a parità si alterna)
  newRound(m, w >= 0 ? w : 1 - m.starter);
  return { foul, keep: false, msg, round: true };
}

// ---------- tiro automatico (server: quando il tempo scade) ----------
export function autoShot(m) {
  const id = cueId(m), c = m.balls[id];
  let tx, tz;
  const s = {};
  if (m.variant === 'boccette') { tx = m.balls[0].x; tz = m.balls[0].z; }
  else if (m.variant === 'carambola') { tx = m.balls[2].x; tz = m.balls[2].z; }
  else {
    const ids = legalFirst(m) || [];
    let best = null, bd = Infinity;
    for (const k of ids) { const b = m.balls[k]; const d = (b.x - c.x) ** 2 + (b.z - c.z) ** 2; if (b.on && d < bd) { bd = d; best = b; } }
    if (best) { tx = best.x; tz = best.z; } else { tx = c.x + 1; tz = c.z; }
    // palla 8: sulla nera il pilota automatico chiama la buca più vicina alla nera (la nera senza chiamata non vale)
    if (onEight(m)) {
      const T = tableOf(m), e = m.balls[8];
      let bp = 0, bq = Infinity;
      T.pockets.forEach((q, i) => { const d = (q.x - e.x) ** 2 + (q.z - e.z) ** 2; if (d < bq) { bq = d; bp = i; } });
      s.call = bp;
    }
  }
  const dx = tx - c.x, dz = tz - c.z, l = Math.sqrt(dx * dx + dz * dz) || 1;
  return { ...s, dx: dx / l, dz: dz / l, speed: m.variant === 'boccette' ? Math.min(3, 0.6 + l * 0.9) : 2.2, sy: 0, sx: 0 };
}

// Testo per il pannello del giocatore
export function status(m, pi) {
  if (m.variant === 'otto') { const g = m.players[pi].group; return g ? g : m.open ? 'tavolo aperto' : ''; }
  if (m.variant === 'snooker') return `${m.scores[pi]} punti`;
  if (m.variant === 'nove') return m.fouls && m.fouls[pi] ? `${m.fouls[pi]} ${m.fouls[pi] === 1 ? 'fallo' : 'falli'} di fila` : '';
  if (m.variant === 'boccette') return `${m.scores[pi]}/${m.target} · ${m.left[pi]} da tirare`;
  return `${m.scores[pi]}/${m.target} punti`;
}

// Cosa deve fare chi tira (riga di aiuto)
export function onText(m) {
  if (m.variant === 'nove') return (m.breakShot ? 'Spacco · ' : '') + `Colpisci per prima la ${legalFirst(m)[0] || 9}`;
  if (m.variant === 'carambola') {
    if (m.breakShot) return 'Apertura: colpisci per primo il pallino rosso';
    return m.cush ? `Tocca le altre due bilie, con almeno ${m.cush} ${m.cush === 1 ? 'sponda' : 'sponde'} prima della seconda` : 'Tocca le altre due bilie';
  }
  if (m.variant === 'snooker') {
    if (m.freeBall) return 'Free ball: puoi colpire per prima qualunque bilia (vale come la bilia on)';
    if (m.on === 'red') return 'Colpisci una rossa';
    if (m.on === 'color') return 'Colpisci un colore';
    return `Colpisci la ${SNK_NAMES[snkValue(snkTarget(m))]}`;
  }
  if (m.variant === 'italiana') return `Colpisci la bilia ${m.cur === 0 ? 'gialla' : 'bianca'}`;
  if (m.variant === 'boccette') return m.acchito ? `Giocata ${m.round}: metti il pallino oltre la metà e boccialo` : `Giocata ${m.round} · accosto o bocciata`;
  if (m.breakShot) return 'Spacco';
  if (onEight(m)) return 'Tocca alla nera: tocca una buca per chiamarla';
  return '';
}

export const RULES = {
  otto: [
    'Palla 8 secondo le regole mondiali WPA: 7 bilie piene (1-7), 7 rigate (9-15) e la nera (8), tavolo da 9 piedi.',
    'Spacco valido: almeno una bilia in buca o almeno quattro bilie numerate alla sponda; altrimenti si rifà il triangolo e spacca l\'avversario. Nera in buca sullo spacco: torna sul punto.',
    'Dopo lo spacco il tavolo è aperto: la prima bilia imbucata regolarmente decide il tuo gruppo. Se imbuchi una tua bilia continui.',
    'Fallo: bianca in buca, nessuna bilia toccata, prima bilia non tua, nessuna bilia alla sponda dopo il contatto. L\'avversario ha la bianca in mano ovunque (dietro la linea di testa se il fallo è sullo spacco).',
    'La nera si gioca solo a gruppo finito e va chiamata: tocca la buca prima di tirare. Perdi se la imbuchi prima del tempo, con un fallo o in un\'altra buca.',
    'Semplificazioni: le altre bilie non si chiamano (ogni buca vale) e manca la scelta di far rigiocare o rifare il triangolo dopo uno spacco non valido.',
  ],
  snooker: [
    'Snooker secondo le regole WPBSA, tavolo da 12 piedi: rosse da 1 punto e sei colori (gialla 2, verde 3, marrone 4, blu 5, rosa 6, nera 7). Si può giocare con 6, 10 o 15 rosse.',
    'Si alterna una rossa e un colore: il primo colore che colpisci è quello "chiamato". Finché ci sono rosse i colori imbucati tornano sul loro punto; poi si imbucano in ordine, dalla gialla alla nera.',
    'Fallo (bilia sbagliata colpita o imbucata, bianca in buca, nessun contatto): all\'avversario il valore più alto fra 4, la bilia da giocare e quelle coinvolte. Bianca in buca: si riparte dalla D.',
    'Quando cade l\'ultima nera vince chi ha più punti; a parità la nera torna sul punto e si gioca dalla D.',
    'Free ball: se dopo un fallo dell\'avversario non puoi colpire in linea retta entrambi i bordi di nessuna bilia on, puoi colpire per prima qualunque bilia; imbucata vale come la bilia on (una rossa = 1) e torna sul suo punto.',
    'Semplificazioni: niente regola del "miss" e niente richiesta di far rigiocare l\'avversario.',
  ],
  nove: [
    'Palla 9 secondo le regole mondiali WPA: bilie dalla 1 alla 9 a rombo, la 1 in punta e la 9 al centro, tavolo da 9 piedi.',
    'Si deve colpire per prima la bilia col numero più basso sul tavolo. Ogni bilia imbucata regolarmente fa continuare il turno.',
    'Chi imbuca la 9 con un tiro regolare vince, anche di combinazione o allo spacco. Se la 9 cade con un fallo torna sul punto di fondo.',
    'Spacco valido: prima la 1, poi almeno una bilia in buca o quattro bilie alla sponda. Fallo (bianca in buca, bilia sbagliata colpita per prima, nessun contatto, nessuna sponda dopo il contatto): bianca in mano ovunque all\'avversario.',
    'Tre falli di fila: partita persa.',
    'Semplificazione: niente "push out" dopo lo spacco.',
  ],
  carambola: [
    'Carambola secondo il regolamento UMB, tavolo da 2,84 × 1,42 m senza buche: bilia bianca, bilia gialla e pallino rosso.',
    'Apertura: rosso sul punto di fondo, bilia avversaria sul punto di testa, la tua sulla linea di testa a 18 cm di lato; devi colpire per primo il rosso.',
    'Fai un punto quando la tua bilia tocca le altre due. Nella partita "a una sponda" deve toccare almeno una sponda prima della seconda bilia, in quella "a tre sponde" almeno tre (anche la stessa più volte).',
    'Chi fa punto continua a tirare; se sbaglia tocca all\'avversario. Vince chi arriva per primo al punteggio scelto.',
    'Semplificazioni: niente ripresa di pareggio per il secondo giocatore e niente riquadri della partita libera.',
  ],
  italiana: [
    'Biliardo all\'italiana (5 birilli, regole UMB/FIBiS), tavolo da 2,84 × 1,42 m senza buche: bilia bianca, bilia gialla e pallino rosso; cinque birilli a croce al centro.',
    'Si tira un colpo a testa, sempre con la propria bilia, e si deve colpire per prima la bilia dell\'avversario.',
    'Punti: birillo bianco 2, birillo rosso al centro 4, il rosso abbattuto da solo 10. Bilia avversaria sul pallino ("casin") 3; la tua bilia sul pallino dopo l\'avversaria (carambola) 4: se succedono entrambe conta solo la prima. I birilli contano se li abbatte la bilia avversaria, o il pallino mosso da lei.',
    'Fallo con bilia in mano e 2 punti all\'avversario: mancare la bilia avversaria, colpire prima il pallino, toccare prima i birilli. Se la tua bilia abbatte i birilli dopo il contatto, il loro valore va all\'avversario. Con un fallo non si segnano punti.',
    'Bilia in mano: nella metà del tavolo opposta a quella dell\'altra bilia. Vince chi arriva per primo al punteggio scelto (di solito 60).',
  ],
  boccette: [
    'Boccette secondo il regolamento tecnico FIBiS "5 birilli": si gioca a mano, 4 bilie rosse contro 4 bianche, il pallino blu e i cinque birilli al centro.',
    'Ogni giocata comincia con il pallino messo oltre la linea di mezzeria e la bocciata d\'acchito, che deve colpirlo direttamente. Poi tira l\'avversario e, dopo, chi ha l\'accosto peggiore.',
    'Si lancia dalla propria zona, dietro la linea: prima del lancio puoi spostare la bilia a destra o a sinistra.',
    'Birilli: laterali 2 punti, centrale 4, il centrale da solo 8. Abbattuti con le bilie avversarie o col pallino sono punti tuoi, con le tue bilie vanno all\'avversario. Tiro indiretto (sponda corta in fondo prima del contatto): doppi, tranne sul pallino messo in penitenza dopo un fallo d\'acchito.',
    'Tiri irregolari (la boccetta è annullata, si rimette tutto com\'era e i punti vanno all\'avversario): abbattere i birilli direttamente con la propria bilia, bocciare una bilia che non ha superato la linea di mezzeria, mancare il pallino nella bocciata d\'acchito; col pallino nella metà bassa, fare l\'accosto senza passare dalla sponda corta in fondo o senza appoggiarsi a una bilia bocciabile.',
    'Tiro di traversino (sponda lunga, poi una bilia che va dritta sui birilli): il tiro vale ma i punti vanno all\'avversario.',
    'Finite le 8 bilie, punti d\'accosto a chi ha le bilie più vicine al pallino: 1 bilia 2 punti, 2 bilie 3, 3 bilie 5, 4 bilie 8. Chi fa l\'accosto rimette in gioco il pallino. Vince chi arriva al punteggio scelto.',
  ],
};
