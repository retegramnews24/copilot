// Fisica del biliardo in 2D (vista dall'alto): x lungo il tavolo, z lungo la larghezza. Unità: metri e secondi.
// Ogni bilia ha velocità v e "velocità di rotolamento" u (= ω × R al punto di contatto):
// se v ≠ u la bilia striscia e l'attrito la porta verso il rotolamento puro (5/7 della velocità per un colpo al centro).
// Così escono da sole le cose vere: colpo secco che si ferma, effetto a seguire e a ritornare.
//
// IMPORTANTE (online): qui si usano solo + − × ÷ e Math.sqrt, che danno lo stesso risultato al bit su ogni
// telefono e sul server. Niente sin/cos/exp/hypot nella simulazione: così lo stesso colpo dà lo stesso tavolo ovunque.

const G = 9.81;
const MU_SLIDE = 0.2;   // attrito di strisciamento sul panno
const ROLL_DECEL = 0.12; // decelerazione di rotolamento (m/s²)
const SPIN_DECAY = 3.2;  // smorzamento dell'effetto laterale (1/s)
const E_BALL = 0.94;     // elasticità bilia-bilia
const E_RAIL = 0.78;     // elasticità sponda
const STOP = 0.004;      // sotto questa velocità la bilia è ferma
export const H = 1 / 120; // passo fisso (uguale per animazione, computer e server)
const len = (x, z) => Math.sqrt(x * x + z * z);

// ---------- tavoli ----------
// kind: 'pool' (palla 8), 'snooker', 'carom' (senza buche: 5 birilli e boccette)
export const TABLES = {
  pool: { kind: 'pool', L: 1.27, W: 0.635, R: 0.028575, cush: 0.05, rail: 0.13, C: 0.082, M: 0.064, jaw: 0.045,
    corner: { off: 0.018, r: 0.062 }, mid: { off: 0.052, r: 0.058 } },
  snooker: { kind: 'snooker', L: 1.7845, W: 0.889, R: 0.02625, cush: 0.05, rail: 0.15, C: 0.064, M: 0.052, jaw: 0.04,
    corner: { off: 0.014, r: 0.05 }, mid: { off: 0.046, r: 0.049 } },
  // FIBiS/UMB: piano 2,84 × 1,42 m, bilie da 61–61,5 mm, sponde larghe 12,5 cm
  carom: { kind: 'carom', L: 1.42, W: 0.71, R: 0.0307, cush: 0.05, rail: 0.125 },
};

export function makeTable(kind) {
  const s = TABLES[kind];
  const T = { ...s, pockets: [], rails: [] };
  const { L, W } = s;
  const add = (x1, z1, x2, z2) => T.rails.push({ x1, z1, x2, z2 });
  if (kind === 'carom') {
    add(-L, -W, L, -W); add(-L, W, L, W); add(-L, -W, -L, W); add(L, -W, L, W);
    return T;
  }
  const { C, M, jaw } = s;
  for (const sz of [-1, 1]) {
    add(-L + C, sz * W, -M, sz * W);
    add(M, sz * W, L - C, sz * W);
    add(-L + C, sz * W, -L + C - jaw, sz * (W + jaw));
    add(L - C, sz * W, L - C + jaw, sz * (W + jaw));
    add(-M, sz * W, -M + 0.012, sz * (W + 0.06));
    add(M, sz * W, M - 0.012, sz * (W + 0.06));
  }
  for (const sx of [-1, 1]) {
    add(sx * L, -W + C, sx * L, W - C);
    add(sx * L, -W + C, sx * (L + jaw), -W + C - jaw);
    add(sx * L, W - C, sx * (L + jaw), W - C + jaw);
  }
  const co = s.corner, mi = s.mid;
  for (const sz of [-1, 1]) {
    T.pockets.push({ x: -L - co.off, z: sz * (W + co.off), r: co.r, corner: true });
    T.pockets.push({ x: 0, z: sz * (W + mi.off), r: mi.r, corner: false });
    T.pockets.push({ x: L + co.off, z: sz * (W + co.off), r: co.r, corner: true });
  }
  return T;
}

// birilli (5 birilli e boccette): croce greca al centro, il rosso in mezzo.
// FIBiS: sedi a 66 mm l'una dall'altra, birillo alto 25 mm, largo 10 mm nella pancia.
export const PIN_R = 0.005;
export const PIN_GAP = 0.066;
export function makePins() {
  return [[0, 0], [-PIN_GAP, 0], [PIN_GAP, 0], [0, -PIN_GAP], [0, PIN_GAP]].map(([x, z], i) => ({ i, x, z, up: true, red: i === 0, by: -1, fx: 0, fz: 0 }));
}

export function makeBall(id, x, z, r) {
  return { id, x, z, r, vx: 0, vz: 0, ux: 0, uz: 0, side: 0, on: true, potted: false, pocket: -1 };
}

export function moving(balls) {
  for (const b of balls) if (b.on && (b.vx * b.vx + b.vz * b.vz > STOP * STOP || b.ux * b.ux + b.uz * b.uz > STOP * STOP)) return true;
  return false;
}

// Colpo: (dx,dz) direzione (verrà normalizzata), speed m/s, sy = alto(+)/basso(−) in [−1,1], sx = effetto laterale [−1,1]
export function strike(b, dx, dz, speed, sy, sx) {
  // piccola deviazione ("squirt") per l'effetto laterale, al primo ordine: niente trigonometria
  const a = -sx * 0.025;
  let ex = dx - dz * a, ez = dz + dx * a;
  const n = len(ex, ez) || 1;
  ex /= n; ez /= n;
  b.vx = ex * speed; b.vz = ez * speed;
  const k = 1 + 2.5 * sy * 0.5; // u = v·(1 + 2,5·b), b = altezza del punto colpito / R
  b.ux = ex * speed * k; b.uz = ez * speed * k;
  b.side = sx * speed * 0.9;   // ω_y·R: a destra (+) la bilia "scalcia" a destra sulle sponde
}

export function step(T, balls, pins, dt, ev) {
  let vmax = 0;
  for (const b of balls) if (b.on) { const v = len(b.vx, b.vz); if (v > vmax) vmax = v; }
  const n = Math.min(40, Math.max(1, Math.ceil((vmax * dt) / (T.R * 0.35))));
  const h = dt / n;
  for (let i = 0; i < n; i++) sub(T, balls, pins, h, ev);
}

function sub(T, balls, pins, h, ev) {
  for (const b of balls) {
    if (!b.on) continue;
    const sx = b.vx - b.ux, sz = b.vz - b.uz;
    const slip = len(sx, sz);
    if (slip > 1e-4) {
      const a = MU_SLIDE * G * h;
      if (slip <= a * 3.5) {
        const rx = (5 * b.vx + 2 * b.ux) / 7, rz = (5 * b.vz + 2 * b.uz) / 7;
        b.vx = b.ux = rx; b.vz = b.uz = rz;
      } else {
        const nx = sx / slip, nz = sz / slip;
        b.vx -= nx * a; b.vz -= nz * a;
        b.ux += nx * a * 2.5; b.uz += nz * a * 2.5;
      }
    } else {
      const sp = len(b.vx, b.vz);
      if (sp > 0) {
        const ns = Math.max(0, sp - ROLL_DECEL * h - sp * 0.012 * h);
        const f = ns / sp;
        b.vx *= f; b.vz *= f; b.ux = b.vx; b.uz = b.vz;
      }
    }
    const slow = len(b.vx, b.vz) < 0.05;
    b.side *= Math.max(0, 1 - SPIN_DECAY * h * (slow ? 4 : 1));
    if (b.side < 1e-3 && b.side > -1e-3) b.side = 0;
    if (len(b.vx, b.vz) < STOP && len(b.ux, b.uz) < STOP) { b.vx = b.vz = b.ux = b.uz = 0; }
    b.x += b.vx * h; b.z += b.vz * h;
  }
  // bilia contro bilia
  for (let i = 0; i < balls.length; i++) {
    const a = balls[i];
    if (!a.on) continue;
    for (let j = i + 1; j < balls.length; j++) {
      const b = balls[j];
      if (!b.on) continue;
      const dx = b.x - a.x, dz = b.z - a.z, rr = a.r + b.r;
      const d2 = dx * dx + dz * dz;
      if (d2 >= rr * rr || d2 === 0) continue;
      const d = Math.sqrt(d2), nx = dx / d, nz = dz / d;
      const over = rr - d;
      // spinge via in proporzione alla massa (le bilie piccole pesano meno)
      const ma = a.r * a.r * a.r, mb = b.r * b.r * b.r, mt = ma + mb;
      a.x -= nx * over * (mb / mt); a.z -= nz * over * (mb / mt);
      b.x += nx * over * (ma / mt); b.z += nz * over * (ma / mt);
      const rel = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz;
      if (rel <= 0) continue;
      const jn = (rel * (1 + E_BALL)) / mt;
      a.vx -= jn * mb * nx; a.vz -= jn * mb * nz;
      b.vx += jn * ma * nx; b.vz += jn * ma * nz;
      ev.push({ t: 'ball', a: a.id, b: b.id, s: rel });
    }
  }
  // sponde, birilli e buche
  for (const b of balls) {
    if (!b.on) continue;
    const R = b.r;
    for (let k = 0; k < T.rails.length; k++) {
      const s = T.rails[k];
      const ex = s.x2 - s.x1, ez = s.z2 - s.z1;
      const l2 = ex * ex + ez * ez;
      let t = ((b.x - s.x1) * ex + (b.z - s.z1) * ez) / l2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const px = s.x1 + ex * t, pz = s.z1 + ez * t;
      const dx = b.x - px, dz = b.z - pz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= R * R || d2 === 0) continue;
      const d = Math.sqrt(d2), nx = dx / d, nz = dz / d;
      b.x += nx * (R - d); b.z += nz * (R - d);
      const vn = b.vx * nx + b.vz * nz;
      if (vn >= 0) continue;
      const tx = -nz, tz = nx;
      // la rotazione (side·t al punto di contatto) "morde" la sponda: l'attrito spinge al contrario
      const vt = (b.vx * tx + b.vz * tz - b.side * 0.35) * 0.96;
      const nvn = -vn * E_RAIL;
      b.vx = nx * nvn + tx * vt; b.vz = nz * nvn + tz * vt;
      const ut = b.ux * tx + b.uz * tz;
      const un = -(b.ux * nx + b.uz * nz) * 0.25;
      b.ux = nx * un + tx * ut; b.uz = nz * un + tz * ut;
      b.side *= 0.6;
      ev.push({ t: 'rail', a: b.id, s: -vn, k }); // k = quale sponda (sul tavolo senza buche: 3 = corta in fondo)
    }
    if (pins) for (const p of pins) {
      if (!p.up) continue;
      const dx = p.x - b.x, dz = p.z - b.z, rr = R + PIN_R;
      if (dx * dx + dz * dz >= rr * rr) continue;
      p.up = false; p.by = b.id;
      const sp = len(b.vx, b.vz) || 1;
      p.fx = b.vx / sp; p.fz = b.vz / sp;
      b.vx *= 0.97; b.vz *= 0.97;
      ev.push({ t: 'pin', a: b.id, p: p.i, s: sp });
    }
    for (let k = 0; k < T.pockets.length; k++) {
      const q = T.pockets[k], dx = b.x - q.x, dz = b.z - q.z;
      if (dx * dx + dz * dz < q.r * q.r) { pot(b, k, ev); break; }
    }
    if (b.on && (b.x > T.L + 0.12 || b.x < -T.L - 0.12 || b.z > T.W + 0.12 || b.z < -T.W - 0.12)) {
      if (T.pockets.length) pot(b, nearestPocket(T, b), ev);
      else { b.x = Math.max(-T.L + R, Math.min(T.L - R, b.x)); b.z = Math.max(-T.W + R, Math.min(T.W - R, b.z)); b.vx = b.vz = b.ux = b.uz = 0; }
    }
  }
}

function nearestPocket(T, b) {
  let best = 0, bd = 1e9;
  T.pockets.forEach((k, i) => { const d = len(b.x - k.x, b.z - k.z); if (d < bd) { bd = d; best = i; } });
  return best;
}

function pot(b, p, ev) {
  b.on = false; b.potted = true; b.pocket = p;
  ev.push({ t: 'pot', a: b.id, p, s: len(b.vx, b.vz), vx: b.vx, vz: b.vz, x: b.x, z: b.z });
  b.vx = b.vz = b.ux = b.uz = b.side = 0;
}

// Simula un intero colpo senza grafica. Ritorna gli eventi.
export function simulate(T, balls, pins, maxT = 30) {
  const ev = [];
  for (let i = 0, n = Math.round(maxT / H); i < n; i++) {
    step(T, balls, pins, H, ev);
    if (!moving(balls)) break;
  }
  for (const b of balls) b.vx = b.vz = b.ux = b.uz = b.side = 0;
  return ev;
}

// Primo contatto lungo una direzione (per la linea di mira): {t, ball} oppure sponda
export function castAim(T, balls, cue, dx, dz) {
  let best = { t: 6, ball: null };
  for (const b of balls) {
    if (!b.on || b === cue) continue;
    const rr = b.r + cue.r;
    const ox = cue.x - b.x, oz = cue.z - b.z;
    const bq = ox * dx + oz * dz;
    const c = ox * ox + oz * oz - rr * rr;
    const disc = bq * bq - c;
    if (disc < 0) continue;
    const t = -bq - Math.sqrt(disc);
    if (t > 0 && t < best.t) best = { t, ball: b };
  }
  const R = cue.r;
  const lim = (p, d, m) => (d > 0 ? (m - R - p) / d : d < 0 ? (-m + R - p) / d : 1e9);
  const tr = Math.min(lim(cue.x, dx, T.L), lim(cue.z, dz, T.W));
  if (tr < best.t) best = { t: Math.max(0, tr), ball: null, rail: true };
  return best;
}
