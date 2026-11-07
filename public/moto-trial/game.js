import {applyInsets} from '../safe-area.js';
import {makeCourse, resetBike, stepBike, turnBike, FIXED_STEP} from './physics.js';
import {drawTrial} from './render.js';

const $ = id => document.getElementById(id);
const canvas = $('trail'), ctx = canvas.getContext('2d', {alpha: false});
const keys = new Set(), pointers = new Map();
const prefersReduced = matchMedia('(prefers-reduced-motion: reduce)');
const throttleKeys = ['ArrowUp', 'KeyW'], brakeKeys = ['ArrowDown', 'KeyS'];
const leftKeys = ['ArrowLeft', 'KeyA'], rightKeys = ['ArrowRight', 'KeyD'];
const driving = [...throttleKeys, ...brakeKeys, ...leftKeys, ...rightKeys];
const formatTime = seconds => Math.floor(seconds / 60) + ':' + String(Math.floor(seconds % 60)).padStart(2, '0');
const freshSeed = () => crypto.getRandomValues(new Uint32Array(1))[0];

let course = makeCourse(freshSeed()), bike = resetBike(course), mode = 'ready';
let elapsed = 0, falls = 0, accumulator = 0, lastFrame = 0, frame = 0;
let width = 1, height = 1, pixelRatio = 1;

function message(type) {
  if (parent !== window) parent.postMessage({type: 'moto-trial:' + type}, location.origin);
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
    else if (bike.facing !== tier.direction) cue = 'Gira ' + (tier.direction > 0 ? 'verso destra →' : 'verso sinistra ←');
    else if (bike.tier < course.tiers.length - 1 && Math.abs(tier.end - bike.x) < 15) cue = 'Discesa · rallenta dopo l’atterraggio';
  }
  const hint = $('cue');
  if (hint.textContent !== cue) hint.textContent = cue;
  hint.hidden = !cue;
}

function draw() {
  if (!ctx) return;
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  drawTrial(ctx, width, height, course, bike, elapsed, prefersReduced.matches);
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
  $('menu').hidden = next === 'ride';
  $('controls').hidden = next !== 'ride';
  $('key-hints').hidden = next !== 'ride';
  $('pause').disabled = next !== 'ride';
  $('new-course').hidden = next === 'ready';
  $('intro-controls').hidden = next !== 'ready';
  if (next === 'ride') {
    canvas.focus({preventScroll: true});
    lastFrame = performance.now();
    frame = requestAnimationFrame(tick);
  } else {
    const [title, description, button] = {
      ready: ['Moto Trial', 'Attraversa il canyon, scendi dalle rampe e inverti la marcia quando atterri sul tornante. Le bandierine segnano i checkpoint.', 'Parti'],
      paused: ['In pausa', 'Riprendi dallo stesso punto o genera un altro percorso.', 'Riprendi'],
      crash: ['Caduta', 'Riparti dalla bandierina dell’ultimo tratto raggiunto.', 'Riprova dal checkpoint'],
      finish: ['Traguardo!', 'Tempo ' + formatTime(elapsed) + ' · ' + falls + (falls === 1 ? ' caduta' : ' cadute'), 'Riprova lo stesso percorso']
    }[next];
    $('title').textContent = title;
    $('description').textContent = description;
    $('primary').textContent = button;
    if (next !== 'ready') $('primary').focus({preventScroll: true});
  }
  updateHUD();
  draw();
}

function restart(reseed = false) {
  if (reseed) {
    let seed = freshSeed();
    if (seed === course.seed) seed = (seed + 1) >>> 0;
    course = makeCourse(seed);
  }
  bike = resetBike(course);
  falls = elapsed = 0;
  setMode('ride');
}

function primary() {
  if (mode === 'crash') bike = resetBike(course, bike.checkpoint);
  else if (mode === 'finish') {
    restart();
    return;
  }
  setMode('ride');
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
    stepBike(course, bike, input);
    elapsed += FIXED_STEP;
    accumulator -= FIXED_STEP;
  }
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
$('new-course').onclick = () => restart(true);
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
window.addEventListener('pagehide', () => cancelAnimationFrame(frame));
window.addEventListener('resize', resize);
window.addEventListener('message', event => {
  if (parent !== window && event.source === parent && event.origin === location.origin &&
      event.data?.type === 'moto-trial:insets') applyInsets(document.documentElement, event.data.insets);
});

resize();
setMode('ready');
message('ready');
