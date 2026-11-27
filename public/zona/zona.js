// Zona Operativa, tappa 1: poligono di tiro da soli (docs/zona-operativa.md). Niente server: tutto qui nel browser,
// con le regole di rules.js (le stesse che userà il server dalla tappa 2).
import * as THREE from 'three';
import { GLTFLoader } from '../vendor/three/addons/loaders/GLTFLoader.js';
import { WEAPONS, damage, rng, newGun, tickGun, tryFire, startReload, pelletDirs, rayWorld, newBody, moveStep, eyeHeight, lookDir, targetHit } from './rules.js?v=79c25dfc2d';
import { POLIGONO, TAKE_RADIUS } from './map-poligono.js?v=4f0b9d8f55';
import { createControls } from './controls.js?v=e180132236';
import { createViewmodel } from './viewmodel.js?v=af06afbe4f';
import * as sfx from './audio.js?v=337aee686c';
import { createNet } from './net.js?v=5cd00f6ceb';
import { createSoldiers, ARMI } from './soldiers.js?v=cb5e951769';

const $ = id => document.getElementById(id);
const SETTINGS_KEY = 'zona-impostazioni';
const settings = (() => {
  try {
    return { sens: 1, volume: 0.8, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') };
  } catch {
    return { sens: 1, volume: 0.8 };
  }
})();
const saveSettings = () => {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {}
};

// ---------- grafica ----------
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.autoClear = false;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x15171a);
scene.add(new THREE.HemisphereLight(0xfff6e8, 0x8a8478, 1.3));
scene.add(new THREE.AmbientLight(0xffffff, 0.35));
const lamp = new THREE.DirectionalLight(0xffffff, 0.9);
lamp.position.set(2, 6, -3);
scene.add(lamp);
const BASE_FOV = 72;
const camera = new THREE.PerspectiveCamera(BASE_FOV, innerWidth / innerHeight, 0.05, 200);
camera.rotation.order = 'YXZ';
const muzzleLight = new THREE.PointLight(0xffc46b, 0, 6);
scene.add(muzzleLight);

function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  vm?.setAspect(camera.aspect);
}
addEventListener('resize', resize);

// ---------- caricamento ----------
const loader = new GLTFLoader();
const load = name =>
  new Promise((ok, ko) =>
    loader.load(new URL('models/' + name, import.meta.url).href, ok, e => {
      if (e.total) $('caricamento-testo').textContent = 'Carico ' + name.replace('.glb', '') + '… ' + Math.round((e.loaded / e.total) * 100) + '%';
    }, ko)
  );

let vm = null;
const targets = [];
const tables = [];
const decals = [];
let ready = false;

const [poligono, armi, soldati] = await Promise.all([load('poligono.glb'), load('armi.glb'), load('soldati.glb')]).catch(e => {
  $('caricamento-testo').innerHTML = 'Non riesco a caricare il gioco. <button id="esci-errore" type="button">Esci</button>';
  $('esci-errore').onclick = () => parent.postMessage({ type: 'zona-exit' }, location.origin);
  throw e;
});
scene.add(poligono.scene);
poligono.scene.traverse(o => {
  if (o.isMesh && o.name === 'neon') o.material = new THREE.MeshBasicMaterial({ color: 0xfff7e6 });
  if (o.name.startsWith('sagoma_c')) targets.push({ node: o, x: o.position.x, y: o.position.y, z: o.position.z, angle: 0, down: 0, hits: 0 });
});
vm = createViewmodel(armi, innerWidth / innerHeight, 'blu');

// ---------- poligono condiviso: si vedono gli altri che sono qui ----------
// Il server (zona-server.js, stanza «poligono») passa soltanto posizioni e spari: niente fuoco amico, i colpi
// attraversano i giocatori e valgono solo per sagome e muri; le sagome sono di ognuno.
const soldiers = createSoldiers(scene, soldati, vm.worldModels);
const names = new Map();
let me = null;
const net = createNet({
  world: null,
  body: newBody(0, 0, 0),
  onMessage(m) {
    if (m.t === 'ciao') me = m.id;
    if (m.t !== 's') return;
    for (const r of m.sc) names.set(r[0], r[1]);
    for (const e of m.ev) {
      if (e.e === 'spara' && e.id !== me) {
        const d = soldiers.shot(e.id, e.w, camera.position);
        if (d !== null) sfx.shot(e.w, Math.min(1, 9 / Math.max(9, d)));
      }
    }
    soldiers.prune(new Set(m.p.map(p => p[0])));
  }
});
if (net.inFrame) net.connect('poligono');
let poseAt = 0;
addEventListener('pagehide', () => net.disconnect());
poligono.scene.traverse(o => {
  const m = /^tavolo_(\w+)$/.exec(o.name);
  if (m && vm.worldModels[m[1]]) {
    const w = vm.worldModels[m[1]].clone(true);
    w.position.copy(o.position).add(new THREE.Vector3(0, 0.12, 0));
    w.rotation.y = Math.PI / 2; // canna verso il fondo della sala, come su una rastrelliera
    scene.add(w);
    tables.push({ weapon: m[1], x: o.position.x, z: o.position.z });
  }
  if (o.name === 'cassa_medica_1' && vm.worldModels.cassa_medica) {
    const c = vm.worldModels.cassa_medica.clone(true);
    c.position.copy(o.position);
    c.rotation.y = Math.PI / 2;
    scene.add(c);
  }
});
resize();

// ---------- giocatore ----------
const S = POLIGONO.start;
const body = newBody(S.x, S.y, S.z, S.yaw);
const controls = createControls(canvas, uiRefs(), { onMenu: show => showMenu(show) });
controls.yaw = S.yaw;
controls.sens = settings.sens;
sfx.setVolume(settings.volume);
const guns = { baretta: newGun('baretta'), coltello: newGun('coltello') };
const slots = { 1: null, 2: 'baretta', 3: 'coltello' };
let current = 'baretta';
let last = 'coltello';
let fireHeld = false;
let kick = 0; // rinculo della vista (radianti, torna da solo)
let kickYaw = 0;
const random = rng(2026);
const stats = { shots: 0, hits: 0, heads: 0, points: 0 };
let challenge = null; // {left}
let lastResult = null;
let stepT = 0;
let prevLook = { yaw: S.yaw, pitch: 0 };
vm.setWeapon(current);

function uiRefs() {
  return {
    touch: $('tocco'),
    stickBase: $('levetta'),
    stickKnob: $('levetta').firstElementChild,
    btnFire: $('t-spara'),
    btnAim: $('t-mira'),
    btnReload: $('t-ricarica'),
    btnJump: $('t-salta'),
    btnCrouch: $('t-giu'),
    btnSwitch: $('t-arma'),
    btnTake: $('t-prendi')
  };
}

function select(name) {
  if (!name || name === current || !guns[name]) return;
  last = current;
  current = name;
  controls.aim = false;
  vm.setWeapon(name);
  sfx.pickup();
}

function nearestTable() {
  let best = null;
  for (const t of tables) {
    const d = Math.hypot(t.x - body.x, t.z - body.z);
    if (d < TAKE_RADIUS && (!best || d < best.d)) best = { ...t, d };
  }
  return best;
}

function take(weapon) {
  const w = WEAPONS[weapon];
  if (w.slot === 1) {
    if (slots[1] && slots[1] !== weapon) delete guns[slots[1]];
    slots[1] = weapon;
  }
  guns[weapon] = newGun(weapon);
  current = null;
  select(weapon);
}

// ---------- colpi ----------
const hitMarker = $('segno');
let markerT = 0;
function showHit(zone, amount, at) {
  hitMarker.className = 'on ' + (zone === 'testa' ? 'testa' : '');
  markerT = 0.18;
  const p = at.clone().project(camera);
  if (p.z > 1) return;
  const s = document.createElement('span');
  s.textContent = amount + (zone === 'testa' ? ' TESTA' : '');
  if (zone === 'testa') s.className = 'testa';
  s.style.left = ((p.x + 1) / 2) * innerWidth + 'px';
  s.style.top = ((1 - p.y) / 2) * innerHeight + 'px';
  $('danni').append(s);
  setTimeout(() => s.remove(), 800);
}

const decalGeo = new THREE.CircleGeometry(0.025, 8);
const decalMat = new THREE.MeshBasicMaterial({ color: 0x141210, transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
function decal(point, box) {
  // la faccia colpita è quella più vicina al punto
  const faces = [
    [Math.abs(point.x - box.min[0]), new THREE.Vector3(-1, 0, 0)],
    [Math.abs(point.x - box.max[0]), new THREE.Vector3(1, 0, 0)],
    [Math.abs(point.y - box.min[1]), new THREE.Vector3(0, -1, 0)],
    [Math.abs(point.y - box.max[1]), new THREE.Vector3(0, 1, 0)],
    [Math.abs(point.z - box.min[2]), new THREE.Vector3(0, 0, -1)],
    [Math.abs(point.z - box.max[2]), new THREE.Vector3(0, 0, 1)]
  ].sort((a, b) => a[0] - b[0]);
  const n = faces[0][1];
  const m = decals.length >= 80 ? decals.shift() : new THREE.Mesh(decalGeo, decalMat);
  m.position.copy(point).addScaledVector(n, 0.003);
  m.lookAt(point.clone().add(n));
  scene.add(m);
  decals.push(m);
}

function shoot() {
  const w = WEAPONS[current];
  const eye = { x: body.x, y: eyeHeight(body), z: body.z };
  const dir = lookDir(controls.yaw + kickYaw, controls.pitch + kick);
  const moving = Math.hypot(body.vx, body.vz) > 1;
  let spread = current === 'falco' && controls.aim ? w.scopedSpread : w.spread;
  if (!w.melee) {
    if (!body.onGround) spread *= 3;
    else if (moving && current !== 'tuono') spread *= 2;
    if (body.crouch) spread *= 0.7;
  }
  const dirs = pelletDirs(dir, spread, w.pellets, random);
  stats.shots += 1;
  let any = null;
  let total = 0;
  for (const d of dirs) {
    const maxT = w.melee ? w.range : 300;
    const wall = rayWorld(eye, d, POLIGONO.boxes, maxT);
    let best = null;
    for (const t of targets) {
      if (t.down > 0 || t.angle > 0.2) continue;
      const h = targetHit(eye, d, t, wall ? wall.t : maxT);
      if (h && (!best || h.t < best.h.t)) best = { t, h };
    }
    if (best) {
      const amount = damage(current, best.h.zone, best.h.t);
      total += amount;
      if (!any || best.h.zone === 'testa') any = { ...best, amount };
      best.t.down = 2.5;
      best.t.hits += 1;
    } else if (wall) {
      const p = new THREE.Vector3(eye.x + d.x * wall.t, eye.y + d.y * wall.t, eye.z + d.z * wall.t);
      if (!w.melee || wall.t <= w.range) decal(p, wall.box);
    }
  }
  if (any) {
    stats.hits += 1;
    if (any.h.zone === 'testa') stats.heads += 1;
    stats.points += any.h.zone === 'testa' ? 3 : 1;
    const t = any.t;
    showHit(any.h.zone, w.pellets > 1 ? total : any.amount, new THREE.Vector3(t.x, t.y + (any.h.zone === 'testa' ? 1.43 : 0.9), t.z));
    sfx.targetHit(any.h.zone);
  }
  // rinculo della vista
  const K = { baretta: 0.02, calabrone: 0.009, tuono: 0.07, ruggito: 0.013, falco: 0.09, coltello: 0 };
  kick += K[current];
  kickYaw += (random() - 0.5) * K[current] * 0.4;
  if (!w.melee) {
    muzzleLight.intensity = 3;
    muzzleLight.position.set(eye.x + dir.x * 0.6, eye.y - 0.1, eye.z + dir.z * 0.6);
  }
  vm.fire();
  sfx.shot(current);
  if (net.inFrame) net.send({ t: 'spara', w: current });
  if (current === 'tuono') sfx.pump();
  if (current === 'falco') controls.aim = false; // dopo il colpo si toglie il mirino per tirare l'otturatore
}

// ---------- interfaccia ----------
function showMenu(show) {
  $('menu').hidden = !show;
  $('caricamento').hidden = true;
  $('hud').hidden = show || !ready;
  if (controls) controls.active = !show && ready;
  if (show) {
    controls && (controls.fire = false);
    $('gioca').textContent = started ? 'Riprendi' : 'Gioca';
    const r = $('risultato');
    r.hidden = !lastResult;
    if (lastResult) r.innerHTML = lastResult;
  }
}

$('comandi').innerHTML = matchMedia('(pointer: coarse)').matches
  ? 'Levetta a sinistra per muoverti, trascina a destra per guardare. SPARA, MIRA (Falco), RIC. ricarica, ARMA cambia arma, PRENDI vicino al bancone.'
  : 'W A S D muoversi · mouse guardare · clic sinistro sparare · clic destro mirino (Falco) · R ricarica · E prendi un\'arma dal bancone · 1 2 3 armi, rotella, Q ultima · Spazio salta · Ctrl o C accucciato · Maiusc passo lento · Esc menù';
$('sens').value = settings.sens;
$('volume').value = settings.volume;
$('sens').oninput = e => {
  settings.sens = controls.sens = +e.target.value;
  saveSettings();
};
$('volume').oninput = e => {
  settings.volume = +e.target.value;
  sfx.setVolume(settings.volume);
  saveSettings();
};
let started = false;
function play() {
  started = true;
  sfx.unlockAudio();
  showMenu(false);
  controls.lock();
}
$('gioca').onclick = play;
$('sfida-via').onclick = () => {
  Object.assign(stats, { shots: 0, hits: 0, heads: 0, points: 0 });
  for (const t of targets) t.down = 0;
  challenge = { left: 60 };
  play();
};
// la partita online sul deserto: stessa pagina con ?online (main.js)
$('cambia').onclick = () => {
  net.disconnect();
  document.exitPointerLock?.();
  location.search = '?online=1';
};
$('esci').onclick = () => {
  net.disconnect();
  document.exitPointerLock?.();
  parent.postMessage({ type: 'zona-exit' }, location.origin);
};
$('t-menu').addEventListener('click', () => showMenu(true));
addEventListener('keydown', e => {
  if (e.code === 'Escape' && controls.touch) showMenu($('menu').hidden);
});

function updateHud() {
  const w = WEAPONS[current];
  const g = guns[current];
  $('arma-nome').textContent = w.name;
  $('arma-colpi').innerHTML = w.melee ? '—' : g.ammo + ' <small>/ ∞</small>';
  $('arma-stato').textContent = g.reloading > 0 ? 'Ricarica…' : g.ammo === 0 && !w.melee ? 'R per ricaricare' : '';
  const acc = stats.shots ? Math.round((stats.hits / stats.shots) * 100) : 0;
  $('conti').innerHTML = `Punti <b>${stats.points}</b> · A segno <b>${stats.hits}</b>/${stats.shots} · Testa <b>${stats.heads}</b> · Precisione <b>${acc}%</b>`;
  const near = nearestTable();
  const offer = near && !(guns[near.weapon] && current === near.weapon);
  $('avviso').hidden = !offer;
  $('t-prendi').hidden = !offer || !controls.touch;
  if (offer) $('avviso').textContent = (controls.touch ? 'PRENDI: ' : 'E: prendi ') + WEAPONS[near.weapon].name;
  $('sfida').hidden = !challenge;
  if (challenge) $('sfida').textContent = Math.ceil(challenge.left) + ' s';
  // mirino: si allarga con la dispersione
  const moving = Math.hypot(body.vx, body.vz) > 1;
  const gap = 4 + w.spread * 400 * (body.onGround ? (moving ? 2 : 1) : 3) * (body.crouch ? 0.7 : 1);
  $('m-s').style.left = -gap - 8 + 'px';
  $('m-d').style.left = gap + 'px';
  $('m-a').style.top = -gap - 8 + 'px';
  $('m-b').style.top = gap + 'px';
  const scoped = current === 'falco' && controls.aim;
  $('cannocchiale').hidden = !scoped;
  $('mirino').classList.toggle('nascosto', scoped || w.melee);
  $('t-mira').hidden = current !== 'falco' || !controls.touch;
}

// ---------- ciclo ----------
let lastT = performance.now();
let time = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  time += dt;
  const playing = $('menu').hidden && ready;
  if (playing) step(dt);
  // vista
  const eyeY = eyeHeight(body);
  camera.position.set(body.x, eyeY, body.z);
  camera.rotation.set(controls.pitch + kick, controls.yaw + kickYaw, 0);
  const scoped = current === 'falco' && controls.aim;
  const fov = scoped ? BASE_FOV / WEAPONS.falco.zoom : BASE_FOV;
  if (Math.abs(camera.fov - fov) > 0.01) {
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }
  controls.zoom = scoped ? 1 / WEAPONS.falco.zoom : 1;
  vm.setVisible(!scoped);
  const look = { x: angleDiff(controls.yaw, prevLook.yaw), y: controls.pitch - prevLook.pitch };
  prevLook = { yaw: controls.yaw, pitch: controls.pitch };
  vm.update(dt, Math.min(1, Math.hypot(body.vx, body.vz) / 5) * (body.onGround ? 1 : 0), { x: -Math.max(-0.05, Math.min(0.05, look.x)), y: Math.max(-0.05, Math.min(0.05, look.y)) }, time);
  muzzleLight.intensity = Math.max(0, muzzleLight.intensity - dt * 60);
  kick *= Math.max(0, 1 - dt * 9);
  kickYaw *= Math.max(0, 1 - dt * 9);
  if (markerT > 0 && (markerT -= dt) <= 0) hitMarker.className = '';
  for (const t of targets) {
    if (t.down > 0) {
      t.down -= playing ? dt : 0;
      t.angle = Math.min(1.45, t.angle + dt * 12);
    } else t.angle = Math.max(0, t.angle - dt * 4);
    t.node.rotation.x = t.angle;
  }
  // gli altri nel poligono (100 ms nel passato) e, 20 volte al secondo, dove sono io
  soldiers.update(net.others(net.viewTime(), me), dt, names);
  if (net.inFrame && now - poseAt >= 50) {
    poseAt = now;
    const p = [body.x, body.y, body.z, controls.yaw, controls.pitch, (body.crouch ? 1 : 0) | (body.onGround ? 4 : 0), ARMI.indexOf(current)];
    net.send({ t: 'posa', p: p.map(v => +v.toFixed(3)) });
  }
  renderer.clear();
  renderer.render(scene, camera);
  renderer.clearDepth();
  renderer.render(vm.scene, vm.camera);
}
const angleDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

function step(dt) {
  const input = controls.read();
  moveStep(body, input, dt, POLIGONO.boxes);
  const speed = Math.hypot(body.vx, body.vz);
  if (body.onGround && speed > 3 && (stepT -= dt) <= 0) {
    sfx.step();
    stepT = 0.36;
  }
  // armi
  for (const g of Object.values(guns)) if (tickGun(g, dt) === 'ricaricata' && g === guns[current] && g.weapon === 'tuono') sfx.click();
  if (controls.take('ricarica') && startReload(guns[current])) beginReload();
  if (controls.take('prendi')) {
    const near = nearestTable();
    if (near) take(near.weapon);
  }
  for (const n of [1, 2, 3]) if (controls.take('slot' + n)) select(slots[n]);
  if (controls.take('ultima')) select(last);
  const order = [slots[1], 'baretta', 'coltello'].filter(Boolean);
  if (controls.take('prossima')) select(order[(order.indexOf(current) + 1) % order.length]);
  if (controls.take('precedente')) select(order[(order.indexOf(current) + order.length - 1) % order.length]);
  const w = WEAPONS[current];
  const g = guns[current];
  const wantFire = controls.fire && (w.auto || !fireHeld);
  fireHeld = controls.fire;
  if (wantFire) {
    const wasReloading = g.reloading > 0;
    const r = tryFire(g);
    if (r === 'spara') {
      shoot();
      if (g.reloading > 0 && !wasReloading) beginReload();
    } else if (r === 'vuoto') {
      sfx.click();
      beginReload();
    }
  }
  if (challenge) {
    challenge.left -= dt;
    if (challenge.left <= 0) {
      const acc = stats.shots ? Math.round((stats.hits / stats.shots) * 100) : 0;
      lastResult = `<b>Sfida finita:</b> ${stats.points} punti · ${stats.hits} a segno su ${stats.shots} · ${stats.heads} in testa · precisione ${acc}%`;
      challenge = null;
      document.exitPointerLock?.();
      showMenu(true);
    }
  }
  updateHud();
}

function beginReload() {
  const g = guns[current];
  const w = WEAPONS[current];
  const total = w.perShell ? (w.mag - g.ammo) * w.reload : w.reload;
  vm.reload(Math.max(0.4, total));
  sfx.reload(current);
}

// per le prove nell'anteprima (stato in sola lettura, niente comandi nascosti)
globalThis.zonaStato = () => ({ body: { ...body }, current, ammo: guns[current].ammo, stats: { ...stats }, targetsDown: targets.filter(t => t.down > 0).length });
// solo nell'anteprima locale: sparare senza il puntatore bloccato (le prove automatiche non possono bloccarlo)
if (location.hostname === 'localhost') globalThis.zonaProvaSparo = on => (controls.fire = on);
ready = true;
$('caricamento').hidden = true;
showMenu(true);
requestAnimationFrame(frame);
