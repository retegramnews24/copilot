// Biliardo: collega sala 3D, fisica, regole delle quattro specialità, computer, comandi e partite online.
import { Table3D, CLOTHS } from './scene3d.js?v=47e47e2969';
import * as P from './physics.js?v=ba3146227c';
import * as E from './engine.js?v=b130e0cb1b';
import { plan } from './ai.js?v=59b1b0919b';
import { Sfx } from './sound.js?v=597b443a9b';

const $ = (id) => document.getElementById(id);
const sfx = new Sfx();
document.addEventListener('pointerdown', () => sfx.unlock(), { capture: true });
document.addEventListener('keydown', () => sfx.unlock(), { capture: true });

// ---------- Telegram / Binottoland ----------
// Dentro Binottoland il gioco gira in un iframe: Telegram lo gestisce l'app (margini, Indietro, vibrazione) e parla
// con il gioco con postMessage (messaggi "bil:..."). Online la rete la fa l'app: qui si mostra e si chiede.
const embedded = window.parent !== window;
const tg = !embedded && window.Telegram && window.Telegram.WebApp;
// Margini del telefono e di Telegram (barra di stato, tasti "Indietro" e menu della mini app a schermo intero).
// Binottoland li manda come { top: { system, content }, ... }; da soli si leggono da Telegram. Valori sempre numerici:
// un valore non valido romperebbe i calc() del CSS e l'interfaccia finirebbe tutta in alto.
const px = (v) => (Number.isFinite(+v) ? Math.max(0, Math.min(200, +v)) : 0);
function setInsets(ins) {
  const s = document.documentElement.style;
  for (const k of ['top', 'bottom', 'left', 'right']) {
    const o = ins[k];
    const v = typeof o === 'object' && o ? px(o.system) + px(o.content) : px(o);
    s.setProperty('--s' + k[0], v + 'px');
  }
}
function tgInsets() {
  if (!tg || !tg.initData) return;
  const a = tg.safeAreaInset || {}, b = tg.contentSafeAreaInset || {};
  setInsets(Object.fromEntries(['top', 'bottom', 'left', 'right'].map((k) => [k, { system: a[k], content: b[k] }])));
}
if (tg && tg.initData) {
  try {
    tg.ready(); tg.expand();
    if (tg.disableVerticalSwipes) tg.disableVerticalSwipes(); // trascinare sul tavolo non deve chiudere la mini app
    if (tg.onEvent) ['safeAreaChanged', 'contentSafeAreaChanged', 'viewportChanged', 'fullscreenChanged'].forEach((e) => tg.onEvent(e, tgInsets));
    tgInsets();
  } catch (e) { /* vecchie versioni */ }
}
const toApp = (type, data = {}) => { if (embedded) window.parent.postMessage({ type: 'bil:' + type, ...data }, location.origin); };
const haptic = (kind, style) => {
  if (embedded) toApp('haptic', { kind, style });
  else if (tg && tg.HapticFeedback) { try { if (kind === 'impact') tg.HapticFeedback.impactOccurred(style); else if (kind === 'notification') tg.HapticFeedback.notificationOccurred(style); } catch (e) { /* niente */ } }
};
const onlineRoom = embedded && new URLSearchParams(location.search).has('online');

const store = {
  get(k, d) { try { const v = localStorage.getItem('biliardo.' + k); return v === null ? d : v; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('biliardo.' + k, v); } catch (e) { /* niente storage */ } },
};
const cfg = {
  variant: store.get('variant', 'otto'),
  mode: store.get('mode', '1'),
  level: store.get('level', 'medio'),
  cloth: store.get('cloth', 'verde'),
  guide: store.get('guide', '1') === '1',
  view: store.get('view', 'over'),
  sens: +store.get('sens', '100') / 100,
  netPlayers: +store.get('np', '2') >= 2 && +store.get('np', '2') <= 8 ? +store.get('np', '2') : 2,
  cush: +store.get('cush', '3'),
  bright: +store.get('bright', '75') / 100,
  charge: store.get('charge', 'normale'),
  quality: store.get('quality', /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) ? 'media' : 'alta'),
  n1: store.get('n1', ''), n2: store.get('n2', ''),
  target: JSON.parse(store.get('target', '{}')),
};
if (!E.VARIANTS[cfg.variant]) cfg.variant = 'otto';
if (cfg.mode === 'net' && !embedded) cfg.mode = '1';

const table = new Table3D($('gl'), { quality: cfg.quality });
table.setBrightness(cfg.bright);
const canvas = table.renderer.domElement;

// ---------- stato ----------
let m = null, T = null, phase = 'menu';
let events = [], evSeen = 0, acc = 0, shotClock = 0;
const falling = new Map();
const aim = { angle: 0, power: 0, spinX: 0, spinY: 0, call: -1 };
const shotFrom = { x: 0, z: 0 };
let strikeT = 0, strikeFrom = 0, pending = null, cueHideT = 0;
// colore del panno: online è quello scelto da chi ha creato la partita (uguale per tutti), altrimenti il tuo
const clothKey = () => (net && net.opts && E.CLOTH_KEYS.includes(net.opts.cloth) ? net.opts.cloth : cfg.cloth);
const clothColor = () => {
  const k = clothKey(), v = m ? m.variant : cfg.variant;
  return v === 'snooker' && k === 'verde' ? '#0e6a35' : (CLOTHS[k] || CLOTHS.verde).c;
};

// online
let me = null;          // { player, name } da Binottoland
let net = null;         // ultimo stato del server
let netSkew = 0, netShown = 0, netAfter = null, myShotSent = false;

// prepara la scena per una partita (tavolo, bilie, birilli)
function stage(game) {
  const kind = E.VARIANTS[game.variant].table;
  if (!T || T.kind !== kind) { T = E.tableOf(game); table.setTable(T, clothColor()); table.preset(table.view, true); }
  T = E.tableOf(game);
  table.setCloth(clothColor());
  table.setBalls(game.balls.map((b) => ({ id: b.id, r: b.r, look: E.ballLook(game, b) })));
  table.setPins(game.pins);
  falling.clear();
}

function players() {
  if (cfg.mode === '1') return [{ name: 'Tu' }, { name: 'Computer', cpu: true }];
  return [{ name: cfg.n1.trim() || 'Giocatore 1' }, { name: cfg.n2.trim() || 'Giocatore 2' }];
}
// valore scelto, se è uno di quelli ammessi; altrimenti quello predefinito (60 per i 5 birilli, 80 per le boccette)
function targetOf(v) {
  const ok = v === 'snooker' ? E.REDS : E.TARGETS[v] || [];
  return ok.includes(cfg.target[v]) ? cfg.target[v] : v === 'snooker' ? 6 : E.DEFAULT_TARGET[v] || 0;
}
// carambola: libera, a una o a tre sponde
const cushOf = () => (E.CUSHIONS.includes(cfg.cush) ? cfg.cush : 3);
function gameOpts(v) {
  const t = targetOf(v);
  return v === 'snooker' ? { reds: t } : v === 'carambola' ? { target: t, cush: cushOf() } : { target: t };
}

function newGame() {
  m = E.newGame(cfg.variant, players(), gameOpts(cfg.variant));
  if (cfg.mode === '2') E.setStarter(m, Math.random() < 0.5 ? 0 : 1);
  stage(m);
  hideSheets();
  $('hud').hidden = false;
  table.preset(cfg.view, false);
  turn(true);
}

// ---------- turni ----------
const cur = () => m.players[m.cur];
// online (anche a squadre): tocca a chi deve tirare per la squadra di turno; chi non è seduto guarda
const shooterId = () => (net && net.seats ? E.shooterOf(net, m.cur) : null);
const nameOfId = (id) => { const p = net && net.players.find((q) => q.id === id); return p ? p.name : ''; };
const myTurn = () => (net ? !!me && shooterId() === me.player && net.phase === 'playing' : !cur().cpu);
const mySide = () => (net && me ? E.sideOf(net, me.player) : -1); // -1: spettatore
const shooterName = () => (net ? nameOfId(shooterId()) || cur().name : cur().name);
const cueBall = () => m.balls[E.cueId(m)];

function aimAtNearest() {
  const c = cueBall(), ids = E.legalFirst(m) || (m.variant === 'boccette' ? [0] : []);
  let best = null, bd = 1e9;
  for (const id of ids) { const b = m.balls[id]; const d = (b.x - c.x) ** 2 + (b.z - c.z) ** 2; if (b.on && d < bd) { bd = d; best = b; } }
  if (best) aim.angle = Math.atan2(best.z - c.z, best.x - c.x);
}

function turn(changed) {
  aim.power = 0; aim.spinX = 0; aim.spinY = 0; aim.call = -1; drawSpin();
  hud();
  aimAtNearest();
  if (changed) {
    const who = net ? (myTurn() ? 'Tocca a te' : `Tocca a ${shooterName()}`) : cfg.mode === '1' ? (cur().cpu ? 'Tocca al computer' : 'Tocca a te') : `Tocca a ${cur().name}`;
    banner(who);
    if (myTurn()) haptic('impact', 'medium');
  }
  if (m.over) { gameOver(); return; }
  if (net) phase = myTurn() ? 'aim' : 'watch';
  else if (cur().cpu) { phase = 'cpu'; runCpu(); } else phase = 'aim';
  toApp('racing', { on: !!net && !m.over });
  hint();
}

function hint() {
  let t = '';
  if (phase === 'aim') {
    const what = E.onText(m);
    const pull = 'tira giù il pallino della forza';
    if (m.inHand) t = (m.variant === 'boccette' ? 'Trascina la tua bilia a destra o a sinistra (dietro la linea)' : 'Bilia in mano: trascinala') + ', mira e ' + pull;
    else t = 'Tocca o trascina per mirare · ' + pull;
    if (what) t = what + ' · ' + t;
  } else if (phase === 'cpu' || phase === 'cpuAim') t = 'Il computer sta pensando…';
  else if (phase === 'watch') t = `Tocca a ${shooterName()}…` + (net && mySide() < 0 ? ' · stai guardando' : '');
  $('hint').textContent = t;
  const can = phase === 'aim';
  $('power').classList.toggle('off', !can);
  $('powLbl').textContent = can ? 'Forza' : '';
}

function hud() {
  m.players.forEach((p, i) => {
    const el = $('p' + i);
    el.classList.toggle('on', i === m.cur && !m.over);
    const mine = net && mySide() === i;
    el.querySelector('.nm').innerHTML = '';
    el.querySelector('.nm').append(p.name);
    if (mine) { const s = document.createElement('span'); s.className = 'me'; s.textContent = net.seats.length > 2 ? '(la tua squadra)' : '(tu)'; el.querySelector('.nm').append(s); }
    const g = el.querySelector('.grp');
    g.innerHTML = '';
    if (m.variant === 'otto' && p.group) {
      const ids = p.group === E.SOLID ? [1, 2, 3, 4, 5, 6, 7] : [9, 10, 11, 12, 13, 14, 15];
      let left = 0;
      for (const id of ids) {
        const d = document.createElement('span');
        d.className = 'mb' + (id >= 9 ? ' st' : '') + (m.balls[id].on ? '' : ' gone');
        d.style.background = E.ballLook(m, m.balls[id]).color;
        if (m.balls[id].on) left++;
        g.appendChild(d);
      }
      if (!left) { const d = document.createElement('span'); d.className = 'mb'; d.style.background = '#111'; d.style.outline = '2px solid #e8c26a'; g.appendChild(d); }
      return;
    }
    if (m.variant === 'italiana' || m.variant === 'carambola' || m.variant === 'boccette') {
      const d = document.createElement('span'); d.className = 'mb';
      d.style.background = m.variant !== 'boccette' ? (i === 0 ? '#f4f1e6' : '#f2c414') : (i === 0 ? '#c8141e' : '#f4f1e6');
      g.appendChild(d);
    }
    g.append(' ' + E.status(m, i));
  });
}

let toastT = 0;
function toast(msg, bad) {
  if (!msg) return;
  const t = $('toast');
  t.textContent = msg; t.classList.toggle('bad', !!bad); t.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2800);
}
let bannerT = 0;
function banner(msg) {
  const b = $('banner'); b.textContent = msg; b.classList.add('on');
  clearTimeout(bannerT); bannerT = setTimeout(() => b.classList.remove('on'), 1300);
}

// ---------- colpo ----------
const maxS = () => E.maxSpeed(m);
const toSpeed = (p) => 0.12 + (maxS() - 0.12) * Math.pow(p, 1.6);
const toPower = (s) => Math.pow(Math.max(0, (s - 0.12) / (maxS() - 0.12)), 1 / 1.6);

function shotInput(speed) {
  const c = cueBall();
  const s = { dx: Math.cos(aim.angle), dz: Math.sin(aim.angle), speed, sy: aim.spinY, sx: aim.spinX };
  if (m.inHand) { s.px = c.x; s.pz = c.z; }
  if (m.acchito) { s.qx = m.balls[0].x; s.qz = m.balls[0].z; }
  if (E.onEight(m) && aim.call >= 0) s.call = aim.call;
  return s;
}

// il giocatore (o il computer) tira: prima la stecca va indietro e avanti, poi parte la bilia
function shoot(power, speed) {
  if (phase !== 'aim' && phase !== 'cpuAim') return;
  if (m.inHand && !E.canPlace(m, cueBall().x, cueBall().z)) { toast('Lì la bilia non si può mettere', true); return; }
  if (E.onEight(m) && aim.call < 0 && phase === 'aim') { toast('Prima chiama la buca della nera: toccala sul tavolo', true); return; }
  const input = shotInput(speed ?? toSpeed(power));
  pending = { input, power };
  strikeFrom = 0.04 + power * 0.2;
  strikeT = 0;
  phase = 'strike';
  aim.power = power;
  if (net) { myShotSent = true; toApp('action', { kind: 'play', payload: input }); }
  hint();
}

function launch(input, power) {
  events = []; evSeen = 0; shotClock = 0; acc = 0;
  const b = E.beginShot(m, input);
  shotFrom.x = b.x; shotFrom.z = b.z;
  if (E.usesCue(m)) sfx.cue(power ?? toPower(input.speed)); else sfx.release(power ?? toPower(input.speed));
  haptic('impact', 'light');
  phase = 'shot';
  cueHideT = 0.35;
  hint();
}

function endShot() {
  const before = m.cur;
  if (net) {
    // online: il tavolo giusto è quello del server (uguale al nostro, la fisica è la stessa ovunque)
    if (netAfter) { adoptNet(netAfter); netAfter = null; return; }
    phase = 'sync';
    return;
  }
  const out = E.finishShot(m, events);
  afterShot(out, before);
}

function afterShot(out, before) {
  hud();
  if (out.foul) { toast(out.msg, true); sfx.foul(); haptic('notification', 'error'); }
  else if (out.msg) toast(out.msg);
  if (m.over) { gameOver(); return; }
  turn(before !== m.cur || out.round);
}

function gameOver() {
  phase = 'over';
  hint();
  toApp('racing', { on: false });
  const w = m.players[m.winner];
  const myWin = net ? mySide() === m.winner : cfg.mode === '2' || !w.cpu;
  if (myWin) { sfx.win(); haptic('notification', 'success'); } else sfx.foul();
  setTimeout(() => {
    $('overT').textContent = net ? (myWin ? (net.seats.length > 2 ? 'Avete vinto!' : 'Hai vinto!') : `Vince ${w.name}`) : cfg.mode === '1' ? (w.cpu ? 'Ha vinto il computer' : 'Hai vinto!') : `Vince ${w.name}!`;
    const sc = m.variant === 'otto' || m.variant === 'nove' ? '' : ` · ${m.scores[0]} a ${m.scores[1]}`;
    $('overS').textContent = (m.msg || '') + sc + ` · ${m.shots} colpi`;
    // rivincita: in locale si riparte subito; online si apre una partita nuova con le stesse scelte
    // (gli altri la trovano negli avvisi); chi guardava soltanto non la offre
    $('overAgain').hidden = !!net && mySide() < 0;
    $('overAgain').textContent = net ? 'Rivincita online' : 'Rivincita';
    $('overMode').hidden = !!net;
    $('overExit').textContent = exitLabel();
    $('over').hidden = false;
  }, 900);
}

// ---------- computer ----------
let cpuFrom = 0, cpuTo = 0, cpuT = 0, cpuShot = null;
async function runCpu() {
  const game = m;
  await new Promise((r) => setTimeout(r, 650));
  if (m !== game || phase !== 'cpu') return;
  const shot = await plan(m, cfg.level);
  if (m !== game || phase !== 'cpu') return;
  if (typeof shot.px === 'number') { const c = cueBall(); c.x = shot.px; c.z = shot.pz; }
  if (typeof shot.qx === 'number') { m.balls[0].x = shot.qx; m.balls[0].z = shot.qz; }
  if (shot.call >= 0) aim.call = shot.call;
  cpuShot = shot;
  cpuFrom = aim.angle;
  let d = Math.atan2(shot.dz, shot.dx) - aim.angle;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  cpuTo = aim.angle + d;
  cpuT = 0;
  aim.spinX = shot.sx; aim.spinY = shot.sy; drawSpin();
  phase = 'cpuAim';
}
function cpuStep(dt) {
  cpuT += dt;
  const k = Math.min(1, cpuT / 0.9), e = k * k * (3 - 2 * k);
  aim.angle = cpuFrom + (cpuTo - cpuFrom) * e;
  const pw = toPower(cpuShot.speed);
  if (cpuT > 1.0) aim.power = Math.min(pw, (cpuT - 1.0) * 1.5);
  if (cpuT > 1.0 + pw / 1.5 + 0.35) {
    // la direzione esatta del computer (non quella ricavata dall'angolo animato)
    const input = { ...cpuShot };
    pending = { input, power: pw };
    strikeFrom = 0.04 + pw * 0.2; strikeT = 0; phase = 'strike';
  }
}

// ---------- mira e bilia in mano ----------
function aimGuide() {
  const c = cueBall();
  if (!c) return null;
  const dx = Math.cos(aim.angle), dz = Math.sin(aim.angle);
  const hit = P.castAim(T, m.balls, c, dx, dz);
  const gx = c.x + dx * hit.t, gz = c.z + dz * hit.t;
  const a = { x: c.x, z: c.z, r: c.r, angle: aim.angle, len: Math.max(0, hit.t), gx, gz, arrow: !E.usesCue(m), power: aim.power };
  if (hit.ball) {
    const o = hit.ball, rr = o.r + c.r, nx = (o.x - gx) / rr, nz = (o.z - gz) / rr;
    const cosc = dx * nx + dz * nz;
    const long = cfg.guide ? 0.5 : 0.16;
    a.obj = { x: o.x, z: o.z, r: o.r, ang: Math.atan2(nz, nx), len: long * Math.max(0.15, cosc) };
    a.cueAng = Math.atan2(dz - cosc * nz, dx - cosc * nx);
    a.cueLen = (cfg.guide ? 0.3 : 0.1) * Math.sqrt(Math.max(0, 1 - cosc * cosc));
    const legal = E.legalFirst(m);
    a.bad = !!legal && !legal.includes(o.id);
  }
  // birilli sulla traiettoria prima del contatto: sarebbe fallo, si segna in rosso
  if (m.pins) for (const p of m.pins) {
    if (!p.up) continue;
    const t = (p.x - c.x) * dx + (p.z - c.z) * dz;
    if (t < 0 || t > hit.t) continue;
    const px = c.x + dx * t - p.x, pz = c.z + dz * t - p.z;
    if (px * px + pz * pz < (c.r + P.PIN_R) ** 2) { a.obj = a.obj || { x: p.x, z: p.z, r: 0.012, ang: 0, len: 0 }; a.bad = true; a.obj.x = p.x; a.obj.z = p.z; a.obj.r = 0.012; a.obj.len = 0; a.cueLen = 0; break; }
  }
  return a;
}

// buca più vicina a un punto toccato (palla 8: chiamata della nera)
function pocketAt(p) {
  let best = -1, bd = 0.14;
  T.pockets.forEach((q, k) => { const d = Math.hypot(q.x - p.x, q.z - p.z); if (d < bd) { bd = d; best = k; } });
  return best;
}
function tryPallino(p) {
  const r = m.balls[0].r;
  const x = Math.max(r + 0.001, Math.min(T.L - r, p.x)), z = Math.max(-T.W + r, Math.min(T.W - r, p.z));
  if (E.canPlacePallino(m, x, z)) { m.balls[0].x = x; m.balls[0].z = z; }
}
function tryPlace(p) {
  if (!p) return;
  const c = cueBall(), r = c.r;
  const lim = m.inHand === 'kitchen' || m.inHand === 'throw' ? -T.L / 2 : m.inHand === 'head' ? -r - 0.001 : T.L - r;
  const low = m.inHand === 'foot' ? r + 0.001 : -T.L + r;
  const x = Math.max(low, Math.min(lim, p.x)), z = Math.max(-T.W + r, Math.min(T.W - r, p.z));
  if (E.canPlace(m, x, z)) { c.x = x; c.z = z; }
  else if (m.inHand === 'D') {
    // nella D: resta sul bordo del semicerchio
    const bx = E.baulkX(T), ddx = Math.min(0, x - bx), d = Math.hypot(ddx, z) || 1, k = Math.min(1, (E.D_R - 0.001) / d);
    const qx = bx + ddx * k, qz = z * k;
    if (E.canPlace(m, qx, qz)) { c.x = qx; c.z = qz; }
  }
}

const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const angleTo = (p) => Math.atan2(p.z - cueBall().z, p.x - cueBall().x);

// ---------- comandi sul tavolo: mira, bilia in mano, telecamera ----------
const ptrs = new Map();
let drag = null, gesture = null, camMode = false;
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('wheel', (e) => { e.preventDefault(); table.zoom(Math.exp(e.deltaY * 0.0012)); }, { passive: false });
canvas.addEventListener('pointerdown', (e) => {
  capture(canvas, e);
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ptrs.size === 2) { drag = null; gesture = startGesture(); return; }
  if (ptrs.size > 2) return;
  const mouse = e.pointerType === 'mouse';
  if ((mouse && e.button === 2) || (!mouse && camMode)) { drag = { cam: 'orbit', x: e.clientX, y: e.clientY }; return; }
  if (mouse && (e.button === 1 || e.shiftKey)) { drag = { cam: 'pan', x: e.clientX, y: e.clientY }; return; }
  if (phase !== 'aim' || !m) return;
  const p = table.pick(e.clientX, e.clientY);
  if (!p) return;
  const c = cueBall(), reach = mouse ? 0.05 : 0.09;
  if (m.acchito && Math.hypot(p.x - m.balls[0].x, p.z - m.balls[0].z) < reach) { drag = { pallino: true }; return; }
  if (m.inHand && Math.hypot(p.x - c.x, p.z - c.z) < reach) { drag = { place: true }; return; }
  drag = { aim: true, sx: e.clientX, sy: e.clientY, last: angleTo(p), moved: false };
});
canvas.addEventListener('pointermove', (e) => {
  if (!ptrs.has(e.pointerId)) return;
  const prev = ptrs.get(e.pointerId);
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (gesture && ptrs.size === 2) { moveGesture(); return; }
  if (!drag) return;
  if (drag.cam) {
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.x = e.clientX; drag.y = e.clientY;
    if (drag.cam === 'orbit') table.orbit(-dx * 0.006, dy * 0.004); else table.pan(dx, dy);
    return;
  }
  if (phase !== 'aim') return;
  const p = table.pick(e.clientX, e.clientY);
  if (!p) return;
  // boccette: spostando la bilia di lato la mira resta puntata sul pallino
  if (drag.place) {
    tryPlace(p);
    if (m.variant === 'boccette') { const c = cueBall(), q = m.balls[0]; aim.angle = Math.atan2(q.z - c.z, q.x - c.x); }
    return;
  }
  if (drag.pallino) { tryPallino(p); return; }
  if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6) drag.moved = true;
  if (!drag.moved) return;
  const a = angleTo(p);
  // vicino alla bilia l'angolo cambia troppo in fretta: lo smorzo; la sensibilità la sceglie il giocatore
  const dist = Math.hypot(p.x - cueBall().x, p.z - cueBall().z);
  aim.angle = wrap(aim.angle + wrap(a - drag.last) * Math.min(1, dist / 0.25) * cfg.sens * 0.6);
  drag.last = a;
  void prev;
});
const endPtr = (e) => {
  if (!ptrs.has(e.pointerId)) return;
  ptrs.delete(e.pointerId);
  if (gesture) { if (ptrs.size < 2) gesture = null; drag = null; return; }
  if (drag && drag.aim && !drag.moved && phase === 'aim') {
    const p = table.pick(e.clientX, e.clientY);
    const k = p && E.onEight(m) ? pocketAt(p) : -1;
    if (k >= 0) { aim.call = k; toast('Nera chiamata nella buca ' + E.POCKET_NAMES[k]); }
    else if (p) aim.angle = angleTo(p);
    sfx.tick();
  }
  drag = null;
};
canvas.addEventListener('pointerup', endPtr);
canvas.addEventListener('pointercancel', endPtr);

// due dita: pizzica = zoom, ruota = gira attorno, sposta = trasla la vista
function two() { const [a, b] = [...ptrs.values()]; return { cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y), ang: Math.atan2(b.y - a.y, b.x - a.x) }; }
function startGesture() { return two(); }
function moveGesture() {
  const n = two(), g = gesture;
  if (g.d > 10 && n.d > 10) table.zoom(g.d / n.d);
  table.orbit(wrap(n.ang - g.ang), 0);
  table.pan(n.cx - g.cx, n.cy - g.cy);
  gesture = n;
}

$('camB').onclick = () => { camMode = !camMode; $('camB').classList.toggle('on', camMode); toast(camMode ? 'Un dito ora gira la vista. Tocca di nuovo 🎥 per tornare a mirare.' : 'Un dito torna a mirare'); };

// ---------- forza: il dito si appoggia sulla barra e trascina giù il pallino; lasciando si tira ----------
// Si parte sempre da zero, ovunque si appoggi il dito. Riportare il pallino in cima, oppure portare il dito
// lontano dalla barra di lato, annulla il tiro.
const capture = (el, e) => { try { el.setPointerCapture(e.pointerId); } catch (err) { /* puntatore già sparito */ } };
const pw = $('power'), track = pw.querySelector('.track');
let pwDrag = null;
pw.addEventListener('pointerdown', (e) => {
  if (phase !== 'aim') return;
  capture(pw, e);
  pwDrag = { id: e.pointerId, y: e.clientY, cancel: false };
  aim.power = 0; pw.classList.add('drag');
});
pw.addEventListener('pointermove', (e) => {
  if (!pwDrag || e.pointerId !== pwDrag.id) return;
  const r = track.getBoundingClientRect();
  aim.power = Math.max(0, Math.min(1, (e.clientY - pwDrag.y) / (r.height * 0.92)));
  pwDrag.cancel = e.clientX < r.left - 90;
  pw.classList.toggle('cancel', pwDrag.cancel);
});
const pwEnd = (e, cancel) => {
  if (!pwDrag || e.pointerId !== pwDrag.id) return;
  const c = cancel || pwDrag.cancel;
  pwDrag = null; pw.classList.remove('drag', 'cancel');
  if (!c && aim.power > 0.03 && phase === 'aim') shoot(aim.power);
  else { if (aim.power > 0.03) toast('Tiro annullato'); aim.power = 0; }
};
pw.addEventListener('pointerup', (e) => pwEnd(e, false));
pw.addEventListener('pointercancel', (e) => pwEnd(e, true));

// tastiera (PC): spazio tenuto premuto carica avanti e indietro, lasciando si tira
let charging = false, chargeT = 0;
const keys = {};
addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  keys[e.key] = true;
  if (e.key === ' ' && !e.repeat) { e.preventDefault(); if (phase === 'aim') { charging = true; chargeT = 0; aim.power = 0; } }
  if (e.key === 'Escape') toggleMenu();
  if (e.key === '+' || e.key === '=') table.zoom(0.9);
  if (e.key === '-') table.zoom(1.1);
});
addEventListener('keyup', (e) => {
  keys[e.key] = false;
  if (e.key === ' ' && charging) { charging = false; if (aim.power > 0.03 && phase === 'aim') shoot(aim.power); else aim.power = 0; }
});

// effetto
function drawSpin() {
  const set = (el, k) => { el.style.left = 50 + aim.spinX * k + '%'; el.style.top = 50 - aim.spinY * k + '%'; };
  set($('spinB').querySelector('i'), 40);
  set($('spinPad').querySelector('.big i'), 45);
}
$('spinB').onclick = () => { $('spinPad').hidden = !$('spinPad').hidden; };
$('spinOk').onclick = () => { $('spinPad').hidden = true; };
$('spinC').onclick = () => { aim.spinX = aim.spinY = 0; drawSpin(); };
const pad = $('spinPad').querySelector('.big');
const setSpin = (e) => {
  const r = pad.getBoundingClientRect();
  let x = ((e.clientX - r.left) / r.width) * 2 - 1, y = -(((e.clientY - r.top) / r.height) * 2 - 1);
  const d = Math.hypot(x, y), k = 0.8;
  if (d > k) { x *= k / d; y *= k / d; }
  aim.spinX = x / k; aim.spinY = y / k;
  drawSpin();
};
let spinId = null;
pad.addEventListener('pointerdown', (e) => { if (phase !== 'aim') return; spinId = e.pointerId; capture(pad, e); setSpin(e); });
pad.addEventListener('pointermove', (e) => { if (e.pointerId === spinId) setSpin(e); });
pad.addEventListener('pointerup', () => { spinId = null; });

// vista
const VIEWS = { over: 'Panoramica', top: 'Dall\'alto', cue: 'Stecca' };
const viewLabel = () => { $('viewB').textContent = VIEWS[table.view] || 'Vista'; };
$('viewB').onclick = () => {
  const order = ['over', 'top', 'cue'];
  const v = order[(order.indexOf(table.view) + 1) % 3];
  cfg.view = v; table.preset(v); store.set('view', v); viewLabel();
};

// ---------- schermate ----------
function hideSheets() { for (const id of ['start', 'menu', 'rules', 'over', 'wait']) $(id).hidden = true; }
// Uscire: dentro Binottoland si torna all'app; aperto da Telegram si chiude la mini app; nel browser si torna
// alla schermata iniziale. Online la partita continua senza di te (tira il pilota automatico).
const exitLabel = () => (embedded ? 'Esci e torna a Binottoland' : tg && tg.initData ? 'Esci dal gioco' : net ? 'Esci dalla partita' : 'Esci');
function leaveGame() {
  hideSheets();
  if (embedded) { toApp('exit'); return; }
  if (tg && tg.initData && tg.close) { try { tg.close(); return; } catch (e) { /* vecchie versioni */ } }
  net = null; toStart();
}
function syncMenu() {
  // ripartire e cambiare modalità valgono solo per le partite su questo telefono: una partita online è di tutti
  $('restart').hidden = !!net;
  $('toStart').hidden = !!net;
  // chi l'ha creata la chiude per tutti; gli altri giocatori possono abbandonarla (tira il pilota automatico)
  const kind = closeKind();
  $('closeAll').hidden = !kind;
  $('closeAll').textContent = kind === 'abandon' ? 'Abbandona la partita' : 'Chiudi la partita per tutti';
  $('closeAll').dataset.sure = '';
  $('exitB').textContent = exitLabel();
}
function toggleMenu() {
  if (!m || phase === 'menu') return;
  syncMenu();
  $('menu').hidden = !$('menu').hidden;
}
$('menuB').onclick = toggleMenu;
$('resume').onclick = () => { $('menu').hidden = true; };
$('restart').onclick = () => { if (!net) newGame(); };
const toStart = () => {
  hideSheets(); phase = 'menu'; $('hud').hidden = true; $('start').hidden = false; showStart();
};
$('toStart').onclick = () => { if (!net) toStart(); };
$('overMode').onclick = () => { if (!net) toStart(); };
$('overAgain').onclick = () => {
  if (!net) return newGame();
  // online: nuova partita con le stesse scelte (specialità, giocatori, punti/rosse, panno)
  const o = net.opts || {};
  $('over').hidden = true;
  toast('Apro la rivincita online…');
  toApp('create', { variant: net.variant, players: net.capacity || 2, cloth: o.cloth || cfg.cloth, ...(net.variant === 'snooker' ? { reds: o.reds } : { target: o.target, cush: o.cush }) });
};
$('exitB').onclick = leaveGame;
$('overExit').onclick = leaveGame;
$('startExit').hidden = !(embedded || (tg && tg.initData));
$('startExit').onclick = leaveGame;
function closeKind() {
  if (!net || !me || net.phase !== 'playing' || !(net.seats || []).includes(me.player)) return null;
  const gone = net.gone || [];
  if (net.owner === me.player || gone.includes(net.owner)) return 'close';
  return gone.includes(me.player) ? null : 'abandon';
}
// chi ha creato la partita online può chiuderla per tutti, gli altri abbandonarla (secondo tocco per confermare)
$('closeAll').onclick = () => {
  const b = $('closeAll'), kind = closeKind();
  if (!kind) return;
  if (!b.dataset.sure) { b.dataset.sure = '1'; b.textContent = kind === 'abandon' ? 'Sicuro? Tocca di nuovo per abbandonare' : 'Sicuro? Tocca di nuovo per chiuderla'; return; }
  $('menu').hidden = true;
  toApp('action', { kind });
};
let rulesBack = 'start';
const openRules = (from) => {
  rulesBack = from; $(from).hidden = true; $('rules').hidden = false;
  const v = m ? m.variant : cfg.variant;
  $('rulesT').textContent = 'Regole · ' + E.VARIANTS[v].name;
  $('rulesList').innerHTML = E.RULES[v].map((t) => `<li>${t}</li>`).join('');
};
$('rulesB').onclick = () => openRules('start');
$('rulesB2').onclick = () => openRules('menu');
$('rulesOk').onclick = () => { $('rules').hidden = true; $(rulesBack).hidden = false; };

const segOn = (sel, attr, val) => document.querySelectorAll(sel).forEach((b) => b.classList.toggle('on', b.dataset[attr] === val));
function showStart() {
  const vg = $('variants');
  vg.innerHTML = '';
  for (const [k, v] of Object.entries(E.VARIANTS)) {
    const b = document.createElement('button');
    b.innerHTML = `<b>${v.name}</b><small>${{ otto: 'piene e rigate, WPA', nove: 'dalla 1 alla 9, WPA', snooker: 'tavolo da 12 piedi', italiana: '5 birilli, FIBiS', carambola: 'libera, 1 o 3 sponde', boccette: 'a mano, senza stecca' }[k]}</small>`;
    b.classList.toggle('on', k === cfg.variant);
    b.onclick = () => { cfg.variant = k; store.set('variant', k); preview(); showStart(); };
    vg.appendChild(b);
  }
  $('vDesc').textContent = E.VARIANTS[cfg.variant].desc;
  segOn('[data-m]', 'm', cfg.mode);
  document.querySelector('[data-m="net"]').disabled = !embedded;
  segOn('[data-l]', 'l', cfg.level);
  $('lvRow').hidden = cfg.mode !== '1';
  $('nameRow').hidden = cfg.mode !== '2';
  $('netRow').hidden = cfg.mode !== 'net';
  segOn('[data-np]', 'np', String(cfg.netPlayers));
  const np = cfg.netPlayers;
  $('modeInfo').textContent = cfg.mode === '1' ? 'Giochi contro il computer.'
    : cfg.mode === '2' ? 'Due giocatori a turno sullo stesso telefono o PC.'
      : embedded ? (np === 2 ? 'Partita online contro un altro giocatore di Binottoland'
        : `Partita online a squadre, ${np} giocatori: nella sala d’attesa ognuno sceglie la sua squadra (fino a 4), poi i compagni tirano a turno, ${E.EVERY_SHOT.includes(cfg.variant) ? 'a ogni colpo' : 'a ogni turno al tavolo'}`) +
        ': compare negli avvisi e nella Lobby, chi arriva dopo guarda. 1 minuto a colpo, poi tira il pilota automatico.'
        : 'Online solo aprendo il gioco da Binottoland.';
  // punteggio da raggiungere / rosse (gli stessi valori che accetta il motore)
  const v = cfg.variant, row = $('tgRow'), btns = $('tgBtns');
  row.hidden = v === 'otto' || v === 'nove';
  $('cushRow').hidden = v !== 'carambola';
  segOn('[data-cu]', 'cu', String(cushOf()));
  btns.innerHTML = '';
  $('tgLbl').textContent = v === 'snooker' ? 'Rosse' : 'Punti per vincere';
  const opts = v === 'snooker' ? E.REDS : E.TARGETS[v] || [];
  for (const o of opts) {
    const b = document.createElement('button'); b.className = 'seg' + (o === targetOf(v) ? ' on' : ''); b.textContent = o;
    b.onclick = () => { cfg.target[v] = o; store.set('target', JSON.stringify(cfg.target)); showStart(); };
    btns.appendChild(b);
  }
  $('n1').value = cfg.n1; $('n2').value = cfg.n2;
  const cl = $('cloths');
  cl.innerHTML = '';
  for (const [k, c] of Object.entries(CLOTHS)) {
    const b = document.createElement('button');
    b.style.background = c.c; b.title = c.name; b.setAttribute('aria-label', 'Panno ' + c.name);
    b.classList.toggle('on', k === cfg.cloth);
    b.onclick = () => { cfg.cloth = k; store.set('cloth', k); table.setCloth(clothColor()); showStart(); };
    cl.appendChild(b);
  }
  $('play').textContent = cfg.mode === 'net' ? 'Apri la partita online' : 'Gioca';
}
document.querySelectorAll('[data-m]').forEach((b) => (b.onclick = () => { cfg.mode = b.dataset.m; store.set('mode', cfg.mode); showStart(); }));
document.querySelectorAll('[data-l]').forEach((b) => (b.onclick = () => { cfg.level = b.dataset.l; store.set('level', cfg.level); showStart(); }));
document.querySelectorAll('[data-cu]').forEach((b) => (b.onclick = () => { cfg.cush = +b.dataset.cu; store.set('cush', b.dataset.cu); showStart(); }));
document.querySelectorAll('[data-np]').forEach((b) => (b.onclick = () => { cfg.netPlayers = +b.dataset.np; store.set('np', b.dataset.np); showStart(); }));
$('n1').oninput = () => { cfg.n1 = $('n1').value; store.set('n1', cfg.n1); };
$('n2').oninput = () => { cfg.n2 = $('n2').value; store.set('n2', cfg.n2); };
$('play').onclick = () => {
  if (cfg.mode !== 'net') return newGame();
  if (!me) return toast('Apri il gioco da Binottoland per giocare online.', true);
  toast('Apro la partita online…');
  toApp('create', { variant: cfg.variant, players: cfg.netPlayers, cloth: cfg.cloth, ...gameOpts(cfg.variant) });
};

// impostazioni
const onOff = (el, v) => { el.textContent = v ? 'Sì' : 'No'; el.classList.toggle('on', v); };
$('guideB').onclick = () => { cfg.guide = !cfg.guide; store.set('guide', cfg.guide ? '1' : '0'); onOff($('guideB'), cfg.guide); };
$('sndB').onclick = () => { sfx.toggle(); onOff($('sndB'), sfx.on); };
onOff($('guideB'), cfg.guide); onOff($('sndB'), sfx.on);
$('sens').value = Math.round(cfg.sens * 100);
const sensLbl = () => { $('sensV').textContent = Math.round(cfg.sens * 100) + '%'; };
$('sens').oninput = () => { cfg.sens = +$('sens').value / 100; store.set('sens', String(Math.round(cfg.sens * 100))); sensLbl(); };
sensLbl();
// luminosità: lo stesso cursore nel menu iniziale e nella pausa
const brightSync = () => {
  const v = String(Math.round(cfg.bright * 100));
  for (const id of ['bright', 'bright2']) $(id).value = v;
  for (const id of ['brightV', 'brightV2']) $(id).textContent = v + '%';
};
for (const id of ['bright', 'bright2']) $(id).oninput = () => { cfg.bright = +$(id).value / 100; store.set('bright', $(id).value); table.setBrightness(cfg.bright); brightSync(); };
brightSync();
document.querySelectorAll('[data-q]').forEach((b) => (b.onclick = () => { cfg.quality = b.dataset.q; store.set('quality', cfg.quality); table.setQuality(cfg.quality); segOn('[data-q]', 'q', cfg.quality); }));
segOn('[data-q]', 'q', cfg.quality);

// tavolo "di vetrina" dietro il menu
function preview() {
  if (phase !== 'menu') return;
  m = E.newGame(cfg.variant, players(), gameOpts(cfg.variant));
  stage(m);
}

// ---------- online ----------
// Binottoland tiene la partita sul server e manda qui lo stato ("bil:state"). Ogni colpo arriva come
// {prima, colpo, dopo}: il gioco rifà il colpo con la stessa fisica (identica su ogni telefono) e poi prende "dopo".
function adoptNet(st) {
  const game = st.match;
  const fresh = !m || m.variant !== game.variant || phase === 'menu' || phase === 'wait';
  m = JSON.parse(JSON.stringify(game));
  if (fresh) stage(m);
  else { T = E.tableOf(m); }
  netShown = st.n;
  hud();
  const out = m.lastOut || {};
  if (out.msg && st.n > 0) { if (out.foul) { toast(out.msg, true); sfx.foul(); } else toast(out.msg); }
  turn(true);
}

function netState(d) {
  const st = d.state;
  if (!st) return;
  net = st;
  netSkew = d.skew || 0;
  if (T) table.setCloth(clothColor()); // il panno della partita, non quello scelto su questo telefono
  hideSheetsFor(st);
  if (st.phase === 'waiting') { showWait(st); return; }
  if (!st.match) return;
  // colpo nuovo da animare (anche il mio, se non l'ho già animato)
  if (m && st.n === netShown + 1 && st.prev && st.last && (phase === 'watch' || phase === 'aim' || phase === 'sync' || phase === 'strike' || phase === 'shot')) {
    if (myShotSent && (phase === 'strike' || phase === 'shot')) { netAfter = st; myShotSent = false; return; }
    if (phase === 'sync') { myShotSent = false; adoptNet(st); return; }
    m = JSON.parse(JSON.stringify(st.prev));
    T = E.tableOf(m);
    const c = m.balls[E.cueId(m)];
    aim.angle = Math.atan2(st.last.input.dz, st.last.input.dx);
    aim.spinX = st.last.input.sx || 0; aim.spinY = st.last.input.sy || 0;
    if (typeof st.last.input.px === 'number') { c.x = st.last.input.px; c.z = st.last.input.pz; }
    pending = { input: st.last.input, power: toPower(st.last.input.speed) };
    strikeFrom = 0.04 + pending.power * 0.2; strikeT = 0; phase = 'strike';
    netAfter = st;
    hint();
    return;
  }
  if (phase === 'strike' || phase === 'shot') { if (st.n > netShown) netAfter = st; return; }
  if (!m || st.n !== netShown || phase === 'menu' || phase === 'wait' || phase === 'sync' || st.phase === 'finished') adoptNet(st);
  else hud();
}
function hideSheetsFor(st) {
  if (st.phase !== 'waiting') { $('wait').hidden = true; $('start').hidden = true; $('hud').hidden = false; }
}
function showWait(st) {
  phase = 'wait';
  $('start').hidden = true; $('hud').hidden = true; $('wait').hidden = false;
  const v = E.VARIANTS[st.variant];
  const cap = st.capacity || 2, missing = cap - st.players.length;
  $('waitT').textContent = `${v.name} online · sala ${st.number}` + (cap > 2 ? ` · a squadre, ${cap} giocatori` : '');
  $('waitS').textContent = missing > 0
    ? `Aspetto ${missing === 1 ? 'un giocatore' : missing + ' giocatori'}: la partita è negli avvisi e nella Lobby di Binottoland.` + (st.players.length >= 2 ? ' Chi l’ha creata può anche partire ora.' : '')
    : 'Pronti!';
  // squadre: ognuno sceglie la sua (il compagno), fino a 4 per squadra; i compagni tirano a turno nell'ordine di arrivo
  const esc = (s) => String(s).replace(/[<&>"]/g, '');
  const mine = st.players.find((p) => p.id === (me && me.player));
  if (cap > 2) {
    const team = (t) => st.players.filter((p) => (p.team ?? 0) === t);
    $('waitList').innerHTML = [0, 1].map((t) => `<li class="team"><b>Squadra ${t ? 'B' : 'A'}</b> (${team(t).length}/${E.MAX_TEAM}): ${team(t).map((p, k) => `${k + 1}. ${esc(p.name)}${p === mine ? ' (tu)' : ''}`).join(' · ') || '—'}</li>`).join('')
      + `<li class="muted">${E.EVERY_SHOT.includes(st.variant) ? 'I compagni si alternano a ogni colpo, in quest\u2019ordine.' : 'I compagni si alternano a ogni turno al tavolo, in quest\u2019ordine.'}</li>`;
  } else $('waitList').innerHTML = st.players.map((p) => `<li>${esc(p.name)}${p === mine ? ' (tu)' : ''}</li>`).join('');
  const other = mine ? 1 - (mine.team ?? 0) : 0;
  $('waitTeam').hidden = cap <= 2 || !mine;
  $('waitTeam').textContent = `Passa nella squadra ${other ? 'B' : 'A'}`;
  $('waitTeam').disabled = !!mine && st.players.filter((p) => (p.team ?? 0) === other).length >= E.MAX_TEAM;
  const owner = st.owner === (me && me.player);
  $('waitStart').hidden = !owner || st.players.length < 2;
  $('waitStart').textContent = missing > 0 ? `Parti ora (${st.players.length})` : 'Parti';
  $('waitLeave').textContent = owner ? 'Chiudi la partita' : 'Esci';
  // aperta dalla Lobby senza esserci dentro: si guarda, e si entra solo toccando «Entra»
  if (!mine) {
    $('waitS').textContent = missing > 0 ? 'Stai guardando. Tocca «Entra» per giocare.' : 'Stai guardando: la partita è al completo.';
    $('waitStart').hidden = missing <= 0;
    $('waitStart').textContent = 'Entra';
    $('waitLeave').textContent = 'Torna indietro';
  }
  if (!m || m.variant !== st.variant) { m = E.newGame(st.variant, [{ name: 'A' }, { name: 'B' }], {}); stage(m); }
}
const waitMine = () => !!(net && net.players.some((p) => p.id === (me && me.player)));
$('waitStart').onclick = () => toApp('action', { kind: waitMine() ? 'start' : 'join' });
$('waitTeam').onclick = () => { const mine = net && net.players.find((p) => p.id === (me && me.player)); if (mine) toApp('action', { kind: 'team', payload: { team: 1 - (mine.team ?? 0) } }); };
$('waitLeave').onclick = () => { if (!waitMine()) toApp('exit'); else toApp('action', { kind: net && net.owner === (me && me.player) ? 'close' : 'leave' }); };

addEventListener('message', (e) => {
  if (e.origin !== location.origin || e.source !== window.parent) return;
  const d = e.data;
  if (!d || typeof d.type !== 'string' || !d.type.startsWith('bil:')) return;
  if (d.type === 'bil:insets' && d.insets) setInsets(d.insets);
  else if (d.type === 'bil:back') { if (!$('menu').hidden || !m || phase === 'menu') toApp('exit'); else toggleMenu(); }
  else if (d.type === 'bil:identity' && typeof d.player === 'string') { me = { player: d.player, name: d.name }; cfg.n1 = cfg.n1 || d.name || ''; }
  else if (d.type === 'bil:state') netState(d);
  // rete persa o sessione scaduta: l'app lo ripete a ogni tentativo fallito, poi dice quando è tornata
  else if (d.type === 'bil:net') toast(d.message || '', !!d.lost);
  else if (d.type === 'bil:error') {
    toast(d.message || 'Errore', true);
    // il colpo non è stato accettato: si torna al tavolo del server
    if (myShotSent && net && net.match) { myShotSent = false; netAfter = null; adoptNet(net); }
  }
});

// conto alla rovescia del turno online
setInterval(() => {
  const el = $('timer');
  if (!net || net.phase !== 'playing' || !net.turnAt || phase === 'strike' || phase === 'shot') { el.hidden = true; return; }
  const left = Math.max(0, Math.round((net.turnAt - (Date.now() + netSkew)) / 1000));
  el.hidden = false; el.textContent = (myTurn() ? 'Il tuo tiro: ' : `${cur().name}: `) + left + ' s';
  el.classList.toggle('late', left <= 10);
}, 500);

// ---------- avvio ----------
showStart();
viewLabel();
// un solo menu: compare solo quando è pronto (online si aspetta la partita, senza menu)
if (onlineRoom) phase = 'wait';
else $('start').hidden = false;
preview();
toApp('ready');

// ---------- ciclo principale ----------
let last = performance.now();
const H = P.H;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  let rotDt = 0;

  if (phase === 'aim') {
    const k = (keys.Shift ? 0.0012 : 0.01) * cfg.sens;
    if (keys.ArrowLeft) aim.angle = wrap(aim.angle - k * dt * 60);
    if (keys.ArrowRight) aim.angle = wrap(aim.angle + k * dt * 60);
    if (charging) { chargeT += dt / 1.5; const t = chargeT % 2; aim.power = t < 1 ? t : 2 - t; }
  } else if (phase === 'cpuAim') cpuStep(dt);
  else if (phase === 'strike') {
    strikeT += dt;
    if (strikeT > 0.11) launch(pending.input, pending.power);
  } else if (phase === 'shot') {
    acc += dt; shotClock += dt;
    let n = 0;
    while (acc >= H && n < 10) { P.step(T, m.balls, m.pins, H, events); acc -= H; n++; rotDt += H; }
    if (n === 10) acc = 0;
    for (; evSeen < events.length; evSeen++) {
      const e = events[evSeen];
      if (e.t === 'ball') sfx.click(e.s);
      else if (e.t === 'rail') sfx.rail(e.s);
      else if (e.t === 'pin') { sfx.pin(e.s); haptic('impact', 'light'); }
      else if (e.t === 'pot') {
        sfx.pocket(e.s);
        falling.set(e.a, { x: e.x, y: m.balls[e.a].r, z: e.z, vx: e.vx, vz: e.vz, t: 0, p: T.pockets[e.p] });
      }
    }
    if ((!P.moving(m.balls) && falling.size === 0) || shotClock > 40) { for (const b of m.balls) b.vx = b.vz = b.ux = b.uz = b.side = 0; endShot(); }
  }
  // fruscio delle bilie che rotolano sul panno
  let rolling = 0;
  if (phase === 'shot') for (const b of m.balls) if (b.on) rolling += Math.sqrt(b.vx * b.vx + b.vz * b.vz);
  sfx.roll(rolling);

  for (const [id, f] of falling) {
    f.t += dt;
    const k = Math.min(1, dt * 9);
    f.x += (f.p.x - f.x) * k + f.vx * dt * 0.2;
    f.z += (f.p.z - f.z) * k + f.vz * dt * 0.2;
    f.y = T.R - 7.8 * f.t * f.t;
    if (f.y < -0.13) falling.delete(id);
  }

  if (m) {
    const c = cueBall();
    const inHandShow = m.inHand && phase !== 'shot' ? c.id : -1;
    table.syncBalls(m.balls, rotDt, falling, inHandShow);
    table.syncPins(m.pins, dt);
    const human = phase === 'aim';
    const aiming = human || phase === 'cpuAim' || phase === 'strike' || phase === 'watch';
    let pull = aim.power * 0.2 + 0.008, cx = c.x, cz = c.z;
    if (phase === 'strike') { const k = Math.min(1, strikeT / 0.11); pull = strikeFrom * (1 - k * k) - 0.004 * k; }
    if (phase === 'shot' && cueHideT > 0) { cueHideT -= dt; pull = -0.004 - (0.35 - cueHideT) * 0.05; cx = shotFrom.x; cz = shotFrom.z; }
    const cueVis = E.usesCue(m) && (c.on || m.inHand) && phase !== 'menu' && phase !== 'wait' && phase !== 'over' && (aiming || (phase === 'shot' && cueHideT > 0));
    table.placeCue(cx, cz, c.r, aim.angle, pull, aim.spinX, aim.spinY, cueVis);
    table.showAim((human || phase === 'cpuAim') ? aimGuide() : null);
    // anello dorato: bilia in mano, oppure il pallino da mettere nella bocciata d'acchito
    if (human && m.acchito) table.showHand(true, m.balls[0].x, m.balls[0].z, m.balls[0].r);
    else table.showHand(human && !!m.inHand, c.x, c.z, c.r);
    // palla 8: la buca chiamata per la nera (lampeggia finché non è scelta)
    const eight = (human || phase === 'cpuAim') && E.onEight(m);
    table.showCall(eight ? T.pockets[aim.call] || null : null, eight && aim.call < 0 ? T.pockets : null);
    table.kitchen.visible = !!m.inHand && (m.inHand === 'kitchen' || m.inHand === 'throw') && aiming;
    if (aiming && phase !== 'watch') table.follow(c.x, c.z, aim.angle);
  }
  const fill = pw.querySelector('.fill'), knob = pw.querySelector('.knob');
  fill.style.height = aim.power * 100 + '%'; knob.style.top = aim.power * 100 + '%';
  $('powPct').textContent = aim.power > 0.005 ? Math.round(aim.power * 100) + '%' : '';
  pw.setAttribute('aria-valuenow', String(Math.round(aim.power * 100)));
  table.render(dt);
}
requestAnimationFrame(frame);

// per provare dalla console
window.biliardo = { table, E, P, get m() { return m; }, get phase() { return phase; }, aim, shoot: (p) => shoot(p), newGame: (v, mode) => { if (v) cfg.variant = v; if (mode) cfg.mode = mode; newGame(); } };
