// Gara a quadretti: collega disegno, regole e scena 3D.
// Per ora si gioca sullo stesso telefono: Giallo è l'ospite (mette l'auto e muove per primo), Rosso chi crea la pista.
import { Editor } from './editor.js';
import * as R from './rules.js';
import { Race3D } from './scene3d.js';

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
const draft = { outer: null, inner: null, finish: null, normal: -1, laps: 3 };
let step = 1;

const HELP = {
  1: 'Per una pista grande allontana prima la vista (−). Poi disegna col dito il bordo esterno e finisci vicino al punto di partenza.',
  2: 'Ora disegna il bordo interno, tutto dentro quello esterno. Lascia almeno 3 caselle di asfalto.',
  3: 'Traccia la linea di partenza: un tratto che va dal bordo interno a quello esterno.',
  4: 'Tocca la freccia del verso di gara e scegli quanti giri.'
};

function setStep(n) {
  step = n;
  ed.mode = ['outer', 'outer', 'inner', 'finish', 'dir'][n];
  $('edStep').textContent = `Passo ${n} di 4`;
  $('edHelp').textContent = HELP[n];
  $('laps').hidden = n !== 4;
  $('go').hidden = n !== 4;
  ed.outer = draft.outer; ed.inner = draft.inner; ed.finish = draft.finish; ed.normalIdx = draft.normal;
  ed.draw();
}

function syncZoom() {
  $('zoom').value = Math.min(160, Math.max(14, ed.cellsAcross()));
  $('edCells').textContent = `${ed.cellsAcross()} × ${Math.round(ed.h / ed.s)} caselle`;
}
ed.onZoom = syncZoom;
$('zoom').addEventListener('input', (e) => { ed.setZoom(+e.target.value); syncZoom(); });
$('zOut').onclick = () => { ed.zoomAt(ed.w / 2, ed.h / 2, 0.8); };
$('zIn').onclick = () => { ed.zoomAt(ed.w / 2, ed.h / 2, 1.25); };
$('fit').onclick = () => { if (draft.outer) ed.fit(); else { ed.cx = ed.cy = 80; ed.draw(); } syncZoom(); };

ed.onStroke = (pts) => {
  ed.error = null;
  if (step === 1) {
    const r = R.closeBorder(pts);
    if (r.error) return fail(r);
    draft.outer = r.poly; toast('Bordo esterno ok', true); setStep(2);
  } else if (step === 2) {
    const r = R.closeBorder(pts);
    if (r.error) return fail(r);
    const c = R.checkInner(draft.outer, r.poly);
    if (c.error) return fail(c);
    draft.inner = r.poly; toast('Bordo interno ok', true); setStep(3);
  } else if (step === 3) {
    const r = R.makeFinish(pts, draft.outer, draft.inner);
    if (r.error) return fail(r);
    draft.finish = r.finish; draft.normal = -1; setStep(4);
  }
};
function fail(r) { ed.error = r; ed.draw(); toast(r.error); }

ed.onArrow = (i) => { draft.normal = i; };

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
  const c = R.checkInner(draft.outer, draft.inner);
  if (c.error) return fail(c);
  const n = R.finishNormals(draft.finish)[draft.normal];
  const b = R.buildTrack(draft.outer, draft.inner, draft.finish, n);
  if (b.error) return fail(b);
  startRace(b.track, draft.laps);
};

// ---------- gara ----------
let scene = null, race = null, busy = false, lastTrack = null, lastLaps = 3;

function show(id) { for (const s of document.querySelectorAll('.screen')) s.classList.toggle('on', s.id === id); }

function startRace(track, laps) {
  lastTrack = track; lastLaps = laps;
  show('rc');
  if (!scene) { scene = new Race3D($('gl')); scene.onPick = pick; }
  scene.resize();
  scene.build(track);
  race = R.newRace(track, laps);
  scene.setCars(race, R.COLORS);
  busy = false;
  $('over').hidden = true;
  refresh();
}

function chips() {
  $('chips').innerHTML = race.cars.map((c, i) => {
    const col = R.COLORS[i], lap = Math.min(race.laps, R.currentLap(c));
    const st = c.crash ? ` · fermo ${c.crash}` : '';
    return `<div class="chip ${i === race.turn && race.phase !== 'over' ? 'turn' : ''}" style="--c:${col.hex}"><span class="dot"></span>${col.name} <span class="g">${c.gear ? c.gear : 'N'}</span> <span class="muted">giro ${lap}/${race.laps}${st}</span></div>`;
  }).join('');
  document.documentElement.style.setProperty('--topH', $('rcTop').offsetHeight + 'px');
}

function refresh() {
  chips();
  const car = race.cars[race.turn], col = R.COLORS[race.turn];
  if (race.phase === 'place') {
    $('rcHelp').textContent = `${col.name} (${col.role}): tocca una casella bianca sulla linea per mettere l'auto.`;
    $('legend').hidden = true;
    const other = race.cars.find((c) => c.pos);
    scene.showMarks(race.track.startSlots.filter((s) => !other || Math.hypot(other.pos.x - s.x, other.pos.y - s.y) >= 1.5).map((s) => ({ ...s, kind: 'slot' })));
    if (!refresh.placed) { scene.focus(race.track.startSlots[0], true); refresh.placed = true; }
    return;
  }
  if (race.phase === 'over') return;
  $('legend').hidden = false;
  $('rcHelp').textContent = `Tocca a ${col.name}: scegli dove andare.`;
  let opts = R.options(race);
  if (!opts.length) opts = [{ x: car.pos.x + car.dir.x, y: car.pos.y + car.dir.y, gear: 1, crash: true, stop: { ...car.pos } }];
  race.opts = opts;
  scene.showMarks(opts.map((o) => ({
    ...o,
    kind: o.crash ? 'crash' : car.gear === 0 || o.gear === car.gear ? 'same' : o.gear < car.gear ? 'down' : 'up',
    txt: String(o.gear)
  })));
  scene.focus(car.pos);
}

async function pick(mark) {
  if (busy || !race || !mark) return;
  if (race.phase === 'place') {
    const r = R.placeCar(race, mark);
    if (r.error) return banner(r.error);
    const car = race.cars.find((c) => c.pos && c.pos.x === mark.x && c.pos.y === mark.y);
    scene.placeCar(car.id, car.pos, car.dir);
    refresh.placed = race.phase === 'race' ? false : refresh.placed;
    refresh();
    return;
  }
  if (race.phase !== 'race') return;
  const opt = race.opts.find((o) => o.x === mark.x && o.y === mark.y);
  if (!opt) return;
  busy = true;
  scene.clearMarks();
  $('rcHelp').textContent = '';
  const i = race.turn, car = race.cars[i], from = { ...car.pos };
  const ev = R.applyMove(race, opt);
  const lap = car.path[car.path.length - 1].lap;
  await scene.moveCar(i, from, car.pos, { x: opt.x - from.x, y: opt.y - from.y }, opt.crash);
  scene.addTrail(i, from, car.pos, lap);
  scene.setGear(i, car.gear);
  scene.trailFade(i, R.currentLap(car));
  chips();
  for (const e of ev) {
    const c = R.COLORS[e.car];
    if (e.type === 'crash') await banner(`<div class="t" style="color:#fca5a5">Urto!</div>${c.name} fermo per 2 turni<div class="pips" style="color:${c.hex}">● ●</div>`, 1700);
    else if (e.type === 'line' && race.cars[e.car].progress > 1) await banner(`<div class="t">Giro ${Math.min(race.laps, race.cars[e.car].progress)} di ${race.laps}</div>${c.name}`, 1100);
    else if (e.type === 'lineBack') await banner(`${c.name} ha passato la linea al contrario: il giro non conta.`, 1500);
    else if (e.type === 'skip') {
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
  chips();
  scene.clearMarks();
  $('legend').hidden = true;
  const c = R.COLORS[i];
  $('winT').textContent = `Vince il ${c.name}`;
  $('winT').style.color = c.hex;
  $('winS').textContent = `${race.laps} ${race.laps === 1 ? 'giro' : 'giri'} · ${race.cars[i].moves} mosse`;
  scene.focus(race.cars[i].pos, true);
  setTimeout(() => { $('over').hidden = false; }, 700);
}

$('grid').onclick = (e) => { const on = !e.target.classList.contains('on'); e.target.classList.toggle('on', on); scene.setGrid(on); };
$('view').onclick = (e) => { const top = scene.view !== 'top'; scene.setView(top ? 'top' : 'tilt'); e.target.textContent = top ? 'Vista inclinata' : 'Vista alta'; };
$('center').onclick = () => { const c = race && race.cars[race.turn]; if (c && c.pos) scene.focus(c.pos, true); else if (race) scene.focus(race.track.startSlots[0], true); };
$('menuB').onclick = () => { $('menu').hidden = false; };
$('close').onclick = () => { $('menu').hidden = true; };
const again = () => { $('menu').hidden = true; refresh.placed = false; startRace(lastTrack, lastLaps); };
$('again').onclick = again; $('again2').onclick = again;
const newTrack = () => {
  $('menu').hidden = true; $('over').hidden = true;
  draft.outer = draft.inner = draft.finish = null; draft.normal = -1; ed.error = null;
  show('ed'); setStep(1); requestAnimationFrame(() => { ed.resize(); syncZoom(); });
};
$('newT').onclick = newTrack; $('newT2').onclick = newTrack;

// avvio
setStep(1);
ed.resize(); ed.setZoom(40); syncZoom();
window.__gara = { draft, ed, R, startRace, get race() { return race; }, get scene() { return scene; }, pick };
