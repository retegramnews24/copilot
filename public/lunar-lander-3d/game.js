import * as T from '../vendor/three/three.module.min.js';
import { clamp, newFlight, step } from './flight.js';
import { landingScore, loadRecords, missions, saveRecords } from './campaign.js';
import { createSound } from './audio.js';

const sound = createSound();

const byId = (id) => document.getElementById(id);
const scene = new T.Scene();
scene.background = new T.Color(0x060910);
scene.fog = new T.FogExp2(0x111923, 0.0026);
const camera = new T.PerspectiveCamera(45, 1, 0.1, 1400);
let renderer;
try {
  renderer = new T.WebGLRenderer({ antialias: true });
} catch {
  byId('message').textContent = 'WebGL 2 non è disponibile in questo browser.';
  byId('launch').disabled = true;
  byId('sound').disabled = true;
  throw new Error('WebGL 2 non disponibile');
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.shadowMap.enabled = true;
renderer.toneMapping = T.ACESFilmicToneMapping;
byId('scene').append(renderer.domElement);

scene.add(new T.HemisphereLight(0xb6d1ed, 0x49473e, 1.8));
const sun = new T.DirectionalLight(0xffe5c3, 3);
sun.position.set(-45, 70, -28);
sun.castShadow = true;
Object.assign(sun.shadow.camera, { left: -75, right: 75, top: 75, bottom: -75, far: 210 });
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.normalBias = 0.07;
scene.add(sun);

let seed = 29;
function random() {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
}

const craters = Array.from({ length: 40 }, () => [
  (random() - 0.5) * 740, (random() - 0.5) * 740, 8 + random() * 45,
]);
craters.push([-65, -43, 28], [34, -58, 24], [90, 9, 19]);
function ground(x, z) {
  const fade = clamp((Math.min(...missions.map((level) => Math.hypot(x - level.padX, z))) - 9) / 15, 0, 1);
  let height = Math.sin(x * 0.039) * Math.cos(z * 0.042) * 3.5 +
    Math.sin(x * 0.22 + z * 0.17) * Math.cos(z * 0.18) * 0.8;
  for (const [cx, cz, radius] of craters) {
    const distance = Math.hypot(x - cx, z - cz) / radius;
    if (distance > 1.5) continue;
    height += radius * (0.07 * Math.exp(-((distance - 1) ** 2) * 28) -
      0.18 * Math.max(0, 1 - distance ** 2) ** 2);
  }
  return height * fade;
}

function add(parent, geometry, color, x, y, z, options = {}) {
  const mesh = new T.Mesh(geometry, new T.MeshStandardMaterial({ color, ...options }));
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

const surface = new T.PlaneGeometry(820, 820, 256, 256);
surface.rotateX(-Math.PI / 2);
const vertices = surface.attributes.position;
const colors = [];
for (let i = 0; i < vertices.count; i++) {
  const y = ground(vertices.getX(i), vertices.getZ(i));
  vertices.setY(i, y);
  const tone = clamp(0.23 + 0.01 * y + random() * 0.085, 0.11, 0.43);
  colors.push(tone, tone * 0.96, tone * 0.91);
}
surface.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
surface.computeVertexNormals();
add(scene, surface, 0xffffff, 0, 0, 0, { vertexColors: true }).receiveShadow = true;
const rocks = new T.InstancedMesh(new T.DodecahedronGeometry(1),
  new T.MeshStandardMaterial({ color: 0x68635b, flatShading: true }), 420);
const dummy = new T.Object3D();
for (let i = 0; i < rocks.count; i++) {
  const x = (random() - 0.5) * 450;
  const z = (random() - 0.5) * 370;
  const size = Math.abs(z) < 4 || missions.some((level) => Math.hypot(x - level.padX, z) < 12) ? 0 : 0.17 + random() ** 3 * 2.1;
  dummy.position.set(x, ground(x, z), z);
  dummy.rotation.set(random(), random() * 6, random());
  dummy.scale.set(size * 1.4, size * 0.73, size);
  dummy.updateMatrix();
  rocks.setMatrixAt(i, dummy.matrix);
}
scene.add(rocks);

const stars = [];
for (let i = 0; i < 1600; i++) {
  const angle = random() * 2 * Math.PI;
  const elevation = random() * 1.5;
  stars.push(950 * Math.cos(elevation) * Math.sin(angle), 950 * Math.sin(elevation),
    950 * Math.cos(elevation) * Math.cos(angle));
}
const sky = new T.BufferGeometry().setAttribute('position', new T.Float32BufferAttribute(stars, 3));
scene.add(new T.Points(sky, new T.PointsMaterial({ color: 0xcadfff, size: 1.25, fog: false })));

const pads = missions.map((level) => {
  const group = new T.Group();
  group.position.x = level.padX;
  scene.add(group);
  const width = level.pad + 0.9;
  add(group, new T.CylinderGeometry(width, width, 0.18, 64), 0x273a42, 0, 0.09, 0)
    .receiveShadow = true;
  for (const radius of [level.pad, width - 0.2]) {
    const ring = add(group, new T.RingGeometry(radius - 0.13, radius, 64),
      0x88fff0, 0, 0.19, 0, { emissive: 0x35b9a8, emissiveIntensity: 1.7 });
    ring.rotation.x = -Math.PI / 2;
  }
  for (const rotation of [0, Math.PI / 2]) {
    const strip = add(group, new T.BoxGeometry(level.pad * 0.65, 0.02, 0.22),
      0x8cc8bf, 0, 0.19, 0);
    strip.rotation.y = rotation;
  }
  return group;
});

const lander = new T.Group();
const cabin = new T.Group();
cabin.position.y = 2.1;
lander.add(cabin);
scene.add(lander);
add(cabin, new T.CylinderGeometry(1.26, 1.53, 0.85, 8), 0xc69549, 0, -0.52, 0,
  { metalness: 0.47, roughness: 0.4 });
add(cabin, new T.CylinderGeometry(0.79, 1.12, 1.16, 8), 0xbccdd5, 0, 0.44, 0);
add(cabin, new T.BoxGeometry(1.15, 0.43, 0.16), 0x164053, 0, 0.57, 0.93,
  { emissive: 0x093657, emissiveIntensity: 0.75 });
add(cabin, new T.CylinderGeometry(0.29, 0.53, 0.48, 12), 0x303943, 0, -1.08, 0);
add(cabin, new T.CylinderGeometry(0.04, 0.06, 0.8, 8), 0xe0e4e3, 0.4, 1.35, 0);
for (const x of [-1, 1]) {
  for (const z of [-1, 1]) {
    const top = new T.Vector3(x * 0.81, -0.4, z * 0.81);
    const foot = new T.Vector3(x * 1.66, -1.98, z * 1.66);
    const midpoint = top.clone().lerp(foot, 0.5);
    const strut = add(cabin, new T.CylinderGeometry(0.09, 0.16, top.distanceTo(foot), 8),
      0xb2a485, midpoint.x, midpoint.y, midpoint.z);
    strut.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), top.sub(foot).normalize());
    add(cabin, new T.CylinderGeometry(0.35, 0.46, 0.22, 12), 0xe2b769, foot.x, foot.y, foot.z);
  }
}
cabin.traverse((part) => { if (part.isMesh) part.castShadow = true; });
const exhaust = new T.Mesh(new T.ConeGeometry(0.44, 1, 14),
  new T.MeshBasicMaterial({ color: 0xffae50, transparent: true, opacity: 0.82 }));
exhaust.rotation.z = Math.PI;
cabin.add(exhaust);
const engineLight = new T.PointLight(0xff8744, 0, 16);
engineLight.position.y = -1.5;
cabin.add(engineLight);

const particles = Array.from({ length: 64 }, () => ({
  life: 0, x: 0, z: 0, vx: 0, vz: 0,
}));
const dust = new T.InstancedMesh(new T.IcosahedronGeometry(1, 0),
  new T.MeshBasicMaterial({ color: 0xa69a89, transparent: true, opacity: 0.28 }), particles.length);
dust.frustumCulled = false;
scene.add(dust);

const storage = () => window.localStorage;
const records = loadRecords(storage);
let levelIndex = Math.min(records.length, missions.length - 1);
let mission = missions[levelIndex];
let flight = newFlight(mission);
let nextAction = null;
let phase = 'ready';
const touch = new Map();
let accumulator = 0;
const held = new Set();
const controlCodes = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
const input = (...codes) => Number(codes.some((code) => held.has(code) || [...touch.values()].includes(code)));
const eye = new T.Vector3();
const look = new T.Vector3();

function resize() {
  const { clientWidth: width, clientHeight: height } = byId('scene');
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}
new ResizeObserver(resize).observe(byId('scene'));
resize();

function updateCampaign() {
  const select = byId('levels');
  select.replaceChildren(...missions.map((level, index) => {
    const option = document.createElement('option');
    const best = records[index];
    option.value = index;
    option.disabled = index > records.length;
    option.textContent = (index + 1) + ' · ' + level.name +
      (best !== undefined ? ' ✓' : option.disabled ? ' · Bloccato' : '');
    return option;
  }));
  select.value = levelIndex;
}

function showLevel(index, focus = true) {
  levelIndex = index;
  mission = missions[index];
  flight = newFlight(mission);
  phase = 'ready';
  held.clear();
  touch.clear();
  for (const particle of particles) particle.life = 0;
  for (const [padIndex, pad] of pads.entries()) pad.visible = padIndex === index;
  sun.target.position.x = mission.padX;
  sun.position.x = mission.padX - 45;
  sun.intensity = mission.light;
  updateCampaign();
  panel(index === 0 ? 'Lunar Lander 3D' : mission.name,
    'Atterra dolcemente nel cerchio luminoso.', 'Gioca', start, focus);
}

function panel(title, description, action, handler, focus = true) {
  byId('controls').hidden = true;
  byId('pause').hidden = true;
  sound.thrust(0);
  byId('mission').textContent = title;
  byId('message').textContent = description;
  byId('launch').textContent = action;
  byId('briefing').hidden = false;
  nextAction = handler;
  byId('secondary').hidden = true;
  if (focus) byId('launch').focus();
}

function start() {
  flight = newFlight(mission);
  for (const particle of particles) particle.life = 0;
  resume();
}
function resume() {
  sound.unlock();
  byId('controls').hidden = false;
  byId('pause').hidden = false;
  phase = 'flight';
  held.clear();
  touch.clear();
  accumulator = 0;
  byId('briefing').hidden = true;
  document.activeElement.blur();
}
function pause() {
  if (phase !== 'flight') return;
  phase = 'paused';
  held.clear();
  touch.clear();
  panel('In pausa', 'Premi Riprendi per continuare.', 'Riprendi', resume);
}
function finish() {
  phase = 'finished';
  held.clear();
  touch.clear();
  if (flight.result === 'landed') {
    const score = landingScore(flight, mission);
    records[levelIndex] = Math.max(records[levelIndex] ?? 0, score);
    saveRecords(storage, records);
    // record personale = somma dei migliori atterraggi: se cresce, premio in gettoni (docs/gettoni.md)
    if (window.parent !== window)
      parent.postMessage({ type: 'arcade:record', game: 'lunar-lander-3d', score: records.reduce((a, b) => a + (b || 0), 0) }, location.origin);
    updateCampaign();
    const finalLevel = levelIndex === missions.length - 1;
    panel(finalLevel ? 'Campagna completata' : 'Atterraggio riuscito',
      finalLevel ? 'Hai completato tutti i livelli.' : 'Il prossimo livello è sbloccato.',
      finalLevel ? 'Rigioca il livello' : 'Prossimo livello',
      finalLevel ? start : () => showLevel(levelIndex + 1));
    byId('secondary').hidden = finalLevel;
  } else {
    if (flight.result === 'crashed') sound.crash();
    panel('Modulo perduto', 'Frena e cerca il cerchio luminoso.', 'Riprova', start);
  }
}
scene.add(sun.target);
byId('launch').onclick = () => nextAction?.();
byId('secondary').onclick = start;
byId('levels').onchange = (event) => showLevel(Number(event.target.value));
showLevel(levelIndex, false);
byId('pause').onclick = pause;
byId('sound').onclick = () => byId('sound').setAttribute('aria-pressed', String(sound.toggle()));
for (const button of document.querySelectorAll('[data-control]')) {
  button.addEventListener('pointerdown', (event) => {
    if (phase !== 'flight' || event.button !== 0) return;
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    touch.set(event.pointerId, button.dataset.control);
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    button.addEventListener(type, (event) => touch.delete(event.pointerId));
  }
}

if (window.parent !== window) {
  const exit = byId('exit');
  exit.hidden = false;
  exit.onclick = () => parent.postMessage({ type: 'arcade:exit' }, location.origin);
  window.addEventListener('message', (event) => {
    if (event.source !== parent || event.origin !== location.origin || event.data?.type !== 'arcade:insets') return;
    for (const side of ['top', 'right', 'bottom', 'left']) {
      const { system, content } = event.data.insets?.[side] ?? {};
      const inset = [system, content].reduce((sum, value) => sum + (Number.isFinite(value) ? clamp(value, 0, 180) : 0), 0);
      document.documentElement.style.setProperty('--inset-' + side, inset + 'px');
    }
  });
  parent.postMessage({ type: 'arcade:ready' }, location.origin);
}
window.addEventListener('keydown', (event) => {
  if (event.altKey || event.ctrlKey || event.metaKey || event.target instanceof HTMLSelectElement) return;
  if (controlCodes.includes(event.code) && phase === 'flight') {
    event.preventDefault();
    held.add(event.code);
  }
  if (event.repeat) return;
  if (event.code === 'KeyR') start();
  if (event.code === 'Escape') {
    if (phase === 'paused') resume();
    else pause();
  }
});
window.addEventListener('keyup', (event) => held.delete(event.code));
window.addEventListener('blur', pause);
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

function updateDust(dt, power) {
  for (const [index, particle] of particles.entries()) {
    particle.life = Math.max(0, particle.life - dt);
    if (!particle.life && power > 0.22 && flight.y - ground(flight.x, 0) < 12 && random() < dt * 4) {
      const angle = random() * 2 * Math.PI;
      particle.life = 0.45 + random() * 0.65;
      particle.x = flight.x;
      particle.z = 0;
      particle.vx = Math.cos(angle) * (2 + power * 6);
      particle.vz = Math.sin(angle) * (2 + power * 6);
    }
    particle.x += particle.vx * dt;
    particle.z += particle.vz * dt;
    dummy.position.set(particle.x, ground(particle.x, particle.z) + 0.25, particle.z);
    dummy.scale.setScalar(particle.life ? 0.18 + (1.1 - particle.life) * 0.37 : 0);
    dummy.updateMatrix();
    dust.setMatrixAt(index, dummy.matrix);
  }
  dust.instanceMatrix.needsUpdate = true;
}

let previous = performance.now();

const fixedDt = 1 / 120;
renderer.setAnimationLoop((now) => {
  const dt = clamp((now - previous) / 1000, 0, 0.08);
  previous = now;
  if (phase === 'flight') {
    accumulator += dt;
    const controls = {
      power: input('KeyW', 'ArrowUp') - input('KeyS', 'ArrowDown'),
      turn: input('KeyD', 'ArrowRight') - input('KeyA', 'ArrowLeft'),
    };
    while (accumulator >= fixedDt && phase === 'flight') {
      step(flight, controls, fixedDt, ground, mission);
      accumulator -= fixedDt;
      if (flight.result) finish();
    }
  }
  lander.position.set(flight.x, flight.y, 0);
  cabin.rotation.z = -flight.angle;
  const power = phase === 'flight' && flight.fuel > 0 ? flight.throttle : 0;
  sound.thrust(power);
  const flameLength = power * (3.5 + Math.sin(now * 0.06) * 0.24);
  exhaust.visible = power > 0;
  exhaust.scale.y = flameLength;
  exhaust.position.y = -1.29 - flameLength / 2;
  engineLight.intensity = power * 28;
  if (phase !== 'paused') updateDust(dt, power);

  const frameWidth = Math.max(1, 1.35 / camera.aspect);
  const centerX = mission.padX + (flight.x - mission.padX) * 0.63;
  const centerY = flight.y * 0.51 + 2;
  const distance = 53 + Math.min(45, Math.hypot(flight.x - mission.padX, flight.y) * 0.35);
  eye.set(centerX, centerY + distance * 0.17, distance * frameWidth);
  look.set(centerX, centerY, 0);
  const smoothing = 1 - Math.exp(-dt * 4.8);
  if (!camera.position.z) camera.position.copy(eye);
  else camera.position.lerp(eye, smoothing);
  camera.lookAt(look);
  renderer.render(scene, camera);
});
