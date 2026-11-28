// Ruggine 89: corsa con combattimento nel deserto. Tre auto, tre giri, colpi che stordiscono, bidoni di nitro.
import * as THREE from 'three';
import { EffectComposer } from '../vendor/three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from '../vendor/three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../vendor/three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from '../vendor/three/addons/postprocessing/OutputPass.js';
import {
  N,
  HALF,
  frame,
  at,
  buildWorld,
  drawTrack,
  rnd,
  LEVEL,
  MAX_LEVEL,
  LEVEL_KEY
} from './world.js?v=ef9bc19a2d';
import { Car, drive, aiInput, bump, Shots, levelSetup, PLAYER_START } from './cars.js?v=7b1562fbc6';
import { FX } from './fx.js?v=c05c5dd7b1';
import { Sfx } from './sound.js?v=3b89da4c4e';
import { isTouchDevice } from '../touch-device.js';

const $ = id => document.getElementById(id);
const LAPS = 3;
// livello: pista e avversari cambiano a ogni livello (world.js, cars.js); il livello 1 è il GP della Raffineria
const RACE_NAME = LEVEL === 1 ? 'GP della Raffineria' : 'Raffineria · livello ' + LEVEL;
const rivals = levelSetup(LEVEL);
// telefono o computer: deciso in un solo punto per tutta l'app (touch-device.js, analisi 10.12)
const touch = isTouchDevice();
document.body.classList.toggle('touch', touch);

// ---------- margini del telefono: li manda Binottoland (arcade-link.js); il gioco non parla più con Telegram ----------
const px = v => (Number.isFinite(+v) ? Math.max(0, Math.min(200, +v)) : 0);
function setInsets(ins) {
  const s = document.documentElement.style;
  for (const k of ['top', 'bottom', 'left', 'right']) {
    const o = ins[k];
    s.setProperty('--s' + k[0], (typeof o === 'object' && o ? px(o.system) + px(o.content) : px(o)) + 'px');
  }
}
addEventListener('message', e => {
  if (e.source === window.parent && e.data && e.data.insets) setInsets(e.data.insets);
});

// ---------- grafica ----------
const quality = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) ? 'media' : 'alta';
const host = $('gl');
// se la grafica 3D non parte si dice perché, invece di lasciare il tasto fermo su «Caricamento» (analisi 10.13);
// l'errore arriva anche al registro di Debug (frame-errors.js)
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
} catch (e) {
  $('action').textContent = 'Grafica 3D non disponibile su questo dispositivo';
  throw e;
}
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, quality === 'alta' ? 2 : 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
host.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, 0.5, 900);
const world = buildWorld(scene, renderer, quality);
const fx = new FX(scene);
const sfx = new Sfx();
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.45, 0.5, 0.92);
// bagliori solo con la grafica alta: sui telefoni pesano molto (analisi 10.8)
if (quality === 'alta') composer.addPass(bloom);
composer.addPass(new OutputPass());

function resize() {
  const w = host.clientWidth || 1,
    h = host.clientHeight || 1;
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(host);
resize();

// minimappa
const mini = $('mini'),
  mg = mini.getContext('2d');
const trackImg = document.createElement('canvas');
trackImg.width = mini.width;
trackImg.height = mini.height;
const toMini = drawTrack(trackImg.getContext('2d'), mini.width, mini.height);

// ---------- auto ----------
const cars = [
  new Car(scene, 0xffbd20, 89, 'Tu', false),
  ...rivals.map(r => new Car(scene, r.color, r.num, r.name, true))
];
const player = cars[0];
const shots = new Shots(scene);

// bidoni di nitro sul tracciato: si raccolgono passandoci sopra, ricompaiono dopo un po'
const canGeo = new THREE.BoxGeometry(0.7, 0.9, 0.45);
const canMat = new THREE.MeshStandardMaterial({
  color: '#c0321f',
  emissive: '#ff5a1a',
  emissiveIntensity: 0.6,
  roughness: 0.4,
  metalness: 0.5
});
const ringMat = new THREE.MeshBasicMaterial({
  color: new THREE.Color('#ffb347').multiplyScalar(1.6),
  transparent: true,
  opacity: 0.7,
  depthWrite: false
});
const pickups = [70, 150, 260, 340, 430].map((i, k) => {
  const f = frame(i),
    lane = (k % 2 ? -1 : 1) * 2.2;
  const g = new THREE.Group();
  const can = new THREE.Mesh(canGeo, canMat);
  can.position.y = 0.7;
  can.castShadow = true;
  g.add(can);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.1, 32), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.05;
  g.add(ring);
  g.position.set(f.x + f.nx * lane, 0, f.z + f.nz * lane);
  scene.add(g);
  return { g, can, x: g.position.x, z: g.position.z, wait: 0 };
});

// ---------- stato della gara ----------
let mode = 'grid',
  beforePause = 'race',
  count = 0,
  time = 0,
  view = 'follow',
  finishOrder = [];
function reset() {
  shots.clear();
  cars[0].place(...PLAYER_START);
  rivals.forEach((r, k) => cars[k + 1].place(...r.start));
  cars.forEach((c, j) => {
    c.skill = j === 0 ? 1 : rivals[j - 1].skill;
    c.aggr = j === 0 ? 1 : rivals[j - 1].aggr;
    c.finishTime = 0;
    c.lapStart = 0;
  });
  for (const p of pickups) {
    p.wait = 0;
    p.g.visible = true;
  }
  count = 3.2;
  time = 0;
  finishOrder = [];
  mode = 'count';
  $('title').textContent = 'GP della Raffineria';
  $('action').textContent = 'Pausa';
  $('action').disabled = false;
  $('sheet').hidden = true;
  setLamps(0);
  hud();
}
function setLamps(n, go) {
  world.lamps.forEach((l, i) => {
    l.material.emissive.set(go ? '#3dff6a' : '#ff2a12');
    l.material.emissiveIntensity = go ? 3 : i < n ? 3 : 0;
  });
}

// ---------- comandi ----------
const keys = new Set(),
  fingers = new Map();
const bindings = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  Space: 'fire',
  ShiftLeft: 'nitro',
  ShiftRight: 'nitro'
};
const active = k => keys.has(k) || [...fingers.values()].includes(k);
addEventListener('keydown', e => {
  sfx.unlock();
  if (bindings[e.code]) {
    e.preventDefault();
    keys.add(bindings[e.code]);
  } else if ((e.code === 'Escape' || e.code === 'KeyP') && !e.repeat) action();
  else if (e.code === 'KeyV' && !e.repeat) toggleView();
});
addEventListener('keyup', e => keys.delete(bindings[e.code]));
document.querySelectorAll('[data-key]').forEach(btn => {
  btn.onpointerdown = e => {
    e.preventDefault();
    sfx.unlock();
    try {
      btn.setPointerCapture(e.pointerId);
    } catch (err) {
      /* niente */
    }
    fingers.set(e.pointerId, btn.dataset.key);
    btn.classList.add('held');
  };
  btn.onlostpointercapture =
    btn.onpointerup =
    btn.onpointercancel =
      e => {
        fingers.delete(e.pointerId);
        btn.classList.remove('held');
      };
});
addEventListener('pointerdown', () => sfx.unlock(), { capture: true });

function pause() {
  if (mode === 'race' || mode === 'count') {
    beforePause = mode;
    mode = 'pause';
    keys.clear();
    fingers.clear();
    $('signal').textContent = 'PAUSA';
    $('action').textContent = 'Riprendi';
  }
}
function action() {
  sfx.unlock();
  if (mode === 'pause') {
    mode = beforePause;
    $('action').textContent = 'Pausa';
    $('signal').textContent = '';
  } else if (mode === 'race' || mode === 'count') pause();
  else reset();
}
$('action').onclick = action;
let nextLevel = false;
$('sheetGo').onclick = () => {
  sfx.unlock();
  if (nextLevel) return goToLevel(LEVEL + 1);
  reset();
};
// cambia livello ricaricando la pagina con ?livello=N: strada, muri e minimappa si costruiscono sulla pista nuova
function goToLevel(level) {
  const u = new URL(location.href);
  u.searchParams.set('livello', String(level));
  location.replace(u.href);
}
$('levelOne').onclick = () => {
  try {
    localStorage.setItem(LEVEL_KEY, '1');
  } catch {
    /* niente memoria: basta l'indirizzo */
  }
  goToLevel(1);
};
function toggleView() {
  view = view === 'follow' ? 'top' : 'follow';
  $('viewB').textContent = view === 'follow' ? 'Vista' : 'Segui';
}
$('viewB').onclick = toggleView;
const sndLabel = () => {
  $('sndB').textContent = sfx.on ? '🔊' : '🔇';
};
$('sndB').onclick = () => {
  sfx.unlock();
  sfx.toggle();
  sndLabel();
};
sndLabel();
addEventListener('blur', pause);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pause();
});

// ---------- gara ----------
const kmh = v => Math.round(Math.abs(v) * 7.2);
function hud() {
  const order = cars
    .slice()
    .sort((a, b) =>
      b.finish && a.finish
        ? a.finishTime - b.finishTime
        : b.finish
          ? 1
          : a.finish
            ? -1
            : b.progress - a.progress
    );
  const place = order.indexOf(player) + 1;
  $('lap').textContent = Math.min(LAPS, Math.max(1, 1 + Math.floor(player.progress / N))) + '/' + LAPS;
  $('pos').textContent = place + '/3';
  $('clock').textContent = Math.floor(time / 60) + ':' + (time % 60).toFixed(1).padStart(4, '0');
  $('kmh').textContent = kmh(player.v);
  $('nitro').firstElementChild.style.width = Math.min(100, (player.nitro || 0) * 100) + '%';
  return place;
}
function step(dt) {
  if (mode === 'count') {
    const before = Math.ceil(count);
    count -= dt;
    const n = Math.ceil(count);
    if (n !== before && n > 0) {
      sfx.beep(false);
      setLamps(4 - n);
    }
    $('signal').textContent = count > 0 ? (count < 3 ? n : '') : 'VIA!';
    if (count <= 0) {
      mode = 'race';
      setLamps(5, true);
      sfx.beep(true);
    }
    return;
  }
  if (mode !== 'race' && mode !== 'end') return;
  time += dt;
  if (time > 1.2 && mode === 'race') $('signal').textContent = '';
  for (const c of cars) {
    let input;
    if (c === player && mode === 'race') {
      input = {
        steer: Number(active('right')) - Number(active('left')),
        gas: active('up'),
        brake: active('down'),
        fire: active('fire')
      };
      if (active('nitro') && c.nitro >= 1) {
        c.boost = 2.2;
        c.nitro = 0;
        sfx.pickup();
      }
    } else if (c === player) input = { steer: 0, gas: false, brake: true };
    else input = aiInput(c, cars, dt);
    if (c.ai && c.nitro >= 1 && Math.random() < 0.01) {
      c.boost = 2.2;
      c.nitro = 0;
    }
    if (input.fire && shots.fire(c)) {
      sfx.shot(c === player ? 1 : 0.4);
      fx.burst(c.x + Math.cos(c.a) * 2.2, 0.95, c.z + Math.sin(c.a) * 2.2, 6, 0.4);
    }
    const wasLap = Math.floor(c.progress / N);
    drive(c, input, dt, cars);
    if (c.hitWall > 3) {
      fx.burst(c.x, 0.6, c.z, 8, 0.5);
      if (c === player) sfx.crash(c.hitWall);
    }
    if (Math.floor(c.progress / N) > wasLap && c.progress > 0 && c === player && !c.finish)
      $('signal').textContent = `GIRO ${Math.min(LAPS, wasLap + 2)}`;
    if (c.finish && !c.finishTime) {
      c.finishTime = time;
      finishOrder.push(c);
    }
    fx.wheels(c, dt);
    fx.exhaust(c);
  }
  bump(cars, (x, z, s) => {
    if (s > 3) {
      fx.burst(x, 0.7, z, 10, 0.6);
      sfx.crash(s);
    }
  });
  shots.update(dt, cars, (c, x, z) => {
    fx.burst(x, 1, z, 26, 1);
    sfx.hit();
    if (c === player) shake = 0.4;
  });
  // nitro
  for (const p of pickups) {
    if (p.wait > 0) {
      p.wait -= dt;
      if (p.wait <= 0) p.g.visible = true;
      continue;
    }
    const c = cars.find(o => Math.hypot(o.x - p.x, o.z - p.z) < 1.8);
    if (c) {
      c.nitro = 1;
      p.wait = 7;
      p.g.visible = false;
      if (c === player) {
        sfx.pickup();
        $('signal').textContent = touch ? 'NITRO!' : 'NITRO! (Shift)';
        setTimeout(() => {
          if (mode === 'race') $('signal').textContent = '';
        }, 1200);
      }
    }
  }
  const place = hud();
  if (player.finish && mode === 'race') {
    mode = 'end';
    $('signal').textContent = place === 1 ? 'VITTORIA!' : 'TRAGUARDO';
    $('title').textContent = 'Arrivo in ' + place + 'ª posizione';
    $('action').textContent = 'Rivincita';
    if (place === 1) sfx.win();
    setTimeout(showResults, 2200);
  }
}
function showResults() {
  if (mode !== 'end') return;
  const order = cars
    .slice()
    .sort((a, b) => (a.finishTime || 1e9) - (b.finishTime || 1e9) || b.progress - a.progress);
  $('sheetT').textContent =
    order[0] === player ? 'Hai vinto il GP!' : `Sei arrivato ${order.indexOf(player) + 1}º`;
  $('sheetS').textContent = RACE_NAME + ' · ' + LAPS + ' giri · ' + (cars.length - 1) + ' avversari';
  $('results').innerHTML = order
    .map(
      c =>
        `<li class="${c === player ? 'me' : ''}">${c.name} · ${c.finishTime ? Math.floor(c.finishTime / 60) + ':' + (c.finishTime % 60).toFixed(1).padStart(4, '0') : 'in gara'}</li>`
    )
    .join('');
  // vinto: si sblocca il livello dopo (salvato sul telefono); perso: si riprova lo stesso
  const won = order[0] === player && LEVEL < MAX_LEVEL;
  // gara vinta: 1 BTN (docs/gettoni.md)
  if (order[0] === player && window.parent !== window)
    parent.postMessage({ type: 'arcade:record', game: 'ruggine-89', win: true }, location.origin);
  if (won)
    try {
      localStorage.setItem(LEVEL_KEY, String(LEVEL + 1));
    } catch {
      /* senza memoria si passa lo stesso, con l'indirizzo */
    }
  nextLevel = won;
  $('sheetGo').textContent = won ? 'Livello ' + (LEVEL + 1) : 'Riprova';
  $('sheet').hidden = false;
}

// ---------- telecamera ----------
let shake = 0;
const camPos = new THREE.Vector3(0, 120, 60),
  camLook = new THREE.Vector3();
function updateCamera(dt) {
  const k = 1 - Math.exp(-dt * 3.2);
  let tp, tl;
  if (view === 'top' || mode === 'grid') {
    // tutto il circuito nello schermo, in orizzontale o in verticale
    // (in verticale la telecamera guarda da un fianco, così il lato lungo del circuito va lungo lo schermo)
    const portrait = camera.aspect < 0.9;
    const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)),
      hx = portrait ? 40 : 70,
      hz = portrait ? 68 : 42;
    const d = Math.max(hz / t, hx / (t * camera.aspect)) * 1.05;
    tp = portrait ? new THREE.Vector3(-d * 0.44, d * 0.9, 0) : new THREE.Vector3(0, d * 0.9, d * 0.44);
    tl = new THREE.Vector3(0, 0, 3);
  } else {
    // dall'alto e un po' dietro, sempre orientata a nord (come un gioco da sala); più veloce = più lontana
    const sp = Math.min(1, Math.abs(player.v) / 28);
    const lead = 4 + sp * 8;
    tl = new THREE.Vector3(player.x + Math.cos(player.a) * lead, 0, player.z + Math.sin(player.a) * lead);
    // in verticale la telecamera sta sul lato ovest: i rettilinei lunghi (est-ovest) vanno lungo lo schermo
    const portrait = camera.aspect < 0.9;
    const dist = (portrait ? 40 : 34) + sp * 10;
    tp = portrait
      ? new THREE.Vector3(tl.x - dist * 0.62, dist, tl.z)
      : new THREE.Vector3(tl.x, dist, tl.z + dist * 0.62);
  }
  camPos.lerp(tp, k);
  camLook.lerp(tl, k);
  camera.position.copy(camPos);
  if (shake > 0) {
    shake -= dt;
    camera.position.x += (Math.random() - 0.5) * shake * 1.5;
    camera.position.y += (Math.random() - 0.5) * shake;
  }
  camera.lookAt(camLook);
  // la foschia comincia dopo il circuito, qualunque sia la distanza della telecamera
  const cd = camera.position.distanceTo(camLook);
  scene.fog.near = cd * 0.9 + 40;
  scene.fog.far = cd * 1.6 + 260;
  // l'ombra del sole segue l'azione: da vicino copre poco spazio (più nitida), dall'alto tutto il circuito
  world.sun.target.position.set(camLook.x, 0, camLook.z);
  world.sun.position.set(camLook.x - 70, 85, camLook.z - 45);
  const sc = world.sun.shadow.camera,
    half = view === 'top' || mode === 'grid' ? 85 : 42;
  if (sc.right !== half) {
    sc.left = -half;
    sc.right = half;
    sc.top = half * 0.8;
    sc.bottom = -half * 0.8;
    sc.updateProjectionMatrix();
  }
}

function drawMini() {
  mg.clearRect(0, 0, mini.width, mini.height);
  mg.drawImage(trackImg, 0, 0);
  for (const c of cars.slice().reverse()) {
    const [x, y] = toMini(c.x, c.z);
    mg.fillStyle = '#' + new THREE.Color(c.color).getHexString();
    mg.strokeStyle = '#111';
    mg.lineWidth = 2;
    mg.beginPath();
    mg.arc(x, y, c === player ? 5 : 4, 0, 7);
    mg.fill();
    mg.stroke();
  }
}

// ---------- avvio ----------
reset();
mode = 'grid';
$('action').textContent = 'Parti';
$('signal').textContent = '';
$('sheetT').textContent = RACE_NAME;
$('levelOne').hidden = LEVEL === 1;
$('sheetS').textContent =
  (LEVEL > 1 ? 'Livello ' + LEVEL + ': ' + (cars.length - 1) + ' avversari, più veloci. ' : '') +
  (touch
    ? 'Sei la gialla n. 89. Gas e sterzo insieme per partire; Colpo stordisce chi hai davanti; i bidoni rossi danno il nitro (tocca Gas due volte per usarlo).'
    : 'Sei la gialla n. 89. WASD o frecce per guidare, Spazio per sparare, Shift per il nitro (prendi i bidoni rossi), V per la vista.');
$('results').innerHTML = '';
$('sheetGo').textContent = 'Corri';
$('sheet').hidden = false;
if (touch) $('hint').textContent = 'Sei la gialla · Colpo per stordire · doppio tocco su Gas = nitro';

// sul telefono il nitro si usa con un doppio tocco su Gas
let lastGas = 0;
document.querySelector('[data-key="up"]').addEventListener('pointerdown', () => {
  const now = performance.now();
  if (now - lastGas < 320 && player.nitro >= 1 && mode === 'race') {
    player.boost = 2.2;
    player.nitro = 0;
    sfx.pickup();
  }
  lastGas = now;
});

let last = performance.now(),
  acc = 0,
  clock = 0;
function loop(now) {
  requestAnimationFrame(loop);
  const real = Math.min(0.1, (now - last) / 1000);
  last = now;
  clock += real;
  acc += real;
  while (acc >= 1 / 60) {
    step(1 / 60);
    acc -= 1 / 60;
  }
  for (const c of cars) c.pose(real);
  // fiaccole che tremolano, fumo dei camini, bidoni che girano
  for (const f of world.flames) {
    const s = 0.85 + Math.sin(clock * 17 + f.h) * 0.12 + Math.random() * 0.1;
    f.mesh.scale.set(s, 0.9 + Math.random() * 0.3, s);
    f.light.intensity = 14 + Math.random() * 8;
  }
  for (const s of world.smokers) if (Math.random() < 0.35) fx.chimney(s.x, s.y, s.z);
  for (const p of pickups) {
    p.can.rotation.y += real * 2;
    p.can.position.y = 0.7 + Math.sin(clock * 3 + p.x) * 0.12;
  }
  fx.update(real);
  updateCamera(real);
  sfx.engine(
    player.v,
    active('up') && mode === 'race',
    player.slide || 0,
    mode === 'race' || mode === 'count' || mode === 'end'
  );
  drawMini();
  composer.render(real);
}
requestAnimationFrame(loop);

// per provare dalla console
// aggancio per le prove a mano, solo con ?dev (come nella Gara)
if (new URLSearchParams(location.search).has('dev'))
  window.ruggine = {
    cars,
    player,
    get mode() {
      return mode;
    },
    reset,
    scene,
    camera,
    renderer,
    keys,
    at,
    HALF,
    rnd
  };
