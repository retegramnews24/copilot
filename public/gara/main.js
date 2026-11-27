// Gara a quadretti: collega disegno, regole e scena 3D.
// Per ora si gioca sullo stesso telefono: Giallo è l'ospite (mette l'auto e muove per primo), Rosso chi crea la pista.
import { Editor } from './editor.js?v=705d6b5b21';
import * as R from './rules.js?v=fc2a02bb4a';
import { Race3D } from './scene3d.js?v=f375754296';
import { Sfx } from './sound.js?v=324cbca251';
import { AiDriver, distField } from './ai.js?v=f1fb243954';
import { Tutorial } from './tutorial.js?v=bbcc8d0516';
import { isTouchDevice } from '../touch-device.js';

// scritte giuste per il dispositivo (analisi 10.12): «col dito» e «tocca» sul telefono, «col mouse» e «clicca» sul computer
const touchUI = isTouchDevice();
const tap = touchUI ? 'tocca' : 'clicca',
  Tap = touchUI ? 'Tocca' : 'Clicca';

// suoni: il browser li accende solo dopo un tocco
const sfx = new Sfx();
document.addEventListener('pointerdown', () => sfx.unlock(), { capture: true });
const sndLabel = () => {
  const b = document.getElementById('snd');
  if (b) {
    b.textContent = sfx.on ? '🔊' : '🔇';
    b.setAttribute('aria-label', sfx.on ? 'Togli audio' : 'Metti audio');
  }
};
addEventListener('DOMContentLoaded', sndLabel);

const $ = id => document.getElementById(id);
// tutorial a fumetti (la prima volta, poi si può rifare)
const tut = new Tutorial($('tut'));

// ---------- margini di Telegram e del telefono ----------
// Dentro Binottoland Playground il gioco gira in un iframe: Telegram lo gestisce l'app (margini, tasto Indietro,
// vibrazione, conferma di chiusura) e parla con il gioco con postMessage (messaggi "f1:...").
const embedded = window.parent !== window;
// (il codice per Telegram di quando il gioco era una mini app a sé è stato tolto: non girava più, analisi 10.13)
const toApp = (type, data = {}) => {
  if (embedded) window.parent.postMessage({ type: 'f1:' + type, ...data }, location.origin);
};
if (embedded) {
  const wrap = (name, fn) => {
    const o = sfx[name].bind(sfx);
    sfx[name] = (...a) => {
      fn(...a);
      return o(...a);
    };
  };
  wrap('tick', () => toApp('haptic', { kind: 'selection' }));
  wrap('crash', () => toApp('haptic', { kind: 'notification', style: 'error' }));
  wrap('light', green => toApp('haptic', { kind: 'impact', style: green ? 'heavy' : 'light' }));
  wrap('line', () => toApp('haptic', { kind: 'impact', style: 'medium' }));
  wrap('win', () => toApp('haptic', { kind: 'notification', style: 'success' }));
}

let toastT = 0;
function toast(msg, ok) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.toggle('ok', !!ok);
  t.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('show'), ok ? 1600 : 3200);
}

// ---------- disegno ----------
const ed = new Editor($('c2'));
const draft = {
  outer: null,
  inner: null,
  finish: null,
  normal: -1,
  laps: 3,
  players: 2, // auto in gara: piloti più bot
  people: 2, // piloti (persone)
  bots: 1, // bot guidati dall'IA, in ogni modo
  time: 'day',
  mode: 'ai'
};
const NET_MAX = 8; // online: fino a 8 piloti
const BOT_TOTAL = 8; // con i bot al massimo 8 auto in tutto, in ogni modo
const maxCars = () => (draft.mode === 'net' ? NET_MAX : draft.mode === 'ai' ? BOT_TOTAL : R.MAX_CARS);
// Piloti e bot: contro l'IA sei solo tu (con almeno un bot); sullo stesso telefono e online da 1 pilota in su,
// con i bot al massimo 8 auto in tutto, e sempre almeno 2 auto
function fitCars() {
  const ai = draft.mode === 'ai';
  draft.people = ai ? 1 : Math.max(1, Math.min(maxCars(), draft.people));
  draft.bots = Math.max(ai ? 1 : 0, Math.min(BOT_TOTAL - draft.people, draft.bots));
  if (draft.people + draft.bots < 2) draft.people = 2;
  draft.players = draft.people + draft.bots;
}

// il giocatore: chi è (lo dice Binottoland) e le ultime scelte, ricordate in questo telefono come negli altri giochi
let me = null;
const SETUP_KEY = 'binotto-f1-setup';
function saveSetup() {
  try {
    localStorage.setItem(
      SETUP_KEY,
      JSON.stringify({
        mode: draft.mode,
        players: draft.players,
        people: draft.people,
        bots: draft.bots,
        time: draft.time,
        laps: draft.laps
      })
    );
  } catch (e) {
    /* niente memoria */
  }
}
function loadSetup() {
  let s = null;
  try {
    s = JSON.parse(localStorage.getItem(SETUP_KEY) || 'null');
  } catch (e) {
    /* niente memoria */
  }
  if (!s) return;
  if (['ai', 'local'].includes(s.mode) || (s.mode === 'net' && embedded)) draft.mode = s.mode;
  if (['day', 'sunset', 'night'].includes(s.time)) draft.time = s.time;
  if (Number.isInteger(s.laps)) draft.laps = Math.max(1, Math.min(9, s.laps));
  if (Number.isInteger(s.bots)) draft.bots = s.bots;
  if (Number.isInteger(s.people)) draft.people = s.people;
  else if (Number.isInteger(s.players)) draft.people = s.players;
  // online si parte sempre senza bot: i posti sono per le persone, i bot si aggiungono a mano
  if (draft.mode === 'net') draft.bots = 0;
  fitCars();
}

// modalità: contro l'IA (una tua auto e una dell'IA, mosse insieme), tutti sullo stesso telefono a turno,
// oppure Multiplayer: gara online con gli altri di Binottoland, ognuno dal suo telefono
function syncSetupButtons() {
  for (const o of document.querySelectorAll('[data-m]')) o.classList.toggle('on', o.dataset.m === draft.mode);
  for (const o of document.querySelectorAll('[data-t]')) o.classList.toggle('on', o.dataset.t === draft.time);
  $('lapN').textContent = draft.laps;
}
for (const b of document.querySelectorAll('[data-m]'))
  b.onclick = () => {
    draft.mode = b.dataset.m;
    // tornando da «Contro l'IA» (dove sei solo tu) si riparte da 2 piloti
    if (draft.people < 2) draft.people = 2;
    // online si parte senza bot: i posti sono per le persone, i bot si aggiungono a mano
    if (draft.mode === 'net') draft.bots = 0;
    fitCars();
    syncSetupButtons();
    setupInfo();
    saveSetup();
  };

// ora della gara: giorno, tramonto, notte
for (const b of document.querySelectorAll('[data-t]'))
  b.onclick = () => {
    draft.time = b.dataset.t;
    syncSetupButtons();
    saveSetup();
  };
let step = 1;
const widthTxt = () => String(R.minWidth(draft.players)).replace('.', ',');

const HELP = {
  1: () =>
    `Per una pista grande allontana prima la vista (−${touchUI ? '' : ' o la rotellina'}). Poi disegna ${touchUI ? 'col dito' : 'col mouse'} il bordo esterno e finisci vicino al punto di partenza.`,
  2: () =>
    `Ora disegna il bordo interno, tutto dentro quello esterno. Lascia almeno ${widthTxt()} caselle di asfalto.`,
  3: () =>
    `Traccia la linea di partenza da un bordo all'altro: deve avere posto per ${draft.players} auto affiancate. Verde va bene, rossa no.`,
  4: () => `${Tap} la freccia del verso di gara e scegli quanti giri.`
};

// ---------- scelta iniziale: quante auto ----------
function setupInfo() {
  fitCars();
  const n = draft.players,
    ai = draft.mode === 'ai',
    bots = draft.bots,
    people = draft.people;
  $('carRow').hidden = ai;
  $('carN').textContent = people;
  $('botN').textContent = bots;
  // i tasti si spengono ai limiti: con i bot al massimo 8 auto in tutto
  const full = bots ? n >= BOT_TOTAL : people >= maxCars();
  $('carM').disabled = people <= (bots ? 1 : 2);
  $('carP').disabled = full;
  $('botM').disabled = bots <= (ai ? 1 : 0) || (bots === 1 && people === 1);
  $('botP').disabled = n >= BOT_TOTAL;
  const botsTxt = bots === 1 ? 'un bot' : `${bots} bot`;
  $('modeInfo').textContent = ai
    ? `La tua auto contro ${bots === 1 ? 'una dell’IA' : `${bots} dell’IA`} (Bot 1${bots > 1 ? `…Bot ${bots}` : ''}). Muovete nello stesso momento: tu scegli, i bot scelgono, e le auto partono insieme.`
    : draft.mode === 'net'
      ? `Gara online: disegni la pista, poi la gara compare negli avvisi di Binottoland e aspetta ${people === 1 ? 'solo te (nessun altro pilota)' : people === 2 ? 'un altro pilota' : `altri ${people - 1} piloti`}${bots ? ` (più ${botsTxt}, che guida l’IA)` : ''}. In sala d’attesa puoi cambiare i bot finché non parti: i posti rimasti liberi restano vuoti. Ognuno sceglie la sua mossa dal suo telefono, tutti nello stesso momento: quando ha scelto anche l’ultimo, le auto si muovono insieme. 1 minuto per scegliere, poi guida il pilota automatico.`
      : `Giocate in ${people} sullo stesso telefono, a turno${bots ? `, con ${botsTxt} che ${bots === 1 ? 'muove' : 'muovono'} da sol${bots === 1 ? 'o' : 'i'} quando tocca a ${bots === 1 ? 'lui' : 'loro'}` : ''}.`;
  // pallini delle auto: prima i piloti, poi i bot (con la B)
  $('carDots').innerHTML = R.carColors(n)
    .map((c, i) => `<span style="--c:${c.hex}">${i >= people ? 'B' : c.num}</span>`)
    .join('');
  $('setupInfo').textContent =
    `${n} auto in gara (${people === 1 ? (ai ? 'tu' : '1 pilota') : `${people} piloti`}${bots ? ` + ${botsTxt}` : ''}). Griglia quasi infinita: la vista parte larga ${R.startCells(n)} caselle. La pista va bene se sulla linea di partenza ci stanno ${n} auto affiancate.`;
}
const changeCars = (key, d) => () => {
  draft[key] += d;
  // con i bot le auto sono al massimo 8: un pilota in più non toglie un bot, si ferma
  if (d > 0 && draft.people + draft.bots > (draft.bots ? BOT_TOTAL : maxCars())) draft[key] -= d;
  setupInfo();
  saveSetup();
};
$('carM').onclick = changeCars('people', -1);
$('carP').onclick = changeCars('people', 1);
$('botM').onclick = changeCars('bots', -1);
$('botP').onclick = changeCars('bots', 1);
$('startDraw').onclick = () => {
  $('setup').hidden = true;
  ed.setBoard(R.boardSize());
  ed.setZoom(R.startCells(draft.players));
  setStep(1);
  syncZoom();
};
// Multiplayer solo dentro Binottoland (serve sapere chi sei); aperto da una gara online si salta la scelta
const onlineRoom = embedded && new URLSearchParams(location.search).has('online');
if (embedded) document.querySelector('[data-m="net"]').hidden = false;
loadSetup();
syncSetupButtons();
setupInfo();
if (onlineRoom) $('setup').hidden = true;
else tut.show('setup');

function setStep(n) {
  step = n;
  ed.mode = ['outer', 'outer', 'inner', 'finish', 'dir'][n];
  $('edStep').textContent = `Passo ${n} di 4`;
  $('edHelp').textContent = HELP[n]();
  if ($('setup').hidden) tut.show('draw' + n);
  $('laps').hidden = n !== 4;
  $('go').hidden = n !== 4;
  ed.outer = draft.outer;
  ed.inner = draft.inner;
  ed.finish = draft.finish;
  ed.normalIdx = draft.normal;
  ed.draw();
}

// cursore dello zoom a scala: a sinistra poche caselle, a destra tutta la griglia
const ZMIN = 10;
const zoomToCells = v => ZMIN * Math.pow(ed.board / ZMIN, v / 1000);
const cellsToZoom = c => Math.round((1000 * Math.log(c / ZMIN)) / Math.log(ed.board / ZMIN));
function syncZoom() {
  $('zoom').value = Math.max(0, Math.min(1000, cellsToZoom(Math.max(ZMIN, ed.cellsAcross()))));
  $('edCells').textContent = `${ed.cellsAcross()} × ${Math.round(ed.h / ed.s)} caselle`;
}
ed.onZoom = syncZoom;
$('zoom').addEventListener('input', e => {
  ed.setZoom(zoomToCells(+e.target.value));
  syncZoom();
});
$('zOut').onclick = () => {
  ed.zoomAt(ed.w / 2, ed.h / 2, 0.8);
};
$('zIn').onclick = () => {
  ed.zoomAt(ed.w / 2, ed.h / 2, 1.25);
};
$('fit').onclick = () => {
  if (draft.outer) ed.fit();
  else {
    ed.cx = ed.cy = ed.board / 2;
    ed.draw();
  }
  syncZoom();
};

ed.finishCheck = pts => {
  const r = R.makeFinish(pts, draft.outer, draft.inner);
  if (r.error) return null;
  return { finish: r.finish, cap: R.finishCapacity(draft.outer, draft.inner, r.finish), need: draft.players };
};

ed.onStroke = pts => {
  ed.error = null;
  if (step === 1) {
    const r = R.closeBorder(pts);
    if (r.error) return fail(r);
    // gli stessi controlli del server, subito (analisi 11.2): prima li faceva solo il server, alla creazione online
    const shape = R.checkBorderShape(r.poly);
    if (shape) return fail({ error: shape, at: r.poly[0] });
    draft.outer = r.poly;
    // pista molto grande: si dice già qui, non dopo il secondo bordo (analisi 11.1)
    if (R.polyArea(r.poly) > R.MAX_TRACK_CELLS)
      toast(
        'Bordo esterno ok, ma è enorme: l’isola dovrà essere grande, al massimo un milione di caselle di asfalto.'
      );
    else toast('Bordo esterno ok', true);
    setStep(2);
  } else if (step === 2) {
    const r = R.closeBorder(pts);
    if (r.error) return fail(r);
    const shape = R.checkBorderShape(r.poly);
    if (shape) return fail({ error: shape, at: r.poly[0] });
    const c = R.checkInner(draft.outer, r.poly, R.minWidth(draft.players));
    if (c.error) return fail(c);
    // pista troppo grande: il controllo e il pilota automatico diventano lenti, e il server la rifiuterebbe
    const big = R.checkTrackSize(draft.outer, r.poly);
    if (big) return fail({ error: big, at: r.poly[0] });
    draft.inner = r.poly;
    toast('Bordo interno ok', true);
    setStep(3);
  } else if (step === 3) {
    const r = R.makeFinish(pts, draft.outer, draft.inner);
    if (r.error) return fail(r);
    const cap = R.finishCapacity(draft.outer, draft.inner, r.finish);
    if (cap < draft.players)
      return fail({
        error: `Sulla linea ci stanno ${cap} auto, ne servono ${draft.players}. Tracciala dove la pista è più larga.`,
        at: { x: (r.finish.a.x + r.finish.b.x) / 2, y: (r.finish.a.y + r.finish.b.y) / 2 }
      });
    draft.finish = r.finish;
    draft.normal = -1;
    setStep(4);
  }
};
function fail(r) {
  ed.error = r;
  ed.draw();
  toast(r.error);
}

ed.onArrow = i => {
  const cap = R.capacityFor(draft.outer, draft.inner, draft.finish, R.finishNormals(draft.finish)[i]);
  if (cap < draft.players) {
    toast(`In questo verso sulla linea ci stanno ${cap} auto, ne servono ${draft.players}.`);
    return false;
  }
  draft.normal = i;
  tut.show('create3d');
};

$('undo').onclick = () => {
  ed.error = null;
  if (step === 4) {
    draft.finish = null;
    draft.normal = -1;
    setStep(3);
  } else if (step === 3) {
    draft.inner = null;
    setStep(2);
  } else if (step === 2) {
    draft.outer = null;
    setStep(1);
  } else ed.draw();
};
const showLaps = () => {
  $('lapN').textContent = draft.laps;
};
$('lapM').onclick = () => {
  draft.laps = Math.max(1, draft.laps - 1);
  showLaps();
  saveSetup();
};
$('lapP').onclick = () => {
  draft.laps = Math.min(9, draft.laps + 1);
  showLaps();
  saveSetup();
};

$('go').onclick = () => {
  tut.hide();
  if (draft.normal < 0) return toast(`Prima ${tap} una delle due frecce: è il verso di gara.`);
  // controllo finale di tutta la pista prima del 3D
  const c = R.checkInner(draft.outer, draft.inner, R.minWidth(draft.players));
  if (c.error) return fail(c);
  const n = R.finishNormals(draft.finish)[draft.normal];
  const b = R.buildTrack(draft.outer, draft.inner, draft.finish, n, draft.players);
  if (b.error) return fail(b);
  if (draft.mode === 'net') {
    // gara online: la pista va a Binottoland, che apre la gara e manda l'avviso agli altri
    if (!me) return toast('Apri il gioco da Binottoland per correre online.');
    $('go').disabled = true;
    toast('Apro la gara online…', true);
    const r2 = p => ({ x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100 });
    const track = {
      outer: draft.outer.map(r2),
      inner: draft.inner.map(r2),
      finish: {
        a: r2(draft.finish.a),
        b: r2(draft.finish.b),
        outerSeg: draft.finish.outerSeg,
        innerSeg: draft.finish.innerSeg
      },
      normal: n,
      players: draft.players
    };
    // la pista arrotondata come la vedrà il server, con i suoi stessi controlli (analisi 11.10): se il server la
    // rifiuterebbe, lo si dice qui con il punto segnato invece che dopo la richiesta
    const why = R.onlineTrackError(track);
    if (why) {
      $('go').disabled = false;
      return fail({ error: why, at: track.outer[0] });
    }
    toApp('create', { track, laps: draft.laps, time: draft.time, bots: draft.bots });
    return;
  }
  startRace(b.track, draft.laps, draft.players, draft.mode, draft.bots);
};

// ---------- gara ----------
let scene = null,
  race = null,
  busy = false,
  lastTrack = null,
  lastLaps = 3,
  lastN = 2,
  lastMode = 'ai',
  lastBots = 1;
let COL = R.carColors(2);
let drivers = []; // contro l'IA: un pilota dell'IA per ogni bot (auto 1, 2…; la 0 è la tua)
const isAi = () => race && race.mode === 'ai';

function show(id) {
  for (const s of document.querySelectorAll('.screen')) s.classList.toggle('on', s.id === id);
}

// qualità grafica, ricordata dal browser
// partenza «Media» sui telefoni, «Alta» sul computer; la scelta del giocatore resta ricordata (analisi 10.8)
const defaultQuality = touchUI ? 'media' : 'alta';
let quality = defaultQuality;
try {
  quality = localStorage.getItem('gara.qualita') || defaultQuality;
} catch (e) {
  /* niente memoria */
}
const qButtons = () => {
  for (const b of document.querySelectorAll('[data-q]')) b.classList.toggle('on', b.dataset.q === quality);
};
for (const b of document.querySelectorAll('[data-q]'))
  b.onclick = () => {
    quality = b.dataset.q;
    qButtons();
    try {
      localStorage.setItem('gara.qualita', quality);
    } catch (e) {
      /* niente */
    }
    if (scene) scene.setQuality(quality);
  };
qButtons();

// la scena 3D nasce alla prima gara; se la grafica 3D non parte si dice perché, invece di lasciare la schermata
// vuota (analisi 10.13). L'errore arriva anche al registro di Debug (frame-errors.js).
function makeScene() {
  if (scene) return true;
  try {
    scene = new Race3D($('gl'));
    scene.onPick = pick;
    scene.setQuality(quality);
    scene.setTalkElement($('talk'));
    return true;
  } catch (e) {
    scene = null;
    console.error(e);
    $('rcHelp').textContent = 'Grafica 3D non disponibile su questo dispositivo: la gara non può partire.';
    toast('Grafica 3D non disponibile su questo dispositivo.');
    return false;
  }
}

// bots: le ultime auto sono dei bot (contro l'IA tutte tranne la tua; sullo stesso telefono dopo i piloti)
async function startRace(track, laps, n, mode = 'local', bots = 0) {
  lastTrack = track;
  lastLaps = laps;
  lastN = n;
  lastMode = mode;
  lastBots = bots;
  show('rc');
  if (!makeScene()) return;
  scene.resize();
  scene.onViewChange = () => {
    $('view').textContent = 'Vista alta';
  };
  scene.build(track, draft.time);
  await scene.ready;
  race = R.newRace(track, laps, n);
  race.mode = mode;
  COL = race.colors;
  const first = mode === 'ai' ? 1 : n - bots; // la prima auto dei bot
  COL = race.colors = COL.map((c, i) =>
    i >= first
      ? { ...c, name: `Bot ${i - first + 1}`, raw: `Bot ${i - first + 1}`, role: 'bot' }
      : mode === 'ai'
        ? { ...c, name: 'Tu', raw: 'Tu', role: 'tu' }
        : { ...c, raw: c.name, role: i === first - 1 ? 'creatore' : 'ospite' }
  );
  drivers = race.cars.map((c, i) => (i >= first ? new AiDriver(track, laps) : null));
  scene.setCars(race, COL);
  busy = false;
  $('over').hidden = true;
  refresh();
}

// barra in alto: l'auto di turno per esteso, le altre compatte (numero, marcia, fermo)
function chips() {
  $('chips').innerHTML = race.cars
    .map((c, i) => {
      // online in gara si sceglie tutti insieme: evidenziate le auto che devono ancora scegliere
      const together = netRacing(),
        chosen = together && netChosen(i);
      const col = COL[i],
        lap = Math.min(race.laps, R.currentLap(c)),
        turn = together ? !c.crash && !chosen : i === race.turn && race.phase !== 'over';
      const st =
        (c.crash ? ` · fermo ${c.crash}` : '') +
        (chosen ? ' · ✓ scelto' : '') +
        (net && net.auto[i] ? ' · auto' : '');
      // con una mossa scelta al primo tocco, la marcia mostrata è già quella nuova
      const gv = c.gear;
      // compatte: sullo stesso telefono chi non è di turno, contro più bot i bot
      if (!turn && !net && (!isAi() || (i > 0 && race.cars.length > 2)))
        return `<div class="chip" style="--c:${col.hex}"><span class="dot"></span>${col.num} <span class="g">${gv ? gv : 'N'}</span>${c.crash ? ' <span class="muted">✕' + c.crash + '</span>' : ''}</div>`;
      return `<div class="chip ${turn ? 'turn' : ''}" style="--c:${col.hex}"><span class="dot"></span>${col.num} ${col.name} <span class="g">${gv ? gv : 'N'}</span> <span class="muted">giro ${lap}/${race.laps}${st}</span></div>`;
    })
    .join('');
  const box = $('chips'),
    t = box.querySelector('.turn');
  if (t) box.scrollLeft = t.offsetLeft - box.clientWidth / 2 + t.offsetWidth / 2;
  setTopH();
}

function refresh() {
  chips();
  // online in gara: l'auto da guidare è sempre la tua (si sceglie tutti insieme)
  const ci = netRacing() && net.mine >= 0 ? net.mine : race.turn;
  const car = race.cars[ci],
    col = COL[ci];
  // online: sulla linea si mette l'auto a turno; in gara scegli quando non hai ancora scelto, altrimenti guardi
  if (net && race.phase !== 'over' && (race.phase === 'place' ? race.turn !== net.mine : !netCanChoose())) {
    scene.clearMarks();
    netHelp();
    if (race.phase === 'place' && !refresh.placed) {
      const f = race.track.finish;
      scene.focus({ x: (f.a.x + f.b.x) / 2, y: (f.a.y + f.b.y) / 2 }, true);
      refresh.placed = true;
    } else if (car.pos) scene.focus(car.pos);
    return;
  }
  if (race.phase === 'place') {
    $('rcHelp').textContent = net
      ? `Tocca a te: ${tap} una casella bianca sulla linea per mettere la tua auto.`
      : isAi()
        ? `${Tap} una casella bianca sulla linea per mettere la tua auto: poi i bot mettono la loro.`
        : `${col.num} ${col.name} (${col.role}): ${tap} una casella bianca sulla linea per mettere l'auto.`;
    scene.showMarks(R.placeable(race).map(s => ({ ...s, kind: 'slot' })));
    tut.show('place');
    if (!refresh.placed) {
      const f = race.track.finish;
      scene.focus({ x: (f.a.x + f.b.x) / 2, y: (f.a.y + f.b.y) / 2 }, true);
      refresh.placed = true;
    }
    return;
  }
  if (race.phase === 'over') return;
  // sullo stesso telefono, quando tocca a un bot muove da solo
  if (!net && !isAi() && drivers[race.turn]) {
    scene.clearMarks();
    busy = true;
    chips();
    $('rcHelp').textContent = `${COL[race.turn].name} sceglie…`;
    setTimeout(botTurn, 450);
    return;
  }
  // contro l'IA: se la tua auto è ferma per l'urto, i bot muovono da soli
  if (isAi() && race.cars[0].crash) {
    scene.clearMarks();
    $('rcHelp').textContent = 'Sei fermo per l’urto: i bot vanno avanti.';
    setTimeout(() => runRound(null), 700);
    return;
  }
  helpTurn();
  let opts = isAi() ? R.roundOptions(race, 0) : net ? R.roundOptions(race, ci) : R.options(race);
  if (!opts.length)
    opts = [
      { x: car.pos.x + car.dir.x, y: car.pos.y + car.dir.y, gear: 1, crash: true, stop: { ...car.pos } }
    ];
  race.opts = opts;
  scene.showMarks(
    opts.map(o => ({
      ...o,
      kind: o.crash
        ? 'crash'
        : car.gear === 0 || o.gear === car.gear
          ? 'same'
          : o.gear < car.gear
            ? 'down'
            : 'up',
      txt: String(o.gear)
    }))
  );
  // telecamera a metà tra l'auto e i dischi, così si vede tutto
  const cx = opts.reduce((s, o) => s + o.x, 0) / opts.length,
    cy = opts.reduce((s, o) => s + o.y, 0) / opts.length;
  scene.focus({ x: (car.pos.x + cx) / 2, y: (car.pos.y + cy) / 2 }, race.moves === 0);
}

// gli avvisi stanno sempre sotto la barra in alto, anche quando il testo va su due righe
// (vale per la barra visibile: quella della gara o quella dell'editor; serve anche ai fumetti del tutorial)
const topBars = [$('rcTop'), document.querySelector('#ed .bar.top')];
const setTopH = () =>
  document.documentElement.style.setProperty('--topH', Math.max(...topBars.map(b => b.offsetHeight)) + 'px');
const topObs = new ResizeObserver(setTopH);
topBars.forEach(b => topObs.observe(b));

function helpTurn() {
  const col = COL[race.turn];
  if (net) return netHelp();
  $('rcHelp').textContent = isAi()
    ? 'Scegli la tua mossa: i bot muovono insieme a te.'
    : `Tocca a ${col.num} ${col.name}: scegli dove andare.`;
}

// i bot mettono la loro auto, uno dopo l'altro: la casella della linea più vicina alla strada più corta
function aiPlace() {
  const F = distField(race.track);
  const d = s => F.D.get(s.x + ',' + s.y) ?? 1e9;
  while (race.phase === 'place') {
    const i = race.turn,
      s = R.placeable(race)
        .slice()
        .sort((a, b) => d(a) - d(b))[0];
    if (!s || R.placeCar(race, s).error) break;
    scene.placeCar(i, race.cars[i].pos, race.track.normal);
  }
}

// anima una o più mosse insieme e poi mostra cosa è successo
async function play(list, ev) {
  await Promise.all(
    list.map(({ i, from, opt, prevGear }) => {
      const car = race.cars[i];
      if (opt.crash || opt.gear < prevGear) scene.skid(from, car.pos);
      // suoni: motore, gomme se si scala, botto all'arrivo se si sbatte, bip se si passa la linea (solo per la tua auto contro l'IA)
      const ms = 260 + Math.max(1, Math.hypot(car.pos.x - from.x, car.pos.y - from.y)) * 70;
      if (myCar(i)) {
        sfx.engine(opt.crash ? Math.max(1, prevGear) : opt.gear, ms);
        if (opt.crash || opt.gear < prevGear) sfx.skid(ms);
      }
      if (opt.crash) setTimeout(() => sfx.crash(), ms);
      if (ev.some(e => e.type === 'line' && e.car === i)) setTimeout(() => sfx.line(), ms * 0.6);
      // contro l'IA e online (auto che si muovono insieme) la telecamera segue sempre e solo la tua auto
      return scene
        .moveCar(i, from, car.pos, { x: opt.x - from.x, y: opt.y - from.y }, opt.crash, myCar(i))
        .then(() => {
          scene.addTrail(i, from, car.pos, car.path[car.path.length - 1].lap);
          scene.setGear(i, car.gear);
          scene.trailFade(i, R.currentLap(car));
        });
    })
  );
  chips();
  for (const e of ev) {
    const c = COL[e.car],
      me = (isAi() && e.car === 0) || (!!net && e.car === net.mine);
    if (e.type === 'crash') {
      await banner(
        `<div class="t" style="color:#fca5a5">Urto!</div>${me ? 'Sei fermo' : c.name + ' fermo'} per 2 turni<div class="pips" style="color:${c.hex}">● ●</div>`,
        1700
      );
      if (!isAi() || me) tut.show('crash');
    } else if (e.type === 'line' && race.cars[e.car].progress > 1) {
      await banner(
        `<div class="t">Giro ${Math.min(race.laps, race.cars[e.car].progress)} di ${race.laps}</div>${c.name}`,
        1100
      );
      if (!isAi() || me) tut.show('lap');
    } else if (e.type === 'lineBack')
      await banner(`${c.name} ha passato la linea al contrario: il giro non conta.`, 1500);
    else if (e.type === 'skip') {
      sfx.skip();
      if (!isAi()) scene.focus(race.cars[e.car].pos);
      if (e.turned) {
        await Promise.all([
          scene.turnCar(e.car, race.cars[e.car].dir),
          banner(
            `${me ? 'Salti' : c.name + ' salta'} il turno<br>e ${me ? 'ti giri' : 'si gira'} verso la pista`,
            1400
          )
        ]);
      } else
        await banner(
          `${me ? 'Salti' : c.name + ' salta'} il turno<div class="pips" style="color:${c.hex}">○ ●</div>`,
          1300
        );
      chips();
    } else if (e.type === 'win') {
      win(e.car);
      return true;
    }
  }
  return false;
}

// contro l'IA: tu hai scelto (o sei fermo), i bot scelgono, e tutte le auto si muovono insieme
async function runRound(myOpt) {
  if (!race || race.phase !== 'race') return;
  busy = true;
  scene.clearMarks();
  const moves = [myOpt];
  // i bot non si fermano dove hai deciso di andare tu, né dove ha deciso di fermarsi un altro bot
  const avoid = myOpt ? [myOpt.stop] : race.cars[0].crash ? [race.cars[0].pos] : [];
  for (let i = 1; i < race.cars.length; i++) {
    if (race.cars[i].crash) {
      moves.push(null);
      continue;
    }
    if (!drivers[i].planned) {
      $('rcHelp').textContent = race.cars.length > 2 ? 'I bot studiano la pista…' : 'L’IA studia la pista…';
      await new Promise(r => setTimeout(r, 60));
      drivers[i].planned = true;
    }
    const o = drivers[i].choose(race, i, avoid, R.roundOptions(race, i, avoid));
    moves.push(o);
    if (o) avoid.push(o.stop);
  }
  $('rcHelp').textContent = '';
  const list = [];
  const from = race.cars.map(c => ({ ...c.pos })),
    gears = race.cars.map(c => c.gear),
    still = race.cars.map(c => c.crash);
  const ev = R.applyRound(race, moves);
  moves.forEach((opt, i) => {
    if (opt && !still[i]) list.push({ i, from: from[i], opt, prevGear: gears[i] });
  });
  const done = await play(list, ev);
  busy = false;
  if (!done) refresh();
}

// sullo stesso telefono: la mossa del bot di turno, con la stessa IA di «Contro l'IA»
async function botTurn() {
  if (!race || race.phase !== 'race' || !drivers[race.turn]) {
    busy = false;
    return;
  }
  const i = race.turn,
    car = race.cars[i],
    opts = R.options(race);
  const opt = (opts.length && drivers[i].choose(race, i, [], opts)) || {
    x: car.pos.x + car.dir.x,
    y: car.pos.y + car.dir.y,
    gear: 1,
    crash: true,
    stop: { ...car.pos }
  };
  scene.setGear(i, opt.crash ? 0 : opt.gear);
  const from = { ...car.pos },
    prevGear = car.gear;
  const ev = R.applyMove(race, opt);
  const done = await play([{ i, from, opt, prevGear }], ev);
  busy = false;
  if (!done) refresh();
}

async function pick(mark) {
  if (busy || !race) return;
  if (!mark) return;
  // online: la mossa va al server; si vede quando torna confermata (la stessa per tutti i telefoni)
  if (net) {
    if (race.phase === 'race') {
      // in gara: scegli la tua mossa; le auto partono quando hanno scelto tutti
      if (!netCanChoose()) return;
      const opt = race.opts && race.opts.find(o => o.x === mark.x && o.y === mark.y);
      if (!opt) return;
      scene.setGear(net.mine, opt.crash ? 0 : opt.gear);
    } else if (
      race.phase !== 'place' ||
      race.turn !== net.mine ||
      !R.placeable(race).some(s => s.x === mark.x && s.y === mark.y)
    )
      return;
    busy = true;
    scene.clearMarks();
    sfx.tick(true);
    $('rcHelp').textContent =
      race.phase === 'race' ? 'Mossa scelta: aspettiamo gli altri…' : 'Mossa inviata…';
    toApp('action', { kind: 'play', payload: { x: mark.x, y: mark.y } });
    return;
  }
  if (race.phase === 'place') {
    const r = R.placeCar(race, mark);
    if (r.error) return banner(r.error);
    const car = race.cars.find(c => c.pos && c.pos.x === mark.x && c.pos.y === mark.y);
    scene.placeCar(car.id, car.pos, race.track.normal);
    sfx.tick(true);
    // dopo l'ultimo pilota i bot mettono le loro auto (stanno in fondo)
    if (race.phase === 'place' && drivers[race.turn]) aiPlace();
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
  const opt = race.opts.find(o => o.x === mark.x && o.y === mark.y);
  if (!opt) return;
  // un tocco: la marcia cambia subito e l'auto parte
  scene.setGear(race.turn, opt.crash ? 0 : opt.gear);
  if (isAi()) return runRound(opt);
  busy = true;
  scene.clearMarks();
  $('rcHelp').textContent = '';
  const i = race.turn,
    car = race.cars[i],
    from = { ...car.pos },
    prevGear = car.gear;
  const ev = R.applyMove(race, opt);
  const done = await play([{ i, from, opt, prevGear }], ev);
  busy = false;
  if (!done) refresh();
}

let bannerT = 0;
function banner(html, ms = 1600) {
  const b = $('banner');
  b.innerHTML = html;
  b.classList.add('show');
  clearTimeout(bannerT);
  return new Promise(res => {
    bannerT = setTimeout(() => {
      b.classList.remove('show');
      setTimeout(res, 200);
    }, ms);
  });
}

function win(i) {
  setTimeout(() => tut.show('end'), 1600);
  sfx.win();
  chips();
  scene.clearMarks();
  const c = COL[i];
  $('winT').textContent = net
    ? i === net.mine
      ? 'Hai vinto!'
      : `Vince ${c.raw}`
    : isAi()
      ? i === 0
        ? 'Hai vinto!'
        : `Vince ${c.raw}`
      : `Vince l'auto ${c.num} · ${c.name}`;
  netOverButtons();
  $('winT').style.color = c.hex;
  $('winS').textContent = `${race.laps} ${race.laps === 1 ? 'giro' : 'giri'} · ${race.cars[i].moves} mosse`;
  scene.focus(race.cars[i].pos, true);
  setTimeout(() => {
    $('over').hidden = false;
  }, 700);
}

$('grid').onclick = e => {
  const on = !e.target.classList.contains('on');
  e.target.classList.toggle('on', on);
  scene.setGrid(on);
};
$('view').onclick = e => {
  const top = scene.view !== 'top';
  scene.setView(top ? 'top' : 'tilt');
  e.target.textContent = top ? 'Vista inclinata' : 'Vista alta';
};
// "Centra" riporta la vista sulla tua auto (o sulla linea) e da lì la vista torna a seguire il gioco
$('center').onclick = () => {
  const c = race && race.cars[net && net.mine >= 0 ? net.mine : race.turn]; // online: la tua auto (analisi 10.11)
  if (c && c.pos) scene.focus(c.pos, true, true);
  else if (race) scene.focus(race.track.startSlots[0], true, true);
};
$('menuB').onclick = () => {
  $('menu').hidden = false;
};
$('snd').onclick = () => {
  sfx.unlock();
  sfx.setOn(!sfx.on);
  sndLabel();
  if (sfx.on) sfx.tick(true);
};
sndLabel();
$('close').onclick = () => {
  $('menu').hidden = true;
};
const again = () => {
  $('menu').hidden = true;
  refresh.placed = false;
  startRace(lastTrack, lastLaps, lastN, lastMode, lastBots);
};
$('again').onclick = again;
$('again2').onclick = again;
const newTrack = () => {
  $('menu').hidden = true;
  $('over').hidden = true;
  draft.outer = draft.inner = draft.finish = null;
  draft.normal = -1;
  ed.error = null;
  show('ed');
  ed.resize();
  setStep(1);
  setupInfo();
  $('setup').hidden = false;
};
$('newT').onclick = newTrack;
$('newT2').onclick = () => (net ? toApp('exit') : newTrack());
// rifare il tutorial: dalla schermata Nuova gara, oppure dal menu (si riparte da una pista nuova)
$('tutAgain').onclick = () => {
  tut.restart();
  tut.show('setup');
};
$('tutAgain2').onclick = () => {
  tut.restart();
  newTrack();
  tut.show('setup');
};

// ---------- gara online (Multiplayer) ----------
// Binottoland tiene la gara sul server e manda qui lo stato ("f1:state"): la pista, i piloti, l'elenco delle mosse.
// Il gioco rifà le mosse nuove con le stesse regole, una alla volta e animate (entrando tardi: tutte subito).
let net = null,
  netChain = Promise.resolve();
const esc = s =>
  String(s).replace(
    /[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
// i bot della gara online: posti «bot:1», «bot:2»… (f1-server.js), in fondo dopo chi ha creato la gara
const isBotSeat = id => typeof id === 'string' && id.startsWith('bot:');
function netColors(s) {
  return R.carColors(s.seats.length).map((c, i) => {
    const p = s.players.find(q => q.id === s.seats[i]),
      mine = !!(me && p && p.id === me.player),
      bot = isBotSeat(s.seats[i]);
    const raw = mine ? 'Tu' : p ? p.name : bot ? 'Bot ' + s.seats[i].slice(4) : c.name;
    return { ...c, name: esc(raw), raw, role: mine ? 'tu' : bot ? 'bot' : 'pilota' };
  });
}
function netLeft() {
  const s = net && net.state;
  if (!s || !s.turnAt) return null;
  return Math.max(0, Math.ceil((s.turnAt - (Date.now() + (net.skew || 0))) / 1000));
}
function netHelp() {
  if (!net || !race || race.phase === 'over' || busy) return;
  const left = netLeft(),
    t = left === null ? '' : ` · ${left} s`,
    i = race.turn;
  if (race.phase === 'race') {
    // si sceglie tutti insieme: chi manca ancora
    const missing = race.cars
      .map((c, k) => k)
      .filter(k => !race.cars[k].crash && !netChosen(k))
      .map(k => (k === net.mine ? 'tu' : COL[k].raw));
    const who = missing.join(', ');
    if (netCanChoose()) $('rcHelp').textContent = 'Scegli dove andare: le auto si muovono tutte insieme' + t;
    else if (net.mine >= 0 && race.cars[net.mine].crash)
      $('rcHelp').textContent =
        'Sei fermo per l’urto: questo giro lo salti' + (who ? ` · scelgono ${who}` : '') + t;
    else if (net.mine >= 0) $('rcHelp').textContent = `Hai scelto: aspettiamo ${who || 'gli altri'}` + t;
    else $('rcHelp').textContent = `Scelgono: ${who}${t} · stai guardando`;
    return;
  }
  if (i === net.mine) $('rcHelp').textContent = 'Tocca a te: metti la tua auto sulla linea' + t;
  else $('rcHelp').textContent = `Mette l’auto ${COL[i].raw}${t}` + (net.mine < 0 ? ' · stai guardando' : '');
}
// online in gara: le auto scelgono tutte insieme (il server dice solo chi ha già scelto, non cosa)
const netRacing = () => !!(net && race && race.phase === 'race');
const netChosen = i => !!(net && net.state.chosen && net.state.chosen[i]);
const netCanChoose = () => netRacing() && net.mine >= 0 && !race.cars[net.mine].crash && !netChosen(net.mine);
// la "tua" auto: contro l'IA la prima, online la tua (se guardi, la prima); sullo stesso telefono tutte
const myCar = i => (isAi() ? i === 0 : net ? i === (net.mine >= 0 ? net.mine : 0) : true);
setInterval(() => {
  if (net && race && !busy) netHelp();
}, 1000);
function netOverButtons() {
  $('again2').hidden = !!net;
  $('newT2').textContent = net ? 'Torna a Binottoland' : 'Nuova pista';
}
function netMenu() {
  const on = !!net,
    owner = on && me && net.state.owner === me.player;
  for (const id of ['again', 'newT', 'tutAgain2']) $(id).hidden = on;
  const seated = on && me && net.state.players.some(p => p.id === me.player);
  // in gara chi non l'ha creata può abbandonare (la sua auto la guida il pilota automatico)
  $('netClose').hidden = !(on && seated && netCloseKind());
  $('netClose').dataset.sure = '';
  $('netClose').textContent =
    { leave: 'Esci da questa gara', abandon: 'Abbandona la gara', close: 'Chiudi la gara online' }[
      netCloseKind()
    ] || '';
}
function netCloseKind() {
  const s = net && net.state;
  if (!s || !me) return null;
  const owner = s.owner === me.player,
    gone = (s.gone || []).includes(me.player);
  if (owner || s.phase === 'finished' || (s.gone || []).includes(s.owner)) return 'close';
  if (s.phase === 'waiting') return 'leave';
  return gone ? null : 'abandon';
}
// sala d'attesa: chi c'è, i bot, quanti mancano; chi ha creato la gara cambia i bot e può partire prima
// (con almeno un altro pilota o un bot); i posti rimasti liberi restano vuoti
function netWaiting(s) {
  const box = $('chips'),
    bots = s.bots || 0;
  box.replaceChildren();
  for (let i = 0; i < s.capacity; i++) {
    const p = s.players[i],
      bot = !p && i >= s.capacity - bots,
      chip = document.createElement('div');
    chip.className = 'chip';
    chip.style.setProperty('--c', p ? '#22c55e' : bot ? '#38bdf8' : '#475569');
    const dot = document.createElement('span');
    dot.className = 'dot';
    chip.append(
      dot,
      p
        ? me && p.id === me.player
          ? 'Tu'
          : p.name
        : bot
          ? 'Bot ' + (i - (s.capacity - bots) + 1)
          : 'posto libero'
    );
    box.append(chip);
  }
  setTopH();
  const owner = !!(me && s.owner === me.player),
    missing = s.capacity - s.players.length - bots;
  const seated = !!(me && s.players.some(p => p.id === me.player));
  // i bot li cambia solo chi ha creato la gara, nei posti non presi dalle persone
  $('netBots').hidden = !owner;
  $('netBotN').textContent = bots;
  $('netBotM').disabled = bots <= 0;
  $('netBotP').disabled = bots >= s.capacity - s.players.length;
  // chi l'ha aperta dalla Lobby guarda: entra solo se tocca «Entra in gara»
  if (!seated) {
    $('rcHelp').textContent =
      missing > 0
        ? `Stai guardando: ${missing === 1 ? 'manca un pilota' : `mancano ${missing} piloti`}. ${Tap} «Entra in gara» per correre.`
        : 'Stai guardando: la gara è al completo.';
    $('netGo').hidden = missing <= 0;
    $('netGo').textContent = 'Entra in gara';
    $('netGo').dataset.kind = 'join';
    return;
  }
  const cars = s.players.length + bots;
  $('rcHelp').textContent =
    (missing > 0
      ? `Aspettiamo ${missing} ${missing === 1 ? 'pilota' : 'piloti'}: gli altri entrano dalla campanella o dalla Lobby di Binottoland.`
      : 'Tutti i posti sono presi.') + (owner && cars >= 2 ? ' Puoi anche partire ora.' : '');
  $('netGo').hidden = !owner || cars < 2;
  $('netGo').textContent = `Parti ora (${cars})`;
  $('netGo').dataset.kind = 'start';
}
// chi ha creato la gara cambia i bot: il server lo dice a tutti con lo stato
const netSetBots = d => {
  const s = net && net.state;
  if (!s || s.phase !== 'waiting') return;
  const n = (s.bots || 0) + d;
  if (n < 0 || n > s.capacity - s.players.length) return;
  toApp('action', { kind: 'bots', payload: { bots: n } });
};
$('netBotM').onclick = () => netSetBots(-1);
$('netBotP').onclick = () => netSetBots(1);
async function netOpen(s, track) {
  tut.hide();
  $('setup').hidden = true;
  $('menu').hidden = true;
  $('over').hidden = true;
  show('rc');
  if (!makeScene()) return;
  scene.resize();
  scene.onViewChange = () => {
    $('view').textContent = 'Vista alta';
  };
  scene.build(track, s.time);
  await scene.ready;
  net = { room: s.room, state: s, track, seq: 0, mine: -1, skew: net ? net.skew : 0, auto: [] };
  $('go').disabled = false;
  race = null;
  drivers = [];
  busy = false;
  refresh.placed = false;
  lastMode = 'net';
  const f = track.finish;
  scene.focus({ x: (f.a.x + f.b.x) / 2, y: (f.a.y + f.b.y) / 2 }, true, true);
}
async function netSync() {
  if (!net) return;
  const s = net.state,
    track = net.track;
  netMenu();
  if (s.phase === 'waiting') {
    netWaiting(s);
    return;
  }
  $('netGo').hidden = true;
  $('netBots').hidden = true;
  if (!race) {
    race = R.newRace(track, s.laps, s.seats.length);
    race.mode = 'net';
    COL = race.colors = netColors(s);
    net.mine = me ? s.seats.indexOf(me.player) : -1;
    net.auto = s.seats.map(() => false);
    scene.setCars(race, COL);
  }
  const fresh = s.moves.length - net.seq,
    instant = fresh > 4; // entrando tardi le mosse vecchie si mettono subito
  while (net.seq < s.moves.length) {
    const e = s.moves[net.seq++],
      i = e.car;
    if (e.kind !== 'round') net.auto[i] = !!e.auto;
    if (e.kind === 'place') {
      R.placeCar(race, { x: e.x, y: e.y });
      scene.placeCar(i, race.cars[i].pos, track.normal);
      if (instant) continue;
      sfx.tick(true);
      if (race.phase === 'race') {
        // tutte le auto sulla linea: semaforo per tutti
        busy = true;
        scene.clearMarks();
        chips();
        $('rcHelp').textContent = 'Pronti…';
        await tut.show('race');
        await scene.startLights(() => sfx.light(false));
        sfx.light(true);
        $('rcHelp').textContent = 'Via!';
      }
      continue;
    }
    if (e.kind === 'round') {
      // un giro di mosse insieme: tutte le auto partono nello stesso momento
      const from = race.cars.map(c => ({ ...c.pos })),
        gears = race.cars.map(c => c.gear),
        still = race.cars.map(c => c.crash);
      e.moves.forEach((o, k) => {
        if (o) net.auto[k] = !!(e.auto && e.auto[k]);
      });
      const ev = R.applyRound(race, e.moves);
      if (instant) continue;
      busy = true;
      scene.clearMarks();
      const list = [];
      e.moves.forEach((opt, k) => {
        if (!opt || still[k]) return;
        list.push({ i: k, from: from[k], opt, prevGear: gears[k] });
        scene.setGear(k, opt.crash ? 0 : opt.gear);
      });
      const autos = e.moves.map((o, k) => (o && e.auto && e.auto[k] ? COL[k].name : null)).filter(Boolean);
      if (autos.length) banner(`Guida il pilota automatico: ${autos.join(', ')}`, 900);
      if (await play(list, ev)) {
        busy = false;
        return;
      }
      continue;
    }
  }
  if (instant) race.cars.forEach((c, i) => scene.jumpCar(i, c));
  busy = false;
  if (s.phase === 'finished') {
    if (race.phase === 'over') {
      if (instant) win(race.winner);
    } else {
      scene.clearMarks();
      $('winT').textContent = 'Gara finita';
      $('winT').style.color = '#fff';
      $('winS').textContent = 'Nessuno muoveva più: la gara si è chiusa da sola.';
      netOverButtons();
      $('over').hidden = false;
    }
    return;
  }
  refresh();
}
function netState(d) {
  if (!d.state || !d.track) return;
  // gara aperta con regole diverse da quelle di questa pagina (rilascio a gara in corso): si dice cosa fare invece di
  // rifare le mosse con regole sbagliate (analisi 10.14)
  if (d.state.rules && d.state.rules !== R.RULES_VERSION) {
    $('rcHelp').textContent = 'Il gioco è stato aggiornato: chiudi e riapri Binottoland dal bot.';
    toast('Il gioco è stato aggiornato: chiudi e riapri Binottoland dal bot.');
    return;
  }
  if (typeof d.skew === 'number') {
    if (net) net.skew = d.skew;
  }
  netChain = netChain
    .then(async () => {
      if (!net || net.room !== d.state.room) await netOpen(d.state, d.track);
      if (typeof d.skew === 'number') net.skew = d.skew;
      if (d.state.revision < net.state.revision) return;
      net.state = d.state;
      await netSync();
    })
    .catch(err => {
      console.error(err);
      busy = false;
    });
}
$('netGo').onclick = () => {
  $('netGo').hidden = true;
  toApp('action', { kind: $('netGo').dataset.kind === 'join' ? 'join' : 'start' });
};
$('netClose').onclick = () => {
  const kind = netCloseKind(),
    b = $('netClose');
  if (!kind) return;
  // abbandonare chiede conferma: la gara continua senza di te
  if (kind === 'abandon' && !b.dataset.sure) {
    b.dataset.sure = '1';
    b.textContent = `Sicuro? ${Tap} di nuovo per abbandonare`;
    return;
  }
  b.dataset.sure = '';
  $('menu').hidden = true;
  toApp('action', { kind });
};
// avvisi: nel disegno in basso, in gara in alto
const say = m => ($('rc').classList.contains('on') ? banner(esc(m), 2400) : toast(m));

// Dentro Binottoland Playground: margini e tasto Indietro arrivano dall'app; «Esci» torna al Playground
if (embedded) {
  for (const id of ['exitB', 'exitB2']) {
    const b = $(id);
    if (b) {
      b.hidden = false;
      b.onclick = () => toApp('exit');
    }
  }
  const inRace = () => $('rc').classList.contains('on');
  const back = () => {
    if (!$('menu').hidden) $('menu').hidden = true;
    else if (!$('over').hidden) {
      if (net) toApp('exit');
      else newTrack();
    } else if (inRace()) $('menu').hidden = false;
    else if ($('setup').hidden)
      $('setup').hidden = false; // dal disegno torna a «Nuova gara»
    else toApp('exit');
  };
  window.addEventListener('message', e => {
    if (e.source !== window.parent || e.origin !== location.origin) return;
    const d = e.data || {};
    if (d.type === 'f1:insets' && d.insets) {
      const s = document.documentElement.style,
        v = k => {
          const o = d.insets[k] || {};
          return (Number(o.system) || 0) + (Number(o.content) || 0);
        };
      s.setProperty('--st', v('top') + 'px');
      s.setProperty('--sb', v('bottom') + 'px');
      s.setProperty('--sl', v('left') + 'px');
      s.setProperty('--sr', v('right') + 'px');
    } else if (d.type === 'f1:back') back();
    else if (d.type === 'f1:identity' && typeof d.player === 'string') {
      me = { player: d.player, name: String(d.name || '') };
      $('who').textContent = 'Pilota: ' + me.name;
      $('who').hidden = !me.name;
    } else if (d.type === 'f1:state') netState(d);
    // rete persa o sessione scaduta: l'app lo ripete a ogni tentativo fallito, poi dice quando è tornata
    else if (d.type === 'f1:net') say(String(d.message || ''));
    else if (d.type === 'f1:error') {
      busy = false;
      $('go').disabled = false;
      say(String(d.message || 'Errore'));
      if (net && race) refresh();
      else if (net) netSync();
    }
  });
  // l'app chiede conferma prima di chiudere Telegram solo mentre si corre
  let racing = null;
  const sync = () => {
    const on = inRace() && !!race && race.phase !== 'over';
    if (on !== racing) {
      racing = on;
      toApp('racing', { on });
    }
  };
  const mo = new MutationObserver(sync);
  mo.observe($('over'), { attributes: true, attributeFilter: ['hidden'] });
  mo.observe($('rc'), { attributes: true, attributeFilter: ['class'] });
  toApp('ready');
}

// avvio
setStep(1);
ed.setBoard(R.boardSize());
ed.resize();
ed.setZoom(R.startCells(draft.players));
syncZoom();
// solo per le prove (?dev), come in Acquedotto: prima era sempre a disposizione della pagina
if (new URLSearchParams(location.search).has('dev'))
  window.__gara = {
    draft,
    ed,
    R,
    startRace,
    get race() {
      return race;
    },
    get scene() {
      return scene;
    },
    pick
  };
