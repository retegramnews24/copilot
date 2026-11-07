import {applyInsets} from '../safe-area.js';
import {makeCourse, resetBike, stepBike, turnBike, FIXED_STEP} from './physics.js?v=4';
import {TrialAudio} from './audio.js';
import {drawTrial} from './render.js?v=4';

const $ = id => document.getElementById(id);
const canvas = $('trail'), ctx = canvas.getContext('2d', {alpha: false});
const keys = new Set(), pointers = new Map();
const audio = new TrialAudio(), remote = new Map();
const multiplayer = new URLSearchParams(location.search).get('multiplayer') === '1';
let race = null, self = null, connected = false, lastPose = '', seq = 0, retryTimer = 0;
const prefersReduced = matchMedia('(prefers-reduced-motion: reduce)');
const throttleKeys = ['ArrowUp', 'KeyW'], brakeKeys = ['ArrowDown', 'KeyS'];
const leftKeys = ['ArrowLeft', 'KeyA'], rightKeys = ['ArrowRight', 'KeyD'];
const driving = [...throttleKeys, ...brakeKeys, ...leftKeys, ...rightKeys];
const formatTime = seconds => Math.floor(seconds / 60) + ':' + String(Math.floor(seconds % 60)).padStart(2, '0');
const freshSeed = () => crypto.getRandomValues(new Uint32Array(1))[0];

let course = makeCourse(freshSeed()), bike = resetBike(course), mode = 'ready';
let elapsed = 0, falls = 0, accumulator = 0, lastFrame = 0, frame = 0;
let width = 1, height = 1, pixelRatio = 1;

function message(type, payload = {}) {
  if (parent !== window) parent.postMessage({type: 'moto-trial:' + type, ...payload}, location.origin);
}

function sendPose() {
  if (!connected || !race) return;
  const {x, y, angle, vx, facing, lean, roll, leftSpring, rightSpring} = bike;
  const compact = value => Math.round(value * 1000) / 1000;
  const pose = {x: compact(x), y: compact(y), angle: compact(angle), vx: compact(vx),
    facing, lean: compact(lean), roll: compact(roll), leftSpring: compact(leftSpring), rightSpring: compact(rightSpring), mode};
  const signature = JSON.stringify(pose);
  if (lastPose === signature) return;
  lastPose = signature;
  message('pose', {packet: {type: 'pose', seq: ++seq, ...pose}});
}

function blendPose(member, now) {
  const {from, pose, at} = member;
  const t = Math.min(1, (now - at) / 102);
  if (t >= 1 || !from) return pose;
  const angle = (a, b) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;
  return {...pose, x: from.x + (pose.x - from.x) * t, y: from.y + (pose.y - from.y) * t,
    angle: angle(from.angle, pose.angle), roll: angle(from.roll, pose.roll),
    leftSpring: (from.leftSpring ?? 0) * (1 - t) + (pose.leftSpring ?? 0) * t,
    rightSpring: (from.rightSpring ?? 0) * (1 - t) + (pose.rightSpring ?? 0) * t};
}

function receivePose(id, pose) {
  const member = remote.get(id);
  if (!member || !pose) return;
  const now = performance.now();
  member.from = member.pose && Math.hypot(member.pose.x - pose.x, member.pose.y - pose.y) < 4
    ? blendPose(member, now) : null;
  member.pose = pose;
  member.at = now;
  if (mode !== 'ride') draw();
}

function updateRaceStatus() {
  const status = $('race-status');
  status.hidden = !multiplayer;
  if (!multiplayer) return;
  const text = connected && race ? 'Corsa ' + race.number + ' · ' + race.players.length + '/8 piloti'
    : race ? 'Connessione alla corsa…' : 'Caricamento della corsa…';
  if (status.textContent !== text) status.textContent = text;
  $('primary').disabled = mode === 'ready' && !connected;
}

function receiveRace(data) {
  const state = data.state;
  if (!multiplayer || !state || !Array.isArray(state.players) || !Number.isInteger(state.seed)) return;
  const newRace = race?.room !== state.room;
  if (connected !== data.connected || newRace) lastPose = '';
  connected = data.connected;
  race = state;
  self = state.players.find(p => p.id === data.player) || self;
  if (newRace) {
    remote.clear();
    course = makeCourse(state.seed, state.courseVersion ?? 1);
    bike = resetBike(course);
  }
  const members = state.players.filter(p => p.id !== data.player);
  for (const id of remote.keys()) if (!members.some(p => p.id === id)) remote.delete(id);
  for (const member of members) {
    if (!remote.has(member.id)) remote.set(member.id, {name: member.name, color: member.color});
    if (member.pose) receivePose(member.id, member.pose);
  }
  updateRaceStatus();
  updateHUD();
  draw();
}

function clearInputs() {
  keys.clear();
  for (const button of pointers.values()) button.removeAttribute('data-held');
  pointers.clear();
}

function updateHUD() {
  $('section').textContent = (bike.tier + 1) + ' / ' + course.tiers.length;
  $('time').textContent = formatTime(elapsed);
  const tier = course.tiers[bike.tier];
  let cue = '';
  if (mode === 'ride') {
    if (!bike.onGround && bike.tier < course.tiers.length - 1 && (bike.x - tier.end) * tier.direction >= 0) cue = 'Atterra sul sentiero sotto';
    else if (bike.facing !== tier.direction) cue = 'Frena e gira ' + (tier.direction > 0 ? 'verso destra →' : 'verso sinistra ←');
    else if (tier.jump && (tier.jump.lip - bike.x) * tier.direction >= 0 &&
        Math.abs(tier.jump.lip - bike.x) < 17) cue = 'Salto · prendi slancio';
    else if (tier.precisionDrop && Math.abs(tier.end - bike.x) < 17) cue = 'Atterraggio stretto · frena prima del bordo';
    else if (bike.tier < course.tiers.length - 1 && Math.abs(tier.end - bike.x) < 15) cue = 'Discesa · rallenta dopo l’atterraggio';
  }
  const hint = $('cue');
  if (hint.textContent !== cue) hint.textContent = cue;
  hint.hidden = !cue;
}

function draw() {
  if (!ctx) return;
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  const now = performance.now(), riders = [];
  for (const member of remote.values()) if (member.pose) riders.push({...member, bike: blendPose(member, now)});
  drawTrial(ctx, width, height, course, bike, elapsed, prefersReduced.matches, riders, self?.color);
}

function resize() {
  const rect = canvas.getBoundingClientRect();
  width = Math.max(1, rect.width);
  height = Math.max(1, rect.height);
  pixelRatio = Math.min(devicePixelRatio || 1, 2, 1800 / Math.max(width, height));
  canvas.width = Math.max(1, Math.round(width * pixelRatio));
  canvas.height = Math.max(1, Math.round(height * pixelRatio));
  draw();
}

function setMode(next) {
  mode = next;
  clearInputs();
  accumulator = 0;
  cancelAnimationFrame(frame);
  clearTimeout(retryTimer);
  if (next !== 'ride') audio.update(false);
  $('menu').hidden = next === 'ride';
  $('controls').hidden = next !== 'ride';
  $('key-hints').hidden = next !== 'ride';
  $('pause').disabled = next !== 'ride';
  $('new-course').hidden = next === 'ready' || next === 'finish' || multiplayer;
  $('intro-controls').hidden = next !== 'ready';
  if (next === 'ride') {
    canvas.focus({preventScroll: true});
    lastFrame = performance.now();
    frame = requestAnimationFrame(tick);
  } else {
    const [title, description, button] = {
      ready: ['Moto Trial', 'Attraversa il canyon, scendi dalle rampe e inverti la marcia quando atterri sul tornante. Bilancia la moto sulle rampe per evitare di ribaltarti.', 'Parti'],
      paused: ['In pausa', multiplayer ? 'Gli altri piloti possono continuare a correre.' : 'Riprendi dallo stesso punto o genera un altro percorso.', 'Riprendi'],
      crash: ['Caduta', 'Ripartenza dall’inizio dello stesso percorso.', 'Riparti subito'],
      finish: ['Traguardo!', 'Tempo ' + formatTime(elapsed) + ' · ' + falls + (falls === 1 ? ' caduta' : ' cadute'), multiplayer ? 'Riprova lo stesso percorso' : 'Nuovo percorso']
    }[next];
    $('title').textContent = title;
    $('description').textContent = description;
    $('primary').textContent = button;
    if (next === 'crash') retryTimer = setTimeout(() => { if (!document.hidden) retryAfterFall(); }, 1100);
    if (next !== 'ready') $('primary').focus({preventScroll: true});
  }
  updateRaceStatus();
  updateHUD();
  draw();
}

function restart(reseed = false) {
  if (reseed && !multiplayer) {
    let seed = freshSeed();
    if (seed === course.seed) seed = (seed + 1) >>> 0;
    course = makeCourse(seed);
  }
  bike = resetBike(course);
  falls = elapsed = 0;
  setMode('ride');
}

function retryAfterFall() {
  bike = resetBike(course);
  elapsed = 0;
  setMode('ride');
}

function primary() {
  if (multiplayer && mode === 'ready' && !connected) return;
  audio.resume();
  if (mode === 'crash') retryAfterFall();
  else if (mode === 'finish') restart(true);
  else setMode('ride');
}

function tick(now) {
  if (mode !== 'ride') return;
  accumulator += Math.min(.067, Math.max(0, (now - lastFrame) / 1000));
  lastFrame = now;
  const held = new Set([...pointers.values()].map(button => button.dataset.hold));
  const input = {
    throttle: held.has('throttle') || throttleKeys.some(key => keys.has(key)),
    brake: held.has('brake') || brakeKeys.some(key => keys.has(key)),
    lean: Number(held.has('right') || rightKeys.some(key => keys.has(key))) -
      Number(held.has('left') || leftKeys.some(key => keys.has(key)))
  };
  while (accumulator >= FIXED_STEP && bike.status === 'ride') {
    const grounded = bike.onGround, fallSpeed = bike.vy;
    stepBike(course, bike, input);
    if (bike.status === 'crash') audio.surface(true, Math.max(4, fallSpeed));
    else if (grounded !== bike.onGround) audio.surface(bike.onGround, fallSpeed);
    elapsed += FIXED_STEP;
    accumulator -= FIXED_STEP;
  }
  audio.update(bike.status === 'ride', bike.vx, input.throttle && !input.brake, !bike.onGround);
  if (bike.status === 'crash') {
    falls++;
    setMode('crash');
  } else if (bike.status === 'finish') {
    setMode('finish');
  } else {
    updateHUD();
    draw();
    frame = requestAnimationFrame(tick);
  }
}

function turn() {
  if (mode === 'ride') {
    turnBike(bike);
    updateHUD();
  }
}

$('primary').onclick = primary;
$('new-course').onclick = () => { audio.resume(); restart(true); };
$('sound').onclick = () => {
  audio.setEnabled(!audio.enabled);
  $('sound').setAttribute('aria-pressed', String(audio.enabled));
  $('sound').textContent = audio.enabled ? '♫' : '♪̸';
};
$('pause').onclick = () => { if (mode === 'ride') setMode('paused'); };
$('exit').onclick = () => {
  if (parent === window) location.href = '/';
  else message('exit');
};

window.addEventListener('keydown', event => {
  const {code} = event;
  if (code === 'Escape' && (mode === 'ride' || mode === 'paused')) {
    event.preventDefault();
    if (!event.repeat) setMode(mode === 'ride' ? 'paused' : 'ride');
    return;
  }
  if (mode !== 'ride') return;
  if (code === 'Space') {
    event.preventDefault();
    if (!event.repeat) turn();
  } else if (driving.includes(code)) {
    event.preventDefault();
    keys.add(code);
  }
});
window.addEventListener('keyup', event => keys.delete(event.code));

const touchMedia = matchMedia('(pointer: coarse)');
function enableTouch() { document.body.classList.add('touch'); }
if (touchMedia.matches) enableTouch();
window.addEventListener('pointerdown', event => {
  if (event.pointerType === 'touch') enableTouch();
}, {capture: true});

for (const button of $('controls').querySelectorAll('[data-hold]')) {
  button.addEventListener('pointerdown', event => {
    if (mode !== 'ride' || event.button !== 0) return;
    event.preventDefault();
    pointers.set(event.pointerId, button);
    button.setAttribute('data-held', '');
    button.setPointerCapture?.(event.pointerId);
  });
}
function release(event) {
  const button = pointers.get(event.pointerId);
  if (!button) return;
  pointers.delete(event.pointerId);
  if (![...pointers.values()].includes(button)) button.removeAttribute('data-held');
}
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) window.addEventListener(type, release);

let lastTurnTouch = -Infinity;
$('turn').addEventListener('pointerdown', event => {
  if (event.pointerType !== 'touch') return;
  event.preventDefault();
  lastTurnTouch = performance.now();
  turn();
});
$('turn').onclick = event => {
  if (event.pointerType === 'touch' || event.detail > 0 && performance.now() - lastTurnTouch < 700) return;
  turn();
};

window.addEventListener('blur', clearInputs);
document.addEventListener('visibilitychange', () => {
  if (document.hidden && mode === 'ride') setMode('paused');
});
window.addEventListener('pagehide', () => {
  cancelAnimationFrame(frame);
  clearTimeout(retryTimer);
  audio.close();
});
window.addEventListener('resize', resize);
window.addEventListener('message', event => {
  if (parent === window || event.source !== parent || event.origin !== location.origin) return;
  const data = event.data;
  if (data?.type === 'moto-trial:insets') applyInsets(document.documentElement, data.insets);
  else if (data?.type === 'moto-trial:state') receiveRace(data);
  else if (data?.type === 'moto-trial:pose') receivePose(data.id, data.pose);
  else if (data?.type === 'moto-trial:connection') {
    connected = data.connected;
    lastPose = '';
    updateRaceStatus();
  }
});

if (multiplayer) {
  document.body.classList.add('moto-multi');
  setInterval(sendPose, 100);
}
resize();
setMode('ready');
message('ready');
