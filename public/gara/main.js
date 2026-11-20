// Gara a quadretti: collega disegno, regole e scena 3D.
// Per ora si gioca sullo stesso telefono: Giallo è l'ospite (mette l'auto e muove per primo), Rosso chi crea la pista.
import { Editor } from './editor.js';
import * as R from './rules.js';
import { Race3D } from './scene3d.js';
import { Sfx } from './sound.js';

// suoni: il browser li accende solo dopo un tocco
const sfx = new Sfx();
document.addEventListener('pointerdown', () => sfx.unlock(), { capture: true });
const sndLabel = () => { const b = document.getElementById('snd'); if (b) { b.textContent = sfx.on ? '🔊' : '🔇'; b.setAttribute('aria-label', sfx.on ? 'Togli audio' : 'Metti audio'); } };
addEventListener('DOMContentLoaded', sndLabel);

const $ = (id) => document.getElementById(id);

// ---------- margini di Telegram e del telefono ----------
const tg = window.Telegram && window.Telegram.WebApp;
function insets() {
  if (!tg || !tg.initData) return;
  const a = tg.safeAreaInset || {}, b = tg.contentSafeAreaInset || {}, s = document.documentElement.style;
  s.setProperty('--st', (a.top || 0) + (b.top || 0) + 'px');
  s.setProperty('--sb', (a.bottom || 0) + (b.bottom || 0) + 'px');
  s.setProperty('--sl', (a.left || 0) + (b.left || 0) + 'px');
  s.setProperty('--sr', (a.right || 0) + (b.right || 0) + 'px');
}
if (tg) {
  tg.ready(); tg.expand();
  tg.disableVerticalSwipes && tg.disableVerticalSwipes();
  tg.onEvent && ['safeAreaChanged', 'contentSafeAreaChanged', 'viewportChanged'].forEach((e) => tg.onEvent(e, insets));
  insets();
}

let toastT = 0;
function toast(msg, ok) {
  const t = $('toast');
  t.textContent = msg; t.classList.toggle('ok', !!ok); t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), ok ? 1600 : 3200);
}

// ---------- disegno ----------
const ed = new Editor($('c2'));
const draft = { outer: null, inner: null, finish: null, normal: -1, laps: 3, players: 2, time: 'day' };

// ora della gara: giorno, tramonto, notte
for (const b of document.querySelectorAll('[data-t]')) b.onclick = () => {
  draft.time = b.dataset.t;
  for (const o of document.querySelectorAll('[data-t]')) o.classList.toggle('on', o === b);
};
let step = 1;
const widthTxt = () => String(R.minWidth(draft.players)).replace('.', ',');

const HELP = {
  1: () => 'Per una pista grande allontana prima la vista (−). Poi disegna col dito il bordo esterno e finisci vicino al punto di partenza.',
  2: () => `Ora disegna il bordo interno, tutto dentro quello esterno. Lascia almeno ${widthTxt()} caselle di asfalto.`,
  3: () => `Traccia la linea di partenza da un bordo all'altro: deve avere posto per ${draft.players} auto affiancate. Verde va bene, rossa no.`,
  4: () => 'Tocca la freccia del verso di gara e scegli quanti giri.'
};

// ---------- scelta iniziale: quante auto ----------
function setupInfo() {
  const n = draft.players;
  $('carN').textContent = n;
  $('carDots').innerHTML = R.carColors(n).map((c) => `<span style="--c:${c.hex}">${c.num}</span>`).join('');
  $('setupInfo').textContent = `Griglia quasi infinita: la vista parte larga ${R.startCells(n)} caselle. La pista va bene se sulla linea di partenza ci stanno ${n} auto affiancate.`;
}
$('carM').onclick = () => { draft.players = Math.max(2, draft.players - 1); setupInfo(); };
$('carP').onclick = () => { draft.players = Math.min(R.MAX_CARS, draft.players + 1); setupInfo(); };
$('startDraw').onclick = () => {
  $('setup').hidden = true;
  ed.setBoard(R.boardSize());
  ed.setZoom(R.startCells(draft.players));
  setStep(1); syncZoom();
};
setupInfo();

function setStep(n) {
  step = n;
  ed.mode = ['outer', 'outer', 'inner', 'finish', 'dir'][n];
  $('edStep').textContent = `Passo ${n} di 4`;
  $('edHelp').textContent = HELP[n]();
  $('laps').hidden = n !== 4;
  $('go').hidden = n !== 4;
  ed.outer = draft.outer; ed.inner = draft.inner; ed.finish = draft.finish; ed.normalIdx = draft.normal;
  ed.draw();
}

// cursore dello zoom a scala: a sinistra poche caselle, a destra tutta la griglia
const ZMIN = 10;
const zoomToCells = (v) => ZMIN * Math.pow(ed.board / ZMIN, v / 1000);
const cellsToZoom = (c) => Math.round((1000 * Math.log(c / ZMIN)) / Math.log(ed.board / ZMIN));
function syncZoom() {
  $('zoom').value = Math.max(0, Math.min(1000, cellsToZoom(Math.max(ZMIN, ed.cellsAcross()))));
  $('edCells').textContent = `${ed.cellsAcross()} × ${Math.round(ed.h / ed.s)} caselle`;
}
ed.onZoom = syncZoom;
$('zoom').addEventListener('input', (e) => { ed.setZoom(zoomToCells(+e.target.value)); syncZoom(); });
$('zOut').onclick = () => { ed.zoomAt(ed.w / 2, ed.h / 2, 0.8); };
$('zIn').onclick = () => { ed.zoomAt(ed.w / 2, ed.h / 2, 1.25); };
$('fit').onclick = () => { if (draft.outer) ed.fit(); else { ed.cx = ed.cy = ed.board / 2; ed.draw(); } syncZoom(); };

ed.finishCheck = (pts) => {
  const r = R.makeFinish(pts, draft.outer, draft.inner);
  if (r.error) return null;
  return { finish: r.finish, cap: R.finishCapacity(draft.outer, draft.inner, r.finish), need: draft.players };
};

ed.onStroke = (pts) => {
  ed.error = null;
  if (step === 1) {
    const r = R.closeBorder(pts);
    if (r.error) return fail(r);
    draft.outer = r.poly; toast('Bordo esterno ok', true); setStep(2);
  } else if (step === 2) {
    const r = R.closeBorder(pts);
    if (r.error) return fail(r);
    const c = R.checkInner(draft.outer, r.poly, R.minWidth(draft.players));
    if (c.error) return fail(c);
    draft.inner = r.poly; toast('Bordo interno ok', true); setStep(3);
  } else if (step === 3) {
    const r = R.makeFinish(pts, draft.outer, draft.inner);
    if (r.error) return fail(r);
    const cap = R.finishCapacity(draft.outer, draft.inner, r.finish);
    if (cap < draft.players) return fail({ error: `Sulla linea ci stanno ${cap} auto, ne servono ${draft.players}. Tracciala dove la pista è più larga.`, at: { x: (r.finish.a.x + r.finish.b.x) / 2, y: (r.finish.a.y + r.finish.b.y) / 2 } });
    draft.finish = r.finish; draft.normal = -1; setStep(4);
  }
};
function fail(r) { ed.error = r; ed.draw(); toast(r.error); }

ed.onArrow = (i) => {
  const cap = R.capacityFor(draft.outer, draft.inner, draft.finish, R.finishNormals(draft.finish)[i]);
  if (cap < draft.players) { toast(`In questo verso sulla linea ci stanno ${cap} auto, ne servono ${draft.players}.`); return false; }
  draft.normal = i;
};

$('undo').onclick = () => {
  ed.error = null;
  if (step === 4) { draft.finish = null; draft.normal = -1; setStep(3); }
  else if (step === 3) { draft.inner = null; setStep(2); }
  else if (step === 2) { draft.outer = null; setStep(1); }
  else ed.draw();
};
const showLaps = () => { $('lapN').textContent = draft.laps; };
$('lapM').onclick = () => { draft.laps = Math.max(1, draft.laps - 1); showLaps(); };
$('lapP').onclick = () => { draft.laps = Math.min(9, draft.laps + 1); showLaps(); };

$('go').onclick = () => {
  if (draft.normal < 0) return toast('Prima tocca una delle due frecce: è il verso di gara.');
  // controllo finale di tutta la pista prima del 3D
  const c = R.checkInner(draft.outer, draft.inner, R.minWidth(draft.players));
  if (c.error) return fail(c);
  const n = R.finishNormals(draft.finish)[draft.normal];
  const b = R.buildTrack(draft.outer, draft.inner, draft.finish, n, draft.players);
  if (b.error) return fail(b);
  startRace(b.track, draft.laps, draft.players);
};

// ---------- gara ----------
let scene = null, race = null, busy = false, lastTrack = null, lastLaps = 3, lastN = 2;
let COL = R.carColors(2);

function show(id) { for (const s of document.querySelectorAll('.screen')) s.classList.toggle('on', s.id === id); }

async function startRace(track, laps, n) {
  lastTrack = track; lastLaps = laps; lastN = n;
  show('rc');
  if (!scene) { scene = new Race3D($('gl')); scene.onPick = pick; }
  scene.resize();
  scene.onViewChange = () => { $('view').textContent = 'Vista alta'; };
  scene.build(track, draft.time);
  await scene.ready;
  race = R.newRace(track, laps, n);
  COL = race.colors;
  scene.setCars(race, COL);
  busy = false;
  $('over').hidden = true;
  refresh();
}

// barra in alto: l'auto di turno per esteso, le altre compatte (numero, marcia, fermo)
function chips() {
  $('chips').innerHTML = race.cars.map((c, i) => {
    const col = COL[i], lap = Math.min(race.laps, R.currentLap(c)), turn = i === race.turn && race.phase !== 'over';
    const st = c.crash ? ` · fermo ${c.crash}` : '';
    if (!turn) return `<div class="chip" style="--c:${col.hex}"><span class="dot"></span>${col.num} <span class="g">${c.gear ? c.gear : 'N'}</span>${c.crash ? ' <span class="muted">✕' + c.crash + '</span>' : ''}</div>`;
    return `<div class="chip turn" style="--c:${col.hex}"><span class="dot"></span>${col.num} ${col.name} <span class="g">${c.gear ? c.gear : 'N'}</span> <span class="muted">giro ${lap}/${race.laps}${st}</span></div>`;
  }).join('');
  const box = $('chips'), t = box.querySelector('.turn');
  if (t) box.scrollLeft = t.offsetLeft - box.clientWidth / 2 + t.offsetWidth / 2;
  document.documentElement.style.setProperty('--topH', $('rcTop').offsetHeight + 'px');
}

function refresh() {
  chips();
  const car = race.cars[race.turn], col = COL[race.turn];
  if (race.phase === 'place') {
    $('rcHelp').textContent = `${col.num} ${col.name} (${col.role}): tocca una casella bianca sulla linea per mettere l'auto.`;
    $('legend').hidden = true;
    scene.showMarks(R.placeable(race).map((s) => ({ ...s, kind: 'slot' })));
    if (!refresh.placed) {
      const f = race.track.finish;
      scene.focus({ x: (f.a.x + f.b.x) / 2, y: (f.a.y + f.b.y) / 2 }, true);
      refresh.placed = true;
    }
    return;
  }
  if (race.phase === 'over') return;
  $('legend').hidden = false;
  chosen = null;
  helpTurn();
  let opts = R.options(race);
  if (!opts.length) opts = [{ x: car.pos.x + car.dir.x, y: car.pos.y + car.dir.y, gear: 1, crash: true, stop: { ...car.pos } }];
  race.opts = opts;
  scene.showMarks(opts.map((o) => ({
    ...o,
    kind: o.crash ? 'crash' : car.gear === 0 || o.gear === car.gear ? 'same' : o.gear < car.gear ? 'down' : 'up',
    txt: String(o.gear)
  })));
  // telecamera a metà tra l'auto e i dischi, così si vede tutto
  const cx = opts.reduce((s, o) => s + o.x, 0) / opts.length, cy = opts.reduce((s, o) => s + o.y, 0) / opts.length;
  scene.focus({ x: (car.pos.x + cx) / 2, y: (car.pos.y + cy) / 2 }, race.moves === 0);
}

// la legenda sta sempre sotto la barra in alto, anche quando il testo va su due righe
new ResizeObserver(() => document.documentElement.style.setProperty('--topH', $('rcTop').offsetHeight + 'px')).observe($('rcTop'));

let chosen = null; // mossa scelta col primo tocco, in attesa di conferma

function helpTurn() {
  const col = COL[race.turn];
  $('rcHelp').textContent = `Tocca a ${col.num} ${col.name}: scegli dove andare.`;
}

async function pick(mark) {
  if (busy || !race) return;
  if (!mark) {
    // tocco fuori dai dischi: annulla la scelta
    if (chosen) { chosen = null; scene.clearPreview(); helpTurn(); }
    return;
  }
  if (race.phase === 'place') {
    const r = R.placeCar(race, mark);
    if (r.error) return banner(r.error);
    const car = race.cars.find((c) => c.pos && c.pos.x === mark.x && c.pos.y === mark.y);
    scene.placeCar(car.id, car.pos, race.track.normal);
    sfx.tick(true);
    refresh.placed = race.phase === 'race' ? false : refresh.placed;
    refresh();
    return;
  }
  if (race.phase !== 'race') return;
  const opt = race.opts.find((o) => o.x === mark.x && o.y === mark.y);
  if (!opt) return;
  // primo tocco: anteprima. Secondo tocco sullo stesso disco: si parte.
  if (chosen !== opt) {
    chosen = opt;
    sfx.tick(!opt.crash);
    const car = race.cars[race.turn];
    scene.showPreview(race.turn, car.pos, opt);
    $('rcHelp').textContent = opt.crash
      ? `Attenzione: così esci di pista e resti fermo 2 turni. Tocca di nuovo la ✕ per confermare.`
      : `Marcia ${opt.gear}. Tocca di nuovo il disco per partire, oppure scegline un altro.`;
    return;
  }
  chosen = null;
  busy = true;
  scene.clearMarks();
  $('rcHelp').textContent = '';
  const i = race.turn, car = race.cars[i], from = { ...car.pos }, prevGear = car.gear;
  const ev = R.applyMove(race, opt);
  if (opt.crash || opt.gear < prevGear) scene.skid(from, car.pos);
  const lap = car.path[car.path.length - 1].lap;
  // suoni: motore per tutta la mossa, gomme se si scala, botto all'arrivo se si sbatte, bip se si passa la linea
  const ms = 260 + Math.max(1, Math.hypot(car.pos.x - from.x, car.pos.y - from.y)) * 70;
  sfx.engine(opt.crash ? Math.max(1, prevGear) : opt.gear, ms);
  if (opt.crash || opt.gear < prevGear) sfx.skid(ms);
  if (opt.crash) setTimeout(() => sfx.crash(), ms);
  if (ev.some((e) => e.type === 'line')) setTimeout(() => sfx.line(), ms * 0.6);
  await scene.moveCar(i, from, car.pos, { x: opt.x - from.x, y: opt.y - from.y }, opt.crash);
  scene.addTrail(i, from, car.pos, lap);
  scene.setGear(i, car.gear);
  scene.trailFade(i, R.currentLap(car));
  chips();
  for (const e of ev) {
    const c = COL[e.car];
    if (e.type === 'crash') await banner(`<div class="t" style="color:#fca5a5">Urto!</div>${c.name} fermo per 2 turni<div class="pips" style="color:${c.hex}">● ●</div>`, 1700);
    else if (e.type === 'line' && race.cars[e.car].progress > 1) await banner(`<div class="t">Giro ${Math.min(race.laps, race.cars[e.car].progress)} di ${race.laps}</div>${c.name}`, 1100);
    else if (e.type === 'lineBack') await banner(`${c.name} ha passato la linea al contrario: il giro non conta.`, 1500);
    else if (e.type === 'skip') {
      sfx.skip();
      scene.focus(race.cars[e.car].pos);
      if (e.turned) { await Promise.all([scene.turnCar(e.car, race.cars[e.car].dir), banner(`${c.name} salta il turno<br>e si gira verso la pista`, 1400)]); }
      else await banner(`${c.name} salta il turno<div class="pips" style="color:${c.hex}">○ ●</div>`, 1300);
      chips();
    } else if (e.type === 'win') { win(e.car); busy = false; return; }
  }
  busy = false;
  refresh();
}

let bannerT = 0;
function banner(html, ms = 1600) {
  const b = $('banner');
  b.innerHTML = html; b.classList.add('show');
  clearTimeout(bannerT);
  return new Promise((res) => { bannerT = setTimeout(() => { b.classList.remove('show'); setTimeout(res, 200); }, ms); });
}

function win(i) {
  sfx.win();
  chips();
  scene.clearMarks();
  $('legend').hidden = true;
  const c = COL[i];
  $('winT').textContent = `Vince l'auto ${c.num} · ${c.name}`;
  $('winT').style.color = c.hex;
  $('winS').textContent = `${race.laps} ${race.laps === 1 ? 'giro' : 'giri'} · ${race.cars[i].moves} mosse`;
  scene.focus(race.cars[i].pos, true);
  setTimeout(() => { $('over').hidden = false; }, 700);
}

$('grid').onclick = (e) => { const on = !e.target.classList.contains('on'); e.target.classList.toggle('on', on); scene.setGrid(on); };
$('view').onclick = (e) => { const top = scene.view !== 'top'; scene.setView(top ? 'top' : 'tilt'); e.target.textContent = top ? 'Vista inclinata' : 'Vista alta'; };
$('center').onclick = () => { const c = race && race.cars[race.turn]; if (c && c.pos) scene.focus(c.pos, true); else if (race) scene.focus(race.track.startSlots[0], true); };
$('menuB').onclick = () => { $('menu').hidden = false; };
$('snd').onclick = () => { sfx.unlock(); sfx.setOn(!sfx.on); sndLabel(); if (sfx.on) sfx.tick(true); };
sndLabel();
$('close').onclick = () => { $('menu').hidden = true; };
const again = () => { $('menu').hidden = true; refresh.placed = false; startRace(lastTrack, lastLaps, lastN); };
$('again').onclick = again; $('again2').onclick = again;
const newTrack = () => {
  $('menu').hidden = true; $('over').hidden = true;
  draft.outer = draft.inner = draft.finish = null; draft.normal = -1; ed.error = null;
  show('ed'); ed.resize(); setStep(1); setupInfo(); $('setup').hidden = false;
};
$('newT').onclick = newTrack; $('newT2').onclick = newTrack;

// avvio
setStep(1);
ed.setBoard(R.boardSize()); ed.resize(); ed.setZoom(R.startCells(draft.players)); syncZoom();
window.__gara = { draft, ed, R, startRace, get race() { return race; }, get scene() { return scene; }, pick };
