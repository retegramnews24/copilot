// Flipper "Binottoland Grand Prix": fisica e regole, codice puro (niente pagina), come balilla-rules.js.
// Metri e secondi. Il piano è visto dall'alto: x da sinistra a destra (0 … W), y dal basso (flipper) all'alto.
// Pallina d'acciaio da 27 mm sul piano inclinato di 6,5°: la gravità lungo il piano vale g·sin(6,5°) ≈ 1,11 m/s².
// Passo fisso di 1/1200 s: anche a 7 m/s la pallina fa meno di 6 mm per passo (il raggio è 13,5 mm), quindi non
// attraversa mai flipper e sponde.

export const W = 0.52, H = 1.06; // piano largo 52 cm e lungo 106 cm
export const R = 0.0135; // raggio della pallina
const G = 9.81 * Math.sin((6.5 * Math.PI) / 180);
const STEP = 1 / 1200;
const MAX_SPEED = 7;
export const LANE_X = 0.482; // parete della corsia di lancio (a destra)
const PLUNGER_Y = 0.035;
export const PLAY_W = LANE_X; // larghezza del campo senza la corsia di lancio
const mx = x => PLAY_W - x; // simmetria sinistra/destra del campo

// ---------- il tavolo ----------
function seg(ax, ay, bx, by, extra = {}) {
  return { ax, ay, bx, by, r: 0.002, e: 0.5, ...extra };
}
function arc(cx, cy, rad, a0, a1, n, extra) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const t0 = a0 + ((a1 - a0) * i) / n,
      t1 = a0 + ((a1 - a0) * (i + 1)) / n;
    out.push(seg(cx + rad * Math.cos(t0), cy + rad * Math.sin(t0), cx + rad * Math.cos(t1), cy + rad * Math.sin(t1), extra));
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
    seg(LANE_X, 0.81, W, 0.81, { oneWay: -1, r: 0.001 }), // cancelletto: la palla sale, non riscende nella corsia
    // corridoi di rientro (inlane) verso i flipper e uscite laterali (outlane)
    seg(0.045, 0.27, 0.135, 0.163, { r: 0.004 }),
    seg(mx(0.045), 0.27, mx(0.135), 0.163, { r: 0.004 }),
    // guida dell'orbita sinistra ("giro veloce")
    seg(0.062, 0.58, 0.062, 0.85, { r: 0.004 }),
    // separatori delle tre corsie in alto (G · P · !)
    ...[0.165, 0.215, 0.265, 0.315].map(x => seg(x, 0.93, x, 0.99, { r: 0.004 }))
  ];
  // respingenti triangolari sopra i flipper: il lato interno (cordolo) spinge via la pallina
  for (const side of [0, 1]) {
    const f = x => (side ? mx(x) : x);
    const p1 = [f(0.065), 0.33], p2 = [f(0.065), 0.215], p3 = [f(0.125), 0.19];
    walls.push(seg(...p1, ...p2, { r: 0.004 }), seg(...p2, ...p3, { r: 0.004 }));
    walls.push(seg(...p1, ...p3, { r: 0.005, kicker: 1.5, e: 0.6, sling: side }));
  }
  const posts = [
    { x: 0.045, y: 0.285, r: 0.006, e: 0.6 }, // varco dell'uscita laterale: 3,7 cm per una pallina da 2,7
    { x: mx(0.045), y: 0.285, r: 0.006, e: 0.6 }
  ];
  const bumpers = [
    { x: 0.17, y: 0.74, r: 0.026, kick: 1.3, flash: 0 },
    { x: 0.31, y: 0.74, r: 0.026, kick: 1.3, flash: 0 },
    { x: 0.24, y: 0.83, r: 0.026, kick: 1.3, flash: 0 }
  ];
  // tre bersagli che scendono: i semafori di partenza
  const targets = [0.195, 0.24, 0.285].map(x => ({ ax: x - 0.016, ay: 0.6, bx: x + 0.016, by: 0.6, down: false }));
  const flippers = [
    { x: 0.146, y: 0.14, len: 0.075, r1: 0.012, r2: 0.007, rest: -0.52, up: 0.5, side: 0 },
    { x: mx(0.146), y: 0.14, len: 0.075, r1: 0.012, r2: 0.007, rest: Math.PI + 0.52, up: Math.PI - 0.5, side: 1 },
    { x: 0.457, y: 0.5, len: 0.055, r1: 0.01, r2: 0.006, rest: Math.PI + 0.55, up: Math.PI - 0.3, side: 1 }
  ].map(f => ({ ...f, a: f.rest, w: 0 }));
  return {
    walls,
    posts,
    bumpers,
    targets,
    flippers,
    pit: { x: 0.4, y: 0.95, r: 0.02 }, // i box: buca che trattiene la pallina e la rilancia
    lanes: [0.19, 0.24, 0.29] // centri delle tre corsie in alto
  };
}

// ---------- partita ----------
export const BALLS = 3;
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
    lanes: [false, false, false], // corsie in alto accese
    mult: 1, // moltiplicatore del bonus
    lights: 0, // semafori accesi (3 = "verde": ai box parte il sorpasso)
    laps: 0, // giri veloci in questa pallina
    lapsTotal: 0,
    targetsHit: 0,
    save: 0, // secondi di "salva pallina" rimasti
    tilt: 0, // avvisi di scossa (al terzo: TILT)
    tilted: false,
    nudge: 0,
    multiball: false,
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
  const speed = bounce(b, nx, ny, 0.55, sx, sy, 0.04);
  if (speed > 0.6) emit(g, 'hit', Math.min(1, speed / 5));
}

// ---------- un passo ----------
function moveFlippers(g, h) {
  for (const f of g.t.flippers) {
    const on = f.side ? g.right : g.left;
    const target = on ? f.up : f.rest;
    const speed = on ? 30 : 18; // rad/s: su veloce, giù più piano
    const dir = Math.sign(target - f.a);
    const prev = f.a;
    if (Math.abs(target - f.a) < speed * h) f.a = target;
    else f.a += dir * speed * h;
    f.w = (f.a - prev) / h;
  }
}
function stepBall(g, b, h) {
  const t = g.t;
  if (b.held > 0) {
    // ai box: ferma, poi esce verso il basso a sinistra
    b.held -= h;
    if (b.held <= 0) {
      b.vx = -1.1;
      b.vy = -1.3;
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
      g.score += 500;
      g.targetsHit++;
      emit(g, 'target', 1);
      if (t.targets.every(x => x.down)) {
        g.lights = Math.min(3, g.lights + 1);
        g.score += 2500;
        say(g, g.lights === 3 ? 'SEMAFORO VERDE! Vai ai box' : 'Semaforo ' + g.lights + ' di 3');
        g.resetTargets = 1.5; // i semafori si rialzano dopo un attimo
      }
    }
  }
  // corsie in alto: passarci accende la lettera; tutte e tre = moltiplicatore
  if (b.y > 0.95 && oy <= 0.95 && b.vy > 0)
    t.lanes.forEach((x, i) => {
      if (Math.abs(b.x - x) < 0.022 && !g.lanes[i]) {
        g.lanes[i] = true;
        g.score += 250;
        emit(g, 'lane', 0.6);
        if (g.lanes.every(Boolean)) {
          g.mult = Math.min(5, g.mult + 1);
          g.lanes = [false, false, false];
          say(g, 'Bonus ×' + g.mult);
        }
      }
    });
  // giro veloce: la pallina sale nell'orbita sinistra
  if (b.x < 0.062 && b.y > 0.7 && oy <= 0.7 && b.vy > 0) {
    g.laps++;
    g.lapsTotal++;
    g.score += 1500 + 500 * (g.laps - 1);
    say(g, 'GIRO VELOCE ' + g.laps + '!', 1.8);
    emit(g, 'lap', 1);
  }
  // i box
  const pd = Math.hypot(b.x - t.pit.x, b.y - t.pit.y);
  if (pd < t.pit.r && Math.hypot(b.vx, b.vy) < 3.2) {
    b.x = t.pit.x;
    b.y = t.pit.y;
    b.vx = b.vy = 0;
    b.held = 1.2;
    g.score += 1000;
    emit(g, 'pit', 1);
    if (g.multiball) {
      g.score += 10000;
      say(g, 'JACKPOT! 10.000');
    } else if (g.lights >= 3) {
      g.lights = 0;
      g.multiball = true;
      g.save = 10;
      say(g, 'SORPASSO! Multiball', 3);
      addBall(g);
    } else say(g, 'Pit stop', 1.5);
  }
  // pallina sul pistone: resta ferma nella corsia
  if (b.x > LANE_X && b.y < PLUNGER_Y + 0.002 && b.vy <= 0) {
    b.y = PLUNGER_Y + 0.001 - (g.pulling ? g.plunger * 0.02 : 0);
    b.vy = 0;
    b.vx = 0;
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
    say(g, 'Pallina salvata!', 2);
    g.balls = [{ x: (LANE_X + W) / 2, y: PLUNGER_Y + 0.001, vx: 0, vy: 4.2, held: 0, lap: 0 }];
    g.save = 0;
    emit(g, 'launch', 1);
    return;
  }
  // fine pallina: bonus (giri e semafori) × moltiplicatore
  const bonus = g.tilted ? 0 : (g.laps * 1000 + g.targetsHit * 200) * g.mult;
  g.score += bonus;
  g.targetsHit = 0;
  g.mult = 1;
  emit(g, 'drain', 1);
  if (g.ball >= BALLS) {
    g.over = true;
    g.ball = 0;
    say(g, 'FINE GARA · ' + g.score.toLocaleString('it-IT') + ' punti', 999);
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
    for (let i = 0; i < g.balls.length; i++) for (let j = i + 1; j < g.balls.length; j++) ballsCollide(g.balls[i], g.balls[j]);
    for (const bm of g.t.bumpers) bm.flash = Math.max(0, bm.flash - h);
    if (g.save > 0 && !g.balls.some(b => b.x > LANE_X && b.y < 0.1)) g.save = Math.max(0, g.save - h);
    if (g.resetTargets > 0 && (g.resetTargets -= h) <= 0) g.t.targets.forEach(x => (x.down = false));
    g.nudge = Math.max(0, g.nudge - h);
    g.messageTime -= h;
    if (g.over) return;
  }
}
