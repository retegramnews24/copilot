// Flipper "Binotto GT" (24 ore endurance, GT3 e GT4): fisica e regole, codice puro (niente pagina).
// Stessa fisica del "Grand Prix" (physics.js), tracciato diverso: rampa sopraelevata da destra che ricade a
// sinistra, giro veloce nell'orbita destra, flipper piccolo a sinistra, quattro corsie in alto, quattro bersagli
// GT e la buca dei box a destra del centro. Le ore di gara (0 … 24) passano con rampe, giri e pit stop.
// Metri e secondi. Il piano è visto dall'alto: x da sinistra a destra (0 … W), y dal basso (flipper) all'alto.
// Pallina d'acciaio da 27 mm sul piano inclinato di 6,5°: la gravità lungo il piano vale g·sin(6,5°) ≈ 1,11 m/s².
// Passo fisso di 1/1200 s: anche a 7 m/s la pallina fa meno di 6 mm per passo (il raggio è 13,5 mm), quindi non
// attraversa mai flipper e sponde.

export const W = 0.52,
  H = 1.06; // piano largo 52 cm e lungo 106 cm
export const R = 0.0135; // raggio della pallina
const G = 9.81 * Math.sin((6.5 * Math.PI) / 180);
const STEP = 1 / 1200;
const MAX_SPEED = 7;
export const LANE_X = 0.482; // parete della corsia di lancio (a destra)
const PLUNGER_Y = 0.035;
export const PLAY_W = LANE_X; // larghezza del campo senza la corsia di lancio
const mx = x => PLAY_W - x; // simmetria sinistra/destra del campo

// ---------- il tavolo ----------
// parte bassa (lato sinistro; il destro è simmetrico): guida del corridoio dal muro al perno del flipper e
// respingente triangolare sopra, col lato basso parallelo alla guida
export const INLANE = [
  [0, 0.275],
  [0.132, 0.165]
];
export const SLING = [
  [0.07, 0.382],
  [0.07, 0.272],
  [0.125, 0.227]
];
function seg(ax, ay, bx, by, extra = {}) {
  return { ax, ay, bx, by, r: 0.002, e: 0.5, ...extra };
}
function arc(cx, cy, rad, a0, a1, n, extra) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const t0 = a0 + ((a1 - a0) * i) / n,
      t1 = a0 + ((a1 - a0) * (i + 1)) / n;
    out.push(
      seg(
        cx + rad * Math.cos(t0),
        cy + rad * Math.sin(t0),
        cx + rad * Math.cos(t1),
        cy + rad * Math.sin(t1),
        extra
      )
    );
  }
  return out;
}
export function makeTable() {
  const walls = [
    seg(0, 0, 0, 0.8), // sponda sinistra
    seg(W, 0, W, 0.8), // sponda destra
    ...arc(W / 2, 0.8, W / 2, 0, Math.PI, 48), // arco in alto
    seg(LANE_X, 0, LANE_X, 0.79, { r: 0.004 }), // parete della corsia di lancio
    seg(LANE_X, PLUNGER_Y - R, W, PLUNGER_Y - R, { plunger: true, e: 0.1 }), // punta del pistone
    // cancelletto inclinato: la palla sale, non riscende nella corsia; se ci ricade sopra scivola nel campo
    seg(LANE_X, 0.79, W, 0.83, { oneWay: -1, r: 0.001 }),
    // corridoi di rientro (inlane) verso i flipper e uscite laterali (outlane)
    // corridoi verso i flipper: la guida parte dal muro (niente uscite laterali, la pallina si perde solo in mezzo)
    // e finisce appena sopra il perno del flipper; il corridoio sotto il respingente è largo 4,4 cm
    seg(0, INLANE[0][1], INLANE[1][0], INLANE[1][1], { r: 0.004 }),
    seg(LANE_X, INLANE[0][1], mx(INLANE[1][0]), INLANE[1][1], { r: 0.004 }),
    // scivolo dalla parete al flipper piccolo di destra (più in alto che nel Grand Prix: tira alle rampe)
    seg(LANE_X, 0.685, 0.462, 0.635, { r: 0.004 }),
    // bocche delle tre rampe di filo: due guide per lato, la pallina ci entra solo se arriva dritta e veloce
    ...RAMP_MOUTHS.flatMap(([x, y]) => [
      seg(x - 0.033, y - 0.05, x - 0.033, y, { r: 0.003 }),
      seg(x + 0.033, y - 0.05, x + 0.033, y, { r: 0.003 })
    ]),
    // separatori delle tre corsie in alto a sinistra (L · M · S: le gomme)
    ...[0.095, 0.145, 0.195, 0.245].map(x => seg(x, 0.915, x, 0.975, { r: 0.004 }))
  ];
  // respingenti triangolari sopra i flipper: il lato interno (cordolo) spinge via la pallina
  for (const side of [0, 1]) {
    const f = x => (side ? mx(x) : x);
    const p1 = [f(SLING[0][0]), SLING[0][1]],
      p2 = [f(SLING[1][0]), SLING[1][1]],
      p3 = [f(SLING[2][0]), SLING[2][1]];
    walls.push(seg(...p1, ...p2, { r: 0.004 }), seg(...p2, ...p3, { r: 0.004 }));
    walls.push(seg(...p1, ...p3, { r: 0.005, kicker: 1.5, e: 0.6, sling: side }));
  }
  const posts = [];
  // due bumper grandi in alto a destra ("il motore"), sotto le rampe che ci passano sopra
  const bumpers = [
    { x: 0.33, y: 0.87, r: 0.032, kick: 1.35, flash: 0 },
    { x: 0.4, y: 0.79, r: 0.032, kick: 1.35, flash: 0 }
  ];
  // tre bersagli in fila tra la rampa centrale e quella di destra: GT · 2 · 4
  const targets = [0.29, 0.325, 0.36].map(x => ({
    ax: x - 0.014,
    ay: 0.69,
    bx: x + 0.014,
    by: 0.69,
    down: false
  }));
  const flippers = [
    { x: 0.146, y: 0.14, len: 0.075, r1: 0.012, r2: 0.007, rest: -0.52, up: 0.5, side: 0 },
    {
      x: mx(0.146),
      y: 0.14,
      len: 0.075,
      r1: 0.012,
      r2: 0.007,
      rest: Math.PI + 0.52,
      up: Math.PI - 0.5,
      side: 1
    },
    { x: 0.457, y: 0.62, len: 0.055, r1: 0.01, r2: 0.006, rest: Math.PI + 0.55, up: Math.PI - 0.3, side: 1 }
  ].map(f => ({ ...f, a: f.rest, w: 0 }));
  return {
    walls,
    posts,
    bumpers,
    targets,
    flippers,
    pit: { x: 0.11, y: 0.76, r: 0.02 }, // i box: buca in alto a sinistra (ci arriva anche la rampa "Pit lane")
    lanes: [0.12, 0.17, 0.22] // centri delle tre corsie in alto a sinistra
  };
}

// ---------- le tre rampe di filo d'acciaio ----------
// Tunnel di aste chiuse, sollevati sopra il piano: si incrociano a quote diverse. Sulla rampa la pallina rallenta
// in salita (gravità vera sulla pendenza più l'inclinazione del tavolo) e accelera in discesa; se non ha abbastanza
// velocità torna indietro ("rampa mancata"). Ogni punto è [x, y, quota sul piano].
export const RAMPS = [
  {
    // "Esse": entra a sinistra, sale lungo la sponda, attraversa tutto in alto e ricade nel corridoio destro
    name: 'ESSE',
    exit: 'drop',
    pts: [
      [0.09, 0.56, 0],
      [0.075, 0.69, 0.03],
      [0.09, 0.83, 0.065],
      [0.16, 0.95, 0.095],
      [0.27, 0.985, 0.1],
      [0.37, 0.95, 0.095],
      [0.44, 0.84, 0.085],
      [0.455, 0.7, 0.075],
      [0.455, 0.55, 0.055],
      [0.447, 0.44, 0.03],
      [0.432, 0.36, 0.004]
    ]
  },
  {
    // "Sopraelevata": entra al centro, sale dritta, gira a sinistra in alto e scende lungo la sponda sinistra
    name: 'SOPRAELEVATA',
    exit: 'drop',
    pts: [
      [0.22, 0.6, 0],
      [0.22, 0.74, 0.035],
      [0.2, 0.86, 0.07],
      [0.13, 0.9, 0.06],
      [0.05, 0.82, 0.05],
      [0.03, 0.68, 0.045],
      [0.032, 0.52, 0.035],
      [0.04, 0.42, 0.02],
      [0.05, 0.36, 0.004]
    ]
  },
  {
    // "Pit lane": entra a destra, sale e attraversa verso sinistra, ti porta dritto ai box
    name: 'PIT LANE',
    exit: 'pit',
    pts: [
      [0.395, 0.5, 0],
      [0.395, 0.6, 0.025],
      [0.37, 0.72, 0.045],
      [0.3, 0.78, 0.05],
      [0.2, 0.79, 0.045],
      [0.14, 0.78, 0.03],
      [0.11, 0.76, 0.005]
    ]
  }
].map(r => {
  const lens = r.pts
    .slice(1)
    .map((p, i) => Math.hypot(p[0] - r.pts[i][0], p[1] - r.pts[i][1], p[2] - r.pts[i][2]));
  return { ...r, lens, len: lens.reduce((a, b) => a + b, 0) };
});
export const RAMP_MOUTHS = RAMPS.map(r => r.pts[0]);
// punto della rampa k a distanza s dall'ingresso: { x, y, z, dz (pendenza), dy (verso sul tavolo) }
export function rampPoint(k, s) {
  const r = RAMPS[k];
  let i = 0;
  while (i < r.lens.length - 1 && s > r.lens[i]) s -= r.lens[i++];
  const a = r.pts[i],
    b = r.pts[i + 1],
    l = r.lens[i],
    u = Math.max(0, Math.min(1, s / l));
  return {
    x: a[0] + (b[0] - a[0]) * u,
    y: a[1] + (b[1] - a[1]) * u,
    z: a[2] + (b[2] - a[2]) * u,
    dz: (b[2] - a[2]) / l,
    dy: (b[1] - a[1]) / l
  };
}

// ---------- partita ----------
export const BALLS = 5; // palline a partita
export function newGame() {
  const g = {
    t: makeTable(),
    score: 0,
    ball: 1,
    balls: [],
    plunger: 0, // 0 … 1 quanto è tirata la molla
    pulling: false,
    left: false,
    right: false,
    lanes: [false, false, false], // corsie in alto accese (gomme L · M · S)
    rampDone: [0, 0, 0], // rampe fatte: Esse, Sopraelevata, Pit lane
    rampFlash: null,
    mult: 1, // moltiplicatore del bonus
    lights: 0, // serie di bersagli GT completate (3 = ai box parte la partenza in griglia)
    hour: 0, // ore di gara 0 … 24: giorno, tramonto, notte, alba; a 24 bandiera a scacchi
    finishes: 0, // 24 ore completate
    laps: 0, // giri veloci in questa pallina
    lapsTotal: 0,
    targetsHit: 0,
    save: 0, // secondi di "salva pallina" rimasti
    tilt: 0, // avvisi di scossa (al terzo: TILT)
    tilted: false,
    nudge: 0,
    multiball: false,
    kickback: false, // le uscite laterali sono chiuse: il kickback non serve più
    kickbackTimer: 0,
    kickFlash: 0,
    pitFlash: 0,
    ramps: 0, // rampe fatte in questa partita
    jackpot: 10000, // jackpot del multiball (cresce a ogni rampa presa in multiball)
    jackpots: 0,
    superLit: false, // super jackpot acceso ai box
    extraLit: false, // palla extra accesa ai box
    extra: 0, // palle extra guadagnate
    combo: 0,
    comboTimer: 0,
    skillLane: 0, // corsia del tiro di precisione (lampeggia mentre la pallina è sul pistone)
    skillArmed: false,
    clock: 0,
    over: false,
    message: 'Tira giù la leva e lascia per lanciare',
    messageTime: 4,
    events: [], // suoni e luci per la pagina
    timeAcc: 0
  };
  newBall(g);
  return g;
}
function say(g, text, time = 2.5) {
  g.message = text;
  g.messageTime = time;
}
function emit(g, type, power = 0.6) {
  g.events.push({ type, power });
}
function newBall(g) {
  g.superLit = false;
  g.jackpots = 0;
  g.balls = [{ x: (LANE_X + W) / 2, y: PLUNGER_Y + 0.001, vx: 0, vy: 0, held: 0, lap: 0 }];
  g.laps = 0;
  g.tilt = 0;
  g.tilted = false;
  g.save = 0;
  g.multiball = false;
}
function addBall(g) {
  // multiball: una seconda pallina esce dalla corsia di lancio da sola
  g.balls.push({ x: (LANE_X + W) / 2, y: PLUNGER_Y + 0.001, vx: 0, vy: 4.6, held: 0, lap: 0 });
  emit(g, 'launch', 1);
}

// ---------- comandi ----------
export function setFlipper(g, side, down) {
  if (g.tilted || g.over) down = false;
  if (side === 0) {
    if (down && !g.left) {
      emit(g, 'flip', 1);
      g.lanes.push(g.lanes.shift()); // i flipper fanno girare le corsie accese in alto
    }
    g.left = down;
  } else {
    if (down && !g.right) {
      emit(g, 'flip', 1);
      g.lanes.unshift(g.lanes.pop());
    }
    g.right = down;
  }
}
export function pull(g, on) {
  if (g.over) return;
  if (!on && g.pulling) {
    // si lascia la molla: parte la pallina che sta sul pistone
    for (const b of g.balls)
      if (b.x > LANE_X && b.y < PLUNGER_Y + 0.02) {
        b.vy = 1.4 + 3.6 * g.plunger;
        if (!g.save && g.ball) g.save = 8; // 8 secondi di salva pallina dal lancio
        g.skillArmed = true; // la prima corsia in alto: se è quella accesa è il tiro di precisione
      }
    if (g.plunger > 0.05) emit(g, 'launch', g.plunger);
    g.plunger = 0;
    g.dragging = false;
  }
  g.pulling = on;
}
// leva del lancio tirata a mano: amount da 0 (ferma) a 1 (tutta tirata); lasciandola parte la pallina
export function drag(g, amount) {
  if (g.over) return;
  g.pulling = g.dragging = true;
  g.plunger = Math.max(0, Math.min(1, amount));
}
export function nudge(g, dir = 0) {
  if (g.tilted || g.over) return;
  for (const b of g.balls) {
    b.vx += dir * 0.18 + (Math.random() - 0.5) * 0.05;
    b.vy += 0.22;
  }
  g.tilt += 1;
  g.nudge = 0.15;
  emit(g, 'nudge', 0.8);
  if (g.tilt >= 3) {
    g.tilted = true;
    g.left = g.right = false;
    say(g, 'TILT!', 4);
    emit(g, 'tilt', 1);
  } else say(g, g.tilt === 2 ? 'ATTENZIONE!' : 'Attento alla scossa', 1.5);
}

// ---------- collisioni ----------
function closest(ax, ay, bx, by, px, py) {
  const dx = bx - ax,
    dy = by - ay,
    l2 = dx * dx + dy * dy || 1e-9;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
  return [ax + dx * t, ay + dy * t, t];
}
// urto con una superficie che si muove a velocità (sx, sy): rimbalzo e = elasticità, attrito di scorrimento mu
function bounce(b, nx, ny, e, sx = 0, sy = 0, mu = 0.08) {
  const rvx = b.vx - sx,
    rvy = b.vy - sy;
  const vn = rvx * nx + rvy * ny;
  if (vn >= 0) return 0;
  const tx = rvx - vn * nx,
    ty = rvy - vn * ny;
  // attrito solo negli urti veri: appoggiata (urto lento) la pallina rotola libera
  const f = vn < -0.05 ? mu : 0;
  b.vx = sx + tx * (1 - f) - (vn < -0.05 ? e : 0) * vn * nx;
  b.vy = sy + ty * (1 - f) - (vn < -0.05 ? e : 0) * vn * ny;
  return -vn;
}
function hitSegment(g, b, s) {
  const [cx, cy] = closest(s.ax, s.ay, s.bx, s.by, b.x, b.y);
  let dx = b.x - cx,
    dy = b.y - cy;
  const d = Math.hypot(dx, dy),
    min = R + s.r;
  if (d >= min || d < 1e-9) return;
  const nx = dx / d,
    ny = dy / d;
  if (s.oneWay && b.vy * s.oneWay < 0) return; // cancelletto: passa solo in un verso
  b.x = cx + nx * min;
  b.y = cy + ny * min;
  const speed = bounce(b, nx, ny, s.e);
  if (s.kicker && speed > 0.25 && !g.tilted) {
    b.vx += nx * s.kicker;
    b.vy += ny * s.kicker;
    s.flash = 0.15;
    g.score += 10;
    emit(g, 'sling', 0.8);
  } else if (speed > 0.4) emit(g, 'wall', Math.min(1, speed / 4));
}
function hitCircle(g, b, c, kick = 0) {
  const dx = b.x - c.x,
    dy = b.y - c.y,
    d = Math.hypot(dx, dy),
    min = R + c.r;
  if (d >= min || d < 1e-9) return false;
  const nx = dx / d,
    ny = dy / d;
  b.x = c.x + nx * min;
  b.y = c.y + ny * min;
  const speed = bounce(b, nx, ny, c.e ?? 0.6);
  if (kick && !g.tilted) {
    b.vx += nx * kick;
    b.vy += ny * kick;
    return true;
  }
  if (speed > 0.4) emit(g, 'post', Math.min(1, speed / 4));
  return false;
}
function hitFlipper(g, b, f) {
  const tx = f.x + f.len * Math.cos(f.a),
    ty = f.y + f.len * Math.sin(f.a);
  const [cx, cy, t] = closest(f.x, f.y, tx, ty, b.x, b.y);
  const rad = f.r1 + (f.r2 - f.r1) * t;
  let dx = b.x - cx,
    dy = b.y - cy;
  const d = Math.hypot(dx, dy),
    min = R + rad;
  if (d >= min || d < 1e-9) return;
  const nx = dx / d,
    ny = dy / d;
  // velocità del flipper nel punto di contatto: ω × (contatto − perno)
  const px = cx + nx * rad - f.x,
    py = cy + ny * rad - f.y;
  const sx = -f.w * py,
    sy = f.w * px;
  b.x = cx + nx * min;
  b.y = cy + ny * min;
  // gomma: rimbalza tanto se l'urto è leggero, meno se è forte; flipper fermo e palla lenta = "presa morta"
  const rel = Math.abs((b.vx - sx) * nx + (b.vy - sy) * ny),
    still = Math.abs(f.w) < 0.5;
  const e = still && rel < 1.2 ? 0.22 : Math.max(0.35, Math.min(0.72, 0.78 - 0.07 * rel));
  // palla d'acciaio: parte della velocità di scorrimento diventa rotazione (2/7 per una sfera piena)
  const speed = bounce(b, nx, ny, e, sx, sy, 0.12);
  if (speed > 0.6) emit(g, 'hit', Math.min(1, speed / 5));
}

// ---------- un passo ----------
// Flipper con la bobina vera: accelerano (non partono già alla velocità piena). Un tocco breve li alza solo in parte
// e il colpo è morbido; tenuto premuto il colpo è pieno, e conta anche in che punto della corsa arriva la pallina.
const FLIP_ACC = 2600,
  FLIP_MAX = 52,
  FLIP_DOWN = 26; // rad/s², rad/s su, rad/s giù
function moveFlippers(g, h) {
  for (const f of g.t.flippers) {
    const on = f.side ? g.right : g.left;
    const upDir = Math.sign(f.up - f.rest); // verso in cui si alza
    if (on)
      f.w = upDir * Math.min(FLIP_MAX, Math.abs(f.w) * (Math.sign(f.w) === upDir ? 1 : 0) + FLIP_ACC * h);
    else
      f.w =
        -upDir *
        Math.min(FLIP_DOWN, Math.abs(f.w) * (Math.sign(f.w) === -upDir ? 1 : 0) + FLIP_ACC * 0.6 * h);
    f.a += f.w * h;
    // fine corsa: in alto si ferma contro il fermo, in basso torna a riposo
    if ((f.a - f.up) * upDir >= 0) {
      f.a = f.up;
      if (on) f.w = 0;
    }
    if ((f.a - f.rest) * upDir <= 0) {
      f.a = f.rest;
      if (!on) f.w = 0;
    }
  }
}
// le ore di gara: passano con rampe, giri e pit stop; a 24 ore bandiera a scacchi e si riparte da capo
function hours(g, n) {
  g.hour += n;
  if (g.hour >= 24) {
    g.hour -= 24;
    g.finishes++;
    const prize = 25000 * g.finishes;
    g.score += prize;
    say(g, 'BANDIERA A SCACCHI! 24 ORE · ' + prize.toLocaleString('it-IT'), 3.5);
    emit(g, 'super', 1);
  }
}
function combo(g) {
  g.combo = g.comboTimer > 0 ? g.combo + 1 : 1;
  g.comboTimer = 3.5;
  if (g.combo > 1) {
    g.score += 1000 * g.combo;
    say(g, 'COMBO ×' + g.combo + '!', 1.6);
    emit(g, 'combo', Math.min(1, g.combo / 4));
  }
}
function rampMade(g, k) {
  g.ramps++;
  g.rampDone[k]++;
  g.rampFlash = { k, at: g.clock };
  g.score += [3000, 2500, 2000][k];
  // l'Esse è il giro di pista: conta come giro veloce
  if (k === 0) {
    g.laps++;
    g.lapsTotal++;
    g.score += 500 * (g.laps - 1);
    emit(g, 'lap', 1);
  }
  if (g.multiball) {
    g.score += g.jackpot;
    say(g, 'JACKPOT ' + g.jackpot.toLocaleString('it-IT') + '!', 2.5);
    emit(g, 'jackpot', 1);
    g.jackpot += 5000;
    if (++g.jackpots >= 3 && !g.superLit) {
      g.superLit = true;
      say(g, 'SUPER JACKPOT acceso ai box!', 2.5);
    }
  } else {
    say(g, RAMPS[k].name + '! ' + g.rampDone[k], 1.6);
    emit(g, 'ramp', 1);
    if (g.ramps % 3 === 0 && !g.extraLit) {
      g.extraLit = true;
      say(g, 'STINT EXTRA acceso ai box', 2.5);
    }
  }
  hours(g, [2, 2, 1][k]);
  combo(g);
}
function stepBall(g, b, h) {
  const t = g.t;
  if (b.ramp) {
    // sulla rampa di filo: rallenta in salita, accelera in discesa, un po' di attrito delle aste
    const r = b.ramp,
      ramp = RAMPS[r.k],
      p = rampPoint(r.k, r.s);
    r.v += (-9.81 * p.dz - G * p.dy - 0.22) * h;
    r.s += r.v * h;
    if (r.v <= 0 && r.s < ramp.len * 0.45) {
      // rampa mancata: torna giù da dove è entrata
      b.ramp = null;
      Object.assign(b, { x: ramp.pts[0][0], y: ramp.pts[0][1] - 0.01, vx: 0, vy: -1 });
      say(g, 'Rampa mancata', 1);
      emit(g, 'rampFail', 0.6);
    } else if (r.s >= ramp.len) {
      const a = ramp.pts[ramp.pts.length - 2],
        e = ramp.pts[ramp.pts.length - 1],
        l = Math.hypot(e[0] - a[0], e[1] - a[1]);
      b.ramp = null;
      rampMade(g, r.k);
      if (ramp.exit === 'pit') {
        // la Pit lane porta dritto ai box
        Object.assign(b, { x: t.pit.x, y: t.pit.y, vx: 0, vy: 0 });
        pitStop(g, b);
      } else
        // fine della rampa: ricade nel corridoio, nella direzione dell'ultimo tratto
        Object.assign(b, {
          x: e[0],
          y: e[1],
          vx: ((e[0] - a[0]) / l) * Math.max(0.8, r.v),
          vy: ((e[1] - a[1]) / l) * Math.max(0.8, r.v)
        });
    } else {
      b.x = p.x;
      b.y = p.y;
    }
    return;
  }
  if (b.held > 0) {
    // ai box: ferma, poi esce verso il basso a sinistra
    b.held -= h;
    if (b.held <= 0) {
      b.vx = -0.55 - Math.random() * 0.2;
      b.vy = -1.35;
      b.y -= 0.03;
      emit(g, 'eject', 1);
    }
    return;
  }
  b.vy -= G * h;
  const v = Math.hypot(b.vx, b.vy);
  if (v > MAX_SPEED) {
    b.vx *= MAX_SPEED / v;
    b.vy *= MAX_SPEED / v;
  }
  const k = Math.exp(-0.12 * h); // rotolamento e aria
  b.vx *= k;
  b.vy *= k;
  const oy = b.y;
  b.x += b.vx * h;
  b.y += b.vy * h;
  if (b.vy > 0)
    for (let k = 0; k < RAMPS.length; k++) {
      const [mx0, my0] = RAMPS[k].pts[0];
      if (oy < my0 && b.y >= my0 && Math.abs(b.x - mx0) < 0.022) {
        const v = Math.hypot(b.vx, b.vy);
        // serve un tiro deciso: una pallina lenta (o ributtata da un respingente) sbatte sulla bocca e ricade
        if (v > 1.3) {
          b.ramp = { k, s: 0, v: v * 0.92 };
          emit(g, 'rampUp', Math.min(1, v / 4));
          return;
        }
      }
    }
  for (const s of t.walls) hitSegment(g, b, s);
  for (const p of t.posts) hitCircle(g, b, p);
  for (const bm of t.bumpers)
    if (hitCircle(g, b, bm, bm.kick)) {
      bm.flash = 0.12;
      g.score += 100;
      emit(g, 'bumper', 1);
    }
  for (const f of t.flippers) hitFlipper(g, b, f);
  for (const tg of t.targets) {
    if (tg.down) continue;
    const before = { vx: b.vx, vy: b.vy };
    hitSegment(g, b, { ...tg, r: 0.004, e: 0.4 });
    if (before.vx !== b.vx || before.vy !== b.vy) {
      tg.down = true;
      tg.flash = 0.25;
      g.score += 500;
      g.targetsHit++;
      emit(g, 'target', 1);
      if (t.targets.every(x => x.down)) {
        g.lights = Math.min(3, g.lights + 1);
        g.score += 2500;
        say(g, g.lights === 3 ? 'GRIGLIA PRONTA! Vai ai box' : 'Classe GT ' + g.lights + ' di 3');
        g.resetTargets = 1.5; // i bersagli si rialzano dopo un attimo
      }
    }
  }
  // corsie in alto: passarci accende la lettera; tutte e tre = moltiplicatore
  if (b.y > 0.95 && oy <= 0.95 && b.vy > 0)
    t.lanes.forEach((x, i) => {
      if (Math.abs(b.x - x) < 0.022 && g.skillArmed) {
        g.skillArmed = false;
        if (i === g.skillLane) {
          g.score += 5000;
          g.save = Math.max(g.save, 10);
          say(g, 'TIRO DI PRECISIONE! 5.000', 2);
          emit(g, 'skill', 1);
        }
      }
      if (Math.abs(b.x - x) < 0.022 && !g.lanes[i]) {
        g.lanes[i] = true;
        g.score += 250;
        emit(g, 'lane', 0.6);
        if (g.lanes.every(Boolean)) {
          g.mult = Math.min(5, g.mult + 1);
          g.lanes = [false, false, false];
          say(g, 'GOMME NUOVE · Bonus ×' + g.mult);
        }
      }
    });
  // i box (anche dalla rampa Pit lane)
  if (Math.hypot(b.x - t.pit.x, b.y - t.pit.y) < t.pit.r && Math.hypot(b.vx, b.vy) < 3.2) pitStop(g, b);
  // kickback: la pallina che scende nell'uscita sinistra viene ributtata su (se la luce KICK è accesa)
  kick(g, b);
  // pallina sul pistone: resta ferma nella corsia
  if (b.x > LANE_X && b.y < PLUNGER_Y + 0.002 && b.vy <= 0) {
    b.y = PLUNGER_Y + 0.001 - (g.pulling ? g.plunger * 0.02 : 0);
    b.vy = 0;
    b.vx = 0;
  }
}
function pitStop(g, b) {
  const t = g.t;
  {
    b.x = t.pit.x;
    b.y = t.pit.y;
    b.vx = b.vy = 0;
    b.held = 1.2;
    g.pitFlash = 1.2;
    g.score += 1000;
    emit(g, 'pit', 1);
    hours(g, 3);
    if (g.multiball && g.superLit) {
      g.score += 50000;
      g.superLit = false;
      g.jackpots = 0;
      say(g, 'SUPER JACKPOT! 50.000', 3);
      emit(g, 'super', 1);
    } else if (g.multiball) {
      g.score += 5000;
      say(g, 'Pit stop in gara · 5.000');
    } else if (g.extraLit) {
      g.extraLit = false;
      g.extra++;
      say(g, 'STINT EXTRA! Cambio pilota', 3);
      emit(g, 'extra', 1);
    } else if (g.lights >= 3) {
      g.lights = 0;
      g.multiball = true;
      g.save = 10;
      say(g, 'PARTENZA IN GRIGLIA! Multiball', 3);
      addBall(g);
    } else say(g, 'PIT STOP · gomme e benzina', 1.5);
  }
}
function kick(g, b) {
  if (b.x < 0.047 && b.y < 0.16 && b.y > 0.05 && b.vy < 0) {
    if (g.kickback && !g.tilted) {
      b.x = 0.024;
      b.vx = 0.08;
      b.vy = 3.6;
      g.kickback = false;
      g.kickbackTimer = 20;
      g.kickFlash = 0.4;
      g.score += 500;
      say(g, 'KICKBACK!', 1.5);
      emit(g, 'kickback', 1);
    }
  }
}
function ballsCollide(a, b) {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    d = Math.hypot(dx, dy);
  if (d >= 2 * R || d < 1e-9) return;
  const nx = dx / d,
    ny = dy / d,
    push = (2 * R - d) / 2;
  a.x -= nx * push;
  a.y -= ny * push;
  b.x += nx * push;
  b.y += ny * push;
  const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
  if (vn < 0) {
    a.vx += vn * nx * 0.95;
    a.vy += vn * ny * 0.95;
    b.vx -= vn * nx * 0.95;
    b.vy -= vn * ny * 0.95;
  }
}
function drain(g, b) {
  g.balls.splice(g.balls.indexOf(b), 1);
  if (g.balls.length) {
    if (g.balls.length === 1) g.multiball = false;
    return;
  }
  if (g.save > 0 && !g.tilted) {
    say(g, 'SAFETY CAR! Pallina salvata, rilancia', 3);
    g.balls = [{ x: (LANE_X + W) / 2, y: PLUNGER_Y + 0.001, vx: 0, vy: 0, held: 0, lap: 0 }];
    g.save = 0;
    emit(g, 'extra', 0.6);
    return;
  }
  // fine pallina: bonus (giri e semafori) × moltiplicatore
  const bonus = g.tilted ? 0 : (g.laps * 1000 + g.targetsHit * 200) * g.mult;
  g.score += bonus;
  g.targetsHit = 0;
  g.mult = 1;
  emit(g, 'drain', 1);
  if (g.extra > 0) {
    g.extra--;
    say(g, 'Bonus ' + bonus.toLocaleString('it-IT') + ' · TIRA ANCORA!', 3);
    newBall(g);
    return;
  }
  if (g.ball >= BALLS) {
    g.over = true;
    g.ball = 0;
    say(g, 'FINE DELLA 24 ORE · ' + g.score.toLocaleString('it-IT') + ' punti', 999);
    return;
  }
  g.ball++;
  say(g, 'Bonus ' + bonus.toLocaleString('it-IT') + ' · Pallina ' + g.ball, 3);
  newBall(g);
}
export function simulate(g, dt) {
  if (g.over) return;
  g.timeAcc += Math.min(dt, 0.05);
  while (g.timeAcc >= STEP) {
    g.timeAcc -= STEP;
    const h = STEP;
    if (g.pulling && !g.dragging) g.plunger = Math.min(1, g.plunger + h / 0.9); // da tastiera: più tieni, più tira
    moveFlippers(g, h);
    for (const b of [...g.balls]) {
      stepBall(g, b, h);
      if (b.y < -0.05) drain(g, b);
    }
    for (let i = 0; i < g.balls.length; i++)
      for (let j = i + 1; j < g.balls.length; j++) ballsCollide(g.balls[i], g.balls[j]);
    for (const bm of g.t.bumpers) bm.flash = Math.max(0, bm.flash - h);
    for (const w of g.t.walls) if (w.flash) w.flash = Math.max(0, w.flash - h);
    for (const tg of g.t.targets) if (tg.flash) tg.flash = Math.max(0, tg.flash - h);
    g.kickFlash = Math.max(0, g.kickFlash - h);
    g.pitFlash = Math.max(0, g.pitFlash - h);

    if (g.save > 0 && !g.balls.some(b => b.x > LANE_X && b.y < 0.1)) g.save = Math.max(0, g.save - h);
    if (g.resetTargets > 0 && (g.resetTargets -= h) <= 0) g.t.targets.forEach(x => (x.down = false));
    g.nudge = Math.max(0, g.nudge - h);
    g.clock += h;
    g.comboTimer = Math.max(0, g.comboTimer - h);
    if (g.balls.some(b => b.x > LANE_X && b.y < 0.06)) g.skillLane = Math.floor(g.clock / 0.45) % 3;
    else if (g.skillArmed && g.clock % 1 < h && !g.balls.some(b => b.y > 0.7)) {
      /* la pallina è ancora in salita: la corsia resta quella */
    }
    g.messageTime -= h;
    if (g.over) return;
  }
}
