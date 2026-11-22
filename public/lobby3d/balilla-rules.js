// Calcio balilla da bar, portiere singolo e tiro al volo.
// Metri e secondi. Le aste sono in ordine dalla porta rossa (x negativa) alla porta blu (x positiva):
// per squadra portiere 1, difesa 2, centrocampo 5, attacco 3. I rossi (squadra 0) attaccano verso +x.
// Stesso codice sul server (partite online) e sul telefono (contro il computer, stesso telefono).
export const L = 0.6; // mezza lunghezza del campo (120 cm sul tavolo simulato)
export const W = 0.35; // mezza larghezza (70 cm)
export const ROD_GAP = 0.15; // 15 cm tra un'asta e l'altra
export const ROD_R = 0.008; // aste da 16 mm
const BUMPER = 0.005; // gomma dei paracolpi: la figura esterna si ferma a mezzo centimetro dalla sponda
const SHOULDER = 0.027; // mezza larghezza dell'omino alle spalle (modello in blender/omino.blend)
export const GOAL = 0.1; // mezza larghezza della porta (20 cm)
export const R = 0.017; // pallina da 34 mm
export const ROD_H = 0.085; // altezza dell'asse delle aste sul campo
export const FOOT = 0.078; // dall'asse alla punta del piede
export const MAX_ANGLE = Math.PI;
const LOW = Math.acos((ROD_H - 2 * R + 0.004) / FOOT); // oltre questo angolo il piede passa sopra la pallina
const SPIN = 16;
const SLIDE = 0.66;
const MAX_SPEED = 6; // solo un limite di sicurezza: la palla esce veloce quanto ruotava il piede al tocco
export const TUNING_LIMITS = {
  ball: { min: 50, max: 150, step: 5, initial: 150 }, // velocità della pallina fissata al 150%
  slide: { min: 0.2, max: 1.2, step: 0.01, initial: 0.9 }, // asta dentro/fuori: 0,9 m/s
  spin: { min: 6, max: 28, step: 0.5, initial: 21.5 } // rotazione dell'asta: 21,5 rad/s
};
export function tableTuning(values = {}) {
  return Object.fromEntries(
    Object.entries(TUNING_LIMITS).map(([key, { min, max, initial }]) => {
      const value = values?.[key];
      return [key, Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : initial];
    })
  );
}
export function tuneField(field, values) {
  const tuning = tableTuning(values);
  const ratio = tuning.ball / field.tuning.ball;
  field.ball.vx *= ratio;
  field.ball.vz *= ratio;
  field.tuning = tuning;
}
export const CORNER_RUN = 0.12;
export const CORNER_RISE = 0.016;
export function cornerHeight(x, z) {
  return CORNER_RISE * Math.max(0, 1 - (L - Math.abs(x) + W - Math.abs(z)) / CORNER_RUN);
}
const STEP = 1 / 600;

export const rows = [
  [0, 0, 1],
  [0, 0, 2],
  [1, 1, 3],
  [0, 1, 5],
  [1, 1, 5],
  [0, 1, 3],
  [1, 0, 2],
  [1, 0, 1]
].map(([team, attack, count], i) => ({
  team,
  attack,
  count,
  x: (i - 3.5) * ROD_GAP,
  // distanza tra le figure: difesa 23,5 cm, attacco 20,5 cm, centrocampo 12 cm
  spacing: count === 2 ? 0.235 : count === 3 ? 0.205 : 0.12,
  // corsa dell'asta: la figura esterna arriva al paracolpi; il portiere copre la porta e poco più
  travel:
    count === 1
      ? GOAL + 0.025
      : W - BUMPER - SHOULDER - ((count - 1) / 2) * (count === 2 ? 0.235 : count === 3 ? 0.205 : 0.12)
}));
export const figureZ = (row, n, shift) => (n - (row.count - 1) / 2) * row.spacing + shift;
export const TARGETS = [5, 8, 10];

// Nuova partita. target: gol per vincere (5, 8, 10); bestOf: 1 (secca) o 3 (al meglio di 3).
export function newField(opts = {}, random = Math.random) {
  const f = {
    bar: opts.bar === true,
    tuning: tableTuning(opts.tuning),
    practice: false,
    target: TARGETS.includes(opts.target) ? opts.target : 5,
    bestOf: opts.bestOf === 3 ? 3 : 1,
    games: [0, 0],
    gameNo: 1,
    score: [0, 0],
    phase: 'throw', // throw (palla nel foro) · play · goal · over (fine di una partita) · match (fine)
    thrower: random() < 0.5 ? 0 : 1, // prima rimessa a sorteggio
    lastThrower: 0,
    wait: 4, // secondi prima che la palla entri da sola
    timer: 0,
    dead: 0,
    hit: 0,
    sound: '',
    power: 0,
    swap: 0, // cresce quando si cambia campo (2 contro 2, tra una partita e l'altra)
    finished: false,
    ball: { x: 0, z: 0, vx: 0, vz: 0 },
    rods: rows.map(() => ({ shift: 0, angle: 0, vs: 0, va: 0, tShift: 0, tAngle: 0 }))
  };
  holdInHole(f);
  return f;
}
// La palla aspetta nel foro laterale di centrocampo, dal lato di chi rimette (rossi dal lato +z).
function holdInHole(f) {
  const side = f.thrower === 0 ? 1 : -1;
  Object.assign(f.ball, { x: 0, z: side * (W + 0.03), vx: 0, vz: 0 });
}
// Rimessa all'italiana: la palla entra dal foro e rotola verso il centro, tra le due aste di centrocampo.
export function throwIn(f, random = Math.random, practicePair = 1) {
  if (f.phase !== 'throw') return false;
  const side = f.thrower === 0 ? 1 : -1;
  const scale = f.tuning.ball / 100;
  Object.assign(f.ball, {
    x: 0,
    z: side * (W - R - 0.002),
    vx: (random() - 0.5) * 0.14 * scale,
    vz: -side * (0.5 + random() * 0.12) * scale // entra dal foro decisa, verso il centro
  });
  // anche da soli la palla esce sempre dal foro laterale di centrocampo (non davanti all'attacco)
  void practicePair;
  f.lastThrower = f.thrower;
  f.phase = 'play';
  f.dead = 0;
  f.hit++;
  f.sound = 'throw';
  f.power = 0.5;
  return true;
}
// Comandi di una squadra: slide da -1 a 1 (tutta la corsa dell'asta), angle in radianti (positivo = piede verso +x).
// attack: 0 portiere+difesa, 1 centrocampo+attacco, null tutte e quattro.
export function control(f, team, attack, slide, angle) {
  const s = Math.max(-1, Math.min(1, Number(slide) || 0)),
    a = Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, Number(angle) || 0));
  rows.forEach((row, i) => {
    if (row.team !== team || (attack !== null && row.attack !== attack)) return;
    f.rods[i].tShift = s;
    f.rods[i].tAngle = a;
  });
}
// La coppia di aste più vicina alla palla (1 contro 1: cambia da sola), con un po' di isteresi.
export function nearPair(f, team, current = 1) {
  let best = null,
    bd = 1e9;
  rows.forEach(row => {
    if (row.team !== team) return;
    const d = Math.abs(row.x - f.ball.x) - (row.attack === current ? 0.03 : 0);
    if (d < bd) {
      bd = d;
      best = row.attack;
    }
  });
  return best ?? current;
}
// Una figura può arrivare alla palla?
function reachable(f) {
  const b = f.ball;
  return rows.some(row => {
    if (Math.abs(b.x - row.x) > FOOT * Math.sin(LOW) + R) return false;
    for (let n = 0; n < row.count; n++) {
      const z0 = figureZ(row, n, 0);
      // il centro del piede deve poter arrivare quasi in linea con la palla (contro la sponda non ci arriva)
      if (b.z > z0 - row.travel - 0.008 && b.z < z0 + row.travel + 0.008) return true;
    }
    return false;
  });
}

export function rodStep(current, target, maxDelta) {
  return current + Math.max(-maxDelta, Math.min(maxDelta, target - current));
}
export function rodTurnStep(current, target, dt, spin = SPIN) {
  // Una correzione piccola muove il piede piano, un gesto ampio può raggiungere il limite.
  const error = target - current;
  if (Math.abs(error) < 0.0002) return target;
  const speed = (48 * error * spin) / SPIN;
  return rodStep(current, target, Math.min(spin, Math.abs(speed)) * dt);
}
export { SLIDE, SPIN };
function moveRods(f, dt) {
  rows.forEach((row, i) => {
    const r = f.rods[i];
    const ts = r.tShift * row.travel,
      s0 = r.shift,
      a0 = r.angle;
    r.shift = rodStep(r.shift, ts, f.tuning.slide * dt);
    r.angle = rodTurnStep(r.angle, r.tAngle, dt, f.tuning.spin);
    r.vs = (r.shift - s0) / dt;
    r.va = (r.angle - a0) / dt;
  });
}

// Il colpo del piede, come sul tavolo vero. Vista di lato: la gamba scende dall'asta (alta ROD_H) fino alla punta
// (lunga FOOT), spessa 2,2 cm; vista dall'alto il piede è largo 2,8 cm, con spigoli e angoli.
// - Il contatto è il punto della gamba più vicino al centro della palla: con il piede quasi verticale la gamba colpisce
//   la palla a metà altezza (colpo pieno, tutto in orizzontale); col piede alzato è la punta a toccare la parte alta
//   della palla: la spinge anche in giù (contro il campo), il tiro è più debole e, se il piede è lento, la palla resta
//   bloccata sotto la punta.
// - Bordi e angoli del piede: se la palla è fuori dal centro del piede la spinta ha anche una parte laterale, così la palla
//   parte di sbieco tanto più quanto è decentrata.
// - La velocità del piede nel punto di contatto è ω × (contatto − asse): più il contatto è lontano dall'asta più è veloce;
//   se l'asta scorre mentre colpisce, l'attrito trascina la palla di lato (tiro "tagliato").
const FOOT_HALF = 0.011, // mezzo spessore della gamba e del piede (vista di lato)
  FOOT_WIDE = 0.014, // mezza larghezza del piede (lungo l'asta)
  KICK_E = 0.45, // rimbalzo plastica dura contro la palla
  KICK_MU = 0.25; // attrito tra piede e palla
function kickFigures(f) {
  const b = f.ball,
    sf = f.tuning.ball / 100;
  for (const [i, row] of rows.entries()) {
    const rod = f.rods[i];
    const th = Math.atan2(Math.sin(rod.angle), Math.cos(rod.angle)),
      c = Math.cos(th),
      sn = Math.sin(th);
    if (c <= 0.05 || Math.abs(b.x - row.x) > FOOT + R + FOOT_HALF) continue; // piede in alto o palla lontana
    // gamba: dall'asse (row.x, ROD_H) alla punta; punto più vicino al centro della palla (b.x, R)
    const ex = FOOT * sn,
      ey = -FOOT * c;
    const u = Math.max(0, Math.min(1, ((b.x - row.x) * ex + (R - ROD_H) * ey) / (FOOT * FOOT)));
    const px = row.x + ex * u,
      py = ROD_H + ey * u;
    const hx = b.x - px,
      hy = R - py,
      dxy = Math.hypot(hx, hy);
    const side = Math.max(0, dxy - FOOT_HALF); // distanza dalla superficie del piede, vista di lato
    // velocità del punto di contatto (rotazione attorno all'asta) e dell'asta che scorre
    const vfx = rod.va * (ROD_H - py) * sf,
      vfy = rod.va * (px - row.x) * sf,
      vfz = rod.vs * sf;
    for (let n = 0; n < row.count; n++) {
      const fz = figureZ(row, n, rod.shift);
      const oz = b.z - fz,
        dz = Math.sign(oz) * Math.max(0, Math.abs(oz) - FOOT_WIDE); // fuori dal piede di lato: bordo o angolo
      const dist = Math.hypot(side, dz);
      if (dist >= R) continue;
      // normale del contatto in 3D (x, su, z)
      let nx, ny, nz;
      if (dist < 1e-6) {
        nx = Math.sign(b.x - row.x) || 1;
        ny = 0;
        nz = 0;
      } else {
        const k = dxy > 1e-9 ? side / dxy : 0;
        nx = (hx * k) / dist;
        ny = (hy * k) / dist;
        nz = dz / dist;
      }
      const ux = b.vx - vfx,
        uy = -vfy,
        uz = b.vz - vfz;
      const un = ux * nx + uy * ny + uz * nz;
      if (un < 0) {
        const j = -(1 + KICK_E) * un; // impulso: la parte verticale la assorbe il campo
        b.vx += j * nx;
        b.vz += j * nz;
        // attrito lungo il piede, più forte quando la punta preme la palla contro il campo (presa)
        const mu = KICK_MU + 0.6 * Math.max(0, -ny);
        const hl = Math.hypot(nx, nz) || 1,
          hnx = nx / hl,
          hnz = nz / hl;
        const rx = b.vx - vfx,
          rz = b.vz - vfz,
          rn = rx * hnx + rz * hnz;
        const tx = rx - rn * hnx,
          tz = rz - rn * hnz,
          tl = Math.hypot(tx, tz);
        if (tl > 1e-9) {
          const cut = Math.min(tl, mu * j);
          b.vx -= (tx / tl) * cut;
          b.vz -= (tz / tl) * cut;
        }
        // punta che schiaccia la palla piano: resta ferma sotto il piede (si sente un "tic")
        const pressing = ny < -0.35 && Math.hypot(rod.va * FOOT, rod.vs) < 0.6;
        if (pressing) {
          b.vx = vfx + (b.vx - vfx) * 0.3;
          b.vz = vfz + (b.vz - vfz) * 0.3;
        }
        if (j > 0.06) {
          f.hit++;
          f.sound = pressing || j < 0.25 ? 'stop' : 'kick';
          f.power = Math.min(1, j / 2.5);
        }
      }
      // la palla esce dal piede in orizzontale (non può entrare nel campo)
      const pen = R - dist,
        hl = Math.hypot(nx, nz);
      if (hl > 0.2) {
        b.x += (nx / hl) * pen;
        b.z += (nz / hl) * pen;
      } else b.x += (Math.sign(b.x - px) || 1) * pen;
    }
  }
}

function moveBall(f, dt) {
  const b = f.ball;
  if (cornerHeight(b.x, b.z) > 0) {
    const downhill = ((5 / 7) * 9.81 * CORNER_RISE) / CORNER_RUN;
    b.vx -= Math.sign(b.x) * downhill * dt;
    b.vz -= Math.sign(b.z) * downhill * dt;
  }
  b.x += b.vx * dt;
  b.z += b.vz * dt;
  // rotolamento sul campo
  const v = Math.hypot(b.vx, b.vz);
  if (v > 0) {
    const k = (Math.max(0, v - 0.23 * dt) / v) * Math.exp(-0.25 * dt);
    b.vx *= k;
    b.vz *= k;
  }
  const speedLimit = (MAX_SPEED * f.tuning.ball) / 100;
  const speed = Math.hypot(b.vx, b.vz);
  if (speed > speedLimit) {
    b.vx *= speedLimit / speed;
    b.vz *= speedLimit / speed;
  }
  // sponde laterali
  if (Math.abs(b.z) > W - R) {
    const s = Math.sign(b.z);
    b.z = s * (W - R);
    if (b.vz * s > 0) {
      if (Math.abs(b.vz) > 0.06) {
        f.hit++;
        f.sound = 'rail';
        f.power = Math.min(1, Math.abs(b.vz) / 2.1);
      }
      b.vz = -b.vz * 0.35;
    }
  }
  // fondo campo e porte
  if (Math.abs(b.x) > L - R) {
    const s = Math.sign(b.x);
    if (Math.abs(b.z) < GOAL - R * 0.4) {
      if (Math.abs(b.x) > L + R) return s > 0 ? 0 : 1; // gol: squadra che segna
    } else if (Math.abs(b.x) < L + R * 0.5) {
      // pali: la palla rimbalza sullo spigolo della porta
      const post = Math.sign(b.z) * GOAL;
      if (Math.abs(b.z) < GOAL + R) {
        const dx = b.x - s * L,
          dz = b.z - post,
          d = Math.hypot(dx, dz) || 1;
        if (d < R) {
          const nx = dx / d,
            nz = dz / d,
            vn = b.vx * nx + b.vz * nz;
          if (vn < 0) {
            b.vx -= 1.35 * vn * nx;
            b.vz -= 1.35 * vn * nz;
            f.hit++;
            f.sound = 'post';
            f.power = Math.min(1, -vn / 2.1);
          }
          b.x = s * L + nx * R;
          b.z = post + nz * R;
        }
      } else {
        b.x = s * (L - R);
        if (b.vx * s > 0) {
          if (Math.abs(b.vx) > 0.06) {
            f.hit++;
            f.sound = 'rail';
            f.power = Math.min(1, Math.abs(b.vx) / 2.1);
          }
          b.vx = -b.vx * 0.35;
        }
      }
    } else if (Math.abs(b.z) >= GOAL - R * 0.4) {
      // già dentro la bocca della porta: rimbalza sui lati interni
      b.z = Math.sign(b.z) * (GOAL - R * 0.4);
      b.vz = -b.vz * 0.6;
    }
  }
  return -1;
}

function goal(f, team) {
  if (!f.practice) f.score[team]++;
  f.hit++;
  f.sound = 'goal';
  f.power = Math.min(1, Math.hypot(f.ball.vx, f.ball.vz) / 2.1);
  f.thrower = f.practice ? f.lastThrower : 1 - team; // in partita rimette chi ha subito
  f.timer = 1.4;
  f.phase = 'goal';
  if (f.score[team] >= f.target) {
    f.games[team]++;
    if (f.games[team] > f.bestOf / 2) {
      f.phase = 'match';
      f.finished = true;
    } else {
      f.phase = 'over';
      f.timer = 3;
      f.thrower = 1 - team; // la partita dopo comincia chi ha perso
    }
  }
}

// Partita successiva del "al meglio di 3".
function nextGame(f) {
  f.score = [0, 0];
  f.gameNo++;
  f.swap++;
  startThrow(f, f.thrower);
}
function startThrow(f, team) {
  f.thrower = team;
  f.phase = 'throw';
  f.wait = 4;
  f.dead = 0;
  holdInHole(f);
}
// Cambio campo (2 contro 2): le squadre si scambiano i lati, punteggi e turno seguono le persone.
export function swapSides(f) {
  f.games.reverse();
  f.score.reverse();
  f.thrower = 1 - f.thrower;
  f.lastThrower = 1 - f.lastThrower;
  holdInHole(f);
}

export function simulate(f, dt, random = Math.random) {
  if (f.finished) return;
  const n = Math.max(1, Math.ceil(dt / STEP)),
    h = dt / n;
  for (let k = 0; k < n; k++) {
    moveRods(f, h);
    if (f.phase === 'throw') {
      if (f.bar) continue;
      f.wait -= h;
      if (f.wait <= 0) throwIn(f, random);
      continue;
    }
    if (f.phase === 'goal' || f.phase === 'over') {
      f.timer -= h;
      if (f.timer > 0) continue;
      if (f.phase === 'over') nextGame(f);
      else startThrow(f, f.thrower);
      continue;
    }
    if (f.phase !== 'play') return;
    kickFigures(f);
    const scored = moveBall(f, h);
    if (scored >= 0) {
      goal(f, scored);
      if (f.finished) return;
      continue;
    }
    // palla ferma dove nessuno arriva: si rimette dal foro (la rimette chi l'aveva rimessa)
    const still = Math.hypot(f.ball.vx, f.ball.vz) < 0.03;
    f.dead = still ? f.dead + h : 0;
    if (f.dead > 1.5 && !reachable(f)) startThrow(f, f.lastThrower);
  }
}
