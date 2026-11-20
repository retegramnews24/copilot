// Gara a quadretti: collega disegno, regole e scena 3D.
// Per ora si gioca sullo stesso telefono: Giallo è l'ospite (mette l'auto e muove per primo), Rosso chi crea la pista.
import { Editor } from './editor.js';
import * as R from './rules.js';
import { Race3D } from './scene3d.js';
import { Sfx } from './sound.js';
import { AiDriver, distField } from './ai.js';
import { Tutorial } from './tutorial.js';

// suoni: il browser li accende solo dopo un tocco
const sfx = new Sfx();
document.addEventListener('pointerdown', () => sfx.unlock(), { capture: true });
const sndLabel = () => { const b = document.getElementById('snd'); if (b) { b.textContent = sfx.on ? '🔊' : '🔇'; b.setAttribute('aria-label', sfx.on ? 'Togli audio' : 'Metti audio'); } };
addEventListener('DOMContentLoaded', sndLabel);

const $ = (id) => document.getElementById(id);
// tutorial a fumetti (la prima volta, poi si può rifare)
const tut = new Tutorial($('tut'));

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
  const v = (n) => tg.isVersionAtLeast && tg.isVersionAtLeast(n);
  tg.ready(); tg.expand();
  if (v('7.7')) tg.disableVerticalSwipes(); // trascinare il dito per disegnare non deve chiudere la mini app
  tg.onEvent && ['safeAreaChanged', 'contentSafeAreaChanged', 'viewportChanged', 'fullscreenChanged'].forEach((e) => tg.onEvent(e, insets));
  // colori della barra di Telegram uguali al gioco
  if (v('6.1')) { tg.setHeaderColor('#0f172a'); tg.setBackgroundColor('#0f172a'); }
  if (v('7.10')) tg.setBottomBarColor('#0f172a');
  // sul telefono a tutto schermo: la pista si vede meglio (i margini li danno safeAreaInset e contentSafeAreaInset)
  if (v('8.0') && /android|ios/.test(tg.platform || '')) { try { tg.requestFullscreen(); } catch (e) { /* non supportato: resta così */ } }
  insets();
  // vibrazione leggera con i suoni principali
  const hf = v('6.1') && tg.HapticFeedback;
  if (hf) {
    const wrap = (name, fn) => { const o = sfx[name].bind(sfx); sfx[name] = (...a) => { try { fn(...a); } catch (e) { /* niente */ } return o(...a); }; };
    wrap('tick', () => hf.selectionChanged());
    wrap('crash', () => hf.notificationOccurred('error'));
    wrap('light', (green) => hf.impactOccurred(green ? 'heavy' : 'light'));
    wrap('line', () => hf.impactOccurred('medium'));
    wrap('win', () => hf.notificationOccurred('success'));
  }
}

let toastT = 0;
function toast(msg, ok) {
  const t = $('toast');
  t.textContent = msg; t.classList.toggle('ok', !!ok); t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), ok ? 1600 : 3200);
}

// ---------- disegno ----------
const ed = new Editor($('c2'));
const draft = { outer: null, inner: null, finish: null, normal: -1, laps: 3, players: 2, time: 'day', mode: 'ai' };

// modalità: contro l'IA (una tua auto e una dell'IA, mosse insieme) oppure tutti sullo stesso telefono a turno
for (const b of document.querySelectorAll('[data-m]')) b.onclick = () => {
  draft.mode = b.dataset.m;
  for (const o of document.querySelectorAll('[data-m]')) o.classList.toggle('on', o === b);
  if (draft.mode === 'ai') draft.players = 2;
  setupInfo();
};

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
  const n = draft.players, ai = draft.mode === 'ai';
  $('carRow').hidden = ai;
  $('modeInfo').textContent = ai
    ? 'Una tua auto contro una dell’IA. Muovete nello stesso momento: tu scegli, l’IA sceglie, e le auto partono insieme.'
    : 'Giocate tutti sullo stesso telefono, a turno.';
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
tut.show('setup');

function setStep(n) {
  step = n;
  ed.mode = ['outer', 'outer', 'inner', 'finish', 'dir'][n];
  $('edStep').textContent = `Passo ${n} di 4`;
  $('edHelp').textContent = HELP[n]();
  if ($('setup').hidden) tut.show('draw' + n);
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
  tut.show('create3d');
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
  tut.hide();
  if (draft.normal < 0) return toast('Prima tocca una delle due frecce: è il verso di gara.');
  // controllo finale di tutta la pista prima del 3D
  const c = R.checkInner(draft.outer, draft.inner, R.minWidth(draft.players));
  if (c.error) return fail(c);
  const n = R.finishNormals(draft.finish)[draft.normal];
  const b = R.buildTrack(draft.outer, draft.inner, draft.finish, n, draft.players);
  if (b.error) return fail(b);
  startRace(b.track, draft.laps, draft.players, draft.mode);
};

// ---------- gara ----------
let scene = null, race = null, busy = false, lastTrack = null, lastLaps = 3, lastN = 2, lastMode = 'ai';
let COL = R.carColors(2);
let driver = null; // pilota dell'IA
const isAi = () => race && race.mode === 'ai';

function show(id) { for (const s of document.querySelectorAll('.screen')) s.classList.toggle('on', s.id === id); }

// qualità grafica, ricordata dal browser
let quality = 'alta';
try { quality = localStorage.getItem('gara.qualita') || 'alta'; } catch (e) { /* niente memoria: alta */ }
const qButtons = () => { for (const b of document.querySelectorAll('[data-q]')) b.classList.toggle('on', b.dataset.q === quality); };
for (const b of document.querySelectorAll('[data-q]')) b.onclick = () => {
  quality = b.dataset.q; qButtons();
  try { localStorage.setItem('gara.qualita', quality); } catch (e) { /* niente */ }
  if (scene) scene.setQuality(quality);
};
qButtons();

async function startRace(track, laps, n, mode = 'local') {
  lastTrack = track; lastLaps = laps; lastN = n; lastMode = mode;
  if (mode === 'ai') n = 2;
  show('rc');
  if (!scene) { scene = new Race3D($('gl')); scene.onPick = pick; scene.setQuality(quality); scene.setTalkElement($('talk')); }
  scene.resize();
  scene.onViewChange = () => { $('view').textContent = 'Vista alta'; };
  scene.build(track, draft.time);
  await scene.ready;
  race = R.newRace(track, laps, n);
  race.mode = mode;
  COL = race.colors;
  if (mode === 'ai') {
    COL = race.colors = [{ ...COL[0], name: 'Tu', role: 'tu' }, { ...COL[1], name: 'IA', role: 'IA' }];
    driver = new AiDriver(track, laps);
  } else driver = null;
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
    // con una mossa scelta al primo tocco, la marcia mostrata è già quella nuova
    const gv = c.gear;
    if (!turn && !isAi()) return `<div class="chip" style="--c:${col.hex}"><span class="dot"></span>${col.num} <span class="g">${gv ? gv : 'N'}</span>${c.crash ? ' <span class="muted">✕' + c.crash + '</span>' : ''}</div>`;
    return `<div class="chip ${turn ? 'turn' : ''}" style="--c:${col.hex}"><span class="dot"></span>${col.num} ${col.name} <span class="g">${gv ? gv : 'N'}</span> <span class="muted">giro ${lap}/${race.laps}${st}</span></div>`;
  }).join('');
  const box = $('chips'), t = box.querySelector('.turn');
  if (t) box.scrollLeft = t.offsetLeft - box.clientWidth / 2 + t.offsetWidth / 2;
  setTopH();
}

function refresh() {
  chips();
  const car = race.cars[race.turn], col = COL[race.turn];
  if (race.phase === 'place') {
    $('rcHelp').textContent = isAi()
      ? 'Tocca una casella bianca sulla linea per mettere la tua auto: poi l’IA mette la sua.'
      : `${col.num} ${col.name} (${col.role}): tocca una casella bianca sulla linea per mettere l'auto.`;
    scene.showMarks(R.placeable(race).map((s) => ({ ...s, kind: 'slot' })));
    tut.show('place');
    if (!refresh.placed) {
      const f = race.track.finish;
      scene.focus({ x: (f.a.x + f.b.x) / 2, y: (f.a.y + f.b.y) / 2 }, true);
      refresh.placed = true;
    }
    return;
  }
  if (race.phase === 'over') return;
  // contro l'IA: se la tua auto è ferma per l'urto, l'IA muove da sola
  if (isAi() && race.cars[0].crash) {
    scene.clearMarks();
    $('rcHelp').textContent = 'Sei fermo per l’urto: l’IA va avanti.';
    setTimeout(() => runRound(null), 700);
    return;
  }
  helpTurn();
  let opts = isAi() ? R.roundOptions(race, 0) : R.options(race);
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

// gli avvisi stanno sempre sotto la barra in alto, anche quando il testo va su due righe
// (vale per la barra visibile: quella della gara o quella dell'editor; serve anche ai fumetti del tutorial)
const topBars = [$('rcTop'), document.querySelector('#ed .bar.top')];
const setTopH = () => document.documentElement.style.setProperty('--topH', Math.max(...topBars.map((b) => b.offsetHeight)) + 'px');
const topObs = new ResizeObserver(setTopH);
topBars.forEach((b) => topObs.observe(b));


function helpTurn() {
  const col = COL[race.turn];
  $('rcHelp').textContent = isAi() ? 'Scegli la tua mossa: l’IA muove insieme a te.' : `Tocca a ${col.num} ${col.name}: scegli dove andare.`;
}

// l'IA mette la sua auto: la casella della linea più vicina alla strada più corta
function aiPlace() {
  const F = distField(race.track), slots = R.placeable(race);
  const d = (s) => F.D.get(s.x + ',' + s.y) ?? 1e9;
  const s = slots.slice().sort((a, b) => d(a) - d(b))[0];
  R.placeCar(race, s);
  const car = race.cars[1];
  scene.placeCar(1, car.pos, race.track.normal);
}

// anima una o più mosse insieme e poi mostra cosa è successo
async function play(list, ev) {
  await Promise.all(list.map(({ i, from, opt, prevGear }) => {
    const car = race.cars[i];
    if (opt.crash || opt.gear < prevGear) scene.skid(from, car.pos);
    // suoni: motore, gomme se si scala, botto all'arrivo se si sbatte, bip se si passa la linea (solo per la tua auto contro l'IA)
    const ms = 260 + Math.max(1, Math.hypot(car.pos.x - from.x, car.pos.y - from.y)) * 70;
    if (!isAi() || i === 0) {
      sfx.engine(opt.crash ? Math.max(1, prevGear) : opt.gear, ms);
      if (opt.crash || opt.gear < prevGear) sfx.skid(ms);
    }
    if (opt.crash) setTimeout(() => sfx.crash(), ms);
    if (ev.some((e) => e.type === 'line' && e.car === i)) setTimeout(() => sfx.line(), ms * 0.6);
    // contro l'IA la telecamera segue sempre e solo la tua auto
    return scene.moveCar(i, from, car.pos, { x: opt.x - from.x, y: opt.y - from.y }, opt.crash, !isAi() || i === 0).then(() => {
      scene.addTrail(i, from, car.pos, car.path[car.path.length - 1].lap);
      scene.setGear(i, car.gear);
      scene.trailFade(i, R.currentLap(car));
    });
  }));
  chips();
  for (const e of ev) {
    const c = COL[e.car], me = isAi() && e.car === 0;
    if (e.type === 'crash') { await banner(`<div class="t" style="color:#fca5a5">Urto!</div>${me ? 'Sei fermo' : c.name + ' fermo'} per 2 turni<div class="pips" style="color:${c.hex}">● ●</div>`, 1700); if (!isAi() || me) tut.show('crash'); }
    else if (e.type === 'line' && race.cars[e.car].progress > 1) { await banner(`<div class="t">Giro ${Math.min(race.laps, race.cars[e.car].progress)} di ${race.laps}</div>${c.name}`, 1100); if (!isAi() || me) tut.show('lap'); }
    else if (e.type === 'lineBack') await banner(`${c.name} ha passato la linea al contrario: il giro non conta.`, 1500);
    else if (e.type === 'skip') {
      sfx.skip();
      if (!isAi()) scene.focus(race.cars[e.car].pos);
      if (e.turned) { await Promise.all([scene.turnCar(e.car, race.cars[e.car].dir), banner(`${me ? 'Salti' : c.name + ' salta'} il turno<br>e ${me ? 'ti giri' : 'si gira'} verso la pista`, 1400)]); }
      else await banner(`${me ? 'Salti' : c.name + ' salta'} il turno<div class="pips" style="color:${c.hex}">○ ●</div>`, 1300);
      chips();
    } else if (e.type === 'win') { win(e.car); return true; }
  }
  return false;
}

// contro l'IA: tu hai scelto (o sei fermo), l'IA sceglie, e le due auto si muovono insieme
async function runRound(myOpt) {
  if (!race || race.phase !== 'race') return;
  busy = true;
  scene.clearMarks();
  const ai = race.cars[1];
  let aiOpt = null;
  if (!ai.crash) {
    // l'IA non si ferma dove hai deciso di andare tu
    const avoid = myOpt ? [myOpt.stop] : race.cars[0].crash ? [race.cars[0].pos] : [];
    if (!driver.planned) { $('rcHelp').textContent = 'L’IA studia la pista…'; await new Promise((r) => setTimeout(r, 60)); driver.planned = true; }
    aiOpt = driver.choose(race, 1, avoid, R.roundOptions(race, 1, avoid));
  }
  $('rcHelp').textContent = '';
  const list = [];
  const from = race.cars.map((c) => ({ ...c.pos })), gears = race.cars.map((c) => c.gear), still = race.cars.map((c) => c.crash);
  const ev = R.applyRound(race, [myOpt, aiOpt]);
  [myOpt, aiOpt].forEach((opt, i) => { if (opt && !still[i]) list.push({ i, from: from[i], opt, prevGear: gears[i] }); });
  const done = await play(list, ev);
  busy = false;
  if (!done) refresh();
}

async function pick(mark) {
  if (busy || !race) return;
  if (!mark) return;
  if (race.phase === 'place') {
    const r = R.placeCar(race, mark);
    if (r.error) return banner(r.error);
    const car = race.cars.find((c) => c.pos && c.pos.x === mark.x && c.pos.y === mark.y);
    scene.placeCar(car.id, car.pos, race.track.normal);
    sfx.tick(true);
    if (isAi() && race.phase === 'place') aiPlace();
    refresh.placed = race.phase === 'race' ? false : refresh.placed;
    if (race.phase === 'race') {
      // tutte le auto sulla linea: semaforo, prima i rossi uno alla volta, poi verde e si parte
      busy = true;
      scene.clearMarks();
      $('rcHelp').textContent = 'Pronti…';
      chips();
      // tutorial: tutti i consigli della gara insieme, prima del semaforo
      await tut.show('race');
      await scene.startLights(() => sfx.light(false));
      sfx.light(true);
      $('rcHelp').textContent = 'Via!';
      busy = false;
    }
    refresh();
    return;
  }
  if (race.phase !== 'race') return;
  const opt = race.opts.find((o) => o.x === mark.x && o.y === mark.y);
  if (!opt) return;
  // un tocco: la marcia cambia subito e l'auto parte
  scene.setGear(race.turn, opt.crash ? 0 : opt.gear);
  if (isAi()) return runRound(opt);
  busy = true;
  scene.clearMarks();
  $('rcHelp').textContent = '';
  const i = race.turn, car = race.cars[i], from = { ...car.pos }, prevGear = car.gear;
  const ev = R.applyMove(race, opt);
  const done = await play([{ i, from, opt, prevGear }], ev);
  busy = false;
  if (!done) refresh();
}

let bannerT = 0;
function banner(html, ms = 1600) {
  const b = $('banner');
  b.innerHTML = html; b.classList.add('show');
  clearTimeout(bannerT);
  return new Promise((res) => { bannerT = setTimeout(() => { b.classList.remove('show'); setTimeout(res, 200); }, ms); });
}

function win(i) {
  setTimeout(() => tut.show('end'), 1600);
  sfx.win();
  chips();
  scene.clearMarks();
  const c = COL[i];
  $('winT').textContent = isAi() ? (i === 0 ? 'Hai vinto!' : 'Vince l’IA') : `Vince l'auto ${c.num} · ${c.name}`;
  $('winT').style.color = c.hex;
  $('winS').textContent = `${race.laps} ${race.laps === 1 ? 'giro' : 'giri'} · ${race.cars[i].moves} mosse`;
  scene.focus(race.cars[i].pos, true);
  setTimeout(() => { $('over').hidden = false; }, 700);
}

$('grid').onclick = (e) => { const on = !e.target.classList.contains('on'); e.target.classList.toggle('on', on); scene.setGrid(on); };
$('view').onclick = (e) => { const top = scene.view !== 'top'; scene.setView(top ? 'top' : 'tilt'); e.target.textContent = top ? 'Vista inclinata' : 'Vista alta'; };
// "Centra" riporta la vista sulla tua auto (o sulla linea) e da lì la vista torna a seguire il gioco
$('center').onclick = () => { const c = race && race.cars[race.turn]; if (c && c.pos) scene.focus(c.pos, true, true); else if (race) scene.focus(race.track.startSlots[0], true, true); };
$('menuB').onclick = () => { $('menu').hidden = false; };
$('snd').onclick = () => { sfx.unlock(); sfx.setOn(!sfx.on); sndLabel(); if (sfx.on) sfx.tick(true); };
sndLabel();
$('close').onclick = () => { $('menu').hidden = true; };
const again = () => { $('menu').hidden = true; refresh.placed = false; startRace(lastTrack, lastLaps, lastN, lastMode); };
$('again').onclick = again; $('again2').onclick = again;
const newTrack = () => {
  $('menu').hidden = true; $('over').hidden = true;
  draft.outer = draft.inner = draft.finish = null; draft.normal = -1; ed.error = null;
  show('ed'); ed.resize(); setStep(1); setupInfo(); $('setup').hidden = false;
};
$('newT').onclick = newTrack; $('newT2').onclick = newTrack;
// rifare il tutorial: dalla schermata Nuova gara, oppure dal menu (si riparte da una pista nuova)
$('tutAgain').onclick = () => { tut.restart(); tut.show('setup'); };
$('tutAgain2').onclick = () => { tut.restart(); newTrack(); tut.show('setup'); };

// Telegram: tasto Indietro (chiude il menu, in gara apre il menu) e conferma prima di chiudere durante la gara
if (tg && tg.isVersionAtLeast && tg.isVersionAtLeast('6.1')) {
  const inRace = () => $('rc').classList.contains('on');
  const sync = () => {
    const open = !$('menu').hidden;
    if (open || inRace()) tg.BackButton.show(); else tg.BackButton.hide();
    if (inRace() && race && race.phase !== 'over') tg.enableClosingConfirmation(); else tg.disableClosingConfirmation();
  };
  tg.BackButton.onClick(() => { if (!$('menu').hidden) $('menu').hidden = true; else if (inRace()) $('menu').hidden = false; sync(); });
  const mo = new MutationObserver(sync);
  mo.observe($('menu'), { attributes: true, attributeFilter: ['hidden'] });
  mo.observe($('over'), { attributes: true, attributeFilter: ['hidden'] });
  mo.observe($('rc'), { attributes: true, attributeFilter: ['class'] });
}

// avvio
setStep(1);
ed.setBoard(R.boardSize()); ed.resize(); ed.setZoom(R.startCells(draft.players)); syncZoom();
window.__gara = { draft, ed, R, startRace, get race() { return race; }, get scene() { return scene; }, pick };
