// Zona Operativa, tappa 2: la partita online sulla mappa del deserto, Tutti contro tutti (docs/zona-operativa.md).
// Qui si disegna e si comanda; chi colpisce chi, la salute, le armi a terra e il tempo li decide il server
// (zona-server.js). Il collegamento passa dall'app (zona-link.js), il movimento si prevede con net.js.
import * as THREE from 'three';
import { GLTFLoader } from '../vendor/three/addons/loaders/GLTFLoader.js';
import { Sky } from '../vendor/three/addons/objects/Sky.js';
import {
  WEAPONS,
  PLAYER,
  newGun,
  tickGun,
  tryFire,
  startReload,
  makeWorld,
  newBody,
  eyeHeight,
  lookDir,
  spreadFor,
  pelletDirs,
  rng
} from './rules.js?v=d4fc18028a';
import { BOXES, GROUND } from './map-deserto.js?v=e3be3291bf';
import { createControls } from './controls.js?v=87c4fd76d3';
import { createViewmodel } from './viewmodel.js?v=2afebbe580';
import { createNet, DT } from './net.js?v=ba2d34e023';
import * as sfx from './audio.js?v=337aee686c';

const $ = id => document.getElementById(id);
// gli stessi numeri del server (zona-server.js): ordine delle armi e bit dei comandi
import { createSoldiers, ARMI, COLORS } from './soldiers.js?v=a121bc0992';
const BIT = { jump: 1, crouch: 2, walk: 4, fire: 8, reload: 16, take: 32, scope: 64 };
const TAKE = 1.4;
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

// ---------- pagina ----------
document.querySelectorAll('.sotto').forEach(e => (e.textContent = 'Deserto · Rossa contro Blu'));
$('sfida-via').hidden = true;
$('cambia').textContent = 'Poligono di tiro';
$('conti').hidden = true;

// ---------- grafica ----------
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.55;
renderer.autoClear = false;
// ombre del sole (morbide) solo intorno a chi gioca: il riquadro segue il giocatore a passi fissi, così non tremano
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
// sole basso del pomeriggio, da sud-ovest: ombre lunghe che disegnano le case
const SUN_DIR = new THREE.Vector3(-0.55, 0.62, 0.56).normalize();
const sky = new Sky();
sky.scale.setScalar(550); // dentro la distanza della camera (600 m)
const su = sky.material.uniforms;
su.turbidity.value = 4;
su.rayleigh.value = 1.2;
su.mieCoefficient.value = 0.004;
su.mieDirectionalG.value = 0.82;
su.sunPosition.value.copy(SUN_DIR).multiplyScalar(1000);
scene.add(sky);
// foschia del deserto, color sabbia chiara: le dune lontane sfumano nel cielo
scene.fog = new THREE.FogExp2(0xd9cbb0, 0.0042);
scene.add(new THREE.HemisphereLight(0xcfe3ff, 0xc29a66, 0.8));
const sun = new THREE.DirectionalLight(0xffe2b8, 4.2);
sun.castShadow = true;
const SHADOW = 48; // metri coperti dalle ombre attorno al giocatore
const SHADOW_SIZE = matchMedia('(pointer: coarse)').matches ? 2048 : 4096;
sun.shadow.mapSize.set(SHADOW_SIZE, SHADOW_SIZE);
Object.assign(sun.shadow.camera, {
  left: -SHADOW,
  right: SHADOW,
  top: SHADOW,
  bottom: -SHADOW,
  near: 1,
  far: 260
});
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.035;
scene.add(sun, sun.target);
function followSun(x, z) {
  const step = (SHADOW * 2) / SHADOW_SIZE; // un punto dell'ombra: ci si sposta solo a passi interi
  const cx = Math.round(x / step) * step;
  const cz = Math.round(z / step) * step;
  sun.target.position.set(cx, 0, cz);
  sun.position.set(cx + SUN_DIR.x * 120, SUN_DIR.y * 120, cz + SUN_DIR.z * 120);
}
followSun(0, 0);
const BASE_FOV = 72;
const camera = new THREE.PerspectiveCamera(BASE_FOV, innerWidth / innerHeight, 0.05, 600);
camera.rotation.order = 'YXZ';
const muzzleLight = new THREE.PointLight(0xffc46b, 0, 6);
scene.add(muzzleLight);
let vm = null;
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
    loader.load(
      new URL('models/' + name, import.meta.url).href,
      ok,
      e => {
        if (e.total)
          $('caricamento-testo').textContent =
            'Carico ' + name.replace('.glb', '') + '… ' + Math.round((e.loaded / e.total) * 100) + '%';
      },
      ko
    )
  );
const [deserto, armi, soldati] = await Promise.all([
  load('deserto.glb'),
  load('armi.glb'),
  load('soldati.glb')
]).catch(e => {
  $('caricamento-testo').innerHTML =
    'Non riesco a caricare il gioco. <button id="esci-errore" type="button">Esci</button>';
  $('esci-errore').onclick = () => parent.postMessage({ type: 'zona-exit' }, location.origin);
  throw e;
});

// mappa: le case e le altre cose uguali si disegnano a istanze, una chiamata per tipo
// paesaggio lontano (dune, rocce, case fuori dalle mura): niente ombre da proiettare, solo da ricevere
const FAR = /^(dune|mesas|terreno_fuori|fuori_)/;
function addInstanced(root) {
  root.updateMatrixWorld(true);
  const groups = new Map();
  root.traverse(o => {
    if (!o.isMesh) return;
    // colori pieni e opachi, come la Lobby: niente lucido di plastica
    for (const m of [o.material].flat()) {
      m.roughness = 0.92;
      m.metalness = 0;
    }
    o.userData.far = FAR.test(o.name);
    const k = o.geometry.uuid + '|' + o.material.uuid;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(o);
  });
  for (const list of groups.values()) {
    const first = list[0];
    if (list.length === 1) {
      const m = new THREE.Mesh(first.geometry, first.material);
      first.matrixWorld.decompose(m.position, m.quaternion, m.scale);
      m.castShadow = !first.userData.far;
      m.receiveShadow = true;
      scene.add(m);
      continue;
    }
    const im = new THREE.InstancedMesh(first.geometry, first.material, list.length);
    list.forEach((o, i) => im.setMatrixAt(i, o.matrixWorld));
    im.computeBoundingSphere();
    im.castShadow = !first.userData.far;
    im.receiveShadow = true;
    scene.add(im);
  }
}
addInstanced(deserto.scene);
vm = createViewmodel(armi, innerWidth / innerHeight, 'blu');
resize();
const world = makeWorld(BOXES, GROUND);

// ---------- soldati degli altri (soldiers.js) ----------
const soldiers = createSoldiers(scene, soldati, vm.worldModels);
// ---------- armi e casse a terra ----------
let items = []; // {kind, x, y, z, node, away}
function setItems(list) {
  for (const i of items) scene.remove(i.node);
  items = list.map(([kind, x, y, z]) => {
    const src = vm.worldModels[kind];
    const node = src
      ? src.clone(true)
      : new THREE.Mesh(
          new THREE.BoxGeometry(0.4, 0.2, 0.3),
          new THREE.MeshLambertMaterial({ color: 0xffffff })
        );
    node.position.set(x, y + 0.25, z);
    node.traverse(o => o.isMesh && (o.castShadow = true));
    scene.add(node);
    return { kind, x, y, z, node, away: false };
  });
}

// ---------- buchi dei colpi ----------
const decals = [];
const decalGeo = new THREE.CircleGeometry(0.025, 8);
const decalMat = new THREE.MeshBasicMaterial({
  color: 0x141210,
  transparent: true,
  opacity: 0.85,
  depthWrite: false,
  polygonOffset: true,
  polygonOffsetFactor: -4
});
function decal(point, box) {
  const faces = [
    [Math.abs(point.x - box.min[0]), new THREE.Vector3(-1, 0, 0)],
    [Math.abs(point.x - box.max[0]), new THREE.Vector3(1, 0, 0)],
    [Math.abs(point.y - box.min[1]), new THREE.Vector3(0, -1, 0)],
    [Math.abs(point.y - box.max[1]), new THREE.Vector3(0, 1, 0)],
    [Math.abs(point.z - box.min[2]), new THREE.Vector3(0, 0, -1)],
    [Math.abs(point.z - box.max[2]), new THREE.Vector3(0, 0, 1)]
  ].sort((a, b) => a[0] - b[0]);
  const n = faces[0][1];
  const m = decals.length >= 100 ? decals.shift() : new THREE.Mesh(decalGeo, decalMat);
  m.position.copy(point).addScaledVector(n, 0.003);
  m.lookAt(point.clone().add(n));
  scene.add(m);
  decals.push(m);
}
function decalAt([x, y, z]) {
  const p = new THREE.Vector3(x, y, z);
  const box = world
    .near(x, z, 0.3)
    .find(
      c =>
        x >= c.min[0] - 0.02 &&
        x <= c.max[0] + 0.02 &&
        y >= c.min[1] - 0.02 &&
        y <= c.max[1] + 0.02 &&
        z >= c.min[2] - 0.02 &&
        z <= c.max[2] + 0.02
    );
  if (box) decal(p, box);
}

// ---------- giocatore ----------
const body = newBody(0, 0, 0);
const controls = createControls(canvas, uiRefs(), { onMenu: show => showMenu(show) });
controls.sens = settings.sens;
sfx.setVolume(settings.volume);
let guns = {};
let slot1 = null;
let current = 'baretta';
let last = 'coltello';
let fireHeld = false;
let kick = 0;
let kickYaw = 0;
let hp = PLAYER.health;
let alive = true;
let me = null; // il mio id
let phase = 'attesa';
let left = 0;
let score = [];
let results = null;
let respawnIn = 0;
let killer = null;
let ready = false;
let started = false;
let acc = 0;
let stepT = 0;
let prevLook = { yaw: 0, pitch: 0 };
const random = rng(7);
const names = new Map();
resetGuns();

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
function resetGuns() {
  guns = { baretta: newGun('baretta'), coltello: newGun('coltello') };
  slot1 = null;
  current = null;
  select('baretta', true);
  last = 'coltello';
}
function select(name, quiet) {
  if (!name || name === current || !guns[name]) return;
  last = current || 'coltello';
  current = name;
  controls.aim = false;
  vm.setWeapon(name);
  if (!quiet) sfx.pickup();
}
function giveSlot1(weapon) {
  if (slot1 && slot1 !== weapon) delete guns[slot1];
  slot1 = weapon;
  guns[weapon] = newGun(weapon);
  current = null;
  select(weapon);
}
function nearItem() {
  let best = null;
  for (const i of items) {
    if (i.away || i.kind === 'cassa_medica') continue;
    const d = Math.hypot(i.x - body.x, i.z - body.z);
    if (d < TAKE && Math.abs(i.y - body.y) < 1.6 && (!best || d < best.d)) best = { i, d };
  }
  return best?.i;
}

const net = createNet({
  world,
  body,
  onStatus(s) {
    if (s.open) return;
    if (s.code === 4000) lost('Zona Operativa aperta in un’altra finestra.');
    else if (s.reason && (s.code === 4001 || s.code === 4003 || !s.code)) lost(s.reason);
    else if (ready) toast('Collegamento perso, riprovo…');
  },
  onMessage
});

function lost(text) {
  $('risultato').hidden = false;
  $('risultato').textContent = text;
  showMenu(true);
}

// ---------- messaggi del server ----------
function onMessage(m) {
  if (m.t === 'ciao') {
    me = m.id;
    setItems(m.items);
    setTeam(m.team);
    // ricollegati (rete o server riavviato): si richiede la squadra scelta
    if (chosen && chosen !== 'auto' && chosen !== m.team) net.send({ t: 'squadra', s: chosen });
    if (!ready) {
      ready = true;
      $('caricamento').hidden = true;
      showMenu(true);
    }
    return;
  }
  if (m.t !== 's') return;
  phase = m.ph;
  left = m.left;
  score = m.sc;
  teamScore = m.sq || [0, 0];
  if (m.me?.tm) setTeam(m.me.tm);
  for (const [id, name] of m.sc.map(r => [r[0], r[1]])) names.set(id, name);
  for (let n = 0; n < items.length; n++) {
    items[n].away = m.it.includes(n);
    items[n].node.visible = !items[n].away;
  }
  if (m.me) {
    hp = m.me.hp;
    if (alive && !m.me.al) controls.fire = false;
    alive = m.me.al;
    respawnIn = m.me.ru;
    // l'arma del posto 1 la decide il server (presa, rinascita)
    if (m.me.s1 !== slot1) {
      if (m.me.s1) giveSlot1(m.me.s1);
      else {
        delete guns[slot1];
        slot1 = null;
        if (!guns[current]) select('baretta');
      }
    }
  }
  for (const e of m.ev) onEvent(e);
  // chi è uscito: via il suo soldato
  soldiers.prune(new Set(m.p.map(p => p[0])));
}

function onEvent(e) {
  const name = id => (id === me ? 'Tu' : names.get(id) || 'Qualcuno');
  if (e.e === 'nasce' && e.id === me) {
    controls.yaw = e.yaw;
    controls.pitch = 0;
    killer = null;
    resetGuns();
  } else if (e.e === 'prende' && e.id === me) sfx.pickup();
  else if (e.e === 'cura' && e.id === me) {
    sfx.pickup();
    toast('+50 salute');
  } else if (e.e === 'spara') {
    if (e.at) decalAt(e.at);
    if (e.id === me) return;
    const d = soldiers.shot(e.id, e.w, camera.position);
    if (d !== null) sfx.shot(e.w, Math.min(1, 9 / Math.max(9, d)));
  } else if (e.e === 'colpo') {
    if (e.a === me) {
      $('segno').className = 'on ' + (e.h ? 'testa' : '');
      markerT = 0.18;
      sfx.targetHit(e.h ? 'testa' : 'corpo');
      const s = soldiers.get(e.v);
      if (s)
        floatText(
          e.d + (e.h ? ' TESTA' : ''),
          s.root.position.clone().add(new THREE.Vector3(0, e.h ? 1.7 : 1.2, 0)),
          e.h
        );
    }
    if (e.v === me) {
      hp = e.hp;
      $('ferita').className = 'on';
      hurtT = 0.35;
      sfx.hurt();
    } else soldiers.hit(e.v);
  } else if (e.e === 'elimina') {
    feed(
      `<b style="color:${color(e.a)}">${esc(name(e.a))}</b> ${e.h ? '◎' : '✕'} ${WEAPONS[e.w]?.name || ''} <b style="color:${color(e.v)}">${esc(name(e.v))}</b>`
    );
    if (e.a === me) sfx.kill();
    if (e.v === me) killer = e.a;
  } else if (e.e === 'entra' && e.id !== me) feed(esc(e.n) + ' è entrato');
  else if (e.e === 'esce') feed(esc(e.n) + ' è uscito');
  else if (e.e === 'squadra' && e.id !== me)
    feed(esc(name(e.id)) + ' passa ai ' + (e.s === 'rossa' ? 'Rossi' : 'Blu'));
  else if (e.e === 'via') {
    feed('<b>Si comincia: 5 minuti, Rossa contro Blu!</b>');
    results = null;
  } else if (e.e === 'fine') {
    results = e.r;
    controls.fire = false;
  }
}
// colore della squadra (0 Blu, 1 Rossa)
const teamOf = id => score.find(r => r[0] === id)?.[4] ?? 0;
const color = id => COLORS[teamOf(id)];
let myTeam = null;
let teamScore = [0, 0];
let chosen = null; // squadra scelta in questa visita: 'rossa', 'blu' o 'auto'
function setTeam(t) {
  if (!t || t === myTeam) return;
  myTeam = t;
  vm.setTeam(t === 'rossa' ? 'rossi' : 'blu');
}
// all'inizio si sceglie la squadra; si può cambiare dal menù (si rinasce alla nuova partenza)
for (const s of ['rossa', 'blu', 'auto'])
  $('sq-' + s).onclick = () => {
    chosen = s;
    net.send({ t: 'squadra', s });
    for (const o of ['rossa', 'blu', 'auto']) $('sq-' + o).classList.toggle('scelta', o === s);
    $('gioca').hidden = false;
    $('gioca').click();
  };
const esc = s =>
  String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// ---------- interfaccia ----------
let markerT = 0;
let hurtT = 0;
function floatText(text, at, head) {
  const p = at.project(camera);
  if (p.z > 1) return;
  const s = document.createElement('span');
  s.textContent = text;
  if (head) s.className = 'testa';
  s.style.left = ((p.x + 1) / 2) * innerWidth + 'px';
  s.style.top = ((1 - p.y) / 2) * innerHeight + 'px';
  $('danni').append(s);
  setTimeout(() => s.remove(), 800);
}
function feed(html) {
  const d = document.createElement('div');
  d.innerHTML = html;
  $('feed').prepend(d);
  while ($('feed').children.length > 5) $('feed').lastChild.remove();
  setTimeout(() => d.remove(), 6000);
}
let toastT = 0;
function toast(text) {
  $('avviso').hidden = false;
  $('avviso').textContent = text;
  toastT = 2;
}
function showMenu(show) {
  $('menu').hidden = !show;
  $('hud').hidden = show || !ready;
  controls.active = !show && ready;
  if (show) {
    controls.fire = false;
    $('gioca').textContent = started ? 'Riprendi' : 'Gioca';
    $('gioca').disabled = !ready;
    $('squadre').hidden = !ready;
    $('gioca').hidden = !chosen; // la prima volta si entra scegliendo la squadra
  }
}
$('comandi').innerHTML = matchMedia('(pointer: coarse)').matches
  ? 'Levetta a sinistra per muoverti (spinta fino in fondo corri), trascina a destra per guardare. SPARA, MIRA (mirando si va piano), RIC. ricarica, ARMA cambia arma, PRENDI vicino a un’arma a terra. La partita continua anche con il menù aperto.'
  : 'W A S D muoversi · mouse guardare · clic sinistro sparare · tasto destro tenuto mira (mirando si va piano) · R ricarica · E prendi un’arma a terra · 1 2 3 armi, rotella, Q ultima · Spazio salta · Ctrl o C accucciato · Maiusc tenuto corre · Tab classifica · Esc menù (la partita continua)';
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
$('gioca').onclick = () => {
  started = true;
  sfx.unlockAudio();
  showMenu(false);
  controls.lock();
};
$('cambia').onclick = () => {
  net.disconnect();
  document.exitPointerLock?.();
  location.search = '';
};
$('esci').onclick = () => {
  net.disconnect();
  document.exitPointerLock?.();
  parent.postMessage({ type: 'zona-exit' }, location.origin);
};
addEventListener('pagehide', () => net.disconnect());
$('t-menu').addEventListener('click', () => showMenu(true));
let tabHeld = false;
addEventListener('keydown', e => {
  if (e.code === 'Escape' && controls.touch) showMenu($('menu').hidden);
  if (e.code === 'Tab') tabHeld = true;
});
addEventListener('keyup', e => e.code === 'Tab' && (tabHeld = false));
$('salute').addEventListener('click', () => (tabHeld = !tabHeld)); // sul telefono la classifica si apre toccando la salute
$('salute').style.pointerEvents = 'auto';

const clock = ms => {
  const s = Math.ceil(ms / 1000);
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
};
function table(rows, winner) {
  return (
    '<table><tr><th></th><th>Giocatore</th><th>Elim.</th><th>Morti</th></tr>' +
    rows
      .map(
        (r, n) =>
          `<tr class="${r.id === me ? 'io' : ''}"><td>${n + 1}</td><td>${esc(r.name)}${r.bot ? ' <span class="bot">bot</span>' : ''}</td><td>${r.kills}</td><td>${r.deaths}</td></tr>`
      )
      .join('') +
    '</table>'
  );
}
function updateHud(dt) {
  const w = WEAPONS[current];
  const g = guns[current];
  $('salute-n').textContent = Math.max(0, Math.round(hp));
  $('salute').classList.toggle('basso', hp <= 30);
  $('arma-nome').textContent = w.name;
  $('arma-colpi').innerHTML = w.melee ? '—' : g.ammo + ' <small>/ ∞</small>';
  $('arma-stato').textContent =
    g.reloading > 0 ? 'Ricarica…' : g.ammo === 0 && !w.melee ? 'R per ricaricare' : '';
  $('tempo').hidden = false;
  // in alto: Blu · tempo · Rossa
  $('tempo').innerHTML =
    `<span class="sq-blu">BLU ${teamScore[0]}</span>` +
    (phase === 'partita' ? clock(left) : phase === 'fine' ? 'Fine' : 'In attesa…') +
    `<span class="sq-rossa">${teamScore[1]} ROSSA</span>`;
  $('tempo').classList.toggle('poco', phase === 'partita' && left < 30000);
  // avviso: arma a terra vicina
  if (toastT > 0) toastT -= dt;
  const near = alive && nearItem();
  if (toastT <= 0) {
    $('avviso').hidden = !near;
    if (near)
      $('avviso').textContent = (controls.touch ? 'PRENDI: ' : 'E: prendi ') + WEAPONS[near.kind].name;
  }
  $('t-prendi').hidden = !near || !controls.touch;
  // morto: chi ti ha eliminato e quando si rinasce
  $('morto').hidden = alive || phase === 'fine';
  if (!alive)
    $('morto').innerHTML =
      (killer ? 'Eliminato da <b>' + esc(names.get(killer) || 'qualcuno') + '</b>' : 'Eliminato') +
      '<small>Rinasci tra ' +
      Math.max(1, Math.ceil(respawnIn / 1000)) +
      '</small>';
  // classifica: Tab, oppure a fine partita
  const showScore = tabHeld || phase === 'fine';
  $('classifica').hidden = !showScore;
  if (showScore) {
    const rows = (
      results && phase === 'fine'
        ? results.rows
        : score.map(r => ({
            id: r[0],
            name: r[1],
            kills: r[2],
            deaths: r[3],
            team: r[4] ? 'rossa' : 'blu',
            bot: !!r[5]
          }))
    ).sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
    const NAME = { blu: 'Blu', rossa: 'Rossa' };
    const head =
      phase === 'fine' && results
        ? results.winner
          ? results.winner === myTeam
            ? 'La tua squadra ha vinto!'
            : 'Vince la squadra ' + NAME[results.winner]
          : 'Pareggio'
        : 'Classifica';
    const side = (t, n) =>
      `<div><h3 style="color:${COLORS[n]}">${NAME[t]} · ${teamScore[n]}</h3>` +
      table(rows.filter(r => r.team === t)) +
      '</div>';
    $('classifica').innerHTML =
      '<h2>' +
      head +
      '</h2><div class="squadre">' +
      side('blu', 0) +
      side('rossa', 1) +
      '</div>' +
      (phase === 'fine' ? '<small>Tra poco una nuova partita</small>' : '');
  }
  // mirino
  const moving = Math.hypot(body.vx, body.vz) > 1;
  const gap = 4 + w.spread * 400 * (body.onGround ? (moving ? 2 : 1) : 3) * (body.crouch ? 0.7 : 1);
  $('m-s').style.left = -gap - 8 + 'px';
  $('m-d').style.left = gap + 'px';
  $('m-a').style.top = -gap - 8 + 'px';
  $('m-b').style.top = gap + 'px';
  const scoped = aiming() && current === 'falco';
  $('cannocchiale').hidden = !scoped;
  // mirando le mire dell'arma prendono il posto del mirino
  $('mirino').classList.toggle('nascosto', aimT > 0.5 || w.melee || !alive);
  $('t-mira').hidden = w.melee || !controls.touch;
  $('t-mira').classList.toggle('on', controls.aim);
  $('mirino').classList.toggle('puntorosso', aimT > 0.5 && current === 'ruggito');
  if (markerT > 0 && (markerT -= dt) <= 0) $('segno').className = '';
  if (hurtT > 0 && (hurtT -= dt) <= 0) $('ferita').className = '';
}

// ---------- colpi (solo l'effetto: il danno lo decide il server) ----------
function shootFx() {
  const w = WEAPONS[current];
  const eye = { x: body.x, y: eyeHeight(body), z: body.z };
  const dir = lookDir(controls.yaw + kickYaw, controls.pitch + kick);
  if (!w.melee) {
    // il buco sul muro lo mette subito il telefono (il server lo manda agli altri)
    const d = pelletDirs(dir, spreadFor(current, body, aiming()), 1, random)[0];
    const wall = world.ray(eye, d, 300);
    if (wall)
      decal(new THREE.Vector3(eye.x + d.x * wall.t, eye.y + d.y * wall.t, eye.z + d.z * wall.t), wall.box);
    muzzleLight.intensity = 3;
    muzzleLight.position.set(eye.x + dir.x * 0.6, eye.y - 0.1, eye.z + dir.z * 0.6);
  }
  const K = { baretta: 0.02, calabrone: 0.009, tuono: 0.07, ruggito: 0.013, falco: 0.09, coltello: 0 };
  kick += K[current];
  kickYaw += (random() - 0.5) * K[current] * 0.4;
  vm.fire();
  sfx.shot(current);
  if (current === 'tuono') sfx.pump();
  if (current === 'falco') aimBlock = 0.9; // dopo il colpo si toglie il cannocchiale per tirare l'otturatore
}
// si mira tenendo premuto il tasto destro (sul telefono MIRA), con tutte le armi tranne il coltello
let aimBlock = 0;
let aimT = 0; // 0..1, per far scorrere vista e arma
const aiming = () => alive && controls.aim && !WEAPONS[current].melee && aimBlock <= 0;
function beginReload() {
  const g = guns[current];
  const w = WEAPONS[current];
  vm.reload(Math.max(0.4, w.perShell ? (w.mag - g.ammo) * w.reload : w.reload));
  sfx.reload(current);
}

// un comando di 1/60 s: si prepara, si prevede, si manda
function fixedStep() {
  const playing = $('menu').hidden && ready;
  const live = alive && phase !== 'fine';
  const input =
    playing && live
      ? controls.read()
      : {
          fwd: 0,
          side: 0,
          jump: false,
          crouch: false,
          walk: false,
          yaw: controls.yaw,
          pitch: controls.pitch
        };
  input.yaw = controls.yaw + kickYaw;
  input.pitch = controls.pitch + kick;
  let bits = (input.jump ? BIT.jump : 0) | (input.crouch ? BIT.crouch : 0) | (input.walk ? BIT.walk : 0);
  if (playing && live) {
    for (const n of [1, 2, 3])
      if (controls.take('slot' + n)) select(n === 1 ? slot1 : n === 2 ? 'baretta' : 'coltello');
    if (controls.take('ultima')) select(last);
    const order = [slot1, 'baretta', 'coltello'].filter(Boolean);
    if (controls.take('prossima')) select(order[(order.indexOf(current) + 1) % order.length]);
    if (controls.take('precedente'))
      select(order[(order.indexOf(current) + order.length - 1) % order.length]);
    if (controls.take('ricarica')) {
      bits |= BIT.reload;
      if (startReload(guns[current])) beginReload();
    }
    if (controls.take('prendi')) bits |= BIT.take;
    if (controls.fire) bits |= BIT.fire;
    // mirando si va piano (lo controlla anche il server)
    if (aiming()) {
      bits |= BIT.scope | BIT.walk;
      input.walk = true;
      input.aim = true;
    }
  } else controls.pressed.clear();
  // l'arma in mano, come farà il server con lo stesso comando
  for (const g of Object.values(guns))
    if (tickGun(g, DT) === 'ricaricata' && g === guns[current] && g.weapon === 'tuono') sfx.click();
  const g = guns[current];
  const w = WEAPONS[current];
  const fire = !!(bits & BIT.fire);
  if (live && fire && (w.auto || !fireHeld)) {
    const wasReloading = g.reloading > 0;
    const r = tryFire(g);
    if (r === 'spara') {
      shootFx();
      if (g.reloading > 0 && !wasReloading) beginReload();
    } else if (r === 'vuoto') {
      sfx.click();
      beginReload();
    }
  }
  fireHeld = fire;
  const cmd = [
    +input.fwd.toFixed(2),
    +input.side.toFixed(2),
    bits,
    +input.yaw.toFixed(4),
    +input.pitch.toFixed(4),
    ARMI.indexOf(current)
  ];
  net.command({ ...input, jump: !!(bits & BIT.jump) }, cmd, live);
}

// ---------- ciclo ----------
let lastT = performance.now();
let time = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - lastT) / 1000);
  lastT = now;
  time += dt;
  if (ready) {
    acc = Math.min(acc + dt, 0.25);
    while (acc >= DT) {
      acc -= DT;
      fixedStep();
    }
    net.flush(now);
    net.smooth(dt);
  }
  const speed = Math.hypot(body.vx, body.vz);
  if (alive && body.onGround && speed > 3 && (stepT -= dt) <= 0) {
    sfx.step();
    stepT = 0.36;
  }
  // vista: da morti si scende a terra
  const eyeY = eyeHeight(body) + net.error.y;
  camera.position.set(body.x + net.error.x, alive ? eyeY : body.y + 0.5, body.z + net.error.z);
  camera.rotation.set(controls.pitch + kick, controls.yaw + kickYaw, alive ? 0 : 0.4);
  if (aimBlock > 0) aimBlock -= dt;
  const aim = aiming();
  aimT += ((aim ? 1 : 0) - aimT) * Math.min(1, dt * 14);
  const scoped = aim && current === 'falco';
  // Falco: cannocchiale ×4 subito; le altre armi stringono la vista poco a poco (×1,35)
  const fov = scoped ? BASE_FOV / WEAPONS.falco.zoom : BASE_FOV / (1 + 0.35 * aimT);
  if (Math.abs(camera.fov - fov) > 0.01) {
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }
  controls.zoom = camera.fov / BASE_FOV;
  vm.setVisible(!scoped && alive);
  const look = { x: angleDiff(controls.yaw, prevLook.yaw), y: controls.pitch - prevLook.pitch };
  prevLook = { yaw: controls.yaw, pitch: controls.pitch };
  vm.update(
    dt,
    Math.min(1, speed / 5) * (body.onGround ? 1 : 0),
    { x: -Math.max(-0.05, Math.min(0.05, look.x)), y: Math.max(-0.05, Math.min(0.05, look.y)) },
    time,
    current === 'falco' ? 0 : aimT
  );
  muzzleLight.intensity = Math.max(0, muzzleLight.intensity - dt * 60);
  kick *= Math.max(0, 1 - dt * 9);
  kickYaw *= Math.max(0, 1 - dt * 9);
  followSun(body.x, body.z);
  // gli altri, un attimo nel passato
  // il nome sopra la testa solo per i compagni di squadra
  soldiers.update(net.others(net.viewTime(), me), dt, names, p => p.color === (myTeam === 'rossa' ? 1 : 0));
  for (const i of items) if (!i.away) i.node.rotation.y = time * 0.8;
  if (ready) updateHud(dt);
  renderer.clear();
  renderer.render(scene, camera);
  renderer.clearDepth();
  if (alive) renderer.render(vm.scene, vm.camera);
}
const angleDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

// solo nell'anteprima locale: le braccia per guardarle da vicino (camera spostabile)
if (location.hostname === 'localhost') globalThis.zonaBraccia = vm;
// per le prove nell'anteprima (sola lettura)
globalThis.zonaStato = () => ({
  online: true,
  me,
  phase,
  left,
  hp,
  alive,
  body: { ...body },
  current,
  others: [...soldiers.all.keys()],
  items: items.map(i => [i.kind, i.away])
});

$('caricamento-testo').textContent = 'Mi collego alla partita…';
camera.position.set(0, 30, 60);
camera.lookAt(0, 0, 0);
net.connect();
// aperta da sola (anteprima, non dentro l'app): niente server da raggiungere
setTimeout(() => {
  if (!ready)
    $('caricamento-testo').innerHTML =
      'La partita online si gioca dall’app. <button id="esci-errore" type="button">Poligono di tiro</button>';
  const b = $('esci-errore');
  if (b) b.onclick = () => (location.search = '');
}, 6000);
requestAnimationFrame(frame);
