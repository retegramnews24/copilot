// Flipper "Binottoland Grand Prix": disegno del tavolo, comandi e suoni (la fisica è in physics.js).
import { newGame, simulate, setFlipper, pull, nudge, W, H, R, LANE_X, BALLS } from './physics.js';
import { soundAllowed } from '../sound-pref.js';

const canvas = document.getElementById('table');
const ctx = canvas.getContext('2d');
let game = newGame();
let scale = 1, ox = 0, oy = 0, dpr = 1;
const HEAD = 64; // tabellone in alto (px)

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  const availH = innerHeight - HEAD - 12, availW = innerWidth - 12;
  scale = Math.min(availH / H, availW / W);
  ox = (innerWidth - W * scale) / 2;
  oy = HEAD + 6 + H * scale;
}
addEventListener('resize', resize);
resize();
const X = x => ox + x * scale, Y = y => oy - y * scale, S = v => v * scale;

// ---------- disegno ----------
const asphalt = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#26282d';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) {
    const v = 30 + Math.random() * 40;
    g.fillStyle = `rgb(${v},${v},${v + 4})`;
    g.fillRect(Math.random() * 256, Math.random() * 256, 1.4, 1.4);
  }
  return c;
})();
function line(ax, ay, bx, by, color, width) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(X(ax), Y(ay));
  ctx.lineTo(X(bx), Y(by));
  ctx.stroke();
}
function circle(x, y, r, fill, stroke, width = 2) {
  ctx.beginPath();
  ctx.arc(X(x), Y(y), S(r), 0, Math.PI * 2);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.stroke();
  }
}
function text(s, x, y, size, color, rot = 0) {
  ctx.save();
  ctx.translate(X(x), Y(y));
  ctx.rotate(rot);
  ctx.fillStyle = color;
  ctx.font = `800 ${Math.max(8, S(size))}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(s, 0, 0);
  ctx.restore();
}
function drawPlayfield(g, time) {
  const t = g.t;
  // fondo: asfalto, con la forma del tavolo (arco in alto)
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(X(0), Y(0));
  ctx.lineTo(X(0), Y(0.8));
  ctx.arc(X(W / 2), Y(0.8), S(W / 2), Math.PI, 0);
  ctx.lineTo(X(W), Y(0));
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = ctx.createPattern(asphalt, 'repeat');
  ctx.fillRect(X(0), Y(H), S(W), S(H));
  // la pista: curva bianca tratteggiata e griglia di partenza a scacchi
  ctx.setLineDash([S(0.03), S(0.03)]);
  ctx.strokeStyle = '#ffffff30';
  ctx.lineWidth = S(0.004);
  ctx.beginPath();
  ctx.ellipse(X(0.241), Y(0.6), S(0.19), S(0.32), 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  const cell = 0.018;
  for (let i = 0; i < 12; i++)
    for (let j = 0; j < 2; j++) {
      ctx.fillStyle = (i + j) % 2 ? '#f2f2f2' : '#111';
      ctx.fillRect(X(0.133 + i * cell * 0.92), Y(0.43 - j * cell), S(cell * 0.92), S(cell));
    }
  text('BINOTTOLAND', 0.241, 0.5, 0.034, '#ffd23f22');
  text('GRAND PRIX', 0.241, 0.465, 0.026, '#ff3b3b33');
  // corsia dei box, verso la buca
  ctx.fillStyle = '#2f6fd633';
  ctx.beginPath();
  ctx.moveTo(X(0.36), Y(0.88));
  ctx.lineTo(X(0.44), Y(0.98));
  ctx.lineTo(X(0.43), Y(0.86));
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // sponde e guide cromate
  for (const s of t.walls) {
    if (s.kicker) continue;
    line(s.ax, s.ay, s.bx, s.by, s.oneWay ? '#9aa3ad66' : '#c9d2da', Math.max(2, S(s.r * 2 + 0.003)));
  }
  // respingenti: triangolo rosso con il cordolo bianco e rosso sul lato che spinge
  for (const s of t.walls)
    if (s.kicker) {
      const side = s.sling,
        f = x => (side ? LANE_X - x : x);
      ctx.fillStyle = '#7d1420';
      ctx.beginPath();
      ctx.moveTo(X(f(0.065)), Y(0.33));
      ctx.lineTo(X(f(0.065)), Y(0.215));
      ctx.lineTo(X(f(0.125)), Y(0.19));
      ctx.closePath();
      ctx.fill();
      const n = 8;
      for (let i = 0; i < n; i++) {
        const a = i / n, b = (i + 1) / n;
        line(s.ax + (s.bx - s.ax) * a, s.ay + (s.by - s.ay) * a, s.ax + (s.bx - s.ax) * b, s.ay + (s.by - s.ay) * b, i % 2 ? '#f4f4f4' : '#e0262e', S(0.008));
      }
    }
  for (const p of t.posts) circle(p.x, p.y, p.r, '#ffd23f', '#7a5a00', 1.5);
  // corsie in alto: G · P · !
  ['G', 'P', '!'].forEach((l, i) => {
    circle(t.lanes[i], 0.905, 0.013, g.lanes[i] ? '#ffd23f' : '#3b3524', '#00000080', 1);
    text(l, t.lanes[i], 0.905, 0.016, g.lanes[i] ? '#111' : '#8f8466');
  });
  // giro veloce (orbita a sinistra)
  text('GIRO', 0.031, 0.66, 0.014, '#5fd3ff', -Math.PI / 2);
  // bumper: pneumatici con il cerchio rosso, si accendono quando colpiti
  for (const bm of t.bumpers) {
    circle(bm.x, bm.y, bm.r, '#151515', bm.flash > 0 ? '#ffffff' : '#3a3a3a', S(0.006));
    circle(bm.x, bm.y, bm.r * 0.62, bm.flash > 0 ? '#ff5d5d' : '#c4161c');
    circle(bm.x, bm.y, bm.r * 0.25, '#e8e8e8');
  }
  // semafori: tre bersagli che scendono e le tre luci (rosse; tutte verdi = vai ai box)
  for (const tg of t.targets) {
    if (tg.down) line(tg.ax, tg.ay, tg.bx, tg.by, '#555', 2);
    else line(tg.ax, tg.ay, tg.bx, tg.by, '#ffe9a8', S(0.012));
  }
  ctx.fillStyle = '#111';
  ctx.fillRect(X(0.19), Y(0.67), S(0.102), S(0.036));
  for (let i = 0; i < 3; i++) {
    const on = i < g.lights;
    circle(0.204 + i * 0.037, 0.652, 0.012, g.lights >= 3 ? '#35f06a' : on ? '#ff2a2a' : '#401010');
  }
  // i box
  circle(t.pit.x, t.pit.y, t.pit.r, '#050505', g.lights >= 3 || g.multiball ? '#35f06a' : '#2f6fd6', S(0.004));
  text('BOX', t.pit.x, t.pit.y - 0.035, 0.016, '#7fb0ff');
  // moltiplicatore e "salva pallina"
  for (let m = 2; m <= 5; m++) text('×' + m, 0.15 + (m - 2) * 0.062, 0.36, 0.02, g.mult >= m ? '#ffd23f' : '#ffd23f30');
  text('SALVA', 0.241, 0.06, 0.018, g.save > 0 && (time * 4) % 1 < 0.6 ? '#35f06a' : '#35f06a22');
  // flipper: bianchi con la striscia rossa
  for (const f of t.flippers) {
    const tx = f.x + f.len * Math.cos(f.a), ty = f.y + f.len * Math.sin(f.a);
    line(f.x, f.y, tx, ty, '#f4f4f4', S(f.r1 + f.r2) * 1.05);
    line(f.x, f.y, tx, ty, '#e0262e', S((f.r1 + f.r2) * 0.35));
    circle(f.x, f.y, f.r1 * 0.45, '#9aa3ad');
  }
  // corsia di lancio e molla
  const plY = 0.035 - g.plunger * 0.02;
  ctx.fillStyle = '#b4bcc4';
  ctx.fillRect(X(LANE_X + 0.008), Y(plY - R), S(W - LANE_X - 0.016), S(0.008));
  ctx.strokeStyle = '#8a9299';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i <= 10; i++) {
    const y = plY - R - 0.002 - (i / 10) * (plY - R - 0.002);
    ctx.lineTo(X(LANE_X + 0.01 + (i % 2) * (W - LANE_X - 0.02)), Y(y));
  }
  ctx.stroke();
  // palline d'acciaio
  for (const b of g.balls) {
    const grad = ctx.createRadialGradient(X(b.x) - S(R) * 0.4, Y(b.y) - S(R) * 0.4, 1, X(b.x), Y(b.y), S(R));
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.35, '#c8cdd2');
    grad.addColorStop(1, '#4a5058');
    circle(b.x, b.y, R, grad);
  }
}
function drawHead(g, time) {
  // tabellone a punti luminosi arancioni
  ctx.fillStyle = '#0a0705';
  ctx.fillRect(0, 0, innerWidth, HEAD);
  ctx.fillStyle = '#ff9a1f';
  ctx.shadowColor = '#ff7a00';
  ctx.shadowBlur = 8;
  ctx.font = '700 26px "Courier New", monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(g.score.toLocaleString('it-IT'), 14, 22);
  ctx.font = '700 13px "Courier New", monospace';
  ctx.textAlign = 'right';
  ctx.fillText(g.over ? 'FINE' : 'PALLINA ' + g.ball + '/' + BALLS + (g.multiball ? ' · MULTI' : ''), innerWidth - 14, 20);
  ctx.textAlign = 'center';
  const msg = g.messageTime > 0 ? g.message : 'BINOTTOLAND GRAND PRIX';
  if (!(g.tilted && (time * 3) % 1 < 0.4)) ctx.fillText(msg, innerWidth / 2, 48);
  ctx.shadowBlur = 0;
}
// ---------- suoni (sintetizzati) ----------
let audio = null, noise = null;
function sound(type, power = 0.6) {
  if (!audio || audio.state !== 'running' || !soundAllowed()) return;
  const now = audio.currentTime, out = audio.createGain();
  out.gain.value = 0.35;
  out.connect(audio.destination);
  if (!noise) {
    noise = audio.createBuffer(1, audio.sampleRate * 0.4, audio.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const hit = (freq, q, decay, level, delay = 0) => {
    const s = audio.createBufferSource(), f = audio.createBiquadFilter(), g = audio.createGain();
    s.buffer = noise;
    f.type = 'bandpass';
    f.frequency.value = freq;
    f.Q.value = q;
    g.gain.setValueAtTime(level, now + delay);
    g.gain.exponentialRampToValueAtTime(0.0001, now + delay + decay);
    s.connect(f).connect(g).connect(out);
    s.start(now + delay);
    s.stop(now + delay + decay + 0.02);
  };
  const tone = (hz, decay, level, delay = 0, end = hz, type = 'square') => {
    const o = audio.createOscillator(), g = audio.createGain();
    o.type = type;
    o.frequency.setValueAtTime(hz, now + delay);
    o.frequency.exponentialRampToValueAtTime(end, now + delay + decay);
    g.gain.setValueAtTime(level, now + delay);
    g.gain.exponentialRampToValueAtTime(0.0001, now + delay + decay);
    o.connect(g).connect(out);
    o.start(now + delay);
    o.stop(now + delay + decay + 0.02);
  };
  const p = Math.max(0.2, Math.min(1, power));
  if (type === 'flip') { hit(900, 2, 0.05, 0.5); tone(120, 0.06, 0.15, 0, 70, 'sine'); }
  else if (type === 'bumper') { hit(420, 1.5, 0.09, 0.7); tone(660, 0.12, 0.08, 0, 330); }
  else if (type === 'sling') { hit(1600, 3, 0.05, 0.6); tone(240, 0.06, 0.08, 0, 160); }
  else if (type === 'target') { hit(1200, 4, 0.07, 0.6); tone(880, 0.1, 0.06); }
  else if (type === 'lane') tone(1320, 0.15, 0.06, 0, 1320, 'sine');
  else if (type === 'launch') { hit(300, 1, 0.2, 0.5 * p); tone(90, 0.15, 0.1, 0, 50, 'sine'); }
  else if (type === 'lap') [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.12, 0.06, i * 0.07));
  else if (type === 'pit') { hit(200, 1.2, 0.15, 0.7); tone(150, 0.2, 0.1, 0, 90, 'sine'); }
  else if (type === 'eject') hit(500, 1.5, 0.1, 0.6);
  else if (type === 'drain') [392, 330, 262, 196].forEach((f, i) => tone(f, 0.18, 0.06, i * 0.12, f * 0.95, 'triangle'));
  else if (type === 'tilt') tone(110, 0.8, 0.12, 0, 100, 'sawtooth');
  else if (type === 'nudge') hit(150, 1, 0.12, 0.5);
  else if (type === 'hit') hit(1100, 3, 0.04, 0.4 * p);
  else hit(2200, 5, 0.03, 0.25 * p); // sponde e paletti: tic metallico
}
function unlock() {
  try {
    audio ??= new AudioContext();
    if (audio.state === 'suspended') audio.resume();
  } catch {}
}
// ---------- comandi ----------
const LEFT = ['KeyZ', 'ShiftLeft', 'ArrowLeft'], RIGHT = ['KeyM', 'Slash', 'ShiftRight', 'ArrowRight'], PULL = ['Enter', 'ArrowDown'];
function key(e) {
  const down = e.type === 'keydown';
  if (e.repeat) return e.preventDefault();
  unlock();
  if (LEFT.includes(e.code)) setFlipper(game, 0, down);
  else if (RIGHT.includes(e.code)) setFlipper(game, 1, down);
  else if (PULL.includes(e.code)) {
    if (game.over && down) game = newGame();
    else pull(game, down);
  } else if (down && (e.code === 'Space' || e.code === 'KeyN' || e.code === 'ArrowUp')) nudge(game, 0); // Spazio: scossa (ripetuta = TILT)
  else if (down && e.code === 'KeyX') nudge(game, 1);
  else if (down && e.code === 'KeyB') nudge(game, -1);
  else return;
  e.preventDefault();
}
addEventListener('keydown', key);
addEventListener('keyup', key);
addEventListener('blur', () => { setFlipper(game, 0, false); setFlipper(game, 1, false); pull(game, false); });
// sul telefono: metà sinistra = flipper sinistro, metà destra = flipper destri; con la pallina sul pistone,
// il dito in basso a destra tira la molla
const touches = new Map();
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('mousedown', e => {
  unlock();
  if (game.over) { game = newGame(); return; }
  if (e.button === 0) setFlipper(game, 0, true);
  else if (e.button === 2) setFlipper(game, 1, true);
  else if (e.button === 1) pull(game, true);
  e.preventDefault();
});
addEventListener('mouseup', e => {
  if (e.button === 0) setFlipper(game, 0, false);
  else if (e.button === 2) setFlipper(game, 1, false);
  else if (e.button === 1) pull(game, false);
});
canvas.addEventListener('pointerdown', e => {
  if (e.pointerType === 'mouse') return; // col mouse: tasti sinistro e destro (sopra)
  unlock();
  if (game.over) { game = newGame(); return; }
  const onPlunger = game.balls.some(b => b.x > LANE_X && b.y < 0.05) && e.clientX > innerWidth * 0.6 && e.clientY > innerHeight * 0.7;
  const role = onPlunger ? 'pull' : e.clientX < innerWidth / 2 ? 'left' : 'right';
  touches.set(e.pointerId, role);
  if (role === 'pull') pull(game, true);
  else setFlipper(game, role === 'left' ? 0 : 1, true);
  canvas.setPointerCapture?.(e.pointerId);
});
for (const ev of ['pointerup', 'pointercancel'])
  canvas.addEventListener(ev, e => {
    const role = touches.get(e.pointerId);
    touches.delete(e.pointerId);
    if (role === 'pull') pull(game, false);
    else if (role && ![...touches.values()].includes(role)) setFlipper(game, role === 'left' ? 0 : 1, false);
  });

// ---------- ciclo ----------
let last = 0, time = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
  last = now;
  time += dt;
  simulate(game, dt);
  for (const ev of game.events.splice(0)) sound(ev.type, ev.power);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#0d0b12';
  ctx.fillRect(0, 0, innerWidth, innerHeight);
  // scossa: il tavolo trema un attimo
  const shake = game.nudge > 0 ? (Math.random() - 0.5) * 6 : 0;
  ctx.save();
  ctx.translate(shake, 0);
  drawPlayfield(game, time);
  ctx.restore();
  drawHead(game, time);
}
requestAnimationFrame(frame);
window.flipper = { get game() { return game; } }; // per le prove
