// Zona Operativa, tappa 2: la partita online sulla mappa del deserto, Tutti contro tutti (docs/zona-operativa.md).
// Qui si disegna e si comanda; chi colpisce chi, la salute, le armi a terra e il tempo li decide il server
// (zona-server.js). Il collegamento passa dall'app (zona-link.js), il movimento si prevede con net.js.
import * as THREE from 'three';
import { GLTFLoader } from '../vendor/three/addons/loaders/GLTFLoader.js';
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
} from './rules.js?v=79c25dfc2d';
import { BOXES, GROUND } from './map-deserto.js?v=2cc5684ce1';
import { createControls } from './controls.js?v=e180132236';
import { createViewmodel } from './viewmodel.js?v=af06afbe4f';
import { createNet, DT } from './net.js?v=889e5e6ca3';
import * as sfx from './audio.js?v=337aee686c';

const $ = id => document.getElementById(id);
// gli stessi numeri del server (zona-server.js): ordine delle armi e bit dei comandi
const ARMI = ['baretta', 'calabrone', 'tuono', 'ruggito', 'falco', 'coltello'];
const BIT = { jump: 1, crouch: 2, walk: 4, fire: 8, reload: 16, take: 32, scope: 64 };
const TAKE = 1.4;
const COLORS = ['#4aa3ff', '#ff5a4a', '#e8b81e', '#5fd17a', '#c77dff', '#ff9f43', '#4dd6d0', '#f2f2f2'];
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
document.querySelectorAll('.sotto').forEach(e => (e.textContent = 'Deserto · Tutti contro tutti'));
$('sfida-via').hidden = true;
$('cambia').textContent = 'Poligono di tiro';
$('conti').hidden = true;

// ---------- grafica ----------
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.autoClear = false;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xa9cbe6);
scene.fog = new THREE.Fog(0xd8d0bd, 90, 330);
scene.add(new THREE.HemisphereLight(0xdcecff, 0xb39a74, 1.5));
const sun = new THREE.DirectionalLight(0xfff1d6, 2.0);
sun.position.set(40, 80, 25);
scene.add(sun);
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
function addInstanced(root) {
  root.updateMatrixWorld(true);
  const groups = new Map();
  root.traverse(o => {
    if (!o.isMesh) return;
    const k = o.geometry.uuid + '|' + o.material.uuid;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(o);
  });
  for (const list of groups.values()) {
    const first = list[0];
    if (list.length === 1) {
      const m = new THREE.Mesh(first.geometry, first.material);
      first.matrixWorld.decompose(m.position, m.quaternion, m.scale);
      scene.add(m);
      continue;
    }
    const im = new THREE.InstancedMesh(first.geometry, first.material, list.length);
    list.forEach((o, i) => im.setMatrixAt(i, o.matrixWorld));
    im.computeBoundingSphere();
    scene.add(im);
  }
}
addInstanced(deserto.scene);
vm = createViewmodel(armi, innerWidth / innerHeight, 'blu');
resize();
const world = makeWorld(BOXES, GROUND);

// ---------- soldati degli altri ----------
const UPPER = [
  'schiena',
  'petto',
  'collo',
  'testa',
  'spallaL',
  'braccioL',
  'avambraccioL',
  'manoL',
  'spallaR',
  'braccioR',
  'avambraccioR',
  'manoR'
];
const clean = n => n.replace(/_\d+$/, '');
soldati.scene.traverse(o => (o.name = clean(o.name)));
const clips = {};
for (const c of soldati.animations) {
  for (const t of c.tracks) t.name = t.name.replace(/_\d+(?=\.)/, '');
  clips[c.name] = c;
  // per spara, ricarica e colpito solo il busto: le gambe continuano a camminare
  if (['spara', 'ricarica', 'colpito'].includes(c.name))
    clips[c.name + '_busto'] = new THREE.AnimationClip(
      c.name + '_busto',
      c.duration,
      c.tracks.filter(t => UPPER.includes(t.name.split('.')[0]))
    );
}
const rigs = {
  blu: soldati.scene.getObjectByName('scheletro_blu'),
  rossi: soldati.scene.getObjectByName('scheletro_rossi')
};
function cloneSkinned(src) {
  const c = src.clone(true);
  const bones = {};
  c.traverse(o => o.isBone && (bones[o.name] = o));
  c.traverse(o => {
    if (o.isSkinnedMesh) {
      o.bind(
        new THREE.Skeleton(
          o.skeleton.bones.map(b => bones[b.name]),
          o.skeleton.boneInverses
        ),
        o.bindMatrix
      );
      o.frustumCulled = false;
    }
  });
  return c;
}
function nameSprite(text, color) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const g = c.getContext('2d');
  g.font = '700 30px system-ui,sans-serif';
  g.textAlign = 'center';
  g.lineWidth = 6;
  g.strokeStyle = 'rgba(0,0,0,.7)';
  g.strokeText(text, 128, 42);
  g.fillStyle = color;
  g.fillText(text, 128, 42);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false }));
  s.scale.set(1.4, 0.35, 1);
  s.position.y = 2.15;
  return s;
}
const flashTex = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  r.addColorStop(0, 'rgba(255,245,200,1)');
  r.addColorStop(1, 'rgba(255,140,30,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
})();
const soldiers = new Map(); // id -> soldato
function soldierFor(p, name) {
  let s = soldiers.get(p.id);
  if (s) return s;
  const team = p.color % 2 ? 'rossi' : 'blu';
  const root = new THREE.Group();
  const model = cloneSkinned(rigs[team]);
  model.position.set(0, 0, 0);
  model.rotation.set(0, 0, 0);
  root.add(model);
  model.traverse(o => o.isSkinnedMesh && (o.visible = o.name.startsWith('soldato_' + team)));
  const mixer = new THREE.AnimationMixer(model);
  const act = n => mixer.clipAction(clips[n]);
  const s2 = {
    root,
    model,
    mixer,
    act,
    base: null,
    dead: false,
    petto: model.getObjectByName('petto'),
    hand: model.getObjectByName('manoR'),
    guns: {},
    gun: null,
    flash: null,
    flashT: 0,
    last: null,
    speed: 0,
    label: nameSprite(name || 'Giocatore', COLORS[p.color % COLORS.length])
  };
  root.add(s2.label);
  scene.add(root);
  soldiers.set(p.id, s2);
  return s2;
}
function setBase(s, name, timeScale = 1) {
  const a = s.act(name);
  a.timeScale = timeScale;
  if (s.base === a) return;
  a.reset();
  if (name === 'cade') {
    a.setLoop(THREE.LoopOnce, 1);
    a.clampWhenFinished = true;
  } else a.setLoop(THREE.LoopRepeat, Infinity);
  a.fadeIn(0.15).play();
  s.base?.fadeOut(0.15);
  s.base = a;
}
function upperOnce(s, name) {
  const a = s.act(name + '_busto');
  a.setLoop(THREE.LoopOnce, 1);
  a.clampWhenFinished = false;
  a.reset().setEffectiveWeight(1.4).play();
}
function gunFor(s, weapon) {
  if (s.gun?.userData.weapon === weapon) return;
  if (s.gun) s.gun.visible = false;
  if (!s.guns[weapon] && vm.worldModels[weapon]) {
    const g = vm.worldModels[weapon].clone(true);
    g.userData.weapon = weapon;
    const f = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: flashTex,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true
      })
    );
    f.position.set(
      0,
      0.05,
      weapon === 'falco' ? 1.0 : weapon === 'tuono' || weapon === 'ruggito' ? 0.7 : 0.35
    );
    f.scale.setScalar(0.4);
    f.visible = false;
    g.add(f);
    g.userData.flash = f;
    s.root.add(g);
    s.guns[weapon] = g;
  }
  s.gun = s.guns[weapon] || null;
  if (s.gun) s.gun.visible = true;
}
const tmpV = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();
const axis = new THREE.Vector3();
function updateSoldier(s, p, dt) {
  s.root.position.set(p.x, p.y, p.z);
  s.root.rotation.y = p.yaw + Math.PI; // il modello guarda verso +z, la vista con yaw 0 verso -z
  const moved = s.last ? Math.hypot(p.x - s.last.x, p.z - s.last.z) / Math.max(dt, 1e-3) : 0;
  s.speed += (Math.min(8, moved) - s.speed) * Math.min(1, dt * 8);
  s.last = { x: p.x, z: p.z };
  if (p.dead) setBase(s, 'cade');
  else if (p.crouch) setBase(s, 'accucciato');
  else if (s.speed < 0.6) setBase(s, 'fermo');
  else if (s.speed < 3.6) setBase(s, 'cammina', s.speed / 2.6);
  else setBase(s, 'corre', s.speed / 5.2);
  s.label.visible = !p.dead;
  s.mixer.update(dt);
  // mira in alto e in basso: si piega il petto attorno all'asse destra del soldato
  if (!p.dead && s.petto) {
    s.root.updateMatrixWorld(true);
    axis.set(-1, 0, 0).applyQuaternion(s.root.quaternion);
    s.petto.parent.getWorldQuaternion(tmpQ);
    axis.applyQuaternion(tmpQ.invert());
    s.petto.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(axis, p.pitch * 0.8));
  }
  gunFor(s, ARMI[p.weapon] || 'baretta');
  if (s.gun) {
    s.gun.visible = !p.dead;
    s.model.updateMatrixWorld(true);
    s.hand.getWorldPosition(tmpV);
    s.root.worldToLocal(tmpV);
    s.gun.position.copy(tmpV);
    s.gun.rotation.set(-p.pitch, 0, 0);
    if (s.flashT > 0 && (s.flashT -= dt) <= 0) s.gun.userData.flash.visible = false;
  }
}

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
  for (const [id, s] of soldiers)
    if (!m.p.some(p => p[0] === id)) {
      scene.remove(s.root);
      soldiers.delete(id);
    }
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
    const s = soldiers.get(e.id);
    if (s) {
      upperOnce(s, 'spara');
      if (s.gun?.userData.flash && e.w !== 'coltello') {
        s.gun.userData.flash.visible = true;
        s.flashT = 0.06;
      }
      const d = s.root.position.distanceTo(camera.position);
      sfx.shot(e.w, Math.min(1, 9 / Math.max(9, d)));
    }
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
    } else soldiers.get(e.v) && upperOnce(soldiers.get(e.v), 'colpito');
  } else if (e.e === 'elimina') {
    feed(
      `<b style="color:${color(e.a)}">${esc(name(e.a))}</b> ${e.h ? '◎' : '✕'} ${WEAPONS[e.w]?.name || ''} <b style="color:${color(e.v)}">${esc(name(e.v))}</b>`
    );
    if (e.a === me) sfx.kill();
    if (e.v === me) killer = e.a;
  } else if (e.e === 'entra' && e.id !== me) feed(esc(e.n) + ' è entrato');
  else if (e.e === 'esce') feed(esc(e.n) + ' è uscito');
  else if (e.e === 'via') {
    feed('<b>Si comincia: 5 minuti!</b>');
    results = null;
  } else if (e.e === 'fine') {
    results = e.r;
    controls.fire = false;
  }
}
const color = id => COLORS[(score.find(r => r[0] === id)?.[4] ?? 0) % COLORS.length];
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
  }
}
$('comandi').innerHTML = matchMedia('(pointer: coarse)').matches
  ? 'Levetta a sinistra per muoverti, trascina a destra per guardare. SPARA, MIRA (Falco), RIC. ricarica, ARMA cambia arma, PRENDI vicino a un’arma a terra. La partita continua anche con il menù aperto.'
  : 'W A S D muoversi · mouse guardare · clic sinistro sparare · clic destro mirino (Falco) · R ricarica · E prendi un’arma a terra · 1 2 3 armi, rotella, Q ultima · Spazio salta · Ctrl o C accucciato · Maiusc passo lento · Tab classifica · Esc menù (la partita continua)';
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
          `<tr class="${r.id === me ? 'io' : ''}"><td>${n + 1}</td><td style="color:${color(r.id)}">${esc(r.name)}${r.id === winner ? ' ★' : ''}</td><td>${r.kills}</td><td>${r.deaths}</td></tr>`
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
  $('tempo').textContent =
    phase === 'partita'
      ? clock(left)
      : phase === 'fine'
        ? 'Partita finita'
        : 'In attesa di un altro giocatore';
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
    const rows =
      results && phase === 'fine'
        ? results.rows
        : score
            .map(r => ({ id: r[0], name: r[1], kills: r[2], deaths: r[3] }))
            .sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
    const head =
      phase === 'fine' && results
        ? results.winner
          ? results.winner === me
            ? 'Hai vinto!'
            : 'Vince ' + esc(names.get(results.winner) || '')
          : 'Pareggio'
        : 'Classifica';
    $('classifica').innerHTML =
      '<h2>' +
      head +
      '</h2>' +
      table(rows, results?.winner) +
      (phase === 'fine' ? '<small>Tra poco una nuova partita</small>' : '');
  }
  // mirino
  const moving = Math.hypot(body.vx, body.vz) > 1;
  const gap = 4 + w.spread * 400 * (body.onGround ? (moving ? 2 : 1) : 3) * (body.crouch ? 0.7 : 1);
  $('m-s').style.left = -gap - 8 + 'px';
  $('m-d').style.left = gap + 'px';
  $('m-a').style.top = -gap - 8 + 'px';
  $('m-b').style.top = gap + 'px';
  const scoped = current === 'falco' && controls.aim && alive;
  $('cannocchiale').hidden = !scoped;
  $('mirino').classList.toggle('nascosto', scoped || w.melee || !alive);
  $('t-mira').hidden = current !== 'falco' || !controls.touch;
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
    const d = pelletDirs(dir, spreadFor(current, body, controls.aim), 1, random)[0];
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
  if (current === 'falco') controls.aim = false;
}
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
    if (controls.aim && current === 'falco') bits |= BIT.scope;
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
  const scoped = current === 'falco' && controls.aim && alive;
  const fov = scoped ? BASE_FOV / WEAPONS.falco.zoom : BASE_FOV;
  if (Math.abs(camera.fov - fov) > 0.01) {
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }
  controls.zoom = scoped ? 1 / WEAPONS.falco.zoom : 1;
  vm.setVisible(!scoped && alive);
  const look = { x: angleDiff(controls.yaw, prevLook.yaw), y: controls.pitch - prevLook.pitch };
  prevLook = { yaw: controls.yaw, pitch: controls.pitch };
  vm.update(
    dt,
    Math.min(1, speed / 5) * (body.onGround ? 1 : 0),
    { x: -Math.max(-0.05, Math.min(0.05, look.x)), y: Math.max(-0.05, Math.min(0.05, look.y)) },
    time
  );
  muzzleLight.intensity = Math.max(0, muzzleLight.intensity - dt * 60);
  kick *= Math.max(0, 1 - dt * 9);
  kickYaw *= Math.max(0, 1 - dt * 9);
  // gli altri, un attimo nel passato
  for (const p of net.others(net.viewTime(), me)) updateSoldier(soldierFor(p, names.get(p.id)), p, dt);
  for (const i of items) if (!i.away) i.node.rotation.y = time * 0.8;
  if (ready) updateHud(dt);
  renderer.clear();
  renderer.render(scene, camera);
  renderer.clearDepth();
  if (alive) renderer.render(vm.scene, vm.camera);
}
const angleDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

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
  others: [...soldiers.keys()],
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
